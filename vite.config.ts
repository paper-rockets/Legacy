import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function localConfigPersistencePlugin(): Plugin {
  return {
    name: 'local-config-persistence',
    configureServer(server) {
      server.middlewares.use('/api/save-config-to-disk', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const configData = JSON.parse(body);
              const targetPath = path.resolve(__dirname, 'src/core/saved_biome_config.json');
              fs.writeFileSync(targetPath, JSON.stringify(configData, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Configuration saved permanently to disk at src/core/saved_biome_config.json' }));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: String(err) }));
            }
          });
        } else {
          res.statusCode = 404;
          res.end();
        }
      });

      server.middlewares.use('/api/load-config-from-disk', (req, res) => {
        if (req.method === 'GET') {
          try {
            const targetPath = path.resolve(__dirname, 'src/core/saved_biome_config.json');
            if (fs.existsSync(targetPath)) {
              const raw = fs.readFileSync(targetPath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(raw);
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ exists: false }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
        } else {
          res.statusCode = 404;
          res.end();
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), localConfigPersistencePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          comparison: path.resolve(__dirname, 'terrain_comparison.html'),
          rainbow_god_rays: path.resolve(__dirname, 'rainbow_god_rays.html'),
          vortex_portal: path.resolve(__dirname, 'vortex_portal_demo.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
