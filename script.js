const APP_VERSION = "0.5.0-cloudflare-route";
const SETTINGS_STORAGE_KEY = "sparkHelperSettings";
const DEBUG_STORAGE_KEY = "sparkHelperDebugRecords";

const fields = {
  payout: document.querySelector("#payout"),
  sparkMiles: document.querySelector("#sparkMiles"),
  returnMiles: document.querySelector("#returnMiles"),
  stops: document.querySelector("#stops"),
  driveTime: document.querySelector("#driveTime"),
  returnTime: document.querySelector("#returnTime"),
  mpg: document.querySelector("#mpg"),
  gasPrice: document.querySelector("#gasPrice"),
  unloadMinutes: document.querySelector("#unloadMinutes"),
  minAcceptableHourly: document.querySelector("#minAcceptableHourly"),
  minimumGoodHourly: document.querySelector("#minimumGoodHourly"),
  preferredWalmart: document.querySelector("#preferredWalmart"),
  backendApiUrl: document.querySelector("#backendApiUrl"),
  mainTimeDisplay: document.querySelector("#mainTimeDisplay"),
  routeStoreAddress: document.querySelector("#routeStoreAddress"),
  routeStopAddresses: document.querySelector("#routeStopAddresses"),
  includeReturnToStore: document.querySelector("#includeReturnToStore")
};

const detectedInputs = {
  payout: document.querySelector("#detectedPayout"),
  sparkMiles: document.querySelector("#detectedMiles"),
  sparkMinutes: document.querySelector("#detectedMinutes"),
  stops: document.querySelector("#detectedStops"),
  pickupText: document.querySelector("#detectedPickup"),
  dropoffText: document.querySelector("#detectedDropoffs")
};

const screenshotInput = document.querySelector("#screenshotInput");
const previewList = document.querySelector("#previewList");
const analyzeButton = document.querySelector("#analyzeButton");
const parserMessage = document.querySelector("#parserMessage");
const routeMessage = document.querySelector("#routeMessage");
const ocrStatus = document.querySelector("#ocrStatus");
const ocrText = document.querySelector("#ocrText");
const locationText = document.querySelector("#locationText");
const form = document.querySelector("#calculatorForm");
const resultCard = document.querySelector("#resultCard");
const warningList = document.querySelector("#warningList");
const detectedCard = document.querySelector("#detectedCard");
const useDetectedButton = document.querySelector("#useDetectedButton");
const calculateDetectedButton = document.querySelector("#calculateDetectedButton");
const clearScreenshotsButton = document.querySelector("#clearScreenshotsButton");
const getRouteButton = document.querySelector("#getRouteButton");
const openMapsButton = document.querySelector("#openMapsButton");
const useManualTimesButton = document.querySelector("#useManualTimesButton");
const exportDebugButton = document.querySelector("#exportDebugButton");
const clearDebugButton = document.querySelector("#clearDebugButton");

let lastDetectedOffer = null;
let lastRouteEstimate = null;
let lastCalculatedResult = null;

function numberValue(input, fallback = 0) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function optionalNumber(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : null;
}

