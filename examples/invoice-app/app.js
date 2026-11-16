import { totals, lineAmount, money } from './totals.js';
import { SEED } from './data.js';

const KEY = 'tally.invoices.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || structuredClone(SEED); } catch { return structuredClone(SEED); } };
const save = (list) => localStorage.setItem(KEY, JSON.stringify(list));
let invoices = load();
let refocusSearch = false;
const view = document.getElementById('view');
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}

function listView() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = params.get('q') || ''; const st = params.get('status') || 'all';
  const rows = invoices.filter((i) => (st === 'all' || i.status === st) && i.client.toLowerCase().includes(q.toLowerCase()));
  const outstanding = invoices.filter((i) => i.status === 'sent').reduce((a, i) => a + totals(i).total, 0);
  view.innerHTML = `
    <h1>Invoices</h1>
    <p class="sub">${invoices.length} invoices · ${money(outstanding)} outstanding</p>
    <div class="bar">
      <input id="search" type="search" placeholder="Search client" aria-label="Search client" value="${esc(q)}">
      <select id="status" aria-label="Status filter">
        ${['all', 'draft', 'sent', 'paid'].map((s) => `<option value="${s}" ${s === st ? 'selected' : ''}>${s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
      </select>
    </div>
    ${rows.length === 0 ? `<div class="empty">No invoices match “${esc(q)}”.</div>` : `
    <table aria-label="Invoices">
      <thead><tr><th>Invoice</th><th>Client</th><th class="hide-sm">Due</th><th>Status</th><th class="num">Total</th></tr></thead>
      <tbody>${rows.map((i) => `<tr class="row" data-id="${i.id}"><td>${i.id}</td><td>${esc(i.client)}</td><td class="hide-sm">${i.due}</td><td><span class="pill ${i.status}">${i.status[0].toUpperCase() + i.status.slice(1)}</span></td><td class="num">${money(totals(i).total)}</td></tr>`).join('')}</tbody>
    </table>`}`;
  const go = () => { refocusSearch = document.activeElement?.id === 'search'; location.hash = `#/?q=${encodeURIComponent(view.querySelector('#search').value)}&status=${view.querySelector('#status').value}`; };
  view.querySelector('#search').addEventListener('input', debounce(go, 250));
  view.querySelector('#status').addEventListener('change', go);
  if (refocusSearch) { const s = view.querySelector('#search'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); refocusSearch = false; }
  view.querySelectorAll('tr.row').forEach((tr) => tr.addEventListener('click', () => { location.hash = `#/invoice/${tr.dataset.id}`; }));
}

function nextId() { return `INV-${String(invoices.length + 1).padStart(4, '0')}`; }

