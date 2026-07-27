// Independent re-audit of the 18 reported issues, driven through a real browser
// against whatever the server is currently serving. Each check asks "does the
// REPORTED PROBLEM still exist?" and prints PRESENT (bad) or ABSENT (good),
// with the evidence it used — so the verdict never rests on assumptions.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5000';
const OUT = '/tmp/claude-1000/-home-runner-workspace/61923129-7d3a-43fa-8227-e1c6d2d88a9b/scratchpad/audit';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (id, title, issuePresent, evidence) => {
  results.push({ id, title, issuePresent, evidence });
  const tag = issuePresent ? 'ISSUE PRESENT' : 'issue absent ';
  console.log(`${String(id).padStart(2)}. [${tag}] ${title}\n      ${evidence}`);
};

const relLum = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const L1 = relLum(a), L2 = relLum(b);
  return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2);
};

const browser = await chromium.launch({
  executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
const netErrors = [];
page.on('response', (r) => { if (r.status() >= 400) netErrors.push(`${r.status()} ${r.url()}`); });
const jsErrors = [];
page.on('pageerror', (e) => jsErrors.push(String(e)));

/* ---------------- 1 & 2: Pre-Packed Barrel ---------------- */
await page.goto(`${BASE}/prepacked-barrel`, { waitUntil: 'networkidle' });
await sleep(2200);
const barrelText = await page.locator('body').innerText();

const groupsSeen = ['Food', 'Household Items', 'Personal Care']
  .filter((g) => new RegExp(`^\\s*${g.replace('.', '\\.')}\\b`, 'im').test(barrelText));
// Count rendered content rows to be sure grouping didn't drop any item.
const itemRows = await page.locator("section:has(h3) ul li, div:has(> h2:text-is(\"What's in the barrel?\")) ul li").count();
const apiItems = await page.evaluate(async () => {
  const r = await fetch('/website/prepacked-barrel');
  const j = await r.json();
  const b = (j.body || [])[0] || {};
  const cats = {};
  (b.contents || []).forEach((c) => { cats[c.category || '(none)'] = (cats[c.category || '(none)'] || 0) + 1; });
  return { total: (b.contents || []).length, cats };
});
check(1, 'Pre-Packed Barrel items NOT grouped into Food / Household / Personal Care',
  groupsSeen.length < 3,
  `headings rendered: [${groupsSeen.join(', ') || 'none'}] | list rows on page: ${itemRows} | API categories: ${JSON.stringify(apiItems.cats)} (total ${apiItems.total})`);

const restrictedCopy = /Portmore|Kingston,\s*St\.?\s*Andrew/i.test(barrelText);
const islandwide = /islandwide/i.test(barrelText);
const deliveryLine = (barrelText.match(/.*Door-to-Door Delivery.*/i) || ['(line not found)'])[0].trim();
check(2, 'Pre-Packed Barrel delivery still limited to Kingston / St. Andrew / Portmore',
  restrictedCopy || !islandwide,
  `delivery line: "${deliveryLine}" | restricted-parish wording present: ${restrictedCopy}`);
await page.screenshot({ path: `${OUT}/01-02-prepacked.png`, fullPage: true });

/* ---------------- 3: Header (logged out) ---------------- */
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await sleep(2500);
const nav = page.locator('nav[aria-label="Main"]');
const navBox = await nav.boundingBox();
const navH = navBox ? +navBox.height.toFixed(1) : 0;
const headerItems = await nav.evaluate((el) => {
  const out = [];
  el.querySelectorAll('button, a').forEach((b) => {
    const r = b.getBoundingClientRect();
    if (!r.width || !r.height) return;
    out.push({ t: (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ') || '(logo)', x: Math.round(r.x), fs: getComputedStyle(b).fontSize });
  });
  return out.sort((a, b) => a.x - b.x);
});
const logoX = await nav.locator('img').first().evaluate((n) => Math.round(n.getBoundingClientRect().x));
const order = headerItems.map((i) => i.t);
const menuFs = headerItems.filter((i) => /About|How it works|Pre-Packed|Contact/i.test(i.t)).map((i) => i.fs);
const expectOrder = ['About', 'How it works', 'Pre-Packed Barrels', 'Contact'];
const menuOnly = order.filter((t) => expectOrder.includes(t));
const orderOk = JSON.stringify(menuOnly) === JSON.stringify(expectOrder);
const logoIsFirst = logoX < (headerItems.find((i) => i.t === 'About')?.x ?? 1e9);
const getQuotesRight = (() => {
  const gq = headerItems.find((i) => /^Get Quotes$/i.test(i.t));
  const contact = headerItems.find((i) => /^Contact$/i.test(i.t));
  return gq && contact && gq.x > contact.x;
})();
check(3, 'Header too tall / logo not left / menu too big / wrong order / no Get Quotes on right',
  !(navH <= 80 && logoIsFirst && orderOk && getQuotesRight && menuFs.every((f) => parseFloat(f) <= 16)),
  `nav height=${navH}px | logo x=${logoX} (leftmost: ${logoIsFirst}) | menu font=${[...new Set(menuFs)].join(',')} | order=${JSON.stringify(order)} | Get Quotes right of Contact: ${getQuotesRight}`);
await page.screenshot({ path: `${OUT}/03-header.png`, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(navH + 6) } });

/* ---------------- 4: duplicate tagline ---------------- */
const dupVisible = await page.evaluate(() => {
  const hits = [];
  document.querySelectorAll('h1,h2,h3,p,span,div').forEach((el) => {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
    if (!/Barrel shipping to Jamaica/i.test(own)) return;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const visible = r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && s.clip !== 'rect(0px, 0px, 0px, 0px)';
    hits.push({ text: own.trim().slice(0, 60), visible, w: Math.round(r.width), h: Math.round(r.height) });
  });
  return hits;
});
check(4, 'Duplicate "Barrel shipping to Jamaica, simplified" still shown near the barrels',
  dupVisible.some((h) => h.visible),
  dupVisible.length ? dupVisible.map((h) => `"${h.text}" visible=${h.visible} (${h.w}x${h.h})`).join(' ; ') : 'phrase not present in DOM at all');

/* ---------------- 5: hero CTA vs form CTA ---------------- */
const ctaButtons = await page.evaluate(() => [...document.querySelectorAll('button')]
  .map((b) => ({ t: b.innerText.trim(), y: Math.round(b.getBoundingClientRect().y + scrollY) }))
  .filter((b) => /get quotes|ship my own barrel|order vership pre-packed/i.test(b.t))
  .sort((a, b) => a.y - b.y));
const heroPair = ctaButtons.filter((b) => b.y > 300 && b.y < 700).map((b) => b.t);
const formSubmit = await page.locator('#booking-form button:has-text("Get quotes")').count();
check(5, 'Hero still says "Get Quotes" beside the pre-packed CTA / no Get Quotes on the details form',
  heroPair.some((t) => /^get quotes$/i.test(t)) || formSubmit === 0,
  `hero CTA pair: ${JSON.stringify(heroPair)} | "Get quotes" buttons inside #booking-form: ${formSubmit}`);

/* ---------------- 6: destination parishes ---------------- */
await page.locator('[aria-label="Select destination"]').scrollIntoViewIfNeeded();
await page.locator('[aria-label="Select destination"]').click();
await sleep(800);
const destOpts = await page.locator('ul[aria-label="Destination"] li').allInnerTexts();
const destLabel = (await page.locator('[aria-label="Select destination"]').innerText()).replace(/\s+/g, ' ').trim();
check(6, 'Destination still "Kingston, Jamaica" instead of Jamaica + 14 parishes',
  destOpts.length !== 14 || /kingston,\s*jamaica/i.test(destOpts.join('|')),
  `control reads "${destLabel}" | ${destOpts.length} options: ${JSON.stringify(destOpts)}`);
await page.screenshot({ path: `${OUT}/06-destination.png`, clip: await (async () => { const b = await page.locator('[aria-label="Select destination"]').boundingBox(); return { x: b.x - 20, y: b.y - 50, width: b.width + 40, height: 400 }; })() });
await page.keyboard.press('Escape');

/* ---------------- 13: barrel quantity label ---------------- */
const oldQty = await page.locator('[aria-label="Barrel quantity"]').count();
const newQty = page.locator('[aria-label="Number of barrels"]');
const newQtyN = await newQty.count();
check(13, '"Barrel quantity" label not renamed to "Number of barrels"',
  oldQty > 0 || newQtyN === 0,
  `aria-label "Barrel quantity": ${oldQty} | "Number of barrels": ${newQtyN} | placeholder: "${newQtyN ? await newQty.getAttribute('placeholder') : 'n/a'}"`);

/* ---------------- 14: origin auto-map + Miami coming soon ---------------- */
await page.locator('[aria-label="Select origin"]').click();
await sleep(800);
const originRows = await page.evaluate(() => [...document.querySelectorAll('ul[aria-label=Origin] li')]
  .map((li) => ({ t: li.innerText.trim().replace(/\s+/g, ' '), disabled: !!li.querySelector('button')?.disabled })));
const dbOrigins = await page.evaluate(async () => {
  const r = await fetch('/website/providerlist');
  const j = await r.json();
  const set = new Set();
  (j.body || j.data || []).forEach((p) => ((p.businessInfo || {}).barrelPrices || []).forEach((bp) => {
    if (bp.type === 'own' && bp.originCountry) set.add(bp.originCountry.replace(/,\s*(\w{2})$/, (m, s) => ', ' + s.toUpperCase()));
  }));
  return [...set].sort();
});
const shown = originRows.map((r) => r.t.replace(/\s*COMING SOON$/i, '').trim());
const missingFromUi = dbOrigins.filter((c) => !shown.includes(c));
const miami = originRows.find((r) => /^Miami/i.test(r.t));
check(14, 'Forwarder cities not auto-mapped into ship-from list / Miami not marked coming soon',
  missingFromUi.length > 0 || !miami || !/coming soon/i.test(miami.t) || !miami.disabled,
  `UI origins: ${JSON.stringify(originRows.map((r) => r.t + (r.disabled ? ' [disabled]' : '')))} | eligible forwarder cities from API: ${JSON.stringify(dbOrigins)} | missing from UI: ${JSON.stringify(missingFromUi)}`);
await page.screenshot({ path: `${OUT}/14-origins.png`, clip: await (async () => { const b = await page.locator('[aria-label="Select origin"]').boundingBox(); return { x: b.x - 20, y: b.y - 50, width: b.width + 40, height: 340 }; })() });
await page.keyboard.press('Escape');

/* ---------------- 17: missing "to" ---------------- */
const homeText = await page.locator('body').innerText();
check(17, 'Copy still reads "allows you compare rates" (missing "to")',
  /allows you compare rates/i.test(homeText),
  (homeText.match(/VerShip allows you.{0,40}/i) || ['(sentence not found on home page)'])[0]);

/* ---------------- 10: footer socials ---------------- */
const socials = await page.evaluate(() => [...document.querySelectorAll('footer a')]
  .filter((a) => /facebook|instagram|tiktok/i.test(a.getAttribute('aria-label') || ''))
  .map((a) => ({ label: a.getAttribute('aria-label'), href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
const want = {
  Instagram: 'https://www.instagram.com/vershipgo/',
  Facebook: 'https://www.facebook.com/profile.php?id=61590888983095',
  TikTok: 'https://www.tiktok.com/@vershipgo',
};
const badSocial = Object.entries(want).filter(([k, url]) => {
  const a = socials.find((s) => new RegExp(k, 'i').test(s.label || ''));
  return !a || a.href !== url;
});
check(10, 'Footer social icons not linked to the correct profiles',
  badSocial.length > 0,
  socials.map((s) => `${s.label?.replace('VerShip on ', '')} -> ${s.href} (target=${s.target})`).join(' | ') || 'no social links found');

/* ---------------- 8: survey Other ---------------- */
await page.goto(`${BASE}/type`, { waitUntil: 'networkidle' });
await sleep(1800);
await page.getByText('Personal', { exact: true }).first().click();
await sleep(300);
await page.getByRole('button', { name: /continue/i }).first().click();
await sleep(1400);
const surveyOpts = await page.locator('label:has(input[name=survey])').allInnerTexts();
const otherOpt = page.locator('label:has(input[name=survey][value="4"])');
const hasOther = await otherOpt.count();
let boxBefore = await page.locator('#survey-other, textarea').count();
if (hasOther) { await otherOpt.click(); await sleep(600); }
const boxAfter = await page.locator('#survey-other, textarea').count();
check(8, 'Registration survey has no "Other" option with a free-text box',
  !hasOther || boxAfter === 0,
  `options: ${JSON.stringify(surveyOpts)} | textarea before ticking Other: ${boxBefore}, after: ${boxAfter}`);
if (hasOther && boxAfter) await page.screenshot({ path: `${OUT}/08-survey.png`, clip: await (async () => { const b = await page.locator('h2:has-text("Quick Survey")').locator('xpath=ancestor::div[2]').boundingBox(); return b; })() });

/* ---------------- 15 & 18: About page ---------------- */
await page.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
await sleep(2600);
const aboutH = await page.evaluate(() => document.documentElement.scrollHeight);
const proseW = await page.evaluate(() => {
  const el = document.querySelector('.cms-content');
  return el ? Math.round(el.getBoundingClientRect().width) : -1;
});
// Sample the real rendered pixels: text colour vs the gradient behind it.
const tag = page.locator('.cms-content [style*="color"]').first();
const tagCount = await tag.count();
let contrastInfo = 'no inline-coloured CMS text found';
let contrastBad = false;
if (tagCount) {
  await tag.scrollIntoViewIfNeeded();
  await sleep(600);
  const color = await tag.evaluate((n) => getComputedStyle(n).color);
  const bg = await page.evaluate(() => {
    // Walk up for the painted background of the About section.
    let n = document.querySelector('.cms-content');
    while (n) { const s = getComputedStyle(n); if (s.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)/.test(s.backgroundColor)) return s.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'gradient#2C4736' : s.backgroundColor; n = n.parentElement; }
    return 'unknown';
  });
  const fg = color.match(/\d+/g).slice(0, 3).map(Number);
  // Gradient top colour #2C4736 is the lightest point => the most optimistic bg.
  const ratio = contrast(fg, [0x2c, 0x47, 0x36]);
  contrastBad = ratio < 4.5;
  contrastInfo = `first CMS-coloured text = ${color} on ${bg} -> contrast ${ratio}:1 (AA needs 4.5) | text: "${(await tag.innerText()).slice(0, 55)}"`;
}
check(15, 'About page green text unreadable on the dark green background', contrastBad, contrastInfo);
check(18, 'About page too wide / too much scrolling',
  aboutH > 3500 || proseW > 900,
  `page height=${aboutH}px | prose column width=${proseW}px`);
await page.screenshot({ path: `${OUT}/15-18-about.png`, fullPage: true });

/* ---------------- 16: contact layout ---------------- */
await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
await sleep(2200);
const contactText = await page.locator('body').innerText();
const panels = ['Contact Information', 'Opening Hours', 'Response Time'].filter((s) => new RegExp(s, 'i').test(contactText));
const inputW = await page.evaluate(() => { const i = document.querySelector('#contact-first_name'); return i ? Math.round(i.getBoundingClientRect().width) : -1; });
const twoCol = await page.evaluate(() => {
  const a = document.querySelector('aside'), f = document.querySelector('form');
  if (!a || !f) return false;
  const ar = a.getBoundingClientRect(), fr = f.getBoundingClientRect();
  return Math.abs(ar.y - fr.y) < 120 && fr.x > ar.x; // side by side
});
check(16, 'Contact form too wide / not a two-column layout with info, hours and response time',
  panels.length < 3 || !twoCol || inputW > 800,
  `panels found: [${panels.join(', ')}] | side-by-side on desktop: ${twoCol} | first-name input width=${inputW}px`);
await page.screenshot({ path: `${OUT}/16-contact.png`, fullPage: true });

console.log(`\nnetwork 4xx/5xx during audit: ${netErrors.length}${netErrors.length ? '\n  ' + netErrors.slice(0, 6).join('\n  ') : ''}`);
console.log(`JS page errors during audit : ${jsErrors.length}${jsErrors.length ? '\n  ' + jsErrors.slice(0, 4).join('\n  ') : ''}`);
const still = results.filter((r) => r.issuePresent);
console.log(`\n=== ${results.length} checks | ${still.length} issue(s) still present ===`);
still.forEach((r) => console.log(`  #${r.id} ${r.title}`));
await browser.close();
