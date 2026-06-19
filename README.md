# Spark Helper Prototype

Spark Helper Prototype is a mobile-friendly static web app for checking Spark offers quickly in a browser.

It is designed for Cloudflare Pages:

- Static frontend only
- No build step
- No npm required for the frontend
- Optional Cloudflare Worker backend for Google route estimates

## Main Workflow

1. Upload screenshot(s).
2. Analyze screenshot(s) with browser OCR.
3. Review detected payout, miles, stops, store text, and dropoff text.
4. Press **Get Google Route Time** if a backend URL is configured.
5. Review **Estimated Hourly AFTER GAS** near the top of the page.
6. Export debug JSON when you want to improve the parser later.

## Google Route Backend

The frontend can call a backend endpoint:

```text
POST /api/route-estimate
```

Set the Worker URL in **Settings → Backend API URL**.

Example:

```text
https://my-worker-name.my-account.workers.dev
```

The frontend sends:

```json
{
  "storeAddress": "string",
  "stopAddresses": ["string"],
  "returnToStore": true
}
```

The Worker returns Google drive time, return time, total distance, and route legs. The frontend then auto-fills:

- Google Drive Time
- Google Return Time
- Route miles
- Return miles, when the return leg is available

If no backend URL is set, manual route times still work.

## Calculation

```text
Stop Time = Stops x Minutes Per Stop
Total Trip Time = Drive Time + Return Time + Stop Time
Fuel Cost = Total Distance Miles / MPG x Gas Price
Pay After Gas = Payout - Fuel Cost
Hourly After Gas = Pay After Gas / (Total Trip Time / 60)
```

When a Google route estimate exists, fuel cost uses `totalDistanceMiles` from the backend. Otherwise, it uses manual miles plus return miles.

## Data & Debug

The app stores local debug records in browser `localStorage`.

Records are created for:

- Screenshot analysis
- Route estimates
- User corrections
- Manual calculations

Use **Export Debug JSON** to download all records as:

```text
spark-helper-debug-YYYY-MM-DD.json
```

Use **Clear Local Debug Data** to remove local debug records.

Screenshots and debug records are not uploaded automatically.

## Frontend Files

- `index.html`
- `style.css`
- `script.js`
- `aiParser.js`
- `routeService.js`
- `README.md`

## Worker Files

- `worker/index.js`
- `worker/README.md`
- `worker/wrangler.toml.example`

See [worker/README.md](worker/README.md) for Worker deployment steps and `GOOGLE_MAPS_API_KEY` setup.

## Test Locally

Open `index.html` directly in a browser.

OCR requires internet access because Tesseract.js loads from a CDN. Manual entry and calculation work without OCR.

## Deploy Frontend to Cloudflare Pages

1. Push the frontend files to GitHub.
2. Create a Cloudflare Pages project from the repo.
3. Use no build command.
4. Use `/` as the output directory.
5. Deploy.

Open the deployed Pages URL on iPhone Safari or Android Chrome. No app install is required.
