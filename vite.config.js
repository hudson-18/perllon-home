import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

const SUPABASE_ORIGIN_TOKEN = '__SUPABASE_ORIGIN__';

function configuredSupabaseOrigin(mode) {
  const value = (process.env.VITE_SUPABASE_URL || loadEnv(mode, process.cwd(), '').VITE_SUPABASE_URL)?.trim();
  if (!value || value.includes('YOUR-PROJECT')) return '';
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('VITE_SUPABASE_URL must use HTTP or HTTPS.');
  }
  return url.origin;
}

function securityPolicyOrigins(origin) {
  const replacement = origin || '';
  return {
    name: 'perllon-security-policy-origins',
    transformIndexHtml(html) {
      return html.replaceAll(SUPABASE_ORIGIN_TOKEN, replacement);
    },
    async closeBundle() {
      const template = await readFile(resolve('public/_headers'), 'utf8');
      await writeFile(resolve('dist/_headers'), template.replaceAll(SUPABASE_ORIGIN_TOKEN, replacement));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [securityPolicyOrigins(configuredSupabaseOrigin(mode))],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html'
      },
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
}));
