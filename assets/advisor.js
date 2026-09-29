/* ============================================================================
   ATS — Appraisal tool (internal)
   INTERNAL TOOL — not for customers, not for publication.
   Single-file logic. Nothing to build, no dependencies, no backend, no network
   calls beyond loading its own dataset.

   EDIT POINTS — everything you will realistically want to change lives in
   two places only:
     1. CONFIG  — valuation assumptions only. No fees, no commission.
     2. MODELS  — the vehicle / known-fault / price-band database.
   ========================================================================== */

const CONFIG = {
  currency: 'AED',

  /* -- INTERNAL TOOL. No fees, no commission, no percentage anywhere in this
        file. Sell-Ready pricing is unset and the broking line is not live —
        ats-ops/data/car-sales-desk.md gate 1. Nothing here quotes a price. -- */

  /* -- Valuation assumptions. Indicative only: the house rule is that no
        number leaves the workshop before the car has been on the lift. ---- */
  val: {
    kmPerYearBaseline: 20000,   // UAE average; deviation moves the number
    kmPenaltyPer10k:   0.018,   // 1.8% off per 10,000 km above baseline
    kmBonusPer10k:     0.012,   // 1.2% on per 10,000 km below baseline
    accidentMajor:     0.18,    // chassis / structural repair
    accidentMinor:     0.06,    // panel work only
    noServiceHistory:  0.09,
    nonGccImport:      0.16,    // US / Japan / Canada import discount here
    spreadPct:         0.07,    // ± band on the estimate
    yearCurve:         1.5,     // >1 pushes mid-age cars nearer the band floor
    conditionFactor: { excellent: 1.05, good: 1.0, fair: 0.9, rough: 0.78 },

    // Seller routes, mirroring the Jetour T2 precedent in
    // ats-ops/data/sell-ready-test-jetour-t2.md
    tradeLo:      0.80,   // Fast Sell floor — SUBJECT TO DEALER QUOTE (T-052)
    tradeHi:      0.88,
    askUplift:    1.12,   // Proper Listing start, above expected sale price
    dropPct:      0.03,   // scheduled drop, agreed BEFORE listing
    dropDays:     10,
  },
};

/* ============================================================================
   MODELS — UAE used-market reference data, loaded from data/models.json.

   That file is the single source of truth: this page and anything built on
   top of it later (a wrapped mobile app, a print sheet) read the same JSON.
   Field meanings are documented in docs/advisor.md — in short:

     price  [low, high] AED across the year range. INDICATIVE, needs calibrating.
     rel    1-5 durability AS EXPERIENCED IN UAE HEAT, not a global score.
     faults documented, commonly-seen failures. Keep this honest.
     check  what ATS puts on the lift / scanner for this platform.
     recon  realistic first-12-months spend [low, high] on a clean example.
     tags   drives the buyer filter, and the selected use is a hard filter.
   ========================================================================== */
let MODELS = [];

