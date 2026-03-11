const config = window.DELAWARE_DASHBOARD_CONFIG;

const METRIC_OPTIONS = [
  { value: "achievementRate", label: "Achievement rate" },
  { value: "attendanceRate", label: "Attendance rate" },
  { value: "educatorMobilityRate", label: "Educator mobility rate" },
];

const state = {
  rows: [],
  filters: {
    year: "All",
    group: "All",
    organization: "All",
    assessmentName: "All",
    contentArea: "All",
    grade: "All",
    race: "All Students",
    gender: "All Students",
    specialDemo: "All Students",
    geography: "All Students",
    metric: "achievementRate",
  },
};

const elements = {
  statusPill: document.querySelector("#statusPill"),
  heroFocus: document.querySelector("#heroFocus"),
  heroDetail: document.querySelector("#heroDetail"),
  heroNote: document.querySelector("#heroNote"),
  achievementValue: document.querySelector("#achievementValue"),
  achievementNote: document.querySelector("#achievementNote"),
  attendanceValue: document.querySelector("#attendanceValue"),
  attendanceNote: document.querySelector("#attendanceNote"),
  mobilityValue: document.querySelector("#mobilityValue"),
  mobilityNote: document.querySelector("#mobilityNote"),
  coverageValue: document.querySelector("#coverageValue"),
  coverageNote: document.querySelector("#coverageNote"),
  scatterCaption: document.querySelector("#scatterCaption"),
  comparisonCaption: document.querySelector("#comparisonCaption"),
  trendCaption: document.querySelector("#trendCaption"),
  insightsList: document.querySelector("#insightsList"),
  tableCaption: document.querySelector("#tableCaption"),
  dataTableBody: document.querySelector("#dataTableBody"),
  scatterChart: document.querySelector("#scatterChart"),
  comparisonChart: document.querySelector("#comparisonChart"),
  trendChart: document.querySelector("#trendChart"),
  resetFilters: document.querySelector("#resetFilters"),
  selects: {
    year: document.querySelector("#yearFilter"),
    group: document.querySelector("#groupFilter"),
    organization: document.querySelector("#organizationFilter"),
    assessmentName: document.querySelector("#assessmentFilter"),
    contentArea: document.querySelector("#contentFilter"),
    grade: document.querySelector("#gradeFilter"),
    race: document.querySelector("#raceFilter"),
    gender: document.querySelector("#genderFilter"),
    specialDemo: document.querySelector("#specialDemoFilter"),
    geography: document.querySelector("#geographyFilter"),
    metric: document.querySelector("#metricFilter"),
  },
};

init();

async function init() {
  try {
    updateStatus("Loading live data");
    state.rows = config.useSampleData ? await loadSampleRows() : await loadLiveRows();
    applyDefaultFilters();
    syncFilters();
    populateControls();
    bindEvents();
    updateStatus(config.useSampleData ? "Sample data" : "Live data");
    render();
  } catch (error) {
    console.error(error);
    updateStatus("Load failed");
    renderError(error);
  }
}

async function loadSampleRows() {
  const response = await fetch(config.sampleDataUrl);
  if (!response.ok) {
    throw new Error(`Unable to load sample data: ${response.status}`);
  }
  const payload = await response.json();
  return payload.rows ?? [];
}

async function loadLiveRows() {
  const [achievementRows, attendanceRows, mobilityRows] = await Promise.all([
    fetchDataset(config.sources.achievement),
    fetchDataset(config.sources.attendance),
    fetchDataset(config.sources.mobility),
  ]);

  const attendanceMap = new Map();
  attendanceRows
    .map(normalizeAttendanceRow)
    .filter(Boolean)
    .forEach((row) => attendanceMap.set(attendanceKey(row), row));

  const mobilityMap = new Map();
  mobilityRows
    .map(normalizeMobilityRow)
    .filter(Boolean)
    .forEach((row) => mobilityMap.set(mobilityKey(row), row));

  return achievementRows
    .map(normalizeAchievementRow)
    .filter(Boolean)
    .map((row) => {
      const attendance = attendanceMap.get(attendanceKey(row));
      const mobility = mobilityMap.get(mobilityKey(row));

      return {
        ...row,
        attendanceRate: attendance?.attendanceRate ?? null,
        chronicAbsenceRate: attendance?.chronicAbsenceRate ?? null,
        educatorMobilityRate: mobility?.educatorMobilityRate ?? null,
      };
    });
}

