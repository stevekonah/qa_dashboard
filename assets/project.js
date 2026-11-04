/* ============================================================
   QA Dashboard — Executive Overview
   ============================================================ */

const state = {
  data: [], filtered: [],
  filters: {
    region: "",
    country: "",
    project: "",
    funding: "",
    tech: "",
    stage: "",
    status: "",
    year: "",
    quarter: "",
    search: "",
  },
  sort: { key: "score", dir: "asc" },
  charts: {},
};

function normalizeLabel(value) {
  if (value == null) return "";
  return String(value)
    .trim()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function labelKey(value) {
  return normalizeLabel(value).toLowerCase();
}

function uniqueNormalized(values) {
  const seen = new Map();
  values.forEach((value) => {
    const key = labelKey(value);
    if (!key || seen.has(key)) return;
    seen.set(key, normalizeLabel(value));
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function displayProjectName(row) {
  if (!row) return "Unknown project";
  const submitted = row._display_project_name || row.meta_project_title || row.project_title || row.project || "Unknown project";
  return normalizeLabel(submitted) || "Unknown project";
}

function projectLookupByKey(projectKey) {
  return state.data.find((d) => d.project === projectKey) || null;
}

async function loadJSON(path, fallback) {
  try { const r = await fetch(path, { cache: "no-store" }); return r.ok ? await r.json() : fallback; }
  catch { return fallback; }
}

function populateFilters() {
  const d = state.data;
  fill("selRegion", uniqueNormalized(d.map((x) => x.meta_region || x.region)));
  fill("selCountry", uniqueNormalized(d.map((x) => x.meta_country || x.country)));
  fillProjectOptions("selProject");
  fill("selFunding", uniqueNormalized(d.map((x) => x.meta_funding_source)));
  fill("selTech", uniqueNormalized(d.map((x) => x.meta_technical_area)));
  fill("selYear", uniqueNormalized(d.map((x) => x.year || x.meta_year)));
  fill("selQuarter", uniqueNormalized(d.map((x) => x.quarter || x.meta_quarter)));
}

function fill(id, values) {
  const sel = document.getElementById(id);
  if (!sel) return;
  values.filter(Boolean).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    sel.appendChild(option);
  });
}

function fillProjectOptions(id) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const projectKeys = [...new Set(state.data.map((x) => x.project).filter(Boolean))].sort();
  projectKeys.forEach((projectKey) => {
    const sample = projectLookupByKey(projectKey) || { project: projectKey };
    const option = document.createElement("option");
    option.value = projectKey;
    option.textContent = displayProjectName(sample);
    sel.appendChild(option);
  });
}

function wireEvents() {
  const map = {
    selRegion: "region",
    selCountry: "country",
    selProject: "project",
    selFunding: "funding",
    selTech: "tech",
    selYear: "year",
    selQuarter: "quarter",
    selStage: "stage",
    selStatus: "status",
  };

  Object.entries(map).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      applyFilters();
    });
  });

  const projectSearch = document.getElementById("projectSearch");
  if (projectSearch) {
    projectSearch.addEventListener("input", (event) => {
      state.filters.search = event.target.value.toLowerCase();
      render();
    });
  }

  const resetButton = document.getElementById("btnReset");
  if (resetButton) resetButton.addEventListener("click", resetFilters);

  const exportExcelButton = document.getElementById("btnExportExcel");
  if (exportExcelButton) exportExcelButton.addEventListener("click", () => exportExcel(state.filtered, state.filters));

  const exportWordButton = document.getElementById("btnExportWord");
  if (exportWordButton) exportWordButton.addEventListener("click", () => exportWord(state.filtered, state.filters));

  document.querySelectorAll("#projectsTable th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else { state.sort.key = key; state.sort.dir = "asc"; }
      renderProjectsTable();
    });
  });
}

