// @ts-check

/**
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunInput} CartDeliveryOptionsTransformRunInput
 * @typedef {import("../generated/api").CartDeliveryOptionsTransformRunResult} CartDeliveryOptionsTransformRunResult
 */

const RURAL_POSTCODES = new Set([
  101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,
  121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,
  301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,
  351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,
  401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,
  4010,4011,4012,4013,4014,4015,4016,4017,4018,4019,4020,
  4171,4172,4173,4174,4175,4176,4177,4178,4179,4180,
  4191,4192,4193,4194,4195,4196,4197,4198,4199,
  4371,4372,4373,4374,4375,4376,4377,4378,4379,4380,
  4391,4392,4393,4394,4395,4396,4397,4398,4399,
  4771,4772,4773,4774,4775,4776,4777,4778,4779,4780,
  4791,4792,4793,4794,4795,4796,4797,4798,4799,
  4871,4872,4873,4874,4875,4876,4877,4878,4879,4880,
  5371,5372,5373,5374,5375,5376,5377,5378,5379,5380,
  5391,5392,5393,5394,5395,5396,5397,5398,5399,
  5771,5772,5773,5774,5775,5776,5777,5778,5779,5780,
  7071,7072,7073,7074,7075,7076,7077,7078,7079,7080,
  7171,7172,7173,7174,7175,7176,7177,7178,7179,7180,
  7801,7802,7803,7804,7805,7806,7807,7808,7809,7810,
  7811,7812,7813,7814,7815,7816,7817,7818,7819,7820,
  7821,7822,7823,7824,7825,7826,7827,7828,7871,7872,
  7873,7874,7875,7876,7877,7878,7879,7880,7881,7882,
  7883,7884,7885,7886,7887,7888,7889,7890,7891,7892,
  7371,7372,7373,7374,7375,7376,7377,7378,7379,7380,
  7471,7472,7473,7474,7475,7476,7477,7478,7479,7480,
  7571,7572,7573,7574,7575,7576,7577,7578,7579,7580,
  7671,7672,7673,7674,7675,7676,7677,7678,7679,7680,
  7771,7772,7773,7774,7775,7776,7777,7778,7779,7780,
  9271,9272,9273,9274,9275,9276,9277,9278,9279,9280,
  9371,9372,9373,9374,9375,9376,9377,9378,9379,9380,
  9471,9472,9473,9474,9475,9476,9477,9478,9479,9480,
  9571,9572,9573,9574,9575,9576,9577,9578,9579,9580,
  9671,9672,9673,9674,9675,9676,9677,9678,9679,9680,
  9771,9772,9773,9774,9775,9776,9777,9778,9779,9780,
  9781,9782,9783,9784,9785,9786,9787,9788,9789,9790,
  9871,9872,9873,9874,9875,9876,9877,9878,9879,9880,
]);

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
    const postcode = parseInt(group?.deliveryAddress?.zip ?? "0", 10);
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