function editorView() {
  const draft = { id: nextId(), client: '', issued: new Date().toISOString().slice(0, 10), due: '', status: 'draft', discountPct: 0, lines: [{ item: '', qty: 1, rate: 0 }] };
  const render = () => {
    const t = totals(draft);
    view.innerHTML = `
      <h1>New invoice</h1><p class="sub">${draft.id}</p>
      <div class="grid">
        <form id="f" novalidate>
          <div class="field"><label for="client">Client</label><input id="client" value="${esc(draft.client)}" placeholder="Company name"></div>
          <table class="lines" aria-label="Line items"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>${draft.lines.map((l, i) => `<tr>
            <td><input aria-label="Item ${i + 1}" data-i="${i}" data-k="item" value="${esc(l.item)}" placeholder="Description"></td>
            <td><input aria-label="Quantity ${i + 1}" data-i="${i}" data-k="qty" type="number" min="0" value="${l.qty}" style="width:70px"></td>
            <td><input aria-label="Rate ${i + 1}" data-i="${i}" data-k="rate" type="number" min="0" value="${l.rate}" style="width:110px"></td>
            <td class="num" data-amount="${i}">${money(lineAmount(l))}</td>
            <td>${draft.lines.length > 1 ? `<button type="button" data-rm="${i}" aria-label="Remove line ${i + 1}">Remove</button>` : ''}</td></tr>`).join('')}</tbody></table>
          <div class="bar" style="margin-top:10px"><button type="button" id="add">Add line</button></div>
          <div class="field" style="max-width:160px"><label for="discount">Discount (%)</label><input id="discount" type="number" min="0" max="100" value="${draft.discountPct}"></div>
          <div id="error" class="err" role="alert"></div>
          <div class="bar"><button class="primary" type="submit">Save invoice</button><button type="button" id="cancel">Cancel</button></div>
        </form>
        <aside class="sum" aria-label="Summary">
          <div><span>Subtotal</span><span id="subtotal">${money(t.subtotal)}</span></div>
          <div><span>Discount</span><span id="disc">− ${money(t.discount)}</span></div>
          <div><span>GST 18%</span><span id="gst">${money(t.gst)}</span></div>
          <div class="total"><span>Total</span><span id="total">${money(t.total)}</span></div>
        </aside>
      </div>`;
    // Update the model and the numbers in place, so typing never loses focus.
    const refresh = () => {
      const t2 = totals(draft);
      view.querySelector('#subtotal').textContent = money(t2.subtotal);
      view.querySelector('#disc').textContent = `− ${money(t2.discount)}`;
      view.querySelector('#gst').textContent = money(t2.gst);
      view.querySelector('#total').textContent = money(t2.total);
      view.querySelectorAll('[data-amount]').forEach((td) => { td.textContent = money(lineAmount(draft.lines[td.dataset.amount])); });
    };
    view.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => {
      const l = draft.lines[inp.dataset.i]; l[inp.dataset.k] = inp.dataset.k === 'item' ? inp.value : Number(inp.value); refresh();
    }));
    view.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { draft.lines.splice(Number(b.dataset.rm), 1); render(); }));
    view.querySelector('#client').addEventListener('input', (e) => { draft.client = e.target.value; });
    view.querySelector('#discount').addEventListener('input', (e) => { draft.discountPct = Math.min(100, Math.max(0, Number(e.target.value) || 0)); refresh(); });
    view.querySelector('#add').addEventListener('click', () => { draft.lines.push({ item: '', qty: 1, rate: 0 }); render(); view.querySelector(`[data-i="${draft.lines.length - 1}"][data-k="item"]`).focus(); });
    view.querySelector('#cancel').addEventListener('click', () => { location.hash = '#/'; });
    view.querySelector('#f').addEventListener('submit', (e) => {
      e.preventDefault();
      draft.client = view.querySelector('#client').value.trim();
      const err = !draft.client ? 'Client is required.' : draft.lines.some((l) => !l.item.trim()) ? 'Every line needs a description.' : totals(draft).total <= 0 ? 'Total must be greater than zero.' : '';
      if (err) { view.querySelector('#error').textContent = err; return; }
      invoices.push(draft); save(invoices); toast(`${draft.id} saved as draft`); location.hash = `#/invoice/${draft.id}`;
    });
  };
  render();
}

function detailView(id) {
  const inv = invoices.find((i) => i.id === id);
  if (!inv) { view.innerHTML = `<div class="empty">Invoice ${esc(id)} was not found. <a href="#/">Back to invoices</a></div>`; return; }
  const t = totals(inv);
  view.innerHTML = `
    <p class="sub"><a href="#/">Invoices</a> / ${inv.id}</p>
    <h1>${esc(inv.client)} <span class="pill ${inv.status}" id="status-pill">${inv.status[0].toUpperCase() + inv.status.slice(1)}</span></h1>
    <p class="sub">Issued ${inv.issued}${inv.due ? ` · due ${inv.due}` : ''}</p>
    <div class="grid">
      <table aria-label="Line items"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${inv.lines.map((l) => `<tr><td>${esc(l.item)}</td><td class="num">${l.qty}</td><td class="num">${money(Math.round(l.rate * 100))}</td><td class="num">${money(lineAmount(l))}</td></tr>`).join('')}</tbody></table>
      <aside class="sum" aria-label="Summary">
        <div><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
        <div><span>Discount (${inv.discountPct}%)</span><span>− ${money(t.discount)}</span></div>
        <div><span>GST 18%</span><span>${money(t.gst)}</span></div>
        <div class="total"><span>Total</span><span id="total">${money(t.total)}</span></div>
        <div style="margin-top:12px; gap:8px; justify-content:flex-start">
          ${inv.status === 'draft' ? '<button id="send">Mark as sent</button>' : ''}
          ${inv.status !== 'paid' ? '<button class="primary" id="paid">Mark as paid</button>' : ''}
        </div>
      </aside>
    </div>`;
  const set = (s, msg) => { inv.status = s; save(invoices); toast(msg); detailView(id); };
  view.querySelector('#send')?.addEventListener('click', () => set('sent', `${inv.id} marked as sent`));
  view.querySelector('#paid')?.addEventListener('click', () => set('paid', `${inv.id} marked as paid`));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function route() {
  const h = location.hash || '#/';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', (a.dataset.nav === 'new') === h.startsWith('#/new')));
  if (h.startsWith('#/new')) return editorView();
  if (h.startsWith('#/invoice/')) return detailView(decodeURIComponent(h.slice('#/invoice/'.length)));
  if (h.startsWith('#/reset')) { localStorage.removeItem(KEY); invoices = load(); location.hash = '#/'; return; }
  return listView();
}
window.addEventListener('hashchange', route);
route();
