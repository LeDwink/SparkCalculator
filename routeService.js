(function () {
  function asNumber(value, fallback = 0) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeBackendUrl(url) {
    return String(url || "").trim().replace(/\/+$/, "");
  }

  function emptyRouteEstimate() {
    return {
      success: false,
      driveTimeMinutes: null,
      returnTimeMinutes: null,
      totalGoogleDriveMinutes: null,
      totalDistanceMiles: null,
      legs: [],
      warnings: [],
      source: "manual"
    };
  }

  function estimateManualRoute(input) {
    const driveTimeMinutes = input.googleDriveTime === "" || input.googleDriveTime === null
      ? null
      : Math.max(0, asNumber(input.googleDriveTime));
    const returnTimeMinutes = input.googleReturnTime === "" || input.googleReturnTime === null
      ? null
      : Math.max(0, asNumber(input.googleReturnTime));
    const routeMiles = Math.max(0, asNumber(input.routeMiles));
    const returnMiles = Math.max(0, asNumber(input.returnMiles));

    return {
      success: true,
      driveTimeMinutes,
      returnTimeMinutes,
      totalGoogleDriveMinutes: (driveTimeMinutes || 0) + (returnTimeMinutes || 0),
      totalDistanceMiles: routeMiles + returnMiles,
      legs: [],
      warnings: [],
      source: "manual"
    };
  }

  function normalizeRouteResponse(data) {
    const legs = Array.isArray(data?.legs) ? data.legs.map((leg) => ({
      from: String(leg.from || ""),
      to: String(leg.to || ""),
      durationMinutes: asNumber(leg.durationMinutes),
      distanceMiles: asNumber(leg.distanceMiles)
    })) : [];

    return {
      success: Boolean(data?.success),
      driveTimeMinutes: asNumber(data?.driveTimeMinutes),
      returnTimeMinutes: asNumber(data?.returnTimeMinutes),
      totalGoogleDriveMinutes: asNumber(data?.totalGoogleDriveMinutes),
      totalDistanceMiles: asNumber(data?.totalDistanceMiles),
      legs,
      warnings: Array.isArray(data?.warnings) ? data.warnings.map(String) : [],
      source: "google"
    };
  }

  async function requestGoogleRouteEstimate(backendApiUrl, payload) {
    // TODO: Future version: replace manual map opening with this backend route estimate API.
    // Keep this helper parked until RouteWorth is ready for Cloudflare Worker + Google Routes.
    const baseUrl = normalizeBackendUrl(backendApiUrl);
    if (!baseUrl) {
      throw new Error("Backend API URL not set. Enter route times manually or add a backend URL in settings.");
    }

    const response = await fetch(`${baseUrl}/api/route-estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Route endpoint returned ${response.status}`);
    }

    const data = await response.json();
    if (!data?.success) {
      throw new Error(data?.error || "Route endpoint did not return success.");
    }

    return normalizeRouteResponse(data);
  }

  window.SparkRouteService = {
    emptyRouteEstimate,
    estimateManualRoute,
    requestGoogleRouteEstimate,
    normalizeRouteResponse
  };
}());