function hasValue(input) {
  return String(input.value).trim() !== "";
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatMinutes(value) {
  const total = Math.round(Number(value) || 0);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeCorrectionValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function safeParseJson(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch (error) {
    return fallback;
  }
}

function readJsonStorage(key, fallback) {
  try {
    return safeParseJson(localStorage.getItem(key), fallback);
  } catch (error) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    parserMessage.textContent = "Local storage is unavailable in this browser.";
    return false;
  }
}

function readSettings() {
  return readJsonStorage(SETTINGS_STORAGE_KEY, {});
}

function saveSettings() {
  writeJsonStorage(SETTINGS_STORAGE_KEY, {
    preferredWalmart: fields.preferredWalmart.value,
    backendApiUrl: fields.backendApiUrl.value,
    minutesPerStop: fields.unloadMinutes.value,
    gasPrice: fields.gasPrice.value,
    mpg: fields.mpg.value,
    minAcceptableHourly: fields.minAcceptableHourly.value,
    goodHourly: fields.minimumGoodHourly.value,
    mainTimeDisplay: fields.mainTimeDisplay.value
  });
}

function loadSettings() {
  const settings = readSettings();
  if (settings.preferredWalmart !== undefined) fields.preferredWalmart.value = settings.preferredWalmart;
  if (settings.backendApiUrl !== undefined) fields.backendApiUrl.value = settings.backendApiUrl;
  if (settings.minutesPerStop !== undefined) fields.unloadMinutes.value = settings.minutesPerStop;
  if (settings.gasPrice !== undefined) fields.gasPrice.value = settings.gasPrice;
  if (settings.mpg !== undefined) fields.mpg.value = settings.mpg;
  if (settings.minAcceptableHourly !== undefined) fields.minAcceptableHourly.value = settings.minAcceptableHourly;
  if (settings.goodHourly !== undefined) fields.minimumGoodHourly.value = settings.goodHourly;
  if (settings.mainTimeDisplay !== undefined) fields.mainTimeDisplay.value = settings.mainTimeDisplay;
}

function readDebugRecords() {
  const records = readJsonStorage(DEBUG_STORAGE_KEY, []);
  return Array.isArray(records) ? records : [];
}

function writeDebugRecords(records) {
  writeJsonStorage(DEBUG_STORAGE_KEY, records);
}

function getStopAddresses() {
  const routeText = fields.routeStopAddresses.value.trim();
  const sourceText = routeText || detectedInputs.dropoffText.value;
  return sourceText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStoreAddress() {
  return fields.routeStoreAddress.value.trim() || detectedInputs.pickupText.value.trim() || fields.preferredWalmart.value.trim();
}

function shouldUseAppleMaps() {
  const userAgent = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  const isAppleDevice = /iPhone|iPad|iPod|Macintosh/i.test(userAgent);
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|FxiOS|Edg/i.test(userAgent) && /Apple/i.test(vendor);
  return isAppleDevice && isSafari;
}

function mapsEncode(value) {
  return encodeURIComponent(value);
}

function buildGoogleMapsUrl(storeAddress, stopAddresses, includeReturnToStore) {
  const orderedStops = includeReturnToStore ? [...stopAddresses, storeAddress] : stopAddresses;
  const destination = orderedStops[orderedStops.length - 1] || storeAddress;
  const waypoints = orderedStops.slice(0, -1);
  const params = [
    ["api", "1"],
    ["origin", storeAddress],
    ["destination", destination],
    ["travelmode", "driving"]
  ];

  if (waypoints.length) {
    params.push(["waypoints", waypoints.join("|")]);
  }

  return `https://www.google.com/maps/dir/?${params.map(([key, value]) => `${mapsEncode(key)}=${mapsEncode(value)}`).join("&")}`;
}

function buildAppleMapsUrl(storeAddress, stopAddresses, includeReturnToStore) {
  const orderedStops = includeReturnToStore ? [...stopAddresses, storeAddress] : stopAddresses;
  const destination = orderedStops.join(" to ") || storeAddress;
  return `https://maps.apple.com/?saddr=${mapsEncode(storeAddress)}&daddr=${mapsEncode(destination)}&dirflg=d`;
}

function buildMapsRoute() {
  const storeAddress = getStoreAddress();
  const stopAddresses = getStopAddresses();
  const includeReturnToStore = fields.includeReturnToStore.checked;
  const mapsProvider = shouldUseAppleMaps() ? "apple" : "google";
  const mapsUrl = mapsProvider === "apple"
    ? buildAppleMapsUrl(storeAddress, stopAddresses, includeReturnToStore)
    : buildGoogleMapsUrl(storeAddress, stopAddresses, includeReturnToStore);

  return {
    storeAddress,
    stopAddresses,
    includeReturnToStore,
    mapsProvider,
    mapsUrl
  };
}

function getDetectedValues() {
  return {
    payout: optionalNumber(detectedInputs.payout),
    sparkMiles: optionalNumber(detectedInputs.sparkMiles),
    sparkMinutes: optionalNumber(detectedInputs.sparkMinutes),
    stops: optionalNumber(detectedInputs.stops),
    storeAddress: getStoreAddress(),
    stopAddresses: getStopAddresses()
  };
}

function getCorrectedValues() {
  return {
    payout: optionalNumber(fields.payout),
    miles: optionalNumber(fields.sparkMiles),
    stops: optionalNumber(fields.stops),
    driveTime: optionalNumber(fields.driveTime),
    returnTime: optionalNumber(fields.returnTime),
    storeAddress: getStoreAddress(),
    stopAddresses: getStopAddresses()
  };
}

function emptyRouteRecord() {
  return {
    driveTimeMinutes: null,
    returnTimeMinutes: null,
    totalGoogleDriveMinutes: null,
    totalDistanceMiles: null,
    legs: []
  };
}

function routeRecord(route = lastRouteEstimate) {
  if (!route) return emptyRouteRecord();
  return {
    driveTimeMinutes: route.driveTimeMinutes ?? null,
    returnTimeMinutes: route.returnTimeMinutes ?? null,
    totalGoogleDriveMinutes: route.totalGoogleDriveMinutes ?? null,
    totalDistanceMiles: route.totalDistanceMiles ?? null,
    legs: Array.isArray(route.legs) ? route.legs : []
  };
}

function calculationRecord(result = lastCalculatedResult) {
  if (!result) {
    return {
      hourlyAfterGas: null,
      payAfterGas: null,
      fuelCost: null,
      totalTripTime: null,
      verdict: ""
    };
  }

  return {
    hourlyAfterGas: result.hourlyAfterGas,
    payAfterGas: result.payAfterGas,
    fuelCost: result.fuelCost,
    totalTripTime: result.totalTimeMinutes,
    verdict: result.verdict
  };
}

function createDebugRecord(eventType, extra = {}) {
  return {
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    eventType,
    rawOcrText: lastDetectedOffer?.rawText || ocrText.textContent || "",
    detectedValues: getDetectedValues(),
    correctedValues: getCorrectedValues(),
    routeEstimate: routeRecord(),
    calculationResult: calculationRecord(),
    ...extra
  };
}

function saveDebugRecord(eventType, extra = {}) {
  const records = readDebugRecords();
  records.push(createDebugRecord(eventType, extra));
  writeDebugRecords(records);
  renderAnalytics();
}

function fieldGroup(fieldName) {
  if (fieldName === "payout") return "payout";
  if (fieldName === "sparkMiles") return "miles";
  if (fieldName === "stops") return "stops";
  if (fieldName === "sparkMinutes" || fieldName === "driveTime") return "minutes";
  if (fieldName === "pickupText" || fieldName === "dropoffText") return "addresses";
  return "other";
}

function summarizeCorrections() {
  const records = readDebugRecords();
  const correctionRecords = records.filter((record) => record.eventType === "correction");
  const routeRequestCount = records.filter((record) => record.eventType === "opened_maps_route").length;
  const screenshotCount = records
    .filter((record) => record.eventType === "screenshot_analysis")
    .reduce((sum, record) => sum + (Number(record.screenshotCount) || 1), 0);
  const counts = {
    payout: 0,
    miles: 0,
    stops: 0,
    minutes: 0,
    addresses: 0
  };
  const fieldCounts = {};

  correctionRecords.forEach((record) => {
    const fieldName = record.correction?.fieldName || "";
    const group = fieldGroup(fieldName);
    if (counts[group] !== undefined) counts[group] += 1;
    if (fieldName) fieldCounts[fieldName] = (fieldCounts[fieldName] || 0) + 1;
  });

  const mostCorrected = Object.entries(fieldCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    screenshotsAnalyzed: screenshotCount,
    routeRequests: routeRequestCount,
    totalCorrections: correctionRecords.length,
    correctionRate: screenshotCount ? correctionRecords.length / screenshotCount : 0,
    mostCorrectedField: mostCorrected ? `${mostCorrected[0]} (${mostCorrected[1]})` : "None",
    counts
  };
}

function renderAnalytics() {
  const summary = summarizeCorrections();
  document.querySelector("#analyticsScreenshots").textContent = summary.screenshotsAnalyzed;
  document.querySelector("#analyticsRouteRequests").textContent = summary.routeRequests;
  document.querySelector("#analyticsCorrections").textContent = summary.totalCorrections;
  document.querySelector("#analyticsRate").textContent = percent(summary.correctionRate);
  document.querySelector("#analyticsMostField").textContent = summary.mostCorrectedField;
  document.querySelector("#analyticsPayout").textContent = summary.counts.payout;
  document.querySelector("#analyticsMiles").textContent = summary.counts.miles;
  document.querySelector("#analyticsStops").textContent = summary.counts.stops;
  document.querySelector("#analyticsMinutes").textContent = summary.counts.minutes;
  document.querySelector("#analyticsAddresses").textContent = summary.counts.addresses;
  renderDebugSnapshots();
}

function findLastRecord(eventType) {
  const records = readDebugRecords();
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].eventType === eventType) return records[index];
  }
  return null;
}

