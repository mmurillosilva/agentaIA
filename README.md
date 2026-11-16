# SmartBrands — plataforma general de marketing con agente IA

Copia para revisión técnica. Incluye el dashboard, el endpoint del agente y una guía detallada de arquitectura. El dashboard muestra datos ficticios; no incluye API keys, tokens, contraseñas, IDs reales de cuenta, datos de producción ni información personal de clientes.

## Tecnologías del código actual

| Componente | Tecnología | Para qué se usa |
|---|---|---|
| Interfaz | HTML, CSS y JavaScript | Dashboard, filtros y chat |
| Hosting | Cloudflare Pages | Publica la interfaz |
| Backend | Cloudflare Pages Functions (JavaScript) | Implementa `POST /api/agent` |
| Agente | OpenAI Responses API y function calling | Interpreta preguntas y solicita consultas de datos |
| Conector | Windsor.ai API | Consulta métricas de Meta Ads |
| Datos visibles | Arreglos JavaScript ficticios | Permiten revisar el dashboard sin datos reales |

El detalle de componentes, comunicación, contratos, configuración, límites y pendientes está en [ARCHITECTURE.md](ARCHITECTURE.md). El código ejecutable está en `index.html` y `functions/api/agent.js`.

## Aclaración sobre el cuadro de referencia

Este proyecto no usa Python, FastAPI, Uvicorn, SQLite, openpyxl, Google Drive, OAuth de Drive ni Make. El backend de esta copia está escrito en JavaScript y corre como una Cloudflare Pages Function.

## Estado

Está implementada la interfaz y el flujo de código OpenAI → function calling → Windsor.ai para consultar Meta Ads cuando se configuren credenciales y se despliegue la función. Esta copia no trae credenciales y sus métricas de pantalla son ficticias. El adaptador actual no consulta Google Ads, TikTok, CRM ni benchmarks públicos del sector.

## Despliegue

Pages Functions debe desplegarse con Wrangler; cargar solo los archivos estáticos mediante drag and drop no compila la carpeta `functions`. Los pasos y variables están en [ARCHITECTURE.md](ARCHITECTURE.md).
