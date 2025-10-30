// app.js — Budget Terminal (v3.4)

(() => {
  // ========== Utils ==========
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmtMoney = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const clampNum = (n) => Number.isFinite(n) ? n : 0;

  // Debounce helper
  function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  }

  // Parse currency-ish input element -> number
  function parseMoney(el) {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  }

  // Set status pill class & label
  function setBadge(el, level) {
    // level: 'success' | 'warning' | 'danger'
    el.classList.remove('success', 'warning', 'danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  }

  // Today's date in header
  function setToday() {
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // Select all text in an input when focused
  function enableSelectOnFocus(el) {
    if (!el) return;
    el.addEventListener('focus', () => {
      // Clear a literal "0" quickly, otherwise just select contents
      const v = el.value.trim();
      if (v === '0' || v === '0.00') {
        el.value = '';
      } else {
        // Delay selection to ensure iOS focuses first
        setTimeout(() => el.select(), 0);
      }
    });
  }

  // ========== Tabs ==========
  const panes = {
    quick: $('#tab-quick'),
    bills: $('#tab-bills'),
  };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive: true });
  });

  // ========== Storage ==========
  const KEY = 'bt.bills.v1';

  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const _saveBills = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const saveBillsDebounced = debounce(_saveBills, 200);

  // ========== Elements ==========
  // Quick Check
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // Cadence summary
  const cadenceLine  = $('#cadenceLine');   // label
  const cadenceEarly = $('#cadenceEarly');  // By 1st
  const cadenceLate  = $('#cadenceLate');   // By 15th

  // Bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const resetAllBtn  = $('#resetAllBtn');

  // Print
  const printCalBtn = $('#printCalBtn');
  const calSheetEl  = $('#calSheet');

  // ========== State ==========
  let bills = loadBills();

  // ========== Cadence compute ==========
  function updateCadence() {
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;

    const toNum = (x) => Number.isFinite(+x) ? +x : 0;

    const early = bills
      .filter(b => !b.paid && (toNum(b.due) <= 15))
      .reduce((sum, b) => sum + (toNum(b.amount)), 0);

    const late = bills
      .filter(b => !b.paid && (toNum(b.due) > 15))
      .reduce((sum, b) => sum + (toNum(b.amount)), 0);

    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmtMoney.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmtMoney.format(late)}`;
  }

  // ========== KPIs / Calculator ==========
  function calc() {
    // Sum unpaid
    const totalUnpaid = bills.reduce(
      (sum, b) => sum + (!b.paid ? (Number.isFinite(+b.amount) ? +b.amount : 0) : 0),
      0
    );
    totalUnpaidEl.textContent = fmtMoney.format(clampNum(totalUnpaid));

    const bal  = clampNum(parseMoney(balanceEl));
    const buy  = clampNum(parseMoney(purchaseEl));
    const left = clampNum(bal - totalUnpaid);
    const after = clampNum(left - buy);

    leftAfterEl.textContent = fmtMoney.format(left);
    afterBuyEl.textContent  = fmtMoney.format(after);

    // Badges
    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0)       setBadge(buyBadge, 'danger');   // not covered anyway
    else if (after < 0) setBadge(buyBadge, 'warning');  // covered now, purchase would break it
    else                setBadge(buyBadge, 'success');  // safe to buy

    updateCadence();
  }

  // ========== Table row binding ==========
  function bindRow(tr, bill) {
    const name = $('.b-name', tr);
    const due  = $('.b-due', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    // Set current values
    name.value = bill.name || '';
    due.value  = bill.due  ?? '';
    amt.value  = (bill.amount != null && bill.amount !== '') ? bill.amount : '';

    // Select-on-focus for easier edits
    [name, due, amt].forEach(enableSelectOnFocus);

    // Debounced update/save
    const update = debounce(() => {
      bill.name   = name.value.trim();
      bill.due    = parseInt((due.value || '').replace(/[^\d-]/g, ''), 10) || '';
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBillsDebounced(bills);
      calc();
    }, 120);

    name.addEventListener('input', update);
    due.addEventListener('input', update);
    amt.addEventListener('input', update);
    paid.addEventListener('change', update);

    del.addEventListener('click', () => {
      const ok = confirm(`Delete "${name.value || 'this bill'}"?`);
      if (!ok) return;
      bills = bills.filter(b => b !== bill);
      _saveBills(bills);
      render();
      calc();
    });
  }

  // ========== Render table ==========
  function render() {
    tbody.innerHTML = '';
    bills
      .sort((a, b) => ((a.due || 99) - (b.due || 99)))
      .forEach(bill => {
        const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(tr, bill);
        tbody.appendChild(tr);
      });
  }

  // ========== Actions ==========
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name: '', due: '', amount: 0, paid: false });
    _saveBills(bills);
    render();
    calc();
  });

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    _saveBills(bills);
    render();
    calc();
  });

  resetAllBtn?.addEventListener('click', () => {
    const ok1 = confirm('Reset all data? This clears your saved bills.');
    if (!ok1) return;
    const ok2 = confirm('Really reset EVERYTHING? This cannot be undone.');
    if (!ok2) return;
    bills = [];
    _saveBills(bills);
    render();
    calc();
  });

  // Inputs recalc (instant)
  balanceEl?.addEventListener('input',  calc);
  purchaseEl?.addEventListener('input', calc);

  // Also select-on-focus for quick inputs
  enableSelectOnFocus(balanceEl);
  enableSelectOnFocus(purchaseEl);

  // ========== Printable calendar ==========
  function buildCalendarSheet(targetEl, date = new Date(), billsForMonth = []) {
    const y  = date.getFullYear();
    const m  = date.getMonth();
    const first = new Date(y, m, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthName = date.toLocaleString('en-US', { month: 'long' });

    // Map due-day -> bills[]
    const byDay = new Map();
    billsForMonth.forEach(b => {
      const d = parseInt(b.due, 10);
      if (Number.isFinite(d) && d >= 1 && d <= daysInMonth) {
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d).push(b);
      }
    });

    const wrap = document.createElement('div');
    wrap.className = 'cal';
    wrap.innerHTML = `
      <div class="cal__hdr">
        <div class="cal__yr cal__yr--left">${y}</div>
        <div class="cal__month">${monthName.toUpperCase()}</div>
        <div class="cal__yr cal__yr--right">${y}</div>
      </div>
      <div class="cal__wk">
        <div>SUN</div><div>MON</div><div>TUE</div><div>WED</div>
        <div>THU</div><div>FRI</div><div>SAT</div>
      </div>
      <div class="cal__grid"></div>
    `;

    const grid = wrap.querySelector('.cal__grid');

    // Empty cells before day 1
    for (let i = 0; i < startWeekday; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell';
      grid.appendChild(cell);
    }

    const short = (s, n = 24) => (s || '').length > n ? s.slice(0, n - 1) + '…' : (s || '');

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell';

      const num = document.createElement('div');
      num.className = 'cal__num';
      num.textContent = d;
      if ((startWeekday + d - 1) % 7 === 0) num.classList.add('cal__num--accent'); // Sundays

      const list = document.createElement('div');
      list.className = 'cal__list';

      (byDay.get(d) || [])
        .sort((a, b) => (a.paid === b.paid ? (+b.amount || 0) - (+a.amount || 0) : (a.paid ? 1 : -1)))
        .forEach(b => {
          const item = document.createElement('div');
          item.className = 'cal__item ' + (b.paid ? 'cal__item--paid' : 'cal__item--due');
          const amt = Number.isFinite(+b.amount) ? `$${fmtMoney.format(+b.amount)}` : '';
          item.textContent = short(`${b.name || 'Bill'} — ${amt}`);
          list.appendChild(item);
        });

      cell.appendChild(num);
      cell.appendChild(list);
      grid.appendChild(cell);
    }

    targetEl.innerHTML = '';
    targetEl.appendChild(wrap);
  }

  // Print flow: build calendar, show only the calendar, print, then restore UI
  printCalBtn?.addEventListener('click', () => {
    if (!calSheetEl) return;
    buildCalendarSheet(calSheetEl, new Date(), bills);
    document.body.classList.add('print-mode');
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('print-mode'), 300);
    });
  });

  // ========== Init ==========
  setToday();
  render();
  calc();

  // ========== PWA (optional) ==========
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
