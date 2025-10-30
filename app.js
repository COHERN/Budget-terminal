// app.js — Budget Terminal (v3.3)

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Splash
  const splash = $('#splash');
  const main = $('#main');
  setTimeout(() => {
    if (splash) splash.classList.add('hidden');
    if (main) main.classList.remove('hidden');
  }, 3000); // 3s per your setting

  // Tabs
  const panes = {
    quick: $('#tab-quick'),
    bills: $('#tab-bills'),
  };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      // header active
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // panes
      Object.values(panes).forEach(p => p.classList.remove('active'));
      const key = btn.dataset.tab;
      panes[key]?.classList.add('active');
    }, { passive: true });
  });

  // Storage
  const KEY = 'bt.bills.v1';
  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const saveBills = (b) => localStorage.setItem(KEY, JSON.stringify(b));

  // Elements (Quick Check)
  const balanceEl    = $('#balance');
  const purchaseEl   = $('#purchase');
  const totalUnpaid  = $('#totalUnpaid');
  const leftAfter    = $('#leftAfter');
  const afterBuy     = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // Elements (Bills)
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const exportBtn    = $('#exportBtn');
  const importFile   = $('#importFile');

  let bills = loadBills();

  // Helpers
  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g,'');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const setBadge = (el, level) => {
    // level: 'success' | 'warning' | 'danger'
    el.classList.remove('success', 'warning', 'danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  };

  const calc = () => {
    // sum unpaid
    const total = bills.reduce((sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    totalUnpaid.textContent = fmt.format(total);

    const bal = parseMoney(balanceEl);
    const buy = parseMoney(purchaseEl);

    const left = bal - total;
    const after = left - buy;

    leftAfter.textContent = fmt.format(left);
    afterBuy.textContent  = fmt.format(after);

    // badges logic
    if (left >= 0) setBadge(coverageBadge, 'success');
    else setBadge(coverageBadge, 'danger');

    if (left < 0) {
      setBadge(buyBadge, 'danger');                 // already not covered
    } else if (after < 0) {
      setBadge(buyBadge, 'warning');                // covered, but purchase would break it
    } else {
      setBadge(buyBadge, 'success');                // safe to buy
    }
  };

  const bindRow = (tr, bill) => {
    const name = $('.b-name', tr);
    const due  = $('.b-due', tr);
    const amt  = $('.b-amt', tr);
    const paid = $('.b-paid', tr);
    const del  = $('.rowDel', tr);

    name.value = bill.name || '';
    due.value  = bill.due  ?? '';
    amt.value  = bill.amount != null ? bill.amount : '';
    paid.checked = !!bill.paid;

    const update = () => {
      bill.name   = name.value.trim();
      bill.due    = parseInt(due.value || '0', 10) || '';
      bill.amount = parseMoney(amt);
      bill.paid   = !!paid.checked;
      saveBills(bills);
      calc();
    };

    name.addEventListener('input', update);
    due.addEventListener('input', update);
    amt.addEventListener('input', update);
    paid.addEventListener('change', update);
    del.addEventListener('click', () => {
      bills = bills.filter(b => b !== bill);
      saveBills(bills);
      render();
      calc();
    });
  };

  const render = () => {
    tbody.innerHTML = '';
    bills
      .sort((a,b) => (a.due||99) - (b.due||99))
      .forEach(bill => {
        const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(tr, bill);
        tbody.appendChild(tr);
      });
  };

  // Actions
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', due:'', amount:0, paid:false });
    saveBills(bills);
    render();
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
          due: d.due ?? '',
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

  // Inputs recalc
  balanceEl?.addEventListener('input', calc);
  purchaseEl?.addEventListener('input', calc);

  // Initial
  render();
  calc();

  // PWA (optional but harmless if present)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
})();
