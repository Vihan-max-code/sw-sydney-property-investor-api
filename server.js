var express = require("express");
var cors = require("cors");
var fs = require("fs");
var path = require("path");
var analyser = require("./src/analyser");

var app = express();
var PORT = process.env.PORT || 3001;
var DATA_FILE = path.join(__dirname, "data", "suburbs.json");

if (!fs.existsSync(path.join(__dirname, "data"))) fs.mkdirSync(path.join(__dirname, "data"));
var suburbStore = {};
if (fs.existsSync(DATA_FILE)) {
  try { suburbStore = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) { suburbStore = {}; }
}
function saveStore() { fs.writeFileSync(DATA_FILE, JSON.stringify(suburbStore, null, 2)); }

function generateRentByBed(mh, mu) {
  var hr = { 1: 0.58, 2: 0.83, 3: 1.0, 4: 1.16, 5: 1.30, 6: 1.50, 7: 1.67 };
  var ur = { 1: 0.60, 2: 0.85, 3: 1.0, 4: 1.13, 5: 1.28, 6: 1.47, 7: 1.60 };
  var result = {};
  for (var b = 1; b <= 7; b++) result[b] = [Math.round(mh * hr[b]), Math.round(mu * ur[b])];
  return result;
}
function generatePriceByBed(mhp) {
  var ratios = { 1: 0.53, 2: 0.67, 3: 0.90, 4: 1.12, 5: 1.25, 6: 1.40 };
  var result = {};
  for (var b = 1; b <= 6; b++) result[b] = Math.round(mhp * ratios[b]);
  return result;
}

app.use(cors());
app.use(express.json());

app.get("/api/health", function(req, res) {
  res.json({ status: "ok", suburbs: Object.keys(suburbStore).length, timestamp: new Date().toISOString() });
});

app.get("/api/suburb/:key", function(req, res) {
  var key = req.params.key.toLowerCase().replace(/-/g, " ").replace(/\+/g, " ").trim();
  var data = suburbStore[key];
  if (!data) {
    var vals = Object.values(suburbStore);
    for (var i = 0; i < vals.length; i++) { if (vals[i].postcode === key) { data = vals[i]; break; } }
  }
  if (!data) {
    var entries = Object.entries(suburbStore);
    for (var j = 0; j < entries.length; j++) { if (entries[j][0].indexOf(key) !== -1 || key.indexOf(entries[j][0]) !== -1) { data = entries[j][1]; break; } }
  }
  if (!data) return res.status(404).json({ error: "No data", available: Object.keys(suburbStore) });
  data.rentByBed = generateRentByBed(data.house ? data.house.medianRent : 600, data.unit ? data.unit.medianRent : 500);
  data.estByBed = generatePriceByBed(data.house ? data.house.medianPrice : 900000);
  res.json(data);
});

app.post("/api/suburb", function(req, res) {
  var name = req.body.name;
  if (!name) return res.status(400).json({ error: "name required" });
  var key = name.toLowerCase().trim();
  var existing = suburbStore[key] || {};
  suburbStore[key] = Object.assign({}, existing, {
    name: name.split(" ").map(function(w) { return w[0].toUpperCase() + w.slice(1); }).join(" "),
    postcode: req.body.postcode || existing.postcode,
    lastUpdated: new Date().toISOString(),
    house: Object.assign({}, existing.house || {}, req.body.house || {}),
    unit: Object.assign({}, existing.unit || {}, req.body.unit || {})
  });
  saveStore();
  res.json({ status: "saved", suburb: key });
});

// ANALYSE — now passes priceLow and priceHigh to the analyser
app.post("/api/analyse", function(req, res) {
  var suburb = req.body.suburb;
  var price = req.body.price;
  var beds = req.body.beds;
  var baths = req.body.baths;
  var landSize = req.body.landSize;
  var propertyType = req.body.propertyType;
  var priceLow = req.body.priceLow || null;
  var priceHigh = req.body.priceHigh || null;

  if (!price) return res.status(400).json({ error: "price required" });

  var key = (suburb || "").toLowerCase().replace(/-/g, " ").trim();
  var suburbData = suburbStore[key] || null;
  if (!suburbData) {
    var vals = Object.values(suburbStore);
    for (var i = 0; i < vals.length; i++) { if (vals[i].postcode === req.body.postcode) { suburbData = vals[i]; break; } }
  }

  var analysis = analyser.analyseProperty(price, beds, baths, landSize, propertyType, suburbData, priceLow, priceHigh);

  res.json({
    suburb: key, price: price, beds: beds, baths: baths, landSize: landSize, propertyType: propertyType,
    priceLow: priceLow, priceHigh: priceHigh,
    analysis: analysis,
    suburbData: suburbData ? { name: suburbData.name, medianHouse: suburbData.house ? suburbData.house.medianPrice : null, medianUnit: suburbData.unit ? suburbData.unit.medianPrice : null, rentHouse: suburbData.house ? suburbData.house.medianRent : null, growthHouse: suburbData.house ? suburbData.house.annualGrowth : null, dom: suburbData.house ? suburbData.house.daysOnMarket : null } : null
  });
});

app.get("/api/suburbs", function(req, res) {
  var suburbs = Object.entries(suburbStore).map(function(e) {
    return { key: e[0], name: e[1].name, postcode: e[1].postcode, medianHouse: e[1].house ? e[1].house.medianPrice : null, lastUpdated: e[1].lastUpdated };
  });
  res.json({ count: suburbs.length, suburbs: suburbs });
});

app.post("/api/suburbs/import", function(req, res) {
  var suburbs = req.body.suburbs;
  if (!Array.isArray(suburbs)) return res.status(400).json({ error: "suburbs array required" });
  suburbs.forEach(function(s) {
    var key = (s.name || "").toLowerCase().trim();
    if (key) suburbStore[key] = Object.assign({}, s, { lastUpdated: new Date().toISOString() });
  });
  saveStore();
  res.json({ status: "imported", count: suburbs.length });
});

app.listen(PORT, function() {
  console.log("\n🏠 SW Sydney Property Investor API v4");
  console.log("   http://localhost:" + PORT);
  console.log("   " + Object.keys(suburbStore).length + " suburbs loaded");
  console.log("\n   GET  /api/suburb/:name");
  console.log("   POST /api/analyse  (now with priceLow/priceHigh)");
  console.log("   GET  /api/suburbs\n");
});
