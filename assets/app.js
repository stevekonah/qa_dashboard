const state = {
  data: [],
  filtered: [],
  filters: { region: '', country: '', project: '', funding: '', tech: '', year: '', quarter: '', stage: '', status: '', search: '' },
  sort: { key: 'score', dir: 'desc' },
  charts: {},
};

function normalizeLabel(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .replace(/[_/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

function displayProjectName(row) {
  if (!row) return 'Unknown project';
  return normalizeLabel(row._display_project_name || row.meta_project_title || row.project_title || row.project || 'Unknown project');
}

function projectLookupByKey(projectKey) {
  return state.data.find(d => d.project === projectKey) || null;
}

async function loadJSON(path, fallback) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function uniqueValues(rows, key) {
  return [...new Set(rows.map(r => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

async function init() {
  const [data, meta] = await Promise.all([
    loadJSON('data/live_submissions_scored.json', []),
    loadJSON('data/live_meta.json', {})
  ]);

  state.data = Array.isArray(data) ? data : [];
  state.filtered = [...state.data];

  if (!state.data.length) {
    const scopeLine = document.getElementById('scopeLine');
    if (scopeLine) scopeLine.textContent = 'No data available — refresh the dashboard';
    const updatedNote = document.getElementById('updatedNote');
    if (updatedNote) updatedNote.textContent = 'Awaiting first refresh';
    const container = document.getElementById('statStrip');
    if (container) {
      container.innerHTML = `
        <div class="stat-card">
          <span class="stat-value">—</span>
          <div class="stat-label">No data yet</div>
          <div class="stat-sublabel">Run the pipeline or refresh Kobo data</div>
        </div>
      `;
    }
    if (document.getElementById('projectsTableBody')) { document.getElementById('projectsTableBody').innerHTML = '<tr><td colspan="8">No data available yet</td></tr>'; }
    return;
  }

  populateFilters();
  bindControls();
  renderMeta(meta);
  render();
}

function populateFilters() {
  const rows = state.data;
  const regionValues = uniqueValues(rows, 'meta_region').concat(uniqueValues(rows, 'region'));
  const countryValues = uniqueValues(rows, 'meta_country').concat(uniqueValues(rows, 'country'));
  const fundingValues = uniqueValues(rows, 'meta_funding_source');
  const techValues = uniqueValues(rows, 'meta_technical_area');
  const yearValues = uniqueValues(rows, 'meta_year').concat(uniqueValues(rows, 'year'));
  const quarterValues = uniqueValues(rows, 'meta_quarter').concat(uniqueValues(rows, 'quarter'));

  fillSelect('selRegion', [...new Set(regionValues.map(v => normalizeLabel(v)))].filter(Boolean));
  fillSelect('selCountry', [...new Set(countryValues.map(v => normalizeLabel(v)))].filter(Boolean));
  fillProjectSelect();
  fillSelect('selFunding', [...new Set(fundingValues.map(v => normalizeLabel(v)))].filter(Boolean));
  fillSelect('selTech', [...new Set(techValues.map(v => normalizeLabel(v)))].filter(Boolean));
  fillSelect('selYear', [...new Set(yearValues.map(v => String(v)))].filter(Boolean));
  fillSelect('selQuarter', [...new Set(quarterValues.map(v => String(v)))].filter(Boolean));
}

function fillSelect(id, values) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">All</option>';
  values.forEach(v => {
    const option = document.createElement('option');
    option.value = String(v);
    option.textContent = String(v);
    select.appendChild(option);
  });
  if (currentValue) select.value = currentValue;
}

function fillProjectSelect() {
  const select = document.getElementById('selProject');
  if (!select) return;
  const projects = [...new Set(state.data.map(r => r.project).filter(Boolean))];
  select.innerHTML = '<option value="">All projects</option>';
  projects.forEach(projectKey => {
    const option = document.createElement('option');
    option.value = projectKey;
    option.textContent = displayProjectName(projectLookupByKey(projectKey));
    select.appendChild(option);
  });
}

function bindControls() {
  ['selRegion', 'selCountry', 'selProject', 'selFunding', 'selTech', 'selYear', 'selQuarter', 'selStage', 'selStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', (event) => {
      const keyMap = {
        selRegion: 'region',
        selCountry: 'country',
        selProject: 'project',
        selFunding: 'funding',
        selTech: 'tech',
        selYear: 'year',
        selQuarter: 'quarter',
        selStage: 'stage',
        selStatus: 'status',
      };
      state.filters[keyMap[id]] = event.target.value;
      applyFilters();
    });
  });

  const search = document.getElementById('projectSearch');
  if (search) {
    search.addEventListener('input', (event) => {
      state.filters.search = event.target.value.trim().toLowerCase();
      render();
    });
  }

  const reset = document.getElementById('btnReset');
  if (reset) {
    reset.addEventListener('click', () => {
      state.filters = { region: '', country: '', project: '', funding: '', tech: '', year: '', quarter: '', stage: '', status: '', search: '' };
      document.getElementById('projectSearch').value = '';
      ['selRegion', 'selCountry', 'selProject', 'selFunding', 'selTech', 'selYear', 'selQuarter', 'selStage', 'selStatus'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
      });
      applyFilters();
    });
  }

  const excelBtn = document.getElementById('btnExportExcel');
  if (excelBtn) excelBtn.addEventListener('click', () => exportExcel(state.filtered, state.filters));

  const wordBtn = document.getElementById('btnExportWord');
  if (wordBtn) wordBtn.addEventListener('click', () => exportWord(state.filtered, state.filters));

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const nextKey = th.dataset.sort;
      if (state.sort.key === nextKey) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.key = nextKey;
        state.sort.dir = 'asc';
      }
      renderProjectsTable();
    });
  });
}

