const state = { rows: [], filtered: [] };

const periodSelect = document.getElementById('periodSelect');
const managerSelect = document.getElementById('managerSelect');
const dataUrlInput = document.getElementById('dataUrlInput');
const loadBtn = document.getElementById('loadBtn');
const kpiGrid = document.getElementById('kpiGrid');
const managerTableBody = document.querySelector('#managerTable tbody');
const summaryPanel = document.getElementById('summaryPanel');
const diagnostics = document.getElementById('diagnostics');
const reportDateLabel = document.getElementById('reportDateLabel');

const fmtMoney = (n) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtPct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

function normalizeRow(row) {
  return {
    manager_name: row.manager_name || '',
    period_type: (row.period_type || '').toLowerCase(),
    period_label: row.period_label || '',
    plan_amount: Number(row.plan_amount || 0),
    fact_payments: Number(row.fact_payments || 0),
    plan_percent: Number(row.plan_percent || 0),
    new_deals_count: Number(row.new_deals_count || 0),
    new_deals_amount: Number(row.new_deals_amount || 0),
    active_deals_count: Number(row.active_deals_count || 0),
    active_pipeline_amount: Number(row.active_pipeline_amount || 0),
    won_count: Number(row.won_count || 0),
    won_amount: Number(row.won_amount || 0),
    lost_count: Number(row.lost_count || 0),
    lost_amount: Number(row.lost_amount || 0),
  };
}

async function loadData() {
  const url = dataUrlInput.value.trim();
  if (!url) {
    diagnostics.innerHTML = '<p>Укажи URL опубликованного CSV или JSON.</p>';
    return;
  }

  const text = await fetch(url).then(r => r.text());
  let rows = [];

  if (url.toLowerCase().includes('json')) {
    rows = JSON.parse(text);
  } else {
    rows = parseCsv(text);
  }

  state.rows = rows.map(normalizeRow);
  populateManagerFilter();
  render();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current.replace(/^"|"$/g, '')); current = ''; }
    else current += ch;
  }
  result.push(current.replace(/^"|"$/g, ''));
  return result;
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

function render() {
  const period = periodSelect.value;
  const manager = managerSelect.value;

  state.filtered = state.rows.filter(r => r.period_type === period && (manager === 'all' || r.manager_name === manager));
  renderKpis();
  renderTable();
  renderSummary();
  renderDiagnostics();

  const labels = [...new Set(state.filtered.map(r => r.period_label).filter(Boolean))];
  reportDateLabel.textContent = 'Период метки: ' + (labels[0] || '—');
}

function renderKpis() {
  const totals = aggregate(state.filtered);
  const items = [
    ['Факт оплат', fmtMoney(totals.fact_payments)],
    ['План', fmtMoney(totals.plan_amount)],
    ['% выполнения', fmtPct(totals.plan_amount ? totals.fact_payments / totals.plan_amount : 0)],
    ['Новые сделки', fmtMoney(totals.new_deals_count)],
    ['Сумма новых сделок', fmtMoney(totals.new_deals_amount)],
    ['Активная воронка', fmtMoney(totals.active_pipeline_amount)],
    ['Выиграно', fmtMoney(totals.won_amount)],
    ['Проиграно', fmtMoney(totals.lost_amount)],
  ];
  kpiGrid.innerHTML = items.map(([label, value]) => `
    <div class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
    </div>
  `).join('');
}

function renderTable() {
  const rows = [...state.filtered].sort((a,b) => b.fact_payments - a.fact_payments);
  managerTableBody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.manager_name}</td>
      <td>${fmtMoney(r.fact_payments)}</td>
      <td>${fmtMoney(r.plan_amount)}</td>
      <td>${fmtPct(r.plan_amount ? r.fact_payments / r.plan_amount : 0)}</td>
      <td>${fmtMoney(r.new_deals_count)}</td>
      <td>${fmtMoney(r.new_deals_amount)}</td>
      <td>${fmtMoney(r.active_pipeline_amount)}</td>
      <td>${fmtMoney(r.won_amount)}</td>
    </tr>
  `).join('');
}

function renderSummary() {
  const totals = aggregate(state.filtered);
  summaryPanel.innerHTML = [
    ['Менеджеров в выборке', state.filtered.length],
    ['Активных сделок', totals.active_deals_count],
    ['Выигранных сделок', totals.won_count],
    ['Проигранных сделок', totals.lost_count],
    ['План-факт статус', (totals.plan_amount && totals.fact_payments / totals.plan_amount >= 1) ? '<span class="badge-good">План выполнен</span>' : '<span class="badge-warn">Ниже плана</span>']
  ].map(([k,v]) => `<div class="summary-item"><span>${k}</span><span>${v}</span></div>`).join('');
}

function renderDiagnostics() {
  const withoutManager = state.rows.filter(r => !r.manager_name || r.manager_name === 'Без менеджера').length;
  diagnostics.innerHTML = `
    <p>Всего строк в источнике: <b>${state.rows.length}</b></p>
    <p>Строк в текущем фильтре: <b>${state.filtered.length}</b></p>
    <p>Строк без менеджера: <b>${withoutManager}</b></p>
  `;
}

function aggregate(rows) {
  return rows.reduce((acc, r) => {
    Object.keys(acc).forEach(k => acc[k] += Number(r[k] || 0));
    return acc;
  }, {
    plan_amount: 0,
    fact_payments: 0,
    new_deals_count: 0,
    new_deals_amount: 0,
    active_deals_count: 0,
    active_pipeline_amount: 0,
    won_count: 0,
    won_amount: 0,
    lost_count: 0,
    lost_amount: 0,
  });
}

periodSelect.addEventListener('change', render);
managerSelect.addEventListener('change', render);
loadBtn.addEventListener('click', loadData);
