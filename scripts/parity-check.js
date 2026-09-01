/* Parity check: compares js/calculators.js against the app's own math.
   1. In the app repo, compile the utils to plain JS:
        node_modules/.bin/tsc --ignoreConfig --outDir /tmp/tsout --module commonjs --target es2020 \
          --moduleResolution node --esModuleInterop --skipLibCheck --jsx react-native --types node \
          src/utils/calculations.ts src/utils/chartCalculators.ts src/utils/taxCalc.ts \
          src/utils/purchasePlanner.ts src/utils/whatIfSpending.ts src/utils/exchangeCalculator.ts
   2. From this repo:  node scripts/parity-check.js /tmp/tsout
   Exits non-zero on any mismatch. Run it whenever the app changes a formula. */
const fs = require('fs');
const S = process.argv[2];
// Site code: evaluate with a fake window and no document (UI section returns early)
const w = {};
new Function('window', fs.readFileSync('js/tax-data-2026.js', 'utf8'))(w);
new Function('window', fs.readFileSync('js/calculators.js', 'utf8'))(w);
const site = w.BUDGETARK_CALC;
// App code: compiled TypeScript
const calc = require(S + '/tsout/utils/calculations.js');
const chart = require(S + '/tsout/utils/chartCalculators.js');
const tax = require(S + '/tsout/utils/taxCalc.ts'.replace('.ts', '.js'));
const pp = require(S + '/tsout/utils/purchasePlanner.js');
const wi = require(S + '/tsout/utils/whatIfSpending.js');
const fx = require(S + '/tsout/utils/exchangeCalculator.js');
let checks = 0, fails = 0;
const same = (label, a, b) => {
  checks++;
  const sa = JSON.stringify(a, (k, v) => (v === Infinity ? 'Inf' : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
  const sb = JSON.stringify(b, (k, v) => (v === Infinity ? 'Inf' : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
  if (sa !== sb) { fails++; if (fails <= 8) console.log('MISMATCH', label, '\n site:', sa.slice(0, 200), '\n app: ', sb.slice(0, 200)); }
};
for (const m of [0, 50, 500, 2500]) for (const r of [-5, 0, 4, 7, 12]) for (const y of [0, 1, 10, 30]) {
  same(`growth ${m} ${r} ${y}`, site.calcInvestmentGrowth(m, r, y), calc.calcInvestmentGrowth(m, r, y));
  same(`timeline ${m} ${r} ${y}`, site.calcInvestmentTimeline(m, r, y), calc.calcInvestmentTimeline(m, r, y));
  same(`marks ${m} ${r}`, site.buildSavingsGrowthMarks(m, r), wi.buildSavingsGrowthMarks(m, r));
}
for (const b of [0, 1000, 25000, 300000]) for (const r of [0, 3.5, 6.5, 24.99]) for (const n of [0, 12, 60, 360]) {
  const p1 = site.calcPaymentForGoalDate(b, r, n), p2 = calc.calcPaymentForGoalDate(b, r, n);
  same(`payment ${b} ${r} ${n}`, p1, p2);
  if (isFinite(p1)) {
    const s1 = site.generatePayoffSchedule(b, r, p1), s2 = calc.generatePayoffSchedule(b, r, p2);
    same(`schedule ${b} ${r} ${n}`, s1, s2);
    same(`yearly ${b} ${r} ${n}`, site.buildLoanYearlySummary(s1), chart.buildLoanYearlySummary(s2));
    same(`costs ${b} ${r} ${n}`, site.summarizeLoanCosts(s1), chart.summarizeLoanCosts(s2));
  }
}
for (const input of [
  { balance: 280000, currentRate: 7.25, currentTermYears: 28, newRate: 5.5, newTermYears: 30, closingCosts: 4000 },
  { balance: 150000, currentRate: 4, currentTermYears: 10, newRate: 6, newTermYears: 15, closingCosts: 2500 },
  { balance: 0, currentRate: 7, currentTermYears: 30, newRate: 5, newTermYears: 30, closingCosts: 1000 },
]) same('refi ' + JSON.stringify(input), site.calcRefiComparison(input), chart.calcRefiComparison(input));
const debtSets = [
  [{ id: 'a', balance: 4200, rate: 24.99, minPayment: 120 }, { id: 'b', balance: 11500, rate: 6.9, minPayment: 285, debtClass: 'car' }, { id: 'c', balance: 18000, rate: 5.5, minPayment: 190 }],
  [{ id: 'a', balance: 5000, rate: 30, minPayment: 50 }],
  [{ id: 'a', balance: 1000, rate: 10, minPayment: 100 }, { id: 'b', balance: 1000, rate: 20, minPayment: 100 }, { id: 'h', balance: 200000, rate: 6, minPayment: 1200, debtClass: 'house' }],
  [],
];
for (const d of debtSets) for (const m of ['avalanche', 'snowball']) for (const x of [0, 200, 1000])
  same(`payoff ${m} ${x} ${d.length}`, site.simulatePayoffPlan(d.map((q) => ({ ...q })), m, x), calc.simulatePayoffPlan(d.map((q) => ({ ...q })), m, x));
for (const e of [0, 3200]) for (const c of [0, 2500, 25000]) for (const s of [0, 500])
  same(`efund ${e} ${c} ${s}`, site.calcEmergencyFundPlan(e, c, s), chart.calcEmergencyFundPlan(e, c, s));
const now = new Date(2026, 8, 1);
for (const p of [2400, 0]) for (const sv of [0, 400, 5000]) for (const m of [0, 200]) {
  same(`purchase ${p} ${sv} ${m}`, site.calcPurchaseTimeline(p, sv, m, now), pp.calcPurchaseTimeline(p, sv, m, now));
  for (const t of ['2026-12', '2027-06', 'bad']) same(`required ${p} ${sv} ${t}`, site.calcRequiredMonthly(p, sv, t, now), pp.calcRequiredMonthly(p, sv, t, now));
}
const states = ['', 'CA', 'TX', 'NY', 'UT', 'OH', 'MD', 'OR', 'WI', 'MA', 'MO', 'AL'];
for (const g of [0, 12000, 48000, 75000, 150000, 260000, 700000]) for (const st of ['single', 'marriedJoint', 'marriedSeparate', 'headOfHousehold']) for (const sc of states) for (const k of [0, 6]) for (const hsa of [0, 3000]) {
  const input = { grossAnnual: g, status: st, stateCode: sc, retirement401kPercent: k, hsaAnnual: hsa, healthPremiumMonthly: 150, payPeriodsPerYear: 26 };
  same(`takehome ${g} ${st} ${sc} ${k} ${hsa}`, site.calcTakeHome(input), tax.calcTakeHome(input));
}
const rates = { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, JPY: 149.5, SEK: 10.4 };
for (const a of Object.keys(rates)) for (const b of Object.keys(rates)) {
  same(`fx ${a} ${b}`, site.crossRate(a, b, rates), fx.crossRate(a, b, rates));
  same(`fxfmt ${a} ${b}`, site.formatCrossRate(site.crossRate(a, b, rates)), fx.formatCrossRate(fx.crossRate(a, b, rates)));
}
console.log(`parity: ${checks} checks, ${fails} mismatches`);
process.exit(fails ? 1 : 0);