function applyFilters() {
  state.filtered = state.data.filter((row) => {
    const region = normalizeLabel(row.meta_region || row.region || '');
    const country = normalizeLabel(row.meta_country || row.country || '');
    const funding = normalizeLabel(row.meta_funding_source || '');
    const tech = normalizeLabel(row.meta_technical_area || '');
    const year = String(row.meta_year ?? row.year ?? '');
    const quarter = String(row.meta_quarter ?? row.quarter ?? '');
    const projectName = displayProjectName(row).toLowerCase();
    const query = state.filters.search || '';

    const matches =
      (!state.filters.region || region === normalizeLabel(state.filters.region)) &&
      (!state.filters.country || country === normalizeLabel(state.filters.country)) &&
      (!state.filters.project || row.project === state.filters.project) &&
      (!state.filters.funding || funding === normalizeLabel(state.filters.funding)) &&
      (!state.filters.tech || tech === normalizeLabel(state.filters.tech)) &&
      (!state.filters.year || year === String(state.filters.year)) &&
      (!state.filters.quarter || quarter === String(state.filters.quarter)) &&
      (!state.filters.status || row.ProjectStatus === state.filters.status) &&
      (!state.filters.stage || row.ProjectStatus === state.filters.stage || row[`${state.filters.stage}Score`] !== undefined || row.stage === state.filters.stage) &&
      (!query || projectName.includes(query) || country.toLowerCase().includes(query));

    return matches;
  });

  render();
}

function render() {
  renderScope();
  renderStats();
  renderStatusChart();
  renderCompletionChart();
  renderPillarGrid();
  renderRiskTable();
  renderConcernsTable();
  renderProjectsTable();
}

function renderScope() {
  const scopeLine = document.getElementById('scopeLine');
  if (!scopeLine) return;
  const count = state.filtered.length;
  const projects = new Set(state.filtered.map(row => row.project).filter(Boolean)).size;
  scopeLine.textContent = `${count} checklist${count === 1 ? '' : 's'} · ${projects} project${projects === 1 ? '' : 's'}`;
}

