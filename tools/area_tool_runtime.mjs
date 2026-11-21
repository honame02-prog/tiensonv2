// Reuse installed dependencies in a parent project when this isolated worktree has none.
// No installation or root-level junction; also usable with node --import for existing tests.
import { createRequire, registerHooks } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const candidates = [process.env.TIENSON_NODE_MODULES].filter(Boolean);
for (let d = process.cwd(); ; d = dirname(d)) {
  candidates.push(join(d, 'node_modules'), join(d, 'tiensonv2', 'node_modules'));
  if (dirname(d) === d) break;
}
const modules = candidates.find(d => existsSync(join(d, 'playwright/package.json')) && existsSync(join(d, 'vite/package.json')));
if (!modules) throw new Error('Existing playwright/vite required (or set TIENSON_NODE_MODULES); no packages were installed');
const userBrowserCache = process.env.USERPROFILE && join(process.env.USERPROFILE, 'AppData/Local/ms-playwright');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && userBrowserCache && existsSync(userBrowserCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = userBrowserCache;
if (!process.env.CHROME_LOG_FILE) {
  mkdirSync('records/HK-ENG', { recursive: true });
  process.env.CHROME_LOG_FILE = resolve('records/HK-ENG/chromium.log');
}
const req = createRequire(join(modules, '../package.json'));
export const packagePath = name => req.resolve(name);
export const { chromium } = await import(pathToFileURL(join(modules, 'playwright/index.mjs')).href);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'playwright') return { url: pathToFileURL(join(modules, 'playwright/index.mjs')).href, shortCircuit: true };
  return next(specifier, context);
} });
