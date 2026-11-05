const state = {
  data: [],
  project: null,
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

async function loadJSON(path, fallback) {
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

function average(values) {
  if (!values.length) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const projectKey = params.get('project');
  const data = await loadJSON('data/live_submissions_scored.json', []);
  state.data = Array.isArray(data) ? data : [];

  const selected = state.data.filter(row => {
    if (!projectKey) return false;
    return row.project === projectKey;
  });

  state.project = selected.length ? selected : state.data;
  if (!state.project.length) {
    document.getElementById('projectTitle').textContent = 'No project selected';
    document.getElementById('projectMeta').textContent = 'No matching project data was found';
    return;
  }

  populateProjectSelector();
  bindProjectSelector();
  renderProject();
}

function populateProjectSelector() {
  const select = document.getElementById('selProject');
  if (!select) return;
  const unique = [...new Set(state.data.map(row => row.project).filter(Boolean))].sort();
  unique.forEach(projectKey => {
    const option = document.createElement('option');
    option.value = projectKey;
    option.textContent = displayProjectName(state.data.find(row => row.project === projectKey));
    if (state.project[0] && projectKey === state.project[0].project) option.selected = true;
    select.appendChild(option);
  });
}

function bindProjectSelector() {
  const select = document.getElementById('selProject');
  if (!select) return;
  select.addEventListener('change', (event) => {
    const projectKey = event.target.value;
    if (projectKey) {
      window.location.href = `project.html?project=${encodeURIComponent(projectKey)}`;
    }
  });

  const search = document.getElementById('responseSearch');
  if (search) {
    search.addEventListener('input', (event) => {
      const query = event.target.value.trim().toLowerCase();
      renderResponseTable(query);
    });
  }
}

function renderProject() {
  const row = state.project[0];
  const title = document.getElementById('projectTitle');
  const meta = document.getElementById('projectMeta');
  if (title) title.textContent = displayProjectName(row);
  if (meta) meta.textContent = `${normalizeLabel(row.meta_country || row.country || '—')} · ${normalizeLabel(row.meta_region || row.region || '—')} · ${row.ProjectStatus || 'Unknown status'}`;

  renderStats();
  renderPillarChart();
  renderStageChart();
  renderLogTable();
  renderConcernTable();
  renderResponseTable('');
}

function renderStats() {
  const strip = document.getElementById('statStrip');
  if (!strip) return;

  const rows = state.project;
  const scoreAvg = average(rows.map(row => Number(row.SubmissionScore)).filter(Number.isFinite));
  const concernAvg = average(rows.map(row => Number(row.ConcernCount)).filter(Number.isFinite));
  const riskAvg = average(rows.map(row => Number(row.RiskScore)).filter(Number.isFinite));

  const cards = [
    { value: `${scoreAvg}%`, label: 'Avg score', sub: 'submission score', tone: scoreAvg >= 80 ? 'success' : scoreAvg >= 60 ? 'warning' : 'danger' },
    { value: concernAvg.toFixed(1), label: 'Concerns', sub: 'per checklist', tone: '' },
    { value: `${riskAvg}`, label: 'Risk score', sub: 'average risk', tone: riskAvg >= 6 ? 'danger' : riskAvg >= 3 ? 'warning' : 'success' },
    { value: `${rows.length}`, label: 'Records', sub: 'submitted', tone: '' },
  ];

  strip.innerHTML = cards.map(card => `
    <div class="stat-card">
      <span class="stat-value ${card.tone}">${card.value}</span>
      <div class="stat-label">${card.label}</div>
      <div class="stat-sublabel">${card.sub}</div>
    </div>
  `).join('');
}

function renderPillarChart() {
  const canvas = document.getElementById('pillarChart');
  if (!canvas) return;

  const dataset = [
    { label: 'Programmatic', value: average(state.project.map(row => Number(row.ProgrammaticScore)).filter(Number.isFinite)) },
    { label: 'MEL', value: average(state.project.map(row => Number(row.MELScore)).filter(Number.isFinite)) },
  ];

  if (state.charts.pillar) state.charts.pillar.destroy();
  state.charts.pillar = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dataset.map(item => item.label),
      datasets: [{
        label: 'Average score',
        data: dataset.map(item => item.value),
        backgroundColor: ['#1e6d5f', '#0b84a5'],
      }],
    },
    options: { plugins: { legend: { display: false } }, maintainAspectRatio: false },
  });
}

