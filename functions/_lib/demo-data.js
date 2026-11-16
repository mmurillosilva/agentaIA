// Datos ficticios con el mismo formato que devuelve Windsor.ai.
// Se usan cuando DEMO_MODE=1 para probar sin credenciales reales.

const CAMPAIGNS = [
  { zone: "ZONA NORTE", category: "CATEGORIA A", product: "PRODUCTO A", baseSpend: 18, baseLeads: 3 },
  { zone: "ZONA CENTRO", category: "CATEGORIA B", product: "PRODUCTO B", baseSpend: 21, baseLeads: 4 },
  { zone: "ZONA SUR", category: "CATEGORIA C", product: "PRODUCTO C", baseSpend: 24, baseLeads: 3 },
  { zone: "ZONA ESTE", category: "CATEGORIA D", product: "PRODUCTO D", baseSpend: 27, baseLeads: 5 },
];

function isoDate(daysAgo, today = new Date()) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo));
  return d.toISOString().slice(0, 10);
}

/** Filas diarias deterministas (mismo resultado en cada llamada del mismo día). */
export function demoRows(period, today = new Date()) {
  const rows = [];
  for (let day = period; day >= 1; day--) {
    CAMPAIGNS.forEach((c, i) => {
      for (let creative = 1; creative <= 2; creative++) {
        const wave = ((day + i * 3 + creative) % 5) - 2; // -2..2
        const spend = c.baseSpend / 2 + wave * 0.8;
        const impressions = Math.round(spend * 45 + creative * 30);
        const clicks = Math.round(impressions * (0.025 + wave * 0.002));
        rows.push({
          date: isoDate(day, today),
          campaign: `${c.zone} | ${c.category} | ${c.product} | DEMO`,
          campaign_id: `demo-campaign-${i + 1}`,
          adset_name: `${c.zone} | ${c.category} | ADSET DEMO`,
          ad_name: `${c.product} | CREATIVO DEMO ${creative}`,
          ad_id: `demo-ad-${i + 1}-${creative}`,
          spend: Number(spend.toFixed(2)),
          impressions,
          clicks,
          actions_lead: Math.max(0, Math.round(c.baseLeads / 2 + wave / 2)),
        });
      }
    });
  }
  return rows;
}
