import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const nativeChrome = existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
export default defineConfig({
  testDir: './tests/browser', timeout: 60000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 900 }, headless: true, channel: nativeChrome ? 'chrome' : undefined, launchOptions: { args: nativeChrome ? [] : ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 30000 },
});
