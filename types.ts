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

/** One bracket in a progressive tax (e.g. IRPF) – used for result breakdown. */
export interface TaxBracketBreakdown {
  label: string;
  rate: number;
  amount: number;
}

/** Definition of one bracket for a progressive tax (input). Generic for any regime. */
export interface TaxBracketDefinition {
  /** Upper limit of this bracket (inclusive). Use Infinity for the top bracket. */
  limit: number;
  /** Rate applied to income in this bracket (e.g. 0.095 for 9.5%). */
  rate: number;
}

/** Optional metadata for a tax regime (country, region, year). Kept general for any regime. */
export interface TaxRegimeMetadata {
  country?: string;
  region?: string;
  year?: number;
  [key: string]: unknown;
}

/** A tax regime computes a full result from salary inputs. */
export interface TaxRegime {
  readonly id: string;
  readonly name: string;
  /** Optional metadata (country, region, year) for filtering or display. */
  readonly metadata?: TaxRegimeMetadata;
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

// ----- State budget / spending (generic for any country or year) -----

/** A single policy or line item within a budget category (e.g. "Pensiones", "Sanidad"). */
export interface BudgetPolicyItem {
  name: string;
  amount: number;
}

/** A budget category grouping several policies (e.g. "Protección y promoción social"). */
export interface BudgetCategory {
  totalAmount: number;
  policies: BudgetPolicyItem[];
}

/** Full state budget data: category name -> category. Reusable for different countries/years. */
export type StateBudgetData = Record<string, BudgetCategory>;

/** Raw JSON shape for Spain 2023 (nombre/presupuesto/total_presupuesto/politicas). Map to BudgetCategory when loading. */
export interface SpanishBudgetCategoryRaw {
  total_presupuesto: number;
  politicas: { nombre: string; presupuesto: number }[];
}

/** A single spending item (new flat format with label and description). */
export interface SpendingItem {
  name: string;
  amount: number;
  category: string;
  label: string;
  description: string;
  /** Administración que gestiona la partida: estatal, ccaa, municipal. */
  administracion?: string;
}

/** State spending data: total and flat list of items (reusable for any country/year). */
export interface SpendingData {
  total_spending: number | { estatal: number; ccaa: number; municipal: number };
  spending_items: SpendingItem[];
}
