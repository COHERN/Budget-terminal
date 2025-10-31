// app.js — ROUGH DRAFT (Field Notes build)

(() => {
  // ---------- utils ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const fmt = new Intl.NumberFormat('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

  // Debounce helper
  const debounce = (fn, ms=500) => {
    let t; return (...args) => { clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
  };

  // Today in header
  function setToday() {
    const el = $('#todayDate');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday:'short', month:'short', day:'numeric', year:'numeric'
    });
  }

  // ---------- tabs ----------
  const panes = { quick: $('#tab-quick'), bills: $('#tab-bills') };
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.tab) return; // ignore lock button
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panes).forEach(p=>p.classList.remove('active'));
      panes[btn.dataset.tab]?.classList.add('active');
    }, { passive:true });
  });

  // ---------- storage ----------
  const KEY = 'bt.bills.v1';
  const loadBills = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  };
  const saveBillsRaw = (b) => localStorage.setItem(KEY, JSON.stringify(b));

  let bills = loadBills();

  // Save hint
  const saveHint = $('#saveHint');
  const showSaved = () => {
    if (!saveHint) return;
    const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    saveHint.textContent = `Saved ${ts}`;
  };
  const saveBills = debounce((b) => { saveBillsRaw(b); showSaved(); }, 500);

  // ---------- elements ----------
  // Quick Check
  const balanceEl     = $('#balance');
  const purchaseEl    = $('#purchase');
  const totalUnpaidEl = $('#totalUnpaid');
  const leftAfterEl   = $('#leftAfter');
  const afterBuyEl    = $('#afterBuy');
  const coverageBadge = $('#coverageBadge');
  const buyBadge      = $('#buyBadge');

  // Cadence summary
  const cadenceLine  = $('#cadenceLine');
  const cadenceEarly = $('#cadenceEarly');
  const cadenceLate  = $('#cadenceLate');

  // Bills table
  const tbody        = $('#billTable tbody');
  const addBillBtn   = $('#addBillBtn');
  const clearPaidBtn = $('#clearPaidBtn');
  const exportBtn    = $('#exportBtn');   // hidden in UI
  const importFile   = $('#importFile');  // hidden in UI

  // Lock / privacy
  const lockBtn = $('#lockBtn');
  const toggleLock = () => document.body.classList.toggle('locked');

  lockBtn?.addEventListener('click', toggleLock);
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l') toggleLock();
  });

  // ---------- helpers ----------
  const parseMoney = (el) => {
    if (!el) return 0;
    const raw = String(el.value || '').replace(/[^0-9.-]/g,'');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  };

  const setBadge = (el, level) => {
    el.classList.remove('success','warning','danger');
    el.classList.add(level);
    el.textContent = level[0].toUpperCase() + level.slice(1);
  };

  // For 1st vs 15th grouping
  function updateCadence() {
    if (!cadenceEarly && !cadenceLate && !cadenceLine) return;

    const early = bills
      .filter(b => !b.paid && ((parseInt(b.due,10) || 0) <= 15))
      .reduce((sum, b) => sum + (+b.amount || 0), 0);

    const late = bills
      .filter(b => !b.paid && ((parseInt(b.due,10) || 0) > 15))
      .reduce((sum, b) => sum + (+b.amount || 0), 0);

    if (cadenceLine)  cadenceLine.textContent  = 'Bills grouped by pay period:';
    if (cadenceEarly) cadenceEarly.textContent = `By 1st: $${fmt.format(early)}`;
    if (cadenceLate)  cadenceLate.textContent  = `By 15th: $${fmt.format(late)}`;
  }

  // Main calc + guards
  function calc() {
    const totalUnpaid = bills.reduce((sum, b) => sum + (!b.paid ? (+b.amount || 0) : 0), 0);
    const safeTotal = Number.isFinite(totalUnpaid) ? totalUnpaid : 0;
    totalUnpaidEl.textContent = fmt.format(safeTotal);

    const bal  = parseMoney(balanceEl);
    const buy  = parseMoney(purchaseEl);
    const left = (Number.isFinite(bal) ? bal : 0) - safeTotal;
    const after = left - (Number.isFinite(buy) ? buy : 0);

    leftAfterEl.textContent = fmt.format(left);
    afterBuyEl.textContent  = fmt.format(after);

    setBadge(coverageBadge, left >= 0 ? 'success' : 'danger');
    if (left < 0)       setBadge(buyBadge, 'danger');
    else if (after < 0) setBadge(buyBadge, 'warning');
    else                setBadge(buyBadge, 'success');

    updateCadence();
  }

  // Select-on-focus for all inputs
  function hookSelectOnFocus(root=document) {
    $$('input', root).forEach(inp => {
      inp.addEventListener('focus', (e) => e.target.select());
      // Clear leading zero on first entry feel
      inp.addEventListener('keydown', (e) => {
        if ((e.key >= '0' && e.key <= '9') && e.target.value === '0') {
          e.target.value = '';
        }
      });
    });
  }

  // Bind a table row to a bill object
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
      const msg = `Erase this bill?\n\n${bill.name || 'Untitled'}  —  $${fmt.format(+bill.amount || 0)}`;
      if (!confirm(msg)) return;
      bills = bills.filter(b => b !== bill);
      saveBills(bills);
      render();
      calc();
    });
  };

  function render() {
    tbody.innerHTML = '';
    bills
      .sort((a,b) => (a.due||99) - (b.due||99))
      .forEach(bill => {
        const tr = document.importNode($('#billRowTpl').content, true).firstElementChild;
        bindRow(tr, bill);
        tbody.appendChild(tr);
      });
    hookSelectOnFocus(tbody);
  }

  // ---------- actions ----------
  addBillBtn?.addEventListener('click', () => {
    bills.push({ name:'', due:'', amount:0, paid:false });
    saveBills(bills);
    render();
    calc();
  });

  clearPaidBtn?.addEventListener('click', () => {
    if (!confirm('Clear all “Paid” checkboxes for this cycle?')) return;
    bills.forEach(b => b.paid = false);
    saveBills(bills);
    render();
    calc();
  });

  // (Hidden) export / import if you unhide the buttons
  exportBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(bills, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rough-draft-bills.json';
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

  // Live recalc
  balanceEl?.addEventListener('input',  calc);
  purchaseEl?.addEventListener('input', calc);

  // ---------- footer (file last-modified) ----------
  (function footerStamp(){
    const footer = $('#lastUpdated');
    if (!footer) return;
    const lastMod = document.lastModified
      ? new Date(document.lastModified).toLocaleString('en-US', {
          month:'short', day:'numeric', year:'numeric',
          hour:'2-digit', minute:'2-digit'
        })
      : 'unknown';
    footer.textContent = `Last updated: ${lastMod}`;
  })();

  // ---------- init ----------
  setToday();
  render();
  calc();
  hookSelectOnFocus(document);

  // ---------- PWA SW (safe if present) ----------
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }

  // ---------- (Hidden) print/calendar code intentionally omitted from UI ----------
  // (Kept out to keep interface clean. Easy to re-enable later.)
})();
