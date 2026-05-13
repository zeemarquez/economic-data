import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';
import { Select, type SelectOption } from '../components/ui/Select';

import madridGeoUrl from '../data/spain/housing/madrid/madrid_municipios.geojson?url';
import madridCsvUrl from '../data/spain/housing/madrid/madrid_municipios_precios_merged.csv?url';

const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

type MetricId = 'house' | 'rent' | 'yield';

type MuniProps = GeoJsonProperties & {
  id?: number;
  municipio?: string;
  uri?: string;
  nuts4_nombre?: string;
  precio_venta_eur_m2?: number | null;
  precio_alquiler_eur_m2_mes?: number | null;
  plot?: number;
};

const METRIC_OPTIONS: SelectOption<MetricId>[] = [
  { value: 'house', label: 'Precio compra por m² (k€/m²)' },
  { value: 'rent', label: 'Precio alquiler por m² (€/m² · mes)' },
  { value: 'yield', label: 'Alquiler / compra (% anual: renta / precio)' },
];

function parseMadridCsv(text: string): Map<string, { venta: number | null; rent: number | null }> {
  const out = new Map<string, { venta: number | null; rent: number | null }>();
  const lines = text.trim().split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 5) continue;
    const uri = parts[2];
    const ventaRaw = parts[3];
    const rentRaw = parts[4];
    const venta = ventaRaw === '' ? null : Number(ventaRaw);
    const rent = rentRaw === '' ? null : Number(rentRaw);
    out.set(uri, {
      venta: venta != null && Number.isFinite(venta) ? venta : null,
      rent: rent != null && Number.isFinite(rent) ? rent : null,
    });
  }
  return out;
}

function plotForMetric(
  venta: number | null | undefined,
  rent: number | null | undefined,
  metric: MetricId
): number {
  const v = venta != null && venta > 0 ? venta : null;
  const r = rent != null && rent > 0 ? rent : null;
  if (metric === 'house') return v != null ? v / 1000 : -1;
  if (metric === 'rent') return r != null ? r : -1;
  if (v != null && r != null) return (r * 12 * 100) / v;
  return -1;
}

/** Semi-transparent white → dark red for choropleth. */
function plotFillColor(plot: number, min: number, max: number): string {
  if (plot < 0) return 'rgba(255,255,255,0.06)';
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 'rgba(110,0,0,0.78)';
  const t = Math.min(1, Math.max(0, (plot - min) / (max - min)));
  const r = Math.round(255 - (255 - 95) * t);
  const g = Math.round(255 - 255 * t);
  const b = Math.round(255 - 255 * t);
  const a = 0.12 + 0.66 * t;
  return `rgba(${r},${g},${b},${a})`;
}

function formatPlot(metric: MetricId, plot: number): string {
  if (plot < 0) return '—';
  if (metric === 'house') return `${plot.toFixed(2)} k€/m²`;
  if (metric === 'rent') return `${plot.toFixed(2)} €/m² mes`;
  return `${plot.toFixed(2)} %`;
}

function enrichCollection(
  base: FeatureCollection<Geometry, MuniProps>,
  m: MetricId
): FeatureCollection<Geometry, MuniProps> {
  return {
    ...base,
    features: base.features.map((f) => {
      const p = f.properties ?? {};
      const plot = plotForMetric(p.precio_venta_eur_m2, p.precio_alquiler_eur_m2_mes, m);
      return { ...f, properties: { ...p, plot } };
    }),
  };
}

function popupHtml(props: MuniProps, metric: MetricId): string {
  const name = props.municipio ?? 'Municipio';
  const venta = props.precio_venta_eur_m2;
  const rent = props.precio_alquiler_eur_m2_mes;
  const plot = typeof props.plot === 'number' ? props.plot : -1;
  const yieldPct =
    venta != null && rent != null && venta > 0 && rent > 0 ? (rent * 12 * 100) / venta : null;
  return `<div style="font-family:ui-monospace,monospace;font-size:12px;color:#e5e5e5;line-height:1.5;min-width:200px">
    <div style="font-weight:700;margin-bottom:6px;color:#fafafa">${name}</div>
    <div>Venta: ${venta != null ? `${venta.toFixed(0)} €/m²` : '—'}</div>
    <div>Alquiler: ${rent != null ? `${rent.toFixed(2)} €/m² mes` : '—'}</div>
    <div>Renta bruta: ${yieldPct != null ? `${yieldPct.toFixed(2)} %` : '—'}</div>
    <div style="margin-top:6px;color:#a3a3a3">Mostrado: ${formatPlot(metric, plot)}</div>
  </div>`;
}

