// Fuente de datos: Windsor.ai (Meta Ads) o datos de demostración.

import { demoRows } from "./demo-data.js";

const WINDSOR_URL = "https://connectors.windsor.ai/facebook";

export const FIELDS = [
  "date",
  "campaign",
  "campaign_id",
  "spend",
  "impressions",
  "clicks",
  "actions_lead",
  "ad_name",
  "adset_name",
  "ad_id",
];

export class DataSourceError extends Error {}

export function isDemoMode(env) {
  return env.DEMO_MODE === "1" || env.DEMO_MODE === "true";
}

/** Devuelve las filas diarias (por anuncio) de los últimos `period` días. */
export async function loadRows(env, period) {
  if (isDemoMode(env)) return demoRows(period);

  if (!env.WINDSOR_API_KEY || !env.WINDSOR_ACCOUNT) {
    throw new DataSourceError("Faltan WINDSOR_API_KEY o WINDSOR_ACCOUNT en la configuración del servidor.");
  }

  const url = new URL(WINDSOR_URL);
  url.searchParams.set("api_key", env.WINDSOR_API_KEY);
  url.searchParams.set("select_accounts", env.WINDSOR_ACCOUNT);
  url.searchParams.set("fields", FIELDS.join(","));
  url.searchParams.set("date_preset", period === 7 ? "last_7d" : "last_30d");

  const resp = await fetch(url, { headers: { accept: "application/json" } });
  const body = await resp.json().catch(() => null);

  if (!resp.ok) {
    throw new DataSourceError(
      `Windsor.ai no pudo devolver datos (HTTP ${resp.status}). Revisa WINDSOR_API_KEY y el acceso a la cuenta.`,
    );
  }

  const rows = extractRows(body);
  if (!rows.length && body?.status && body.status !== "done") {
    throw new DataSourceError("Windsor.ai reportó un error al consultar la cuenta.");
  }
  return rows;
}

export function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}
