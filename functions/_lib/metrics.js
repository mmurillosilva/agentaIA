// Cálculos de métricas. Funciones puras: no llaman a ninguna API,
// así se pueden probar con `npm test`.

import { ZONES, CATEGORIES, ALL_ZONES } from "./config.js";

export function round(n, decimals = 2) {
  return Number(Number(n || 0).toFixed(decimals));
}

function num(value) {
  return Number(value) || 0;
}

/** Texto donde buscar zona/categoría: campaña, conjunto y anuncio. */
function rowText(row) {
  return [row.campaign, row.adset_name, row.ad_name].filter(Boolean).join(" ").toUpperCase();
}

/** Devuelve el nombre de la zona de una fila, o "" si no se reconoce. */
export function zoneOf(row) {
  const text = rowText(row);
  const zone = ZONES.find((z) => text.includes(z.match.toUpperCase()));
  return zone ? zone.name : "";
}

/** Devuelve la categoría de una fila (palabra completa), o "" si no se reconoce. */
export function categoryOf(row) {
  const text = rowText(row);
  return (
    CATEGORIES.find((c) => new RegExp(`(^|[^A-Z])${escapeRegExp(c.toUpperCase())}([^A-Z]|$)`).test(text)) || ""
  );
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterByZone(rows, zone) {
  if (!zone || zone === ALL_ZONES) return rows;
  return rows.filter((r) => zoneOf(r) === zone);
}

/** Totales y métricas derivadas (CPL = inversión/leads, CTR = clics/impresiones). */
export function summarize(rows) {
  const t = { spend: 0, leads: 0, clicks: 0, impressions: 0 };
  for (const r of rows) {
    t.spend += num(r.spend);
    t.leads += num(r.actions_lead);
    t.clicks += num(r.clicks);
    t.impressions += num(r.impressions);
  }
  return withRatios(t);
}

function withRatios(t) {
  return {
    spend: round(t.spend),
    leads: round(t.leads),
    clicks: round(t.clicks),
    impressions: round(t.impressions),
    cpl: t.leads ? round(t.spend / t.leads) : null,
    ctr: t.impressions ? round((t.clicks / t.impressions) * 100) : 0,
  };
}

/** Agrupa filas con `keyFn` y calcula métricas por grupo. */
export function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { rows: [], days: new Set() });
    const g = groups.get(key);
    g.rows.push(r);
    if (r.date) g.days.add(r.date);
  }
  return [...groups.entries()].map(([name, g]) => ({ name, ...summarize(g.rows), days: g.days.size }));
}

const byLeadsDesc = (a, b) => b.leads - a.leads;
const byCplAsc = (a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity);

/** Resumen completo que recibe el agente en `get_campaign_performance`. */
export function performanceReport(rows) {
  const categoriesByZone = groupBy(rows, (r) => {
    const zone = zoneOf(r);
    const category = categoryOf(r);
    return zone && category ? `${zone}|${category}` : "";
  })
    .map(({ name, days, ...m }) => {
      const [zone, category] = name.split("|");
      return { zone, category, ...m };
    })
    .sort(byLeadsDesc);

  return {
    rows: rows.length,
    total: summarize(rows),
    campaigns: groupBy(rows, (r) => r.campaign).sort(byLeadsDesc).slice(0, 20),
    topAds: groupBy(rows, (r) => r.ad_name).sort(byLeadsDesc).slice(0, 12),
    zones: groupBy(rows, zoneOf).sort(byCplAsc),
    categoriesByZone,
  };
}

/** Busca campañas/anuncios cuyo nombre contenga `query`. */
export function detailReport(rows, query) {
  const q = String(query || "").trim().toLowerCase();
  const matches = rows.filter((r) =>
    [r.campaign, r.adset_name, r.ad_name].some((v) => String(v || "").toLowerCase().includes(q)),
  );
  return {
    query,
    matches: matches.length,
    campaigns: groupBy(matches, (r) => r.campaign).sort(byLeadsDesc).slice(0, 12),
    ads: groupBy(matches, (r) => r.ad_name).sort(byLeadsDesc).slice(0, 12),
  };
}
