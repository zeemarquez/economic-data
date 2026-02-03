import type { SalaryInputs, TaxRegime, TaxRegimeResult, TaxBreakdownItem, TaxResult } from './types';

/**
 * Main object that holds inputs, tax regime, and computed breakdown.
 * Use this to calculate salary breakdown for any regime (e.g. Spain, other countries).
 */
export class SalaryBreakdown {
  private _inputs: SalaryInputs;
  private _regime: TaxRegime;
  private _result: TaxRegimeResult | null = null;

  constructor(inputs: SalaryInputs, regime: TaxRegime) {
    this._inputs = { ...inputs };
    this._regime = regime;
    this.compute();
  }

  /** Current inputs (e.g. grossSalary, and future: age, profession, country). */
  get inputs(): Readonly<SalaryInputs> {
    return this._inputs;
  }

  /** Tax regime used for calculation (e.g. SpanishTaxRegime). */
  get regime(): TaxRegime {
    return this._regime;
  }

  /** Raw result from the regime. Null if not yet computed. */
  get result(): TaxRegimeResult | null {
    return this._result;
  }

  /** Recompute breakdown from current inputs. Call after changing inputs. */
  compute(): void {
    this._result = this._regime.compute(this._inputs);
  }

  /** Update one or more inputs and recompute. */
  setInputs(partial: Partial<SalaryInputs>): void {
    this._inputs = { ...this._inputs, ...partial };
    this.compute();
  }

  /** Replace the tax regime and recompute. */
  setRegime(regime: TaxRegime): void {
    this._regime = regime;
    this.compute();
  }

  // ----- Convenience getters (delegate to result) -----

  get grossSalary(): number {
    return this._result?.grossSalary ?? 0;
  }

  get netSalaryYearly(): number {
    return this._result?.netSalaryYearly ?? 0;
  }

  get netSalaryMonthly12(): number {
    return this._result?.netSalaryMonthly12 ?? 0;
  }

  get netSalaryMonthly14(): number {
    return this._result?.netSalaryMonthly14 ?? 0;
  }

  get totalTax(): number {
    return this._result?.totalTax ?? 0;
  }

  get effectiveTaxRate(): number {
    return this._result?.effectiveTaxRate ?? 0;
  }

  /** List of tax lines (IRPF, SS, etc.) for display. */
  get breakdown(): TaxBreakdownItem[] {
    return this._result?.breakdown ?? [];
  }

  /** Regime-specific amounts (e.g. irpfAmount, ssEmployer). */
  get extra(): Record<string, number> {
    return this._result?.extra ?? {};
  }

  /** Total cost for employer (if provided by regime in extra.totalCostEmployer). */
  get totalCostEmployer(): number {
    return this._result?.extra?.totalCostEmployer ?? this._result?.grossSalary ?? 0;
  }

  /** Real tax rate (total tax + employer SS over total cost). Used for UI. */
  get realTaxRate(): number {
    const totalCost = this.totalCostEmployer;
    const employerTax = this._result?.extra?.ssEmployer ?? 0;
    const totalTaxAndEmployer = (this._result?.totalTax ?? 0) + employerTax;
    return totalCost > 0 ? (totalTaxAndEmployer / totalCost) * 100 : 0;
  }

  /**
   * Legacy shape for components that expect TaxResult (e.g. Sankey).
   * Maps breakdown/extra into the old TaxResult interface.
   */
  toTaxResult(): TaxResult {
    const r = this._result!;
    const ex = r.extra ?? {};
    return {
      grossSalary: r.grossSalary,
      netSalaryYearly: r.netSalaryYearly,
      netSalaryMonthly12: r.netSalaryMonthly12,
      netSalaryMonthly14: r.netSalaryMonthly14,
      totalTax: r.totalTax,
      irpfAmount: ex.irpfAmount ?? 0,
      ssEmployee: ex.ssEmployee ?? 0,
      ssEmployer: ex.ssEmployer ?? 0,
      totalCostEmployer: ex.totalCostEmployer ?? r.grossSalary,
      effectiveTaxRate: r.effectiveTaxRate,
      brackets: r.brackets ?? [],
    };
  }
}
