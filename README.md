# Delaware Student Outcomes Dashboard

This project is now a dependency-free front end for comparing live Delaware data for:

- Student attendance
- Student achievement
- Educator mobility

The UI is scoped for:

- Red Clay Consolidated School District
- Brandywine School District
- Christina School District
- Delaware charter schools

The live endpoints currently wired into the app are:

- Student achievement: [ms6b-mt82](https://data.delaware.gov/resource/ms6b-mt82.json)
- Student attendance: [crb4-kdc7](https://data.delaware.gov/resource/crb4-kdc7.json)
- Educator mobility: [jdcc-w6wr](https://data.delaware.gov/resource/jdcc-w6wr.json)

## Run it

Serve the folder over a local web server:

```bash
cd /Users/markbaxter/Documents/Playground/naep-dashboard
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Publish on GitHub Pages

This folder is now set up for GitHub Pages with [pages.yml](/Users/markbaxter/Documents/Playground/naep-dashboard/.github/workflows/pages.yml).

1. Create a GitHub repository for this project.
2. Push the contents of [naep-dashboard](/Users/markbaxter/Documents/Playground/naep-dashboard) to the `main` branch.
3. In GitHub, open `Settings -> Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Push to `main` again if needed, or run the `Deploy GitHub Pages` workflow manually.
6. GitHub will publish the site at `https://<your-user>.github.io/<repo-name>/`.

Because the app uses relative asset paths like `./app.js` and `./styles.css`, it works correctly from a GitHub Pages project subpath.

If the live Delaware APIs block browser requests from GitHub Pages, the page will load but the data requests will fail. In that case the next step is adding a small proxy backend.

## Current behavior

- `config.js` controls the live API endpoints and dashboard scope.
- `data/delaware-dashboard-sample.json` is the local fallback dataset.
- `app.js` paginates Socrata data with `$limit` and `$offset`.
- The live queries are server-filtered to district codes `31`, `32`, `33`, plus Delaware charter LEAs (`districtcode >= 9000`) so the browser is not forced to download the full statewide datasets.
- Achievement rows are the base dataset.
- Attendance joins on `year + organization + race + gender + grade + specialdemo + geography`.
- Mobility joins on `year + organization`.
- The attendance KPI is derived as `((avgdaysenrolled - avgdaysabsent) / avgdaysenrolled) * 100`.
- Mobility uses the aggregate educator row filtered to:
  - `retention_type = One Year Percentage`
  - `staff_type = Professional`
  - `staff_category = Classroom Teacher`
  - `race/gender/grade/specialdemo/geography = All Educators`
  - `job_classification = ALL`
  - `experience_group = ALL`

## What the dashboard supports

- Filter by year, geography group, organization, assessment, content area, grade, race, gender, program, and geography
- Overlay scatter plot: attendance on X, achievement on Y, educator mobility as bubble size
- Comparison bars for the selected metric
- Multi-year trends for one organization
- A merged validation table showing the joined rows

## Next step

If you want, the next useful pass is to add:

- A toggle between derived attendance rate and chronic absenteeism
- Download/export for the filtered comparison table
- District versus charter median benchmark lines on the charts
