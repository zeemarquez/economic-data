/**
 * Spanish tax regimes 2026 – one per autonomous community (general regime).
 * Basque Country and Navarre use foral systems and are not included.
 */

import { createSpanishRegime2026 } from './createSpanishRegime2026';
import {
  ANDALUSIA_IRPF_2026,
  ARAGON_IRPF_2026,
  ASTURIAS_IRPF_2026,
  BALEARIC_ISLANDS_IRPF_2026,
  CANARY_ISLANDS_IRPF_2026,
  CANTABRIA_IRPF_2026,
  CASTILE_LEON_IRPF_2026,
  CASTILLA_LA_MANCHA_IRPF_2026,
  CATALONIA_IRPF_2026,
  EXTREMADURA_IRPF_2026,
  GALICIA_IRPF_2026,
  LA_RIOJA_IRPF_2026,
  MADRID_IRPF_2026,
  MURCIA_IRPF_2026,
  VALENCIAN_COMMUNITY_IRPF_2026,
} from './regional-irpf-2026';

export { createSpanishRegime2026 } from './createSpanishRegime2026';
export type { CreateSpanishRegime2026Options } from './createSpanishRegime2026';
export * from './constants-2026';
export * from './calculations-2026';
export { REGIONAL_IRPF_2026 } from './regional-irpf-2026';

export const SpanishAndalusia2026 = createSpanishRegime2026({
  id: 'es-andalusia-2026',
  name: 'Andalucía (2026)',
  irpfBrackets: ANDALUSIA_IRPF_2026,
  metadata: { country: 'ES', region: 'Andalucía', year: 2026 },
});

export const SpanishAragon2026 = createSpanishRegime2026({
  id: 'es-aragon-2026',
  name: 'Aragón (2026)',
  irpfBrackets: ARAGON_IRPF_2026,
  metadata: { country: 'ES', region: 'Aragón', year: 2026 },
});

export const SpanishAsturias2026 = createSpanishRegime2026({
  id: 'es-asturias-2026',
  name: 'Asturias (2026)',
  irpfBrackets: ASTURIAS_IRPF_2026,
  metadata: { country: 'ES', region: 'Asturias', year: 2026 },
});

export const SpanishBalearicIslands2026 = createSpanishRegime2026({
  id: 'es-balearic-islands-2026',
  name: 'Illes Balears (2026)',
  irpfBrackets: BALEARIC_ISLANDS_IRPF_2026,
  metadata: { country: 'ES', region: 'Illes Balears', year: 2026 },
});

export const SpanishCanaryIslands2026 = createSpanishRegime2026({
  id: 'es-canary-islands-2026',
  name: 'Canarias (2026)',
  irpfBrackets: CANARY_ISLANDS_IRPF_2026,
  metadata: { country: 'ES', region: 'Canarias', year: 2026 },
});

export const SpanishCantabria2026 = createSpanishRegime2026({
  id: 'es-cantabria-2026',
  name: 'Cantabria (2026)',
  irpfBrackets: CANTABRIA_IRPF_2026,
  metadata: { country: 'ES', region: 'Cantabria', year: 2026 },
});

export const SpanishCastileLeon2026 = createSpanishRegime2026({
  id: 'es-castile-leon-2026',
  name: 'Castilla y León (2026)',
  irpfBrackets: CASTILE_LEON_IRPF_2026,
  metadata: { country: 'ES', region: 'Castilla y León', year: 2026 },
});

export const SpanishCastillaLaMancha2026 = createSpanishRegime2026({
  id: 'es-castilla-la-mancha-2026',
  name: 'Castilla-La Mancha (2026)',
  irpfBrackets: CASTILLA_LA_MANCHA_IRPF_2026,
  metadata: { country: 'ES', region: 'Castilla-La Mancha', year: 2026 },
});

export const SpanishCatalonia2026 = createSpanishRegime2026({
  id: 'es-catalonia-2026',
  name: 'Cataluña (2026)',
  irpfBrackets: CATALONIA_IRPF_2026,
  metadata: { country: 'ES', region: 'Cataluña', year: 2026 },
});

export const SpanishExtremadura2026 = createSpanishRegime2026({
  id: 'es-extremadura-2026',
  name: 'Extremadura (2026)',
  irpfBrackets: EXTREMADURA_IRPF_2026,
  metadata: { country: 'ES', region: 'Extremadura', year: 2026 },
});

export const SpanishGalicia2026 = createSpanishRegime2026({
  id: 'es-galicia-2026',
  name: 'Galicia (2026)',
  irpfBrackets: GALICIA_IRPF_2026,
  metadata: { country: 'ES', region: 'Galicia', year: 2026 },
});

export const SpanishLaRioja2026 = createSpanishRegime2026({
  id: 'es-la-rioja-2026',
  name: 'La Rioja (2026)',
  irpfBrackets: LA_RIOJA_IRPF_2026,
  metadata: { country: 'ES', region: 'La Rioja', year: 2026 },
});

export const SpanishMadrid2026 = createSpanishRegime2026({
  id: 'es-madrid-2026',
  name: 'Comunidad de Madrid (2026)',
  irpfBrackets: MADRID_IRPF_2026,
  metadata: { country: 'ES', region: 'Comunidad de Madrid', year: 2026 },
});

export const SpanishMurcia2026 = createSpanishRegime2026({
  id: 'es-murcia-2026',
  name: 'Región de Murcia (2026)',
  irpfBrackets: MURCIA_IRPF_2026,
  metadata: { country: 'ES', region: 'Región de Murcia', year: 2026 },
});

export const SpanishValencianCommunity2026 = createSpanishRegime2026({
  id: 'es-valencian-community-2026',
  name: 'Comunidad Valenciana (2026)',
  irpfBrackets: VALENCIAN_COMMUNITY_IRPF_2026,
  metadata: { country: 'ES', region: 'Comunidad Valenciana', year: 2026 },
});

/** All Spanish autonomous community regimes (2026). Excludes Basque Country and Navarre (foral). */
export const SPANISH_REGIMES_2026 = [
  SpanishAndalusia2026,
  SpanishAragon2026,
  SpanishAsturias2026,
  SpanishBalearicIslands2026,
  SpanishCanaryIslands2026,
  SpanishCantabria2026,
  SpanishCastileLeon2026,
  SpanishCastillaLaMancha2026,
  SpanishCatalonia2026,
  SpanishExtremadura2026,
  SpanishGalicia2026,
  SpanishLaRioja2026,
  SpanishMadrid2026,
  SpanishMurcia2026,
  SpanishValencianCommunity2026,
] as const;
