import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const holidays = [
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

const holidayDates = new Set(holidays.map(h => h.date));

/** Create a UTC noon date to avoid timezone shifting */
function utcDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

function nextDateStr(dateStr: string): string {
  const d = utcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isHalfDay(dateStr: string, dayOfWeek: number): boolean {
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  if (holidayDates.has(dateStr)) return false;
  return holidayDates.has(nextDateStr(dateStr));
}

async function main() {
  console.log("Updating calendar days...");
  let updated = 0;

  for (let year = 2025; year <= 2026; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const date = utcDate(dateStr);
        const dayOfWeek = date.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const holiday = holidays.find(h => h.date === dateStr);
        const halfDay = isHalfDay(dateStr, dayOfWeek);

        let workHours = 8;
        if (isWeekend || holiday) workHours = 0;
        else if (halfDay) workHours = 5;

        await prisma.calendarDay.upsert({
          where: { date },
          create: {
            date,
            isWeekend,
            isHoliday: !!holiday,
            holidayName: holiday?.name ?? (halfDay ? "Halvdag före röd dag" : null),
            workHours,
          },
          update: {
            isHoliday: !!holiday,
            holidayName: holiday?.name ?? (halfDay ? "Halvdag före röd dag" : null),
            workHours,
            isWeekend,
          },
        });
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} calendar days`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
