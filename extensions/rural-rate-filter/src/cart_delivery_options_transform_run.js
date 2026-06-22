// @ts-check

import { RURAL_POSTCODES } from "./rural-postcodes.js";

/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunInput} CartDeliveryOptionsTransformRunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

function normaliseTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRuralRate(title) {
  const normalised = normaliseTitle(title);
  return normalised.includes("rural delivery") && !normalised.includes("not rural");
}

function matchesKeywords(title, keywords) {
  const normalised = normaliseTitle(title);
  return keywords.some((keyword) => normalised.includes(normaliseTitle(keyword)));
}

function isMetroRate(title) {
  const normalised = normaliseTitle(title);
  return normalised.includes("metro area") || normalised.includes("not rural");
}

/**
 * @param {CartDeliveryOptionsTransformRunInput} input
 * @returns {CartDeliveryOptionsTransformRunResult}
 */
export function cartDeliveryOptionsTransformRun(input) {
  const operations = [];
  const configuration = input?.deliveryCustomization?.metafield?.jsonValue;

  if (configuration?.enabled === false) return { operations };

  const configuredPostcodes = Array.isArray(configuration?.ruralPostcodes)
    ? configuration.ruralPostcodes
    : null;
  const ruralPostcodes = configuredPostcodes
    ? new Set(configuredPostcodes.map((postcode) => String(postcode).padStart(4, "0")))
    : RURAL_POSTCODES;
  const ruralKeywords = Array.isArray(configuration?.ruralRateKeywords)
    ? configuration.ruralRateKeywords
    : ["rural delivery", "rural shipping"];
  const metroKeywords = Array.isArray(configuration?.metroRateKeywords)
    ? configuration.metroRateKeywords
    : ["metro area", "not rural"];

  for (const group of input?.cart?.deliveryGroups ?? []) {
    const postcode = String(group?.deliveryAddress?.zip ?? "")
      .trim()
      .padStart(4, "0");
    const isRural = ruralPostcodes.has(postcode);

    for (const option of group?.deliveryOptions ?? []) {
      const shouldHide = configuredPostcodes
        ? isRural
          ? matchesKeywords(option.title, metroKeywords)
          : matchesKeywords(option.title, ruralKeywords) &&
            !matchesKeywords(option.title, metroKeywords)
        : isRural
          ? isMetroRate(option.title)
          : isRuralRate(option.title);

      if (shouldHide) {
        operations.push({
          deliveryOptionHide: { deliveryOptionHandle: option.handle },
        });
      }
    }
  }

  return { operations };
}
