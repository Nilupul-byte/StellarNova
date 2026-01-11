import fs from 'fs';
// import basicSsl from '@vitejs/plugin-basic-ssl'; // Removed - using mkcert certificates
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

const https = {
  key: fs.readFileSync('./certificates/localhost.multiversx.com+3-key.pem'),
  cert: fs.readFileSync('./certificates/localhost.multiversx.com+3.pem')
};

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    host: '0.0.0.0',
    https,
    watch: {
      usePolling: false,
      useFsEvents: false,
      ignored: ['**/.cache/**']
    },
    hmr: {
      overlay: false,
      host: 'localhost.multiversx.com',
      protocol: 'wss',
      port: Number(process.env.PORT) || 3000
    }
  },
  plugins: [
    react(),
    // basicSsl(), // Removed - using mkcert certificates
    tsconfigPaths(),
    svgrPlugin({
      svgrOptions: {
        exportType: 'named',
        ref: true,
        titleProp: true,
        svgo: false
      },
      include: '**/*.svg'
    }),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true }
    })
  ],
  css: {
    postcss: './postcss.config.js'
  },
  build: {
    outDir: 'build'
  },
  preview: {
    port: 3002,
    https: true,
    host: 'localhost',
    strictPort: true
  }
});
