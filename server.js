// ─── SW Sydney Property Investor — Backend API v2 ─────────────────────────────
// Stores suburb data pushed by the Chrome extension, serves analysis.
// Extension scrapes YIP/PropertyValue (no 403s since it's in the browser).

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { analyseProperty } = require("./src/analyser");

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, "data", "suburbs.json");

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"));
}

// Load persisted data
let suburbStore = {};
if (fs.existsSync(DATA_FILE)) {
  try { suburbStore = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch (e) { suburbStore = {}; }
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(suburbStore, null, 2));
}

app.use(cors());
app.use(express.json());

// ─── Health ─────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", suburbs: Object.keys(suburbStore).length, timestamp: new Date().toISOString() });
});

// ─── GET suburb data ────────────────────────────────────────────────────────
// The extension calls this to get market data for the current suburb
app.get("/api/suburb/:key", (req, res) => {
  const key = req.params.key.toLowerCase().replace(/-/g, " ").replace(/\+/g, " ").trim();

  // Try exact match, then partial match, then postcode match
  let data = suburbStore[key];
  if (!data) {
    const byPostcode = Object.values(suburbStore).find(s => s.postcode === key);
    if (byPostcode) data = byPostcode;
  }
  if (!data) {
    const partial = Object.entries(suburbStore).find(([k]) => k.includes(key) || key.includes(k));
    if (partial) data = partial[1];
  }

  if (!data) {
    return res.status(404).json({
      error: "No data for this suburb yet",
      hint: "Visit the YIP page for this suburb with the extension active to auto-scrape data",
      available: Object.keys(suburbStore)
    });
  }

  // Generate rent & price estimates from medians
  data.rentByBed = generateRentByBed(data.house?.medianRent || 600, data.unit?.medianRent || 500);
  data.estByBed = generatePriceByBed(data.house?.medianPrice || 900000);

  res.json(data);
});

// ─── POST suburb data (pushed by Chrome extension) ──────────────────────────
// The extension scrapes YIP/PropertyValue and pushes data here
app.post("/api/suburb", (req, res) => {
  const { name, postcode, house, unit, source, scrapedFrom } = req.body;

  if (!name) return res.status(400).json({ error: "name is required" });

  const key = name.toLowerCase().trim();
  const existing = suburbStore[key] || {};

  // Merge new data with existing (newer data overwrites)
  suburbStore[key] = {
    ...existing,
    name: name.split(" ").map(w => w[0]?.toUpperCase() + w.slice(1)).join(" "),
    postcode: postcode || existing.postcode,
    lastUpdated: new Date().toISOString(),
    source: source || "Chrome Extension Scrape",
    scrapedFrom: scrapedFrom || existing.scrapedFrom,
    house: {
      ...(existing.house || {}),
      ...(house || {})
    },
    unit: {
      ...(existing.unit || {}),
      ...(unit || {})
    }
  };

  saveStore();

  console.log(`[API] Updated suburb: ${key} (${postcode}) from ${scrapedFrom || "unknown"}`);

  res.json({
    status: "saved",
    suburb: key,
    data: suburbStore[key]
  });
});

// ─── POST analyse a property ────────────────────────────────────────────────
app.post("/api/analyse", (req, res) => {
  const { suburb, postcode, price, beds, baths, cars, landSize, propertyType } = req.body;

  if (!price) return res.status(400).json({ error: "price is required" });

  // Look up suburb data
  const key = (suburb || "").toLowerCase().replace(/-/g, " ").trim();
  const suburbData = suburbStore[key] || Object.values(suburbStore).find(s => s.postcode === postcode) || null;

  const analysis = analyseProperty(price, beds, baths, landSize, propertyType, suburbData);

  res.json({
    suburb: key,
    price, beds, baths, cars, landSize, propertyType,
    analysis,
    suburbData: suburbData ? {
      name: suburbData.name,
      medianHouse: suburbData.house?.medianPrice,
      medianUnit: suburbData.unit?.medianPrice,
      rentHouse: suburbData.house?.medianRent,
      growthHouse: suburbData.house?.annualGrowth,
      dom: suburbData.house?.daysOnMarket
    } : null,
    warning: suburbData ? null : "No suburb data available — using defaults. Visit the YIP page for this suburb to auto-scrape."
  });
});

// ─── GET all suburbs ────────────────────────────────────────────────────────
app.get("/api/suburbs", (req, res) => {
  const suburbs = Object.entries(suburbStore).map(([key, data]) => ({
    key,
    name: data.name,
    postcode: data.postcode,
    medianHouse: data.house?.medianPrice,
    rentHouse: data.house?.medianRent,
    yieldHouse: data.house?.yield,
    growthHouse: data.house?.annualGrowth,
    lastUpdated: data.lastUpdated,
    source: data.source
  }));
  res.json({ count: suburbs.length, suburbs });
});

// ─── DELETE suburb ──────────────────────────────────────────────────────────
app.delete("/api/suburb/:key", (req, res) => {
  const key = req.params.key.toLowerCase().replace(/-/g, " ").trim();
  if (suburbStore[key]) {
    delete suburbStore[key];
    saveStore();
    res.json({ status: "deleted", suburb: key });
  } else {
    res.status(404).json({ error: "suburb not found" });
  }
});

// ─── Bulk import ────────────────────────────────────────────────────────────
app.post("/api/suburbs/import", (req, res) => {
  const { suburbs } = req.body;
  if (!Array.isArray(suburbs)) return res.status(400).json({ error: "suburbs array required" });

  suburbs.forEach(s => {
    const key = (s.name || "").toLowerCase().trim();
    if (key) {
      suburbStore[key] = {
        ...s,
        name: s.name,
        lastUpdated: new Date().toISOString(),
        source: s.source || "bulk import"
      };
    }
  });

  saveStore();
  res.json({ status: "imported", count: suburbs.length });
});

// ─── HELPERS ────────────────────────────────────────────────────────────────

function generateRentByBed(medianRentHouse, medianRentUnit) {
  const houseR = { 1: 0.58, 2: 0.83, 3: 1.0, 4: 1.16, 5: 1.30, 6: 1.50, 7: 1.67 };
  const unitR  = { 1: 0.60, 2: 0.85, 3: 1.0, 4: 1.13, 5: 1.28, 6: 1.47, 7: 1.60 };
  const result = {};
  for (let b = 1; b <= 7; b++) {
    result[b] = [Math.round(medianRentHouse * houseR[b]), Math.round(medianRentUnit * unitR[b])];
  }
  return result;
}

function generatePriceByBed(medianHousePrice) {
  const ratios = { 1: 0.53, 2: 0.67, 3: 0.90, 4: 1.12, 5: 1.25, 6: 1.40 };
  const result = {};
  for (let b = 1; b <= 6; b++) {
    result[b] = Math.round(medianHousePrice * ratios[b]);
  }
  return result;
}

// ─── START ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 SW Sydney Property Investor API v2`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   ${Object.keys(suburbStore).length} suburbs loaded from disk`);
  console.log(`\n   Endpoints:`);
  console.log(`     GET  /api/suburb/:name          → get suburb data`);
  console.log(`     POST /api/suburb                 → push scraped data`);
  console.log(`     POST /api/analyse                → analyse a property`);
  console.log(`     GET  /api/suburbs                → list all suburbs`);
  console.log(`     POST /api/suburbs/import          → bulk import`);
  console.log(`     POST /api/cache/clear             → clear all data\n`);
});
