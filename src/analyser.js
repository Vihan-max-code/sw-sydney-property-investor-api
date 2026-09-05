// ─── Property Investment Analyser — ML-Powered ───────────────────────────────
// Uses trained Linear Regression model (R² = 0.681, MAE = $48/wk)
// Trained on 52 actual rental listings from Domain, Soho, Rent.com.au, Gumtree

const ML_MODEL = {
  intercept: 497.4,
  coefficients: {
    beds: 68.6,
    baths: 59.9,
    cars: 11.8,
    is_unit: -42.8,
    is_townhouse: -50.4,
    "suburb_Glenfield": -155.8,
    "suburb_Holsworthy": -75.0,
    "suburb_Leumeah": -198.8,
    "suburb_Macquarie Fields": -153.4,
    "suburb_Minto": -156.2,
  },
  accuracy: { r2: 0.681, mae: 48, mape: 7.5, training_samples: 52, method: "Linear Regression (LOO-CV)" }
};

function capitalise(str) {
  return (str || "").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function predictRent(beds, baths, cars, propertyType, suburbName) {
  const isUnit = /unit|apartment|studio/i.test(propertyType || "");
  const isTownhouse = /townhouse|villa/i.test(propertyType || "");
  const isDuplex = /duplex/i.test(propertyType || "");

  let rent = ML_MODEL.intercept;
  rent += (beds || 3) * ML_MODEL.coefficients.beds;
  rent += (baths || 1) * ML_MODEL.coefficients.baths;
  rent += (cars || 1) * ML_MODEL.coefficients.cars;
  if (isUnit) rent += ML_MODEL.coefficients.is_unit;
  if (isTownhouse) rent += ML_MODEL.coefficients.is_townhouse;

  const subKey = `suburb_${capitalise(suburbName)}`;
  if (ML_MODEL.coefficients[subKey] !== undefined) rent += ML_MODEL.coefficients[subKey];

  if (isDuplex && beds >= 4) {
    const perSide = predictRent(Math.ceil(beds / 2), Math.ceil(baths / 2), 1, "House", suburbName);
    return Math.round(perSide * 2);
  }

  return Math.round(Math.max(rent, 250));
}

function analyseProperty(price, beds, baths, landSize, propertyType, suburbData) {
  if (!price || price < 50000 || price > 10000000) return null;

  const isDuplex = /duplex|dual/i.test(propertyType || "");
  const isUnit = /unit|apartment|studio/i.test(propertyType || "");
  const medianHouse = suburbData?.house?.medianPrice || 1000000;
  const medianUnit = suburbData?.unit?.medianPrice || 688000;
  const growth = isUnit ? (suburbData?.unit?.annualGrowth || suburbData?.house?.annualGrowth || 8) : (suburbData?.house?.annualGrowth || 8);
  const dom = isUnit ? (suburbData?.unit?.daysOnMarket || 20) : (suburbData?.house?.daysOnMarket || 15);
  const median = isDuplex ? medianHouse * 1.5 : isUnit ? medianUnit : medianHouse;
  const vsMedian = ((price - median) / median) * 100;

  const suburbName = suburbData?.name || "Macquarie Fields";
  const rent = predictRent(beds, baths, 1, propertyType, suburbName);

  const annualRent = rent * 52;
  const grossYield = (annualRent / price) * 100;
  const netYield = grossYield * 0.72;
  const loanAmount = price * 0.8;
  const monthlyRepayment = (loanAmount / 100000) * 613;
  const weeklyRepayment = Math.round(monthlyRepayment * 12 / 52);
  const weekCashflow = rent - weeklyRepayment;
  const proj5 = Math.round(price * Math.pow(1 + growth / 100, 5));
  const proj10 = Math.round(price * Math.pow(1 + growth / 100, 10));
  const equity5 = proj5 - price;

  let score = 40;
  const reasons = [];

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

  if (isDuplex) { score += 12; reasons.push("Dual income"); }
  if (beds >= 3 && beds <= 4) { score += 5; reasons.push("High-demand config"); }
  else if (beds >= 5) { score += 3; reasons.push("Large home"); }
  else if (beds === 2) { score += 3; }
  if (baths >= 2 && beds >= 3) score += 3;

  score = Math.min(Math.max(score, 10), 98);
  const verdict = score >= 80 ? "STRONG BUY" : score >= 65 ? "BUY" : score >= 50 ? "HOLD" : "WEAK";
  const color = score >= 80 ? "#10b981" : score >= 65 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return {
    score, verdict, color, reasons, isDuplex,
    grossYield: grossYield.toFixed(2),
    netYield: netYield.toFixed(2),
    rent,
    rentMethod: "ML Model (R²=0.681, MAE=$48/wk)",
    annualRent, vsMedian: vsMedian.toFixed(1),
    weeklyRepayment, weekCashflow,
    growth: growth.toFixed(2), dom,
    proj5, proj10, equity5
  };
}

module.exports = { analyseProperty, predictRent, ML_MODEL };
