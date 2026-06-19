(function () {
  function emptyParseResult(rawText = "") {
    return {
      payout: null,
      sparkMiles: null,
      sparkMinutes: null,
      stops: null,
      pickupAddress: null,
      dropoffAddresses: [],
      cityText: [],
      itemCount: null,
      confidence: {
        payout: 0,
        sparkMiles: 0,
        sparkMinutes: 0,
        stops: 0,
        addresses: 0
      },
      rawText
    };
  }

  function normalizeText(text) {
    return String(text || "")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function linesFromText(text) {
    return normalizeText(text)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function firstNumber(patterns, text) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const value = Number.parseFloat(match[1].replace(/,/g, ""));
        if (Number.isFinite(value)) return value;
      }
    }
    return null;
  }

  function isStreetLine(line) {
    return /\d{1,6}\s+[A-Za-z0-9'. -]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|pl|place|pkwy|parkway|hwy|highway|way)\b/i.test(line);
  }

  function isCityStateLine(line) {
    return /^[A-Za-z'. -]+,\s?[A-Z]{2}(?:,?\s?\d{5}(?:-\d{4})?)?$/i.test(line);
  }

  function titleCaseCityLine(line) {
    return line.replace(/\b([A-Z]{3,})\b/g, (word) => {
      if (word.length === 2) return word;
      return word.charAt(0) + word.slice(1).toLowerCase();
    });
  }

  function extractAddresses(lines) {
    const addresses = [];
    const cityText = [];

    lines.forEach((line) => {
      if (isCityStateLine(line)) cityText.push(titleCaseCityLine(line));
    });

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!isStreetLine(line)) continue;

      const next = lines[index + 1] || "";
      if (isCityStateLine(next)) {
        addresses.push(`${line}, ${titleCaseCityLine(next)}`);
      } else {
        addresses.push(line);
      }
    }

    return {
      pickupAddress: addresses[0] || null,
      dropoffAddresses: addresses.slice(1),
      cityText,
      confidence: addresses.length ? Math.min(0.95, 0.55 + addresses.length * 0.2) : 0
    };
  }

  function parseRawOfferText(rawText) {
    const text = normalizeText(rawText);
    const lines = linesFromText(text);
    const addresses = extractAddresses(lines);

    const payout = firstNumber([
      /estimated\s+total[^$0-9]*\$?\s?([0-9]+(?:\.[0-9]{1,2})?)/i,
      /(?:pay|payout|earn|offer)[^$0-9]*\$?\s?([0-9]+(?:\.[0-9]{1,2})?)/i,
      /\$\s?([0-9]+(?:\.[0-9]{1,2})?)/
    ], text);

    const sparkMiles = firstNumber([
      /([0-9]+(?:\.[0-9]+)?)\s?mi(?:les)?\b/i,
      /miles?[^0-9]*([0-9]+(?:\.[0-9]+)?)/i
    ], text);

    const sparkMinutes = firstNumber([
      /([0-9]+)\s?min(?:s|utes)?\b/i,
      /time[^0-9]*([0-9]+)\s?min/i
    ], text);

    const stops = firstNumber([
      /([0-9]+)\s?stops?\b/i,
      /stops?[^0-9]*([0-9]+)/i
    ], text);

    const itemCount = firstNumber([
      /([0-9]+)\s?items?\b/i,
      /items?[^0-9]*([0-9]+)/i
    ], text);

    return {
      payout,
      sparkMiles,
      sparkMinutes,
      stops,
      pickupAddress: addresses.pickupAddress,
      dropoffAddresses: addresses.dropoffAddresses,
      cityText: addresses.cityText,
      itemCount,
      confidence: {
        payout: payout === null ? 0 : 0.86,
        sparkMiles: sparkMiles === null ? 0 : 0.84,
        sparkMinutes: sparkMinutes === null ? 0 : 0.82,
        stops: stops === null ? 0 : 0.84,
        addresses: addresses.confidence
      },
      rawText: text
    };
  }

  async function extractTextWithOCR(images) {
    if (!window.Tesseract) {
      throw new Error("Tesseract.js did not load.");
    }

    const chunks = [];
    for (const image of images) {
      const result = await window.Tesseract.recognize(image, "eng");
      chunks.push(result.data.text || "");
    }

    return normalizeText(chunks.join("\n\n--- next screenshot ---\n\n"));
  }

  async function parseScreenshotsWithOCR(images) {
    const rawText = await extractTextWithOCR(images);
    return parseRawOfferText(rawText);
  }

  window.SparkAIParser = {
    emptyParseResult,
    parseRawOfferText,
    parseScreenshotsWithOCR
  };
}());
