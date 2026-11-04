<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Help · QA Dashboard</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">Q</div>
        <div class="brand-text">
          <h1>QA Dashboard</h1>
          <p>Help &amp; glossary</p>
        </div>
      </div>
      <div class="side-block">
        <p class="side-label">Navigate</p>
        <a class="side-link" href="index.html">Overview</a>
        <a class="side-link" href="project.html">Project diagnostics</a>
        <a class="side-link" href="help.html">Help &amp; glossary</a>
      </div>
    </aside>

    <main class="main">
      <div class="topbar">
        <div>
          <div class="page-switcher" aria-label="Dashboard sections">
            <a class="nav-pill" href="index.html">Overview</a>
            <a class="nav-pill" href="project.html">Projects</a>
            <a class="nav-pill active" href="help.html">Help</a>
          </div>
          <h2>Help &amp; glossary</h2>
        </div>
      </div>

      <section class="card">
        <h3>Overview</h3>
        <p>The QA dashboard tracks project quality across active Pathfinder initiatives using a standard checklist submitted through KoboToolbox. It highlights progress, performance, and risks across regions, countries, and projects.</p>
      </section>

      <section class="card">
        <h3>Key metrics</h3>
        <table>
          <thead><tr><th>Metric</th><th>Definition</th></tr></thead>
          <tbody>
            <tr><td>Overall QA score</td><td>Average of all scored answers across the filtered scope.</td></tr>
            <tr><td>Submission score</td><td>Percentage of compliant answers in one checklist.</td></tr>
            <tr><td>On Track</td><td>Latest score of 80% or higher.</td></tr>
            <tr><td>Needs Attention</td><td>Latest score from 60% to 79%.</td></tr>
            <tr><td>At Risk</td><td>Latest score below 60%.</td></tr>
            <tr><td>Concern</td><td>Negative answer to a question flagged as a concern.</td></tr>
            <tr><td>Risk score</td><td>(Concerns × 2) + ((1 − Score) × 10)</td></tr>
            <tr><td>Programmatic score</td><td>Average of Programmatic-pillar answers.</td></tr>
            <tr><td>MEL score</td><td>Average of MEL-pillar answers.</td></tr>
            <tr><td>Startup / Implementation / Closeout</td><td>Average of questions in that project stage.</td></tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h3>Scoring methodology</h3>
        <ul>
          <li>Each scored question is counted as 1 (compliant) or 0 (non-compliant).</li>
          <li>Reverse-scored questions are flipped before the score is calculated.</li>
          <li>Neutral questions are excluded from the score denominator.</li>
          <li>Questions with no score value are ignored.</li>
        </ul>
      </section>

      <section class="card">
        <h3>FAQ</h3>
        <p><strong>How often does data refresh?</strong> Daily at 06:00 UTC.</p>
        <p><strong>Why is a high-scoring project still at risk?</strong> The risk model weighs concerns and deficit heavily.</p>
        <p><strong>How do I drill into a project?</strong> Click any project row in the overview table to open the project diagnostics page.</p>
      </section>
    </main>
  </div>
</body>
</html>
