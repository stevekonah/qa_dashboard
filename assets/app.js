/* ============================================================
   QA Dashboard — Executive Overview
   ============================================================ */

const state = {
  data: [], filtered: [],
  filters: { region:"", country:"", project:"", funding:"", tech:"", stage:"", status:"", search:"" },
  sort: { key:"score", dir:"asc" },
  charts: {},
};

async function loadJSON(path, fallback) {
  try { const r = await fetch(path, {cache:"no-store"}); return r.ok ? await r.json() : fallback; }
  catch { return fallback; }
}

async function init() {
  const [data, meta] = await Promise.all([
    loadJSON("data/live_submissions_scored.json", []),
    loadJSON("data/live_meta.json", {}),
  ]);

  state.data = Array.isArray(data) ? data : [];
  state.filtered = state.data;

  if (!state.data.length) {
    document.getElementById("scopeLine").textContent = "No data available — refresh the dashboard";
    document.getElementById("updatedNote").textContent = "Awaiting first refresh";
    document.getElementById("statStrip").innerHTML = `
      <div class="stat-cell">
        <span class="num">—</span>
        <div class="lbl">No data yet</div>
        <div class="sub">Run the pipeline or refresh Kobo data</div>
      </div>
    `;
    document.querySelector("#projectsTable tbody").innerHTML = "<tr><td colspan='8'>No data available yet</td></tr>";
    return;
  }

  populateFilters();
  renderMeta(meta);
  wireEvents();
  render();
}

function populateFilters() {
  const d = state.data;
  const uniq = key => [...new Set(d.map(x => x[key]).filter(Boolean))].sort();
  fill("selRegion", uniq("meta_region").concat(uniq("region")));
  fill("selCountry", uniq("meta_country").concat(uniq("country")));
  fill("selProject", uniq("project"));
  fill("selFunding", uniq("meta_funding_source"));
  fill("selTech", uniq("meta_technical_area"));
}

function fill(id, values) {
  const sel = document.getElementById(id);
  [...new Set(values)].filter(Boolean).sort().forEach(v => {
    const o = document.createElement("option"); o.value = v; o.textContent = v; sel.appendChild(o);
  });
}

function wireEvents() {
  const map = { selRegion:"region", selCountry:"country", selProject:"project", selFunding:"funding", selTech:"tech", selStage:"stage", selStatus:"status" };
  Object.entries(map).forEach(([id, key]) => {
    document.getElementById(id).addEventListener("change", e => { state.filters[key] = e.target.value; applyFilters(); });
  });
  document.getElementById("projectSearch").addEventListener("input", e => {
    state.filters.search = e.target.value.toLowerCase(); render();
  });
  document.getElementById("btnReset").addEventListener("click", resetFilters);
  document.getElementById("btnExportExcel").addEventListener("click", () => exportExcel(state.filtered, state.filters));
  document.getElementById("btnExportWord").addEventListener("click", () => exportWord(state.filtered, state.filters));
  document.querySelectorAll("#projectsTable th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else { state.sort.key = key; state.sort.dir = "asc"; }
      renderProjectsTable();
    });
  });
}