function resetFilters() {
  state.filters = {
    region: "",
    country: "",
    project: "",
    funding: "",
    tech: "",
    stage: "",
    status: "",
    year: "",
    quarter: "",
    search: "",
  };

  ["selRegion", "selCountry", "selProject", "selFunding", "selTech", "selYear", "selQuarter", "selStage", "selStatus"].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.value = "";
  });

  const projectSearch = document.getElementById("projectSearch");
  if (projectSearch) projectSearch.value = "";

  applyFilters();
}

function stageMatches(row, stage) {
  if (!stage) return true;
  const key = `${stage}Score`;
  return row[key] != null;
}

function applyFilters() {
  const f = state.filters;
  state.filtered = state.data.filter((d) => {
    const region = normalizeLabel(d.meta_region || d.region || "");
    const country = normalizeLabel(d.meta_country || d.country || "");
    const projectTitle = displayProjectName(d).toLowerCase();
    const yearValue = normalizeLabel(d.year || d.meta_year || "");
    const quarterValue = normalizeLabel(d.quarter || d.meta_quarter || "");
    const searchMatch = !f.search || projectTitle.includes(f.search) || country.toLowerCase().includes(f.search);

    return (!f.region || region === normalizeLabel(f.region))
      && (!f.country || country === normalizeLabel(f.country))
      && (!f.project || d.project === f.project)
      && (!f.funding || normalizeLabel(d.meta_funding_source || "") === normalizeLabel(f.funding))
      && (!f.tech || normalizeLabel(d.meta_technical_area || "") === normalizeLabel(f.tech))
      && (!f.year || yearValue === normalizeLabel(f.year))
      && (!f.quarter || quarterValue === normalizeLabel(f.quarter))
      && (!f.stage || stageMatches(d, f.stage))
      && (!f.status || d.ProjectStatus === f.status)
      && searchMatch;
  });

  render();
}

async function init() {
  const [data, meta] = await Promise.all([
    loadJSON("data/live_submissions_scored.json", []),
    loadJSON("data/live_meta.json", {}),
  ]);

  state.data = Array.isArray(data) ? data : [];
  state.filtered = state.data;

  if (!state.data.length) {
    const scopeLine = document.getElementById("scopeLine");
    if (scopeLine) scopeLine.textContent = "No data available — refresh the dashboard";

    const updatedNote = document.getElementById("updatedNote");
    if (updatedNote) updatedNote.textContent = "Awaiting first refresh";

    const statStrip = document.getElementById("statStrip");
    if (statStrip) {
      statStrip.innerHTML = `
        <div class="stat-card">
          <span class="stat-value">—</span>
          <div class="stat-label">No data yet</div>
          <div class="stat-sublabel">Run the pipeline or refresh Kobo data</div>
        </div>
      `;
    }

    const projectTableBody = document.querySelector("#projectsTable tbody");
    if (projectTableBody) projectTableBody.innerHTML = "<tr><td colspan='8'>No data available yet</td></tr>";
    return;
  }

  populateFilters();
  renderMeta(meta);
  wireEvents();
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
  const n = state.filtered.length;
  const projects = new Set(state.filtered.map((d) => d.project).filter(Boolean)).size;
  const scopeLine = document.getElementById("scopeLine");
  if (scopeLine) scopeLine.textContent = `${n} checklist${n === 1 ? "" : "s"} · ${projects} project${projects === 1 ? "" : "s"}`;
}

function renderMeta(meta) {
  const updatedNote = document.getElementById("updatedNote");
  if (updatedNote) updatedNote.textContent = meta.fetched_at ? "Updated " + new Date(meta.fetched_at).toLocaleString() : "Awaiting first refresh";
}

