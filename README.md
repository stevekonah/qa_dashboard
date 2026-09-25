# Pathfinder QA Dashboard

A Python + static-site quality assurance dashboard pulling from KoboToolbox.

## Architecture

- **Python scripts** pull submissions and apply scoring rules
- **Excel file** `scoring/Scoring Checklist.xlsx` holds scoring rules, active projects, and issue tracking
- **GitHub Actions** runs the pipeline daily at 06:00 UTC
- **GitHub Pages** serves the static dashboard

## Pages

- `/index.html` — Executive Overview (KPIs, filters, projects table, exports)
- `/project.html` — Project Diagnostics (pillar, stage, log, concerns, responses)
- `/help.html` — Glossary and metric definitions

## Local development

```bash
pip install openpyxl
export KOBO_API_TOKEN="your_token"
python scripts/run_pipeline.py
python -m http.server 8000