// ─── Seed the database with verified CoreLogic data ───────────────────────────
// Run: node seed.js
// All data from CoreLogic via YIP (yourinvestmentpropertymag.com.au), Jun-Aug 2026

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "suburbs.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const suburbs = {
  "macquarie fields": {
    name: "Macquarie Fields", postcode: "2564",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (Jun 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 1000000, medianRent: 620,
      yield: 3.32, annualGrowth: 11.11,
      quarterlyGrowth: 0.0, daysOnMarket: 13, salesCount: 98
    },
    unit: {
      medianPrice: 688500, medianRent: 530,
      yield: 3.98, annualGrowth: 7.58,
      daysOnMarket: 15, salesCount: 76
    }
  },
  "minto": {
    name: "Minto", postcode: "2566",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (Jun 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 1055000, medianRent: 650,
      yield: 3.54, annualGrowth: 11.64,
      daysOnMarket: 18, salesCount: 130
    },
    unit: {
      medianPrice: 730500, medianRent: 500,
      yield: 4.27, annualGrowth: 18.78,
      daysOnMarket: 19, salesCount: 39
    }
  },
  "leumeah": {
    name: "Leumeah", postcode: "2560",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (Jul 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 985100, medianRent: 620,
      yield: 3.43, annualGrowth: 9.46,
      daysOnMarket: 13, salesCount: 121
    },
    unit: {
      medianPrice: 548000, medianRent: 500,
      yield: 4.75, annualGrowth: 8.0,
      daysOnMarket: 12, salesCount: 42
    }
  },
  "glenfield": {
    name: "Glenfield", postcode: "2167",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (Jul 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 1182500, medianRent: 700,
      yield: 3.16, annualGrowth: 9.49,
      daysOnMarket: 15, salesCount: 91
    },
    unit: {
      medianPrice: 765000, medianRent: 578,
      yield: 3.93, annualGrowth: 8.0,
      daysOnMarket: 12, salesCount: 53
    }
  },
  "holsworthy": {
    name: "Holsworthy", postcode: "2173",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (May 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 1235000, medianRent: 770,
      yield: 2.99, annualGrowth: 0.94,
      daysOnMarket: 21, salesCount: 50
    },
    unit: {
      medianPrice: 1000000, medianRent: 735,
      yield: 3.82, annualGrowth: 2.0,
      daysOnMarket: 30, salesCount: 4
    }
  },
  "east hills": {
    name: "East Hills", postcode: "2213",
    lastUpdated: "2026-08-23T00:00:00Z",
    source: "CoreLogic via YIP (Aug 2026)",
    scrapedFrom: "yourinvestmentpropertymag.com.au",
    house: {
      medianPrice: 1688000, medianRent: 850,
      yield: 2.65, annualGrowth: 6.84,
      daysOnMarket: 35, salesCount: 45
    },
    unit: {
      medianPrice: 1055000, medianRent: 650,
      yield: 3.2, annualGrowth: 5.0,
      daysOnMarket: 30, salesCount: 12
    }
  }
};

fs.writeFileSync(DATA_FILE, JSON.stringify(suburbs, null, 2));
console.log(`✅ Seeded ${Object.keys(suburbs).length} suburbs to ${DATA_FILE}`);
Object.entries(suburbs).forEach(([key, data]) => {
  console.log(`   ${data.name} (${data.postcode}): $${(data.house.medianPrice/1000).toFixed(0)}k median, ${data.house.yield}% yield, ${data.house.annualGrowth}% growth`);
});
