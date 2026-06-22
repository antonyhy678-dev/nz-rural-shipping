import { describe, expect, test } from "vitest";
import { cartDeliveryOptionsTransformRun } from "../src/cart_delivery_options_transform_run.js";

function input({ postcode, configuration }) {
  return {
    cart: {
      deliveryGroups: [
        {
          deliveryAddress: { zip: postcode },
          deliveryOptions: [
            { handle: "metro", title: "Metro Area Only - NOT rural delivery" },
            { handle: "rural", title: "Rural Delivery (RD)" },
          ],
        },
      ],
    },
    deliveryCustomization: {
      metafield: configuration ? { jsonValue: configuration } : null,
    },
  };
}

describe("merchant-managed rural postcode configuration", () => {
  test("uses the merchant list for rural checkouts", () => {
    const result = cartDeliveryOptionsTransformRun(
      input({
        postcode: "6011",
        configuration: {
          enabled: true,
          ruralPostcodes: ["6011"],
          ruralRateKeywords: ["Rural Delivery"],
          metroRateKeywords: ["Metro Area", "not rural"],
        },
      }),
    );

    expect(result.operations).toEqual([
      { deliveryOptionHide: { deliveryOptionHandle: "metro" } },
    ]);
  });

  test("shows metro rates when the postcode is not in the merchant list", () => {
    const result = cartDeliveryOptionsTransformRun(
      input({
        postcode: "6011",
        configuration: {
          enabled: true,
          ruralPostcodes: ["0174"],
          ruralRateKeywords: ["Rural Delivery"],
          metroRateKeywords: ["Metro Area", "not rural"],
        },
      }),
    );

    expect(result.operations).toEqual([
      { deliveryOptionHide: { deliveryOptionHandle: "rural" } },
    ]);
  });

  test("does nothing when the merchant disables the filter", () => {
    const result = cartDeliveryOptionsTransformRun(
      input({
        postcode: "0174",
        configuration: { enabled: false, ruralPostcodes: ["0174"] },
      }),
    );

    expect(result.operations).toEqual([]);
  });
});