async function fetchDataset(source) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = buildSourceUrl(source, offset);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load ${source.label}: ${response.status}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < source.pageSize) {
      break;
    }
    offset += source.pageSize;
  }

  return rows;
}

function buildSourceUrl(source, offset) {
  const url = new URL(source.url);
  const params = new URLSearchParams(source.query);
  params.forEach((value, key) => url.searchParams.set(key, value));
  url.searchParams.set("$limit", source.pageSize);
  url.searchParams.set("$offset", offset);
  return url.toString();
}

function normalizeAchievementRow(row) {
  if (!isInScope(row.districtcode, row.organization)) {
    return null;
  }

  return {
    year: String(row.schoolyear),
    districtCode: String(row.districtcode),
    group: deriveGroup(row.districtcode, row.organization),
    organization: row.organization,
    assessmentName: row.assessmentname,
    contentArea: row.contentarea,
    grade: row.grade,
    race: row.race,
    gender: row.gender,
    specialDemo: row.specialdemo,
    geography: row.geography,
    subgroup: row.subgroup,
    tested: toNumber(row.tested),
    proficient: toNumber(row.proficient),
    achievementRate: toNumber(row.pctproficient),
    scaleScoreAvg: toNumber(row.scalescoreavg),
  };
}

function normalizeAttendanceRow(row) {
  if (!isInScope(row.districtcode, row.organization)) {
    return null;
  }

  const enrolled = toNumber(row.avgdaysenrolled);
  const absent = toNumber(row.avgdaysabsent);
  const attendanceRate =
    Number.isFinite(enrolled) && enrolled > 0 && Number.isFinite(absent)
      ? ((enrolled - absent) / enrolled) * 100
      : null;

  return {
    year: String(row.schoolyear),
    organization: row.organization,
    race: row.race,
    gender: row.gender,
    grade: row.grade,
    specialDemo: row.specialdemo,
    geography: row.geography,
    attendanceRate,
    chronicAbsenceRate: toNumber(row.pctstudentschronicallyabsent),
  };
}

function normalizeMobilityRow(row) {
  if (!isInScope(row.districtcode, row.organization)) {
    return null;
  }

  const staffCount = toNumber(row.total_number_of_staff);
  if (!Number.isFinite(staffCount) || staffCount <= 0) {
    return null;
  }

  return {
    year: String(row.schoolyear),
    organization: row.organization,
    educatorMobilityRate: toNumber(row.turnover_rate),
  };
}

function attendanceKey(row) {
  return [
    row.year,
    row.organization,
    row.race,
    row.gender,
    row.grade,
    row.specialDemo,
    row.geography,
  ].join("::");
}

function mobilityKey(row) {
  return [row.year, row.organization].join("::");
}

function isInScope(districtCode, organization) {
  const code = String(districtCode ?? "");
  const numericCode = Number(code);
  const inDistricts = config.focusDistrictCodes.includes(code);
  const inCharters = Number.isFinite(numericCode) && numericCode >= config.charterDistrictCodeFloor;
  const namedDistrict = config.focusDistricts.includes(String(organization ?? ""));
  return inDistricts || inCharters || namedDistrict;
}

function deriveGroup(districtCode, organization) {
  if (config.focusDistricts.includes(String(organization ?? ""))) {
    return "Focus Districts";
  }
  return Number(districtCode) >= config.charterDistrictCodeFloor ? "Charter Schools" : "Other";
}

