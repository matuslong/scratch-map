const STORAGE_KEY = "scratch-map-visited-v1";
const DATA_URL = "./data/world.geojson";

const svg = d3.select("#map");
const visitedCountEl = document.getElementById("visitedCount");
const totalCountEl = document.getElementById("totalCount");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalTitle = document.getElementById("modalTitle");
const modalText = document.getElementById("modalText");
const cancelBtn = document.getElementById("cancelBtn");
const confirmBtn = document.getElementById("confirmBtn");

let visited = loadVisited();
let countries = [];
let selectedCountry = null;

function loadVisited() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item) => typeof item === "string" && item.trim().length));
  } catch {
    return new Set();
  }
}

function saveVisited() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visited)));
}

function getCountryId(feature) {
  return feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3 || feature.properties?.name;
}

function getCountryName(feature) {
  return feature.properties?.name || "Neznáma krajina";
}

function updateCounters() {
  visitedCountEl.textContent = String(visited.size);
  totalCountEl.textContent = String(countries.length);
}

function closeModal() {
  selectedCountry = null;
  modalBackdrop.classList.add("hidden");
}

function openModal(country) {
  selectedCountry = country;
  const isVisited = visited.has(country.id);

  modalTitle.textContent = country.name;
  modalText.textContent = isVisited
    ? "Krajina je označená ako navštívená. Chceš ju odznačiť?"
    : "Potvrď návštevu tejto krajiny.";
  confirmBtn.textContent = isVisited ? "Odznačiť" : "Potvrdiť návštevu";

  modalBackdrop.classList.remove("hidden");
}

function renderMap() {
  const container = document.querySelector(".map-wrap");
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const geojson = {
    type: "FeatureCollection",
    features: countries.map((c) => c.feature),
  };

  const projection = d3.geoNaturalEarth1();
  projection.fitExtent(
    [
      [10, 10],
      [width - 10, height - 10],
    ],
    geojson
  );

  const path = d3.geoPath(projection);

  svg
    .append("g")
    .selectAll("path")
    .data(countries)
    .join("path")
    .attr("class", (d) => `country${visited.has(d.id) ? " visited" : ""}`)
    .attr("d", (d) => path(d.feature))
    .attr("aria-label", (d) => d.name)
    .on("click", (_, d) => openModal(d))
    .append("title")
    .text((d) => d.name);
}

function toggleSelectedCountry() {
  if (!selectedCountry) return;

  if (visited.has(selectedCountry.id)) {
    visited.delete(selectedCountry.id);
  } else {
    visited.add(selectedCountry.id);
  }

  saveVisited();
  updateCounters();
  renderMap();
  closeModal();
}

async function init() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Nepodarilo sa načítať mapové dáta: ${response.status}`);
  }

  const world = await response.json();

  countries = (world.features || [])
    .map((feature) => ({
      feature,
      id: getCountryId(feature),
      name: getCountryName(feature),
    }))
    .filter((item) => Boolean(item.id));

  // Clean stale visited IDs that are not present in current country dataset.
  visited = new Set(Array.from(visited).filter((id) => countries.some((c) => c.id === id)));

  saveVisited();
  updateCounters();
  renderMap();
}

confirmBtn.addEventListener("click", toggleSelectedCountry);
cancelBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (countries.length) renderMap();
  }, 120);
});

init().catch((error) => {
  console.error(error);
  alert("Mapu sa nepodarilo načítať. Skontroluj pripojenie a skús obnoviť stránku.");
});
