/**
 * One-time budget import script.
 *
 * Reads a TSV file (tab-separated) with columns:
 *   Startmånad | Slutmånad | Rad att ladda | Laddmånad | Kundnummer | Kund |
 *   Artikelnummer | Artikel | Fastpris | Budget | Kundtyp
 *
 * Filters on "Rad att ladda" = SANT, matches customers by customerNumber
 * and articles by code, then creates PUBLISHED budget entries.
 *
 * Usage:
 *   npx tsx prisma/seed-budget.ts <path-to-file.tsv>
 *
 * Add --all flag to also import historical rows (FALSKT):
 *   npx tsx prisma/seed-budget.ts <path-to-file.tsv> --all
 *
 * Add --dry-run to preview without writing to DB:
 *   npx tsx prisma/seed-budget.ts <path-to-file.tsv> --dry-run
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as XLSX from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------- helpers ----------

/** Parse Swedish number format: "2 666,67" → 2666.67, "- kr" or empty → 0 */
function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/\s/g, "").replace("kr", "").replace(/−/g, "-").replace(",", ".").trim();
  if (!cleaned || cleaned === "-") return 0;
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Parse a date into { year, month }. Supports:
 *  - "2023-03-01" (ISO)
 *  - "3/1/23" or "3/1/2023" (US M/D/YY from Excel)
 *  - "2023-03" (YYYY-MM)
 */