function applyDefaultFilters() {
  const defaultYear = latestYearWithAllMetrics();
  state.filters.year = defaultYear ?? "All";
  state.filters.assessmentName = hasValue("assessmentName", "Delaware System of Student Assessment (DeSSA)")
    ? "Delaware System of Student Assessment (DeSSA)"
    : "All";
  state.filters.contentArea = hasValue("contentArea", "ELA") ? "ELA" : "All";
  state.filters.grade = "All";
  state.filters.race = hasValue("race", "All Students") ? "All Students" : "All";
  state.filters.gender = hasValue("gender", "All Students") ? "All Students" : "All";
  state.filters.specialDemo = hasValue("specialDemo", "All Students") ? "All Students" : "All";
  state.filters.geography = hasValue("geography", "All Students") ? "All Students" : "All";
}

function latestYearWithAllMetrics() {
  const years = state.rows
    .filter(
      (row) =>
        row.achievementRate !== null &&
        row.attendanceRate !== null &&
        row.educatorMobilityRate !== null,
    )
    .map((row) => Number(row.year))
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  return years.length ? String(years[0]) : null;
}

function hasValue(field, value) {
  return state.rows.some((row) => row[field] === value);
}

function bindEvents() {
  Object.entries(elements.selects).forEach(([field, select]) => {
    select.addEventListener("change", (event) => {
      state.filters[field] = event.target.value;
      syncFilters();
      populateControls();
      render();
    });
  });

  elements.resetFilters.addEventListener("click", () => {
    state.filters = {
      year: "All",
      group: "All",
      organization: "All",
      assessmentName: "All",
      contentArea: "All",
      grade: "All",
      race: "All Students",
      gender: "All Students",
      specialDemo: "All Students",
      geography: "All Students",
      metric: "achievementRate",
    };
    applyDefaultFilters();
    syncFilters();
    populateControls();
    render();
  });
}

function populateControls() {
  [
    "year",
    "group",
    "organization",
    "assessmentName",
    "contentArea",
    "grade",
    "race",
    "gender",
    "specialDemo",
    "geography",
  ].forEach((field) => populateSelect(field, getAvailableValues(field)));

  elements.selects.metric.innerHTML = METRIC_OPTIONS.map(
    (option) =>
      `<option value="${option.value}" ${option.value === state.filters.metric ? "selected" : ""}>${option.label}</option>`,
  ).join("");
}

function populateSelect(field, values) {
  elements.selects[field].innerHTML = values
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}" ${value === state.filters[field] ? "selected" : ""}>${escapeHtml(value)}</option>`,
    )
    .join("");
}

function getAvailableValues(field) {
  const values = [
    "All",
    ...new Set(
      state.rows
        .filter((row) =>
          Object.entries(state.filters).every(([filterKey, filterValue]) => {
            if (filterKey === "metric" || field === filterKey || filterValue === "All") {
              return true;
            }
            return String(row[filterKey]) === String(filterValue);
          }),
        )
        .map((row) => String(row[field])),
    ),
  ];

  return values.sort((a, b) => {
    if (a === "All") {
      return -1;
    }
    if (b === "All") {
      return 1;
    }
    return field === "year" ? Number(b) - Number(a) : a.localeCompare(b);
  });
}

function syncFilters() {
  [
    "year",
    "group",
    "organization",
    "assessmentName",
    "contentArea",
    "grade",
    "race",
    "gender",
    "specialDemo",
    "geography",
  ].forEach((field) => {
    const values = getAvailableValues(field);
    if (!values.includes(String(state.filters[field]))) {
      state.filters[field] = values[0] ?? "All";
    }
  });
}

function render() {
  const filteredRows = getFilteredRows();
  renderHero(filteredRows);
  renderKpis(filteredRows);
  renderScatterChart(filteredRows);
  renderComparisonChart(filteredRows);
  renderTrendChart(getTrendRows(filteredRows));
  renderInsights(filteredRows);
  renderTable(filteredRows);
}

