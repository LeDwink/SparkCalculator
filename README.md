# RouteWorth

RouteWorth is a mobile-friendly static web app for checking Spark offers quickly in a browser.

It is designed for Cloudflare Pages:

- Static frontend only
- No build step
- No npm required for the frontend
- Optional Cloudflare Worker backend for Google route estimates

## Main Workflow

1. Upload screenshot(s).
2. Analyze screenshot(s) with browser OCR.
3. Review detected payout, miles, stops, store text, and dropoff text.
4. Edit the Store/Walmart address and Stop addresses if needed.
5. Press **Get Google Route Time** or **Use Manual Times**.
6. Review **Estimated Hourly AFTER GAS** near the top of the page.
7. Export debug JSON when you want to improve the parser later.

## Settings

Settings are saved in browser `localStorage`:

- Backend API URL
- Preferred Walmart/store address
- Minutes per stop
- MPG
- Gas price
- Minimum acceptable hourly
- Good hourly

Backend API URL example:

```text
https://my-worker-name.my-account.workers.dev
```

## Google Route Backend

The frontend calls:

```text
POST /api/route-estimate
```

Request body:

```json
{
  "storeAddress": "string",
  "stopAddresses": ["string", "string"],
  "returnToStore": true
}
```

Expected response:

```json
{
  "success": true,
  "driveTimeMinutes": 0,
  "returnTimeMinutes": 0,
  "totalGoogleDriveMinutes": 0,
  "totalDistanceMiles": 0,
  "legs": [],
  "warnings": []
}
```

The app auto-fills drive time, return time, total miles, and return miles when possible.

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

RouteWorth stores local debug events in browser `localStorage` for:

- `screenshot_analysis`
- `route_estimate_request`
- `route_estimate_response`
- `correction`
- `calculation`

The Data & Debug section shows:

- Total screenshots analyzed
- Total route estimates requested
- Total corrections made
- Last OCR raw text
- Last detected values
- Last route response
- Last calculation result

Use **Export Debug JSON** to download all local records as:

```text
spark-helper-debug-YYYY-MM-DD.json
```

Use **Clear Debug Data** to remove local debug records.

Debug data and screenshots are not uploaded automatically.

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
6. Open RouteWorth and paste the Worker URL into **Settings > Backend API URL**.

Open the deployed Pages URL on iPhone Safari or Android Chrome. No app install is required.