function setDebugJson(selector, value) {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = value ? JSON.stringify(value, null, 2) : "None yet.";
}

function renderDebugSnapshots() {
  const lastScreenshot = findLastRecord("screenshot_analysis");
  const lastRouteResponse = findLastRecord("opened_maps_route") || findLastRecord("route_estimate_response");
  const lastCalculation = findLastRecord("calculation");

  const lastOcr = document.querySelector("#debugLastOcr");
  if (lastOcr) lastOcr.textContent = lastScreenshot?.rawOcrText || "None yet.";
  setDebugJson("#debugLastDetected", lastScreenshot?.detectedValues || null);
  setDebugJson("#debugLastRoute", lastRouteResponse?.mapsUrl ? {
    mapsProvider: lastRouteResponse.mapsProvider,
    storeAddress: lastRouteResponse.storeAddress,
    stopAddresses: lastRouteResponse.stopAddresses,
    includeReturnToStore: lastRouteResponse.includeReturnToStore,
    mapsUrl: lastRouteResponse.mapsUrl
  } : lastRouteResponse?.routeError ? {
    error: lastRouteResponse.routeError,
    routeEstimate: lastRouteResponse.routeEstimate
  } : lastRouteResponse?.routeEstimate || null);
  setDebugJson("#debugLastCalculation", lastCalculation?.calculationResult || null);
}

