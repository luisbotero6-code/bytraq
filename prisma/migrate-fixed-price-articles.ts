/**
 * Data migration: Mark articles that appear in active (ongoing) budget entries
 * as includedInFixedPrice = true.
 *
 * Run with: npx tsx prisma/migrate-fixed-price-articles.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // Find all article IDs that appear in at least one active (ongoing) published budget entry
  const activeBudgetArticles = await db.budgetEntry.findMany({
    where: {
      status: "PUBLISHED",
      endYear: null, // still ongoing
    },
    select: { articleId: true },
    distinct: ["articleId"],
  });

  const articleIds = activeBudgetArticles.map((e) => e.articleId);

  if (articleIds.length === 0) {
    console.log("No active budget entries found. Nothing to migrate.");
    return;
  }

  const result = await db.article.updateMany({
    where: { id: { in: articleIds } },
    data: { includedInFixedPrice: true },
  });

  console.log(`Marked ${result.count} articles as includedInFixedPrice = true`);
  console.log("Article IDs:", articleIds);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
