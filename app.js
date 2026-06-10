/* ======================
   MilPayRuck (Frontend-only)
   Demo automation:
   - ZIP → Place lookup (small dataset)
   - PEBD validation + TIS auto-calc
   - Progressive federal tax (demo brackets)
   - State/local (demo) based on ZIP place
   - BAH selection: BAH vs Partial BAH when on quarters (demo)
   - Special pay: presets + gating + auto amount (demo)
   - Profile save/load via localStorage
====================== */

function $(id){ return document.getElementById(id); }
function money(n){
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { style:"currency", currency:"USD" });
}
function num(v){ const x = Number(v); return Number.isFinite(x) ? x : 0; }
function toDateOrNull(v){
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function todayLocalDate(){
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function daysBetween(a, b){
  const ms = 24*60*60*1000;
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bb - aa) / ms);
}

/* ======================
   Demo data (replace later with JSON/DB)
====================== */

// ZIP → place (tiny demo list)
const ZIP_TO_PLACE = {
  "11357": { state:"NY", city:"Whitestone", county:"Queens", local:"NYC" },
  "10001": { state:"NY", city:"New York", county:"New York", local:"NYC" },
  "11101": { state:"NY", city:"Long Island City", county:"Queens", local:"NYC" },
  "10451": { state:"NY", city:"Bronx", county:"Bronx", local:"NYC" },
  "22202": { state:"VA", city:"Arlington", county:"Arlington", local:null },
  "22031": { state:"VA", city:"Fairfax", county:"Fairfax", local:null },
  "30301": { state:"GA", city:"Atlanta", county:"Fulton", local:null },
  "33101": { state:"FL", city:"Miami", county:"Miami-Dade", local:null },
  "60601": { state:"IL", city:"Chicago", county:"Cook", local:null },
  "94102": { state:"CA", city:"San Francisco", county:"San Francisco", local:null }
};

// Basic Pay (monthly) demo table by rank → thresholds in years
const BASIC_PAY_DEMO = {
  "E-1": [{ minYears:0, amount: 2017 }],
  "E-2": [{ minYears:0, amount: 2261 }],
  "E-3": [{ minYears:0, amount: 2377 }, { minYears:2, amount: 2522 }],
  "E-4": [{ minYears:0, amount: 2633 }, { minYears:2, amount: 2924 }, { minYears:4, amount: 3088 }],
  "E-5": [{ minYears:0, amount: 3120 }, { minYears:2, amount: 3325 }, { minYears:4, amount: 3538 }, { minYears:6, amount: 3750 }],
  "E-6": [{ minYears:0, amount: 3646 }, { minYears:2, amount: 3988 }, { minYears:4, amount: 4276 }, { minYears:6, amount: 4566 }, { minYears:8, amount: 4858 }],
  "E-7": [{ minYears:0, amount: 4470 }, { minYears:2, amount: 4788 }, { minYears:4, amount: 5099 }, { minYears:6, amount: 5412 }, { minYears:8, amount: 5728 }],
  "E-8": [{ minYears:0, amount: 5270 }, { minYears:2, amount: 5650 }, { minYears:4, amount: 6030 }, { minYears:6, amount: 6410 }],
  "E-9": [{ minYears:0, amount: 6100 }, { minYears:2, amount: 6550 }, { minYears:4, amount: 7000 }]
};

// BAS demo
const BAS_DEMO = {
  enlisted: 460.25,
  officer: 316.98
};

// BAH demo table by ZIP → rank → with/without
const BAH_DEMO = {
  "11357": {
    "E-6": { with: 3300, without: 2800 },
    "E-5": { with: 3000, without: 2550 },
    "O-3": { with: 4300, without: 3800 }
  },
  "22202": {
    "E-6": { with: 3200, without: 2700 },
    "E-5": { with: 2950, without: 2500 },
    "O-3": { with: 4500, without: 4000 }
  }
};

// Partial BAH demo (when on quarters)
const PARTIAL_BAH_DEMO = {
  enlisted: 12.00,
  officer: 12.00
};

// COLA demo (just a couple)
const COLA_DEMO = {
  "11357": 0,
  "10001": 0,
  "22202": 0
};

// Per diem demo (monthly total)
const PER_DIEM_DEMO = {
  "11357": 0,
  "10001": 0,
  "22202": 0
};

// Progressive federal tax demo tables by year
const FED_TAX_DEMO = {
  "2025": {
    standardDeduction: { single: 14600, married_joint: 29200, head_household: 21900 },
    brackets: {
      single: [
        { upTo: 11600, rate: 0.10 },
        { upTo: 47150, rate: 0.12 },
        { upTo: 100525, rate: 0.22 },
        { upTo: 191950, rate: 0.24 },
        { upTo: 243725, rate: 0.32 },
        { upTo: 609350, rate: 0.35 },
        { upTo: null, rate: 0.37 }
      ],
      married_joint: [
        { upTo: 23200, rate: 0.10 },
        { upTo: 94300, rate: 0.12 },
        { upTo: 201050, rate: 0.22 },
        { upTo: 383900, rate: 0.24 },
        { upTo: 487450, rate: 0.32 },
        { upTo: 731200, rate: 0.35 },
        { upTo: null, rate: 0.37 }
      ],
      head_household: [
        { upTo: 16550, rate: 0.10 },
        { upTo: 63100, rate: 0.12 },
        { upTo: 100500, rate: 0.22 },
        { upTo: 191950, rate: 0.24 },
        { upTo: 243700, rate: 0.32 },
        { upTo: 609350, rate: 0.35 },
        { upTo: null, rate: 0.37 }
      ]
    }
  },
  "2026": null // demo: fall back to 2025
};

