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
  const cadenceLine = $('#cadenceLine');   // optional label
  const cadenceEarly = $('#cadenceEarly'); // "By 1st: $…"
  const cadenceLate  = $('#cadenceLate');  // "By 15th: $…"

  // Bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const exportBtn    = $('#exportBtn');
  const importFile   = $('#importFile');

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

    name.value     = bill.name   || '';
    due.value      = bill.due    ?? '';
    amt.value      = bill.amount != null ? bill.amount : '';
    paid.checked   = !!bill.paid;

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

  clearPaidBtn?.addEventListener('click', () => {
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    render();
    calc();
  });

  // Print Calendar action
const printCalBtn = document.getElementById('printCalBtn');
printCalBtn?.addEventListener('click', () => {
  window.print();
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

  // ---------- init ----------
  setToday();
  render();
  calc();

  // ---------- pwa ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
