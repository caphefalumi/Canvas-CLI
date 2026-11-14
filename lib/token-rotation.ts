import { readConfig, saveConfig } from "./config.js";

const DAY = 86_400_000;
let pending: Promise<void> | undefined;
const checked = new Set<string>();

interface Token {
  token?: string;
  visible_token?: string;
  expires_at: string | null;
  scopes: string[];
  workflow_state: string;
}

/** Check once per credential per process; concurrent requests share the check. */
export async function rotateTokenIfNeeded(): Promise<void> {
  if (pending) await pending;
  const config = readConfig();
  if (!config || config.autoRotateToken !== true) return;
  const key = `${config.domain}\n${config.token}`;
  if (checked.has(key)) return;
  checked.add(key);
  pending = (async () => {
    const request = async (endpoint: string, body?: object): Promise<Token> => {
      const response = await fetch(
        `https://${config.domain}/api/v1/users/self/${endpoint}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: "error",
        },
      );
      if (!response.ok)
        throw new Error(
          `Canvas token API returned HTTP ${response.status}. Check token-management permissions or run 'canvas config setup'.`,
        );
      return (await response.json()) as Token;
    };
    try {
      // Canvas personal token hints are the first five characters; no token listing needed.
      const current = await request(
        `tokens/${encodeURIComponent(config.token.slice(0, 5))}`,
      );
      if (
        current.workflow_state !== "active" ||
        !Array.isArray(current.scopes) ||
        !current.scopes.every((scope) => typeof scope === "string")
      ) {
        throw new Error(
          "Canvas returned invalid token metadata; no replacement was created.",
        );
      }
      if (current.expires_at === null) return;
      const expires = Date.parse(current.expires_at);
      if (!Number.isFinite(expires))
        throw new Error("Canvas returned an invalid token expiration.");
      if (expires <= Date.now())
        throw new Error(
          "Token has expired; run 'canvas config setup' with a new token.",
        );
      if (expires - Date.now() > 3 * DAY) return;
      const replacement = await request("tokens", {
        token: {
          purpose: "Canvas CLI automatic rotation",
          expires_at: new Date(Date.now() + 30 * DAY).toISOString(),
          scopes: current.scopes,
        },
      });
      // Current Canvas source serializes visible_token; published docs call it token.
      const newToken = replacement.token ?? replacement.visible_token;
      if (
        typeof newToken !== "string" ||
        !newToken ||
        newToken.endsWith("...") ||
        replacement.workflow_state !== "active" ||
        !replacement.expires_at ||
        Date.parse(replacement.expires_at) <= Date.now() + 3 * DAY ||
        !Number.isFinite(Date.parse(replacement.expires_at)) ||
        !Array.isArray(replacement.scopes) ||
        replacement.scopes.length !== current.scopes.length ||
        !current.scopes.every((scope) => replacement.scopes.includes(scope))
      ) {
        throw new Error(
          "Canvas returned an unusable replacement or changed its scopes; the original token is unchanged.",
        );
      }
      // Do not overwrite a concurrent config edit or revoked consent.
      const latest = readConfig();
      if (
        !latest ||
        latest.domain !== config.domain ||
        latest.token !== config.token ||
        latest.autoRotateToken !== true
      )
        return;
      if (!saveConfig(config.domain, newToken, latest.tableTruncate, true)) {
        throw new Error(
          "Could not save the replacement; the original token is still valid.",
        );
      }
      checked.add(`${config.domain}\n${newToken}`);
      console.error(
        `Canvas CLI: access token rotated; expires ${replacement.expires_at}. The previous token will expire naturally.`,
      );
    } catch (error) {
      // Rotation is optional: keep ordinary requests usable with the original credential.
      console.error(
        `Canvas CLI: automatic token rotation failed. ${error instanceof Error ? error.message : "Unexpected token API failure."}`,
      );
    }
  })();
  try {
    await pending;
  } finally {
    pending = undefined;
  }
}
