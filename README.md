# SW Sydney Property Investor — Backend API

Dynamic property investment analysis API that scrapes real-time suburb data from CoreLogic (via YIP) and PropertyValue.com.au. No hardcoded values — every number comes from a live scrape.

## Quick Start

```bash
npm install
node server.js
```

Server starts on `http://localhost:3001`

## API Endpoints

### `GET /api/suburb/:name?postcode=XXXX`

Fetches live market data for any NSW suburb. Scrapes YIP (CoreLogic) and PropertyValue, merges the results, and caches for 6 hours.

**Example:**
```bash
curl http://localhost:3001/api/suburb/macquarie-fields?postcode=2564
curl http://localhost:3001/api/suburb/minto?postcode=2566
curl http://localhost:3001/api/suburb/east-hills?postcode=2213
curl http://localhost:3001/api/suburb/glenfield?postcode=2167
curl http://localhost:3001/api/suburb/holsworthy?postcode=2173
curl http://localhost:3001/api/suburb/leumeah?postcode=2560
```

**Response:**
```json
{
  "suburb": "macquarie fields",
  "postcode": "2564",
  "name": "Macquarie Fields",
  "lastUpdated": "2026-08-23T...",
  "source": "CoreLogic via YIP",
  "house": {
    "medianPrice": 1000000,
    "medianRent": 620,
    "yield": 3.32,
    "annualGrowth": 11.11,
    "daysOnMarket": 13,
    "salesCount": 98
  },
  "unit": { ... },
  "rentByBed": { "1": [360, 320], "2": [515, 450], ... },
  "estByBed": { "1": 530000, "2": 670000, ... },
  "fromCache": false
}
```

### `POST /api/analyse`

Analyses a specific property using live suburb data.

**Body:**
```json
{
  "suburb": "macquarie-fields",
  "postcode": "2564",
  "price": 1050000,
  "beds": 3,
  "baths": 2,
  "cars": 2,
  "landSize": 450,
  "propertyType": "House"
}
```

**Response:**
```json
{
  "analysis": {
    "score": 72,
    "verdict": "BUY",
    "grossYield": "3.07",
    "rent": 620,
    "vsMedian": "5.0",
    "proj5": 1770000,
    "weekCashflow": -405,
    "reasons": ["Average yield", "At median", "Good land", "High-demand config"]
  }
}
```

### `GET /api/suburbs`

Lists all cached suburbs with summary data.

### `GET /api/health`

Health check endpoint.

### `POST /api/cache/clear`

Clears the data cache (forces fresh scrapes on next request).

## Architecture

```
server.js          → Express API server + caching
src/scrapers.js    → Web scrapers for YIP, PropertyValue
src/analyser.js    → Investment scoring engine
```

## Data Sources

| Source | What it provides | Update frequency |
|---|---|---|
| YIP / CoreLogic | Median prices, rents, yields, growth, DOM, sales count | Monthly (CoreLogic data) |
| PropertyValue | Cross-reference median sale price, rent, yield | Monthly |

## Deployment

### Local
```bash
node server.js
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

### Railway / Render / Fly.io
Set `PORT` environment variable. The server reads `process.env.PORT`.

## Chrome Extension Integration

Update the Chrome extension to call `http://localhost:3001/api/suburb/:name` instead of using hardcoded data. When deployed, replace with your production URL.

## Adding New Suburbs

Just call the API with any NSW suburb name and postcode — it will scrape fresh data automatically. No code changes needed.

```bash
# These all work without any code changes:
curl http://localhost:3001/api/suburb/campbelltown?postcode=2560
curl http://localhost:3001/api/suburb/liverpool?postcode=2170
curl http://localhost:3001/api/suburb/bankstown?postcode=2200
```

## Notes

- Data is cached for 6 hours to avoid excessive scraping
- Scraping respects rate limits — one request per suburb per 6 hours
- Not financial advice — all data should be independently verified
