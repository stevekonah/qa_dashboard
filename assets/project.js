/* ============================================================
   Project Diagnostics
   ============================================================ */

const state = { data: [], project: "", filtered: [], charts: {} };

async function loadJSON(path, fallback) {
  try {
    const r = await fetch(path, { cache: "no-store" });
    return r.ok ? await r.json() : fallback;
  } catch {
    return fallback;
  }
}

function submissionTimestamp(d) {
  if (!d) return 0;
  const raw = d._submission_time || d.today || "";
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

async function init() {
  const data = await loadJSON("data/live_submissions_scored.json", []);
  state.data = Array.isArray(data) ? data : [];
  const projects = [...new Set(state.data.map(d => d.project).filter(Boolean))].sort();
  const sel = document.getElementById("selProject");
  projects.forEach(p => {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    sel.appendChild(o);
  });

  const params = new URLSearchParams(window.location.search);
  const target = params.get("project") || projects[0] || "";
  if (target) {
    sel.value = target;
    state.project = target;
  } else {
    state.project = "";
  }
  render();
  sel.addEventListener("change", e => {
    state.project = e.target.value;
    const url = new URL(window.location);
    if (state.project) {
      url.searchParams.set("project", state.project);
    } else {
      url.searchParams.delete("project");
    }
    history.replaceState({}, "", url);
    render();
  });
}

function render() {
  state.filtered = state.data
    .filter(d => d.project === state.project)
    .sort((a, b) => submissionTimestamp(a) - submissionTimestamp(b));

  renderHeader();
  renderStats();
  renderPillarChart();
  renderStageChart();
  renderPerformanceLog();
  renderConcerns();
  renderResponses();
}

function renderHeader() {
  document.getElementById("projectTitle").textContent = state.project || "Project";
  const s = state.filtered[0] || {};
  const parts = [];
  if (s.meta_project_title) parts.push(s.meta_project_title);
  if (s.meta_country) parts.push(s.meta_country);
  if (s.meta_funding_source) parts.push(s.meta_funding_source);
  if (s.meta_project_lead) parts.push("Lead: " + s.meta_project_lead);
  document.getElementById("projectMeta").textContent = parts.join(" · ");
}

function renderStats() {
  const d = state.filtered;
  const latest = d[d.length - 1] || {};
  const scores = d.map(x => x.SubmissionScore).filter(s => s != null);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  const cells = [
    { num: d.length, lbl: "Checklists Submitted" },
    { num: latest.SubmissionScore != null ? latest.SubmissionScore + "%" : "—", lbl: "Latest Score", color: statusColor(latest.ProjectStatus) },
    { num: avg + "%", lbl: "Average Score" },
    { num: latest.ConcernCount ?? 0, lbl: "Latest Concerns" },
    { num: latest.RiskCategory || "—", lbl: "Risk Category" },
    { num: latest.ProjectStatus || "—", lbl: "Status", color: statusColor(latest.ProjectStatus) },
  ];
  document.getElementById("statStrip").innerHTML = cells.map(c =>
    `<div class="stat-cell"><span class="num" ${c.color ? `style="color:${c.color}"` : ""}>${c.num}</span><div class="lbl">${c.lbl}</div></div>`
  ).join("");
}

function statusColor(s) {
  if (s === "On Track") return "var(--green)";
  if (s === "Needs Attention") return "var(--amber)";
  if (s === "At Risk") return "var(--red)";
  return "inherit";
}

function renderPillarChart() {
  const d = state.filtered;
  const prog = d.map(x => x.ProgrammaticScore).filter(v => v != null);
  const mel = d.map(x => x.MELScore).filter(v => v != null);
  const avg = arr => arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;

  if (state.charts.pillar) state.charts.pillar.destroy();

  state.charts.pillar = new Chart(document.getElementById("pillarChart"), {
    type: "bar",
    data: {
      labels: ["Programmatic", "MEL"],
      datasets: [{
        label: "Avg score (%)",
        data: [avg(prog), avg(mel)],
        backgroundColor: ["#1E88E5", "#7B1FA2"],
      }],
    },
    options: {
      indexAxis: "y",
      scales: { x: { max: 100 } },
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
    },
  });
}

function renderStageChart() {
  const d = state.filtered;
  const stages = ["Startup", "Implementation", "Closeout"];
  const values = stages.map(s => {
    const arr = d.map(x => x[`${s}Score`]).filter(v => v != null);
    return arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 0;
  });

  if (state.charts.stage) state.charts.stage.destroy();

  state.charts.stage = new Chart(document.getElementById("stageChart"), {
    type: "bar",
    data: {
      labels: stages,
      datasets: [{
        label: "Avg score (%)",
        data: values,
        backgroundColor: ["#3C6B52", "#294B39", "#1F3D2E"],
      }],
    },
    options: {
      scales: { y: { max: 100 } },
      plugins: { legend: { display: false } },
      maintainAspectRatio: false,
    },
  });
}

function renderPerformanceLog() {
  const rows = state.filtered.slice().reverse();
  const body = rows.map((d, i) => {
    const prevInOrder = state.filtered[state.filtered.length - 2 - i];
    const prev = prevInOrder ? prevInOrder.SubmissionScore : null;
    let progressCell = "-";
    if (d.SubmissionScore != null && prev != null) {
      const change = d.SubmissionScore - prev;
      if (Math.abs(change) < 0.05) progressCell = '<span class="progress-flat">● 0.0%</span>';
      else if (change > 0) progressCell = `<span class="progress-up">▲ +${change.toFixed(1)}%</span>`;
      else progressCell = `<span class="progress-down">▼ ${change.toFixed(1)}%</span>`;
    }
    const cls = (d.ProjectStatus || "").toLowerCase().replace(" ", "-");
    return `<tr>
      <td>${d.today || (d._submission_time || "").slice(0, 10)}</td>
      <td class="tabular">${d.SubmissionScore ?? "—"}%</td>
      <td><span class="badge ${cls}">${d.ProjectStatus || "—"}</span></td>
      <td class="tabular">${d.ConcernCount ?? 0}</td>
      <td><span class="badge ${(d.RiskCategory || "").toLowerCase()}">${d.RiskCategory || "—"}</span></td>
      <td>${progressCell}</td>
    </tr>`;
  }).join("");

  document.getElementById("logBody").innerHTML = body || "<tr><td colspan='6'>No submissions yet</td></tr>";
}

function renderConcerns() {
  const latest = state.filtered[state.filtered.length - 1] || {};
  const concerns = latest.ConcernQuestions || [];
  document.querySelector("#concernsTable tbody").innerHTML = concerns.length
    ? concerns.map(c => `<tr><td>${c.stage || "—"}</td><td>${c.pillar || "—"}</td><td>${c.issue || c.question}</td></tr>`).join("")
    : "<tr><td colspan='3'>No concerns flagged in the latest submission</td></tr>";
}

function renderResponses() {
  const latest = state.filtered[state.filtered.length - 1] || {};
  const rows = [];
  Object.keys(latest).forEach(k => {
    if (!k.endsWith("_AnswerC")) return;
    const q = k.replace("_AnswerC", "");
    rows.push({ question: q, answer: latest[q], score: latest[k], concern: latest[`${q}_IsConcern`] });
  });

  const search = document.getElementById("responseSearch").value.toLowerCase();
  const filtered = search ? rows.filter(r => r.question.toLowerCase().includes(search)) : rows;

  document.querySelector("#responsesTable tbody").innerHTML = filtered.length
    ? filtered.map(r => {
        const cls = r.score == null ? "amber" : r.score === 1 ? "green" : "red";
        return `<tr><td>${r.question}</td><td>${r.answer ?? "—"}</td><td><span class="badge ${cls}">${r.score ?? "—"}</span></td><td>${r.concern ? '<span class="badge red">Concern</span>' : "<span class=\"badge green\">OK</span>"}</td></tr>`;
      }).join("")
    : "<tr><td colspan='4'>No responses</td></tr>";
}

document.addEventListener("DOMContentLoaded", () => {
  init().then(() => {
    const searchBox = document.getElementById("responseSearch");
    if (searchBox) {
      searchBox.addEventListener("input", renderResponses);
    }
  });
});
