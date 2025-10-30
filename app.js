// app.js — Budget Terminal (v3.3)

(() => {
  // ---------- utils ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  // Show today's date in the header
  function setToday() {
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  // ---------- splash ----------
  const splash = $('#splash');
  const main   = $('#main');
  setTimeout(() => {
    if (splash) splash.classList.add('hidden');
    if (main)   main.classList.remove('hidden');
  }, 3000); // 3 seconds

  // ---------- tabs ----------
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive: true });
  });

  // ---------- storage ----------
  const KEY = 'bt.bills.v1';
  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const saveBills = (b) => localStorage.setItem(KEY, JSON.stringify(b));

  // ---------- elements ----------
  // Quick Check
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // Cadence summary (1st vs 15th)
  const cadenceLine  = $('#cadenceLine');
  const cadenceEarly = $('#cadenceEarly');
  const cadenceLate  = $('#cadenceLate');

  // Bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const exportBtn    = $('#exportBtn');
  const importFile   = $('#importFile');

  // Calendar print bits
  const calSheetEl   = $('#calSheet');
  const printCalBtn  = $('#printCalBtn');

  let bills = loadBills();

  // ---------- helpers ----------
  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const setBadge = (el, level) => {
    // level: 'success' | 'warning' | 'danger'
    el.classList.remove('success', 'warning', 'danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  };

  // Compute & render cadence totals (unpaid bills due by 1st vs 15th)
  function updateCadence() {
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;

    const early = bills
      .filter(b => !b.paid && ((parseInt(b.due, 10) || 0) <= 15))
      .reduce((sum, b) => sum + (+b.amount || 0), 0);

    const late = bills
      .filter(b => !b.paid && ((parseInt(b.due, 10) || 0) > 15))
      .reduce((sum, b) => sum + (+b.amount || 0), 0);

    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  // Main calculator for KPIs & badges
  function calc() {
    const totalUnpaid = bills.reduce(
      (sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0
    );
    totalUnpaidEl.textContent = fmt.format(totalUnpaid);

    const bal  = parseMoney(balanceEl);
    const buy  = parseMoney(purchaseEl);
    const left = bal - totalUnpaid;
    const after = left - buy;

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent  = fmt.format(after);

    // badges
    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0)       setBadge(buyBadge, 'danger');
    else if (after < 0) setBadge(buyBadge, 'warning');
    else                setBadge(buyBadge, 'success');

    updateCadence(); // keep cadence line in sync anytime totals change
  }

  // Bind a row’s inputs to a bill object
  const bindRow = (tr, bill) => {
    const name = $('.b-name', tr);
    const due  = $('.b-due', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value   = bill.name   || '';
    due.value    = bill.due    ?? '';
    amt.value    = bill.amount != null ? bill.amount : '';
    paid.checked = !!bill.paid;

    const update = () => {
      bill.name   = name.value.trim();
      bill.due    = parseInt(due.value || '0', 10) || '';
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBills(bills);
      calc();
    };

    name.addEventListener('input',  update);
    due.addEventListener('input',   update);
    amt.addEventListener('input',   update);
    paid.addEventListener('change', update);
    del.addEventListener('click', () => {
      bills = bills.filter(b => b !== bill);
      saveBills(bills);
      render();
      calc();
    });
  };

  // Render the table
  function render() {
    tbody.innerHTML = '';
    bills
      .sort((a, b) => (a.due || 99) - (b.due || 99))
      .forEach(bill => {
        const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(tr, bill);
        tbody.appendChild(tr);
      });
  }

  // ---------- actions ----------
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name: '', due: '', amount: 0, paid: false });
    saveBills(bills);
    render();
    calc();
  });

  // Reset All Data
const resetBtn = document.getElementById('resetBtn');
resetBtn?.addEventListener('click', () => {
  if (confirm('This will erase all bills and reset everything. Continue?')) {
    localStorage.removeItem('bt.bills.v1');
    bills = [];
    render();
    calc();
    alert('All data cleared. The app will now refresh.');
    location.reload();
  }
});

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    render();
    calc();
  });

  exportBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(bills, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'budget-terminal-bills.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  importFile?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        bills = data.map(d => ({
          name: d.name ?? '',
          due:  d.due  ?? '',
          amount: +d.amount || 0,
          paid: !!d.paid
        }));
        saveBills(bills);
        render();
        calc();
      }
    } catch (err) {
      alert('Import failed: ' + err.message);
    } finally {
      e.target.value = '';
    }
  });

  // recalc on input
  balanceEl?.addEventListener('input',  calc);
  purchaseEl?.addEventListener('input', calc);

  // ---------- printable calendar (Field Notes–ish + bills) ----------
  function buildCalendarSheet(targetEl, date = new Date(), billsForMonth = []) {
    const y  = date.getFullYear();
    const m  = date.getMonth();
    const first = new Date(y, m, 1);
    const startWeekday = first.getDay();
    const daysInMonth  = new Date(y, m+1, 0).getDate();
    const monthName    = date.toLocaleString('en-US', { month: 'long' });

    const byDay = new Map();
    billsForMonth.forEach(b => {
      const d = parseInt(b.due, 10);
      if (Number.isFinite(d) && d >= 1 && d <= daysInMonth) {
        if (!byDay.has(d)) byDay.set(d, []);
        byDay.get(d).push(b);
      }
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'cal';
    wrapper.innerHTML = `
      <div class="cal__hdr">
        <div class="cal__yr--left">${y}</div>
        <div class="cal__month">${monthName}</div>
        <div class="cal__yr--right">${y}</div>
      </div>
      <div class="cal__wk">
        <div>SUN</div><div>MON</div><div>TUE</div>
        <div>WED</div><div>THU</div><div>FRI</div><div>SAT</div>
      </div>
      <div class="cal__grid"></div>
    `;
    const grid = wrapper.querySelector('.cal__grid');

    for (let i = 0; i < startWeekday; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell';
      grid.appendChild(cell);
    }

    const short = (s, n = 26) => (s || '').length > n ? (s.slice(0, n - 1) + '…') : (s || '');

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal__cell';

      const num = document.createElement('div');
      num.className = 'cal__num';
      const weekday = (startWeekday + (d - 1)) % 7;
      num.classList.toggle('cal__num--accent', weekday === 0);
      num.textContent = d;
      cell.appendChild(num);

      const list = document.createElement('div');
      list.className = 'cal__list';

      const billsToday = byDay.get(d) || [];
      billsToday.sort((a,b) =>
        (a.paid === b.paid ? (+b.amount||0) - (+a.amount||0) : (a.paid ? 1 : -1))
      );

      billsToday.forEach(b => {
        const item = document.createElement('div');
        item.className = 'cal__item';
        item.classList.add(b.paid ? 'cal__item--paid' : 'cal__item--due');
        const amt = Number.isFinite(+b.amount) ? `$${fmt.format(+b.amount)}` : '';
        item.textContent = short(`${b.name || 'Bill'} — ${amt}`);
        list.appendChild(item);
      });

      cell.appendChild(list);
      grid.appendChild(cell);
    }

    targetEl.innerHTML = '';
    targetEl.appendChild(wrapper);
  }

  // Print button -> build calendar with bills then open print dialog
  printCalBtn?.addEventListener('click', () => {
    if (!calSheetEl) return;
    buildCalendarSheet(calSheetEl, new Date(), bills);
    calSheetEl.style.display = 'block';
    window.print();
    calSheetEl.style.display = 'none';
  });

  // ---------- init ----------
  setToday();
  render();
  calc();

  // ---------- pwa ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
