# RouteWorth

RouteWorth is a mobile-friendly static web app for checking Spark offers quickly in a browser.

Current normal workflow:

1. Upload screenshot(s).
2. Analyze screenshot(s) with browser OCR.
3. Check or edit the Store/Walmart address and stop addresses.
4. Tap **Open Route in Maps**.
5. Enter the Maps drive time and Maps total miles.
6. Review **Estimated Hourly AFTER GAS** near the top of the page.

No API key is needed for the normal app workflow.

## Settings

Settings are saved in browser `localStorage`:

- Preferred Walmart/store address
- Minutes per stop
- MPG
- Gas price
- Minimum acceptable hourly
- Good hourly

The future backend route service code is still included, but its UI is hidden for now.

## Open In Maps

RouteWorth builds a route link using:

```text
Store/Walmart -> stop 1 -> stop 2 -> final stop -> Store/Walmart
```

The return leg is controlled by **Include return to store**.

Platform behavior:

- iPhone, iPad, and macOS Safari try Apple Maps.
- Android, Chrome, and other browsers use Google Maps.
- Uncertain platforms default to Google Maps.

After Maps opens, enter:

- Maps drive time
- Maps total miles

## Calculation

```text
Stop Time = Stops x Minutes Per Stop
Total Trip Time = Maps Drive Time + Stop Time
Fuel Cost = Maps Total Miles / MPG x Gas Price
Pay After Gas = Payout - Fuel Cost
Hourly After Gas = Pay After Gas / (Total Trip Time / 60)
```

## Data & Debug

RouteWorth stores local debug events in browser `localStorage` for:

- `screenshot_analysis`
- `opened_maps_route`
- `correction`
- `calculation`

The Data & Debug section shows:

- Total screenshots analyzed
- Total maps routes opened
- Total corrections made
- Last OCR raw text
- Last detected values
- Last route/map event
- Last calculation result

Use **Export Debug JSON** to download all local records as:

```text
spark-helper-debug-YYYY-MM-DD.json
```

Use **Clear Debug Data** to remove local debug records.

Debug data and screenshots are not uploaded automatically.

## Future Route API

The code keeps a future Cloudflare Worker / Google Routes API path in:

- `routeService.js`
- `worker/index.js`
- `worker/README.md`
- `worker/wrangler.toml.example`

Future version: replace manual map opening with backend route estimate API.

## Frontend Files

- `index.html`
- `style.css`
- `script.js`
- `aiParser.js`
- `routeService.js`
- `README.md`

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