function recordCorrection(fieldName, originalValue, correctedValue) {
  if (!lastDetectedOffer) return;

  const original = normalizeCorrectionValue(originalValue);
  const corrected = normalizeCorrectionValue(correctedValue);
  if (original === corrected) return;

  saveDebugRecord("correction", {
    correction: {
      fieldName,
      originalOcrValue: original,
      correctedUserValue: corrected
    }
  });
}

function getVerdict(hourly, minAcceptableHourly, goodHourly) {
  if (hourly < minAcceptableHourly) return "Bad";
  if (hourly < goodHourly) return "Average";
  if (hourly < 30) return "Good";
  return "Great";
}

function setWarnings(messages) {
  warningList.innerHTML = "";
  messages.forEach((message) => {
    const item = document.createElement("p");
    item.textContent = message;
    warningList.appendChild(item);
  });
}

function getManualRouteEstimate() {
  return window.SparkRouteService.estimateManualRoute({
    googleDriveTime: hasValue(fields.driveTime) ? fields.driveTime.value : null,
    googleReturnTime: hasValue(fields.returnTime) ? fields.returnTime.value : null,
    routeMiles: fields.sparkMiles.value,
    returnMiles: fields.returnMiles.value
  });
}

function getFuelMiles(manualMiles, manualReturnMiles) {
  if (lastRouteEstimate?.source === "google" && Number(lastRouteEstimate.totalDistanceMiles) > 0) {
    return Number(lastRouteEstimate.totalDistanceMiles);
  }
  return manualMiles + manualReturnMiles;
}

