const yearElement = document.querySelector("#current-year");
const analysisForm = document.querySelector("#analysis-form");
const analysisStatus = document.querySelector("#analysis-status");
const pageUrlInput = document.querySelector("#page-url");
const deviceMode = document.querySelector("#device-mode");
const connectionMode = document.querySelector("#connection-mode");
const reportTitle = document.querySelector("#report-title");
const reportUrl = document.querySelector("#report-url");
const reportDevice = document.querySelector("#report-device");
const reportConnection = document.querySelector("#report-connection");
const reportTime = document.querySelector("#report-time");
const scoreValue = document.querySelector('[data-score="performance"]');
const submitButton = analysisForm.querySelector("button[type='submit']");
const copyJsonButton = document.querySelector("#copy-json");
const jsonResponseSummary = document.querySelector("#json-response-summary");
const jsonResponseView = document.querySelector("#json-response-view");
const tabButtons = document.querySelectorAll(".tab-switch__button");
const reportShell = document.querySelector(".report-grid");
const historyList = document.querySelector("#history-list");
const analyticsAverage = document.querySelector("#analytics-average");
const analyticsDevice = document.querySelector("#analytics-device");
const analyticsCount = document.querySelector("#analytics-count");
const metricValues = {
  performance: document.querySelector('[data-metric="performance"]'),
  accessibility: document.querySelector('[data-metric="accessibility"]'),
  bestPractices: document.querySelector('[data-metric="best-practices"]'),
  seo: document.querySelector('[data-metric="seo"]'),
};
const metricBars = {
  performance: document.querySelector('[data-bar="performance"]'),
  accessibility: document.querySelector('[data-bar="accessibility"]'),
  bestPractices: document.querySelector('[data-bar="best-practices"]'),
  seo: document.querySelector('[data-bar="seo"]'),
};
const revealItems = document.querySelectorAll(".reveal");
const historyTemplate = document.querySelector("#history-item-template");
const body = document.body;

const storageKey = "pulsepilot-history";
const state = {
  device: "mobile",
  connection: "4g",
  url: "",
  loading: false,
  lastResult: null,
};

const devicePenaltyMap = {
  mobile: 0,
  desktop: 7,
};

const connectionPenaltyMap = {
  wifi: 0,
  "4g": 6,
  "3g": 12,
};

yearElement.textContent = new Date().getFullYear();

function normalizeUrl(input) {
  let trimmed = input.trim();
  if (!trimmed) return "";

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return "";
  }
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatScore(value) {
  return String(clamp(Math.round(value), 0, 100));
}

function formatSeconds(value) {
  return `${value.toFixed(1)} s`;
}

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 6)));
}

function setLoading(isLoading) {
  state.loading = isLoading;
  body.classList.toggle("loading", isLoading);
  submitButton.disabled = isLoading;
  if (isLoading) {
    analysisStatus.textContent = "Running performance analysis...";
  }
}

