import { TaxResult, TaxBracketBreakdown } from '../types';

// Constants for Spanish Tax System (Approximation for General Regime 2024)
const SS_EMPLOYEE_RATE = 0.064; // 4.7 (Common) + 1.55 (Unemployment) + 0.1 (Training) + MEI approx
const SS_EMPLOYER_RATE = 0.32; // Approx 31-33% total cost
const MAX_SS_BASE = 56646; // Max contribution base approx 2024
const PERSONAL_ALLOWANCE = 5550; // Basic personal allowance
const EXPENSE_ALLOWANCE = 2000; // General reduction for work expenses

// IRPF Brackets (General State + Autonomous approx average)
const IRPF_BRACKETS = [
  { limit: 12450, rate: 0.19 },
  { limit: 20200, rate: 0.24 },
  { limit: 35200, rate: 0.30 },
  { limit: 60000, rate: 0.37 },
  { limit: 300000, rate: 0.45 },
  { limit: Infinity, rate: 0.47 },
];

export const calculateSalary = (grossYearly: number): TaxResult => {
  // 1. Social Security (Employee)
  // Capped at max base
  const contributionBase = Math.min(grossYearly, MAX_SS_BASE);
  const ssEmployee = contributionBase * SS_EMPLOYEE_RATE;

  // 2. Social Security (Employer)
  const ssEmployer = contributionBase * SS_EMPLOYER_RATE;
  const totalCostEmployer = grossYearly + ssEmployer;

  // 3. IRPF (Income Tax)
  // Taxable Base = Gross - SS - Reductions
  // Note: This is a simplified calculation. Real IRPF has complex family situations.
  // We apply the scale to the net taxable income, then subtract the scale applied to the personal minimum.

  const netTaxableIncome = Math.max(0, grossYearly - ssEmployee - EXPENSE_ALLOWANCE);

  const calculateTaxForBase = (base: number): { total: number; breakdown: TaxBracketBreakdown[] } => {
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
          amount: taxInBracket
        });
      }

      previousLimit = bracket.limit;
    }
    return { total: accumulatedTax, breakdown };
  };

  // Calculate full tax on income
  const fullTax = calculateTaxForBase(netTaxableIncome);

  // Calculate tax reduction for personal allowance (The Spanish method: Tax on Income - Tax on Min)
  // The personal minimum is treated as if it sits at the "bottom" of the scale for the purpose of the deduction logic in modern interpretations or simply deducted from base depending on exact algorithm.
  // Standard approximation: Apply scale to (Base) minus Apply scale to (Personal Min).
  
  // However, a more accurate simplified way for estimation tools:
  // Taxable Base for Brackets = NetTaxableIncome.
  // We simply compute the raw tax. Then we compute the "dummy" tax on the Personal Allowance to subtract it.
  const allowanceTax = calculateTaxForBase(PERSONAL_ALLOWANCE);
  
  let irpfAmount = fullTax.total - allowanceTax.total;
  if (irpfAmount < 0) irpfAmount = 0;

  // Correction for very low salaries (under ~15k effectively pays 0 IRPF usually due to extra reductions)
  if (grossYearly < 15876) {
     // 2024 limit for withholding is higher, roughly around here for single person without children
     irpfAmount = 0;
  }

  const totalTax = ssEmployee + irpfAmount;
  const netSalaryYearly = grossYearly - totalTax;

  return {
    grossSalary: grossYearly,
    netSalaryYearly,
    netSalaryMonthly12: netSalaryYearly / 12,
    netSalaryMonthly14: netSalaryYearly / 14,
    totalTax,
    irpfAmount,
    ssEmployee,
    ssEmployer,
    totalCostEmployer,
    effectiveTaxRate: grossYearly > 0 ? (totalTax / grossYearly) * 100 : 0,
    brackets: fullTax.breakdown,
  };
};