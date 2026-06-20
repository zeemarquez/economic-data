<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1y0WXIRl90dn6wjKfgA81zDNxhntNOd_p

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Data pipelines

The dashboards read JSON baked at build time (committed under `data/` and `public/data/`).

- `npm run build:data` — Inflation series from public FRED/dataset CSVs → `data/inflation_annual.json`.
- `npm run build:energy` — OMIE day-ahead **supply curve by technology** → `public/data/omie_bids_latest.json`.
  Fetches the latest available OMIE `curva_pbc_uof` month, the official `marginalpdbc` clearing prices,
  and OMIE's own unit→technology registry (`LISTA_UNIDADES`, same code namespace → ~99% coverage,
  Spanish + Portuguese MIBEL units). No API token required. Note: unit-identified bids are public only
  after a ~90-day confidentiality window, so the dashboard always shows the latest available day
  (~3 months lagged) — this is inherent to the data, not a bug.
