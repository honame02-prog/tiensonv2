// Minimal local test server; production vite.config.js remains untouched.
import { packagePath } from './area_tool_runtime.mjs';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const { createServer, build } = await import(pathToFileURL(packagePath('vite')).href);
const portArg = process.argv.indexOf('--port');
const config = { configFile: false, root: process.cwd(), base: './',
  cacheDir: 'records/HK-ENG/vite-cache',
  resolve: { alias: { phaser: join(dirname(packagePath('phaser/package.json')), 'dist/phaser.esm.js') } },
  server: { host: '127.0.0.1', port: portArg < 0 ? 5199 : +process.argv[portArg + 1], strictPort: true, fs: { allow: [process.cwd(), dirname(packagePath('phaser/package.json'))] } },
  build: { outDir: 'records/HK-ENG/build', chunkSizeWarningLimit: 2000 },
};
if (process.argv.includes('--build')) await build(config);
else { const server = await createServer(config); await server.listen(); console.log(`area test server PID=${process.pid} port=${server.config.server.port}`); }
