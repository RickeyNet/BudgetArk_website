/* BudgetArk web calculators
   The math below is a line-for-line port of the app's utils (calculations.ts,
   chartCalculators.ts, taxCalc.ts, purchasePlanner.ts, whatIfSpending.ts,
   exchangeCalculator.ts) so results match the Charts tab. Everything runs in
   the browser; nothing typed here is sent anywhere. The only network request
   is the currency tool's on-demand rate fetch, and only when you press its
   button. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Shared math (calculations.ts)                                       */
  /* ------------------------------------------------------------------ */

  const MAX_BALANCE = 1_000_000_000;
  const MAX_PAYMENT = 1_000_000;
  const MAX_RATE = 200;
  const MAX_YEARS = 100;
  const MAX_MONTHS = MAX_YEARS * 12;

  const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
  };

  const calcInvestmentGrowth = (monthlyContribution, annualReturn, years) => {
    monthlyContribution = clamp(monthlyContribution, 0, MAX_PAYMENT);
    annualReturn = clamp(annualReturn, -MAX_RATE, MAX_RATE);
    years = clamp(years, 0, MAX_YEARS);
    if (monthlyContribution <= 0 || years <= 0) return 0;
    const monthlyRate = annualReturn / 100 / 12;
    const totalMonths = years * 12;
    if (monthlyRate === 0) return monthlyContribution * totalMonths;
    return monthlyContribution * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
  };

  const calcInvestmentTimeline = (monthlyContribution, annualReturn, years) => {
    monthlyContribution = clamp(monthlyContribution, 0, MAX_PAYMENT);
    annualReturn = clamp(annualReturn, -MAX_RATE, MAX_RATE);
    years = clamp(years, 0, MAX_YEARS);
    const timeline = [];
    for (let y = 0; y <= years; y++) {
      const total = calcInvestmentGrowth(monthlyContribution, annualReturn, y);
      const contributed = monthlyContribution * 12 * y;
      timeline.push({
        year: y,
        total: Math.round(total),
        contributed: Math.round(contributed),
        interest: Math.round(total - contributed),
      });
    }
    return timeline;
  };

  // Site-only extension of the app's growth math: a one-time amount left to
  // compound monthly with nothing added. Same monthly-rate convention.
  const calcLumpSumGrowth = (principal, annualReturn, years) => {
    principal = clamp(principal, 0, MAX_BALANCE);
    annualReturn = clamp(annualReturn, -MAX_RATE, MAX_RATE);
    years = clamp(years, 0, MAX_YEARS);
    if (principal <= 0) return 0;
    return principal * Math.pow(1 + annualReturn / 100 / 12, years * 12);
  };

  const calcPaymentForGoalDate = (balance, annualRate, monthsRemaining) => {
    balance = clamp(balance, 0, MAX_BALANCE);
    annualRate = clamp(annualRate, 0, MAX_RATE);
    monthsRemaining = clamp(monthsRemaining, 0, MAX_MONTHS);
    if (balance <= 0) return 0;
    if (monthsRemaining <= 0) return Infinity;
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0) return balance / monthsRemaining;
    const payment = (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -monthsRemaining));
    return isFinite(payment) && payment > 0 ? payment : Infinity;
  };

  const generatePayoffSchedule = (balance, annualRate, monthlyPayment) => {
    const schedule = [];
    balance = clamp(balance, 0, MAX_BALANCE);
    annualRate = clamp(annualRate, 0, MAX_RATE);
    monthlyPayment = clamp(monthlyPayment, 0, MAX_PAYMENT);
    const monthlyRate = annualRate / 100 / 12;
    let remaining = balance;
    let month = 0;
    while (remaining > 0 && month < 600) {
      month++;
      const interest = remaining * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, remaining);
      if (principal <= 0) break;
      remaining = Math.max(0, remaining - principal);
      schedule.push({ month, balance: remaining, interestPaid: interest, principalPaid: principal });
    }
    return schedule;
  };

  const getSnowballPriority = (debtClass) => {
    if (debtClass === 'house') return 2;
    if (debtClass === 'car') return 1;
    return 0;
  };

  const pickTargetDebtIndex = (debts, method) => {
    let bestIndex = -1;
    for (let i = 0; i < debts.length; i++) {
      if (debts[i].balance <= 0) continue;
      if (bestIndex === -1) { bestIndex = i; continue; }
      const current = debts[i];
      const best = debts[bestIndex];
      if (method === 'avalanche') {
        if (current.rate > best.rate) { bestIndex = i; continue; }
        if (current.rate === best.rate && current.balance < best.balance) bestIndex = i;
        continue;
      }
      const currentPriority = getSnowballPriority(current.debtClass);
      const bestPriority = getSnowballPriority(best.debtClass);
      if (currentPriority < bestPriority) { bestIndex = i; continue; }
      if (currentPriority === bestPriority && current.balance < best.balance) { bestIndex = i; continue; }
      if (currentPriority === bestPriority && current.balance === best.balance && current.rate > best.rate) bestIndex = i;
    }
    return bestIndex;
  };

  const simulatePayoffPlan = (inputDebts, method, extraMonthlyPayment = 0, maxMonths = 600) => {
    const debts = inputDebts
      .filter((d) => d.balance > 0)
      .map((d) => ({
        id: d.id,
        balance: clamp(d.balance, 0, MAX_BALANCE),
        rate: clamp(d.rate, 0, MAX_RATE),
        minPayment: clamp(d.minPayment, 0, MAX_PAYMENT),
        debtClass: d.debtClass,
      }));
    if (debts.length === 0) {
      return { method, monthsToPayoff: 0, totalInterestPaid: 0, totalPaid: 0, debtsClearedInFirstYear: 0, isPayoffPossible: true };
    }
    const effectiveExtra = clamp(extraMonthlyPayment, 0, MAX_PAYMENT);
    let totalInterestPaid = 0;
    let totalPaid = 0;
    let monthsToPayoff = 0;
    let debtsClearedInFirstYear = 0;
    for (let month = 1; month <= maxMonths; month++) {
      let beforeBalance = 0;
      let afterBalance = 0;
      debts.forEach((debt) => {
        if (debt.balance <= 0) return;
        beforeBalance += debt.balance;
        const interest = debt.balance * (debt.rate / 100 / 12);
        debt.balance += interest;
        totalInterestPaid += interest;
        const minimumPayment = Math.min(debt.minPayment, debt.balance);
        debt.balance -= minimumPayment;
        totalPaid += minimumPayment;
      });
      let extraRemaining = effectiveExtra;
      while (extraRemaining > 0) {
        const targetIndex = pickTargetDebtIndex(debts, method);
        if (targetIndex < 0) break;
        const target = debts[targetIndex];
        const extraPayment = Math.min(extraRemaining, target.balance);
        target.balance -= extraPayment;
        totalPaid += extraPayment;
        extraRemaining -= extraPayment;
        if (target.balance <= 0.000001) target.balance = 0;
      }
      debts.forEach((debt) => { if (debt.balance > 0) afterBalance += debt.balance; });
      const paidOffThisMonth = debts.filter((debt) => debt.balance === 0).length;
      if (month <= 12) debtsClearedInFirstYear = paidOffThisMonth;
      monthsToPayoff = month;
      if (debts.every((debt) => debt.balance <= 0)) {
        return { method, monthsToPayoff, totalInterestPaid, totalPaid, debtsClearedInFirstYear, isPayoffPossible: true };
      }
      if (afterBalance >= beforeBalance - 0.000001) {
        return { method, monthsToPayoff: Infinity, totalInterestPaid, totalPaid, debtsClearedInFirstYear, isPayoffPossible: false };
      }
    }
    return { method, monthsToPayoff: Infinity, totalInterestPaid, totalPaid, debtsClearedInFirstYear, isPayoffPossible: false };
  };

  /* chartCalculators.ts */

  const buildLoanYearlySummary = (schedule) =>
    Array.from({ length: Math.ceil(schedule.length / 12) }, (_, index) => {
      const chunk = schedule.slice(index * 12, index * 12 + 12);
      const payment = chunk.reduce((s, r) => s + r.principalPaid + r.interestPaid, 0);
      const principal = chunk.reduce((s, r) => s + r.principalPaid, 0);
      const interest = chunk.reduce((s, r) => s + r.interestPaid, 0);
      return { year: index + 1, payment, principal, interest, endingBalance: chunk[chunk.length - 1] ? chunk[chunk.length - 1].balance : 0 };
    });

  const summarizeLoanCosts = (schedule) => {
    const totalPaid = schedule.reduce((s, r) => s + r.principalPaid + r.interestPaid, 0);
    const totalInterest = schedule.reduce((s, r) => s + r.interestPaid, 0);
    const firstFiveYearsMonths = Math.min(60, schedule.length);
    const firstFiveYears = schedule.slice(0, firstFiveYearsMonths);
    const interestFirstFiveYears = firstFiveYears.reduce((s, r) => s + r.interestPaid, 0);
    const principalFirstFiveYears = firstFiveYears.reduce((s, r) => s + r.principalPaid, 0);
    return {
      totalPaid, totalInterest, firstFiveYearsMonths, interestFirstFiveYears, principalFirstFiveYears,
      interestFirstFiveYearsShare: totalInterest > 0 ? interestFirstFiveYears / totalInterest : 0,
    };
  };

  const calcRuleOf72Years = (annualReturnRate) => (annualReturnRate > 0 ? Math.round(72 / annualReturnRate) : 0);

  const calcRefiComparison = (input) => {
    const currentMonths = input.currentTermYears * 12;
    const newMonths = input.newTermYears * 12;
    const hasSelection = input.balance > 0;
    const currentMonthlyPayment = hasSelection ? calcPaymentForGoalDate(input.balance, input.currentRate, currentMonths) : 0;
    const newMonthlyPayment = hasSelection ? calcPaymentForGoalDate(input.balance, input.newRate, newMonths) : 0;
    const totalInterestFor = (rate, monthlyPayment) => {
      if (!hasSelection || !isFinite(monthlyPayment)) return 0;
      return generatePayoffSchedule(input.balance, rate, monthlyPayment).reduce((s, r) => s + r.interestPaid, 0);
    };
    const currentTotalInterest = totalInterestFor(input.currentRate, currentMonthlyPayment);
    const newTotalInterest = totalInterestFor(input.newRate, newMonthlyPayment);
    const monthlyDelta = currentMonthlyPayment - newMonthlyPayment;
    const interestDelta = currentTotalInterest - newTotalInterest;
    const breakEvenMonths = hasSelection && monthlyDelta > 0 ? input.closingCosts / monthlyDelta : null;
    const netSavingsOverNewTerm = monthlyDelta * newMonths - input.closingCosts;
    const extendsTerm = newMonths > currentMonths;
    return { currentMonthlyPayment, newMonthlyPayment, currentTotalInterest, newTotalInterest, monthlyDelta, interestDelta, breakEvenMonths, netSavingsOverNewTerm, extendsTerm };
  };

  const calcEmergencyFundPlan = (monthlyExpenses, currentAmount, monthlySavings) => {
    const threeMonthTarget = monthlyExpenses * 3;
    const sixMonthTarget = monthlyExpenses * 6;
    const threeMonthProgress = threeMonthTarget > 0 ? Math.min(1, currentAmount / threeMonthTarget) : 0;
    const sixMonthProgress = sixMonthTarget > 0 ? Math.min(1, currentAmount / sixMonthTarget) : 0;
    const threeMonthRemaining = Math.max(0, threeMonthTarget - currentAmount);
    const sixMonthRemaining = Math.max(0, sixMonthTarget - currentAmount);
    const monthsToThree = monthlySavings > 0 && threeMonthRemaining > 0 ? Math.ceil(threeMonthRemaining / monthlySavings) : 0;
    const monthsToSix = monthlySavings > 0 && sixMonthRemaining > 0 ? Math.ceil(sixMonthRemaining / monthlySavings) : 0;
    return { threeMonthTarget, sixMonthTarget, threeMonthProgress, sixMonthProgress, threeMonthRemaining, sixMonthRemaining, monthsToThree, monthsToSix };
  };

  /* purchasePlanner.ts */

  const calcPurchaseTimeline = (price, alreadySaved, monthlySetAside, now = new Date()) => {
    const remaining = Math.max(0, price - Math.max(0, alreadySaved));
    if (remaining <= 0) return { monthsToReady: 0, readyDate: new Date(now.getFullYear(), now.getMonth(), 1) };
    if (!Number.isFinite(monthlySetAside) || monthlySetAside <= 0) return { monthsToReady: Infinity, readyDate: null };
    const months = Math.ceil(remaining / monthlySetAside);
    return { monthsToReady: months, readyDate: new Date(now.getFullYear(), now.getMonth() + months, 1) };
  };

  const monthsUntilTarget = (targetYearMonth, now = new Date()) => {
    const match = /^(\d{4})-(\d{2})$/.exec(targetYearMonth);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) return null;
    const diff = (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
    return Math.max(1, diff);
  };

  const calcRequiredMonthly = (price, alreadySaved, targetYearMonth, now = new Date()) => {
    const months = monthsUntilTarget(targetYearMonth, now);
    if (months === null) return null;
    const remaining = Math.max(0, price - Math.max(0, alreadySaved));
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / months);
  };

  /* whatIfSpending.ts */

  const WHAT_IF_SAVINGS_YEARS = [1, 5, 10];
  const buildSavingsGrowthMarks = (monthlyAmount, annualReturnRate = 7, yearsMarks = WHAT_IF_SAVINGS_YEARS) =>
    yearsMarks.map((years) => {
      const futureValue = Math.round(calcInvestmentGrowth(monthlyAmount, annualReturnRate, years));
      const contributed = Math.round(monthlyAmount * 12 * years);
      return { years, futureValue, contributed, growth: Math.max(0, futureValue - contributed) };
    });

  const formatWhatIfMonths = (months) => {
    if (!Number.isFinite(months)) return 'Not solvable';
    if (months <= 0) return '0 months';
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years <= 0) return `${rem} mo`;
    if (rem <= 0) return `${years} yr`;
    return `${years} yr ${rem} mo`;
  };

  /* taxCalc.ts */

  const TAX = window.BUDGETARK_TAX;
  const MAX_INCOME = 1_000_000_000;
  const clampMoney = (v) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), MAX_INCOME) : 0);
  const round2 = (v) => Math.round(v * 100) / 100;

  const calcBracketTax = (taxable, brackets) => {
    const base = clampMoney(taxable);
    if (base <= 0 || brackets.length === 0) return 0;
    let tax = 0;
    for (let i = 0; i < brackets.length; i++) {
      const from = brackets[i].over;
      if (base <= from) break;
      const to = i + 1 < brackets.length ? brackets[i + 1].over : Infinity;
      tax += (Math.min(base, to) - from) * brackets[i].rate;
    }
    return round2(tax);
  };

  const marginalRateFor = (taxable, brackets) => {
    const base = clampMoney(taxable);
    if (base <= 0) return 0;
    let rate = 0;
    for (const b of brackets) if (base >= b.over) rate = b.rate;
    return rate;
  };

  const calcFICA = (ficaWages, status) => {
    const wages = clampMoney(ficaWages);
    const F = TAX.FICA_2026;
    const socialSecurity = round2(Math.min(wages, F.socialSecurityWageBase) * F.socialSecurityRate);
    const medicare = round2(wages * F.medicareRate);
    const additionalMedicare = round2(Math.max(0, wages - F.additionalMedicareThreshold[status]) * F.additionalMedicareRate);
    return { socialSecurity, medicare, additionalMedicare, total: round2(socialSecurity + medicare + additionalMedicare) };
  };

  const calcStateTax = (income, state, status) => {
    if (!state || state.type === 'none') return 0;
    const joint = status === 'marriedJoint';
    const deduction = state.standardDeduction ? (joint ? state.standardDeduction.marriedJoint : state.standardDeduction.single) : 0;
    const taxable = Math.max(0, clampMoney(income) - deduction);
    let tax = 0;
    if (state.type === 'flat') {
      tax = taxable * (state.rate || 0);
    } else if (state.brackets) {
      const brackets = joint ? state.brackets.map((b) => ({ rate: b.rate, over: b.over * 2 })) : state.brackets;
      tax = calcBracketTax(taxable, brackets);
    }
    const credit = state.taxCredit ? (joint ? state.taxCredit.marriedJoint : state.taxCredit.single) : 0;
    return round2(Math.max(0, tax - credit));
  };

  const calcTakeHome = (input) => {
    const gross = clampMoney(input.grossAnnual);
    const pct = Number.isFinite(input.retirement401kPercent) ? Math.min(Math.max(input.retirement401kPercent, 0), 100) : 0;
    const pretax401k = round2(Math.min(gross, gross * (pct / 100)));
    const pretaxCafeteria = round2(Math.min(Math.max(0, gross - pretax401k), clampMoney(input.hsaAnnual) + clampMoney(input.healthPremiumMonthly) * 12));
    const ficaWages = Math.max(0, gross - pretaxCafeteria);
    const incomeBase = Math.max(0, gross - pretax401k - pretaxCafeteria);
    const federalTaxable = Math.max(0, incomeBase - TAX.FEDERAL_STANDARD_DEDUCTION_2026[input.status]);
    const federalTax = calcBracketTax(federalTaxable, TAX.FEDERAL_BRACKETS_2026[input.status]);
    const stateTax = calcStateTax(incomeBase, TAX.findStateTax(input.stateCode), input.status);
    const fica = calcFICA(ficaWages, input.status);
    const totalTax = round2(federalTax + stateTax + fica.total);
    const takeHomeAnnual = round2(Math.max(0, gross - pretax401k - pretaxCafeteria - totalTax));
    const periods = Number.isFinite(input.payPeriodsPerYear) && input.payPeriodsPerYear >= 1 ? input.payPeriodsPerYear : 12;
    return {
      grossAnnual: gross, pretax401k, pretaxCafeteria, federalTaxable, federalTax, stateTax, fica, totalTax, takeHomeAnnual,
      takeHomePerPeriod: round2(takeHomeAnnual / periods),
      effectiveRate: gross > 0 ? totalTax / gross : 0,
      marginalFederalRate: marginalRateFor(federalTaxable, TAX.FEDERAL_BRACKETS_2026[input.status]),
    };
  };

  /* exchangeCalculator.ts */

  const EXCHANGE_CURRENCIES = [
    { code: 'USD', locale: 'en-US', label: 'US Dollar' },
    { code: 'EUR', locale: 'de-DE', label: 'Euro' },
    { code: 'GBP', locale: 'en-GB', label: 'British Pound' },
    { code: 'CAD', locale: 'en-CA', label: 'Canadian Dollar' },
    { code: 'JPY', locale: 'ja-JP', label: 'Japanese Yen' },
    { code: 'SEK', locale: 'sv-SE', label: 'Swedish Krona' },
  ];
  const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

  const crossRate = (fromCode, toCode, rates) => {
    const fromRate = rates[fromCode] != null ? rates[fromCode] : 1;
    const toRate = rates[toCode] != null ? rates[toCode] : 1;
    if (!Number.isFinite(fromRate) || fromRate <= 0) return 1;
    return toRate / fromRate;
  };

  const formatCrossRate = (rate) => {
    if (!Number.isFinite(rate) || rate <= 0) return '--';
    const decimals = rate >= 100 ? 2 : rate >= 1 ? 3 : 4;
    const fixed = rate.toFixed(decimals);
    if (decimals <= 2) return fixed;
    const [whole, frac = ''] = fixed.split('.');
    return `${whole}.${frac.replace(/0+$/, '').padEnd(2, '0')}`;
  };

  const formatAmountInCurrency = (amount, currency) => {
    try {
      return new Intl.NumberFormat(currency.locale, { style: 'currency', currency: currency.code }).format(amount);
    } catch (e) {
      return `${amount.toFixed(2)} ${currency.code}`;
    }
  };

  // Expose the pure functions for the parity test script.
  window.BUDGETARK_CALC = {
    calcInvestmentGrowth, calcInvestmentTimeline, calcLumpSumGrowth, calcPaymentForGoalDate, generatePayoffSchedule,
    simulatePayoffPlan, buildLoanYearlySummary, summarizeLoanCosts, calcRefiComparison,
    calcEmergencyFundPlan, calcPurchaseTimeline, calcRequiredMonthly, monthsUntilTarget,
    buildSavingsGrowthMarks, calcTakeHome, calcBracketTax, calcFICA, calcStateTax, crossRate, formatCrossRate,
  };

  /* ------------------------------------------------------------------ */
  /* UI helpers                                                          */
  /* ------------------------------------------------------------------ */

  if (typeof document === 'undefined' || !document.querySelector('.tools')) return;

  const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (v, cents) => (Number.isFinite(v) ? (cents ? usd2 : usd0).format(v) : '--');
  const pct = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '--');
  const monthsLabel = (m) => {
    if (!Number.isFinite(m)) return 'Never at this payment';
    if (m <= 0) return 'Now';
    const y = Math.floor(m / 12);
    const r = m % 12;
    if (y <= 0) return `${r} month${r === 1 ? '' : 's'}`;
    if (r <= 0) return `${y} year${y === 1 ? '' : 's'}`;
    return `${y} yr ${r} mo`;
  };
  const monthName = (d) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const num = (el) => {
    const v = parseFloat(el.value);
    return Number.isFinite(v) ? v : 0;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Number input + range slider pairs share a data-sync name and stay equal.
  $$('[data-sync]').forEach((el) => {
    el.addEventListener('input', () => {
      $$(`[data-sync="${el.dataset.sync}"]`).forEach((other) => {
        if (other !== el && other.value !== el.value) other.value = el.value;
      });
    });
  });

  // Replace the browser's number spinner with minus / plus buttons that
  // respect the input's step, min, and max, and hold-to-repeat like the
  // app's adjust buttons. Pointer and keyboard both work.
  $$('.field-row input[type="number"]').forEach((input) => {
    const row = input.parentElement;
    const makeStep = (dir) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'step';
      btn.dataset.dir = String(dir);
      btn.textContent = dir < 0 ? '−' : '+';
      btn.setAttribute('aria-label', (dir < 0 ? 'Decrease ' : 'Increase ') + (row.parentElement.querySelector('span') || {}).textContent);
      const nudge = () => {
        if (input.value === '') input.value = input.min || '0';
        try { dir < 0 ? input.stepDown() : input.stepUp(); } catch (e) { /* out of range or non-numeric: ignore */ }
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      let timer = null, repeat = null;
      const stop = () => { clearTimeout(timer); clearInterval(repeat); timer = repeat = null; };
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        nudge();
        timer = setTimeout(() => { repeat = setInterval(nudge, 70); }, 400);
      });
      ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => btn.addEventListener(ev, stop));
      btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nudge(); } });
      return btn;
    };
    row.appendChild(makeStep(-1));
    row.appendChild(makeStep(1));
  });

  const bind = (toolId, render) => {
    const root = document.getElementById(toolId);
    if (!root) return;
    $$('input, select', root).forEach((el) => el.addEventListener('input', () => render(root)));
    $$('button[data-action]', root).forEach((btn) => btn.addEventListener('click', () => render(root, btn.dataset.action)));
    render(root);
  };

  const tiles = (items) =>
    items.map(([label, value, cls]) => `<div class="tile"><span class="tile-label">${esc(label)}</span><strong class="tile-value ${cls || ''}">${esc(value)}</strong></div>`).join('');

  /* ---------------- Investment growth ---------------- */

  bind('tool-invest', (root) => {
    const lump = num($('[name=lump]', root));
    const monthly = num($('[name=contribution]', root));
    const rate = num($('[name=return]', root));
    const years = Math.max(0, Math.round(num($('[name=years]', root))));

    const scenarios = [];
    if (lump > 0) scenarios.push({ key: 'lump', label: 'Lump sum only', cls: 'line-lump', putIn: lump, value: (y) => calcLumpSumGrowth(lump, rate, y) });
    if (monthly > 0) scenarios.push({ key: 'monthly', label: 'Monthly only', cls: 'line-monthly', putIn: monthly * 12 * years, value: (y) => calcInvestmentGrowth(monthly, rate, y) });
    if (lump > 0 && monthly > 0) scenarios.push({ key: 'both', label: 'Both together', cls: 'line-both', putIn: lump + monthly * 12 * years, value: (y) => calcLumpSumGrowth(lump, rate, y) + calcInvestmentGrowth(monthly, rate, y) });
    scenarios.forEach((s) => { s.end = Math.round(s.value(years)); s.growth = Math.round(s.end - s.putIn); });

    const out = $('.tool-results', root);
    if (scenarios.length === 0) {
      out.innerHTML = '<p class="tool-note">Enter a starting lump sum, a monthly contribution, or both.</p>';
      return;
    }
    const single = scenarios.length === 1;
    const head = single
      ? tiles([
          [`Balance after ${years} years`, money(scenarios[0].end), 'good'],
          ['You put in', money(scenarios[0].putIn)],
          ['Growth', money(scenarios[0].growth), 'accent'],
          ['Rule of 72', rate > 0 ? `Money doubles about every ${calcRuleOf72Years(rate)} years` : 'No growth at 0%'],
        ])
      : (() => {
          const [l, m, b] = scenarios;
          const ahead = l.end >= m.end ? l : m;
          const behind = ahead === l ? m : l;
          return tiles([
            [`Lump sum only after ${years} years`, money(l.end), 'accent'],
            [`Monthly only after ${years} years`, money(m.end), 'good'],
            ['Both together', money(b.end), 'good'],
            ['Which wins alone?', `${ahead.label} by ${money(ahead.end - behind.end)}`],
          ]);
        })();
    const table = `<div class="table-wrap"><table class="calc-table"><thead><tr><th>Scenario</th><th>You put in</th><th>Growth</th><th>Ending balance</th></tr></thead><tbody>` +
      scenarios.map((s) => `<tr><td><span class="key ${s.cls}"></span> ${s.label}</td><td>${money(s.putIn)}</td><td>${money(s.growth)}</td><td><strong>${money(s.end)}</strong></td></tr>`).join('') +
      `</tbody></table></div>`;
    const crossover = (() => {
      if (scenarios.length < 3) return '';
      const [l, m] = scenarios;
      if (l.value(years) >= m.value(years)) return `<p class="tool-verdict">Over ${years} years the lump sum stays ahead of the monthly plan. The monthly plan needs ${money(l.end - m.end)} more of growth to catch up.</p>`;
      for (let y = 1; y <= years; y++) if (m.value(y) >= l.value(y)) return `<p class="tool-verdict">The monthly contributions overtake the lump sum in year ${y}, and by year ${years} they are ahead by ${money(m.end - l.end)}. Doing both ends at ${money(scenarios[2].end)}.</p>`;
      return '';
    })();
    out.innerHTML = head + chartLines(scenarios, years) + table + crossover +
      (rate > 0 && !single ? `<p class="tool-note">Rule of 72: at ${rate}% money doubles about every ${calcRuleOf72Years(rate)} years.</p>` : '');
  });

  function chartLines(scenarios, years) {
    if (years < 1) return '';
    const W = 600, H = 230, padL = 56, padR = 10, padT = 10, padB = 24;
    const max = Math.max(1, ...scenarios.map((s) => s.value(years)));
    const x = (y) => padL + ((W - padL - padR) * y) / years;
    const yy = (v) => padT + (H - padT - padB) * (1 - v / max);
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = (max * i) / 3;
      grid += `<line x1="${padL}" x2="${W - padR}" y1="${yy(v).toFixed(1)}" y2="${yy(v).toFixed(1)}" class="grid-line"/>`;
      grid += `<text x="${padL - 6}" y="${(yy(v) + 4).toFixed(1)}" text-anchor="end" class="bar-label">${usd0.format(v).replace(/,\d{3}$/, 'k').replace(/,\d{3}k$/, 'M')}</text>`;
    }
    let labels = '';
    const step = years <= 12 ? 1 : years <= 30 ? 5 : 10;
    for (let y = 0; y <= years; y += step) labels += `<text x="${x(y).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="bar-label">${y}</text>`;
    const lines = scenarios.map((s) => {
      const pts = [];
      for (let y = 0; y <= years; y++) pts.push(`${x(y).toFixed(1)},${yy(s.value(y)).toFixed(1)}`);
      return `<polyline points="${pts.join(' ')}" class="${s.cls}" fill="none" stroke-width="3" stroke-linejoin="round"/>`;
    }).join('');
    const legend = scenarios.map((s) => `<span class="key ${s.cls}"></span> ${s.label}`).join(' ');
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Balance by year for each scenario">${grid}${labels}${lines}</svg>
      <figcaption>${legend}</figcaption></figure>`;
  }

  /* ---------------- Loan / mortgage ---------------- */

  const renderLoan = (root) => {
    const amount = num($('[name=amount]', root));
    const rate = num($('[name=rate]', root));
    const term = Math.max(1, Math.round(num($('[name=term]', root))));
    const payment = calcPaymentForGoalDate(amount, rate, term * 12);
    const schedule = isFinite(payment) ? generatePayoffSchedule(amount, rate, payment) : [];
    const yearly = buildLoanYearlySummary(schedule);
    const costs = summarizeLoanCosts(schedule);
    const showAll = root.dataset.showAll === 'true';
    const rowsToShow = showAll ? yearly : yearly.slice(0, 5);
    const table = yearly.length
      ? `<div class="table-wrap"><table class="calc-table"><thead><tr><th>Year</th><th>Paid</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody>` +
        rowsToShow.map((r) => `<tr><td>${r.year}</td><td>${money(r.payment)}</td><td>${money(r.principal)}</td><td>${money(r.interest)}</td><td>${money(r.endingBalance)}</td></tr>`).join('') +
        `</tbody></table></div>` +
        (yearly.length > 5 ? `<button type="button" class="btn btn-ghost btn-small-ghost" data-action="${showAll ? 'show-less' : 'show-all'}">${showAll ? 'Show first 5 years' : `Show all ${yearly.length} years`}</button>` : '')
      : '';
    $('.tool-results', root).innerHTML =
      tiles([
        ['Monthly payment', money(payment, true), 'good'],
        ['Total paid', money(costs.totalPaid)],
        ['Total interest', money(costs.totalInterest), 'warn'],
        ['Interest in first 5 years', `${money(costs.interestFirstFiveYears)} (${pct(costs.interestFirstFiveYearsShare, 0)} of all interest)`],
      ]) + table;
    $$('button[data-action]', $('.tool-results', root)).forEach((btn) => {
      btn.addEventListener('click', () => {
        root.dataset.showAll = btn.dataset.action === 'show-all' ? 'true' : 'false';
        renderLoan(root);
      });
    });
  };
  bind('tool-loan', renderLoan);

  /* ---------------- Refinance ---------------- */

  bind('tool-refi', (root) => {
    const r = calcRefiComparison({
      balance: num($('[name=balance]', root)),
      currentRate: num($('[name=currentRate]', root)),
      currentTermYears: Math.max(1, num($('[name=currentTerm]', root))),
      newRate: num($('[name=newRate]', root)),
      newTermYears: Math.max(1, num($('[name=newTerm]', root))),
      closingCosts: num($('[name=closing]', root)),
    });
    let verdict;
    if (r.monthlyDelta <= 0) verdict = 'The new loan does not lower your monthly payment, so closing costs are never recovered.';
    else if (r.breakEvenMonths !== null) verdict = `You recover the closing costs in about ${monthsLabel(Math.ceil(r.breakEvenMonths))}. Refinancing pays off if you keep the loan longer than that.`;
    else verdict = '';
    const note = r.extendsTerm ? '<p class="tool-note">Heads up: the new loan runs longer than what is left on the current one. A lower payment can still mean more total interest.</p>' : '';
    $('.tool-results', root).innerHTML =
      tiles([
        ['Current payment', money(r.currentMonthlyPayment, true)],
        ['New payment', money(r.newMonthlyPayment, true), 'good'],
        ['Monthly change', (r.monthlyDelta >= 0 ? '-' : '+') + money(Math.abs(r.monthlyDelta), true), r.monthlyDelta >= 0 ? 'good' : 'warn'],
        ['Break-even', r.breakEvenMonths === null ? 'Never' : monthsLabel(Math.ceil(r.breakEvenMonths)), r.breakEvenMonths === null ? 'warn' : ''],
        ['Interest, current loan', money(r.currentTotalInterest)],
        ['Interest, new loan', money(r.newTotalInterest)],
        ['Interest saved', (r.interestDelta >= 0 ? '' : '-') + money(Math.abs(r.interestDelta)), r.interestDelta >= 0 ? 'good' : 'warn'],
        ['Net over the new term', (r.netSavingsOverNewTerm >= 0 ? '' : '-') + money(Math.abs(r.netSavingsOverNewTerm)), r.netSavingsOverNewTerm >= 0 ? 'good' : 'warn'],
      ]) + `<p class="tool-verdict">${esc(verdict)}</p>` + note;
  });

  /* ---------------- Debt payoff ---------------- */

  const debtRows = () => $$('#debt-rows tr');
  const readDebts = () =>
    debtRows().map((tr, i) => ({
      id: String(i),
      name: $('[name=dname]', tr).value || `Debt ${i + 1}`,
      balance: num($('[name=dbalance]', tr)),
      rate: num($('[name=drate]', tr)),
      minPayment: num($('[name=dmin]', tr)),
      debtClass: $('[name=dclass]', tr).value || undefined,
    }));

  const addDebtRow = (d = {}) => {
    const tbody = $('#debt-rows');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" name="dname" value="${esc(d.name || '')}" placeholder="Card, car, loan..." aria-label="Debt name"></td>
      <td><input type="number" name="dbalance" min="0" step="100" value="${d.balance != null ? d.balance : ''}" aria-label="Balance"></td>
      <td><input type="number" name="drate" min="0" max="200" step="0.1" value="${d.rate != null ? d.rate : ''}" aria-label="APR percent"></td>
      <td><input type="number" name="dmin" min="0" step="10" value="${d.minPayment != null ? d.minPayment : ''}" aria-label="Minimum payment"></td>
      <td><select name="dclass" aria-label="Type"><option value="">Other</option><option value="car"${d.debtClass === 'car' ? ' selected' : ''}>Car</option><option value="house"${d.debtClass === 'house' ? ' selected' : ''}>House</option></select></td>
      <td><button type="button" class="row-remove" aria-label="Remove debt">×</button></td>`;
    tbody.appendChild(tr);
    $$('input, select', tr).forEach((el) => el.addEventListener('input', renderPayoff));
    $('.row-remove', tr).addEventListener('click', () => { tr.remove(); renderPayoff(); });
  };

  const renderPayoff = () => {
    const root = document.getElementById('tool-payoff');
    if (!root) return;
    const debts = readDebts().filter((d) => d.balance > 0);
    const extra = num($('[name=extra]', root));
    const method = $('[name=method]:checked', root).value;
    const plan = simulatePayoffPlan(debts, method, extra);
    const base = simulatePayoffPlan(debts, method, 0);
    const other = simulatePayoffPlan(debts, method === 'avalanche' ? 'snowball' : 'avalanche', extra);
    const mins = debts.reduce((s, d) => s + d.minPayment, 0);
    const out = $('.tool-results', root);
    if (debts.length === 0) {
      out.innerHTML = '<p class="tool-note">Add at least one debt with a balance to see a payoff plan.</p>';
      return;
    }
    const compare = plan.isPayoffPossible && other.isPayoffPossible
      ? `<p class="tool-verdict">${method === 'avalanche' ? 'Snowball' : 'Avalanche'} instead: ${monthsLabel(other.monthsToPayoff)} and ${money(other.totalInterestPaid)} in interest${
          Math.abs(other.totalInterestPaid - plan.totalInterestPaid) < 1 ? ' (same result)' : other.totalInterestPaid > plan.totalInterestPaid ? ` (${money(other.totalInterestPaid - plan.totalInterestPaid)} more)` : ` (${money(plan.totalInterestPaid - other.totalInterestPaid)} less)`}.</p>`
      : '';
    const extraLine = extra > 0 && base.isPayoffPossible && plan.isPayoffPossible
      ? `<p class="tool-verdict">The extra ${money(extra)} a month saves ${money(base.totalInterestPaid - plan.totalInterestPaid)} in interest and ${monthsLabel(base.monthsToPayoff - plan.monthsToPayoff)}.</p>`
      : '';
    out.innerHTML =
      tiles([
        ['Debt-free in', monthsLabel(plan.monthsToPayoff), plan.isPayoffPossible ? 'good' : 'warn'],
        ['Total interest', money(plan.totalInterestPaid), 'warn'],
        ['Total paid', money(plan.totalPaid)],
        ['Monthly outlay', `${money(mins + extra)} (${money(mins)} minimums + ${money(extra)} extra)`],
      ]) + (plan.isPayoffPossible ? extraLine + compare : '<p class="tool-note">The minimum payments do not cover the monthly interest, so the balance never shrinks. Raise a minimum or add an extra payment.</p>');
    // What-if tool can redirect a spending cut here
    renderWhatIf();
  };

  (function initPayoff() {
    const root = document.getElementById('tool-payoff');
    if (!root) return;
    [
      { name: 'Credit card', balance: 4200, rate: 24.99, minPayment: 120 },
      { name: 'Car loan', balance: 11500, rate: 6.9, minPayment: 285, debtClass: 'car' },
      { name: 'Student loan', balance: 18000, rate: 5.5, minPayment: 190 },
    ].forEach(addDebtRow);
    $('#debt-add').addEventListener('click', () => { addDebtRow(); renderPayoff(); });
    $$('[name=extra], [name=method]', root).forEach((el) => el.addEventListener('input', renderPayoff));
    renderPayoff();
  })();

  /* ---------------- Take-home pay ---------------- */

  (function initTax() {
    const root = document.getElementById('tool-takehome');
    if (!root) return;
    const stateSel = $('[name=state]', root);
    stateSel.innerHTML = '<option value="">No state tax / not listed</option>' +
      TAX.STATE_TAX_2026.map((s) => `<option value="${s.code}">${esc(s.name)}</option>`).join('');
    $('[name=status]', root).innerHTML = TAX.FILING_STATUS_OPTIONS.map((o) => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
    $('.tax-year', root).textContent = TAX.TAX_DATA_YEAR;
  })();

  bind('tool-takehome', (root) => {
    const r = calcTakeHome({
      grossAnnual: num($('[name=gross]', root)),
      status: $('[name=status]', root).value,
      stateCode: $('[name=state]', root).value,
      retirement401kPercent: num($('[name=k401]', root)),
      hsaAnnual: num($('[name=hsa]', root)),
      healthPremiumMonthly: num($('[name=premium]', root)),
      payPeriodsPerYear: num($('[name=periods]', root)),
    });
    const periodLabel = { 52: 'week', 26: 'two weeks', 24: 'half month', 12: 'month' }[String(num($('[name=periods]', root)))] || 'period';
    const state = TAX.findStateTax($('[name=state]', root).value);
    const rows = [
      ['Gross pay', r.grossAnnual],
      ['401(k), pre-tax', -r.pretax401k],
      ['HSA + health premiums, pre-tax', -r.pretaxCafeteria],
      ['Federal income tax', -r.federalTax],
      ['State income tax', -r.stateTax],
      ['Social Security', -r.fica.socialSecurity],
      ['Medicare', -(r.fica.medicare + r.fica.additionalMedicare)],
      ['Take-home pay', r.takeHomeAnnual],
    ];
    $('.tool-results', root).innerHTML =
      tiles([
        [`Take-home per ${periodLabel}`, money(r.takeHomePerPeriod, true), 'good'],
        ['Take-home per year', money(r.takeHomeAnnual)],
        ['Effective tax rate', pct(r.effectiveRate)],
        ['Federal marginal bracket', pct(r.marginalFederalRate, 0)],
      ]) +
      `<div class="table-wrap"><table class="calc-table"><tbody>` +
      rows.map(([k, v], i) => `<tr${i === rows.length - 1 ? ' class="total"' : ''}><td>${esc(k)}</td><td>${v < 0 ? '-' : ''}${money(Math.abs(v), true)}</td></tr>`).join('') +
      `</tbody></table></div>` +
      (state && state.note ? `<p class="tool-note">${esc(state.note)}</p>` : '');
  });

  /* ---------------- Emergency fund ---------------- */

  bind('tool-efund', (root) => {
    const p = calcEmergencyFundPlan(num($('[name=expenses]', root)), num($('[name=current]', root)), num($('[name=savings]', root)));
    const bar = (label, target, progress, remaining, months) => `
      <div class="ef-row">
        <div class="ef-head"><strong>${label}</strong><span>${money(target)}</span></div>
        <div class="mock-bar ef-bar"><div class="mock-fill goal" style="width:${(progress * 100).toFixed(1)}%"></div></div>
        <div class="ef-foot">${remaining <= 0 ? 'Funded' : `${money(remaining)} to go${months > 0 ? ` · about ${monthsLabel(months)}` : ''}`}</div>
      </div>`;
    $('.tool-results', root).innerHTML =
      bar('Starter cushion: 3 months', p.threeMonthTarget, p.threeMonthProgress, p.threeMonthRemaining, p.monthsToThree) +
      bar('Full fund: 6 months', p.sixMonthTarget, p.sixMonthProgress, p.sixMonthRemaining, p.monthsToSix);
  });

  /* ---------------- Plan a purchase ---------------- */

  bind('tool-purchase', (root) => {
    const price = num($('[name=price]', root));
    const saved = num($('[name=saved]', root));
    const mode = $('[name=pmode]:checked', root).value;
    $$('.pmode-monthly', root).forEach((el) => (el.hidden = mode !== 'monthly'));
    $$('.pmode-date', root).forEach((el) => (el.hidden = mode !== 'date'));
    let html;
    if (mode === 'monthly') {
      const monthly = num($('[name=monthly]', root));
      const t = calcPurchaseTimeline(price, saved, monthly);
      html = tiles([
        ['Ready in', monthsLabel(t.monthsToReady), Number.isFinite(t.monthsToReady) ? 'good' : 'warn'],
        ['Ready by', t.readyDate ? monthName(t.readyDate) : 'Set a monthly amount'],
        ['Still to save', money(Math.max(0, price - saved))],
      ]);
    } else {
      const target = $('[name=needby]', root).value;
      const req = calcRequiredMonthly(price, saved, target);
      html = tiles([
        ['Set aside each month', req === null ? 'Pick a month' : money(req), req === null ? '' : 'good'],
        ['Months until then', req === null ? '--' : String(monthsUntilTarget(target))],
        ['Still to save', money(Math.max(0, price - saved))],
      ]);
    }
    $('.tool-results', root).innerHTML = html + '<p class="tool-note">A sinking fund sets money aside every month so the purchase is paid in cash and never has to become debt.</p>';
  });

  /* ---------------- What if I stopped spending on... ---------------- */

  function renderWhatIf() {
    const root = document.getElementById('tool-whatif');
    if (!root) return;
    const amount = num($('[name=wamount]', root));
    const rate = num($('[name=wrate]', root));
    const marks = buildSavingsGrowthMarks(amount, rate);
    const debts = readDebts().filter((d) => d.balance > 0);
    let debtHtml = '';
    if (debts.length && amount > 0) {
      const method = $('#tool-payoff [name=method]:checked').value;
      const baseline = simulatePayoffPlan(debts, method, 0);
      const redirect = simulatePayoffPlan(debts, method, amount);
      const monthsSaved = baseline.isPayoffPossible && redirect.isPayoffPossible ? Math.max(0, baseline.monthsToPayoff - redirect.monthsToPayoff) : (!baseline.isPayoffPossible && redirect.isPayoffPossible ? Infinity : 0);
      const interestSaved = baseline.isPayoffPossible ? Math.max(0, baseline.totalInterestPaid - redirect.totalInterestPaid) : 0;
      debtHtml = `<h4>Or throw it at the debts above</h4>` + tiles([
        ['Debt-free sooner by', Number.isFinite(monthsSaved) ? formatWhatIfMonths(monthsSaved) : 'Makes payoff possible', 'good'],
        ['Interest saved', money(interestSaved), 'accent'],
        ['Debt-free in', monthsLabel(redirect.monthsToPayoff)],
      ]);
    }
    $('.tool-results', root).innerHTML =
      `<h4>Invested at ${rate}%</h4>` +
      `<div class="table-wrap"><table class="calc-table"><thead><tr><th>After</th><th>You put in</th><th>Growth</th><th>Worth</th></tr></thead><tbody>` +
      marks.map((m) => `<tr><td>${m.years} yr</td><td>${money(m.contributed)}</td><td>${money(m.growth)}</td><td><strong>${money(m.futureValue)}</strong></td></tr>`).join('') +
      `</tbody></table></div>` + debtHtml;
  }
  (function () {
    const root = document.getElementById('tool-whatif');
    if (!root) return;
    $$('input', root).forEach((el) => el.addEventListener('input', renderWhatIf));
    renderWhatIf();
  })();

  /* ---------------- Currency exchange ---------------- */

  (function initFx() {
    const root = document.getElementById('tool-fx');
    if (!root) return;
    const from = $('[name=from]', root);
    const to = $('[name=to]', root);
    const opts = EXCHANGE_CURRENCIES.map((c) => `<option value="${c.code}">${c.code} - ${esc(c.label)}</option>`).join('');
    from.innerHTML = opts; to.innerHTML = opts;
    from.value = 'USD'; to.value = 'EUR';
    let snapshot = null;
    const status = $('.fx-status', root);
    const render = () => {
      const amount = num($('[name=famount]', root));
      const f = EXCHANGE_CURRENCIES.find((c) => c.code === from.value);
      const t = EXCHANGE_CURRENCIES.find((c) => c.code === to.value);
      if (!snapshot) {
        $('.tool-results', root).innerHTML = '<p class="tool-note">Press "Get today\'s rates" to convert. That sends one request to open.er-api.com for the public rate table, nothing else.</p>';
        return;
      }
      const rate = crossRate(f.code, t.code, snapshot.rates);
      $('.tool-results', root).innerHTML = tiles([
        [`${money(amount, true).replace('$', '')} ${f.code} is`, formatAmountInCurrency(amount * rate, t), 'good'],
        ['Rate', `1 ${f.code} = ${formatCrossRate(rate)} ${t.code}`],
        ['Reverse', `1 ${t.code} = ${formatCrossRate(crossRate(t.code, f.code, snapshot.rates))} ${f.code}`],
      ]);
    };
    $$('input, select', root).forEach((el) => el.addEventListener('input', render));
    $('#fx-fetch').addEventListener('click', async () => {
      status.textContent = 'Fetching rates...';
      try {
        const res = await fetch(RATES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !data.rates) throw new Error('Unexpected response');
        snapshot = { rates: data.rates, fetchedAt: new Date() };
        status.textContent = `Rates from ${snapshot.fetchedAt.toLocaleTimeString()} via open.er-api.com`;
      } catch (e) {
        status.textContent = 'Could not reach the rate service. Try again in a moment.';
      }
      render();
    });
    $('#fx-swap').addEventListener('click', () => { const a = from.value; from.value = to.value; to.value = a; render(); });
    render();
  })();
})();