function renderStageChart() {
  const canvas = document.getElementById('stageChart');
  if (!canvas) return;

  const dataset = [
    { label: 'Startup', value: average(state.project.map(row => Number(row.StartupScore)).filter(Number.isFinite)) },
    { label: 'Implementation', value: average(state.project.map(row => Number(row.ImplementationScore)).filter(Number.isFinite)) },
    { label: 'Closeout', value: average(state.project.map(row => Number(row.CloseoutScore)).filter(Number.isFinite)) },
  ];

  if (state.charts.stage) state.charts.stage.destroy();
  state.charts.stage = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: dataset.map(item => item.label),
      datasets: [{
        label: 'Score',
        data: dataset.map(item => item.value),
        borderColor: '#1e6d5f',
        backgroundColor: 'rgba(30,109,95,0.18)',
      }],
    },
    options: { maintainAspectRatio: false },
  });
}

function renderLogTable() {
  const tbody = document.getElementById('logBody');
  if (!tbody) return;

  tbody.innerHTML = state.project.map(row => {
    const score = Number(row.SubmissionScore) || 0;
    const tone = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger';
    return `
      <tr>
        <td>${formatDate(row._submission_time || row.submission_date || row.end || row.start)}</td>
        <td class="tabular">${score}%</td>
        <td><span class="badge ${row.ProjectStatus ? row.ProjectStatus.toLowerCase().replace(/\s+/g, '-') : 'low'}">${row.ProjectStatus || '—'}</span></td>
        <td class="tabular">${row.ConcernCount ?? 0}</td>
        <td class="tabular">${row.RiskScore ?? '—'}</td>
        <td>
          <div class="progress-bar"><span class="progress-bar-fill" style="width:${Math.min(score, 100)}%; background:${tone === 'success' ? '#0c9a69' : tone === 'warning' ? '#cf8a00' : '#d64545'};"></span></div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderConcernTable() {
  const tbody = document.getElementById('concernsTableBody');
  if (!tbody) return;

  const concerns = [];
  state.project.forEach(row => {
    (row.ConcernQuestions || []).forEach(item => {
      concerns.push({
        stage: item.stage || 'Unknown',
        pillar: item.pillar || 'Unknown',
        issue: item.issue || item.question || 'Unknown issue',
      });
    });
  });

  tbody.innerHTML = concerns.length
    ? concerns.map(item => `
        <tr>
          <td>${item.stage}</td>
          <td>${item.pillar}</td>
          <td>${item.issue}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="3">No concerns flagged</td></tr>';
}

function renderResponseTable(query) {
  const tbody = document.getElementById('responsesTableBody');
  if (!tbody) return;

  const rows = state.project.flatMap(row => Object.entries(row)
    .filter(([key, value]) => key.endsWith('_AnswerC') || key.endsWith('_IsConcern') || key.endsWith('_ScoringType'))
    .map(([key, value]) => ({
      question: key.replace(/_(AnswerC|IsConcern|ScoringType)$/, ''),
      answer: row[key.replace(/_AnswerC$/, '_AnswerC')] ?? row[key.replace(/_IsConcern$/, '_AnswerC')] ?? '',
      score: row[key],
      concern: row[key.replace(/_AnswerC$/, '_IsConcern')] ?? 0,
    })));

  const filtered = rows.filter(item => {
    const questionText = item.question.toLowerCase();
    return !query || questionText.includes(query);
  });

  tbody.innerHTML = filtered.length
    ? filtered.map(item => `
        <tr>
          <td>${item.question}</td>
          <td>${item.answer ?? '—'}</td>
          <td class="tabular">${item.score ?? '—'}</td>
          <td>${item.concern ? 'Yes' : 'No'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4">No matching checklist responses</td></tr>';
}

document.addEventListener('DOMContentLoaded', init);