// State + Local demo (only NY + NYC demo)
const STATE_LOCAL_DEMO = {
  "NY": {
    // very rough simplified demo brackets (replace with official later)
    brackets: [
      { upTo: 8500, rate: 0.04 },
      { upTo: 11700, rate: 0.045 },
      { upTo: 13900, rate: 0.0525 },
      { upTo: 21400, rate: 0.059 },
      { upTo: 80650, rate: 0.0633 },
      { upTo: null, rate: 0.0685 }
    ]
  },
  "NYC": {
    brackets: [
      { upTo: 12000, rate: 0.03078 },
      { upTo: 25000, rate: 0.03762 },
      { upTo: 50000, rate: 0.03819 },
      { upTo: null, rate: 0.03876 }
    ]
  }
};

// Special pay demo: base amounts and dynamic options
const SPECIAL_PAY_DEMO = {
  "Jump Pay": { amount: 150, taxable: true, presets: [] },
  "Demolition Pay": { amount: 150, taxable: true, presets: [] },
  "Foreign Language Pay": {
    amount: 100,
    taxable: true,
    presets: [
      { label: "Single language", amount: 100 },
      { label: "Multiple languages", amount: 200 }
    ]
  },
  "Hardship Duty Pay": {
    amount: 100,
    taxable: false,
    presets: [
      { label: "Iraq", amount: 100, meta: { location: "Iraq" } },
      { label: "Kuwait", amount: 50, meta: { location: "Kuwait" } },
      { label: "Kosovo", amount: 50, meta: { location: "Kosovo" } },
      { label: "Afghanistan", amount: 100, meta: { location: "Afghanistan" } }
    ]
  },
  "Sea Pay": {
    amount: 0,
    taxable: true,
    presets: [
      { label: "≤ 1 year", amount: 50, meta: { years: 1 } },
      { label: "2 years", amount: 75, meta: { years: 2 } },
      { label: "4 years", amount: 125, meta: { years: 4 } },
      { label: "8 years", amount: 200, meta: { years: 8 } },
      { label: "≥ 20 years", amount: 350, meta: { years: 20 } }
    ]
  },
  "Navy Career Enlisted Flyers": {
    amount: 0,
    taxable: true,
    presets: [
      { label: "4 or less years", amount: 150, meta: { tier: "≤4" } },
      { label: "Over 4 years", amount: 250, meta: { tier: ">4" } },
      { label: "Over 8 years", amount: 350, meta: { tier: ">8" } },
      { label: "Over 18 years", amount: 400, meta: { tier: ">18" } }
    ]
  },
  "Hazardous Duty Pay (Crewmember AWACS)": {
    amount: 0,
    taxable: true,
    presets: buildEvenYearPresets(2, 24, 50, 300) // demo scaling
  }
};

// Special pay gating rules (UI warnings)
const SPECIAL_PAY_GATES = {
  "Sea Pay": { allowedBranches: ["Navy", "Coast Guard", "Marine", "Army", "AirForce", "Space Force"], note: "Eligibility depends on billet/duty. Demo does not enforce duty assignment." },
  "Navy Career Enlisted Flyers": { allowedBranches: ["Navy"], note: "Typically Navy-focused. Demo only." },
  "Air Force Aviation Incentive Pay": { allowedBranches: ["AirForce", "Space Force"], note: "Typically Air Force/Space Force aviation roles." },
  "Flight Deck Duty Pay": { allowedBranches: ["Navy", "Marine", "Coast Guard"], note: "Typically sea service aviation/shipboard roles." },
  "Submarine Incentive Pay": { allowedBranches: ["Navy"], note: "Typically Navy submarine duty." }
};

function buildEvenYearPresets(min, max, lowAmt, highAmt){
  const arr = [];
  const steps = ((max - min) / 2) + 1;
  for (let y = min, i=0; y <= max; y += 2, i++){
    const t = i / Math.max(1, steps-1);
    const amt = Math.round(lowAmt + t*(highAmt-lowAmt));
    arr.push({ label: `Over ${y} years`, amount: amt, meta: { years: y } });
  }
  return arr;
}

/* ======================
   Inline validation
====================== */

function showError(inputEl, errorEl, msg){
  inputEl.classList.add("inputError");
  errorEl.textContent = msg;
}
function clearError(inputEl, errorEl){
  inputEl.classList.remove("inputError");
  errorEl.textContent = "";
}
function normalizeZip(raw){
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.slice(0,5);
}
function attachZipSanitizer(zipEl){
  zipEl.addEventListener("input", () => {
    const cleaned = normalizeZip(zipEl.value);
    if (zipEl.value !== cleaned) zipEl.value = cleaned;
  });
}

