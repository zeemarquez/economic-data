import type { SalaryInputs, TaxRegime, TaxRegimeResult, TaxBreakdownItem, TaxBracketBreakdown } from '../types';

// Spanish Tax System (Approximation for General Regime 2024)
const SS_EMPLOYEE_RATE = 0.064; // 4.7 (Common) + 1.55 (Unemployment) + 0.1 (Training) + MEI approx
const SS_EMPLOYER_RATE = 0.32; // Approx 31-33% total cost
const MAX_SS_BASE = 56646;
const PERSONAL_ALLOWANCE = 5550;
const EXPENSE_ALLOWANCE = 2000;
const IRPF_ZERO_THRESHOLD = 15876;

const IRPF_BRACKETS = [
  { limit: 12450, rate: 0.19 },
  { limit: 20200, rate: 0.24 },
  { limit: 35200, rate: 0.30 },
  { limit: 60000, rate: 0.37 },
  { limit: 300000, rate: 0.45 },
  { limit: Infinity, rate: 0.47 },
];

function computeBracketTax(
  base: number
): { total: number; breakdown: TaxBracketBreakdown[] } {
  let remaining = base;
  let accumulatedTax = 0;
  let previousLimit = 0;
  const breakdown: TaxBracketBreakdown[] = [];

  for (const bracket of IRPF_BRACKETS) {
    if (remaining <= 0) break;

    const taxableInBracket = Math.min(remaining, bracket.limit - previousLimit);
    const taxInBracket = taxableInBracket * bracket.rate;

    accumulatedTax += taxInBracket;
    remaining -= taxableInBracket;

    if (taxInBracket > 0) {
      breakdown.push({
        label: `${(previousLimit / 1000).toFixed(1)}k - ${(Math.min(base, bracket.limit) / 1000).toFixed(1)}k`,
        rate: bracket.rate,
        amount: taxInBracket,
      });
    }

    previousLimit = bracket.limit;
  }
  return { total: accumulatedTax, breakdown };
}

export const SpanishTaxRegime: TaxRegime = {
  id: 'es-general-2024',
  name: 'España (Régimen general 2024)',

  compute(inputs: SalaryInputs): TaxRegimeResult {
    const grossYearly = Number(inputs.grossSalary) || 0;

    const contributionBase = Math.min(grossYearly, MAX_SS_BASE);
    const ssEmployee = contributionBase * SS_EMPLOYEE_RATE;
    const ssEmployer = contributionBase * SS_EMPLOYER_RATE;
    const totalCostEmployer = grossYearly + ssEmployer;

    const netTaxableIncome = Math.max(0, grossYearly - ssEmployee - EXPENSE_ALLOWANCE);
    const fullTax = computeBracketTax(netTaxableIncome);
    const allowanceTax = computeBracketTax(PERSONAL_ALLOWANCE);

    let irpfAmount = fullTax.total - allowanceTax.total;
    if (irpfAmount < 0) irpfAmount = 0;
    if (grossYearly < IRPF_ZERO_THRESHOLD) irpfAmount = 0;

    const totalTax = ssEmployee + irpfAmount;
    const netSalaryYearly = grossYearly - totalTax;

    const breakdown: TaxBreakdownItem[] = [
      { label: 'IRPF', rate: grossYearly > 0 ? (irpfAmount / grossYearly) * 100 : 0, amount: irpfAmount, key: 'irpf' },
      { label: 'Seguridad Social (empresa)', rate: grossYearly > 0 ? (ssEmployer / grossYearly) * 100 : 0, amount: ssEmployer, key: 'ssEmployer' },
      { label: 'Seguridad Social (trabajador)', rate: grossYearly > 0 ? (ssEmployee / grossYearly) * 100 : 0, amount: ssEmployee, key: 'ssEmployee' },
    ];

    return {
      grossSalary: grossYearly,
      netSalaryYearly,
      netSalaryMonthly12: netSalaryYearly / 12,
      netSalaryMonthly14: netSalaryYearly / 14,
      totalTax,
      effectiveTaxRate: grossYearly > 0 ? (totalTax / grossYearly) * 100 : 0,
      breakdown,
      brackets: fullTax.breakdown,
      extra: {
        irpfAmount,
        ssEmployee,
        ssEmployer,
        totalCostEmployer,
      },
    };
  },
};
