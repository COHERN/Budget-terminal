// v3.3 — robust tabs + iOS touch + splash release
const $  = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

function formatCurrency(v){
  const n = Number(v || 0);
  return `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

/* ---------- storage ---------- */
const store = {
  key: 'bt.bills.v3_3',
  get(){ try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch { return []; } },
  set(v){ localStorage.setItem(this.key, JSON.stringify(v)); }
};

const bills = {
  list: store.get(),
  save(){ store.set(this.list); renderBills(); compute(); }
};

/* ---------- seed if empty ---------- */
if (!bills.list.length){
  bills.list = [
    {name:'Mortgage', due:1, amt:1986.63, paid:false},
    {name:'Utilities', due:1, amt:259.00, paid:false},
    {name:'GMC Loan', due:9, amt:349.20, paid:false},
    {name:'Quick Quack', due:9, amt:59.99, paid:false},
    {name:'Liberty Mutual', due:10, amt:417.59, paid:false},
    {name:'ACCC', due:14, amt:1230.00, paid:false},
    {name:'RAV4 Loan', due:19, amt:303.08, paid:false},
    {name:'Security System', due:20, amt:75.00, paid:false},
    {name:'T-Mobile', due:25, amt:172.25, paid:false},
    {name:'Internet', due:25, amt:62.90, paid:false},
    {name:'Trash', due:15, amt:149.35, paid:false}
  ];
  store.set(bills.list);
}

/* ---------- tabs (bullet-proof) ---------- */
function activateTab(name){
  $$('.tab').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');

  $$('.tabpane').forEach(p => p.classList.add('hidden'));
  const pane = document.getElementById(`tab-${name}`);
  if (pane) pane.classList.remove('hidden');
}

function bindTabs(){
  $$('.tab').forEach(btn => {
    const go = () => activateTab(btn.dataset.tab);
    btn.addEventListener('click', go);
    btn.addEventListener('touchend', go, {passive:true});
    btn.style.cursor = 'pointer';
  });
}

/* ---------- splash release ---------- */
function releaseSplash(){
  const s = document.getElementById('splash');
  if (s) s.classList.add('hidden');
  const main = document.getElementById('main');
  if (main) main.classList.remove('hidden');
}

/* ---------- bills table ---------- */
function renderBills(){
  const tbody = document.querySelector('#billTable tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const tpl = document.getElementById('billRowTpl');

  bills.list.sort((a,b)=>(a.due||99)-(b.due||99));
  bills.list.forEach((b,i)=>{
    const row = tpl.content.cloneNode(true);
    row.querySelector('.b-name').value = b.name || '';
    row.querySelector('.b-due').value  = b.due  ?? '';
    row.querySelector('.b-amt').value  = b.amt  ?? '';
    row.querySelector('.b-paid').checked = !!b.paid;

    row.querySelector('.b-name').addEventListener('input', e=>{ b.name = e.target.value; bills.save(); });
    row.querySelector('.b-due').addEventListener('input',  e=>{ b.due  = Number(e.target.value||0); bills.save(); });
    row.querySelector('.b-amt').addEventListener('input',  e=>{ b.amt  = Number(e.target.value||0); bills.save(); });
    row.querySelector('.b-paid').addEventListener('change',e=>{ b.paid = e.target.checked; bills.save(); });
    row.querySelector('.rowDel').addEventListener('click', ()=>{ bills.list.splice(i,1); bills.save(); });

    tbody.appendChild(row);
  });
}

/* ---------- math ---------- */
function sumUnpaid(){ return bills.list.filter(b=>!b.paid).reduce((t,b)=>t + Number(b.amt||0), 0); }

function compute(){
  const balance   = Number(document.getElementById('balance')?.value || 0);
  const purchase  = Number(document.getElementById('purchase')?.value || 0);
  const totalDue  = sumUnpaid();

  document.getElementById('totalUnpaid').textContent = formatCurrency(totalDue);
  const left = balance - totalDue;
  document.getElementById('leftAfter').textContent = formatCurrency(left);
  const after = left - purchase;
  document.getElementById('afterBuy').textContent = formatCurrency(after);

  const cov = document.getElementById('coverageBadge');
  cov.textContent = (left >= 0) ? 'Success' : 'Danger';
  cov.className   = (left >= 0) ? 'pill success' : 'pill danger';

  const buy = document.getElementById('buyBadge');
  buy.textContent = (after >= 0) ? 'Success' : 'Warning';
  buy.className   = (after >= 0) ? 'pill success' : 'pill warning';
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  activateTab('quick');
  setTimeout(releaseSplash, 5000);
  renderBills();
  ['#balance','#purchase'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener('input', compute);
  });
  compute();
});
