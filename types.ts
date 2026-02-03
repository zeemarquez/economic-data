// ----- Generic / extensible types for any tax regime -----

/** Inputs for salary calculation. Extensible for age, profession, country, etc. */
export interface SalaryInputs {
  grossSalary: number;
  [key: string]: unknown;
}

/** A single line in the tax breakdown (e.g. IRPF, Social Security). */
export interface TaxBreakdownItem {
  label: string;
  rate: number;
  amount: number;
  /** Optional key for UI or regime-specific logic (e.g. 'irpf', 'ssEmployee'). */
  key?: string;
}

/** Result produced by a tax regime. Holds all computed amounts and breakdown. */
export interface TaxRegimeResult {
  grossSalary: number;
  netSalaryYearly: number;
  netSalaryMonthly12: number;
  netSalaryMonthly14: number;
  totalTax: number;
  effectiveTaxRate: number;
  /** Generic list of tax lines (IRPF, SS, etc.). */
  breakdown: TaxBreakdownItem[];
  /** Optional progressive bracket breakdown (e.g. IRPF brackets). */
  brackets?: TaxBracketBreakdown[];
  /** Regime-specific amounts (e.g. irpfAmount, ssEmployee, ssEmployer, totalCostEmployer). */
  extra: Record<string, number>;
}

/** One bracket in a progressive tax (e.g. IRPF). */
export interface TaxBracketBreakdown {
  label: string;
  rate: number;
  amount: number;
}

/** A tax regime computes a full result from salary inputs. */
export interface TaxRegime {
  readonly id: string;
  readonly name: string;
  compute(inputs: SalaryInputs): TaxRegimeResult;
}

// ----- Legacy / UI compatibility -----

/** @deprecated Use TaxRegimeResult + SalaryBreakdown. Kept for gradual migration. */
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

export interface ChartDataPoint {
  name: string;
  value: number;
  fill?: string;
}