function validatePEBDInline(){
  const pebdEl = $("pebd");
  const pebdErr = $("pebdError");
  clearError(pebdEl, pebdErr);

  if (!pebdEl.value) return true;

  const pebd = toDateOrNull(pebdEl.value);
  const today = todayLocalDate();
  if (!pebd){
    showError(pebdEl, pebdErr, "Invalid PEBD date.");
    return false;
  }
  if (pebd > today){
    showError(pebdEl, pebdErr, "PEBD cannot be later than today.");
    return false;
  }
  const asOf = toDateOrNull($("asOfDate").value);
  if (asOf && pebd > asOf){
    showError(pebdEl, pebdErr, "PEBD cannot be later than the As-of date.");
    return false;
  }
  return true;
}

function validateZipInline(zipEl, errEl, label){
  clearError(zipEl, errEl);
  const v = String(zipEl.value || "").trim();
  if (!v) return true;

  if (!/^\d{5}$/.test(v)){
    showError(zipEl, errEl, `${label} must be exactly 5 digits (numbers only).`);
    return false;
  }
  if (!ZIP_TO_PLACE[v]){
    showError(zipEl, errEl, `${label} not found in demo ZIP list. Replace demo dataset later.`);
    return false;
  }
  return true;
}

function validateAllInline(){
  const okPebd = validatePEBDInline();
  const okDuty = validateZipInline($("dutyZip"), $("dutyZipError"), "Duty Location ZIP");
  const okHor  = validateZipInline($("horZip"), $("horZipError"), "Home of Record ZIP");
  return okPebd && okDuty && okHor;
}

/* ======================
   Ranks
====================== */

function buildRankList(){
  const ranks = [];
  for (let i=1;i<=9;i++) ranks.push(`E-${i}`);
  for (let i=1;i<=5;i++) ranks.push(`W-${i}`);
  // O1E to O3E
  ranks.push("O-1E","O-2E","O-3E");
  for (let i=1;i<=10;i++) ranks.push(`O-${i}`);
  return ranks;
}
function isOfficer(rank){ return /^O-/.test(rank) || /^O-.*E$/.test(rank); }
function isWarrant(rank){ return /^W-/.test(rank); }
function isEnlisted(rank){ return /^E-/.test(rank); }

/* ======================
   ZIP → place
====================== */

function updateZipHints(){
  const duty = $("dutyZip").value;
  const hor  = $("horZip").value;

  $("dutyZipHint").textContent = placeHint(duty);
  $("horZipHint").textContent  = placeHint(hor);
}

function placeHint(zip){
  if (!zip || zip.length !== 5) return "Auto-detects state/city (demo ZIP dataset).";
  const p = ZIP_TO_PLACE[zip];
  if (!p) return "ZIP not found in demo dataset.";
  const local = p.local ? ` • Local: ${p.local}` : "";
  return `${p.city}, ${p.state}${local}`;
}

/* ======================
   TIS from PEBD
====================== */

function computeTISYears(pebd, asOf){
  // full years of service as-of date
  let years = asOf.getFullYear() - pebd.getFullYear();
  const m = asOf.getMonth() - pebd.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < pebd.getDate())) years--;
  return Math.max(0, years);
}

function updateTIS(){
  const pebd = toDateOrNull($("pebd").value);
  const asOf = toDateOrNull($("asOfDate").value) || todayLocalDate();
  if (!pebd){
    $("tisDisplay").value = "";
    return;
  }
  const years = computeTISYears(pebd, asOf);
  $("tisDisplay").value = `${years} years`;
}

/* ======================
   Entitlement automation (demo)
====================== */

