import fs from 'fs';
// import basicSsl from '@vitejs/plugin-basic-ssl'; // Removed - using mkcert certificates
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgrPlugin from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// Only load HTTPS certificates in local development (when certificates exist)
const certKeyPath = './certificates/localhost.multiversx.com+3-key.pem';
const certPath = './certificates/localhost.multiversx.com+3.pem';
const httpsConfig = fs.existsSync(certKeyPath) && fs.existsSync(certPath)
  ? {
      key: fs.readFileSync(certKeyPath),
      cert: fs.readFileSync(certPath)
    }
  : undefined;

export default defineConfig({
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    host: '0.0.0.0',
    https: httpsConfig,
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
    https: httpsConfig,
    host: 'localhost',
    strictPort: true
  }
});