function renderStats() {
  const d = state.filtered;
  const scores = d.map((x) => x.SubmissionScore).filter((s) => s != null);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const statuses = { "On Track": 0, "Needs Attention": 0, "At Risk": 0 };
  d.forEach((x) => { if (statuses[x.ProjectStatus] != null) statuses[x.ProjectStatus]++; });
  const projects = new Set(d.map((x) => x.project).filter(Boolean)).size;

  const cells = [
    { num: projects, lbl: "Projects reporting", sub: "in scope" },
    { num: d.length, lbl: "Checklists submitted", sub: "total" },
    { num: avg + "%", lbl: "Overall QA score", sub: "average" },
    { num: statuses["On Track"], lbl: "On Track", sub: "≥ 80%", color: "var(--color-success)" },
    { num: statuses["Needs Attention"], lbl: "Needs Attention", sub: "60–79%", color: "var(--color-warning)" },
    { num: statuses["At Risk"], lbl: "At Risk", sub: "< 60%", color: "var(--color-danger)" },
  ];

  const statStrip = document.getElementById("statStrip");
  if (statStrip) {
    statStrip.innerHTML = cells.map((cell) => {
      const valueClass = cell.color ? (cell.color.includes("success") ? "success" : cell.color.includes("warning") ? "warning" : "danger") : "";
      return `
        <div class="stat-card">
          <span class="stat-value ${valueClass}" style="${cell.color ? `color:${cell.color}` : ""}">${cell.num}</span>
          <div class="stat-label">${cell.lbl}</div>
          <div class="stat-sublabel">${cell.sub}</div>
        </div>
      `;
    }).join("");
  }
}

function renderStatusChart() {
  const counts = { "On Track": 0, "Needs Attention": 0, "At Risk": 0 };
  state.filtered.forEach((d) => { if (counts[d.ProjectStatus] != null) counts[d.ProjectStatus]++; });
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;
  if (state.charts.status) state.charts.status.destroy();
  state.charts.status = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: Object.keys(counts),
      datasets: [{ data: Object.values(counts), backgroundColor: ["#059669", "#d97706", "#dc2626"] }],
    },
    options: { plugins: { legend: { position: "bottom" } }, maintainAspectRatio: false },
  });
}

function renderCompletionChart() {
  const byCountry = {};
  state.filtered.forEach((d) => {
    const country = normalizeLabel(d.meta_country || d.country || "");
    if (!country) return;
    byCountry[country] = (byCountry[country] || 0) + 1;
  });

  const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById("completionChart");
  if (!ctx) return;
  if (state.charts.completion) state.charts.completion.destroy();
  state.charts.completion = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(([country]) => country),
      datasets: [{ label: "Checklists", data: sorted.map(([, count]) => count), backgroundColor: "#1f5c3d" }],
    },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, maintainAspectRatio: false },
  });
}

function renderPillarGrid() {
  const d = state.filtered;
  const pillars = [
    { key: "ProgrammaticScore", label: "Programmatic", color: "#1f5c3d" },
    { key: "MELScore", label: "MEL", color: "#0284c7" },
    { key: null, label: "Stages", custom: true },
  ];

  const target = document.getElementById("pillarGrid");
  if (!target) return;

  target.innerHTML = pillars.map((pillar) => {
    if (pillar.custom) {
      const stages = ["Startup", "Implementation", "Closeout"];
      return stages.map((stage) => {
        const key = `${stage}Score`;
        const scores = d.map((x) => x[key]).filter((v) => v != null);
        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
        const pct = avg === "—" ? 0 : Number(avg);
        const color = pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-warning)" : "var(--color-danger)";
        return `
          <div class="pillar-cell">
            <div class="pillar-label">${stage} stage</div>
            <div class="pillar-value" style="color:${color}">${avg}${avg === "—" ? "" : "%"}</div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, pct)}%; background:${color};"></div></div>
            <div class="pillar-foot">${scores.length} submission${scores.length === 1 ? "" : "s"} scored</div>
          </div>`;
      }).join("");
    }

    const scores = d.map((x) => x[pillar.key]).filter((v) => v != null);
    const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    const pct = avg === "—" ? 0 : Number(avg);
    const color = pct >= 80 ? "var(--color-success)" : pct >= 60 ? "var(--color-warning)" : "var(--color-danger)";
    return `
      <div class="pillar-cell">
        <div class="pillar-label">${pillar.label} pillar</div>
        <div class="pillar-value" style="color:${color}">${avg}${avg === "—" ? "" : "%"}</div>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, pct)}%; background:${color};"></div></div>
        <div class="pillar-foot">${scores.length} submission${scores.length === 1 ? "" : "s"} scored</div>
      </div>`;
  }).join("");
}