function renderError(error) {
  elements.heroFocus.textContent = "Dashboard could not load";
  elements.heroDetail.textContent = error.message;
  elements.heroNote.textContent = "The live data fetch failed. The sample data file still works if you flip config.js back to sample mode.";
  elements.insightsList.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
  elements.dataTableBody.innerHTML = "";
  clearSvg(elements.scatterChart);
  clearSvg(elements.comparisonChart);
  clearSvg(elements.trendChart);
}

function getFilteredRows() {
  return state.rows.filter((row) =>
    Object.entries(state.filters).every(([field, value]) => {
      if (field === "metric" || value === "All") {
        return true;
      }
      return String(row[field]) === String(value);
    }),
  );
}

function getTrendRows(filteredRows) {
  const organization =
    state.filters.organization !== "All"
      ? state.filters.organization
      : filteredRows[0]?.organization;

  if (!organization) {
    return [];
  }

  const trendRows = state.rows.filter((row) => {
    if (row.organization !== organization) {
      return false;
    }

    const filtersToMatch = {
      group: state.filters.group,
      assessmentName: state.filters.assessmentName,
      contentArea: state.filters.contentArea,
      grade: state.filters.grade,
      race: state.filters.race,
      gender: state.filters.gender,
      specialDemo: state.filters.specialDemo,
      geography: state.filters.geography,
    };

    return Object.entries(filtersToMatch).every(([field, value]) => value === "All" || row[field] === value);
  });

  return aggregateByYear(trendRows);
}

function aggregateByOrganization(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.organization)) {
      grouped.set(row.organization, []);
    }
    grouped.get(row.organization).push(row);
  });

  return [...grouped.entries()].map(([organization, groupRows]) => ({
    organization,
    group: groupRows[0].group,
    achievementRate: average(groupRows.map((row) => row.achievementRate)),
    attendanceRate: average(groupRows.map((row) => row.attendanceRate)),
    educatorMobilityRate: average(groupRows.map((row) => row.educatorMobilityRate)),
  }));
}

