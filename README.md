# Pathfinder QA Dashboard

A Python-powered quality assurance dashboard for Pathfinder projects. It loads checklist submissions from KoboToolbox, applies the scoring rules, and serves an interactive static dashboard.

## Dashboard pages

- **Executive overview** (`index.html`): portfolio KPIs, status and country charts, pillar/stage performance, concerns, and a searchable projects table.
- **Project diagnostics** (`project.html`): project-specific scores, performance history, flagged concerns, and checklist responses. Open it from a project row or select a project on the page.
- **Help & glossary** (`help.html`): metric definitions and scoring methodology.

## Filters

The overview provides filters for region, country, project, funder, technical area, year, quarter, stage, and status. Filter values are normalized for display to avoid duplicate options caused by inconsistent capitalization, spacing, underscores, or separators. Use **Reset filters** to clear the selections. Excel and Word exports use the current filtered submissions.

Year and quarter values are read from the submission fields (`year`/`meta_year` and `quarter`/`meta_quarter`).

## Scoring

The pipeline reads scoring rules and metadata from `scoring/Scoring Checklist.xlsx` and writes scored submissions for the dashboard.

- Reverse-coded questions are listed in `config.py` as `REVERSE_QUESTIONS`; their checklist score is inverted before aggregation.
- Neutral questions are listed as `NEUTRAL_QUESTIONS`; they remain available in response data but are excluded from submission, stage, and pillar score calculations.
- Remaining scored answers contribute equally to their applicable aggregates. Concern flags are tracked separately for risk reporting.

After changing scoring rules or question lists, rerun the pipeline to regenerate `data/live_submissions_scored.json` before reviewing the dashboard.

## Data pipeline

- `scripts/fetch_kobo_data.py` retrieves submissions from KoboToolbox.
- `scripts/load_scoring_files.py` reads the scoring workbook and creates the JSON rule and project files.
- `scripts/apply_scoring.py` applies scoring rules and project metadata.
- `scripts/run_pipeline.py` runs the pipeline steps.
- GitHub Actions is configured to run the data refresh daily; GitHub Pages serves the static dashboard.

## Local development

Python 3 and the project dependencies are required. Install dependencies and set a Kobo API token before running the pipeline:

```bash
pip install -r requirements.txt
export KOBO_API_TOKEN="your_token"
python scripts/run_pipeline.py
python -m http.server 8000
```

Open <http://localhost:8000> to view the dashboard. The dashboard loads its JSON data files from `data/`.

## Tests

Run the Python test suite from the repository root:

```bash
pytest
```

The tests cover configuration, scoring/pipeline behavior, and a smoke check. They do not replace browser testing of charts, filters, navigation, or exports.
