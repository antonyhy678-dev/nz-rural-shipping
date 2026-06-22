import { useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import styles from "../styles/rural-settings.module.css";

const FUNCTION_HANDLE = "rural-rate-filter";
const CUSTOMIZATION_TITLE = "NZ Rural Rate Filter";
const METAFIELD_NAMESPACE = "$app:rural-rate-filter";
const METAFIELD_KEY = "function-configuration";
const DEFAULT_RURAL_KEYWORDS = ["rural delivery", "rural shipping"];
const DEFAULT_METRO_KEYWORDS = ["metro area", "not rural"];

function parsePostcodes(value) {
  const tokens = String(value ?? "")
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];

  for (const token of tokens) {
    const postcode = token.padStart(4, "0");
    if (/^\d{4}$/.test(postcode)) valid.push(postcode);
    else invalid.push(token);
  }

  return {
    postcodes: [...new Set(valid)].sort(),
    invalid: [...new Set(invalid)],
    duplicates: valid.length - new Set(valid).size,
  };
}

async function getCustomization(admin) {
  const response = await admin.graphql(`
    #graphql
    query RuralRateFilterConfiguration {
      deliveryCustomizations(first: 50) {
        nodes {
          id
          title
          enabled
          metafield(namespace: "${METAFIELD_NAMESPACE}", key: "${METAFIELD_KEY}") {
            id
            jsonValue
          }
        }
      }
    }
  `);
  const result = await response.json();
  return result?.data?.deliveryCustomizations?.nodes?.find(
    (item) => item.title === CUSTOMIZATION_TITLE,
  );
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const customization = await getCustomization(admin);
  const configuration = customization?.metafield?.jsonValue ?? {};

  return {
    active: Boolean(customization?.enabled),
    configured: Array.isArray(configuration.ruralPostcodes),
    postcodes: configuration.ruralPostcodes ?? [],
    ruralKeywords: configuration.ruralRateKeywords ?? DEFAULT_RURAL_KEYWORDS,
    metroKeywords: configuration.metroRateKeywords ?? DEFAULT_METRO_KEYWORDS,
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const parsed = parsePostcodes(formData.get("postcodes"));

  if (parsed.invalid.length) {
    return {
      success: false,
      errors: [`Remove invalid entries: ${parsed.invalid.join(", ")}`],
    };
  }

  const enabled = formData.get("enabled") === "true";
  if (enabled && parsed.postcodes.length === 0) {
    return {
      success: false,
      errors: ["Add at least one rural postcode before enabling the filter."],
    };
  }

  const configuration = {
    enabled,
    ruralPostcodes: parsed.postcodes,
    ruralRateKeywords: DEFAULT_RURAL_KEYWORDS,
    metroRateKeywords: DEFAULT_METRO_KEYWORDS,
    updatedAt: new Date().toISOString(),
  };
  const existing = await getCustomization(admin);
  const metafield = {
    namespace: METAFIELD_NAMESPACE,
    key: METAFIELD_KEY,
    type: "json",
    value: JSON.stringify(configuration),
    ...(existing?.metafield?.id ? { id: existing.metafield.id } : {}),
  };

  const mutation = existing
    ? `#graphql
      mutation UpdateRuralRateFilter($id: ID!, $input: DeliveryCustomizationInput!) {
        deliveryCustomizationUpdate(id: $id, deliveryCustomization: $input) {
          deliveryCustomization { id enabled }
          userErrors { field message }
        }
      }`
    : `#graphql
      mutation CreateRuralRateFilter($input: DeliveryCustomizationInput!) {
        deliveryCustomizationCreate(deliveryCustomization: $input) {
          deliveryCustomization { id enabled }
          userErrors { field message }
        }
      }`;
  const variables = {
    ...(existing ? { id: existing.id } : {}),
    input: {
      functionHandle: FUNCTION_HANDLE,
      title: CUSTOMIZATION_TITLE,
      enabled: configuration.enabled,
      metafields: [metafield],
    },
  };
  const response = await admin.graphql(mutation, { variables });
  const result = await response.json();
  const payload = existing
    ? result?.data?.deliveryCustomizationUpdate
    : result?.data?.deliveryCustomizationCreate;
  const errors = payload?.userErrors ?? [];

  if (errors.length) {
    return { success: false, errors: errors.map((error) => error.message) };
  }

  return {
    success: true,
    active: configuration.enabled,
    count: parsed.postcodes.length,
    duplicatesRemoved: parsed.duplicates,
  };
};

export default function Index() {
  const data = useLoaderData();
  const fetcher = useFetcher();
  const fileInput = useRef(null);
  const [enabled, setEnabled] = useState(data.active);
  const [postcodeText, setPostcodeText] = useState(data.postcodes.join(", "));
  const [testPostcode, setTestPostcode] = useState("");
  const parsed = useMemo(() => parsePostcodes(postcodeText), [postcodeText]);
  const configured = fetcher.data?.success ? true : data.configured;
  const normalisedTest = testPostcode.trim().padStart(4, "0");
  const testIsValid = /^\d{4}$/.test(normalisedTest);
  const testIsRural =
    configured && testIsValid && parsed.postcodes.includes(normalisedTest);
  const isSaving = fetcher.state !== "idle";
  const savedActive = fetcher.data?.success ? fetcher.data.active : data.active;

  const importFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPostcodeText(String(reader.result ?? ""));
    reader.readAsText(file);
    event.target.value = "";
  };

  const tidyPostcodes = () => setPostcodeText(parsed.postcodes.join(", "));

  return (
    <s-page heading="NZ Rural Shipping">
      <div className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrow}>Checkout delivery control</p>
          <h2>Rural postcode workspace</h2>
          <p>
            Keep rural and metro rates accurate using a postcode list managed by
            your store.
          </p>
        </div>
        <div className={styles.status} data-active={savedActive}>
          <span className={styles.statusDot} />
          {savedActive ? "Active at checkout" : "Not active"}
        </div>
      </div>

      {!configured && (
        <div className={styles.migrationNotice}>
          <strong>Add your store&apos;s postcode list</strong>
          <span>
            Checkout is still using the temporary legacy list. Import or paste
            your own list and save to replace it.
          </span>
        </div>
      )}

      <fetcher.Form method="post" className={styles.workspace}>
        <input type="hidden" name="postcodes" value={parsed.postcodes.join(",")} />
        <input type="hidden" name="enabled" value={String(enabled)} />

        <main className={styles.editor}>
          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <h3>Rural postcodes</h3>
                <p>Paste four-digit postcodes separated by commas or new lines.</p>
              </div>
              <div className={styles.toolbar}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => fileInput.current?.click()}
                >
                  Import CSV
                </button>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={tidyPostcodes}
                  disabled={!postcodeText.trim()}
                >
                  Clean list
                </button>
                <input
                  ref={fileInput}
                  className={styles.fileInput}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={importFile}
                />
              </div>
            </div>

            <textarea
              className={styles.postcodeEditor}
              value={postcodeText}
              onChange={(event) => setPostcodeText(event.target.value)}
              placeholder="0174, 0175, 0792, 0793"
              aria-label="Rural postcodes"
              spellCheck="false"
            />

            <div className={styles.validationRow}>
              <span><strong>{parsed.postcodes.length}</strong> unique postcodes</span>
              <span>{parsed.duplicates} duplicates</span>
              <span className={parsed.invalid.length ? styles.invalid : ""}>
                {parsed.invalid.length} invalid
              </span>
            </div>

            {parsed.invalid.length > 0 && (
              <div className={styles.errorMessage}>
                Check these entries: {parsed.invalid.join(", ")}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <h3>Data sources</h3>
                <p>Use postcode data that your business is permitted to use.</p>
              </div>
            </div>
            <div className={styles.sourceLinks}>
              <a
                href="https://www.nzpost.co.nz/personal/sending-in-nz/postcodes"
                target="_blank"
                rel="noreferrer"
              >
                NZ Post postcode finder <span aria-hidden="true">↗</span>
              </a>
              <a
                href="https://www.nzpost.co.nz/business/sending-within-nz/quality-addressing/postcode-network-file"
                target="_blank"
                rel="noreferrer"
              >
                NZ Post data licensing <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className={styles.disclaimer}>
              Your store is responsible for permission to use uploaded postcode
              data. This app does not supply or verify third-party datasets.
            </p>
          </section>
        </main>

        <aside className={styles.sidebar}>
          <section className={styles.sideSection}>
            <div className={styles.toggleRow}>
              <div>
                <h3>Checkout filter</h3>
                <p>Apply this list to customer checkouts.</p>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  aria-label="Enable rural rate filter"
                />
                <span />
              </label>
            </div>
          </section>

          <section className={styles.sideSection}>
            <h3>Test a postcode</h3>
            <p>Preview how the current list will classify a checkout.</p>
            <input
              className={styles.testInput}
              value={testPostcode}
              onChange={(event) => setTestPostcode(event.target.value)}
              placeholder="e.g. 0174"
              inputMode="numeric"
              maxLength={4}
              aria-label="Postcode to test"
            />
            {testPostcode && !configured && (
              <div className={styles.testResult} data-result="invalid">
                <span className={styles.resultMark}>!</span>
                <div>
                  <strong>List not saved</strong>
                  <p>Add your postcode list first</p>
                </div>
              </div>
            )}
            {testPostcode && configured && (
              <div
                className={styles.testResult}
                data-result={testIsValid ? (testIsRural ? "rural" : "metro") : "invalid"}
              >
                <span className={styles.resultMark}>
                  {testIsValid ? (testIsRural ? "R" : "M") : "!"}
                </span>
                <div>
                  <strong>
                    {testIsValid
                      ? testIsRural
                        ? "Rural delivery"
                        : "Metro delivery"
                      : "Invalid postcode"}
                  </strong>
                  <p>{testIsValid ? normalisedTest : "Enter four digits"}</p>
                </div>
              </div>
            )}
          </section>

          <section className={styles.sideSection}>
            <h3>Rate matching</h3>
            <div className={styles.matchRule}>
              <span className={styles.ruralSwatch} />
              Titles containing “Rural Delivery”
            </div>
            <div className={styles.matchRule}>
              <span className={styles.metroSwatch} />
              Titles containing “Metro Area”
            </div>
          </section>

          {fetcher.data?.success && (
            <div className={styles.successMessage}>
              Saved {fetcher.data.count} postcodes. Checkout settings are up to date.
            </div>
          )}
          {fetcher.data?.errors?.length > 0 && (
            <div className={styles.errorMessage}>{fetcher.data.errors.join(", ")}</div>
          )}

          <button
            className={styles.primaryButton}
            type="submit"
            disabled={
              isSaving || parsed.invalid.length > 0 || (enabled && parsed.postcodes.length === 0)
            }
          >
            {isSaving ? "Saving…" : "Save checkout settings"}
          </button>
        </aside>
      </fetcher.Form>
    </s-page>
  );
}
