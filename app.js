const STORAGE_KEY = "scratch-map-country-status-v2";
const LEGACY_VISITED_KEY = "scratch-map-visited-v1";
const DATA_URL = "./data/world.geojson";
const NAMES_URL = "./data/country-names-sk.json";

const STATUS = {
  VISITED: "visited",
  PLANNED: "planned",
};

const NAME_OVERRIDES_SK = {
  "Northern Cyprus": "Severný Cyprus",
  "North Cyprus": "Severný Cyprus",
  Kosovo: "Kosovo",
  Somaliland: "Somalisko",
  "N. Cyprus": "Severný Cyprus",
  "West Bank": "Západný breh",
  "South Sudan": "Južný Sudán",
  "Dem. Rep. Congo": "Konžská demokratická republika",
  "Central African Rep.": "Stredoafrická republika",
  "Eq. Guinea": "Rovníková Guinea",
  "S. Sudan": "Južný Sudán",
  "Bosnia and Herz.": "Bosna a Hercegovina",
};

const svg = d3.select("#map");
const visitedCountEl = document.getElementById("visitedCount");
const plannedCountEl = document.getElementById("plannedCount");
const totalCountEl = document.getElementById("totalCount");
const resetZoomBtn = document.getElementById("resetZoomBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const statusSelect = document.getElementById("statusSelect");
const cancelBtn = document.getElementById("cancelBtn");
const confirmBtn = document.getElementById("confirmBtn");

let countryStatuses = loadStatuses();
let countries = [];
let countryNamesSk = {};
let selectedCountry = null;
let zoomBehavior = null;
let mapLayer = null;

function loadStatuses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const clean = {};
        Object.entries(parsed).forEach(([id, value]) => {
          if (value === STATUS.VISITED || value === STATUS.PLANNED) {
            clean[id] = value;
          }
        });
        return clean;
      }
    }
  } catch {
    // fallback to legacy format
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_VISITED_KEY);
    const legacy = JSON.parse(legacyRaw || "[]");
    if (!Array.isArray(legacy)) return {};
    const migrated = {};
    legacy.forEach((id) => {
      if (typeof id === "string" && id.trim().length) {
        migrated[id] = STATUS.VISITED;
      }
    });
    return migrated;
  } catch {
    return {};
  }
}

function saveStatuses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(countryStatuses));
}

function getCountryId(feature) {
  return feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3 || feature.properties?.name;
}

function getCountryNameSk(feature, id) {
  const fallback = feature.properties?.name || "Neznáma krajina";
  return countryNamesSk[id] || NAME_OVERRIDES_SK[fallback] || fallback;
}

function getStatusClass(id) {
  const status = countryStatuses[id];
  return status ? ` status-${status}` : "";
}

function updateCounters() {
  const statuses = Object.values(countryStatuses);
  const visitedCount = statuses.filter((status) => status === STATUS.VISITED).length;
  const plannedCount = statuses.filter((status) => status === STATUS.PLANNED).length;

  visitedCountEl.textContent = String(visitedCount);
  plannedCountEl.textContent = String(plannedCount);
  totalCountEl.textContent = String(countries.length);
}

function closeModal() {
  selectedCountry = null;
  modalBackdrop.classList.add("hidden");
}

function openModal(country) {
  selectedCountry = country;

  modalTitle.textContent = country.name;
  modalText.textContent = "Vyber, či je krajina navštívená, v pláne, alebo ju chceš nechať neoznačenú.";
  statusSelect.value = countryStatuses[country.id] || "";

  modalBackdrop.classList.remove("hidden");
}

function applyZoom(reset = true) {
  if (!mapLayer) return;

  const container = document.querySelector(".map-wrap");
  const width = container.clientWidth;
  const height = container.clientHeight;

  zoomBehavior = d3
    .zoom()
    .scaleExtent([1, 10])
    .translateExtent([
      [-width * 0.3, -height * 0.35],
      [width * 1.3, height * 1.35],
    ])
    .on("zoom", (event) => {
      mapLayer.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);

  if (reset) {
    svg.call(zoomBehavior.transform, d3.zoomIdentity);
  }
}

function renderMap(resetZoom = true) {
  const container = document.querySelector(".map-wrap");
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const geojson = {
    type: "FeatureCollection",
    features: countries.map((country) => country.feature),
  };

  const projection = d3.geoNaturalEarth1();
  projection.fitExtent(
    [
      [12, 14],
      [width - 12, height - 12],
    ],
    geojson
  );

  const path = d3.geoPath(projection);
  mapLayer = svg.append("g").attr("class", "map-layer");

  mapLayer
    .selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", (d) => `country${getStatusClass(d.id)}`)
    .attr("d", (d) => path(d.feature))
    .attr("aria-label", (d) => d.name)
    .on("click", (_, d) => openModal(d))
    .append("title")
    .text((d) => d.name);

  applyZoom(resetZoom);
}

function saveSelectedCountryStatus() {
  if (!selectedCountry) return;

  const value = statusSelect.value;
  if (value === STATUS.VISITED || value === STATUS.PLANNED) {
    countryStatuses[selectedCountry.id] = value;
  } else {
    delete countryStatuses[selectedCountry.id];
  }

  saveStatuses();
  updateCounters();
  renderMap(false);
  closeModal();
}

async function init() {
  const [worldResponse, namesResponse] = await Promise.all([fetch(DATA_URL), fetch(NAMES_URL)]);

  if (!worldResponse.ok) {
    throw new Error(`Nepodarilo sa načítať mapové dáta: ${worldResponse.status}`);
  }

  if (!namesResponse.ok) {
    throw new Error(`Nepodarilo sa načítať slovenské názvy krajín: ${namesResponse.status}`);
  }

  const world = await worldResponse.json();
  countryNamesSk = await namesResponse.json();

  countries = (world.features || [])
    .map((feature) => {
      const id = getCountryId(feature);
      return {
        feature,
        id,
        name: getCountryNameSk(feature, id),
      };
    })
    .filter((item) => Boolean(item.id));

  // Remove stale IDs that are not present in the current map dataset.
  const validIds = new Set(countries.map((country) => country.id));
  Object.keys(countryStatuses).forEach((id) => {
    if (!validIds.has(id)) {
      delete countryStatuses[id];
    }
  });

  saveStatuses();
  updateCounters();
  renderMap(true);
}

confirmBtn.addEventListener("click", saveSelectedCountryStatus);
cancelBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal();
  }
});

resetZoomBtn.addEventListener("click", () => {
  if (zoomBehavior) {
    svg.transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
  }
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (countries.length) {
      renderMap(true);
    }
  }, 130);
});

init().catch((error) => {
  console.error(error);
  alert("Mapu sa nepodarilo načítať. Skontroluj pripojenie a skús obnoviť stránku.");
});
