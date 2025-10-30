// app.js — Budget Terminal (v3.4.1 simplified)

(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const clampNum = (n) => Number.isFinite(n) ? n : 0;
  const debounce = (fn, delay = 250) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  };

  function parseMoney(el) {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  }

  function setBadge(el, level) {
    el.classList.remove('success', 'warning', 'danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  }

  function setToday() {
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  function enableSelectOnFocus(el) {
    if (!el) return;
    el.addEventListener('focus', () => {
      const v = el.value.trim();
      if (v === '0' || v === '0.00') el.value = '';
      else setTimeout(() => el.select(), 0);
    });
  }

  // Tabs
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p => p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    });
  });

  // Storage
  const KEY = 'bt.bills.v1';
  const loadBills = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const _saveBills = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));
  const saveBillsDebounced = debounce(_saveBills, 200);

  // Elements
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');
  const cadenceLine   = $('#cadenceLine');
  const cadenceEarly  = $('#cadenceEarly');
  const cadenceLate   = $('#cadenceLate');
  const tbody         = $('#billTable tbody');
  const addBillBtn    = $('#addBillBtn');
  const clearPaidBtn  = $('#clearPaidBtn');
  const resetAllBtn   = $('#resetAllBtn');

  let bills = loadBills();

  function updateCadence() {
    const toNum = (x) => Number.isFinite(+x) ? +x : 0;
    const early = bills.filter(b => !b.paid && (toNum(b.due) <= 15))
                       .reduce((sum, b) => sum + toNum(b.amount), 0);
    const late  = bills.filter(b => !b.paid && (toNum(b.due) > 15))
                       .reduce((sum, b) => sum + toNum(b.amount), 0);
    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  function calc() {
    const totalUnpaid = bills.reduce((sum, b) =>
      sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaidEl.textContent = fmt.format(clampNum(totalUnpaid));

    const bal = clampNum(parseMoney(balanceEl));
    const buy = clampNum(parseMoney(purchaseEl));
    const left = clampNum(bal - totalUnpaid);
    const after = clampNum(left - buy);

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent = fmt.format(after);

    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0) setBadge(buyBadge, 'danger');
    else if (after < 0) setBadge(buyBadge, 'warning');
    else setBadge(buyBadge, 'success');

    updateCadence();
  }

  function bindRow(tr, bill) {
    const name = $('.b-name', tr);
    const due  = $('.b-due', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value = bill.name || '';
    due.value = bill.due ?? '';
    amt.value = (bill.amount != null && bill.amount !== '') ? bill.amount : '';

    [name, due, amt].forEach(enableSelectOnFocus);

    const update = debounce(() => {
      bill.name = name.value.trim();
      bill.due = parseInt((due.value || '').replace(/[^\d-]/g, ''), 10) || '';
      bill.amount = parseMoney(amt);
      bill.paid = !!paid.checked;
      saveBillsDebounced(bills);
      calc();
    }, 120);

    name.addEventListener('input', update);
    due.addEventListener('input', update);
    amt.addEventListener('input', update);
    paid.addEventListener('change', update);

    del.textContent = 'DELETE';
    del.addEventListener('click', () => {
      if (!confirm(`Delete "${name.value || 'this bill'}"?`)) return;
      bills = bills.filter(b => b !== bill);
      _saveBills(bills);
      render();
      calc();
    });
  }

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

  // Actions
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
    const ok = confirm('Reset all data? This clears your saved bills.');
    if (!ok) return;
    bills = [];
    _saveBills(bills);
    render();
    calc();
  });

  // Disable print calendar (hidden feature)
  const printCalBtn = $('#printCalBtn');
  if (printCalBtn) printCalBtn.style.display = 'none';

  balanceEl?.addEventListener('input', calc);
  purchaseEl?.addEventListener('input', calc);
  enableSelectOnFocus(balanceEl);
  enableSelectOnFocus(purchaseEl);

  // Init
  setToday();
  render();
  calc();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