function aggregateByYear(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    if (!grouped.has(row.year)) {
      grouped.set(row.year, []);
    }
    grouped.get(row.year).push(row);
  });

  return [...grouped.entries()]
    .map(([year, groupRows]) => ({
      year,
      organization: groupRows[0].organization,
      achievementRate: average(groupRows.map((row) => row.achievementRate)),
      attendanceRate: average(groupRows.map((row) => row.attendanceRate)),
      educatorMobilityRate: average(groupRows.map((row) => row.educatorMobilityRate)),
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

function renderHero(rows) {
  const organizations = [...new Set(rows.map((row) => row.organization))];
  const focusLabel =
    state.filters.organization !== "All"
      ? state.filters.organization
      : `${organizations.length} organizations`;

  elements.heroFocus.textContent = focusLabel;
  elements.heroDetail.textContent = [
    state.filters.year === "All" ? "All years" : state.filters.year,
    state.filters.assessmentName === "All" ? "All assessments" : state.filters.assessmentName,
    state.filters.contentArea === "All" ? "All content areas" : state.filters.contentArea,
    state.filters.grade === "All" ? "All grades" : state.filters.grade,
  ].join(" · ");

  if (!rows.length) {
    elements.heroNote.textContent = "No rows match the current filter combination.";
    return;
  }

  const avgAttendance = average(rows.map((row) => row.attendanceRate));
  const avgMobility = average(rows.map((row) => row.educatorMobilityRate));
  elements.heroNote.textContent = `Race ${state.filters.race}, gender ${state.filters.gender}, program ${state.filters.specialDemo}, geography ${state.filters.geography}. Average attendance ${formatPercent(
    avgAttendance,
  )}; average educator mobility ${formatPercent(avgMobility)}.`;
}

function renderKpis(rows) {
  elements.achievementValue.textContent = formatPercent(average(rows.map((row) => row.achievementRate)));
  elements.achievementNote.textContent = "Average proficiency rate for the filtered achievement rows";
  elements.attendanceValue.textContent = formatPercent(average(rows.map((row) => row.attendanceRate)));
  elements.attendanceNote.textContent = "Derived from average days enrolled minus average days absent";
  elements.mobilityValue.textContent = formatPercent(average(rows.map((row) => row.educatorMobilityRate)));
  elements.mobilityNote.textContent = "One-year educator turnover rate for classroom teachers";
  elements.coverageValue.textContent = String(new Set(rows.map((row) => row.organization)).size);
  elements.coverageNote.textContent = `${rows.length} achievement rows after merging attendance and mobility`;
}

function renderScatterChart(rows) {
  clearSvg(elements.scatterChart);
  const svg = elements.scatterChart;
  const width = 760;
  const height = 420;
  const margin = { top: 30, right: 30, bottom: 55, left: 60 };
  const aggregated = aggregateByOrganization(rows).filter(
    (row) =>
      row.attendanceRate !== null &&
      row.achievementRate !== null &&
      row.educatorMobilityRate !== null,
  );

  elements.scatterCaption.textContent =
    aggregated.length === 0
      ? "No organizations have all three metrics for this filter combination."
      : "Each point is an organization. X is attendance, Y is achievement, bubble size is educator mobility.";

  if (!aggregated.length) {
    drawEmptyState(svg, width, height, "No rows with all three metrics");
    return;
  }

  const x = createScale(aggregated.map((row) => row.attendanceRate), margin.left, width - margin.right);
  const y = createScale(aggregated.map((row) => row.achievementRate), height - margin.bottom, margin.top);
  const maxMobility = Math.max(...aggregated.map((row) => row.educatorMobilityRate));

  drawAxis(svg, { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom });
  drawAxis(svg, { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom });
  drawLabel(svg, width / 2, height - 14, "Attendance rate");
  drawLabel(svg, 20, height / 2, "Achievement rate", true);

  aggregated.forEach((row) => {
    const radius = 8 + (row.educatorMobilityRate / maxMobility) * 16;
    const circle = createSvgElement("circle", {
      cx: x(row.attendanceRate),
      cy: y(row.achievementRate),
      r: radius,
      fill: getGroupColor(row.group),
      opacity: 0.72,
    });
    circle.appendChild(
      createSvgElement(
        "title",
        {},
        `${row.organization}\nAchievement: ${formatPercent(row.achievementRate)}\nAttendance: ${formatPercent(
          row.attendanceRate,
        )}\nMobility: ${formatPercent(row.educatorMobilityRate)}`,
      ),
    );
    svg.appendChild(circle);
  });
}

function renderComparisonChart(rows) {
  clearSvg(elements.comparisonChart);
  const svg = elements.comparisonChart;
  const width = 760;
  const height = 420;
  const margin = { top: 24, right: 28, bottom: 100, left: 60 };
  const metric = state.filters.metric;
  const aggregated = aggregateByOrganization(rows)
    .filter((row) => getMetricValue(row, metric) !== null)
    .sort((a, b) => getMetricValue(b, metric) - getMetricValue(a, metric));

  elements.comparisonCaption.textContent = `Organization average for ${labelForMetric(metric).toLowerCase()}.`;

  if (!aggregated.length) {
    drawEmptyState(svg, width, height, "No rows for this metric");
    return;
  }

  const barWidth = (width - margin.left - margin.right) / aggregated.length - 10;
  const scaleY = createScale(aggregated.map((row) => getMetricValue(row, metric)), height - margin.bottom, margin.top, true);
  drawAxis(svg, { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom });
  drawAxis(svg, { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom });

  aggregated.forEach((row, index) => {
    const value = getMetricValue(row, metric);
    const x = margin.left + index * (barWidth + 10);
    const y = scaleY(value);
    svg.appendChild(
      createSvgElement("rect", {
        x,
        y,
        width: barWidth,
        height: height - margin.bottom - y,
        rx: 10,
        fill: getGroupColor(row.group),
      }),
    );
    drawLabel(svg, x + barWidth / 2, y - 8, formatPercent(value), false, "bar-value");
    drawLabel(svg, x + barWidth / 2, height - margin.bottom + 16, abbreviate(row.organization, 18), false, "bar-label");
  });
}

function renderTrendChart(rows) {
  clearSvg(elements.trendChart);
  const svg = elements.trendChart;
  const width = 1100;
  const height = 360;
  const margin = { top: 28, right: 24, bottom: 48, left: 60 };
  const metricKeys = ["achievementRate", "attendanceRate", "educatorMobilityRate"];
  const plottedMetrics = metricKeys.filter((metric) => rows.some((row) => row[metric] !== null));

  elements.trendCaption.textContent =
    rows.length === 0
      ? "No trend rows for the current organization and subgroup filters."
      : `Multi-year average for ${rows[0].organization}.`;

  if (!rows.length || !plottedMetrics.length) {
    drawEmptyState(svg, width, height, "No trend data");
    return;
  }

  const years = rows.map((row) => Number(row.year));
  const values = plottedMetrics.flatMap((metric) => rows.map((row) => row[metric]).filter((value) => value !== null));
  const scaleX = createOrdinalScale(years, margin.left, width - margin.right);
  const scaleY = createScale(values, height - margin.bottom, margin.top, true);

  drawAxis(svg, { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom });
  drawAxis(svg, { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom });

  plottedMetrics.forEach((metric) => {
    const points = rows
      .filter((row) => row[metric] !== null)
      .map((row) => `${scaleX(Number(row.year))},${scaleY(row[metric])}`)
      .join(" ");
    svg.appendChild(
      createSvgElement("polyline", {
        points,
        fill: "none",
        stroke: metricColor(metric),
        "stroke-width": 3,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      }),
    );
    rows.forEach((row) => {
      if (row[metric] === null) {
        return;
      }
      svg.appendChild(
        createSvgElement("circle", {
          cx: scaleX(Number(row.year)),
          cy: scaleY(row[metric]),
          r: 5,
          fill: metricColor(metric),
        }),
      );
    });
  });

  years.forEach((year) => {
    drawLabel(svg, scaleX(year), height - 16, String(year), false, "bar-label");
  });

  plottedMetrics.forEach((metric, index) => {
    const legendX = width - margin.right - 180 + index * 60;
    svg.appendChild(createSvgElement("circle", { cx: legendX, cy: 18, r: 6, fill: metricColor(metric) }));
    drawLabel(svg, legendX + 34, 22, shortMetricLabel(metric), false, "legend-label", "start");
  });
}

function renderInsights(rows) {
  const insights = [];
  const aggregated = aggregateByOrganization(rows);

  const bestAchievement = aggregated
    .filter((row) => row.achievementRate !== null)
    .sort((a, b) => b.achievementRate - a.achievementRate)[0];
  if (bestAchievement) {
    insights.push(`${bestAchievement.organization} has the highest average achievement rate at ${formatPercent(bestAchievement.achievementRate)}.`);
  }

  const bestAttendance = aggregated
    .filter((row) => row.attendanceRate !== null)
    .sort((a, b) => b.attendanceRate - a.attendanceRate)[0];
  if (bestAttendance) {
    insights.push(`${bestAttendance.organization} has the highest derived attendance rate at ${formatPercent(bestAttendance.attendanceRate)}.`);
  }

  const lowestMobility = aggregated
    .filter((row) => row.educatorMobilityRate !== null)
    .sort((a, b) => a.educatorMobilityRate - b.educatorMobilityRate)[0];
  if (lowestMobility) {
    insights.push(`${lowestMobility.organization} has the lowest educator mobility rate at ${formatPercent(lowestMobility.educatorMobilityRate)}.`);
  }

  const complete = aggregated.filter(
    (row) =>
      row.achievementRate !== null &&
      row.attendanceRate !== null &&
      row.educatorMobilityRate !== null,
  );
  if (complete.length > 1) {
    const leader = complete.sort((a, b) => compositeScore(b) - compositeScore(a))[0];
    insights.push(`${leader.organization} leads the blended comparison for this slice when achievement, attendance, and lower mobility are considered together.`);
  }

  elements.insightsList.innerHTML = insights.length
    ? insights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>No summary insights are available for the current filter combination.</li>";
}

function renderTable(rows) {
  elements.tableCaption.textContent = `${rows.length} achievement rows are currently aligned to attendance and educator mobility.`;
  elements.dataTableBody.innerHTML = rows
    .slice()
    .sort((a, b) => Number(b.year) - Number(a.year) || a.organization.localeCompare(b.organization))
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.year)}</td>
          <td>${escapeHtml(row.group)}</td>
          <td>${escapeHtml(row.organization)}</td>
          <td>${escapeHtml(row.assessmentName)}</td>
          <td>${escapeHtml(row.contentArea)}</td>
          <td>${escapeHtml(row.grade)}</td>
          <td>${escapeHtml(row.race)}</td>
          <td>${escapeHtml(row.gender)}</td>
          <td>${escapeHtml(row.specialDemo)}</td>
          <td>${escapeHtml(row.subgroup)}</td>
          <td>${formatPercent(row.achievementRate)}</td>
          <td>${formatPercent(row.attendanceRate)}</td>
          <td>${formatPercent(row.educatorMobilityRate)}</td>
        </tr>`,
    )
    .join("");
}

function updateStatus(text) {
  elements.statusPill.textContent = text;
}

function average(values) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) {
    return null;
  }
  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function compositeScore(row) {
  return (row.achievementRate || 0) * 0.5 + (row.attendanceRate || 0) * 0.35 + (100 - (row.educatorMobilityRate || 100)) * 0.15;
}

function getMetricValue(row, metric) {
  return row[metric] ?? null;
}

function labelForMetric(metric) {
  return METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? metric;
}

function shortMetricLabel(metric) {
  if (metric === "achievementRate") {
    return "Ach";
  }
  if (metric === "attendanceRate") {
    return "Att";
  }
  return "Mob";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "--";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function metricColor(metric) {
  if (metric === "achievementRate") {
    return "#1b4965";
  }
  if (metric === "attendanceRate") {
    return "#6a994e";
  }
  return "#bc4749";
}

function getGroupColor(group) {
  return group === "Charter Schools" ? "#9c6644" : "#1b4965";
}

function createScale(values, outputMin, outputMax, startAtZero = false) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  const min = startAtZero ? 0 : Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const paddedMin = Math.max(0, min - 3);
  const paddedMax = Math.min(100, max + 3);

  return (value) => {
    if (paddedMax === paddedMin) {
      return (outputMin + outputMax) / 2;
    }
    const ratio = (value - paddedMin) / (paddedMax - paddedMin);
    return outputMin + ratio * (outputMax - outputMin);
  };
}

function createOrdinalScale(values, outputMin, outputMax) {
  const uniqueValues = [...new Set(values)];
  const step = uniqueValues.length === 1 ? 0 : (outputMax - outputMin) / (uniqueValues.length - 1);
  return (value) => outputMin + uniqueValues.indexOf(value) * step;
}

function clearSvg(svg) {
  svg.innerHTML = "";
}

function drawAxis(svg, lineProps) {
  svg.appendChild(createSvgElement("line", { ...lineProps, stroke: "#9aa5b1", "stroke-width": 1.2 }));
}

function drawLabel(svg, x, y, text, vertical = false, className = "axis-label", anchor = "middle") {
  const attrs = { x, y, "text-anchor": anchor, class: className };
  if (vertical) {
    attrs.transform = `rotate(-90 ${x} ${y})`;
  }
  svg.appendChild(createSvgElement("text", attrs, text));
}

function drawEmptyState(svg, width, height, text) {
  svg.appendChild(createSvgElement("text", { x: width / 2, y: height / 2, "text-anchor": "middle", class: "empty-label" }, text));
}

function createSvgElement(tag, attributes, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) {
    element.textContent = text;
  }
  return element;
}

function abbreviate(text, length) {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}
