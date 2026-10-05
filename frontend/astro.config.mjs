import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  outDir: '../static',
  devToolbar: {
    enabled: false
  },
  server: {
    port: 5555,
    host: true
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:9000',
          changeOrigin: true
        }
      }
    }
  }
});
