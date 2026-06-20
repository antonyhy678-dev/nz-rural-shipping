import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    mutation {
      deliveryCustomizationCreate(deliveryCustomization: {
        functionId: "019ee277-62d9-748a-8b2d-da51dd23868b",
        title: "NZ Rural Rate Filter",
        enabled: true
      }) {
        deliveryCustomization {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `);

  const data = await response.json();
  const errors = data?.data?.deliveryCustomizationCreate?.userErrors;

  if (errors?.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
};

export default function Index() {
  const fetcher = useFetcher();
  const isActivated = fetcher.data?.success;
  const errors = fetcher.data?.errors;

  return (
    <s-page heading="NZ Rural Shipping">
      <s-section heading="Activate Rural Rate Filter">
        <s-paragraph>
          This app automatically shows the correct NZ Post rate at checkout based on the customer's postcode. Rural customers see Rural Delivery (RD), metro customers see the standard rate.
        </s-paragraph>
        {isActivated && (
          <s-banner tone="success">Rural rate filter is now active on your store!</s-banner>
        )}
        {errors?.length > 0 && (
          <s-banner tone="critical">{errors.map(e => e.message).join(", ")}</s-banner>
        )}
        <fetcher.Form method="post">
          <button type="submit" disabled={fetcher.state === "submitting"}>
            {fetcher.state === "submitting" ? "Activating..." : "Activate Rural Rate Filter"}
          </button>
        </fetcher.Form>
      </s-section>
    </s-page>
  );
}