async function loadModels() {
  // Relative to the page, so it works under any deploy path.
  const res = await fetch("data/models.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error("empty dataset");
  MODELS = data;
}


/* ========================== helpers ==================================== */
const AED = (n) => CONFIG.currency + ' ' + Math.round(n).toLocaleString('en-US');
// Ranges carry the currency once — repeating it wraps the sidebar values.
const AEDR = (lo, hi) => CONFIG.currency + ' ' + Math.round(lo).toLocaleString('en-US')
  + ' \u2013 ' + Math.round(hi).toLocaleString('en-US');
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yearsOf = (m) => { const p = m.yrs.split(/[–-]/); return [parseInt(p[0], 10), parseInt(p[1], 10)]; };

/* Range inputs get no visible fill for free — paint the filled portion as a
   CSS variable so the track reads as a position, not just a floating thumb. */
const paintRange = (el) => {
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const pct = max === min ? 0 : ((Number(el.value) - min) / (max - min)) * 100;
  el.style.setProperty('--fill', pct.toFixed(2) + '%');
};
function initRangeFill() {
  $$('input[type=range]').forEach((el) => {
    paintRange(el);
    el.addEventListener('input', () => paintRange(el));
  });
}

/* ========================== BUYER ADVISOR ============================== */
const buyerState = { budget: 90000, body: 'any', use: 'family', horizon: 'long', tolerance: 'low' };

function scoreModel(m, s) {
  // must be reachable inside budget: the low end of the band has to fit
  if (m.price[0] > s.budget * 1.02) return null;
  if (s.body !== 'any' && m.body !== s.body) return null;

  let score = m.rel * 10;

  // use-case match
  if (m.tags.includes(s.use)) score += 14;

  // budget positioning — reward cars whose mid-band sits inside the budget
  const mid = (m.price[0] + m.price[1]) / 2;
  if (s.budget >= mid) score += 10;
  else if (s.budget >= m.price[0] * 1.25) score += 5;

  // long ownership punishes fragile platforms harder
  if (s.horizon === 'long') score += (m.rel - 3) * 7;

  // maintenance tolerance
  if (s.tolerance === 'low') {
    score -= (5 - m.rel) * 8;
    if (m.parts === 'premium') score -= 8;
  } else if (s.tolerance === 'high') {
    score += m.parts === 'premium' ? 5 : 0;
  }

  // class fit: a big budget spent on a small car is the wrong recommendation,
  // even when that car is the more reliable one
  score += Math.min(12, (mid / Math.max(s.budget, 1)) * 12);

  // recon exposure relative to budget
  const reconMid = (m.recon[0] + m.recon[1]) / 2;
  score -= Math.min(18, (reconMid / Math.max(s.budget, 1)) * 100);

  return score;
}

function verdictBadge(m, s) {
  const longHold = s.horizon === 'long';
  if (m.rel >= 4) return ['good', 'Low risk'];
  if (m.rel === 3) return ['ok', longHold ? 'Budget for upkeep' : 'Manageable'];
  return ['risk', 'Condition-critical'];
}

function renderBuyer() {
  const rank = (pool) => pool
    .map((m) => ({ m, s: scoreModel(m, buyerState) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s - a.s);

  // The use case is a hard filter first: recommending a saloon for dune work
  // is worse than recommending nothing. Only if that leaves too thin a list do
  // we relax it and rank the whole set on score alone.
  let scored = rank(MODELS.filter((m) => m.tags.includes(buyerState.use)));
  if (scored.length < 3) {
    const seen = new Set(scored.map((x) => x.m.name));
    scored = scored.concat(rank(MODELS).filter((x) => !seen.has(x.m.name)));
  }
  scored = scored.slice(0, 5);

  const out = $('#buy-results');
  if (!scored.length) {
    out.innerHTML = '<div class="empty">Nothing in the reference set fits that combination. Widen the budget or clear the body-type filter — or send us the brief and we will source outside the list.</div>';
    return;
  }

  out.innerHTML = scored.map(({ m }) => {
    const [cls, label] = verdictBadge(m, buyerState);
    const ceiling = Math.min(buyerState.budget, m.price[1]);
    return `
    <article class="res">
      <div>
        <div class="res-head">
          <h3>${esc(m.name)}</h3>
          <span class="yrs">${esc(m.yrs)}</span>
          <span class="score ${cls}">${label}</span>
        </div>
        <p class="spec">${esc(m.eng)} &nbsp;·&nbsp; ${esc(m.gbx)}</p>
        <p class="verdict">${esc(m.verdict)}</p>
        <div class="blk">
          <span class="k">Known faults on this platform</span>
          <ul>${m.faults.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
        <div class="blk check">
          <span class="k">What ATS checks before you pay</span>
          <ul>${m.check.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>
      <aside class="res-side">
        <div class="kv"><span class="k">Market band</span><span class="v">${AEDR(m.price[0], m.price[1])}</span></div>
        <div class="kv"><span class="k">Your ceiling</span><span class="v">${AED(ceiling)}</span></div>
        <div class="kv"><span class="k">First-year recon</span><span class="v">${AEDR(m.recon[0], m.recon[1])}</span></div>
        <div class="kv"><span class="k">Parts cost</span><span class="v">${m.parts === 'cheap' ? 'Low' : m.parts === 'mid' ? 'Moderate' : 'High'}</span></div>
        <div class="kv"><span class="k">Heat durability</span><span class="v">${m.rel}/5</span></div>
      </aside>
    </article>`;
  }).join('');
}

/* ========================== SELLER VALUATION =========================== */
function estimateValue() {
  const m = MODELS[parseInt($('#sv-model').value, 10)];
  const year = parseInt($('#sv-year').value, 10);
  const km = parseInt($('#sv-km').value, 10);
  const cond = $('#sv-cond').value;
  const v = CONFIG.val;

  const [y0, y1] = yearsOf(m);
  const t = y1 === y0 ? 1 : Math.min(1, Math.max(0, (year - y0) / (y1 - y0)));
  let base = m.price[0] + (m.price[1] - m.price[0]) * Math.pow(t, v.yearCurve);

  // kilometre deviation from the local baseline
  const age = Math.max(1, new Date().getFullYear() - year);
  const expectedKm = age * v.kmPerYearBaseline;
  const deltaKm = km - expectedKm;
  base *= deltaKm > 0
    ? 1 - Math.min(0.28, (deltaKm / 10000) * v.kmPenaltyPer10k)
    : 1 + Math.min(0.10, (-deltaKm / 10000) * v.kmBonusPer10k);

  base *= v.conditionFactor[cond];

  const flags = [];
  if ($('#sv-acc').value === 'major') { base *= 1 - v.accidentMajor; flags.push('Structural repair history'); }
  if ($('#sv-acc').value === 'minor') { base *= 1 - v.accidentMinor; flags.push('Panel repair history'); }
  if (!$('#sv-hist').checked) { base *= 1 - v.noServiceHistory; flags.push('No documented service history'); }
  if ($('#sv-spec').value === 'import') { base *= 1 - v.nonGccImport; flags.push('Non-GCC import'); }

  base = Math.max(base, m.price[0] * 0.45);
  return { m, base, lo: base * (1 - v.spreadPct), hi: base * (1 + v.spreadPct), flags };
}

function renderSeller() {
  const r = estimateValue();
  const v = CONFIG.val;
  const base = r.base;

  // Two routes, per ats-ops/data/inspection-services.md. No fee, no commission,
  // no percentage of the sale — that is the broking line and it is not live.
  const tradeLo = base * v.tradeLo;
  const tradeHi = base * v.tradeHi;
  const askStart = base * v.askUplift;
  const step = Math.round((askStart * v.dropPct) / 500) * 500;

  $('#sv-out').innerHTML = `
    <div class="val-cell highlight">
      <span class="k">Indicative private value</span>
      <span class="big accent">${AEDR(r.lo, r.hi)}</span>
      <span class="sub">Desk estimate. Not a quote, and not for the customer until the
      car has been on the lift and scanned.</span>
    </div>
    <div class="val-cell">
      <span class="k">Fast Sell — trade</span>
      <span class="big">${AEDR(tradeLo, tradeHi)}</span>
      <span class="sub"><strong>Subject to dealer quote.</strong> Derived from comparables,
      not from a quote — two dealer calls outstanding (T-052).</span>
    </div>
    <div class="val-cell">
      <span class="k">Proper Listing — start at</span>
      <span class="big">${AED(askStart)}</span>
      <span class="sub">Private sale, weeks. Ask sits above the expected sale price so the
      drop schedule has somewhere to go.</span>
    </div>
    <div class="val-cell">
      <span class="k">Drop schedule</span>
      <span class="big">−${AED(step)} / ${v.dropDays} days</span>
      <span class="sub">Floor ${AED(base)}. Agreed with the owner <strong>before</strong>
      listing — that agreement is the product, not the price.</span>
    </div>
    ${r.flags.length ? `<div class="val-cell"><span class="k">Applied deductions</span><span class="sub" style="margin-top:0">${r.flags.map(esc).join(' · ')}</span></div>` : ''}
    <div class="val-cell">
      <span class="k">Pre-sale work</span>
      <span class="sub" style="margin-top:0">Clear stored faults at source, A/C performance,
      detail and paint correction. On this platform expect
      ${AEDR(r.m.recon[0], r.m.recon[1])} to present as a clean car — it usually returns
      more than it costs.</span>
    </div>`;
}


/* ========================== BOOT ======================================= */
function initBuyer() {
  const budget = $('#bv-budget');
  const out = $('#bv-budget-out');
  const sync = () => {
    buyerState.budget = parseInt(budget.value, 10);
    out.textContent = AED(buyerState.budget);
    renderBuyer();
  };
  budget.addEventListener('input', sync);

  $$('[data-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.group;
      $$(`[data-group="${g}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      buyerState[g] = btn.dataset.value;
      renderBuyer();
    });
  });
  sync();
}

function initSeller() {
  const sel = $('#sv-model');
  sel.innerHTML = MODELS.map((m, i) => `<option value="${i}">${esc(m.name)} — ${esc(m.yrs)}</option>`).join('');

  const year = $('#sv-year');
  const km = $('#sv-km');
  const syncYears = () => {
    const [y0, y1] = yearsOf(MODELS[parseInt(sel.value, 10)]);
    year.min = y0; year.max = y1;
    if (+year.value < y0 || +year.value > y1) year.value = Math.round((y0 + y1) / 2);
    paintRange(year);
    $('#sv-year-out').textContent = year.value;
    $('#sv-km-out').textContent = (+km.value).toLocaleString('en-US') + ' km';
    renderSeller();
  };
  const syncOut = () => {
    $('#sv-year-out').textContent = year.value;
    $('#sv-km-out').textContent = (+km.value).toLocaleString('en-US') + ' km';
    renderSeller();
  };
  sel.addEventListener('change', syncYears);
  [year, km].forEach((el) => el.addEventListener('input', syncOut));
  ['#sv-cond', '#sv-acc', '#sv-spec', '#sv-hist'].forEach((s) => $(s).addEventListener('change', renderSeller));
  syncYears();
}

function initTabs() {
  $$('.mode-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      $$('.mode-switch button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== target; });
    });
  });
}

function dataFailure(err) {
  const msg = `<div class="empty">Vehicle data could not be loaded (${esc(err.message)}).<br><br>
    If you opened this page straight off the disk, serve it instead —
    <span class="mono">npx http-server .</span> — browsers block local data files
    over <span class="mono">file://</span>.</div>`;
  $('#buy-results').innerHTML = msg;
  $('#sv-out').innerHTML = msg;
}

/* -- Offline shell. No service worker on file:// — it needs a real origin. -- */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

/* -- Android / Chrome install button. iOS uses Share > Add to Home Screen,
      which the browser drives itself and cannot be triggered from here. ---- */
function initInstallPrompt() {
  const btn = $('#install-btn');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.hidden = false;
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    btn.hidden = true;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
  });

  window.addEventListener('appinstalled', () => { btn.hidden = true; });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Plans, the fee comparator and the lead form carry no vehicle data, so they
  // come up immediately and stay usable even if the dataset fetch fails.
  initTabs();
  $('#year-now').textContent = new Date().getFullYear();

  try {
    await loadModels();
    initBuyer();
    initSeller();
  } catch (err) {
    dataFailure(err);
  }

  initRangeFill();
  registerServiceWorker();
  initInstallPrompt();
});
