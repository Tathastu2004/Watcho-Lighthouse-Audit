// Log Puppeteer and Lighthouse version for debugging (compatible with all Node.js versions)
try {
  const puppeteerPkg = JSON.parse(fs.readFileSync('./node_modules/puppeteer/package.json', 'utf-8'));
  console.log('Using Puppeteer version:', puppeteerPkg.version);
  const lighthousePkg = JSON.parse(fs.readFileSync('./node_modules/lighthouse/package.json', 'utf-8'));
  console.log('Using Lighthouse version:', lighthousePkg.version);
} catch (e) {
  console.log('Could not determine Puppeteer/Lighthouse version:', e.message);
}
// Log Puppeteer version for debugging
// audit.js
import 'dotenv/config';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteerExtra.use(StealthPlugin());
const puppeteer = puppeteerExtra;
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import readline from 'readline';

// ============ CONFIG ============
// Update these URLs anytime you like.
const URLS = [
  'https://www.watcho.com/',
  'https://www.watcho.com/shows',
  'https://www.watcho.com/movies',
  'https://www.watcho.com/live-tv'
];

// If login-only pages exist, add them here too after logging in:
const LOGGED_IN_URLS = [
  // e.g. 'https://www.watcho.com/my-account',
  // e.g. 'https://www.watcho.com/subscriptions'
];

// Confirm/adjust this if Watcho uses a different login route.
const LOGIN_URL = 'https://www.watcho.com/signin';

// How many runs per URL (averaged)
const RUNS = Number(process.env.RUNS || 3);

// Local folders
const OUT_DIR = path.resolve('./reports');
const USER_DATA_DIR = path.resolve('./.chrome-profile');

// ============ HELPERS ============

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pause = (q) => new Promise(res => rl.question(q, () => res()));

// Prompt for device type at the very start
let DEVICE_TYPE = null;
async function promptDeviceType() {
  let answer = '';
  while (!['mobile', 'desktop'].includes(answer)) {
    answer = await new Promise(res => {
      rl.question('Select device type for Lighthouse audit (mobile/desktop): ', res);
    });
    answer = answer.trim().toLowerCase();
  }
  DEVICE_TYPE = answer;
}

const ensureDir = async (dir) => {
  if (!fs.existsSync(dir)) await fsp.mkdir(dir, { recursive: true });
};

