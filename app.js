const STORAGE_KEY = "scratch-map-country-status-v3";
const LEGACY_STORAGE_KEY_V2 = "scratch-map-country-status-v2";
const LEGACY_VISITED_KEY = "scratch-map-visited-v1";

const DATA_URL = "./data/world.geojson";
const NAMES_URL = "./data/country-names-sk.json";
const SHARED_MAP_ID = "matus-hanicka-main";
const FALLBACK_PUBLIC_URL = "https://matuslong.github.io/scratch-map/";

const SUPABASE_URL = window.APP_CONFIG?.supabaseUrl || "";
const SUPABASE_ANON_KEY = window.APP_CONFIG?.supabaseAnonKey || "";

const STATUS = {
  VISITED: "visited",
  PLANNED: "planned",
  WISHLIST_KOBLI: "wishlistKobli",
  WISHLIST_KOBLIZKY: "wishlistKoblizky",
};

const VALID_STATUSES = new Set(Object.values(STATUS));

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
const wishlistKobliCountEl = document.getElementById("wishlistKobliCount");
const wishlistKoblizkyCountEl = document.getElementById("wishlistKoblizkyCount");
const totalCountEl = document.getElementById("totalCount");

const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const syncNowBtn = document.getElementById("syncNowBtn");
const publicUrlInput = document.getElementById("publicUrlInput");
const copyPublicUrlBtn = document.getElementById("copyPublicUrlBtn");
const syncBadge = document.getElementById("syncBadge");

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
let lastZoomTransform = d3.zoomIdentity;

let supabase = null;
let collaborationEnabled = false;
let realtimeChannel = null;
let syncTimer = null;

function isMobileViewport() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function getPublicAppUrl() {
  const currentUrl = new URL(window.location.href);
  if (currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1") {
    return FALLBACK_PUBLIC_URL;
  }
  currentUrl.search = "";
  currentUrl.hash = "";
  return currentUrl.toString();
}

function initializePublicUrl() {
  if (publicUrlInput) {
    publicUrlInput.value = getPublicAppUrl();
  }
}

