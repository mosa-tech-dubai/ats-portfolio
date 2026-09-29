/* ============================================================================
   ATS — UAE Used Cars Advisor
   Single-file logic. Nothing to build, no dependencies, no backend required:
   leads hand off to WhatsApp exactly like the booking form on index.html.

   EDIT POINTS — everything you will realistically want to change lives in
   two places only:
     1. CONFIG  — phone number, fees, commission rate, valuation assumptions.
     2. MODELS  — the vehicle / known-fault / price-band database.
   ========================================================================== */

const CONFIG = {
  whatsapp: '971558329858',
  currency: 'AED',

  /* -- Service pricing. Both models are offered side by side: a FIXED fee and
        a COMMISSION on the sale. Adjust freely — the plan cards, the
        comparator and the net-proceeds maths all read from here. ----------- */
  fees: {
    inspectionBasic:      450,   // pre-purchase inspection, one vehicle, on site
    inspectionFull:       750,   // PPI + full module scan + written report
    buyerAgentFixed:     1800,   // sourcing, negotiation, transfer handled
    sellerFixed:         2500,   // managed sale, flat fee, no % taken
    sellerCommissionPct:  2.5,   // % of final agreed sale price
    sellerCommissionMin: 2000,   // floor on the commission plan
    transferAdmin:        350,   // RTA / Tasjeel running-around, per transfer
  },

  /* -- Valuation model assumptions (indicative only). ------------------- */
  val: {
    kmPerYearBaseline: 20000,   // UAE average; deviation moves the number
    kmPenaltyPer10k:   0.018,   // 1.8% off per 10,000 km above baseline
    kmBonusPer10k:     0.012,   // 1.2% on per 10,000 km below baseline
    accidentMajor:     0.18,    // chassis / structural repair
    accidentMinor:     0.06,    // panel work only
    noServiceHistory:  0.09,
    nonGccImport:      0.16,    // US / Japan import discount in this market
    spreadPct:         0.07,    // ± band on the quoted estimate
    tradeInFactor:     0.82,    // typical showroom offer vs private-sale value
    yearCurve:         1.5,     // >1 pushes mid-age cars nearer the band floor
    conditionFactor: { excellent: 1.05, good: 1.0, fair: 0.9, rough: 0.78 },
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
        <div class="kv"><span class="k">Market band</span><span class="v">${AED(m.price[0])} – ${AED(m.price[1])}</span></div>
        <div class="kv"><span class="k">Your ceiling</span><span class="v">${AED(ceiling)}</span></div>
        <div class="kv"><span class="k">First-year recon</span><span class="v">${AED(m.recon[0])} – ${AED(m.recon[1])}</span></div>
        <div class="kv"><span class="k">Parts cost</span><span class="v">${m.parts === 'cheap' ? 'Low' : m.parts === 'mid' ? 'Moderate' : 'High'}</span></div>
        <div class="kv"><span class="k">Heat durability</span><span class="v">${m.rel}/5</span></div>
        <a class="btn btn-outline btn-sm" style="width:100%;margin-top:18px"
           href="#lead" data-prefill="${esc(m.name)}">Get this one inspected</a>
      </aside>
    </article>`;
  }).join('');

  $$('#buy-results [data-prefill]').forEach((a) => {
    a.addEventListener('click', () => {
      $('#lf-intent').value = 'BUY';
      $('#lf-vehicle').value = a.dataset.prefill;
      syncLeadForm();
    });
  });
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
  const f = CONFIG.fees;
  const price = r.base;
  const commission = Math.max(price * (f.sellerCommissionPct / 100), f.sellerCommissionMin);

  $('#sv-out').innerHTML = `
    <div class="val-cell highlight">
      <span class="k">Indicative private-sale range</span>
      <span class="big accent">${AED(r.lo)} – ${AED(r.hi)}</span>
      <span class="sub">Before reconditioning. Confirmed only after physical appraisal and a full module scan.</span>
    </div>
    <div class="val-cell">
      <span class="k">Net to you — fixed fee</span>
      <span class="big">${AED(price - f.sellerFixed)}</span>
      <span class="sub">${AED(f.sellerFixed)} flat, whatever the car sells for.</span>
    </div>
    <div class="val-cell">
      <span class="k">Net to you — commission</span>
      <span class="big">${AED(price - commission)}</span>
      <span class="sub">${CONFIG.fees.sellerCommissionPct}% of the agreed price, minimum ${AED(f.sellerCommissionMin)}.</span>
    </div>
    <div class="val-cell">
      <span class="k">Trade-in / dealer offer</span>
      <span class="big">${AED(price * CONFIG.val.tradeInFactor)}</span>
      <span class="sub">What a showroom typically offers for the same car — the gap is what a managed sale is worth.</span>
    </div>
    ${r.flags.length ? `<div class="val-cell"><span class="k">Applied deductions</span><span class="sub" style="margin-top:0">${r.flags.map(esc).join(' · ')}</span></div>` : ''}
    <div class="val-cell">
      <span class="k">Recommended pre-sale work</span>
      <span class="sub" style="margin-top:0">Clear all stored fault codes at source, A/C performance, full detail and paint correction. On this platform, expect ${AED(r.m.recon[0])} – ${AED(r.m.recon[1])} to present as a clean car — and it typically returns more than it costs.</span>
    </div>`;
}

/* ========================== FEE COMPARATOR ============================= */
function renderCompare() {
  const price = parseInt($('#cmp-price').value, 10);
  const f = CONFIG.fees;
  $('#cmp-price-out').textContent = AED(price);

  const commission = Math.max(price * (f.sellerCommissionPct / 100), f.sellerCommissionMin);
  const fixed = f.sellerFixed;
  const breakeven = fixed / (f.sellerCommissionPct / 100);
  const fixedWins = fixed < commission;

  $('#cmp-out').innerHTML = `
    <div class="cmp ${fixedWins ? 'win' : ''}">
      <span class="k">Fixed fee plan</span>
      <span class="n">${AED(fixed)}</span>
      <p class="d">Flat. Net to you ${AED(price - fixed)}.</p>
      ${fixedWins ? '<span class="badge">Cheaper at this price</span>' : ''}
    </div>
    <div class="cmp ${!fixedWins ? 'win' : ''}">
      <span class="k">Commission plan — ${f.sellerCommissionPct}%</span>
      <span class="n">${AED(commission)}</span>
      <p class="d">Net to you ${AED(price - commission)}.${commission === f.sellerCommissionMin ? ' Minimum fee applied.' : ''}</p>
      ${!fixedWins ? '<span class="badge">Cheaper at this price</span>' : ''}
    </div>
    <div class="cmp">
      <span class="k">Break-even price</span>
      <span class="n">${AED(breakeven)}</span>
      <p class="d">Above this, the fixed fee costs you less. Below it, take the commission plan — we will tell you which one you are in before you sign anything.</p>
    </div>`;
}

/* ========================== LEAD FORM ================================== */
function syncLeadForm() {
  const intent = $('#lf-intent').value;
  $('#lf-vehicle-label').textContent = intent === 'SELL'
    ? 'Your vehicle (make, model, year, km)'
    : 'Vehicle or shortlist you are considering';
  $('#lf-budget-wrap').hidden = intent === 'SELL';
  $('#lf-plan-wrap').hidden = intent === 'INSPECT';
}

function initLeadForm() {
  const form = $('#lead-form');
  const status = $('#lf-status');

  $('#lf-intent').addEventListener('change', syncLeadForm);
  syncLeadForm();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if ($('#lf-hp').value) return; // honeypot

    const name = $('#lf-name').value.trim();
    const phone = $('#lf-phone').value.trim();
    if (name.length < 2) { status.textContent = 'Please enter your name.'; status.className = 'form-status err'; return; }
    if (phone.length < 6) { status.textContent = 'Please enter a valid phone number.'; status.className = 'form-status err'; return; }

    const sel = (id) => { const el = $(id); return el.options[el.selectedIndex].text; };
    const lines = [
      `Used Cars Advisor — ${sel('#lf-intent')}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
    ];
    const vehicle = $('#lf-vehicle').value.trim();
    if (vehicle) lines.push(`Vehicle: ${vehicle}`);
    if (!$('#lf-budget-wrap').hidden && $('#lf-budget').value.trim()) lines.push(`Budget: AED ${$('#lf-budget').value.trim()}`);
    if (!$('#lf-plan-wrap').hidden) lines.push(`Preferred plan: ${sel('#lf-plan')}`);
    const notes = $('#lf-notes').value.trim();
    if (notes) lines.push(`Notes: ${notes}`);

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp…';
    status.className = 'form-status ok';
  });
}

