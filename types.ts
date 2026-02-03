export interface TaxResult {
  grossSalary: number;
  netSalaryYearly: number;
  netSalaryMonthly12: number;
  netSalaryMonthly14: number;
  totalTax: number;
  irpfAmount: number;
  ssEmployee: number;
  ssEmployer: number;
  totalCostEmployer: number;
  effectiveTaxRate: number;
  brackets: TaxBracketBreakdown[];
}

export interface TaxBracketBreakdown {
  label: string;
  rate: number;
  amount: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}