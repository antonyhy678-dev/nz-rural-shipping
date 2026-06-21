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

  for (const group of input?.cart?.deliveryGroups ?? []) {
    const postcode = String(group?.deliveryAddress?.zip ?? "")
      .trim()
      .padStart(4, "0");
    const isRural = RURAL_POSTCODES.has(postcode);

    for (const option of group?.deliveryOptions ?? []) {
      const shouldHide = isRural
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