function parsePeriod(s: string): { year: number; month: number } | null {
  if (!s || !s.trim()) return null;
  const v = s.trim();

  // ISO: 2023-03-01 or 2023-03
  const iso = v.match(/^(\d{4})-(\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    if (!isNaN(year) && month >= 1 && month <= 12) return { year, month };
  }

  // US format from Excel: M/D/YY or M/D/YYYY
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const month = parseInt(us[1], 10);
    let year = parseInt(us[3], 10);
    if (year < 100) year += 2000; // 23 → 2023
    if (!isNaN(year) && month >= 1 && month <= 12) return { year, month };
  }

  return null;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith("--"));
  const includeAll = args.includes("--all");
  const dryRun = args.includes("--dry-run");

  if (!filePath) {
    console.error("Usage: npx tsx prisma/seed-budget.ts <path-to-file.tsv> [--all] [--dry-run]");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Read file — support both Excel (.xlsx/.xls) and TSV/CSV
  const isExcel = filePath.endsWith(".xlsx") || filePath.endsWith(".xls");
  let tsvContent: string;

  if (isExcel) {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, cellText: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    tsvContent = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", rawNumbers: false });
  } else {
    tsvContent = fs.readFileSync(filePath, "utf-8");
  }

  const lines = tsvContent.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    console.error("File must have a header row and at least one data row");
    process.exit(1);
  }

  // Parse header
  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const col = (name: string) => {
    const idx = headers.indexOf(name);
    if (idx === -1) {
      // Try partial match
      const partial = headers.findIndex((h) => h.includes(name));
      return partial;
    }
    return idx;
  };

  const iStart = col("startmånad");
  const iEnd = col("slutmånad");
  const iLoad = col("rad att ladda");
  const iCustNum = col("kundnummer");
  const iCustName = col("kund");
  const iArtNum = col("artikelnummer");
  const iArtName = col("artikel");
  const iAmount = col("fastpris");
  const iHours = col("budget");

  if (iCustNum === -1 || iArtNum === -1) {
    console.error("Could not find required columns (Kundnummer, Artikelnummer)");
    console.error("Found headers:", headers);
    process.exit(1);
  }

  console.log(`Parsed header with ${headers.length} columns`);
  console.log(`Mode: ${includeAll ? "ALL rows" : "Only SANT rows"}${dryRun ? " (DRY RUN)" : ""}`);

  // Load customers and articles from DB
  const customers = await prisma.customer.findMany();
  const articles = await prisma.article.findMany({ where: { active: true } });

  const customerByNumber = new Map<string, { id: string; name: string }>();
  for (const c of customers) {
    if (c.customerNumber) customerByNumber.set(c.customerNumber, { id: c.id, name: c.name });
  }

  const articleByCode = new Map<string, string>();
  for (const a of articles) {
    articleByCode.set(a.code.toLowerCase(), a.id);
  }

  console.log(`DB: ${customers.length} customers, ${articles.length} articles`);

  // Parse data rows
  const dataRows = lines.slice(1);
  const toInsert: Array<{
    startYear: number;
    startMonth: number;
    endYear: number | null;
    endMonth: number | null;
    customerId: string;
    articleId: string;
    hours: number;
    amount: number;
    status: "PUBLISHED";
    version: number;
  }> = [];

  const skippedCustomers = new Set<string>();
  const skippedArticles = new Set<string>();
  let filteredOut = 0;
  let parseErrors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i].split("\t").map((c) => c.trim());

    // Filter on "Rad att ladda" (SANT/TRUE in Swedish/English)
    const loadFlag = iLoad !== -1 ? (cells[iLoad] ?? "").toUpperCase().trim() : "SANT";
    if (!includeAll && loadFlag !== "SANT" && loadFlag !== "TRUE") {
      filteredOut++;
      continue;
    }

    // Parse start period
    const start = parsePeriod(cells[iStart] ?? "");
    if (!start) {
      parseErrors++;
      continue;
    }

    // Parse end period (optional)
    const end = parsePeriod(cells[iEnd] ?? "");

    // Match customer
    const custNum = cells[iCustNum] ?? "";
    const custName = cells[iCustName] ?? "";
    const customer = customerByNumber.get(custNum);
    if (!customer) {
      skippedCustomers.add(`${custNum} (${custName})`);
      continue;
    }

    // Match article
    const artNum = cells[iArtNum] ?? "";
    const artName = cells[iArtName] ?? "";
    const articleId = articleByCode.get(artNum.toLowerCase());
    if (!articleId) {
      skippedArticles.add(`${artNum} (${artName})`);
      continue;
    }

    const hours = parseNum(cells[iHours] ?? "");
    const amount = parseNum(cells[iAmount] ?? "");

    toInsert.push({
      startYear: start.year,
      startMonth: start.month,
      endYear: end?.year ?? null,
      endMonth: end?.month ?? null,
      customerId: customer.id,
      articleId,
      hours,
      amount,
      status: "PUBLISHED",
      version: 1,
    });
  }

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Total data rows:       ${dataRows.length}`);
  console.log(`Filtered out (FALSKT): ${filteredOut}`);
  console.log(`Parse errors:          ${parseErrors}`);
  console.log(`To insert:             ${toInsert.length}`);

  if (skippedCustomers.size > 0) {
    console.log(`\nSkipped customers (not in DB):`);
    for (const c of skippedCustomers) console.log(`  - ${c}`);
  }

  if (skippedArticles.size > 0) {
    console.log(`\nSkipped articles (not in DB):`);
    for (const a of skippedArticles) console.log(`  - ${a}`);
  }

  if (toInsert.length === 0) {
    console.log("\nNothing to insert.");
    return;
  }

  // Show preview of first 10 rows
  console.log(`\nPreview (first 10):`);
  for (const row of toInsert.slice(0, 10)) {
    const cust = customers.find((c) => c.id === row.customerId);
    const art = articles.find((a) => a.id === row.articleId);
    const endStr = row.endYear ? `${row.endYear}-${String(row.endMonth).padStart(2, "0")}` : "pågående";
    console.log(
      `  ${cust?.name?.padEnd(30)} ${art?.code.padEnd(6)} ${row.startYear}-${String(row.startMonth).padStart(2, "0")} → ${endStr}  ${row.hours}h  ${row.amount} kr`,
    );
  }

  if (dryRun) {
    console.log("\n(Dry run — no data written)");
    return;
  }

  // Insert
  console.log(`\nInserting ${toInsert.length} budget entries...`);
  const result = await prisma.budgetEntry.createMany({
    data: toInsert,
    skipDuplicates: true,
  });
  console.log(`Done! ${result.count} rows inserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
