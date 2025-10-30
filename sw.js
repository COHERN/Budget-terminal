// Utility
const $  = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

function formatCurrency(value) {
  const num = Number(value || 0);
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

// ===== BILL STORAGE =====
const store = {
  key: "bt.bills.v3_2",
  get() {
    try { return JSON.parse(localStorage.getItem(this.key)) || []; }
    catch { return []; }
  },
  set(v) { localStorage.setItem(this.key, JSON.stringify(v)); }
};

const bills = {
  list: store.get(),
  save() { store.set(this.list); renderBills(); compute(); }
};

// ===== INITIAL SEED =====
if (!bills.list.length) {
  bills.list = [
    { name: "Mortgage", due: 1, amt: 1986.63, paid: false },
    { name: "Utilities", due: 1, amt: 259.0, paid: false },
    { name: "GMC Loan", due: 9, amt: 349.2, paid: false },
    { name: "Quick Quack", due: 9, amt: 59.99, paid: false },
    { name: "Liberty Mutual", due: 10, amt: 417.59, paid: false },
    { name: "ACCC", due: 14, amt: 1230.0, paid: false },
    { name: "RAV4 Loan", due: 19, amt: 303.08, paid: false },
    { name: "Security System", due: 20, amt: 75.0, paid: false },
    { name: "T-Mobile", due: 25, amt: 172.25, paid: false },
    { name: "Internet", due: 25, amt: 62.9, paid: false },
    { name: "Trash", due: 15, amt: 149.35, paid: false }
  ];
  store.set(bills.list);
}

// ====== DOM READY ======
document.addEventListener("DOMContentLoaded", () => {

  // TAB SWITCHING
  function activateTab(name) {
    $$(".tab").forEach(b => b.classList.remove("active"));
    $(`[data-tab='${name}']`)?.classList.add("active");
    $$(".tabpane").forEach(p => p.classList.remove("active"));
    $(`#tab-${name}`)?.classList.add("active");
  }

  $$(".tab").forEach(btn => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
    btn.addEventListener("touchstart", () => activateTab(btn.dataset.tab), { passive: true });
    btn.style.cursor = "pointer";
  });

  // SPLASH HIDE
  setTimeout(() => {
    const splash = $("#splash");
    if (splash) splash.classList.add("hidden");
  }, 5000);

  // BILL RENDER
  renderBills();

  // INPUTS
  ["#balance", "#purchase"].forEach(sel =>
    $(sel)?.addEventListener("input", compute)
  );

  compute();
});

// ===== RENDER BILLS =====
function renderBills() {
  const tbody = $("#billTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const tpl = $("#billRowTpl");
  bills.list.sort((a, b) => (a.due || 99) - (b.due || 99));
  bills.list.forEach((b, i) => {
    const row = tpl.content.cloneNode(true);
    row.querySelector(".b-name").value = b.name || "";
    row.querySelector(".b-due").value = b.due || "";
    row.querySelector(".b-amt").value = b.amt || "";
    row.querySelector(".b-paid").checked = !!b.paid;
    row.querySelector(".b-name").addEventListener("input", e => { b.name = e.target.value; bills.save(); });
    row.querySelector(".b-due").addEventListener("input", e => { b.due = Number(e.target.value || 0); bills.save(); });
    row.querySelector(".b-amt").addEventListener("input", e => { b.amt = Number(e.target.value || 0); bills.save(); });
    row.querySelector(".b-paid").addEventListener("change", e => { b.paid = e.target.checked; bills.save(); });
    row.querySelector(".rowDel").addEventListener("click", () => { bills.list.splice(i, 1); bills.save(); });
    tbody.appendChild(row);
  });
}

// ===== CALC =====
function sumUnpaid() {
  return bills.list.filter(b => !b.paid).reduce((t, b) => t + Number(b.amt || 0), 0);
}

function compute() {
  const balance = Number($("#balance")?.value || 0);
  const purchase = Number($("#purchase")?.value || 0);
  const totalUnpaid = sumUnpaid();
  $("#totalUnpaid").textContent = formatCurrency(totalUnpaid);
  const leftAfter = balance - totalUnpaid;
  $("#leftAfter").textContent = formatCurrency(leftAfter);
  const afterBuy = leftAfter - purchase;
  $("#afterBuy").textContent = formatCurrency(afterBuy);

  const cov = $("#coverageBadge");
  const buy = $("#buyBadge");

  if (leftAfter >= 0) {
    cov.textContent = "Success";
    cov.className = "pill success";
  } else {
    cov.textContent = "Danger";
    cov.className = "pill danger";
  }

  if (afterBuy >= 0) {
    buy.textContent = "Success";
    buy.className = "pill success";
  } else {
    buy.textContent = "Warning";
    buy.className = "pill warning";
  }
}
