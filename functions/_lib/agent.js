// Agente de análisis: Claude + herramientas que consultan las métricas.

import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { BRANCH_OPTIONS, ALL_ZONES } from "./config.js";
import { loadRows, DataSourceError } from "./windsor.js";
import { filterByZone, performanceReport, detailReport } from "./metrics.js";

export const DEFAULT_MODEL = "claude-opus-5-5";
export const DEFAULT_EFFORT = "medium";

const SYSTEM_PROMPT = `Eres el agente de análisis de campañas de marketing de SmartBrands. Respondes a personas de una agencia de publicidad y a sus clientes, en español, de forma clara y concreta.

Cómo trabajas:
- Toda cifra que des debe venir de una herramienta. Si no la consultaste, no la menciones.
- Usa siempre el periodo fijado por el dashboard, aunque el usuario pida otro; si pide otro, explica que debe cambiarlo en el selector de periodo.
- Si el usuario menciona una zona, consulta esa zona; si no, usa la zona seleccionada en el panel.
- Nombra campañas y anuncios por su nombre legible. Muestra IDs solo si te los piden.
- CPL = inversión / leads. CTR = clics / impresiones. Si un grupo no tiene leads, dilo en lugar de mostrar un CPL.
- Solo puedes consultar e interpretar datos y recomendar qué revisar. Nunca digas que pausaste, optimizaste o cambiaste una campaña.
- Los leads son los que atribuye Meta; no reflejan la calidad del lead ni ventas en el CRM. Acláralo cuando sea relevante.
- Sé breve: responde la pregunta primero y luego, si aporta, una o dos observaciones accionables.`;

function contextNote(period, branch) {
  return `Contexto del dashboard: periodo fijado = últimos ${period} días. Zona seleccionada = ${branch}.`;
}

const branchSchema = {
  type: "string",
  enum: BRANCH_OPTIONS,
  description: "Zona mencionada en la pregunta; si no se menciona ninguna, la zona seleccionada en el panel.",
};

function buildTools(getRows, period) {
  const respond = async (branch, build) => {
    try {
      const rows = filterByZone(await getRows(), branch);
      if (!rows.length) {
        return JSON.stringify({
          period,
          branch,
          rows: 0,
          message: "No hay registros para este filtro. Puede que los nombres de campaña no incluyan la zona.",
        });
      }
      return JSON.stringify({ period, branch, ...build(rows) });
    } catch (err) {
      if (err instanceof DataSourceError) return JSON.stringify({ error: err.message });
      throw err;
    }
  };

  return [
    betaTool({
      name: "get_campaign_performance",
      description:
        "Métricas de Meta Ads del periodo fijado para una zona: totales, campañas, anuncios principales, comparación por zona y categorías por zona. Úsala para preguntas de rendimiento general, leads, CPL, CTR, zonas, campañas o anuncios.",
      inputSchema: {
        type: "object",
        properties: { branch: branchSchema },
        required: ["branch"],
        additionalProperties: false,
      },
      strict: true,
      run: ({ branch }) => respond(branch, performanceReport),
    }),
    betaTool({
      name: "get_campaign_detail",
      description:
        "Busca campañas, conjuntos o anuncios cuyo nombre contenga un texto (campaña, categoría, producto o creativo) y devuelve sus métricas en el periodo fijado.",
      inputSchema: {
        type: "object",
        properties: {
          branch: branchSchema,
          query: { type: "string", description: "Texto a buscar en el nombre de la campaña, conjunto o anuncio." },
        },
        required: ["branch", "query"],
        additionalProperties: false,
      },
      strict: true,
      run: ({ branch, query }) => respond(branch, (rows) => detailReport(rows, query)),
    }),
  ];
}

/**
 * Ejecuta una conversación con el agente.
 * @param {object} env  Variables de entorno de Cloudflare.
 * @param {{role: "user"|"assistant", content: string}[]} messages
 * @param {number} period
 * @param {string} branch
 * @returns {Promise<string>} Respuesta en texto.
 */
export async function runAgent(env, messages, period, branch = ALL_ZONES) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Se descargan los datos una sola vez por pregunta, aunque el agente use varias herramientas.
  let rowsPromise;
  const getRows = () => (rowsPromise ??= loadRows(env, period));

  const finalMessage = await client.beta.messages.toolRunner({
    model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 16000,
    output_config: { effort: env.ANTHROPIC_EFFORT || DEFAULT_EFFORT },
    // Si el modelo rechaza la petición por una política de seguridad, el servidor
    // la reintenta automáticamente con el modelo alternativo por defecto.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM_PROMPT },
      { type: "text", text: contextNote(period, branch) },
    ],
    tools: buildTools(getRows, period),
    messages,
    max_iterations: 6,
    thread: false, // conversaciones cortas: se envía el historial completo en cada turno
  });

  if (finalMessage.stop_reason === "refusal") {
    return "No puedo responder esa pregunta. Intenta reformularla sobre el rendimiento de las campañas.";
  }

  const text = finalMessage.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("El agente terminó sin texto de respuesta.");
  return text;
}