const slugify = (u) =>
  u.replace(/^https?:\/\//, '')
   .replace(/[^\w\-]+/g, '_')
   .replace(/_+$/,'')
   .toLowerCase();

const metricFromLhr = (lhr) => {
  const pick = (id) => lhr.audits[id]?.numericValue ?? null;
  const catScore = (name) => Math.round((lhr.categories[name]?.score ?? 0) * 100);

  return {
    url: lhr.finalUrl,
    categories: {
      performance: catScore('performance'),
      accessibility: catScore('accessibility'),
      bestPractices: catScore('best-practices'),
      seo: catScore('seo'),
      pwa: catScore('pwa'),
    },
    webVitals: {
      fcp_ms: pick('first-contentful-paint'),
      lcp_ms: pick('largest-contentful-paint'),
      tbt_ms: pick('total-blocking-time'),
      cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? null,
      tti_ms: pick('interactive'),
      speedIndex_ms: pick('speed-index'),
    }
  };
};

const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
const round = (x, d=0) => (x==null ? null : Number(x.toFixed(d)));

const averageMetrics = (runs) => {
  // Average category scores and vitals across runs
  return {
    runs: runs.length,
    categories: {
      performance: round(avg(runs.map(r=>r.categories.performance))),
      accessibility: round(avg(runs.map(r=>r.categories.accessibility))),
      bestPractices: round(avg(runs.map(r=>r.categories.bestPractices))),
      seo: round(avg(runs.map(r=>r.categories.seo))),
      pwa: round(avg(runs.map(r=>r.categories.pwa))),
    },
    webVitals: {
      fcp_ms: round(avg(runs.map(r=>r.webVitals.fcp_ms)), 0),
      lcp_ms: round(avg(runs.map(r=>r.webVitals.lcp_ms)), 0),
      tbt_ms: round(avg(runs.map(r=>r.webVitals.tbt_ms)), 0),
      cls: round(avg(runs.map(r=>r.webVitals.cls)), 3),
      tti_ms: round(avg(runs.map(r=>r.webVitals.tti_ms)), 0),
      speedIndex_ms: round(avg(runs.map(r=>r.webVitals.speedIndex_ms)), 0),
    }
  };
};

// ============ LOGIN (MANUAL OTP) ============
async function performLogin() {
  if (!DEVICE_TYPE) await promptDeviceType();
  console.log('Launching Chrome for manual OTP login...');
  await ensureDir(USER_DATA_DIR);

  // Always use a fresh user data dir for each run
  const tempUserDataDir = path.join('./.chrome-profile', `tmp-${Date.now()}`);
  const browser = await puppeteer.launch({
    headless: false, // show UI for OTP
    args: [
      `--user-data-dir=${tempUserDataDir}`,
      '--incognito',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-component-extensions-with-background-pages',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-device-discovery-notifications',
    ],
    defaultViewport: null
  });

  try {
  // Use the first page (incognito if --incognito flag is set)
  const pages = await browser.pages();
  const page = pages[0];
  console.log('DEBUG: Puppeteer page object constructor:', page.constructor.name);
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(60000);


    console.log(`Navigating to login page: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the page to be interactive
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 60000 });
    // Add a short delay to allow any JS rendering/animations
    await new Promise(res => setTimeout(res, 2000));

    // ---- Selectors you may need to tweak for Watcho's UI ----
    const phoneSelectors = [
      'input[name="mobile"]',
      'input[type="text"][placeholder*="mobile"]',
      'input[type="tel"]',
    ];

    let phoneField = null;
    for (const sel of phoneSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 10000 });
        const handle = await page.$(sel);
        if (handle) { phoneField = sel; break; }
      } catch (e) {
        // continue
      }
    }

    if (!phoneField) {
      // Save page content for debugging
      const html = await page.content();
      fs.writeFileSync('debug_login_page.html', html);
      throw new Error('Could not find the phone number input. Saved page as debug_login_page.html. Inspect the login page and update selectors.');
    }

    // Fill mobile number from .env
    const mobile = process.env.MOBILE_NUMBER;
    if (!mobile) throw new Error('MOBILE_NUMBER missing in .env');
    await page.click(phoneField, { clickCount: 3 });
    await page.type(phoneField, mobile.toString(), { delay: 50 });

    // Click a button that likely sends OTP
    const otpBtnSelectors = [
  'button',
  'button[type="submit"]'
    ];

    let clicked = false;
    // Try to find and click a button with text 'OTP', 'Send OTP', or 'Continue' using JS
    const buttonTexts = ['OTP', 'Send OTP', 'Continue'];
    for (const text of buttonTexts) {
      const btnHandle = await page.evaluateHandle((btnText) => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.find(b => b.textContent && b.textContent.trim().includes(btnText));
      }, text);
      if (btnHandle) {
        const asElem = btnHandle.asElement();
        if (asElem) {
          await asElem.click();
          clicked = true;
          break;
        }
      }
    }
    if (!clicked) {
      // Fallback: click the first visible button on the page (last resort)
      const buttons = await page.$$('button');
      if (buttons.length) {
        await buttons[0].click();
      } else {
        throw new Error('No button found to request OTP. Update the selector logic.');
      }
    }

    // Wait for OTP UI to appear (update selectors if needed)
    const otpSelectors = [
      'input[autocomplete="one-time-code"]',
      'input[name*="otp"]',
      'input[id*="otp"]',
      'input[type="tel"]' // sometimes reused
    ];
    await Promise.any(otpSelectors.map(sel => page.waitForSelector(sel, { timeout: 30000 })));

    console.log('\n==> Enter the OTP in the visible Chrome window.');
    console.log('   After submitting OTP and seeing you are logged in, come back here.');
    await pause('Press ENTER here to continue... ');

    // Optional: navigate home to confirm session
    await page.goto('https://www.watcho.com/', { waitUntil: 'networkidle2' });
    // You can also wait for a logged-in indicator (update selector as needed)
    // await page.waitForSelector('text=Logout', { timeout: 15000 }).catch(() => {});

    console.log('Assuming login successful. Saving session in user data dir.');
  } finally {
    await browser.close();
    rl.close();
  }
}

// ============ LIGHTHOUSE RUNNER ============
async function runLighthouseOnce(url, runIndex) {
  const urlSlug = slugify(url);
  const urlOutDir = path.join(OUT_DIR, urlSlug);
  await ensureDir(urlOutDir);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless=new',
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-sandbox',
      '--disable-gpu'
    ],
  });

  try {
  // Use global DEVICE_TYPE set at the start
  const deviceType = DEVICE_TYPE;
    let options = {
      port: chrome.port,
      logLevel: 'error',
      output: ['json', 'html'],
      onlyCategories: ['performance','accessibility','best-practices','seo','pwa'],
      throttlingMethod: 'simulate', // Force simulated throttling to match DevTools
    };
    if (deviceType === 'desktop') {
      options = {
        ...options,
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
      };
    } else {
      options = {
        ...options,
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 915,
          deviceScaleFactor: 2.625,
          disabled: false
        },
      };
    }

    const runnerResult = await lighthouse(url, options);

    const reports = Array.isArray(runnerResult.report)
      ? runnerResult.report
      : [runnerResult.report];

    const jsonReport = reports.find(r => r.trim().startsWith('{')) ?? reports[0];
    const htmlReport = reports.find(r => r.trim().startsWith('<')) ?? reports[1];

  // Add timestamp to filenames
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0,19); // e.g., 2025-08-26T14-30-00
  const base = path.join(urlOutDir, `run-${runIndex}-${timestamp}`);

    // Save new report
    await fsp.writeFile(`${base}.json`, jsonReport);
    await fsp.writeFile(`${base}.html`, htmlReport);

    // Delete all previous run-*.html and run-*.json files except the most recent
    const dirFiles = await fsp.readdir(urlOutDir);
    const keepFiles = [`${base}.json`, `${base}.html`];
    for (const file of dirFiles) {
      if ((file.startsWith('run-') && (file.endsWith('.html') || file.endsWith('.json'))) && !keepFiles.includes(path.join(urlOutDir, file))) {
        await fsp.unlink(path.join(urlOutDir, file));
      }
    }

    const metrics = metricFromLhr(runnerResult.lhr);
    return metrics;
  } finally {
    await chrome.kill();
  }
}

async function auditUrls(urls) {
  for (const url of urls) {
    console.log(`\nAuditing: ${url} (${RUNS} runs)`);
    const runs = [];
    for (let i = 1; i <= RUNS; i++) {
      const m = await runLighthouseOnce(url, i);
      runs.push(m);
      console.log(`  Run ${i}/${RUNS} -> Perf: ${m.categories.performance}, LCP: ${m.webVitals.lcp_ms}ms, CLS: ${m.webVitals.cls}`);
    }
    const summary = averageMetrics(runs);
    const urlSlug = slugify(url);
    const urlOutDir = path.join(OUT_DIR, urlSlug);
    await fsp.writeFile(path.join(urlOutDir, 'summary.json'), JSON.stringify({ url, ...summary }, null, 2));
    console.log(`  ▶ Averages -> Perf: ${summary.categories.performance}, LCP: ${summary.webVitals.lcp_ms}ms, CLS: ${summary.webVitals.cls}`);
  }
}

async function main() {
  await ensureDir(OUT_DIR);
  await ensureDir(USER_DATA_DIR);

  // 1) Manual OTP login with Puppeteer (stores cookies in USER_DATA_DIR)
  await performLogin();

  // 2) Run audits for public URLs
  await auditUrls(URLS);

  // 3) (Optional) Run audits for logged-in URLs
  if (LOGGED_IN_URLS.length) {
    console.log('\nAuditing logged-in URLs...');
    await auditUrls(LOGGED_IN_URLS);
  }

  console.log(`\nDone. Reports saved in: ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
