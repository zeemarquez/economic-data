/**
 * Spanish payroll constants 2026.
 * Social Security bases and rates, and state IRPF brackets (same for all regions).
 */

/** Monthly minimum contribution base (€). */
export const SS_MIN_BASE_MONTHLY = 1381.2;

/** Monthly maximum base for standard contributions (€). */
export const SS_MAX_BASE_MONTHLY = 5101.2;

/** Thresholds for additional solidarity contributions (monthly €). */
export const SS_TIER2_MONTHLY = 5611.33;
export const SS_TIER3_MONTHLY = 7651.8;

/** Employee: base rate on contribution base (common + unemployment permanent + training + MEI 2026). */
export const SS_EMPLOYEE_BASE_RATE = 0.065;

/** Employee: solidarity rate on salary between SS_TIER2 and SS_TIER3 (monthly). */
export const SS_EMPLOYEE_SOLIDARITY_RATE_TIER2 = 0.0021;
/** Employee: solidarity rate on salary above SS_TIER3 (monthly). */
export const SS_EMPLOYEE_SOLIDARITY_RATE_TIER3 = 0.0024;

/** Employer: base rate (common + unemployment permanent + FOGASA + training + accidents office + MEI 2026). */
export const SS_EMPLOYER_BASE_RATE = 0.3215;

/** Employer: additional rate on salary between MAX_BASE and TIER2 (monthly). */
export const SS_EMPLOYER_ADD_RATE_TIER1 = 0.0083;
/** Employer: additional rate on salary between TIER2 and TIER3 (monthly). */
export const SS_EMPLOYER_ADD_RATE_TIER2 = 0.0104;
/** Employer: additional rate on salary above TIER3 (monthly). */
export const SS_EMPLOYER_ADD_RATE_TIER3 = 0.0122;

/** State IRPF brackets (annual €) – same for all autonomous communities. Combined with regional rate. */
export const IRPF_STATE_BRACKETS_ANNUAL = [
  { limit: 12_450, rate: 0.095 },
  { limit: 20_200, rate: 0.12 },
  { limit: 35_200, rate: 0.15 },
  { limit: 60_000, rate: 0.185 },
  { limit: 300_000, rate: 0.225 },
  { limit: Infinity, rate: 0.245 },
] as const;
