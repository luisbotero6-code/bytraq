export interface TimeEntryData {
  hours: number;
  calculatedPrice: number;
  costAmount: number;
  runningPrice?: number;
  articleGroupType: "ORDINARIE" | "TILLAGG" | "INTERNTID" | "OVRIGT";
}

export interface BudgetData {
  hours: number;
  amount: number;
}

export interface CapacityData {
  totalWorkingHours: number;
  absenceHours: number;
}

export interface KPIResult {
  tb: number;
  tgPercent: number;
  utilization: number;
  totalRevenue: number;
  totalCost: number;
  totalHours: number;
  debitableHours: number;
  availableHours: number;
  budgetVarianceHours: number;
  budgetVarianceAmount: number;
}