function setDevice(device) {
  state.device = device;
  tabButtons.forEach((button) => {
    const isActive = button.dataset.device === device;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function computeResult(url, device, connection) {
  const seed = hashString(`${url}|${device}|${connection}`);
  const devicePenalty = devicePenaltyMap[device] ?? 0;
  const connectionPenalty = connectionPenaltyMap[connection] ?? 0;

  const performance = clamp(96 - devicePenalty - connectionPenalty - (seed % 11), 42, 100);
  const accessibility = clamp(97 - (seed % 6), 68, 100);
  const bestPractices = clamp(95 - devicePenalty - (seed % 5), 66, 100);
  const seo = clamp(94 - (seed % 4), 70, 100);

  const fcp = 0.8 + (100 - performance) * 0.018 + (device === "mobile" ? 0.16 : 0.05);
  const lcp = 1.1 + (100 - performance) * 0.022 + (device === "mobile" ? 0.22 : 0.09);
  const inp = 60 + (100 - performance) * 4 + (connection === "3g" ? 60 : connection === "4g" ? 24 : 8);
  const cls = clamp(0.01 + (100 - performance) * 0.0012 + ((seed % 7) * 0.002), 0.01, 0.24);
  const speedIndex = 1.8 + (100 - performance) * 0.028 + (device === "mobile" ? 0.2 : 0.08);

  const recommendations = [
    {
      title: "Reduce render blocking resources",
      description: "Defer non-critical CSS and JavaScript to speed up the first render.",
      severity: performance < 70 ? "High" : "Medium",
    },
    {
      title: "Compress hero images",
      description: "Use next-gen formats and responsive sizes for the top of the page.",
      severity: accessibility < 85 ? "Medium" : "Low",
    },
    {
      title: "Stabilize layout shifts",
      description: "Reserve space for media, cards, and dynamic content to reduce CLS.",
      severity: cls > 0.1 ? "High" : "Low",
    },
  ];

  return {
    url,
    device,
    connection,
    timestamp: new Date().toISOString(),
    metrics: {
      performance,
      accessibility,
      bestPractices,
      seo,
    },
    vitals: {
      lcp,
      cls,
      inp,
      fcp,
      speedIndex,
    },
    recommendations,
    trend: [
      clamp(performance - 14, 22, 100),
      clamp(performance - 7, 22, 100),
      clamp(performance - 10, 22, 100),
      clamp(performance - 4, 22, 100),
      performance,
    ],
    score: performance,
  };
}

function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = "";
  analyticsCount.textContent = String(history.length);

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No tests yet. Run a scan to save history.";
    historyList.appendChild(empty);
    analyticsAverage.textContent = "0";
    analyticsDevice.textContent = "Mobile";
    return;
  }

  const avg = Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length);
  const bestDevice = history.reduce(
    (best, item) => (item.score > best.score ? item : best),
    history[0]
  ).device;

  analyticsAverage.textContent = String(avg);
  analyticsDevice.textContent = bestDevice === "mobile" ? "Mobile" : "Desktop";

  history.forEach((item) => {
    const node = historyTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".history-item__title").textContent = item.url;
    node.querySelector(".history-item__meta").textContent = `${item.device} • ${item.connection} • ${new Date(item.timestamp).toLocaleDateString()}`;
    node.querySelector(".history-item__score").textContent = String(item.score);
    node.addEventListener("click", () => {
      pageUrlInput.value = item.url;
      deviceMode.value = item.device;
      connectionMode.value = item.connection;
      setDevice(item.device);
      analyze();
    });
    historyList.appendChild(node);
  });
}

function renderResult(result, { save = true } = {}) {
  state.lastResult = result;

  reportTitle.textContent = `Performance report for ${result.url}`;
  reportUrl.textContent = result.url;
  reportDevice.textContent = result.device === "mobile" ? "Mobile" : "Desktop";
  reportConnection.textContent =
    result.connection === "3g" ? "3G" : result.connection === "4g" ? "4G" : "Wi-Fi";
  reportTime.textContent = new Date(result.timestamp).toLocaleString();

  scoreValue.textContent = formatScore(result.metrics.performance);

  metricValues.performance.textContent = formatScore(result.metrics.performance);
  metricValues.accessibility.textContent = formatScore(result.metrics.accessibility);
  metricValues.bestPractices.textContent = formatScore(result.metrics.bestPractices);
  metricValues.seo.textContent = formatScore(result.metrics.seo);

  metricBars.performance.style.width = `${result.metrics.performance}%`;
  metricBars.accessibility.style.width = `${result.metrics.accessibility}%`;
  metricBars.bestPractices.style.width = `${result.metrics.bestPractices}%`;
  metricBars.seo.style.width = `${result.metrics.seo}%`;

  renderJsonResponse();

  if (save) {
    const history = loadHistory();
    const nextHistory = [
      {
        url: result.url,
        device: result.device,
        connection: result.connection,
        timestamp: result.timestamp,
        score: result.metrics.performance,
      },
      ...history.filter(
        (item) =>
          item.url !== result.url ||
          item.device !== result.device ||
          item.connection !== result.connection
      ),
    ];
    saveHistory(nextHistory);
    renderHistory();
  }

  scoreValue.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.07)" },
      { transform: "scale(1)" },
    ],
    { duration: 260, easing: "ease-out" }
  );
}

