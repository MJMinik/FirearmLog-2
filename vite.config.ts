import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any URL path, including
// GitHub Pages project sites like https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