function getRadio(name){
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function getBasicPayFromTable(rank, tisYears){
  const rows = BASIC_PAY_DEMO[rank];
  if (!rows) return 0;
  let amt = 0;
  for (const r of rows){
    if (tisYears >= r.minYears) amt = r.amount;
  }
  return amt;
}

function getBahAuto({ dutyZip, rank, hasDeps, onQuarters }){
  // If on quarters: Partial BAH demo
  if (onQuarters === "Yes"){
    const type = (isOfficer(rank) || isWarrant(rank)) ? "officer" : "enlisted";
    return { amount: PARTIAL_BAH_DEMO[type] || 0, reason: "On government quarters → Partial BAH (demo)." };
  }

  // Otherwise: BAH demo by locality
  const z = BAH_DEMO[dutyZip];
  if (!z || !z[rank]) return { amount: 0, reason: "No demo BAH rate for this ZIP/rank." };
  const key = hasDeps ? "with" : "without";
  return { amount: z[rank][key] || 0, reason: `BAH (${hasDeps ? "with" : "without"} dependents) from demo table.` };
}

function getBasAuto(rank){
  const type = (isOfficer(rank) || isWarrant(rank)) ? "officer" : "enlisted";
  return BAS_DEMO[type] || 0;
}

function getFsaAuto(){
  // Demo rule: deployed yes + dependents yes + away >=31 days => 250
  const dep = getRadio("deployed");
  const deps = getRadio("dependents");
  const start = toDateOrNull($("depStart").value);
  if (dep !== "Yes" || deps !== "Yes" || !start) return { amount: 0, reason: "FSA not triggered (demo)." };

  const end = toDateOrNull($("depEnd").value) || todayLocalDate();
  const awayDays = daysBetween(start, end);
  if (awayDays >= 31) return { amount: 250, reason: `FSA demo applied (away ${awayDays} days).` };
  return { amount: 0, reason: `FSA not applied (only ${awayDays} days).` };
}

/* ======================
   Taxes (progressive)
====================== */

function calcProgressiveTax(taxableIncome, brackets){
  // taxableIncome is after deductions
  let tax = 0;
  let prev = 0;
  for (const b of brackets){
    const cap = b.upTo;
    if (cap === null){
      tax += Math.max(0, taxableIncome - prev) * b.rate;
      break;
    }
    const slice = Math.min(taxableIncome, cap) - prev;
    if (slice > 0) tax += slice * b.rate;
    prev = cap;
    if (taxableIncome <= cap) break;
  }
  return Math.max(0, tax);
}

function getFedTaxRules(taxYear){
  return FED_TAX_DEMO[taxYear] || FED_TAX_DEMO["2025"];
}

function computeAnnualTaxes({ annualTaxable, filingStatus, stateCode, localCode, taxYear }){
  const fedRules = getFedTaxRules(taxYear);
  const std = fedRules.standardDeduction[filingStatus] || 0;
  const fedTaxable = Math.max(0, annualTaxable - std);
  const fedTax = calcProgressiveTax(fedTaxable, fedRules.brackets[filingStatus] || []);

  // Demo state/local: uses simplified progressive tables; later replace with official/state-specific logic
  let stateTax = 0;
  if (stateCode && STATE_LOCAL_DEMO[stateCode]){
    stateTax = calcProgressiveTax(Math.max(0, annualTaxable), STATE_LOCAL_DEMO[stateCode].brackets);
  }

  let localTax = 0;
  if (localCode && STATE_LOCAL_DEMO[localCode]){
    localTax = calcProgressiveTax(Math.max(0, annualTaxable), STATE_LOCAL_DEMO[localCode].brackets);
  }

  return { fedTax, stateTax, localTax };
}

/* ======================
   Special pay UI + list
====================== */

let specialPays = []; // {type, freq, amountMonthly, taxable, meta}

function setText(elId, txt){ $(elId).textContent = txt; }

function clearChildren(el){ while (el.firstChild) el.removeChild(el.firstChild); }

function renderSpecialPayPresets(type){
  const wrap = $("spPresets");
  clearChildren(wrap);

  const data = SPECIAL_PAY_DEMO[type];
  if (!data || !data.presets || data.presets.length === 0) return;

  const label = document.createElement("div");
  label.className = "hint";
  label.textContent = "Quick presets:";
  wrap.appendChild(label);

  const row = document.createElement("div");
  row.className = "radioRow";
  wrap.appendChild(row);

  for (const p of data.presets){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = `${p.label} (${money(p.amount)})`;
    btn.addEventListener("click", () => {
      $("spAmount").value = p.amount;
      $("spOverride").checked = true; // set override since user chose
      $("spOverride").dispatchEvent(new Event("change"));
      // store meta in dynamic area
      $("spDynamic").dataset.meta = JSON.stringify(p.meta || {});
    });
    row.appendChild(btn);
  }
}

function renderSpecialPayDynamicFields(type){
  const box = $("spDynamic");
  clearChildren(box);
  box.dataset.meta = "{}";

  // For demo: show extra select for a few types
  if (type === "Hardship Duty Pay"){
    const card = document.createElement("div");
    card.className = "cardInset";

    const title = document.createElement("h3");
    title.textContent = "Hardship location (demo)";
    card.appendChild(title);

    const sel = document.createElement("select");
    const opts = ["Iraq","Kuwait","Kosovo","Afghanistan"];
    sel.innerHTML = `<option value="">— Select location —</option>` + opts.map(o=>`<option>${o}</option>`).join("");
    sel.addEventListener("change", () => {
      box.dataset.meta = JSON.stringify({ location: sel.value });
      // Try auto from presets if match
      const presets = (SPECIAL_PAY_DEMO[type]?.presets) || [];
      const found = presets.find(p => (p.meta?.location === sel.value));
      if (found && !$("spOverride").checked){
        $("spAmount").value = found.amount;
      }
    });
    card.appendChild(sel);

    box.appendChild(card);
  }
}

function specialPayGateHint(){
  const type = $("spType").value;
  const branch = $("branch").value;

  const hintEl = $("spGateHint");
  hintEl.textContent = "";

  if (!type) return;
  const gate = SPECIAL_PAY_GATES[type];
  if (!gate) return;

  if (branch && gate.allowedBranches && !gate.allowedBranches.includes(branch)){
    hintEl.textContent = `Note: ${type} is typically not applicable to ${branch}. (${gate.note || "Demo rule"})`;
  } else {
    hintEl.textContent = gate.note ? `Note: ${gate.note}` : "";
  }
}

function autoFillSpecialPayAmount(){
  const type = $("spType").value;
  const override = $("spOverride").checked;

  const data = SPECIAL_PAY_DEMO[type];
  if (!type || !data) return;

  // Update default taxability
  $("spTaxability").value = data.taxable ? "taxable" : "nontaxable";

  if (!override){
    $("spAmount").value = data.amount || 0;
  }
}

function addSpecialPay(){
  const type = $("spType").value;
  if (!type) return;

  const freq = $("spFreq").value;
  const amount = num($("spAmount").value);

  // convert to monthly
  let amountMonthly = amount;
  if (freq === "daily"){
    amountMonthly = amount * 30; // demo
  } else if (freq === "oneTime"){
    amountMonthly = 0; // one-time not included in monthly; we still record it
  }

  const taxable = $("spTaxability").value === "taxable";
  const meta = JSON.parse($("spDynamic").dataset.meta || "{}");

  specialPays.push({ type, freq, amount, amountMonthly, taxable, meta });
  renderSpecialPayList();
}

function renderSpecialPayList(){
  const list = $("spList");
  clearChildren(list);

  if (specialPays.length === 0){
    const p = document.createElement("div");
    p.className = "hint";
    p.textContent = "No special pays added.";
    list.appendChild(p);
    return;
  }

  for (let i=0;i<specialPays.length;i++){
    const sp = specialPays[i];
    const pill = document.createElement("div");
    pill.className = "pill";

    const label = document.createElement("span");
    label.innerHTML = `<b>${sp.type}</b> — ${sp.freq} ${money(sp.amount)}`
      + (sp.freq === "oneTime" ? " (one-time)" : ` (monthly equiv: ${money(sp.amountMonthly)})`)
      + ` • ${sp.taxable ? "Taxable" : "Non-taxable"}`;
    pill.appendChild(label);

    const x = document.createElement("button");
    x.className = "x";
    x.type = "button";
    x.textContent = "×";
    x.addEventListener("click", () => {
      specialPays.splice(i,1);
      renderSpecialPayList();
    });

    pill.appendChild(x);
    list.appendChild(pill);
  }
}

function clearSpecialPays(){
  specialPays = [];
  renderSpecialPayList();
}

/* ======================
   Auto-fill (demo)
====================== */

function autoFillDemo(){
  const rank = $("rank").value;
  const dutyZip = $("dutyZip").value;
  const deps = getRadio("dependents") === "Yes";
  const quarters = getRadio("onQuarters");

  // TIS
  const pebd = toDateOrNull($("pebd").value);
  const asOf = toDateOrNull($("asOfDate").value) || todayLocalDate();
  const tis = pebd ? computeTISYears(pebd, asOf) : 0;

  // Base pay
  const bp = getBasicPayFromTable(rank, tis);
  if (bp) $("basePay").value = bp;

  // BAS
  const bas = getBasAuto(rank);
  if (bas) $("bas").value = bas;

  // BAH / Partial BAH
  const bahRes = getBahAuto({ dutyZip, rank, hasDeps: deps, onQuarters: quarters });
  $("bah").value = bahRes.amount || 0;
  $("bahHint").textContent = bahRes.reason;

  // COLA / per diem demo
  if (dutyZip && COLA_DEMO[dutyZip] != null) $("cola").value = COLA_DEMO[dutyZip];
  if (dutyZip && PER_DIEM_DEMO[dutyZip] != null) $("perDiem").value = PER_DIEM_DEMO[dutyZip];
}

/* ======================
   Calculate
====================== */

function getPlaceForDutyZip(){
  const z = $("dutyZip").value;
  return ZIP_TO_PLACE[z] || null;
}

function getEnteredRows(){
  const rows = [];
  const add = (k,v) => { if (v !== "" && v != null) rows.push([k, v]); };

  add("Branch", $("branch").value);
  add("Duty Status", $("status").value);
  add("Rank", $("rank").value);
  add("Filing Status", $("filingStatus").value);
  add("Tax Year", $("taxYear").value);

  if ($("pebd").value) add("PEBD", $("pebd").value);
  if ($("tisDisplay").value) add("Time in Service", $("tisDisplay").value);
  if ($("asOfDate").value) add("As-of Date", $("asOfDate").value);

  if ($("dutyZip").value){
    const p = getPlaceForDutyZip();
    add("Duty ZIP", $("dutyZip").value + (p ? ` (${p.city}, ${p.state})` : ""));
  }
  if ($("horZip").value) add("HOR ZIP", $("horZip").value);

  const deps = getRadio("dependents"); if (deps) add("Dependents", deps);
  const oq = getRadio("onQuarters"); if (oq) add("On Quarters", oq);

  const dep = getRadio("deployed"); if (dep) add("Deployed/Away", dep);
  if ($("depStart").value) add("Deploy Start", $("depStart").value);
  if ($("depEnd").value) add("Deploy End", $("depEnd").value);

  const bp = $("basePay").value; if (bp) add("Base Pay (monthly)", money(bp));
  const bah = $("bah").value; if (bah) add("Housing Allowance (monthly)", money(bah));
  const bas = $("bas").value; if (bas) add("BAS (monthly)", money(bas));
  const pd = $("perDiem").value; if (pd) add("Per Diem (monthly)", money(pd));
  const cola = $("cola").value; if (cola) add("COLA (monthly)", money(cola));
  const fsa = $("fsa").value; if (fsa) add("FSA (monthly)", money(fsa));

  const tspT = $("tspTradPct").value; if (tspT) add("TSP Traditional %", `${tspT}%`);
  const tspR = $("tspRothPct").value; if (tspR) add("Roth TSP %", `${tspR}%`);
  const cs = $("childSupport").value; if (cs) add("Child Support (monthly)", money(cs));
  const ins = $("insurance").value; if (ins) add("Insurance (monthly)", money(ins));
  const other = $("dedOther").value; if (other) add("Other Deductions (monthly)", money(other));

  return rows;
}

function renderEnteredTable(){
  const tbody = $("enteredTable").querySelector("tbody");
  tbody.innerHTML = "";
  for (const [k,v] of getEnteredRows()){
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${k}</td><td>${String(v)}</td>`;
    tbody.appendChild(tr);
  }
}

function calculate(){
  $("calcBadge").textContent = "Calculating…";
  renderEnteredTable();

  const explain = [];

  const rank = $("rank").value;
  const dutyZip = $("dutyZip").value;
  const filingStatus = $("filingStatus").value;
  const taxYear = $("taxYear").value;

  const place = getPlaceForDutyZip();
  const stateCode = place?.state || null;
  const localCode = place?.local || null;

  // Auto FSA (demo) if empty
  if (!$("fsa").value){
    const fsaRes = getFsaAuto();
    if (fsaRes.amount){
      $("fsa").value = fsaRes.amount;
    }
    explain.push(fsaRes.reason);
  }

  // Income items
  const basePay = num($("basePay").value);
  const bah = num($("bah").value);
  const bas = num($("bas").value);
  const perDiem = num($("perDiem").value);
  const cola = num($("cola").value);
  const fsa = num($("fsa").value);

  // Taxability rules (demo)
  // Taxable: base pay + taxable special pays + (FSA treated nontaxable in demo unless you set otherwise later)
  // Non-taxable: BAH/BAS/per diem/COLA/FSA demo
  let taxableMonthly = basePay;
  let nonTaxMonthly = bah + bas + perDiem + cola + fsa;

  // Special pays
  let spTaxableMonthly = 0;
  let spNonTaxMonthly = 0;
  for (const sp of specialPays){
    if (sp.freq === "oneTime") continue;
    if (sp.taxable) spTaxableMonthly += sp.amountMonthly;
    else spNonTaxMonthly += sp.amountMonthly;
  }
  taxableMonthly += spTaxableMonthly;
  nonTaxMonthly += spNonTaxMonthly;

  // Monthly gross
  const grossMonthly = taxableMonthly + nonTaxMonthly;

  // Deductions (TSP etc.) – demo: apply % to base pay only
  const tspTradPct = num($("tspTradPct").value) / 100;
  const tspRothPct = num($("tspRothPct").value) / 100;
  const tspTrad = basePay * tspTradPct;
  const tspRoth = basePay * tspRothPct;

  // “Taxable income” for tax computation (annual) – demo:
  // taxableMonthly minus traditional TSP (pretax). Roth is after-tax.
  const taxableMonthlyForTax = Math.max(0, taxableMonthly - tspTrad);
  const annualTaxable = taxableMonthlyForTax * 12;

  const taxes = computeAnnualTaxes({
    annualTaxable,
    filingStatus,
    stateCode,
    localCode,
    taxYear
  });

  const monthlyFedTax = taxes.fedTax / 12;
  const monthlyStateTax = taxes.stateTax / 12;
  const monthlyLocalTax = taxes.localTax / 12;

  // Other deductions
  const childSupport = num($("childSupport").value);
  const insurance = num($("insurance").value);
  const dedOther = num($("dedOther").value);

  // Monthly net
  const netMonthly =
    grossMonthly
    - monthlyFedTax
    - monthlyStateTax
    - monthlyLocalTax
    - tspTrad
    - tspRoth
    - childSupport
    - insurance
    - dedOther;

  // Paycheck split (rough)
  const midPay = netMonthly / 2;
  const endPay = netMonthly / 2;

  // Tables
  const calcTbody = $("calcTable").querySelector("tbody");
  calcTbody.innerHTML = "";

  const addRow = (name, amount) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td><td>${money(amount)}</td>`;
    calcTbody.appendChild(tr);
  };

  addRow("Base Pay (taxable)", basePay);
  if (spTaxableMonthly) addRow("Special Pays (taxable)", spTaxableMonthly);

  if (bah) addRow("BAH / Partial BAH (non-taxable)", bah);
  if (bas) addRow("BAS (non-taxable)", bas);
  if (perDiem) addRow("Per Diem (non-taxable)", perDiem);
  if (cola) addRow("COLA (non-taxable)", cola);
  if (fsa) addRow("FSA (non-taxable demo)", fsa);
  if (spNonTaxMonthly) addRow("Special Pays (non-taxable)", spNonTaxMonthly);

  addRow("Fed Tax (est.)", -monthlyFedTax);
  if (stateCode) addRow(`${stateCode} Tax (est.)`, -monthlyStateTax);
  if (localCode) addRow(`${localCode} Tax (est.)`, -monthlyLocalTax);

  if (tspTrad) addRow("TSP Traditional (pretax)", -tspTrad);
  if (tspRoth) addRow("Roth TSP (after-tax)", -tspRoth);
  if (childSupport) addRow("Child Support", -childSupport);
  if (insurance) addRow("Insurance", -insurance);
  if (dedOther) addRow("Other Deductions", -dedOther);

  // KPIs
  $("kpiGross").textContent = money(grossMonthly);
  $("kpiNet").textContent = money(netMonthly);
  $("kpiTaxable").textContent = money(taxableMonthlyForTax);
  $("kpiNonTaxable").textContent = money(nonTaxMonthly + spNonTaxMonthly);

  $("midPay").textContent = money(midPay);
  $("endPay").textContent = money(endPay);

  $("annualGross").textContent = money(grossMonthly * 12);
  $("annualNet").textContent = money(netMonthly * 12);

  $("annualFedTax").textContent = money(taxes.fedTax);
  $("annualStateTax").textContent = money(taxes.stateTax);
  $("annualLocalTax").textContent = money(taxes.localTax);

  // Explanations
  const bahExplain = $("bahHint").textContent || "";
  explain.unshift(bahExplain);

  const taxExplain = [];
  taxExplain.push(`Taxes are estimated using demo progressive brackets (year ${taxYear}).`);
  if (stateCode) taxExplain.push(`State estimated from duty ZIP: ${place.city}, ${stateCode}.`);
  if (localCode) taxExplain.push(`Local estimated from duty ZIP: ${localCode}.`);
  taxExplain.push("BAH/BAS/COLA/Per diem are treated as non-taxable in this demo. Adjust later per official rules.");

  $("explainBox").textContent = [...explain.filter(Boolean), ...taxExplain].join(" ");

  $("calcBadge").textContent = "Done";
}

/* ======================
   Profile Save/Load
====================== */

const STORAGE_KEY = "milpayruck_profile_v1";

function getProfileFromUI(){
  return {
    branch: $("branch").value,
    status: $("status").value,
    rank: $("rank").value,
    filingStatus: $("filingStatus").value,
    taxYear: $("taxYear").value,

    pebd: $("pebd").value,
    asOfDate: $("asOfDate").value,

    dutyZip: $("dutyZip").value,
    horZip: $("horZip").value,

    dependents: getRadio("dependents"),
    onQuarters: getRadio("onQuarters"),
    deployed: getRadio("deployed"),

    depStart: $("depStart").value,
    depEnd: $("depEnd").value,

    basePay: $("basePay").value,
    bah: $("bah").value,
    bas: $("bas").value,
    perDiem: $("perDiem").value,
    cola: $("cola").value,
    fsa: $("fsa").value,

    tspTradPct: $("tspTradPct").value,
    tspRothPct: $("tspRothPct").value,
    childSupport: $("childSupport").value,
    insurance: $("insurance").value,
    dedOther: $("dedOther").value,
    notes: $("notes").value,

    specialPays
  };
}

function setRadio(name, value){
  if (!value) return;
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function loadProfileToUI(p){
  if (!p) return;

  $("branch").value = p.branch || "";
  $("status").value = p.status || "";
  $("rank").value = p.rank || "";
  $("filingStatus").value = p.filingStatus || "single";
  $("taxYear").value = p.taxYear || "2025";

  $("pebd").value = p.pebd || "";
  $("asOfDate").value = p.asOfDate || "";

  $("dutyZip").value = p.dutyZip || "";
  $("horZip").value = p.horZip || "";

  setRadio("dependents", p.dependents);
  setRadio("onQuarters", p.onQuarters);
  setRadio("deployed", p.deployed);

  $("depStart").value = p.depStart || "";
  $("depEnd").value = p.depEnd || "";

  $("basePay").value = p.basePay || "";
  $("bah").value = p.bah || "";
  $("bas").value = p.bas || "";
  $("perDiem").value = p.perDiem || "";
  $("cola").value = p.cola || "";
  $("fsa").value = p.fsa || "";

  $("tspTradPct").value = p.tspTradPct || "";
  $("tspRothPct").value = p.tspRothPct || "";
  $("childSupport").value = p.childSupport || "";
  $("insurance").value = p.insurance || "";
  $("dedOther").value = p.dedOther || "";
  $("notes").value = p.notes || "";

  specialPays = Array.isArray(p.specialPays) ? p.specialPays : [];
  renderSpecialPayList();

  updateZipHints();
  updateTIS();
  autoRecomputeEntitlements();
}

function saveProfile(){
  const p = getProfileFromUI();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  $("profileStatus").textContent = "Saved";
}

function loadProfile(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw){
    $("profileStatus").textContent = "No saved profile";
    return;
  }
  const p = JSON.parse(raw);
  loadProfileToUI(p);
  $("profileStatus").textContent = "Loaded";
}

function resetAll(){
  // clear form
  document.querySelectorAll("input").forEach(i => {
    if (i.type === "radio" || i.type === "checkbox") i.checked = false;
    else if (!i.disabled) i.value = "";
  });
  document.querySelectorAll("select").forEach(s => s.value = s.id === "filingStatus" ? "single" : (s.id === "taxYear" ? "2025" : ""));

  clearSpecialPays();
  $("profileStatus").textContent = "Not saved";
  $("calcBadge").textContent = "Ready";

  // clear errors/hints
  clearError($("pebd"), $("pebdError"));
  clearError($("dutyZip"), $("dutyZipError"));
  clearError($("horZip"), $("horZipError"));
  $("dutyZipHint").textContent = "Auto-detects state/city (demo ZIP dataset).";
  $("horZipHint").textContent = "Used later for residency rules (demo for now).";
  $("bahHint").textContent = "BAH depends on ZIP + rank + dependents + quarters.";
  $("explainBox").textContent = "";

  // clear result tables
  $("enteredTable").querySelector("tbody").innerHTML = "";
  $("calcTable").querySelector("tbody").innerHTML = "";
  $("kpiGross").textContent = "$0.00";
  $("kpiNet").textContent = "$0.00";
  $("kpiTaxable").textContent = "$0.00";
  $("kpiNonTaxable").textContent = "$0.00";
  $("midPay").textContent = "$0.00";
  $("endPay").textContent = "$0.00";
  $("annualGross").textContent = "$0.00";
  $("annualNet").textContent = "$0.00";
  $("annualFedTax").textContent = "$0.00";
  $("annualStateTax").textContent = "$0.00";
  $("annualLocalTax").textContent = "$0.00";

  // set asOfDate to today again
  $("asOfDate").value = new Date().toISOString().slice(0,10);
}

/* ======================
   Auto recompute entitlements on changes
====================== */

function autoRecomputeEntitlements(){
  // PEBD/TIS
  updateTIS();

  // ZIP hints
  updateZipHints();

  // BAH auto update
  const rank = $("rank").value;
  const dutyZip = $("dutyZip").value;
  const deps = getRadio("dependents") === "Yes";
  const quarters = getRadio("onQuarters");

  if (rank && dutyZip && ZIP_TO_PLACE[dutyZip]){
    const bahRes = getBahAuto({ dutyZip, rank, hasDeps: deps, onQuarters: quarters });
    if (!$("bah").value || $("bah").dataset.auto === "1"){
      $("bah").value = bahRes.amount || 0;
      $("bah").dataset.auto = "1";
    }
    $("bahHint").textContent = bahRes.reason;
  }

  // Base pay auto update
  const pebd = toDateOrNull($("pebd").value);
  const asOf = toDateOrNull($("asOfDate").value) || todayLocalDate();
  const tis = pebd ? computeTISYears(pebd, asOf) : 0;
  if (rank){
    const bp = getBasicPayFromTable(rank, tis);
    if (bp && (!$("basePay").value || $("basePay").dataset.auto === "1")){
      $("basePay").value = bp;
      $("basePay").dataset.auto = "1";
    }
  }

  // BAS auto update
  if (rank){
    const bas = getBasAuto(rank);
    if (bas && (!$("bas").value || $("bas").dataset.auto === "1")){
      $("bas").value = bas;
      $("bas").dataset.auto = "1";
    }
  }

  // FSA demo auto update (if empty or auto)
  const fsaRes = getFsaAuto();
  if (fsaRes.amount && (!$("fsa").value || $("fsa").dataset.auto === "1")){
    $("fsa").value = fsaRes.amount;
    $("fsa").dataset.auto = "1";
  } else if (!fsaRes.amount && $("fsa").dataset.auto === "1"){
    $("fsa").value = "";
  }
}

/* ======================
   Wire up
====================== */

function wire(){
  // default as-of date
  $("asOfDate").value = new Date().toISOString().slice(0,10);

  // rank dropdown
  const ranks = buildRankList();
  $("rank").innerHTML = `<option value="">— Select —</option>` + ranks.map(r => `<option>${r}</option>`).join("");

  // ZIP sanitizers
  attachZipSanitizer($("dutyZip"));
  attachZipSanitizer($("horZip"));

  // Inline validation triggers
  $("pebd").addEventListener("blur", () => { validatePEBDInline(); autoRecomputeEntitlements(); });
  $("asOfDate").addEventListener("change", () => { validatePEBDInline(); autoRecomputeEntitlements(); updateTIS(); });

  $("dutyZip").addEventListener("blur", () => {
    validateZipInline($("dutyZip"), $("dutyZipError"), "Duty Location ZIP");
    updateZipHints();
    autoRecomputeEntitlements();
  });
  $("horZip").addEventListener("blur", () => {
    validateZipInline($("horZip"), $("horZipError"), "Home of Record ZIP");
    updateZipHints();
  });

  // Recompute on key field changes
  ["branch","status","rank","filingStatus","taxYear"].forEach(id => {
    $(id).addEventListener("change", () => { autoRecomputeEntitlements(); specialPayGateHint(); });
  });
  document.querySelectorAll('input[name="dependents"], input[name="onQuarters"], input[name="deployed"]').forEach(el => {
    el.addEventListener("change", () => { autoRecomputeEntitlements(); });
  });
  ["depStart","depEnd"].forEach(id => $(id).addEventListener("change", autoRecomputeEntitlements));

  // If user edits auto-filled fields, stop auto-overwrite
  ["basePay","bah","bas","perDiem","cola","fsa"].forEach(id => {
    $(id).addEventListener("input", () => { $(id).dataset.auto = "0"; });
  });

  // Auto-fill demo
  $("btnAutoFill").addEventListener("click", () => {
    if (!validateAllInline()) return;
    autoFillDemo();
  });

  // Calculate
  $("btnCalculate").addEventListener("click", () => {
    if (!validateAllInline()) return;
    calculate();
  });

  // Save/Load/Reset
  $("btnSaveProfile").addEventListener("click", () => {
    if (!validateAllInline()) return;
    saveProfile();
  });
  $("btnLoadSaved").addEventListener("click", loadProfile);
  $("btnResetAll").addEventListener("click", resetAll);

  // Special pay logic
  $("spType").addEventListener("change", () => {
    const type = $("spType").value;
    specialPayGateHint();
    renderSpecialPayPresets(type);
    renderSpecialPayDynamicFields(type);
    autoFillSpecialPayAmount();
  });
  $("spOverride").addEventListener("change", () => {
    // if override unchecked, refill from table
    if (!$("spOverride").checked) autoFillSpecialPayAmount();
  });
  $("addSpBtn").addEventListener("click", addSpecialPay);
  $("clearSpBtn").addEventListener("click", clearSpecialPays);

  renderSpecialPayList();
  updateZipHints();
}

wire();
