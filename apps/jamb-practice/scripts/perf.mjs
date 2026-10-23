// npm run perf (after `E2E=1 npm run build`). Starts the test server, then
// measures compressed transfer size and LCP on simulated Slow 4G with a 4x
// CPU slowdown, for the landing page and a lesson page. Fails over budget.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3100/jamb-practice';
const BUDGET = { landing: 150 * 1024, lesson: 100 * 1024, lcpMs: 2500 };

const server = spawn(process.execPath, ['scripts/e2e-server.mjs'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('server did not start');
}

async function measure(page, cdp, url) {
  let bytes = 0;
  const onDone = (e) => (bytes += e.encodedDataLength);
  cdp.on('Network.loadingFinished', onDone);
  await page.goto(url, { waitUntil: 'networkidle' });
  const lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          resolve(e ? e.startTime : 0);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(-1), 3000);
      }),
  );
  const cls = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let v = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) v += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(v), 500);
      }),
  );
  cdp.off('Network.loadingFinished', onDone);
  return { bytes, lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000 };
}

await waitUp();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
// Lighthouse "Slow 4G": 150 ms RTT, ~1.6 Mbps down, ~750 kbps up; 4x CPU slowdown.
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const landing = await measure(page, cdp, `${BASE}/`);

// Sign up through the API, then measure a lesson page with a warm cache ("after the first load").
await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
await page.request.post(`${BASE}/api/signup`, {
  headers: { origin: 'http://localhost:3100' },
  data: { firstName: 'Perf', phone: '0809 000 0001', classLevel: 'ss3', email: '', guardianConsent: true },
});
await page.goto(`${BASE}/learn`, { waitUntil: 'networkidle' });
const lesson = await measure(page, cdp, `${BASE}/learn/day/1`);

await browser.close();
stop();

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
console.log(`Landing (cold):       ${kb(landing.bytes)}  LCP ${landing.lcp} ms  CLS ${landing.cls}   (budget ${kb(BUDGET.landing)}, LCP < ${BUDGET.lcpMs} ms)`);
console.log(`Lesson (warm cache):  ${kb(lesson.bytes)}  LCP ${lesson.lcp} ms  CLS ${lesson.cls}   (budget ${kb(BUDGET.lesson)})`);
const fail = landing.bytes > BUDGET.landing || lesson.bytes > BUDGET.lesson || landing.lcp > BUDGET.lcpMs || landing.cls > 0.1;
process.exit(fail ? 1 : 0);
