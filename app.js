const state = {
  payments: [],
  deals: [],
  plans: [],
  managers: [],
  rows: []
};

const baseUrlInput = document.getElementById('baseUrlInput');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const managerSelect = document.getElementById('managerSelect');
const loadBtn = document.getElementById('loadBtn');
const kpiGrid = document.getElementById('kpiGrid');
const managerTableBody = document.querySelector('#managerTable tbody');
const summaryPanel = document.getElementById('summaryPanel');
const diagnostics = document.getElementById('diagnostics');
const reportDateLabel = document.getElementById('reportDateLabel');

const fmtMoney = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

async function fetchDataset(baseUrl, dataset) {
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}dataset=${dataset}`;
  const response = await fetch(url, { method: 'GET', redirect: 'follow' });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${dataset}`);
  const parsed = JSON.parse(text.trim());
  if (!Array.isArray(parsed)) throw new Error(`Dataset ${dataset} is not array`);
  return parsed;
}

function parseRuDate(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value)) return value;
  const s = String(value).trim();
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const d = ('0' + date.getDate()).slice(-2);
  return `${y}-${m}-${d}`;
}

function populateManagerFilter() {
  const managers = [...new Set(state.rows.map(r => r.manager_name).filter(Boolean))].sort();
  managerSelect.innerHTML = '<option value="all">Все менеджеры</option>';
  managers.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    managerSelect.appendChild(option);
  });
}

function aggregateForRange() {
  const from = parseRuDate(dateFromInput.value);
  const to = parseRuDate(dateToInput.value);
  const selectedManager = managerSelect.value;

  const managerMap = {};
  const ensure = (name) => {
    const key = name || 'Без менеджера';
    if (!managerMap[key]) {
      managerMap[key] = {
        manager_name: key,
        fact_payments: 0,
        new_deals_count: 0,
        new_deals_amount: 0,
        active_pipeline_amount: 0,
        won_amount: 0,
        lost_amount: 0,
        active_deals_count: 0,
        won_count: 0,
        lost_count: 0,
      };
    }
    return managerMap[key];
  };

  state.payments.forEach(row => {
    const dt = parseRuDate(row.payment_date);
    if (!dt || (from && dt < from) || (to && dt > to)) return;
    const manager = ensure(row.manager_name);
    manager.fact_payments += Number(row.payment_amount || 0);
  });

  state.deals.forEach(row => {
    const dt = parseRuDate(row.date_create);
    if (!dt || (from && dt < from) || (to && dt > to)) return;
    const manager = ensure(row.manager_name);
    const amount = Number(row.amount || 0);
    const isWon = String(row.is_won || '') === 'Да';
    const isLost = String(row.is_lost || '') === 'Да';

    manager.new_deals_count += 1;
    manager.new_deals_amount += amount;
    if (!isWon && !isLost) {
      manager.active_deals_count += 1;
      manager.active_pipeline_amount += amount;
    }
    if (isWon) {
      manager.won_count += 1;
      manager.won_amount += amount;
    }
    if (isLost) {
      manager.lost_count += 1;
      manager.lost_amount += amount;
    }
  });

  state.rows = Object.values(managerMap).filter(r => selectedManager === 'all' || r.manager_name === selectedManager);
}

function render() {
  aggregateForRange();
  populateManagerFilter();
  renderKpis();
  renderTable();
  renderSummary();
  renderDiagnostics();
  reportDateLabel.textContent = `Диапазон: ${dateFromInput.value || '—'} → ${dateToInput.value || '—'}`;
}

function renderKpis() {
  const totals = state.rows.reduce((acc, r) => {
    acc.fact_payments += r.fact_payments;
    acc.new_deals_count += r.new_deals_count;
    acc.new_deals_amount += r.new_deals_amount;
    acc.active_pipeline_amount += r.active_pipeline_amount;
    acc.won_amount += r.won_amount;
    acc.lost_amount += r.lost_amount;
    return acc;
  }, { fact_payments: 0, new_deals_count: 0, new_deals_amount: 0, active_pipeline_amount: 0, won_amount: 0, lost_amount: 0 });

  const items = [
    ['Факт оплат', fmtMoney(totals.fact_payments)],
    ['Новые сделки', fmtMoney(totals.new_deals_count)],
    ['Сумма новых сделок', fmtMoney(totals.new_deals_amount)],
    ['Активная воронка', fmtMoney(totals.active_pipeline_amount)],
    ['Выиграно', fmtMoney(totals.won_amount)],
    ['Проиграно', fmtMoney(totals.lost_amount)],
  ];

  kpiGrid.innerHTML = items.map(([label, value]) => `
    <div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>
  `).join('');
}

function renderTable() {
  const rows = [...state.rows].sort((a, b) => b.fact_payments - a.fact_payments);
  managerTableBody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.manager_name)}</td>
      <td>${fmtMoney(r.fact_payments)}</td>
      <td>${fmtMoney(r.new_deals_count)}</td>
      <td>${fmtMoney(r.new_deals_amount)}</td>
      <td>${fmtMoney(r.active_pipeline_amount)}</td>
      <td>${fmtMoney(r.won_amount)}</td>
      <td>${fmtMoney(r.lost_amount)}</td>
    </tr>
  `).join('');
}

function renderSummary() {
  const totalManagers = state.rows.length;
  summaryPanel.innerHTML = [
    ['Менеджеров в выборке', totalManagers],
    ['Оплат загружено', state.payments.length],
    ['Сделок загружено', state.deals.length],
    ['План', 'Для произвольного периода пока не рассчитывается']
  ].map(([k, v]) => `<div class="summary-item"><span>${k}</span><span>${v}</span></div>`).join('');
}

function renderDiagnostics() {
  diagnostics.innerHTML = `
    <p>Строк fact_payments: <b>${state.payments.length}</b></p>
    <p>Строк fact_deals: <b>${state.deals.length}</b></p>
    <p>Менеджеров в диапазоне: <b>${state.rows.length}</b></p>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadAll() {
  const baseUrl = baseUrlInput.value.trim();
  if (!baseUrl) {
    diagnostics.innerHTML = '<p>Укажи Apps Script endpoint.</p>';
    return;
  }

  diagnostics.innerHTML = '<p>Загружаю datasets...</p>';

  try {
    const [payments, deals, plans] = await Promise.all([
      fetchDataset(baseUrl, 'fact_payments'),
      fetchDataset(baseUrl, 'fact_deals'),
      fetchDataset(baseUrl, 'plan_money').catch(() => [])
    ]);

    state.payments = payments;
    state.deals = deals;
    state.plans = plans;

    const paymentDates = payments.map(r => parseRuDate(r.payment_date)).filter(Boolean);
    const dealDates = deals.map(r => parseRuDate(r.date_create)).filter(Boolean);
    const allDates = [...paymentDates, ...dealDates].sort((a, b) => a - b);

    if (allDates.length) {
      if (!dateFromInput.value) dateFromInput.value = ymd(allDates[0]);
      if (!dateToInput.value) dateToInput.value = ymd(allDates[allDates.length - 1]);
    }

    render();
  } catch (err) {
    diagnostics.innerHTML = `<p>Ошибка загрузки datasets: ${escapeHtml(err.message || String(err))}</p>`;
  }
}

loadBtn.addEventListener('click', loadAll);
managerSelect.addEventListener('change', render);
dateFromInput.addEventListener('change', render);
dateToInput.addEventListener('change', render);