/* ========================== PLAN CARDS ================================= */
function renderPlans() {
  const f = CONFIG.fees;
  const plans = [
    { kind: 'fixed', tag: 'FIXED', name: 'Inspection only', price: AED(f.inspectionBasic), unit: 'per vehicle', who: 'Buyer',
      items: ['Full pre-purchase inspection on the lift', 'Complete module scan, all systems', 'Go / no-go call with a target price', 'Written summary on WhatsApp the same day'] },
    { kind: 'fixed', tag: 'FIXED', name: 'Inspection + report', price: AED(f.inspectionFull), unit: 'per vehicle', who: 'Buyer',
      items: ['Everything in Inspection only', 'Photographed written report, fault-by-fault', 'Costed repair list you can negotiate with', 'Second opinion on a car you already viewed'] },
    { kind: 'fixed', tag: 'FIXED', name: "Buyer's agent", price: AED(f.buyerAgentFixed), unit: 'flat, per purchase', who: 'Buyer',
      items: ['We shortlist and vet the listings for you', 'Inspection of the chosen car included', 'We negotiate on your behalf', `RTA transfer and paperwork handled (+${AED(f.transferAdmin)} fees)`] },
    { kind: 'commission', tag: 'BOTH', name: 'Managed sale', price: `${f.sellerCommissionPct}%`, unit: `of sale price · or ${AED(f.sellerFixed)} flat`, who: 'Seller',
      items: ['Appraisal, module scan and pre-sale fault clearing', 'Listing, photography and buyer filtering', 'Test drives and negotiation handled for you', 'Bank settlement and RTA transfer at the counter', 'You pick the fee model — whichever is cheaper for your car'] },
  ];

  $('#plan-grid').innerHTML = plans.map((p) => `
    <div class="plan ${p.kind}">
      <span class="tagx">${p.tag}</span>
      <h3>${esc(p.name)}</h3>
      <div class="price">${p.price}</div>
      <div class="who">${esc(p.unit)} · ${esc(p.who)}</div>
      <ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="foot"><a class="btn btn-outline btn-sm" style="width:100%" href="#lead">Start with this</a></div>
    </div>`).join('');
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
      if (target === 'sell') { $('#lf-intent').value = 'SELL'; syncLeadForm(); }
      if (target === 'buy')  { $('#lf-intent').value = 'BUY';  syncLeadForm(); }
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
  renderPlans();
  initTabs();
  initLeadForm();
  $('#cmp-price').addEventListener('input', renderCompare);
  renderCompare();
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
