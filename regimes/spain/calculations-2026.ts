/**
 * Spanish payroll calculations 2026.
 * Contribution base, employee/employer SS, and progressive tax from bracket definitions.
 */

import type { TaxBracketBreakdown, TaxBracketDefinition } from '../../types';
import {
  SS_MIN_BASE_MONTHLY,
  SS_MAX_BASE_MONTHLY,
  SS_TIER2_MONTHLY,
  SS_TIER3_MONTHLY,
  SS_EMPLOYEE_BASE_RATE,
  SS_EMPLOYEE_SOLIDARITY_RATE_TIER2,
  SS_EMPLOYEE_SOLIDARITY_RATE_TIER3,
  SS_EMPLOYER_BASE_RATE,
  SS_EMPLOYER_ADD_RATE_TIER1,
  SS_EMPLOYER_ADD_RATE_TIER2,
  SS_EMPLOYER_ADD_RATE_TIER3,
} from './constants-2026';

/** Get monthly gross from annual (assumes 12 payments; use 14-payment equivalent if needed). */
export function annualToMonthly(annual: number): number {
  return annual / 12;
}

/** Contribution base (monthly). Min floor, cap at max for base rate. */
export function getContributionBaseMonthly(grossMonthly: number): number {
  if (grossMonthly <= SS_MIN_BASE_MONTHLY) return SS_MIN_BASE_MONTHLY;
  return Math.min(grossMonthly, SS_MAX_BASE_MONTHLY);
}

/** Employee SS (monthly): base rate on contribution base + solidarity on high salaries. */
export function getEmployeeSSMonthly(grossMonthly: number): number {
  const base = getContributionBaseMonthly(grossMonthly);
  let amount = base * SS_EMPLOYEE_BASE_RATE;

  if (grossMonthly > SS_TIER3_MONTHLY) {
    amount += (SS_TIER3_MONTHLY - SS_TIER2_MONTHLY) * SS_EMPLOYEE_SOLIDARITY_RATE_TIER2;
    amount += (grossMonthly - SS_TIER3_MONTHLY) * SS_EMPLOYEE_SOLIDARITY_RATE_TIER3;
  } else if (grossMonthly > SS_TIER2_MONTHLY) {
    amount += (grossMonthly - SS_TIER2_MONTHLY) * SS_EMPLOYEE_SOLIDARITY_RATE_TIER2;
  }

  return amount;
}

/** Employer SS (monthly): base on contribution base + additional tiers above max base. */
export function getEmployerSSMonthly(grossMonthly: number): number {
  const base = getContributionBaseMonthly(grossMonthly);
  let amount = base * SS_EMPLOYER_BASE_RATE;

  if (grossMonthly > SS_MAX_BASE_MONTHLY) {
    if (grossMonthly <= SS_TIER2_MONTHLY) {
      amount += (grossMonthly - SS_MAX_BASE_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER1;
    } else if (grossMonthly <= SS_TIER3_MONTHLY) {
      amount += (SS_TIER2_MONTHLY - SS_MAX_BASE_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER1;
      amount += (grossMonthly - SS_TIER2_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER2;
    } else {
      amount += (SS_TIER2_MONTHLY - SS_MAX_BASE_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER1;
      amount += (SS_TIER3_MONTHLY - SS_TIER2_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER2;
      amount += (grossMonthly - SS_TIER3_MONTHLY) * SS_EMPLOYER_ADD_RATE_TIER3;
    }
  }

  return amount;
}

/**
 * Compute progressive tax from bracket definitions (e.g. combined IRPF rates per bracket).
 * Returns total tax and per-bracket breakdown.
 */
export function computeProgressiveTax(
  taxableBase: number,
  brackets: TaxBracketDefinition[]
): { total: number; breakdown: TaxBracketBreakdown[] } {
  let remaining = taxableBase;
  let previousLimit = 0;
  let total = 0;
  const breakdown: TaxBracketBreakdown[] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bandWidth = bracket.limit === Infinity ? Math.max(0, remaining) : bracket.limit - previousLimit;
    const taxableInBracket = Math.min(remaining, bandWidth);
    const taxInBracket = taxableInBracket * bracket.rate;
    total += taxInBracket;
    remaining -= taxableInBracket;

    if (taxInBracket > 0) {
      const upper = bracket.limit === Infinity ? taxableBase : Math.min(taxableBase, bracket.limit);
      breakdown.push({
        label: `${(previousLimit / 1000).toFixed(1)}k - ${(upper / 1000).toFixed(1)}k`,
        rate: bracket.rate,
        amount: taxInBracket,
      });
    }

    previousLimit = bracket.limit;
  }

  return { total, breakdown };
}
