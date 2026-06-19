# Spark Helper Cloudflare Worker

This Worker provides the backend route endpoint for Spark Helper Prototype.

Endpoint:

```text
POST /api/route-estimate
```

Request body:

```json
{
  "storeAddress": "Walmart OLEAN #2159, 1869 PLAZA DR, OLEAN, NY 14760",
  "stopAddresses": ["2323 Five Mile Rd, Allegany, NY 14706"],
  "returnToStore": true
}
```

The Worker calls Google Routes API using a server-side secret named `GOOGLE_MAPS_API_KEY`.

## Deploy Frontend to Cloudflare Pages

1. Put the frontend files in a GitHub repo root:
   - `index.html`
   - `style.css`
   - `script.js`
   - `aiParser.js`
   - `routeService.js`
   - `README.md`
2. In Cloudflare, create a Pages project from that repo.
3. Use no build command.
4. Use `/` as the output directory.
5. Deploy.

## Deploy Worker

1. Install Wrangler if needed:

```bash
npm install -g wrangler
```

2. Copy `wrangler.toml.example` to `wrangler.toml`.
3. From this `worker` folder, deploy:

```bash
wrangler deploy
```

## Add Google Maps Secret

Run:

```bash
wrangler secret put GOOGLE_MAPS_API_KEY
```

Paste your Google Maps / Routes API key when prompted.

Do not put the Google API key in frontend code.

## Connect the App

1. Copy the deployed Worker URL, for example:

```text
https://spark-helper-route-worker.your-account.workers.dev
```

2. Open Spark Helper Prototype.
3. Go to **Settings**.
4. Paste the Worker URL into **Backend API URL**.
5. Upload and analyze screenshots.
6. Press **Get Google Route Time**.

Debug data and screenshots are not uploaded automatically. Debug data is stored only in browser `localStorage` until you manually export it.
