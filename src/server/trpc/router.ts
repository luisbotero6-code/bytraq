import { router } from "./index";
import { timeEntryRouter } from "./routers/time-entry";
import { budgetRouter } from "./routers/budget";
import { customerRouter } from "./routers/customer";
import { employeeRouter } from "./routers/employee";
import { articleRouter } from "./routers/article";
import { userRouter } from "./routers/user";
import { pricingRouter } from "./routers/pricing";
import { periodLockRouter } from "./routers/period-lock";
import { kpiRouter } from "./routers/kpi";
import { taskRouter } from "./routers/task";
import { dataQualityRouter } from "./routers/data-quality";
import { auditRouter } from "./routers/audit";
import { importRouter } from "./routers/import";
import { calendarRouter } from "./routers/calendar";
import { absenceRouter } from "./routers/absence";

export const appRouter = router({
  timeEntry: timeEntryRouter,
  absence: absenceRouter,
  budget: budgetRouter,
  customer: customerRouter,
  employee: employeeRouter,
  article: articleRouter,
  user: userRouter,
  pricing: pricingRouter,
  periodLock: periodLockRouter,
  kpi: kpiRouter,
  task: taskRouter,
  dataQuality: dataQualityRouter,
  audit: auditRouter,
  import: importRouter,
  calendar: calendarRouter,
});

export type AppRouter = typeof appRouter;
