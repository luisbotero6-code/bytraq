-- Rename year/month to startYear/startMonth
ALTER TABLE "budget_entries" RENAME COLUMN "year" TO "startYear";
ALTER TABLE "budget_entries" RENAME COLUMN "month" TO "startMonth";

-- Add nullable end period columns
ALTER TABLE "budget_entries" ADD COLUMN "endYear" INTEGER;
ALTER TABLE "budget_entries" ADD COLUMN "endMonth" INTEGER;

-- Drop old unique constraint and indexes
DROP INDEX IF EXISTS "budget_unique_published";
DROP INDEX IF EXISTS "budget_entries_year_month_idx";

-- Create new unique constraint and indexes
CREATE UNIQUE INDEX "budget_unique_entry" ON "budget_entries"("startYear", "startMonth", "customerId", "articleId", "status");
CREATE INDEX "budget_entries_customerId_startYear_startMonth_idx" ON "budget_entries"("customerId", "startYear", "startMonth");
CREATE INDEX "budget_entries_startYear_startMonth_idx" ON "budget_entries"("startYear", "startMonth");
