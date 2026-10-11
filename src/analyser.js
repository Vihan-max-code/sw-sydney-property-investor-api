// SW Sydney Property Investor — Analyser v3
// 3 Models: Rent (ML), Price (range-aware), 5yr Projection (infrastructure)

var ML = {
  intercept: 497.4,
  c: {
    beds: 68.6, baths: 59.9, cars: 11.8,
    is_unit: -42.8, is_townhouse: -50.4,
    "suburb_Glenfield": -155.8, "suburb_Holsworthy": -75.0,
    "suburb_Leumeah": -198.8, "suburb_Macquarie Fields": -153.4, "suburb_Minto": -156.2
  }
};

var PR = {
  "Macquarie Fields": { g: 7.52 },
  "Minto": { g: 7.83 },
  "Leumeah": { g: 7.76 },
  "Glenfield": { g: 9.56 },
  "Holsworthy": { g: 2.00 },
  "East Hills": { g: 6.31 }
};

var INF = {
  "Macquarie Fields": { a: 0.06 },
  "Minto": { a: 0.00 },
  "Leumeah": { a: 0.04 },
  "Glenfield": { a: 0.21 },
  "Holsworthy": { a: 0.02 },
  "East Hills": { a: 0.11 }
};

function cap(s) {
  if (!s) return "";
  return s.split(" ").map(function(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}

// MODEL 1: Predict rent using Linear Regression coefficients
function predictRent(beds, baths, cars, propertyType, suburbName) {
  // INPUT VALIDATION: training data covers 2-5 beds, 1-3 baths
  // Higher values = likely parsing error, clamp to model's range
  if (beds > 6) beds = 6;
  if (baths > 4) baths = 4;
  if (cars > 4) cars = 4;
  var r = ML.intercept;
  r += (beds || 3) * ML.c.beds;
  r += (baths || 1) * ML.c.baths;
  r += (cars || 1) * ML.c.cars;
  if (propertyType && /unit|apartment|studio/i.test(propertyType)) r += ML.c.is_unit;
  if (propertyType && /townhouse|villa/i.test(propertyType)) r += ML.c.is_townhouse;
  var k = "suburb_" + cap(suburbName);
  if (ML.c[k] !== undefined) r += ML.c[k];
  // MARKET ADJUSTMENT: Listed rents understate actual rents paid
  // Source: Domain/CoreLogic data shows vacancy rate in SW Sydney ~1.4%
  // In tight markets (<2% vacancy), actual rent paid is typically 5-8% above listing
  // Also accounts for lease renewal increases not captured in listings

  // 1. Underquoting adjustment: agents list low to generate demand
  //    At 1.4% vacancy, properties typically let for 5% above asking
  var underquoteAdj = 1.05;

  // 2. Lease renewal uplift: existing tenants face 3-5% increases
  //    that don't appear in new listings. Average across market = +3%
  var renewalAdj = 1.03;

  // Combined: actual market rent is ~8% above listed rents
  r = r * underquoteAdj * renewalAdj;

  return Math.round(Math.max(r, 250));
}

// MODEL 2: Predict price
// If a price range is given (low-high), predicts WHERE in the range based on features
// If no price, predicts from suburb median + infrastructure
function predictPrice(beds, baths, cars, landSize, propertyType, suburbData, priceLow, priceHigh) {
  var iu = propertyType && /unit|apartment|studio/i.test(propertyType);
  var it = propertyType && /townhouse|villa/i.test(propertyType);

  // CASE 1: Price range given — predict position within range
  if (priceLow && priceHigh && priceHigh > priceLow) {
    var range = priceHigh - priceLow;
    var position = 0.5; // start at midpoint

    // More beds = higher in range
    if ((beds || 3) >= 4) position += 0.15;
    else if ((beds || 3) <= 2) position -= 0.15;

    // More baths = higher in range
    if ((baths || 1) >= 3) position += 0.10;
    else if ((baths || 1) >= 2) position += 0.05;

    // Larger land = higher in range
    if (landSize && landSize >= 600) position += 0.10;
    else if (landSize && landSize >= 400) position += 0.05;
    else if (landSize && landSize < 300) position -= 0.05;

    // Units sit lower in range
    if (iu) position -= 0.10;

    // Clamp position between 0.1 and 0.9 (never exactly at edges)
    position = Math.min(0.9, Math.max(0.1, position));

    var predicted = Math.round((priceLow + range * position) / 5000) * 5000;
    return predicted;
  }

  // CASE 2: Single price given — return that price (already known)
  if (priceLow && !priceHigh) {
    return priceLow;
  }

  // CASE 3: No price at all — predict from suburb median + infrastructure
  var mh = (suburbData && suburbData.house) ? suburbData.house.medianPrice : 1000000;
  var mu = (suburbData && suburbData.unit) ? suburbData.unit.medianPrice : 688000;
  var p = iu ? mu : mh;

  p = p * (1 + ((beds || 3) - 3) * 0.18);
  p = p * (1 + ((baths || 1) - 1) * 0.10);
  p = p * (1 + ((cars || 1) - 1) * 0.03);
  if (!iu && landSize && landSize > 0) {
    p = p * (1 + (landSize - 400) * 0.0004);
  }
  if (it) p = p * 0.85;

  var nm = (suburbData && suburbData.name) ? suburbData.name : "";
  var inf = INF[cap(nm)];
  if (inf) p = p * (1 + inf.a);

  return Math.round(p / 5000) * 5000;
}

// MODEL 3: 5-year projection using infrastructure-based growth rates
function getProjectedGrowth(suburbName) {
  var proj = PR[cap(suburbName)];
  return proj ? proj.g : 6.0;
}

// FULL ANALYSIS
function analyseProperty(price, beds, baths, landSize, propertyType, suburbData, priceLow, priceHigh) {
  if (!price || price < 50000 || price > 10000000) return null;

  var iu = propertyType && /unit|apartment|studio/i.test(propertyType);
  var dom = iu
    ? ((suburbData && suburbData.unit) ? suburbData.unit.daysOnMarket : 20)
    : ((suburbData && suburbData.house) ? suburbData.house.daysOnMarket : 15);
  var median = iu
    ? ((suburbData && suburbData.unit) ? suburbData.unit.medianPrice : 688000)
    : ((suburbData && suburbData.house) ? suburbData.house.medianPrice : 1000000);

  var vsMedian = ((price - median) / median) * 100;
  var sub = (suburbData && suburbData.name) ? suburbData.name : "Macquarie Fields";

  // Rent prediction
  var rent = predictRent(beds, baths, 1, propertyType, sub);
  var grossYield = (rent * 52 / price) * 100;

  // Growth projection
  var growth = getProjectedGrowth(sub);
  if (price > 2000000) growth = Math.min(growth, 3.0);
  else if (price > 1500000) growth = Math.min(growth, 4.5);
  else if (price > 1200000) growth = Math.min(growth, 6.0);
  var proj5 = Math.round(price * Math.pow(1 + growth / 100, 5));
  if (proj5 > price * 1.50) proj5 = Math.round(price * 1.50);
  var equity5 = proj5 - price;

  // Price prediction
  var modelPrice = predictPrice(beds, baths, 1, landSize, propertyType, suburbData, priceLow, priceHigh);

  // Score
  var score = 40;
  var reasons = [];

  if (grossYield >= 5) { score += 25; reasons.push("Excellent yield"); }
  else if (grossYield >= 4.5) { score += 20; reasons.push("Strong yield"); }
  else if (grossYield >= 4) { score += 16; reasons.push("Good yield"); }
  else if (grossYield >= 3.5) { score += 12; reasons.push("Solid yield"); }
  else if (grossYield >= 3) { score += 8; reasons.push("Average yield"); }
  else if (grossYield >= 2.5) { score += 4; reasons.push("Below-avg yield"); }

  if (vsMedian < -30) { score += 15; reasons.push("Deep value"); }
  else if (vsMedian < -15) { score += 12; reasons.push("Well below median"); }
  else if (vsMedian < -5) { score += 8; reasons.push("Below median"); }
  else if (vsMedian < 5) { score += 5; reasons.push("At median"); }

  if (landSize >= 700) { score += 10; reasons.push("Large land"); }
  else if (landSize >= 500) { score += 7; reasons.push("Good land"); }
  else if (landSize >= 300) { score += 4; }

  if (beds >= 3 && beds <= 4) { score += 5; reasons.push("High-demand config"); }
  else if (beds >= 5) { score += 3; reasons.push("Large home"); }
  else if (beds === 2) { score += 3; }
  if (baths >= 2 && beds >= 3) score += 3;

  score = Math.min(Math.max(score, 10), 98);
  var verdict = score >= 80 ? "STRONG BUY" : score >= 65 ? "BUY" : score >= 50 ? "HOLD" : "WEAK";
  var color = score >= 80 ? "#10b981" : score >= 65 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return {
    score: score,
    verdict: verdict,
    color: color,
    reasons: reasons,
    grossYield: grossYield.toFixed(2),
    rent: rent,
    dom: dom,
    growth: growth.toFixed(2),
    proj5: proj5,
    equity5: equity5,
    modelPrice: modelPrice
  };
}

module.exports = {
  analyseProperty: analyseProperty,
  predictRent: predictRent,
  predictPrice: predictPrice,
  getProjectedGrowth: getProjectedGrowth
};