function loadStatuses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeStatuses(parsed);
    }
  } catch {
    // ignore
  }

  try {
    const rawV2 = localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2);
      return normalizeStatuses(parsedV2);
    }
  } catch {
    // ignore
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

function normalizeStatuses(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const clean = {};
  Object.entries(input).forEach(([id, value]) => {
    if (typeof id === "string" && VALID_STATUSES.has(value)) {
      clean[id] = value;
    }
  });

  return clean;
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
  const wishlistKobliCount = statuses.filter((status) => status === STATUS.WISHLIST_KOBLI).length;
  const wishlistKoblizkyCount = statuses.filter((status) => status === STATUS.WISHLIST_KOBLIZKY).length;

  visitedCountEl.textContent = String(visitedCount);
  plannedCountEl.textContent = String(plannedCount);
  wishlistKobliCountEl.textContent = String(wishlistKobliCount);
  wishlistKoblizkyCountEl.textContent = String(wishlistKoblizkyCount);
  totalCountEl.textContent = String(countries.length);
}

function closeModal() {
  selectedCountry = null;
  modalBackdrop.classList.add("hidden");
}

function openModal(country) {
  selectedCountry = country;

  modalTitle.textContent = country.name;
  modalText.textContent = "Vyber stav: navštívené, blízka budúcnosť alebo wishlist.";
  statusSelect.value = countryStatuses[country.id] || "";

  modalBackdrop.classList.remove("hidden");
}

function applyZoom(reset = true) {
  if (!mapLayer) return;

  const container = document.querySelector(".map-wrap");
  const width = container.clientWidth;
  const height = container.clientHeight;

  const maxZoom = isMobileViewport() ? 24 : 14;

  zoomBehavior = d3
    .zoom()
    .scaleExtent([1, maxZoom])
    .translateExtent([
      [-width * 0.35, -height * 0.4],
      [width * 1.35, height * 1.4],
    ])
    .on("zoom", (event) => {
      lastZoomTransform = event.transform;
      mapLayer.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);

  if (reset) {
    lastZoomTransform = d3.zoomIdentity;
    svg.call(zoomBehavior.transform, d3.zoomIdentity);
  } else {
    svg.call(zoomBehavior.transform, lastZoomTransform);
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
      [14, 14],
      [width - 14, height - 14],
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

function setSyncBadge(text, state = "") {
  syncBadge.textContent = text;
  syncBadge.className = `sync-badge${state ? ` ${state}` : ""}`;
}

function scheduleCloudSync() {
  if (!collaborationEnabled || !supabase) {
    return;
  }

  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncToCloud();
  }, 160);
}

async function syncToCloud() {
  if (!collaborationEnabled || !supabase) {
    return;
  }

  try {
    const payload = { statuses: countryStatuses };
    const { error } = await supabase.from("map_rooms").upsert({ room_id: SHARED_MAP_ID, payload });
    if (error) throw error;
    setSyncBadge("Live sync: online", "ok");
  } catch (error) {
    console.error(error);
    setSyncBadge("Live sync: chyba synchronizácie", "warn");
  }
}

function normalizeRemotePayload(payload) {
  const remoteStatuses = payload?.statuses;
  return normalizeStatuses(remoteStatuses);
}

async function fetchSharedMapFromCloud() {
  if (!collaborationEnabled || !supabase) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from("map_rooms")
      .select("payload")
      .eq("room_id", SHARED_MAP_ID)
      .maybeSingle();

    if (error) throw error;

    const remoteStatuses = normalizeRemotePayload(data?.payload);
    if (Object.keys(remoteStatuses).length > 0) {
      countryStatuses = remoteStatuses;
      saveStatuses();
      updateCounters();
      renderMap(false);
    } else {
      await syncToCloud();
    }
  } catch (error) {
    console.error(error);
    setSyncBadge("Live sync: načítanie zlyhalo", "warn");
  }
}

async function subscribeSharedMapRealtime() {
  if (!collaborationEnabled || !supabase) {
    return;
  }

  if (realtimeChannel) {
    await supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = supabase
    .channel(`room-${SHARED_MAP_ID}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "map_rooms",
        filter: `room_id=eq.${SHARED_MAP_ID}`,
      },
      (payload) => {
        const remote = normalizeRemotePayload(payload.new?.payload);
        const remoteJson = JSON.stringify(remote);
        const localJson = JSON.stringify(countryStatuses);
        if (remoteJson !== localJson) {
          countryStatuses = remote;
          saveStatuses();
          updateCounters();
          renderMap(false);
        }
        setSyncBadge("Live sync: online", "ok");
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncBadge("Live sync: online", "ok");
      }
    });
}

async function initCollaboration() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    setSyncBadge("Live sync: vypnutý (doplň SUPABASE config)", "warn");
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    collaborationEnabled = true;

    setSyncBadge("Live sync: pripájam...", "warn");
    await fetchSharedMapFromCloud();
    await subscribeSharedMapRealtime();
  } catch (error) {
    console.error(error);
    setSyncBadge("Live sync: chyba inicializácie", "warn");
  }
}

function saveSelectedCountryStatus() {
  if (!selectedCountry) return;

  const value = statusSelect.value;
  if (VALID_STATUSES.has(value)) {
    countryStatuses[selectedCountry.id] = value;
  } else {
    delete countryStatuses[selectedCountry.id];
  }

  saveStatuses();
  updateCounters();
  renderMap(false);
  scheduleCloudSync();
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

  const validIds = new Set(countries.map((country) => country.id));
  Object.keys(countryStatuses).forEach((id) => {
    if (!validIds.has(id)) {
      delete countryStatuses[id];
    }
  });

  saveStatuses();
  updateCounters();
  renderMap(true);
  initializePublicUrl();
  await initCollaboration();
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

zoomInBtn.addEventListener("click", () => {
  if (zoomBehavior) {
    const factor = isMobileViewport() ? 1.35 : 1.25;
    svg.transition().duration(220).call(zoomBehavior.scaleBy, factor);
  }
});

zoomOutBtn.addEventListener("click", () => {
  if (zoomBehavior) {
    const factor = isMobileViewport() ? 0.74 : 0.8;
    svg.transition().duration(220).call(zoomBehavior.scaleBy, factor);
  }
});

resetZoomBtn.addEventListener("click", () => {
  if (zoomBehavior) {
    lastZoomTransform = d3.zoomIdentity;
    svg.transition().duration(320).call(zoomBehavior.transform, d3.zoomIdentity);
  }
});

syncNowBtn.addEventListener("click", async () => {
  if (!collaborationEnabled) {
    setSyncBadge("Live sync: vypnutý (doplň SUPABASE config)", "warn");
    return;
  }

  await syncToCloud();
  await fetchSharedMapFromCloud();
});

copyPublicUrlBtn.addEventListener("click", async () => {
  const url = getPublicAppUrl();
  if (publicUrlInput) {
    publicUrlInput.value = url;
  }

  try {
    await navigator.clipboard.writeText(url);
    setSyncBadge("URL skopírovaná", "ok");
  } catch {
    if (publicUrlInput) {
      publicUrlInput.focus();
      publicUrlInput.select();
    }
    setSyncBadge("Skopíruj URL ručne", "warn");
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