function renderRiskTable() {
  const atRisk = state.filtered.filter((d) => d.ProjectStatus === "At Risk").slice(0, 5);
  const riskBody = document.querySelector("#riskTable tbody");
  if (!riskBody) return;

  riskBody.innerHTML = atRisk.length
    ? atRisk.map((d) => `<tr><td>${normalizeLabel(d.meta_country || d.country || "—")}</td><td>${displayProjectName(d)}</td><td class="tabular">${d.SubmissionScore ?? "—"}%</td><td><span class="badge ${((d.RiskCategory || "").toLowerCase())}">${d.RiskCategory || "—"}</span></td></tr>`).join("")
    : "<tr><td colspan='4'>No projects at risk </td></tr>";
}

function renderConcernsTable() {
  const counts = {};
  state.filtered.forEach((d) => {
    (d.ConcernQuestions || []).forEach((c) => {
      const key = c.issue || c.question;
      counts[key] = (counts[key] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const concernsBody = document.querySelector("#concernsTable tbody");
  if (!concernsBody) return;

  concernsBody.innerHTML = sorted.length
    ? sorted.map(([issue, count]) => `<tr><td>${issue}</td><td class="tabular">${count}</td></tr>`).join("")
    : "<tr><td colspan='2'>No concerns in scope</td></tr>";
}

function renderProjectsTable() {
  let rows = state.filtered.slice();
  const q = state.filters.search;
  if (q) {
    rows = rows.filter((d) => displayProjectName(d).toLowerCase().includes(q) || (d.meta_country || d.country || "").toLowerCase().includes(q));
  }

  const dir = state.sort.dir === "asc" ? 1 : -1;
  const key = state.sort.key;
  const accessor = {
    country: (d) => normalizeLabel(d.meta_country || d.country || ""),
    project: (d) => displayProjectName(d),
    funding: (d) => normalizeLabel(d.meta_funding_source || ""),
    amount: (d) => Number(d.meta_amount) || 0,
    score: (d) => d.SubmissionScore || 0,
    status: (d) => d.ProjectStatus || "",
    concerns: (d) => d.ConcernCount || 0,
    risk: (d) => d.RiskScore || 0,
  }[key] || ((d) => d.SubmissionScore || 0);

  rows.sort((a, b) => {
    const va = accessor(a), vb = accessor(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  const body = document.querySelector("#projectsTable tbody");
  if (!body) return;

  body.innerHTML = rows.length
    ? rows.map((d) => {
        const cls = (d.ProjectStatus || "").toLowerCase().replace(" ", "-");
        const riskCls = (d.RiskCategory || "").toLowerCase();
        return `<tr data-project="${d.project || ""}">
          <td>${normalizeLabel(d.meta_country || d.country || "—")}</td>
          <td><b>${displayProjectName(d)}</b></td>
          <td>${normalizeLabel(d.meta_funding_source || "—")}</td>
          <td class="tabular">${formatAmount(d.meta_amount)}</td>
          <td class="tabular">${d.SubmissionScore ?? "—"}%</td>
          <td><span class="badge ${cls}">${d.ProjectStatus || "—"}</span></td>
          <td class="tabular">${d.ConcernCount ?? 0}</td>
          <td><span class="badge ${riskCls}">${d.RiskCategory || "—"}</span></td>
        </tr>`;
      }).join("")
    : "<tr><td colspan='8'>No projects match your filter</td></tr>";

  document.querySelectorAll("#projectsTable tbody tr[data-project]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const projectId = tr.dataset.project;
      if (projectId) window.location.href = `project.html?project=${encodeURIComponent(projectId)}`;
    });
  });
}

function formatAmount(n) {
  if (n == null || n === "") return "—";
  const value = Number(n);
  if (Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return "$" + (value / 1_000_000).toFixed(1) + "M";
  if (value >= 1_000) return "$" + (value / 1_000).toFixed(0) + "K";
  return "$" + value;
}

document.addEventListener("DOMContentLoaded", init);
