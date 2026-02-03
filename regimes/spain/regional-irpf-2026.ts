/**
 * IRPF combined (state + regional) brackets by autonomous community, 2026.
 * Limits are annual taxable income (€). Rates are combined state + regional (e.g. 0.19 = 19%).
 */

import type { TaxBracketDefinition } from '../../types';

const LIMITS = {
  L0: 0,
  L12450: 12_450,
  L20200: 20_200,
  L35200: 35_200,
  L60000: 60_000,
  L175000: 175_000,
  L300000: 300_000,
} as const;

function b(limit: number, rate: number): TaxBracketDefinition {
  return { limit, rate };
}

/** Andalusia: combined rates 19, 24, 30, 37, 45, 49 */
export const ANDALUSIA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.19),
  b(LIMITS.L20200, 0.24),
  b(LIMITS.L35200, 0.30),
  b(LIMITS.L60000, 0.37),
  b(LIMITS.L300000, 0.45),
  b(Infinity, 0.49),
];

/** Aragon: max 50% – use state structure, top bracket 50% */
export const ARAGON_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.50),
];

/** Asturias: max 50% */
export const ASTURIAS_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.50),
];

/** Balearic Islands: 18.5, 23.5, 30, 36.5, 44.25, 49.25 */
export const BALEARIC_ISLANDS_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.185),
  b(LIMITS.L20200, 0.235),
  b(LIMITS.L35200, 0.30),
  b(LIMITS.L60000, 0.365),
  b(LIMITS.L300000, 0.4425),
  b(Infinity, 0.4925),
];

/** Canary Islands: max 50.5% */
export const CANARY_ISLANDS_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.505),
];

/** Cantabria: 18, 23, 29, 36, 44.5, 49 */
export const CANTABRIA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.18),
  b(LIMITS.L20200, 0.23),
  b(LIMITS.L35200, 0.29),
  b(LIMITS.L60000, 0.36),
  b(LIMITS.L300000, 0.445),
  b(Infinity, 0.49),
];

/** Castile and León: 18.5, 23.5, 29, 35.5, 43.5, 46 */
export const CASTILE_LEON_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.185),
  b(LIMITS.L20200, 0.235),
  b(LIMITS.L35200, 0.29),
  b(LIMITS.L60000, 0.355),
  b(LIMITS.L300000, 0.435),
  b(Infinity, 0.46),
];

/** Castilla-La Mancha: max 47% */
export const CASTILLA_LA_MANCHA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.47),
];

/** Catalonia: 20, 24, 29, 37, 46, 50 */
export const CATALONIA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.20),
  b(LIMITS.L20200, 0.24),
  b(LIMITS.L35200, 0.29),
  b(LIMITS.L60000, 0.37),
  b(LIMITS.L300000, 0.46),
  b(Infinity, 0.50),
];

/** Extremadura: 17.5, 23, 29, 36.5, 45, 49.5 */
export const EXTREMADURA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.175),
  b(LIMITS.L20200, 0.23),
  b(LIMITS.L35200, 0.29),
  b(LIMITS.L60000, 0.365),
  b(LIMITS.L300000, 0.45),
  b(Infinity, 0.495),
];

/** Galicia: 18.5, 23.5, 29, 36.5, 44.5, 47 */
export const GALICIA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.185),
  b(LIMITS.L20200, 0.235),
  b(LIMITS.L35200, 0.29),
  b(LIMITS.L60000, 0.365),
  b(LIMITS.L300000, 0.445),
  b(Infinity, 0.47),
];

/** La Rioja: max 51.5% */
export const LA_RIOJA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.515),
];

/** Madrid: 18, 23.5, 28.5, 35.5, 43, 45 */
export const MADRID_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.18),
  b(LIMITS.L20200, 0.235),
  b(LIMITS.L35200, 0.285),
  b(LIMITS.L60000, 0.355),
  b(LIMITS.L300000, 0.43),
  b(Infinity, 0.45),
];

/** Murcia: max 47% */
export const MURCIA_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.095),
  b(LIMITS.L20200, 0.12),
  b(LIMITS.L35200, 0.15),
  b(LIMITS.L60000, 0.185),
  b(LIMITS.L300000, 0.225),
  b(Infinity, 0.47),
];

/** Valencian Community: 18.5, 24, 30, 37.5, 46.5 (to 175k), 50.5 (to 300k), 54 – different brackets */
export const VALENCIAN_COMMUNITY_IRPF_2026: TaxBracketDefinition[] = [
  b(LIMITS.L12450, 0.185),
  b(LIMITS.L20200, 0.24),
  b(LIMITS.L35200, 0.30),
  b(LIMITS.L60000, 0.375),
  b(LIMITS.L175000, 0.465),
  b(LIMITS.L300000, 0.505),
  b(Infinity, 0.54),
];

/** Navarre and Basque Country have foral regimes – not modelled here; use state-only as placeholder if needed. */
export const REGIONAL_IRPF_2026: Record<string, TaxBracketDefinition[]> = {
  andalusia: ANDALUSIA_IRPF_2026,
  aragon: ARAGON_IRPF_2026,
  asturias: ASTURIAS_IRPF_2026,
  'balearic-islands': BALEARIC_ISLANDS_IRPF_2026,
  'canary-islands': CANARY_ISLANDS_IRPF_2026,
  cantabria: CANTABRIA_IRPF_2026,
  'castile-leon': CASTILE_LEON_IRPF_2026,
  'castilla-la-mancha': CASTILLA_LA_MANCHA_IRPF_2026,
  catalonia: CATALONIA_IRPF_2026,
  extremadura: EXTREMADURA_IRPF_2026,
  galicia: GALICIA_IRPF_2026,
  'la-rioja': LA_RIOJA_IRPF_2026,
  madrid: MADRID_IRPF_2026,
  murcia: MURCIA_IRPF_2026,
  'valencian-community': VALENCIAN_COMMUNITY_IRPF_2026,
};
