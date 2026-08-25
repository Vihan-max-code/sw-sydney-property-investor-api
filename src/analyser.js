// ─── Property Investment Analyser ─────────────────────────────────────────────
// Calculates investment score, yield, projections, cashflow from suburb data

function analyseProperty(price, beds, baths, landSize, propertyType, suburbData) {
  if (!price || price < 50000 || price > 10000000) return null;

  const isDuplex = /duplex|dual/i.test(propertyType || "");
  const isUnit = /unit|apartment|studio/i.test(propertyType || "");

  // Get suburb-specific medians (fallback to defaults if suburb data unavailable)
  const medianHouse = suburbData?.house?.medianPrice || 1000000;
  const medianUnit = suburbData?.unit?.medianPrice || 688000;
  const medianRentHouse = suburbData?.house?.medianRent || 620;
  const medianRentUnit = suburbData?.unit?.medianRent || 530;
  const growth = isUnit
    ? (suburbData?.unit?.annualGrowth || suburbData?.house?.annualGrowth || 8)
    : (suburbData?.house?.annualGrowth || 8);
  const dom = isUnit
    ? (suburbData?.unit?.daysOnMarket || 20)
    : (suburbData?.house?.daysOnMarket || 15);

  // Comparison median
  const median = isDuplex ? medianHouse * 1.5 : isUnit ? medianUnit : medianHouse;

  // Rent estimate
  const baseRent = isUnit ? medianRentUnit : medianRentHouse;
  const rentRatios = { 1: 0.58, 2: 0.83, 3: 1.0, 4: 1.16, 5: 1.30, 6: 1.50, 7: 1.67 };
  const bedKey = Math.min(Math.max(beds || 3, 1), 7);
  let rent = Math.round(baseRent * (rentRatios[bedKey] || 1.0));

  // Duplexes: dual income
  if (isDuplex && beds >= 4) {
    const halfBeds = Math.ceil(beds / 2);
    const perSide = Math.round(baseRent * (rentRatios[Math.min(halfBeds, 7)] || 1.0));
    rent = perSide * 2;
  }

  // Calculations
  const annualRent = rent * 52;
  const grossYield = (annualRent / price) * 100;
  const netYield = grossYield * 0.72; // 28% expenses
  const vsMedian = ((price - median) / median) * 100;

  // Mortgage estimate (P&I, 6.2% variable, 80% LVR, 30yr)
  const loanAmount = price * 0.8;
  const monthlyRepayment = (loanAmount / 100000) * 613;
  const weeklyRepayment = Math.round(monthlyRepayment * 12 / 52);
  const weekCashflow = rent - weeklyRepayment;

  // Projections
  const proj5 = Math.round(price * Math.pow(1 + growth / 100, 5));
  const proj10 = Math.round(price * Math.pow(1 + growth / 100, 10));
  const equity5 = proj5 - price;

  // ─── SCORE ──────────────────────────────────────────────────────────────
  let score = 40;
  const reasons = [];

  // Yield scoring
  if (grossYield >= 5) { score += 25; reasons.push("Excellent yield"); }
  else if (grossYield >= 4.5) { score += 20; reasons.push("Strong yield"); }
  else if (grossYield >= 4) { score += 16; reasons.push("Good yield"); }
  else if (grossYield >= 3.5) { score += 12; reasons.push("Solid yield"); }
  else if (grossYield >= 3) { score += 8; reasons.push("Average yield"); }
  else if (grossYield >= 2.5) { score += 4; reasons.push("Below-avg yield"); }

  // Value scoring
  if (vsMedian < -30) { score += 15; reasons.push("Deep value"); }
  else if (vsMedian < -15) { score += 12; reasons.push("Well below median"); }
  else if (vsMedian < -5) { score += 8; reasons.push("Below median"); }
  else if (vsMedian < 5) { score += 5; reasons.push("At median"); }

  // Land scoring
  if (landSize >= 700) { score += 10; reasons.push("Large land"); }
  else if (landSize >= 500) { score += 7; reasons.push("Good land"); }
  else if (landSize >= 300) { score += 4; }

  // Property type bonuses
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
    annualRent,
    vsMedian: vsMedian.toFixed(1),
    weeklyRepayment,
    weekCashflow,
    growth: growth.toFixed(2),
    dom,
    proj5, proj10, equity5
  };
}

module.exports = { analyseProperty };
