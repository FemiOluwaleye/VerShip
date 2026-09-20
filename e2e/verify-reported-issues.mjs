// Real-browser verification of three reported issues:
//   #1 no customer email when an order is placed
//   #2 no customer email when admin changes an order's status
//   #3 hiding a barrel makes it "inaccessible"
// Run:  node e2e/verify-reported-issues.mjs   (server must be on :5000)
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5000';
const SERVER_LOG = '/tmp/claude-1000/-home-runner-workspace/8a73ed85-1ac9-4a05-a637-eba83a7df1e6/scratchpad/server.log';
const ADMIN = { email: 'e2e-admin@vership.test', password: 'Test@1234' };

const logLen = () => (fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8').length : 0);
const logSince = (off) => fs.readFileSync(SERVER_LOG, 'utf8').slice(off);
const out = [];
const say = (m) => { console.log(m); out.push(m); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function adminLogin(page) {
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
  await page.fill('input[placeholder="Email address"]', ADMIN.email);
  await page.fill('input[placeholder="Password"]', ADMIN.password);
  await page.click('button#login');
  await page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {});
  await sleep(1000);
  say(`  admin landed on: ${new URL(page.url()).pathname}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  try {
    // ============ #3: BARREL HIDE / RECOVER ============
    say('\n=== ISSUE #3: barrel hide / recover ===');

    // 3a. public page shows the barrel initially
    await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: 'networkidle' });
    await sleep(1200);
    let bodyText = await page.locator('body').innerText();
    const visibleBefore = /Send a Pre-Packed Food Barrel|Send Love|Order this barrel|Choose your barrel|Select/i.test(bodyText)
      && !/No pre-packed barrel is available/i.test(bodyText);
    say(`  [3a] public barrel page visible BEFORE hide: ${visibleBefore}`);

    // 3b. log in + open admin product list
    await adminLogin(page);
    await page.goto(`${BASE}/admin/prepacked/list`, { waitUntil: 'networkidle' });
    await sleep(1500);
    let adminText = await page.locator('body').innerText();
    const inAdminBefore = /Active/i.test(adminText) && /barrel|VerShip|Pre-Packed|Packed with love/i.test(adminText);
    say(`  [3b] barrel in admin list BEFORE hide (Active badge): ${inAdminBefore}`);

    // 3c. edit -> set status Hidden -> save
    await page.goto(`${BASE}/admin/prepacked/edit/1`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.selectOption('select[name="status"]', '0');
    await page.click('button[type="submit"]');
    await sleep(2000);
    say('  [3c] set Status = Hidden and saved');

    // 3d. public page after hide
    await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: 'networkidle' });
    await sleep(1500);
    bodyText = await page.locator('body').innerText();
    const goneAfter = /No pre-packed barrel is available/i.test(bodyText)
      || !/Send Love|Order this barrel|Choose your barrel/i.test(bodyText);
    say(`  [3d] public barrel page GONE after hide: ${goneAfter}  ${goneAfter ? '(reproduces "cannot access barrel")' : ''}`);

    // 3e. admin list still shows it (Hidden badge) -> not locked out of admin
    await page.goto(`${BASE}/admin/prepacked/list`, { waitUntil: 'networkidle' });
    await sleep(1500);
    adminText = await page.locator('body').innerText();
    const stillInAdmin = /Hidden/i.test(adminText) && /barrel|VerShip|Pre-Packed|Packed with love/i.test(adminText);
    say(`  [3e] barrel STILL in admin list after hide (Hidden badge): ${stillInAdmin}  ${stillInAdmin ? '(admin can recover it)' : '(LOCKED OUT!)'}`);

    // 3f. recover: edit -> Active -> save -> public visible again
    await page.goto(`${BASE}/admin/prepacked/edit/1`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.selectOption('select[name="status"]', '1');
    await page.click('button[type="submit"]');
    await sleep(2000);
    await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: 'networkidle' });
    await sleep(1500);
    bodyText = await page.locator('body').innerText();
    const recovered = /Send Love|Order this barrel|Choose your barrel|Send a Pre-Packed/i.test(bodyText)
      && !/No pre-packed barrel is available/i.test(bodyText);
    say(`  [3f] recovered to Active -> public visible again: ${recovered}`);

    // ============ #1: ORDER-PLACED EMAIL ============
    say('\n=== ISSUE #1: customer email on order placement ===');
    const off1 = logLen();
    await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: 'networkidle' });
    await sleep(1500);
    // If a grid is shown (multiple), pick the first barrel.
    const selectBtn = page.locator('button:has-text("Select")').first();
    if (await selectBtn.count()) { await selectBtn.click().catch(() => {}); await sleep(800); }
    // Use a @vership.test address — Resend's sandbox rejects example.com.
    const buyerEmail = `buyer_${off1}@vership.test`;
    await page.fill('input[name="firstName"]', 'Test');
    await page.fill('input[name="email"]', buyerEmail);
    await page.fill('input[name="recipient_name"]', 'Auntie J');
    await page.fill('input[name="recipient_phone"]', '18765550100');
    await page.fill('input[name="delivery_street"]', '12 Hope Rd');
    await page.fill('input[name="delivery_town"]', 'Kingston');
    await page.selectOption('select[name="delivery_parish"]', { index: 1 });
    await page.click('button:has-text("Place order")');
    await sleep(3500);
    const afterOrderText = await page.locator('body').innerText();
    const orderPlaced = /Thank you|complete payment|order is in|Almost there|Order number/i.test(afterOrderText);
    const orderIdMatch = afterOrderText.match(/ORD-PP-\d+-\d+/);
    const placedOrderId = orderIdMatch ? orderIdMatch[0] : null;
    const mail1 = logSince(off1);
    const sent1 = (mail1.match(/email sent to customer/gi) || []).length;
    const orderPost = /prepacked-order/i.test(mail1);
    say(`  [1a] order placed in browser (confirmation/payment screen): ${orderPlaced}  (orderId=${placedOrderId})`);
    say(`  [1b] server saw the order request: ${orderPost}`);
    say(`  [1c] customer confirmation emails sent by placing order: ${sent1}  ${sent1 > 0 ? '✅ FIXED (email now sent)' : '❌ still no email'}`);
    say('    mail lines:\n' + (mail1.match(/(📧 Email sent.*|.*email sent to customer.*|.*confirmation email.*failed.*)/gi) || []).map((l) => '      ' + l).join('\n'));

    // ============ #2: STATUS-CHANGE EMAIL (admin) ============
    say('\n=== ISSUE #2: customer email on admin status change ===');
    await page.goto(`${BASE}/admin/prepackedorders`, { waitUntil: 'networkidle' });
    await sleep(1800);
    // Filter to the exact order we just placed (its buyer has a sendable
    // @vership.test email) so the status email targets a valid recipient.
    if (placedOrderId) {
      await page.fill('input[placeholder="Search order ID, name or email..."]', placedOrderId).catch(() => {});
      await sleep(1500);
    }
    const off2 = logLen();
    // Open the first (filtered) order's manage panel, change status, save.
    const rowBtn = page.locator('table tbody tr').first().locator('button, a').first();
    if (await rowBtn.count()) { await rowBtn.click().catch(() => {}); await sleep(1200); }
    let changedStatus = false;
    const selects = page.locator('select');
    const nSel = await selects.count();
    for (let i = 0; i < nSel; i++) {
      const s = selects.nth(i);
      const opts = await s.locator('option').allTextContents();
      if (opts.join(' ').match(/Delivered|Shipped|Processing|Placed|Cancel/i)) {
        // Placed(0) is the new order's current status; pick Shipped(2) to force a change.
        await s.selectOption({ index: Math.min(2, opts.length - 1) }).catch(() => {});
        changedStatus = true;
        break;
      }
    }
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Update")').first();
    if (await saveBtn.count()) { await saveBtn.click().catch(() => {}); await sleep(3000); }
    const mail2 = logSince(off2);
    const sent2 = (mail2.match(/status update email sent to customer/gi) || []).length;
    const statusPost = /prepacked-orders\/update/i.test(mail2);
    say(`  [2a] status control found & changed: ${changedStatus}`);
    say(`  [2b] server saw the status-update request: ${statusPost}`);
    say(`  [2c] customer status-change emails sent: ${sent2}  ${sent2 > 0 ? '✅ FIXED (email now sent)' : '❌ still no email'}`);
    say('    mail lines:\n' + (mail2.match(/(📧 Email sent.*|.*status update email sent.*|.*status-update email.*failed.*)/gi) || []).map((l) => '      ' + l).join('\n'));

    say('\n=== DONE ===');
  } catch (e) {
    say('SCRIPT ERROR: ' + e.message + '\n' + e.stack);
  } finally {
    await browser.close();
    fs.writeFileSync('/tmp/claude-1000/-home-runner-workspace/8a73ed85-1ac9-4a05-a637-eba83a7df1e6/scratchpad/verify-out.txt', out.join('\n'));
  }
})();