function renderMeta(meta) {
  const updatedNote = document.getElementById('updatedNote');
  if (!updatedNote) return;
  if (meta && meta.fetched_at) updatedNote.textContent = new Date(meta.fetched_at).toLocaleString();
  else updatedNote.textContent = 'Awaiting first refresh';
}

function renderStats() {
  const strip = document.getElementById('statStrip');
  if (!strip) return;

  const rows = state.filtered;
  const scores = rows.map(r => Number(r.SubmissionScore)).filter(Number.isFinite);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  const onTrack = rows.filter(r => r.ProjectStatus === 'On Track').length;
  const needsAttention = rows.filter(r => r.ProjectStatus === 'Needs Attention').length;
  const atRisk = rows.filter(r => r.ProjectStatus === 'At Risk').length;
  const projectCount = new Set(rows.map(r => r.project).filter(Boolean)).size;

  const cards = [
    { value: projectCount, label: 'Projects reporting', sub: 'in scope', tone: '' },
    { value: rows.length, label: 'Checklists submitted', sub: 'total', tone: '' },
    { value: avg === '—' ? '—' : `${avg}%`, label: 'Overall QA score', sub: 'average', tone: '' },
    { value: onTrack, label: 'On track', sub: '≥ 80%', tone: 'success' },
    { value: needsAttention, label: 'Needs attention', sub: '60–79%', tone: 'warning' },
    { value: atRisk, label: 'At risk', sub: '< 60%', tone: 'danger' },
  ];

  strip.innerHTML = cards.map(card => `
    <div class="stat-card">
      <span class="stat-value ${card.tone}">${card.value}</span>
      <div class="stat-label">${card.label}</div>
      <div class="stat-sublabel">${card.sub}</div>
    </div>
  `).join('');
}

function renderStatusChart() {
  const canvas = document.getElementById('statusChart');
  if (!canvas) return;
  const counts = { 'On Track': 0, 'Needs Attention': 0, 'At Risk': 0 };
  state.filtered.forEach(row => {
    if (counts[row.ProjectStatus] !== undefined) counts[row.ProjectStatus] += 1;
  });

  if (state.charts.status) state.charts.status.destroy();
  state.charts.status = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#0c9a69', '#cf8a00', '#d64545'],
      }],
    },
    options: { plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false },
  });
}

function renderCompletionChart() {
  const canvas = document.getElementById('completionChart');
  if (!canvas) return;
  const byCountry = {};
  state.filtered.forEach(row => {
    const country = normalizeLabel(row.meta_country || row.country || '');
    if (!country) return;
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  const entries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (state.charts.completion) state.charts.completion.destroy();
  state.charts.completion = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: entries.map(([country]) => country),
      datasets: [{
        label: 'Checklists',
        data: entries.map(([, count]) => count),
        backgroundColor: '#1e6d5f',
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
    },
  });
}

function renderPillarGrid() {
  const container = document.getElementById('pillarGrid');
  if (!container) return;

  const pillarKeys = [
    { key: 'ProgrammaticScore', title: 'Programmatic' },
    { key: 'MELScore', title: 'MEL' },
    { key: 'StartupScore', title: 'Startup' },
    { key: 'ImplementationScore', title: 'Implementation' },
    { key: 'CloseoutScore', title: 'Closeout' },
  ];

  container.innerHTML = pillarKeys.map((pillar) => {
    const values = state.filtered.map(row => Number(row[pillar.key])).filter(Number.isFinite);
    const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const percent = Number.isFinite(avg) ? avg : 0;
    const tone = percent >= 80 ? '#0c9a69' : percent >= 60 ? '#cf8a00' : '#d64545';
    return `
      <div class="pillar-cell">
        <div class="pillar-label">${pillar.title}</div>
        <div class="pillar-value" style="color:${tone}">${values.length ? `${percent.toFixed(1)}%` : '—'}</div>
        <div class="progress-bar"><span class="progress-bar-fill" style="width:${Math.min(percent, 100)}%; background:${tone};"></span></div>
        <div class="pillar-foot">${values.length} scored item${values.length === 1 ? '' : 's'}</div>
      </div>
    `;
  }).join('');
}

function renderRiskTable() {
  const tbody = document.getElementById('riskTableBody');
  if (!tbody) return;

  const rows = state.filtered.filter(row => row.ProjectStatus === 'At Risk' || row.RiskCategory === 'High').slice(0, 5);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4">No projects at risk</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const riskClass = (row.RiskCategory || 'Low').toLowerCase();
    return `
      <tr>
        <td>${normalizeLabel(row.meta_country || row.country || '—')}</td>
        <td>${displayProjectName(row)}</td>
        <td class="tabular">${row.SubmissionScore ?? '—'}%</td>
        <td><span class="badge ${riskClass}">${row.RiskCategory || 'Low'}</span></td>
      </tr>
    `;
  }).join('');
}