function buildReportObject() {
  if (!state.lastResult) return null;

  return {
    brand: "PulsePilot",
    generatedAt: new Date().toISOString(),
    ...state.lastResult,
  };
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function createField(label, value) {
  const field = document.createElement("article");
  field.className = "json-field";

  const fieldLabel = document.createElement("span");
  fieldLabel.className = "json-field__label";
  fieldLabel.textContent = label;

  const fieldValue = document.createElement("strong");
  fieldValue.className = "json-field__value";
  fieldValue.textContent = value;

  field.append(fieldLabel, fieldValue);
  return field;
}

function createSection(title, subtitle) {
  const section = document.createElement("section");
  section.className = "json-section";

  const header = document.createElement("div");
  header.className = "json-section__header";

  const heading = document.createElement("div");
  const label = document.createElement("span");
  label.className = "json-section__eyebrow";
  label.textContent = title.toUpperCase();
  const headingTitle = document.createElement("h3");
  headingTitle.textContent = subtitle;
  heading.append(label, headingTitle);

  header.append(heading);
  section.append(header);

  return section;
}

function createSkeletonRow(width) {
  const row = document.createElement("span");
  row.className = "json-skeleton";
  row.style.width = width;
  return row;
}

function renderJsonResponse() {
  const report = buildReportObject();
  if (!jsonResponseSummary || !jsonResponseView) return;

  clearNode(jsonResponseSummary);
  clearNode(jsonResponseView);

  if (!report) {
    const empty = document.createElement("article");
    empty.className = "json-empty-card";

    const heading = document.createElement("strong");
    heading.textContent = state.loading ? "Analyzing URL..." : "Waiting for your first report";

    const description = document.createElement("p");
    description.textContent = state.loading
      ? "We are preparing the structured JSON response for the selected URL."
      : "Run an analysis to see the response rendered in a pro dashboard layout.";

    const skeletonGroup = document.createElement("div");
    skeletonGroup.className = "json-empty-skeleton";
    skeletonGroup.append(
      createSkeletonRow("72%"),
      createSkeletonRow("88%"),
      createSkeletonRow("64%"),
      createSkeletonRow("92%")
    );

    empty.append(heading, description, skeletonGroup);
    jsonResponseView.appendChild(empty);
    return;
  }

  const summaryCards = [
    { label: "Brand", value: report.brand },
    { label: "Device", value: report.device === "mobile" ? "Mobile" : "Desktop" },
    { label: "Score", value: String(report.metrics.performance) },
    { label: "Generated", value: new Date(report.generatedAt).toLocaleDateString() },
  ];

  summaryCards.forEach((item) => {
    const card = document.createElement("article");
    card.className = "json-summary-card";

    const label = document.createElement("span");
    label.textContent = item.label;

    const value = document.createElement("strong");
    value.textContent = item.value;

    card.append(label, value);
    jsonResponseSummary.appendChild(card);
  });

  const requestSection = createSection("Request", "Submitted input");
  const requestGrid = document.createElement("div");
  requestGrid.className = "json-field-grid";
  requestGrid.append(
    createField("URL", report.url),
    createField("Device", report.device === "mobile" ? "Mobile" : "Desktop"),
    createField("Connection", report.connection === "wifi" ? "Wi-Fi" : report.connection === "4g" ? "4G" : "3G"),
    createField("Timestamp", new Date(report.timestamp).toLocaleString())
  );
  requestSection.appendChild(requestGrid);

  const metricsSection = createSection("Metrics", "Score breakdown");
  const metricsGrid = document.createElement("div");
  metricsGrid.className = "json-metric-grid";
  Object.entries(report.metrics).forEach(([key, value]) => {
    const metric = document.createElement("article");
    metric.className = "json-metric";

    const metricLabel = document.createElement("span");
    metricLabel.textContent = key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());

    const metricValue = document.createElement("strong");
    metricValue.textContent = String(value);

    const metricBar = document.createElement("div");
    metricBar.className = "json-metric__bar";
    const metricFill = document.createElement("span");
    metricFill.style.width = `${value}%`;
    metricBar.appendChild(metricFill);

    metric.append(metricLabel, metricValue, metricBar);
    metricsGrid.appendChild(metric);
  });
  metricsSection.appendChild(metricsGrid);

  const vitalsSection = createSection("Vitals", "Core Web Vitals");
  const vitalsGrid = document.createElement("div");
  vitalsGrid.className = "json-vitals-grid";
  const vitalLabels = {
    lcp: "LCP",
    cls: "CLS",
    inp: "INP / FID",
    fcp: "FCP",
    speedIndex: "Speed Index",
  };

  Object.entries(report.vitals).forEach(([key, value]) => {
    const card = document.createElement("article");
    card.className = "json-vital";

    const label = document.createElement("span");
    label.textContent = vitalLabels[key] ?? key;

    const strong = document.createElement("strong");
    strong.textContent =
      key === "cls" ? value.toFixed(2) : key === "inp" ? `${Math.round(value)} ms` : `${value.toFixed(1)} s`;

    card.append(label, strong);
    vitalsGrid.appendChild(card);
  });
  vitalsSection.appendChild(vitalsGrid);

  const recommendationsSection = createSection("Suggestions", "Improvement notes");
  const recommendationList = document.createElement("div");
  recommendationList.className = "json-recommendation-list";

  report.recommendations.forEach((item) => {
    const card = document.createElement("article");
    card.className = "json-recommendation";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description;
    text.append(title, description);

    const badge = document.createElement("span");
    badge.textContent = item.severity;

    card.append(text, badge);
    recommendationList.appendChild(card);
  });
  recommendationsSection.appendChild(recommendationList);

  jsonResponseView.append(requestSection, metricsSection, vitalsSection, recommendationsSection);
}

