import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function ogMetaPlugin(env: Record<string, string>) {
  const baseUrl =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (env.VITE_SITE_URL || '').replace(/\/$/, '');
  const ogImageUrl = baseUrl ? `${baseUrl}/economic-data-screenshot.png` : '/economic-data-screenshot.png';
  const siteUrl = baseUrl || '';

  return {
    name: 'og-meta',
    transformIndexHtml(html: string) {
      return html
        .replace(/__OG_IMAGE_URL__/g, ogImageUrl)
        .replace(/__OG_SITE_URL__/g, siteUrl);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), ogMetaPlugin(env)],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