function renderConcernsTable() {
  const tbody = document.getElementById('concernsTableBody');
  if (!tbody) return;

  const counts = {};
  state.filtered.forEach(row => {
    const concerns = Array.isArray(row.ConcernQuestions) ? row.ConcernQuestions : [];
    concerns.forEach(item => {
      const key = item.issue || item.question || 'Unknown issue';
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="2">No concerns in scope</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(([issue, count]) => `
    <tr>
      <td>${issue}</td>
      <td class="tabular">${count}</td>
    </tr>
  `).join('');
}

function renderProjectsTable() {
  const tbody = document.getElementById('projectsTableBody');
  if (!tbody) return;

  let rows = [...state.filtered];
  const search = state.filters.search || '';
  if (search) {
    rows = rows.filter(row => {
      const projectName = displayProjectName(row).toLowerCase();
      const country = normalizeLabel(row.meta_country || row.country || '').toLowerCase();
      return projectName.includes(search) || country.includes(search);
    });
  }

  const sortKey = state.sort.key;
  rows.sort((a, b) => {
    const valueA = accessorFor(sortKey, a);
    const valueB = accessorFor(sortKey, b);
    if (valueA < valueB) return state.sort.dir === 'asc' ? -1 : 1;
    if (valueA > valueB) return state.sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8">No projects match your filters</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const status = row.ProjectStatus || '—';
    const badgeClass = status.toLowerCase().replace(/\s+/g, '-');
    const riskClass = (row.RiskCategory || 'Low').toLowerCase();
    return `
      <tr data-project="${row.project || ''}">
        <td>${normalizeLabel(row.meta_country || row.country || '—')}</td>
        <td>${displayProjectName(row)}</td>
        <td>${normalizeLabel(row.meta_funding_source || '—')}</td>
        <td class="tabular">${formatNumber(row.meta_amount)}</td>
        <td class="tabular">${row.SubmissionScore ?? '—'}%</td>
        <td><span class="badge ${badgeClass}">${status}</span></td>
        <td class="tabular">${row.ConcernCount ?? 0}</td>
        <td><span class="badge ${riskClass}">${row.RiskCategory || 'Low'}</span></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('tr[data-project]').forEach(row => {
    row.addEventListener('click', () => {
      const projectKey = row.dataset.project;
      if (projectKey) {
        window.location.href = `project.html?project=${encodeURIComponent(projectKey)}`;
      }
    });
  });
}

function accessorFor(key, row) {
  const accessorMap = {
    country: () => normalizeLabel(row.meta_country || row.country || ''),
    project: () => displayProjectName(row),
    funding: () => normalizeLabel(row.meta_funding_source || ''),
    amount: () => Number(row.meta_amount) || 0,
    score: () => Number(row.SubmissionScore) || 0,
    status: () => row.ProjectStatus || '',
    concerns: () => Number(row.ConcernCount) || 0,
    risk: () => Number(row.RiskScore) || 0,
  };
  return (accessorMap[key] || accessorMap.score)();
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

document.addEventListener('DOMContentLoaded', init);
