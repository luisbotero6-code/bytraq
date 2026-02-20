import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@bytraq.se" },
    update: {},
    create: {
      email: "admin@bytraq.se",
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  // Employees
  const employees = await Promise.all([
    prisma.employee.create({
      data: { name: "Anna Andersson", costPerHour: 450, defaultPricePerHour: 1200, weeklyHours: 40, targetUtilization: 0.75 },
    }),
    prisma.employee.create({
      data: { name: "Erik Eriksson", costPerHour: 400, defaultPricePerHour: 1100, weeklyHours: 40, targetUtilization: 0.80 },
    }),
    prisma.employee.create({
      data: { name: "Maria Johansson", costPerHour: 500, defaultPricePerHour: 1400, weeklyHours: 40, targetUtilization: 0.70 },
    }),
    prisma.employee.create({
      data: { name: "Karl Svensson", costPerHour: 380, defaultPricePerHour: 1000, weeklyHours: 32, targetUtilization: 0.75 },
    }),
  ]);

  // Map admin to first employee
  await prisma.userEmployeeMapping.create({
    data: { userId: admin.id, employeeId: employees[0].id },
  });

  // More users
  const userHash = await bcrypt.hash("user123", 12);
  const users = await Promise.all([
    prisma.user.create({
      data: { email: "erik@bytraq.se", name: "Erik Eriksson", passwordHash: userHash, role: "TEAM_LEAD" },
    }),
    prisma.user.create({
      data: { email: "maria@bytraq.se", name: "Maria Johansson", passwordHash: userHash, role: "BYRALEDNING" },
    }),
    prisma.user.create({
      data: { email: "karl@bytraq.se", name: "Karl Svensson", passwordHash: userHash, role: "MEDARBETARE" },
    }),
  ]);

  await Promise.all([
    prisma.userEmployeeMapping.create({ data: { userId: users[0].id, employeeId: employees[1].id } }),
    prisma.userEmployeeMapping.create({ data: { userId: users[1].id, employeeId: employees[2].id } }),
    prisma.userEmployeeMapping.create({ data: { userId: users[2].id, employeeId: employees[3].id } }),
  ]);

  // Customer segments
  const segments = await Promise.all([
    prisma.customerSegment.create({ data: { name: "Aktiebolag", description: "Aktiebolag (AB)" } }),
    prisma.customerSegment.create({ data: { name: "Enskild firma", description: "Enskild firma (EF)" } }),
    prisma.customerSegment.create({ data: { name: "Ideell förening", description: "Ideella föreningar" } }),
  ]);

  // Customers
  await Promise.all([
    prisma.customer.create({
      data: { name: "Teknik AB", orgnr: "556001-1234", customerType: "LOPANDE", clientManagerId: employees[0].id, segmentId: segments[0].id },
    }),
    prisma.customer.create({
      data: { name: "Bygg & Montage AB", orgnr: "556002-5678", customerType: "FASTPRIS", clientManagerId: employees[0].id, segmentId: segments[0].id },
    }),
    prisma.customer.create({
      data: { name: "Restaurang Smak HB", orgnr: "916003-9012", customerType: "LOPANDE", clientManagerId: employees[2].id, segmentId: segments[1].id },
    }),
    prisma.customer.create({
      data: { name: "IT-Konsult Norden AB", orgnr: "556004-3456", customerType: "BLANDAD", clientManagerId: employees[2].id, segmentId: segments[0].id },
    }),
    prisma.customer.create({
      data: { name: "Kulturföreningen Ljus", orgnr: "802005-7890", customerType: "LOPANDE", clientManagerId: employees[1].id, segmentId: segments[2].id },
    }),
  ]);

  // Article groups
  const groups = await Promise.all([
    prisma.articleGroup.create({ data: { name: "Redovisning", type: "ORDINARIE" } }),
    prisma.articleGroup.create({ data: { name: "Rådgivning", type: "TILLAGG" } }),
    prisma.articleGroup.create({ data: { name: "Intern tid", type: "INTERNTID" } }),
    prisma.articleGroup.create({ data: { name: "Övrigt arbete", type: "OVRIGT" } }),
  ]);

  // Articles
  await Promise.all([
    prisma.article.create({ data: { code: "RED01", name: "Löpande bokföring", articleGroupId: groups[0].id } }),
    prisma.article.create({ data: { code: "RED02", name: "Månadsavstämning", articleGroupId: groups[0].id } }),
    prisma.article.create({ data: { code: "RED03", name: "Årsbokslut", articleGroupId: groups[0].id } }),
    prisma.article.create({ data: { code: "RED04", name: "Deklaration", articleGroupId: groups[0].id } }),
    prisma.article.create({ data: { code: "RAD01", name: "Skatterådgivning", articleGroupId: groups[1].id } }),
    prisma.article.create({ data: { code: "RAD02", name: "Ekonomisk rådgivning", articleGroupId: groups[1].id } }),
    prisma.article.create({ data: { code: "INT01", name: "Utbildning", articleGroupId: groups[2].id } }),
    prisma.article.create({ data: { code: "INT02", name: "Administration", articleGroupId: groups[2].id } }),
    prisma.article.create({ data: { code: "INT03", name: "Möte internt", articleGroupId: groups[2].id } }),
    prisma.article.create({ data: { code: "OVR01", name: "Övrigt kundarbete", articleGroupId: groups[3].id } }),
  ]);

  // Global pricing rule
  await prisma.pricingRule.create({
    data: { name: "Standardpris", scope: "GLOBAL", priority: 0, pricePerHour: 1200 },
  });

  // Swedish holidays 2025-2026 (röda dagar)
  const holidays: Array<{ date: string; name: string }> = [
    { date: "2025-01-01", name: "Nyårsdagen" },
    { date: "2025-01-06", name: "Trettondedag jul" },
    { date: "2025-04-18", name: "Långfredagen" },
    { date: "2025-04-20", name: "Påskdagen" },
    { date: "2025-04-21", name: "Annandag påsk" },
    { date: "2025-05-01", name: "Första maj" },
    { date: "2025-05-29", name: "Kristi himmelsfärdsdag" },
    { date: "2025-06-06", name: "Sveriges nationaldag" },
    { date: "2025-06-08", name: "Pingstdagen" },
    { date: "2025-06-20", name: "Midsommarafton" },
    { date: "2025-06-21", name: "Midsommardagen" },
    { date: "2025-11-01", name: "Alla helgons dag" },
    { date: "2025-12-24", name: "Julafton" },
    { date: "2025-12-25", name: "Juldagen" },
    { date: "2025-12-26", name: "Annandag jul" },
    { date: "2025-12-31", name: "Nyårsafton" },
    { date: "2026-01-01", name: "Nyårsdagen" },
    { date: "2026-01-06", name: "Trettondedag jul" },
    { date: "2026-04-03", name: "Långfredagen" },
    { date: "2026-04-05", name: "Påskdagen" },
    { date: "2026-04-06", name: "Annandag påsk" },
    { date: "2026-05-01", name: "Första maj" },
    { date: "2026-05-14", name: "Kristi himmelsfärdsdag" },
    { date: "2026-05-24", name: "Pingstdagen" },
    { date: "2026-06-06", name: "Sveriges nationaldag" },
    { date: "2026-06-19", name: "Midsommarafton" },
    { date: "2026-06-20", name: "Midsommardagen" },
    { date: "2026-10-31", name: "Alla helgons dag" },
    { date: "2026-12-24", name: "Julafton" },
    { date: "2026-12-25", name: "Juldagen" },
    { date: "2026-12-26", name: "Annandag jul" },
    { date: "2026-12-31", name: "Nyårsafton" },
  ];

  // Build a Set of all holiday dates for quick lookup
  const holidayDates = new Set(holidays.map(h => h.date));

  // Helper: format date as YYYY-MM-DD
  function fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Helper: check if a weekday is the day before a red day
  function isHalfDay(dateStr: string, dayOfWeek: number): boolean {
    if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekends are not half days
    const d = new Date(dateStr);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return holidayDates.has(fmtDate(next));
  }

  // Generate calendar days for 2025-2026
  for (let year = 2025; year <= 2026; year++) {
    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateStr = fmtDate(date);
        const holiday = holidays.find((h) => h.date === dateStr);
        const halfDay = !holiday && isHalfDay(dateStr, dayOfWeek);

        let workHours = 8;
        if (isWeekend || holiday) workHours = 0;
        else if (halfDay) workHours = 5;

        await prisma.calendarDay.upsert({
          where: { date },
          update: {},
          create: {
            date,
            isWeekend,
            isHoliday: !!holiday,
            holidayName: holiday?.name ?? (halfDay ? "Halvdag före röd dag" : null),
            workHours,
          },
        });
      }
    }
  }

  // Data quality rules
  await Promise.all([
    prisma.dataQualityRule.create({
      data: { name: "Saknad medarbetarkoppling", ruleType: "MISSING_EMPLOYEE_MAPPING", severity: "WARNING" },
    }),
    prisma.dataQualityRule.create({
      data: { name: "Saknad klientansvarig", ruleType: "MISSING_CLIENT_MANAGER", severity: "WARNING" },
    }),
    prisma.dataQualityRule.create({
      data: { name: "Artikel utan grupp", ruleType: "ARTICLE_WITHOUT_GROUP", severity: "ERROR" },
    }),
    prisma.dataQualityRule.create({
      data: { name: "Kund utan segment", ruleType: "CUSTOMER_WITHOUT_SEGMENT", severity: "INFO" },
    }),
  ]);

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