async function copyJson() {
  const report = buildReportObject();
  if (!report) return;

  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    analysisStatus.textContent = "JSON copied to clipboard.";
  } catch {
    analysisStatus.textContent = "Copy failed in this browser.";
  }
}

function setLoadingState(on) {
  setLoading(on);
  submitButton.textContent = on ? "Analyzing..." : "Analyze";
}

async function analyze({ save = true, scroll = true } = {}) {
  const normalized = normalizeUrl(pageUrlInput.value);
  if (!normalized) {
    analysisStatus.textContent = "Please enter a valid URL that starts with https://";
    return;
  }

  state.url = normalized;
  state.device = deviceMode.value;
  state.connection = connectionMode.value;
  setDevice(state.device);
  setLoadingState(true);
  body.classList.add("loading");

  requestAnimationFrame(() => {
    setTimeout(() => {
      const result = computeResult(state.url, state.device, state.connection);
      renderResult(result, { save });
      analysisStatus.textContent = `Analysis complete for ${result.url}.`;
      setLoadingState(false);
      body.classList.remove("loading");
      if (scroll) {
        reportShell.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 1100);
  });
}

analysisForm.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze();
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextDevice = button.dataset.device;
    if (nextDevice === state.device) return;

    deviceMode.value = nextDevice;
    setDevice(nextDevice);
    analyze();
  });
});

copyJsonButton.addEventListener("click", copyJson);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealItems.forEach((item) => observer.observe(item));

setDevice("mobile");
renderHistory();
renderJsonResponse();
