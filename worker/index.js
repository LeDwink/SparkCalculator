const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}

function parseGoogleDuration(duration) {
  const match = String(duration || "").match(/^([0-9.]+)s$/);
  return match ? Math.round(Number(match[1]) / 60) : 0;
}

function metersToMiles(meters) {
  return Math.round((Number(meters || 0) / 1609.344) * 10) / 10;
}

async function fetchLeg(env, from, to) {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters"
    },
    body: JSON.stringify({
      origin: { address: from },
      destination: { address: to },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Routes API failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new Error(`No route found from ${from} to ${to}`);
  }

  return {
    from,
    to,
    durationMinutes: parseGoogleDuration(route.duration),
    distanceMiles: metersToMiles(route.distanceMeters)
  };
}

async function handleRouteEstimate(request, env) {
  if (!env.GOOGLE_MAPS_API_KEY) {
    return jsonResponse({
      success: false,
      error: "GOOGLE_MAPS_API_KEY secret is not configured."
    }, 500);
  }

  const body = await request.json();
  const storeAddress = String(body.storeAddress || "").trim();
  const stopAddresses = Array.isArray(body.stopAddresses)
    ? body.stopAddresses.map((address) => String(address || "").trim()).filter(Boolean)
    : [];
  const returnToStore = body.returnToStore !== false;

  if (!storeAddress || !stopAddresses.length) {
    return jsonResponse({
      success: false,
      error: "storeAddress and at least one stop address are required."
    }, 400);
  }

  const routePoints = [storeAddress, ...stopAddresses];
  const legs = [];
  const warnings = [];

  for (let index = 0; index < routePoints.length - 1; index += 1) {
    legs.push(await fetchLeg(env, routePoints[index], routePoints[index + 1]));
  }

  let returnLeg = null;
  if (returnToStore) {
    returnLeg = await fetchLeg(env, routePoints[routePoints.length - 1], storeAddress);
    legs.push(returnLeg);
  }

  const returnTimeMinutes = returnLeg ? returnLeg.durationMinutes : 0;
  const driveTimeMinutes = legs.reduce((sum, leg) => sum + leg.durationMinutes, 0) - returnTimeMinutes;
  const totalGoogleDriveMinutes = legs.reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const totalDistanceMiles = Math.round(legs.reduce((sum, leg) => sum + leg.distanceMiles, 0) * 10) / 10;

  return jsonResponse({
    success: true,
    driveTimeMinutes,
    returnTimeMinutes,
    totalGoogleDriveMinutes,
    totalDistanceMiles,
    legs,
    warnings
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: JSON_HEADERS
      });
    }

    if (url.pathname === "/api/route-estimate" && request.method === "POST") {
      try {
        return await handleRouteEstimate(request, env);
      } catch (error) {
        return jsonResponse({
          success: false,
          error: error.message || "Route estimate failed."
        }, 500);
      }
    }

    return jsonResponse({
      success: false,
      error: "Not found"
    }, 404);
  }
};
