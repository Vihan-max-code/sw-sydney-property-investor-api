// ─── Suburb data scrapers ─────────────────────────────────────────────────────
// Scrapes market data from YIP (CoreLogic data) and PropertyValue.com.au

const axios = require("axios");
const cheerio = require("cheerio");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0"
};

// ─── YIP (Your Investment Property Magazine) — CoreLogic data ─────────────

async function scrapeYIP(suburb, postcode) {
  const slug = suburb.replace(/\s+/g, "-").toLowerCase();
  const url = `https://www.yourinvestmentpropertymag.com.au/top-suburbs/nsw/${postcode}-${slug}`;

  console.log(`[Scraper] YIP: ${url}`);

  try {
    const { data } = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const text = $("body").text();

    // Extract house data
    const housePrice = extractNumber(text, /median property price for a house is currently \$([\d,]+)/i);
    const houseGrowth = extractDecimal(text, /house.*?annual capital growth of ([\d.]+)%/i);
    const houseRent = extractNumber(text, /median rent.*?\$([\d,]+).*?(?:for houses|weekly)/i) ||
                      extractNumber(text, /Median Rent.*?is \$([\d,]+) for houses/i);
    const houseYield = extractDecimal(text, /rental yields for houses.*?([\d.]+)%/i) ||
                       extractDecimal(text, /Rental Yield.*?is ([\d.]+)% for houses/i);
    const houseDOM = extractInt(text, /houses spend ([\d]+) days on market/i);
    const houseSales = extractInt(text, /(\d+) house(?:s)? sold/i);
    const houseQGrowth = extractDecimal(text, /houses have seen ([\d.]+)% growth in the past quarter/i);

    // Extract unit data
    const unitPrice = extractNumber(text, /median property price for a unit is currently \$([\d,]+)/i);
    const unitGrowth = extractDecimal(text, /unit.*?annual capital growth of ([\d.]+)%/i);
    const unitRent = extractNumber(text, /\$([\d,]+) for units/i);
    const unitYield = extractDecimal(text, /([\d.]+)% for units/i);
    const unitDOM = extractInt(text, /units spent ([\d]+) days on market/i);
    const unitSales = extractInt(text, /(\d+) unit(?:s)? sold/i);

    // Extract name properly
    const nameMatch = text.match(/property market data.*?for ([A-Z][a-z]+(?: [A-Z][a-z]+)*),/);
    const name = nameMatch ? nameMatch[1] : suburb.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

    if (!housePrice && !unitPrice) {
      console.log(`[Scraper] YIP: No price data found for ${suburb}`);
      return null;
    }

    return {
      source: "CoreLogic via YIP",
      name,
      postcode,
      house: {
        medianPrice: housePrice,
        medianRent: houseRent,
        yield: houseYield,
        annualGrowth: houseGrowth,
        quarterlyGrowth: houseQGrowth,
        daysOnMarket: houseDOM,
        salesCount: houseSales
      },
      unit: {
        medianPrice: unitPrice,
        medianRent: unitRent,
        yield: unitYield,
        annualGrowth: unitGrowth,
        daysOnMarket: unitDOM,
        salesCount: unitSales
      }
    };
  } catch (error) {
    console.error(`[Scraper] YIP error for ${suburb}:`, error.message);
    return null;
  }
}

// ─── PropertyValue.com.au ─────────────────────────────────────────────────

async function scrapePropertyValue(suburb, postcode) {
  const slug = suburb.replace(/\s+/g, "%20").toLowerCase();
  const url = `https://www.propertyvalue.com.au/suburb/${slug}-${postcode}-nsw`;

  console.log(`[Scraper] PropertyValue: ${url}`);

  try {
    const { data } = await axios.get(url, {
      headers: HEADERS,
      timeout: 15000
    });

    const $ = cheerio.load(data);
    const text = $("body").text();

    const medianSale = extractNumber(text, /\$([\d,]+)K?\s*Median Sale Price/i) ||
                       extractNumber(text, /Median Sale Price.*?\$([\d,]+)/i);
    const medianRent = extractNumber(text, /\$([\d,]+)pw\s*Median Rent/i) ||
                       extractInt(text, /Median Rent.*?\$([\d,]+)/i);
    const grossYield = extractDecimal(text, /([\d.]+)%\s*Median Gross Yield/i);
    const growth1yr = extractDecimal(text, /([\d.]+)%\s*Median Sale Price Change/i) ||
                      extractDecimal(text, /Median.*?Change.*?([\d.]+)%/i);
    const salesCount = extractInt(text, /(\d+)\s*Houses sold/i);

    const name = suburb.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");

    return {
      source: "PropertyValue",
      name,
      postcode,
      house: {
        medianPrice: medianSale ? (medianSale < 10000 ? medianSale * 1000 : medianSale) : null,
        medianRent: medianRent,
        yield: grossYield,
        annualGrowth: growth1yr,
        daysOnMarket: null,
        salesCount: salesCount
      },
      unit: { medianPrice: null, medianRent: null, yield: null }
    };
  } catch (error) {
    console.error(`[Scraper] PropertyValue error for ${suburb}:`, error.message);
    return null;
  }
}

// ─── Rental data scraper (placeholder for future Rent.com.au/Domain) ──────

async function scrapeRentals(suburb, postcode) {
  // Future: scrape actual rental listings from Rent.com.au or Domain
  // For now, rent estimates are generated from suburb medians in server.js
  return null;
}

// ─── Extraction helpers ───────────────────────────────────────────────────

function extractNumber(text, regex) {
  const match = text.match(regex);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ""));
}

function extractDecimal(text, regex) {
  const match = text.match(regex);
  if (!match) return null;
  return parseFloat(match[1]);
}

function extractInt(text, regex) {
  const match = text.match(regex);
  if (!match) return null;
  return parseInt(match[1]);
}

module.exports = { scrapeYIP, scrapePropertyValue, scrapeRentals };
