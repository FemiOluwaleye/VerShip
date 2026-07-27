// Happy path for the survey "Other" option: tick Other, type an answer, register,
// then confirm the free text landed in users."surveyOther".
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/shots';
const ANSWER = 'Tracking updates I can share with my family in Jamaica';
const email = process.env.EMAIL || `survey-other-${process.env.STAMP || 'x'}@vership.test`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 980 } })).newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });

await page.goto(`${BASE}/type`, { waitUntil: 'networkidle' });
await sleep(1600);
await page.getByText('Personal', { exact: true }).first().click();
await sleep(300);
await page.getByRole('button', { name: /continue/i }).first().click();
await sleep(1200);

const opts = await page.locator('label:has(input[name=survey])').allInnerTexts();
console.log(`1. survey options (${opts.length}): ${JSON.stringify(opts)}`);
console.log(`2. textarea before ticking Other: ${await page.locator('#survey-other').count()}`);

// Guard: submitting "Other" with no text must be refused.
await page.locator('label:has(input[name=survey][value="4"])').click();
await sleep(500);
console.log(`3. textarea after ticking Other : ${await page.locator('#survey-other').count()}`);

const card = page.locator('h2:has-text("Quick Survey")').locator('xpath=ancestor::div[2]');
await page.screenshot({ path: `${OUT}/08-survey-AFTER.png`, clip: await card.boundingBox() });
console.log(`   saved -> ${OUT}/08-survey-AFTER.png`);

await page.getByRole('button', { name: /start registration/i }).click();
await sleep(1200);
const blocked = await page.locator('h2:has-text("Quick Survey")').count();
console.log(`4. empty "Other" blocked submission: ${blocked === 1}`);

await page.locator('#survey-other').fill(ANSWER);
await sleep(300);
await page.getByRole('button', { name: /start registration/i }).click();
await sleep(2500);
console.log(`5. moved to: ${new URL(page.url()).pathname}`);

// Fill the signup form.
const fill = async (sel, val) => {
  const l = page.locator(sel).first();
  if (await l.count()) { await l.fill(val); return true; }
  return false;
};
await fill('input[name="name"]', 'Survey');
await fill('input[name="lastName"]', 'Tester');
await fill('input[name="email"]', email);
await fill('input[type="tel"]', '8145551234');
await fill('input[name="city"]', 'Pittsburgh');
await fill('input[name="state"]', 'PA');
// The street-address box is the Google Places autocomplete input: it carries
// neither a `type` nor a `name` attribute, so no attribute selector reaches it.
// It sits 5th in the form's input order, right after the phone field.
const street = page.locator('form input, input').nth(4);
await street.fill('15 Molynes Road');
const pw = page.locator('input[type="password"]');
const npw = await pw.count();
for (let i = 0; i < npw; i++) await pw.nth(i).fill('Test@1234');
const terms = page.locator('input[name="agreeTerms"]');
if (await terms.count()) await terms.check({ force: true });
console.log(`6. filled form (password fields: ${npw}) as ${email}`);

let posted = null;
page.on('request', (r) => {
  if (/register/i.test(r.url()) && r.method() === 'POST') posted = r.postData() || '';
});
page.on('console', (m) => { if (m.type() === 'error') console.log(`   console.error: ${m.text().slice(0, 200)}`); });
await page.getByRole('button', { name: 'Sign Up', exact: true }).first().click();
await sleep(900);
// Toasts auto-dismiss, so read them right after the click.
const toasts = await page.locator('[data-sonner-toast], li[role="status"], .toaster li').allInnerTexts().catch(() => []);
if (toasts.length) console.log(`   toast(s): ${JSON.stringify(toasts)}`);
await sleep(6000);
console.log(`7. POST carried surveyOther: ${posted ? posted.includes('surveyOther') : 'no register POST seen'}`);
if (posted) {
  const m = posted.match(/name="surveyOther"\r?\n\r?\n([^\r\n]*)/);
  console.log(`   surveyOther value sent = ${JSON.stringify(m ? m[1] : null)}`);
  const s = posted.match(/name="survey"\r?\n\r?\n([^\r\n]*)/);
  console.log(`   survey value sent      = ${JSON.stringify(s ? s[1] : null)}`);
}
console.log(`8. landed on: ${new URL(page.url()).pathname}`);
if (!posted) {
  // Nothing was submitted — surface whatever the form is complaining about.
  const txt = (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
  console.log(`   DEBUG page text: ${txt.slice(0, 500)}`);
  await page.screenshot({ path: `${OUT}/08-signup-debug.png`, fullPage: false });
}
console.log(`failedReqs: ${bad.length}${bad.length ? '\n  ' + bad.slice(0, 5).join('\n  ') : ''}`);
await browser.close();
