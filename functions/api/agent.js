// POST /api/agent — recibe la conversación del chat y devuelve la respuesta del agente.

import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "../_lib/agent.js";
import { PERIODS, DEFAULT_PERIOD, BRANCH_OPTIONS, ALL_ZONES } from "../_lib/config.js";
import { isDemoMode } from "../_lib/windsor.js";

const MAX_MESSAGES = 10;
const MAX_CHARS = 1500;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Normaliza el historial que manda el navegador. */
export function parseMessages(raw) {
  if (!Array.isArray(raw)) return [];
  const messages = raw.slice(-MAX_MESSAGES).map((m) => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: String(m?.content ?? "").slice(0, MAX_CHARS),
  }));
  // La API exige que la conversación empiece con el usuario.
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages.filter((m) => m.content.trim());
}

export async function onRequestPost({ request, env }) {
  const missing = [];
  if (!env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!isDemoMode(env) && !env.WINDSOR_API_KEY) missing.push("WINDSOR_API_KEY");
  if (!isDemoMode(env) && !env.WINDSOR_ACCOUNT) missing.push("WINDSOR_ACCOUNT");
  if (missing.length) {
    return json({ error: `Faltan ${missing.join(", ")} en la configuración del servidor.`, missing }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Solicitud JSON no válida." }, 400);
  }

  const messages = parseMessages(body.messages);
  if (!messages.length || messages.at(-1).role !== "user") {
    return json({ error: "Envía al menos un mensaje del usuario." }, 400);
  }

  const period = PERIODS.includes(Number(body.period)) ? Number(body.period) : DEFAULT_PERIOD;
  const branch = BRANCH_OPTIONS.includes(body.branch) ? body.branch : ALL_ZONES;

  try {
    const reply = await runAgent(env, messages, period, branch);
    return json({ reply, demo: isDemoMode(env) });
  } catch (err) {
    console.error("Error del agente:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ error: "La clave ANTHROPIC_API_KEY no es válida." }, 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ error: "El agente está recibiendo muchas consultas. Intenta de nuevo en un minuto." }, 429);
    }
    if (err instanceof Anthropic.APIError) {
      return json({ error: `Claude respondió con un error (HTTP ${err.status ?? "?"}).` }, 502);
    }
    return json({ error: err.message || "Error consultando al agente." }, 502);
  }
}
