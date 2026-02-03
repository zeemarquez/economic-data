/**
 * Factory to create a Spanish tax regime for a given autonomous community (2026).
 * Uses shared Social Security logic and region-specific IRPF brackets.
 */

import type { SalaryInputs, TaxRegime, TaxRegimeResult, TaxBreakdownItem, TaxBracketDefinition, TaxRegimeMetadata } from '../../types';
import { getEmployeeSSMonthly, getEmployerSSMonthly, computeProgressiveTax, annualToMonthly } from './calculations-2026';

export interface CreateSpanishRegime2026Options {
  id: string;
  name: string;
  /** Combined (state + regional) IRPF brackets – annual limits (€), rates as decimals. */
  irpfBrackets: TaxBracketDefinition[];
  metadata?: TaxRegimeMetadata;
}

export function createSpanishRegime2026(options: CreateSpanishRegime2026Options): TaxRegime {
  const { id, name, irpfBrackets, metadata } = options;

  return {
    id,
    name,
    metadata: metadata ?? { country: 'ES', year: 2026 },

    compute(inputs: SalaryInputs): TaxRegimeResult {
      const grossYearly = Number(inputs.grossSalary) || 0;
      const grossMonthly = annualToMonthly(grossYearly);

      const ssEmployeeYearly = getEmployeeSSMonthly(grossMonthly) * 12;
      const ssEmployerYearly = getEmployerSSMonthly(grossMonthly) * 12;
      const totalCostEmployer = grossYearly + ssEmployerYearly;

      const annualTaxableBase = Math.max(0, grossYearly - ssEmployeeYearly);
      const { total: irpfAmount, breakdown: bracketBreakdown } = computeProgressiveTax(
        annualTaxableBase,
        irpfBrackets
      );

      const totalTax = ssEmployeeYearly + irpfAmount;
      const netSalaryYearly = grossYearly - totalTax;

      const breakdown: TaxBreakdownItem[] = [
        { label: 'IRPF', rate: grossYearly > 0 ? (irpfAmount / grossYearly) * 100 : 0, amount: irpfAmount, key: 'irpf' },
        { label: 'Seguridad Social (empresa)', rate: grossYearly > 0 ? (ssEmployerYearly / grossYearly) * 100 : 0, amount: ssEmployerYearly, key: 'ssEmployer' },
        { label: 'Seguridad Social (trabajador)', rate: grossYearly > 0 ? (ssEmployeeYearly / grossYearly) * 100 : 0, amount: ssEmployeeYearly, key: 'ssEmployee' },
      ];

      return {
        grossSalary: grossYearly,
        netSalaryYearly,
        netSalaryMonthly12: netSalaryYearly / 12,
        netSalaryMonthly14: netSalaryYearly / 14,
        totalTax,
        effectiveTaxRate: grossYearly > 0 ? (totalTax / grossYearly) * 100 : 0,
        breakdown,
        brackets: bracketBreakdown,
        extra: {
          irpfAmount,
          ssEmployee: ssEmployeeYearly,
          ssEmployer: ssEmployerYearly,
          totalCostEmployer,
        },
      };
    },
  };
}
