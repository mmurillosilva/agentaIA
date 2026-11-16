import { test } from "node:test";
import assert from "node:assert/strict";
import { zoneOf, categoryOf, summarize, filterByZone, performanceReport, detailReport } from "../functions/_lib/metrics.js";
import { demoRows } from "../functions/_lib/demo-data.js";
import { extractRows } from "../functions/_lib/windsor.js";

const rows = [
  { date: "2026-11-01", campaign: "ZONA NORTE | CATEGORIA A | X", ad_name: "Ad 1", spend: 10, impressions: 1000, clicks: 20, actions_lead: 2 },
  { date: "2026-11-02", campaign: "ZONA NORTE | CATEGORIA A | X", ad_name: "Ad 1", spend: "15", impressions: "500", clicks: "5", actions_lead: "1" },
  { date: "2026-11-01", campaign: "zona sur | categoria b", ad_name: "Ad 2", spend: 30, impressions: 2000, clicks: 10, actions_lead: 0 },
  { date: "2026-11-01", campaign: "Sin zona", ad_name: "Ad 3", spend: 5, impressions: 100, clicks: 1 },
];

test("detecta zona y categoría sin importar mayúsculas", () => {
  assert.equal(zoneOf(rows[0]), "Zona Norte");
  assert.equal(zoneOf(rows[2]), "Zona Sur");
  assert.equal(zoneOf(rows[3]), "");
  assert.equal(categoryOf(rows[0]), "CATEGORIA A");
  assert.equal(categoryOf(rows[2]), "CATEGORIA B");
  assert.equal(categoryOf({ campaign: "CATEGORIA AB" }), "", "no confunde CATEGORIA AB con CATEGORIA A");
});

test("calcula totales, CPL y CTR con valores en texto o número", () => {
  const t = summarize(rows.slice(0, 2));
  assert.deepEqual(t, { spend: 25, leads: 3, clicks: 25, impressions: 1500, cpl: 8.33, ctr: 1.67 });
});

test("CPL es null cuando no hay leads", () => {
  assert.equal(summarize([rows[2]]).cpl, null);
});

test("filtra por zona", () => {
  assert.equal(filterByZone(rows, "Todas").length, 4);
  assert.equal(filterByZone(rows, "Zona Norte").length, 2);
});

test("reporte de rendimiento agrupa campañas, zonas y categorías", () => {
  const r = performanceReport(rows);
  assert.equal(r.rows, 4);
  assert.equal(r.total.spend, 60);
  assert.equal(r.campaigns[0].name, "ZONA NORTE | CATEGORIA A | X");
  assert.equal(r.campaigns[0].days, 2);
  assert.deepEqual(r.zones.map((z) => z.name), ["Zona Norte", "Zona Sur"], "ordena por CPL, sin leads al final");
  assert.equal(r.categoriesByZone[0].zone, "Zona Norte");
  assert.equal(r.categoriesByZone[0].category, "CATEGORIA A");
});

test("búsqueda por nombre", () => {
  const r = detailReport(rows, "ad 2");
  assert.equal(r.matches, 1);
  assert.equal(r.ads[0].name, "Ad 2");
});

test("datos demo cubren el periodo y todas las zonas", () => {
  const demo = demoRows(7, new Date("2026-11-16T12:00:00Z"));
  assert.equal(new Set(demo.map((r) => r.date)).size, 7);
  assert.equal(performanceReport(demo).zones.length, 4);
  assert.ok(demo.every((r) => r.date < "2026-11-16"), "no incluye el día de hoy");
});

test("normaliza la respuesta de Windsor", () => {
  assert.deepEqual(extractRows([1]), [1]);
  assert.deepEqual(extractRows({ data: [2] }), [2]);
  assert.deepEqual(extractRows({ rows: [3] }), [3]);
  assert.deepEqual(extractRows(null), []);
});
