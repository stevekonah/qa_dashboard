/* ============================================================
   Excel & Word export utilities
   Requires SheetJS (xlsx.full.min.js)
   ============================================================ */

function buildScopeLabel(filters) {
  const parts = [];
  if (filters.region) parts.push(filters.region);
  if (filters.country) parts.push(filters.country);
  if (filters.project) parts.push(filters.project);
  if (filters.status) parts.push(filters.status);
  return parts.length ? parts.join(" · ") : "All scopes";
}

function exportFileName(base) {
  const stamp = new Date().toISOString().slice(0,10);
  const slug = base.replace(/[^a-z0-9]+/gi,"_").replace(/^_+|_+$/g,"").slice(0,60);
  return `${slug}_${stamp}`;
}

function exportExcel(data, filters) {
  if (!window.XLSX) { alert("Export library not loaded."); return; }
  const scope = buildScopeLabel(filters);
  const wb = XLSX.utils.book_new();

  const subHeaders = ["Submission ID","Date","Project","Region","Country","Funding Source","Technical Area","Amount","Project Lead","Score (%)","Status","Concerns","Risk Score","Risk Category","Programmatic Score","MEL Score","Startup Score","Implementation Score","Closeout Score"];
  const subRows = data.map(d => [
    d._id || d._uuid || "",
    d.today || (d._submission_time || "").slice(0,10),
    d.project || "", d.meta_region || "", d.meta_country || "",
    d.meta_funding_source || "", d.meta_technical_area || "",
    d.meta_amount || "", d.meta_project_lead || "",
    d.SubmissionScore ?? "", d.ProjectStatus || "",
    d.ConcernCount ?? 0, d.RiskScore ?? "", d.RiskCategory || "",
    d.ProgrammaticScore ?? "", d.MELScore ?? "",
    d.StartupScore ?? "", d.ImplementationScore ?? "", d.CloseoutScore ?? "",
  ]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([subHeaders, ...subRows]), "Submissions");

  const concernHeaders = ["Project","Country","Stage","Pillar","Issue"];
  const concernRows = [];
  data.forEach(d => (d.ConcernQuestions || []).forEach(c => {
    concernRows.push([d.project || "", d.meta_country || d.country || "", c.stage || "", c.pillar || "", c.issue || c.question || ""]);
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([concernHeaders, ...concernRows]), "Concerns");

  const scores = data.map(d => d.SubmissionScore).filter(s => s != null);
  const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "—";
  const statuses = { "On Track":0, "Needs Attention":0, "At Risk":0 };
  data.forEach(d => { if (statuses[d.ProjectStatus] != null) statuses[d.ProjectStatus]++; });
  const projects = new Set(data.map(d => d.project).filter(Boolean)).size;

  const summary = [
    ["Metric","Value"], ["Scope", scope], ["Projects reporting", projects],
    ["Checklists submitted", data.length], ["Overall QA score", avg + "%"],
    ["On Track", statuses["On Track"]], ["Needs Attention", statuses["Needs Attention"]],
    ["At Risk", statuses["At Risk"]], ["Export date", new Date().toISOString().slice(0,19).replace("T"," ")],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  XLSX.writeFile(wb, exportFileName("qa_dashboard_" + scope) + ".xlsx");
}

function exportWord(data, filters) {
  const scope = buildScopeLabel(filters);
  const genDate = new Date().toLocaleString();
  const scores = data.map(d => d.SubmissionScore).filter(s => s != null);
  const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "—";
  const statuses = { "On Track":0, "Needs Attention":0, "At Risk":0 };
  data.forEach(d => { if (statuses[d.ProjectStatus] != null) statuses[d.ProjectStatus]++; });
  const projects = new Set(data.map(d => d.project).filter(Boolean)).size;

  const concernCounts = {};
  data.forEach(d => (d.ConcernQuestions || []).forEach(c => {
    const key = c.issue || c.question;
    concernCounts[key] = (concernCounts[key] || 0) + 1;
  }));
  const topConcerns = Object.entries(concernCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const atRisk = data.filter(d => d.ProjectStatus === "At Risk");

  const table = (headers, rows) => `<table>
    <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>QA Dashboard Report — ${scope}</title>
<style>
@page{size:21cm 29.7cm;margin:2.4cm}
body{font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#1C241F;font-size:11pt;line-height:1.5}
h1{font-family:Cambria,Georgia,serif;font-size:22pt;color:#1F3D2E;margin:0 0 4pt}
h2{font-size:13pt;font-weight:bold;text-transform:uppercase;letter-spacing:.3pt;color:#1F3D2E;border-bottom:1.5pt solid #1F3D2E;padding-bottom:5pt;margin:20pt 0 12pt}
p{margin:0 0 10pt;text-align:justify}
table{border-collapse:collapse;width:100%;margin:6pt 0 16pt}
th,td{border:.75pt solid #B9C2B6;padding:6pt 9pt;font-size:10pt;text-align:left;vertical-align:top}
th{background:#1F3D2E;color:#FFF;font-weight:bold;text-transform:uppercase;font-size:9pt}
tr:nth-child(even) td{background:#F2F5F1}
.cover{text-align:center;padding-top:120px}
.cover-badge{font-size:10pt;letter-spacing:2pt;color:#5A6459;margin-bottom:40pt;text-transform:uppercase}
.cover-title{font-family:Cambria,Georgia,serif;font-size:24pt;color:#1C241F;margin:0 0 8pt}
.cover-sub{font-size:14pt;color:#294B39;margin-bottom:36pt}
.cover-meta{display:inline-block;border:.75pt solid #B9C2B6;padding:14pt 22pt;text-align:left}
.cover-meta div{font-size:10.5pt;color:#3A443E;line-height:1.9}
.kpi-strip{display:flex;gap:14pt;flex-wrap:wrap;margin:14pt 0}
.kpi{flex:1;min-width:110pt;border:.75pt solid #B9C2B6;padding:10pt 12pt;background:#FBFAF4}
.kpi .num{font-family:Cambria,Georgia,serif;font-size:20pt;font-weight:600;color:#1F3D2E;display:block}
.kpi .lbl{font-size:9pt;color:#5A6459;text-transform:uppercase;letter-spacing:.05em}
.pagebreak{page-break-before:always}
</style></head><body>

<div class="cover">
  <div class="cover-badge">Pathfinder International · Quality Assurance</div>
  <h1 class="cover-title">QA Dashboard Report</h1>
  <div class="cover-sub">Scope: ${scope}</div>
  <div class="cover-meta">
    <div><b>Reporting scope:</b> ${scope}</div>
    <div><b>Generated:</b> ${genDate}</div>
    <div><b>Checklists in scope:</b> ${data.length}</div>
    <div><b>Projects reporting:</b> ${projects}</div>
  </div>
</div>
<div class="pagebreak"></div>

<h2>1. Executive Summary</h2>
<p>This report summarises QA performance for <b>${scope}</b>.
A total of <b>${data.length}</b> checklists were submitted across <b>${projects}</b> projects,
with an average overall QA score of <b>${avg}%</b>.
${statuses["On Track"]} projects are On Track, ${statuses["Needs Attention"]} need attention, and ${statuses["At Risk"]} are At Risk.</p>

<div class="kpi-strip">
  <div class="kpi"><span class="num">${projects}</span><div class="lbl">Projects reporting</div></div>
  <div class="kpi"><span class="num">${data.length}</span><div class="lbl">Checklists</div></div>
  <div class="kpi"><span class="num">${avg}%</span><div class="lbl">Overall QA score</div></div>
  <div class="kpi"><span class="num">${statuses["At Risk"]}</span><div class="lbl">At Risk</div></div>
</div>

<h2>2. Projects At Risk</h2>
${atRisk.length ? table(["Country","Project","Score","Risk","Concerns"],
  atRisk.map(d => [d.meta_country || d.country || "—", d.project || "—", (d.SubmissionScore ?? "—") + "%", d.RiskCategory || "—", d.ConcernCount ?? 0]))
  : "<p>No projects at risk in the current scope.</p>"}

<h2>3. Top Concerns</h2>
${topConcerns.length ? table(["Issue","Frequency"], topConcerns.map(([i,n])=>[i,n])) : "<p>No concerns flagged.</p>"}

<h2>4. All Projects</h2>
${table(["Country","Project","Score","Status","Concerns","Risk"],
  data.map(d => [d.meta_country || d.country || "—", d.project || "—", (d.SubmissionScore ?? "—") + "%", d.ProjectStatus || "—", d.ConcernCount ?? 0, d.RiskCategory || "—"]))}

</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName("qa_dashboard_report_" + scope) + ".doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}