function calculate(options = {}) {
  const payoutMissing = !hasValue(fields.payout);
  const milesMissing = !hasValue(fields.sparkMiles);
  const stopsMissing = !hasValue(fields.stops);
  const driveTimeMissing = !hasValue(fields.driveTime);
  const returnTimeMissing = !hasValue(fields.returnTime);

  const payout = numberValue(fields.payout);
  const miles = numberValue(fields.sparkMiles);
  const returnMiles = numberValue(fields.returnMiles);
  const stops = Math.max(0, numberValue(fields.stops));
  const mpg = Math.max(1, numberValue(fields.mpg, 24));
  const gasPrice = numberValue(fields.gasPrice, 3.5);
  const minutesPerStop = Math.max(0, numberValue(fields.unloadMinutes, 3));
  const minAcceptableHourly = numberValue(fields.minAcceptableHourly, 15);
  const goodHourly = numberValue(fields.minimumGoodHourly, 20);
  const manualRoute = getManualRouteEstimate();

  const route = lastRouteEstimate?.source === "google" ? lastRouteEstimate : manualRoute;
  const driveTimeMinutes = route.driveTimeMinutes || 0;
  const returnTimeMinutes = route.returnTimeMinutes || 0;
  const stopTime = stops * minutesPerStop;
  const totalTimeMinutes = driveTimeMinutes + returnTimeMinutes + stopTime;
  const totalHours = totalTimeMinutes / 60;
  const totalDistanceMiles = getFuelMiles(miles, returnMiles);
  const fuelCost = (totalDistanceMiles / mpg) * gasPrice;
  const payAfterGas = payout - fuelCost;
  const hourlyAfterGas = totalHours > 0 ? payAfterGas / totalHours : 0;
  const payPerMile = totalDistanceMiles > 0 ? payAfterGas / totalDistanceMiles : 0;
  const verdict = getVerdict(hourlyAfterGas, minAcceptableHourly, goodHourly);
  const warnings = [];

  if (payoutMissing) warnings.push("Missing payout. Enter the offer payout or rerun screenshot analysis.");
  if (milesMissing) warnings.push("Miles are missing. Enter offer miles or rerun screenshot analysis.");
  if (stopsMissing) warnings.push("Missing stops. Enter the number of stops or rerun screenshot analysis.");
  if (driveTimeMissing) warnings.push("Maps drive time is missing. Open Maps, then enter the route time.");
  if (returnTimeMissing && numberValue(fields.returnTime) !== 0) warnings.push("Return time is missing.");
  if (totalTimeMinutes > 0 && totalTimeMinutes < 10) warnings.push("Total time is under 10 minutes. Check Maps drive time and stop time.");
  if (hourlyAfterGas > 60) warnings.push("This result may be wrong. Check drive time, return time, and OCR values.");
  if (payout < 10 && hourlyAfterGas > 40) warnings.push("Low payout with high hourly detected. Check drive time, return time, and OCR values.");
  if (lastRouteEstimate?.warnings?.length) warnings.push(...lastRouteEstimate.warnings);

  lastCalculatedResult = {
    verdict,
    payout,
    miles,
    returnMiles,
    stops,
    driveTimeMinutes,
    returnTimeMinutes,
    stopTime,
    totalTimeMinutes,
    totalHours,
    totalDistanceMiles,
    fuelCost,
    payAfterGas,
    hourlyAfterGas,
    payPerMile,
    route,
    warnings
  };

  resultCard.className = `result-card verdict-${verdict.toLowerCase()}`;
  document.querySelector("#verdictLabel").textContent = `${verdict} Offer`;
  document.querySelector("#hourlyAfterGas").textContent = `${money(hourlyAfterGas)}/hr`;
  document.querySelector("#routeSource").textContent = route.source === "google" ? "Future API route" : "Manual Maps";
  document.querySelector("#driveTimeResult").textContent = formatMinutes(driveTimeMinutes);
  document.querySelector("#returnTimeResult").textContent = formatMinutes(returnTimeMinutes);
  document.querySelector("#fuelCost").textContent = money(fuelCost);
  document.querySelector("#payAfterGas").textContent = money(payAfterGas);
  document.querySelector("#payPerMile").textContent = `${money(payPerMile)}/mi`;
  document.querySelector("#stopTimeResult").textContent = formatMinutes(stopTime);

  if (fields.mainTimeDisplay.value === "drive") {
    document.querySelector("#mainTimeLabel").textContent = "Maps Drive Time Only";
    document.querySelector("#mainTimeValue").textContent = formatMinutes(driveTimeMinutes);
  } else {
    document.querySelector("#mainTimeLabel").textContent = "Estimated Trip Time";
    document.querySelector("#mainTimeValue").textContent = formatMinutes(totalTimeMinutes);
  }

  setWarnings(warnings);
  if (options.record) saveDebugRecord("calculation");
  return lastCalculatedResult;
}

