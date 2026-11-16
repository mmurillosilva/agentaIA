# SmartBrands — dashboard de marketing con agente IA

Dashboard de métricas de Meta Ads con un chat donde se pueden hacer preguntas como *"¿qué campaña tiene el mejor CPL en Zona Norte?"*. El agente usa **Claude** (API de Anthropic) y consulta los datos en **Windsor.ai**. Todo corre en **Cloudflare Pages**.

> Estado: el chat ya funciona con datos reales o de demostración. Las gráficas del dashboard todavía usan datos ficticios. Falta el login: **no publiques el sitio con claves reales hasta configurarlo** (ver [ARCHITECTURE.md](ARCHITECTURE.md#9-seguridad-y-pendientes)).

## Estructura

```
public/index.html          Dashboard y chat (lo que ve el usuario)
functions/api/agent.js     Endpoint POST /api/agent
functions/_lib/agent.js    Agente: Claude + herramientas
functions/_lib/metrics.js  Cálculos (totales, CPL, CTR, agrupaciones)
functions/_lib/windsor.js  Consulta a Windsor.ai
functions/_lib/demo-data.js  Datos de demostración
functions/_lib/config.js   Zonas, categorías y periodos
tests/                     Pruebas automáticas
```

## Trabajar en tu computadora

Requisitos: [Node.js](https://nodejs.org) 20 o superior.

```bash
git clone https://github.com/mmurillosilva/agentaia.git
cd agentaia
npm install
cp .dev.vars.example .dev.vars   # y escribe tu ANTHROPIC_API_KEY dentro
npm run dev                      # abre http://localhost:8788
```

Con `DEMO_MODE=1` en `.dev.vars` el chat usa datos de demostración y no necesitas Windsor.ai. Para usar datos reales, pon `DEMO_MODE=0` y llena `WINDSOR_API_KEY` y `WINDSOR_ACCOUNT`.

Pruebas (no gastan créditos de Claude):

```bash
npm test
```

## Publicar en Cloudflare

```bash
npx wrangler login
npm run deploy
```

Después, en Cloudflare → Workers & Pages → *smartbrands* → Settings → Variables and Secrets, agrega las variables de [ARCHITECTURE.md](ARCHITECTURE.md#8-variables-de-entorno).