function resetFilters() {
  state.filters = { region:"", country:"", project:"", funding:"", tech:"", stage:"", status:"", search:"" };
  ["selRegion","selCountry","selProject","selFunding","selTech","selStage","selStatus"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("projectSearch").value = "";
  applyFilters();
}

function stageMatches(row, stage) {
  if (!stage) return true;
  const key = `${stage}Score`;
  return row[key] != null;
}

function applyFilters() {
  const f = state.filters;
  state.filtered = state.data.filter(d => {
    const region = d.meta_region || d.region || "";
    const country = d.meta_country || d.country || "";
    return (!f.region || region === f.region)
      && (!f.country || country === f.country)
      && (!f.project || d.project === f.project)
      && (!f.funding || d.meta_funding_source === f.funding)
      && (!f.tech || d.meta_technical_area === f.tech)
      && (!f.stage || stageMatches(d, f.stage))
      && (!f.status || d.ProjectStatus === f.status);
  });
  render();
}

function render() {
  renderScope(); renderStats(); renderStatusChart(); renderCompletionChart();
  renderPillarGrid(); renderRiskTable(); renderConcernsTable(); renderProjectsTable();
}

function renderScope() {
  const n = state.filtered.length;
  const projects = new Set(state.filtered.map(d => d.project).filter(Boolean)).size;
  document.getElementById("scopeLine").textContent = `${n} checklist${n===1?"":"s"} · ${projects} project${projects===1?"":"s"}`;
}

function renderMeta(meta) {
  document.getElementById("updatedNote").textContent = meta.fetched_at ? "Updated " + new Date(meta.fetched_at).toLocaleString() : "Awaiting first refresh";
}

function renderStats() {
  const d = state.filtered;
  const scores = d.map(x => x.SubmissionScore).filter(s => s != null);
  const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "—";
  const statuses = { "On Track":0, "Needs Attention":0, "At Risk":0 };
  d.forEach(x => { if (statuses[x.ProjectStatus] != null) statuses[x.ProjectStatus]++; });
  const projects = new Set(d.map(x => x.project).filter(Boolean)).size;
  const cells = [
    { num: projects, lbl: "Projects Reporting", sub: "in scope" },
    { num: d.length, lbl: "Checklists Submitted", sub: "total" },
    { num: avg + "%", lbl: "Overall QA Score", sub: "average" },
    { num: statuses["On Track"], lbl: "On Track", sub: "≥ 80%", color:"var(--green)" },
    { num: statuses["Needs Attention"], lbl: "Needs Attention", sub: "60–79%", color:"var(--amber)" },
    { num: statuses["At Risk"], lbl: "At Risk", sub: "< 60%", color:"var(--red)" },
  ];
  document.getElementById("statStrip").innerHTML = cells.map(c =>
    `<div class="stat-cell"><span class="num" ${c.color?`style="color:${c.color}"`:""}>${c.num}</span><div class="lbl">${c.lbl}</div><div class="sub">${c.sub}</div></div>`
  ).join("");
}

function renderStatusChart() {
  const counts = { "On Track":0, "Needs Attention":0, "At Risk":0 };
  state.filtered.forEach(d => { if (counts[d.ProjectStatus] != null) counts[d.ProjectStatus]++; });
  const ctx = document.getElementById("statusChart");
  if (state.charts.status) state.charts.status.destroy();
  state.charts.status = new Chart(ctx, {
    type: "doughnut",
    data: { labels: Object.keys(counts), datasets:[{ data: Object.values(counts), backgroundColor:["#60BE97","#FEB64D","#E15759"] }] },
    options: { plugins:{ legend:{ position:"bottom" } }, maintainAspectRatio:false },
  });
}

function renderCompletionChart() {
  const byCountry = {};
  state.filtered.forEach(d => {
    const c = d.meta_country || d.country; if (!c) return;
    byCountry[c] = (byCountry[c] || 0) + 1;
  });
  const sorted = Object.entries(byCountry).sort((a,b)=>b[1]-a[1]);
  const ctx = document.getElementById("completionChart");
  if (state.charts.completion) state.charts.completion.destroy();
  state.charts.completion = new Chart(ctx, {
    type: "bar",
    data: { labels: sorted.map(x=>x[0]), datasets:[{ label:"Checklists", data: sorted.map(x=>x[1]), backgroundColor:"#1E88E5" }] },
    options: { indexAxis:"y", plugins:{ legend:{ display:false } }, maintainAspectRatio:false },
  });
}

function renderPillarGrid() {
  const d = state.filtered;
  const pillars = [
    { key:"ProgrammaticScore", label:"Programmatic", color:"#1E88E5" },
    { key:"MELScore", label:"MEL", color:"#7B1FA2" },
    { key:null, label:"Stages", custom:true },
  ];
  document.getElementById("pillarGrid").innerHTML = pillars.map(p => {
    if (p.custom) {
      const stages = ["Startup","Implementation","Closeout"];
      return stages.map(s => {
        const key = `${s}Score`;
        const scores = d.map(x => x[key]).filter(v => v != null);
        const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "—";
        const pct = avg === "—" ? 0 : Number(avg);
        const color = pct>=80?"var(--green)":pct>=60?"var(--amber)":"var(--red)";
        return `<div class="pillar-cell">
          <div class="pl">${s} Stage</div>
          <div class="pv" style="color:${color}">${avg}${avg==="—"?"":"%"}</div>
          <div class="pt"><div style="width:${Math.min(100,pct)}%;background:${color}"></div></div>
          <div class="pf">${scores.length} submission${scores.length===1?"":"s"} scored</div>
        </div>`;
      }).join("");
    }
    const scores = d.map(x => x[p.key]).filter(v => v != null);
    const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "—";
    const pct = avg === "—" ? 0 : Number(avg);
    const color = pct>=80?"var(--green)":pct>=60?"var(--amber)":"var(--red)";
    return `<div class="pillar-cell">
      <div class="pl">${p.label} Pillar</div>
      <div class="pv" style="color:${color}">${avg}${avg==="—"?"":"%"}</div>
      <div class="pt"><div style="width:${Math.min(100,pct)}%;background:${color}"></div></div>
      <div class="pf">${scores.length} submission${scores.length===1?"":"s"} scored</div>
    </div>`;
  }).join("");
}

function renderRiskTable() {
  const atRisk = state.filtered.filter(d => d.ProjectStatus === "At Risk");
  document.querySelector("#riskTable tbody").innerHTML = atRisk.length
    ? atRisk.map(d => `<tr><td>${d.meta_country || d.country || "—"}</td><td>${d.project || "—"}</td><td class="tabular">${d.SubmissionScore ?? "—"}%</td><td><span class="badge ${(d.RiskCategory || "Low").toLowerCase()}">${d.RiskCategory || "—"}</span></td></tr>`).join("")
    : "<tr><td colspan='4'>No projects at risk 🎉</td></tr>";
}

function renderConcernsTable() {
  const counts = {};
  state.filtered.forEach(d => {
    (d.ConcernQuestions || []).forEach(c => {
      const key = c.issue || c.question;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  document.querySelector("#concernsTable tbody").innerHTML = sorted.length
    ? sorted.map(([issue,n]) => `<tr><td>${issue}</td><td class="tabular">${n}</td></tr>`).join("")
    : "<tr><td colspan='2'>No concerns in scope</td></tr>";
}

function renderProjectsTable() {
  let rows = state.filtered.slice();
  const q = state.filters.search;
  if (q) rows = rows.filter(d => (d.project||"").toLowerCase().includes(q) || (d.meta_country||d.country||"").toLowerCase().includes(q));
  const dir = state.sort.dir === "asc" ? 1 : -1;
  const key = state.sort.key;
  const accessor = {
    country: d => d.meta_country || d.country || "",
    project: d => d.project || "",
    funding: d => d.meta_funding_source || "",
    amount: d => Number(d.meta_amount) || 0,
    score: d => d.SubmissionScore || 0,
    status: d => d.ProjectStatus || "",
    concerns: d => d.ConcernCount || 0,
    risk: d => d.RiskScore || 0,
  }[key] || (d => d.SubmissionScore || 0);
  rows.sort((a,b) => {
    const va = accessor(a), vb = accessor(b);
    if (va < vb) return -1*dir; if (va > vb) return 1*dir; return 0;
  });
  document.querySelector("#projectsTable tbody").innerHTML = rows.length
    ? rows.map(d => {
        const cls = (d.ProjectStatus||"").toLowerCase().replace(" ","-");
        const riskCls = (d.RiskCategory||"").toLowerCase();
        return `<tr data-project="${d.project||""}">
          <td>${d.meta_country || d.country || "—"}</td>
          <td><b>${d.project || "—"}</b></td>
          <td>${d.meta_funding_source || "—"}</td>
          <td class="tabular">${formatAmount(d.meta_amount)}</td>
          <td class="tabular">${d.SubmissionScore ?? "—"}%</td>
          <td><span class="badge ${cls}">${d.ProjectStatus || "—"}</span></td>
          <td class="tabular">${d.ConcernCount ?? 0}</td>
          <td><span class="badge ${riskCls}">${d.RiskCategory || "—"}</span></td>
        </tr>`;
      }).join("")
    : "<tr><td colspan='8'>No projects match your filter</td></tr>";
  document.querySelectorAll("#projectsTable tbody tr[data-project]").forEach(tr => {
    tr.addEventListener("click", () => {
      const p = tr.dataset.project;
      if (p) window.location.href = `project.html?project=${encodeURIComponent(p)}`;
    });
  });
}

function formatAmount(n) {
  if (n == null || n === "") return "—";
  const v = Number(n); if (isNaN(v)) return "—";
  if (v >= 1_000_000) return "$" + (v/1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return "$" + (v/1_000).toFixed(0) + "K";
  return "$" + v;
}

document.addEventListener("DOMContentLoaded", init);