function showPreviews(files) {
  previewList.innerHTML = "";
  Array.from(files).forEach((file) => {
    const image = document.createElement("img");
    image.alt = file.name;
    image.src = URL.createObjectURL(file);
    image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
    previewList.appendChild(image);
  });
}

function storeLineFromRawText(result) {
  const lines = String(result.rawText || "").split(/\n+/).map((line) => line.trim());
  return lines.find((line) => /\b(walmart|store|pickup|#\d{2,})\b/i.test(line)) || "";
}

function detectedValuesFromResult(result) {
  const storeLine = storeLineFromRawText(result);
  const pickupText = [storeLine, result.pickupAddress].filter(Boolean).join("\n");
  return {
    payout: result.payout ?? "",
    sparkMiles: result.sparkMiles ?? "",
    sparkMinutes: result.sparkMinutes ?? "",
    stops: result.stops ?? "",
    pickupText,
    dropoffText: result.dropoffAddresses?.length ? result.dropoffAddresses.join("\n") : ""
  };
}

function getDetectedInputValues() {
  return {
    payout: optionalNumber(detectedInputs.payout),
    sparkMiles: optionalNumber(detectedInputs.sparkMiles),
    sparkMinutes: optionalNumber(detectedInputs.sparkMinutes),
    stops: optionalNumber(detectedInputs.stops),
    pickupText: detectedInputs.pickupText.value.trim(),
    dropoffText: detectedInputs.dropoffText.value.trim()
  };
}

function setDetectedInputValues(values) {
  Object.entries(detectedInputs).forEach(([fieldName, input]) => {
    const value = values[fieldName] ?? "";
    input.value = value;
    input.dataset.originalValue = normalizeCorrectionValue(value);
  });
}

function renderDetectedOffer(result) {
  lastDetectedOffer = result;
  detectedCard.classList.remove("is-hidden");
  setDetectedInputValues(detectedValuesFromResult(result));

  document.querySelector("#detectedConfidence").textContent = [
    `Payout ${percent(result.confidence.payout)}`,
    `Miles ${percent(result.confidence.sparkMiles)}`,
    `Spark minutes ${percent(result.confidence.sparkMinutes)}`,
    `Stops ${percent(result.confidence.stops)}`,
    `Addresses ${percent(result.confidence.addresses)}`
  ].join(" | ");

  updateLocationTextFromDetected();
}

function updateLocationTextFromDetected() {
  const detected = getDetectedInputValues();
  const addressText = [
    detected.pickupText,
    detected.dropoffText,
    ...(lastDetectedOffer?.cityText || [])
  ].filter(Boolean).join("\n");
  locationText.textContent = addressText || "No city, location, or address text detected yet.";
}

function useDetectedValues() {
  if (!lastDetectedOffer) return;
  const detected = getDetectedInputValues();

  if (detected.payout !== null) fields.payout.value = detected.payout;
  if (detected.sparkMiles !== null) {
    fields.sparkMiles.value = detected.sparkMiles;
    if (!hasValue(fields.returnMiles)) fields.returnMiles.value = detected.sparkMiles;
  }
  if (detected.stops !== null) fields.stops.value = detected.stops;

  if (!hasValue(fields.preferredWalmart) && detected.pickupText) {
    const storeLine = detected.pickupText.split(/\n+/).find((line) => /walmart/i.test(line));
    if (storeLine) fields.preferredWalmart.value = storeLine.trim();
  }

  if (!hasValue(fields.routeStoreAddress) && detected.pickupText) {
    fields.routeStoreAddress.value = detected.pickupText;
  }

  if (!hasValue(fields.routeStopAddresses) && detected.dropoffText) {
    fields.routeStopAddresses.value = detected.dropoffText;
  }

  updateLocationTextFromDetected();
  saveSettings();
  calculate();
}

async function analyzeScreenshots() {
  const files = Array.from(screenshotInput.files || []);
  if (!files.length) {
    ocrStatus.textContent = "No screenshots";
    ocrText.textContent = "Choose one or more screenshots first.";
    return;
  }

  if (!window.SparkAIParser) {
    ocrStatus.textContent = "Parser unavailable";
    ocrText.textContent = "Parser script did not load. You can still edit every field manually.";
    return;
  }

  analyzeButton.disabled = true;
  parserMessage.textContent = "";
  ocrStatus.textContent = "Analyzing";
  ocrText.textContent = "OCR is running. You can still edit every field manually.";

  try {
    const result = await window.SparkAIParser.parseScreenshotsWithOCR(files);
    ocrText.textContent = result.rawText || "OCR finished but did not find readable text.";
    renderDetectedOffer(result);
    useDetectedValues();
    saveDebugRecord("screenshot_analysis", { screenshotCount: files.length });
    ocrStatus.textContent = "OCR complete";
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    ocrStatus.textContent = "OCR failed";
    ocrText.textContent = `OCR failed. You can still edit every field manually.\n\n${error.message || error}`;
  } finally {
    analyzeButton.disabled = false;
  }
}

function getReturnLeg(route) {
  if (!route?.legs?.length) return null;
  return route.legs[route.legs.length - 1];
}

function applyRouteEstimate(route) {
  lastRouteEstimate = route;
  fields.driveTime.value = Math.round(route.driveTimeMinutes || 0);
  fields.returnTime.value = Math.round(route.returnTimeMinutes || 0);

  const returnLeg = getReturnLeg(route);
  const returnMiles = returnLeg ? Number(returnLeg.distanceMiles) || 0 : 0;
  if (returnMiles > 0) {
    fields.returnMiles.value = returnMiles.toFixed(1);
  }

  if (Number(route.totalDistanceMiles) > 0) {
    const routeMiles = Math.max(0, Number(route.totalDistanceMiles) - (returnMiles || numberValue(fields.returnMiles)));
    fields.sparkMiles.value = routeMiles.toFixed(1);
  }

  calculate();
}

function openRouteInMaps() {
  const route = buildMapsRoute();
  if (!route.storeAddress || !route.stopAddresses.length) {
    routeMessage.textContent = "Store or stop addresses are missing. Check the route address fields.";
    return;
  }

  saveDebugRecord("opened_maps_route", {
    storeAddress: route.storeAddress,
    stopAddresses: route.stopAddresses,
    includeReturnToStore: route.includeReturnToStore,
    mapsProvider: route.mapsProvider,
    mapsUrl: route.mapsUrl
  });

  routeMessage.textContent = "Enter the Maps time and distance below to calculate hourly after gas.";
  window.open(route.mapsUrl, "_blank", "noopener,noreferrer");
}

async function getGoogleRouteTime() {
  // TODO: Future version: replace manual map opening with backend route estimate API.
  // This function is intentionally kept for the future Cloudflare Worker / Google Routes path.
  const backendApiUrl = fields.backendApiUrl.value.trim();
  if (!backendApiUrl) {
    routeMessage.textContent = "Backend API URL not set. Enter it in Settings or use manual times.";
    return;
  }

  const storeAddress = getStoreAddress();
  const stopAddresses = getStopAddresses();
  if (!storeAddress || !stopAddresses.length) {
    routeMessage.textContent = "Store or stop addresses are missing. Check detected pickup and dropoff text.";
    return;
  }

  getRouteButton.disabled = true;
  routeMessage.textContent = "Getting Google route estimate...";

  const requestBody = {
    storeAddress,
    stopAddresses,
    returnToStore: true
  };

  saveDebugRecord("route_estimate_request", {
    routeRequest: requestBody
  });

  try {
    const route = await window.SparkRouteService.requestGoogleRouteEstimate(backendApiUrl, requestBody);
    applyRouteEstimate(route);
    saveDebugRecord("route_estimate_response");
    routeMessage.textContent = "Google route estimate added.";
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    routeMessage.textContent = "Google route estimate failed. Manual times are still available.";
    saveDebugRecord("route_estimate_response", {
      routeError: error.message || String(error)
    });
  } finally {
    getRouteButton.disabled = false;
  }
}

function useManualTimes() {
  lastRouteEstimate = null;
  routeMessage.textContent = "Manual route times are active.";
  calculate({ record: true });
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearScreenshots() {
  screenshotInput.value = "";
  previewList.innerHTML = "";
  detectedCard.classList.add("is-hidden");
  lastDetectedOffer = null;
  Object.values(detectedInputs).forEach((input) => {
    input.value = "";
    input.dataset.originalValue = "";
  });
  ocrStatus.textContent = "Ready";
  parserMessage.textContent = "";
  ocrText.textContent = "No OCR text yet.";
  locationText.textContent = "No city, location, or address text detected yet.";
}

function exportDebugJson() {
  const records = readDebugRecords();
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `spark-helper-debug-${todayStamp()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clearDebugData() {
  writeDebugRecords([]);
  renderAnalytics();
  routeMessage.textContent = "Local debug data cleared.";
}

function clearFields() {
  [
    fields.payout,
    fields.sparkMiles,
    fields.returnMiles,
    fields.stops,
    fields.driveTime,
    fields.returnTime
  ].forEach((field) => {
    field.value = "";
  });
  lastRouteEstimate = null;
  calculate();
}

screenshotInput.addEventListener("change", () => {
  showPreviews(screenshotInput.files || []);
  ocrStatus.textContent = screenshotInput.files.length ? "Ready to analyze" : "Ready";
});

analyzeButton.addEventListener("click", analyzeScreenshots);
clearScreenshotsButton.addEventListener("click", clearScreenshots);
getRouteButton.addEventListener("click", getGoogleRouteTime);
openMapsButton.addEventListener("click", openRouteInMaps);
useManualTimesButton.addEventListener("click", useManualTimes);
useDetectedButton.addEventListener("click", useDetectedValues);
calculateDetectedButton.addEventListener("click", () => {
  useDetectedValues();
  calculate({ record: true });
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
});
exportDebugButton.addEventListener("click", exportDebugJson);
clearDebugButton.addEventListener("click", clearDebugData);

Object.entries(detectedInputs).forEach(([fieldName, input]) => {
  input.addEventListener("input", () => {
    useDetectedValues();
  });

  input.addEventListener("change", () => {
    recordCorrection(fieldName, input.dataset.originalValue, input.value);
    input.dataset.originalValue = normalizeCorrectionValue(input.value);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate({ record: true });
  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
});

Object.entries(fields).forEach(([fieldName, field]) => {
  field.addEventListener("input", () => {
    if (["preferredWalmart", "backendApiUrl", "unloadMinutes", "gasPrice", "mpg", "minAcceptableHourly", "minimumGoodHourly", "mainTimeDisplay"].includes(fieldName)) {
      saveSettings();
    }
    if (["sparkMiles", "returnMiles", "driveTime", "returnTime", "routeStoreAddress", "routeStopAddresses"].includes(fieldName)) {
      lastRouteEstimate = null;
    }
    calculate();
  });

  field.addEventListener("change", () => {
    const detectedFieldName = fieldName === "driveTime" ? "sparkMinutes" : fieldName;
    const detectedInput = detectedInputs[detectedFieldName];
    if (!detectedInput) return;
    recordCorrection(detectedFieldName, detectedInput.dataset.originalValue, field.value);
    detectedInput.dataset.originalValue = normalizeCorrectionValue(field.value);
  });
});

fields.includeReturnToStore.addEventListener("change", () => {
  lastRouteEstimate = null;
});

document.querySelector("#matchReturnButton").addEventListener("click", () => {
  fields.returnMiles.value = fields.sparkMiles.value || 0;
  lastRouteEstimate = null;
  calculate();
});

document.querySelector("#addStopButton").addEventListener("click", () => {
  fields.stops.value = Math.max(0, numberValue(fields.stops)) + 1;
  calculate();
});

document.querySelector("#removeStopButton").addEventListener("click", () => {
  fields.stops.value = Math.max(0, numberValue(fields.stops) - 1);
  calculate();
});

document.querySelector("#clearButton").addEventListener("click", clearFields);

document.querySelector("#themeResetButton").addEventListener("click", () => {
  clearFields();
  clearScreenshots();
});

loadSettings();
renderAnalytics();
calculate();