export default function ViviendaMadrid() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoLayerRef = useRef<L.GeoJSON | null>(null);
  const metricRef = useRef<MetricId>('house');
  const [metric, setMetric] = useState<MetricId>('house');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [baseCollection, setBaseCollection] = useState<FeatureCollection<Geometry, MuniProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [geoRes, csvRes] = await Promise.all([fetch(madridGeoUrl), fetch(madridCsvUrl)]);
        if (!geoRes.ok) throw new Error(`GeoJSON: ${geoRes.status}`);
        if (!csvRes.ok) throw new Error(`CSV: ${csvRes.status}`);
        const rawGeo = (await geoRes.json()) as FeatureCollection<Geometry, MuniProps>;
        const csvText = await csvRes.text();
        const prices = parseMadridCsv(csvText);

        const features: Feature<Geometry, MuniProps>[] = rawGeo.features.map((f) => {
          const uri = f.properties?.uri;
          const row = uri != null ? prices.get(uri) : undefined;
          return {
            ...f,
            properties: {
              ...f.properties,
              precio_venta_eur_m2: row?.venta ?? null,
              precio_alquiler_eur_m2_mes: row?.rent ?? null,
            },
          };
        });

        if (!cancelled) {
          setBaseCollection({ type: 'FeatureCollection', features });
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error al cargar datos');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  metricRef.current = metric;

  const dataCollection = useMemo(() => {
    if (!baseCollection) return null;
    return enrichCollection(baseCollection, metric);
  }, [baseCollection, metric]);

  const { minPlot, maxPlot } = useMemo(() => {
    if (!dataCollection) return { minPlot: 0, maxPlot: 1 };
    const vals: number[] = [];
    for (const f of dataCollection.features) {
      const pl = f.properties?.plot;
      if (typeof pl === 'number' && pl > -1) vals.push(pl);
    }
    if (vals.length === 0) return { minPlot: 0, maxPlot: 1 };
    return { minPlot: Math.min(...vals), maxPlot: Math.max(...vals) };
  }, [dataCollection]);

  /** Solo polígonos con dato para la métrica activa (mapa + escala). */
  const filteredCollection = useMemo((): FeatureCollection<Geometry, MuniProps> | null => {
    if (!dataCollection) return null;
    const feats = dataCollection.features.filter((f) => {
      const pl = f.properties?.plot;
      return typeof pl === 'number' && pl > -1;
    });
    return { type: 'FeatureCollection', features: feats };
  }, [dataCollection]);

  /** Leaflet map + Carto raster tiles (no WebGL worker). */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !baseCollection) return;

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([40.39, -3.72], 9);

    L.tileLayer(CARTO_DARK_TILES, {
      subdomains: 'abc',
      maxZoom: 20,
      attribution: CARTO_ATTRIBUTION,
    }).addTo(map);

    mapInstanceRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);

    const t1 = window.setTimeout(() => map.invalidateSize(), 0);
    const t2 = window.setTimeout(() => map.invalidateSize(), 250);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      geoLayerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [baseCollection]);

  /** GeoJSON overlay + styles (updates when métrica / filtros / escala cambian). */
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !filteredCollection) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    const layer = L.geoJSON(filteredCollection as never, {
      style: (feat) => {
        const plot = (feat.properties as MuniProps | null | undefined)?.plot ?? -1;
        return {
          fillColor: plotFillColor(plot, minPlot, maxPlot),
          fillOpacity: 1,
          color: 'rgba(255,255,255,0.35)',
          weight: 0.8,
          opacity: 1,
        };
      },
      onEachFeature: (feature, lyr) => {
        const props = (feature.properties ?? {}) as MuniProps;
        let closePopupTimer: ReturnType<typeof setTimeout> | null = null;

        const resetStyle = () => {
          const plot = props.plot ?? -1;
          lyr.setStyle({
            fillColor: plotFillColor(plot, minPlot, maxPlot),
            fillOpacity: 1,
            color: 'rgba(255,255,255,0.35)',
            weight: 0.8,
            opacity: 1,
          });
        };

        lyr.bindPopup(
          () => popupHtml(props, metricRef.current),
          {
            maxWidth: 300,
            className: 'vivienda-madrid-popup',
            closeButton: false,
            autoPan: true,
            autoPanPadding: [36, 36],
            interactive: true,
          }
        );

        lyr.on('mouseover', () => {
          if (closePopupTimer != null) {
            window.clearTimeout(closePopupTimer);
            closePopupTimer = null;
          }
          lyr.setStyle({ weight: 2, color: 'rgba(255,255,255,0.85)' });
          lyr.openPopup();
        });
        lyr.on('mouseout', () => {
          resetStyle();
          closePopupTimer = window.setTimeout(() => {
            lyr.closePopup();
            closePopupTimer = null;
          }, 220);
        });
      },
    }).addTo(map);

    geoLayerRef.current = layer;

    try {
      const b = layer.getBounds();
      if (b.isValid()) {
        map.fitBounds(b, { padding: [28, 28], maxZoom: 11, animate: false });
      }
    } catch {
      /* empty */
    }

    map.invalidateSize({ animate: false });
  }, [filteredCollection, minPlot, maxPlot, metric]);

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-6xl mb-8 flex justify-between items-end border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-neutral-500 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Volver al inicio"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-2 font-mono">
            VIVIENDA<span className="text-neutral-500">MADRID</span>
          </h1>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-4">
        <p className="text-neutral-400 font-mono text-xs leading-relaxed max-w-3xl">
          Precios medios por municipio (venta y alquiler por m²), enlazados con límites administrativos. La
          rentabilidad es alquiler anual sobre precio de compra por m² (renta bruta aproximada). Solo se dibujan
          áreas con dato para la métrica elegida.
        </p>

        {loadError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200 font-mono">
            {loadError}
          </div>
        )}

        <div className="w-full rounded-xl border border-white/10 bg-black/40 shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] overflow-hidden">
          <div className="glass-panel border-0 rounded-none border-b border-white/10 p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 gap-y-5 md:gap-y-0 md:items-start">
              <div className="min-w-0 flex flex-col gap-2">
                <Select<MetricId>
                  compact
                  label="Valor en el mapa"
                  value={metric}
                  options={METRIC_OPTIONS}
                  onChange={setMetric}
                  id="metric-vivienda"
                />
              </div>
              <div className="min-w-0 flex flex-col gap-2">
                <span
                  id="map-leyenda-label"
                  className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono pl-1"
                >
                  Leyenda
                </span>
                <div
                  className="flex h-10 min-h-10 w-full items-stretch gap-3 font-mono text-sm text-neutral-400"
                  role="group"
                  aria-labelledby="map-leyenda-label"
                >
                  <span className="flex shrink-0 items-center tabular-nums leading-none">
                    {formatPlot(metric, minPlot)}
                  </span>
                  <div
                    className="min-h-0 min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900/50 shadow-inner overflow-hidden"
                    role="img"
                    aria-label={`Escala de ${formatPlot(metric, minPlot)} a ${formatPlot(metric, maxPlot)}`}
                  >
                    <div
                      className="h-full w-full"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(255,255,255,0.12) 0%, rgba(110,0,0,0.78) 100%)',
                      }}
                    />
                  </div>
                  <span className="flex shrink-0 items-center tabular-nums leading-none">
                    {formatPlot(metric, maxPlot)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative w-full bg-neutral-950 leaflet-map-root"
            style={{ height: 'min(70vh, 640px)', minHeight: 400 }}
          >
            <div
              ref={containerRef}
              className="h-full w-full z-0 rounded-b-xl"
              style={{ minHeight: 400 }}
            />
            {!dataCollection && !loadError && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 font-mono text-sm text-neutral-400">
                Cargando datos…
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-neutral-600 font-mono text-[10px]">
          <MapIcon size={14} aria-hidden />
          <span>Leaflet · Carto dark_all (mismo estilo oscuro que Dark Matter en raster)</span>
        </div>
      </main>

      <style>{`
        .leaflet-map-root .leaflet-container {
          background: #0a0a0a;
          font-family: inherit;
        }
        .leaflet-map-root .leaflet-control-attribution {
          background: rgba(10, 10, 10, 0.85);
          color: #a3a3a3;
          font-size: 10px;
          max-width: 100%;
        }
        .leaflet-map-root .leaflet-control-attribution a {
          color: #d4d4d4;
        }
        .leaflet-map-root .leaflet-popup-content-wrapper {
          border-radius: 10px;
          background: #0a0a0a;
          color: #e5e5e5;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }
        .leaflet-map-root .leaflet-popup-tip {
          background: #0a0a0a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: none;
        }
        .leaflet-map-root .leaflet-popup-content {
          margin: 10px 12px;
        }
        .leaflet-map-root .vivienda-madrid-popup .leaflet-popup-close-button {
          color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
