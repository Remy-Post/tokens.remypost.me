import { defineConfig } from 'vite';

// No framework plugin: Vite's own JSX transform targets Preact directly (fewer dependencies to trust).
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { target: 'es2022', assetsInlineLimit: 0, modulePreload: { polyfill: false } },
});
