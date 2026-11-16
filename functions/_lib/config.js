// Configuración de negocio: periodos, zonas y categorías.
// Más adelante esto se cargará por cliente; por ahora es una sola configuración.

export const PERIODS = [7, 30];
export const DEFAULT_PERIOD = 30;

export const ALL_ZONES = "Todas";

// Cada zona se detecta buscando su `match` (sin distinguir mayúsculas)
// en el nombre de la campaña, conjunto de anuncios o anuncio.
export const ZONES = [
  { name: "Zona Norte", match: "ZONA NORTE" },
  { name: "Zona Centro", match: "ZONA CENTRO" },
  { name: "Zona Sur", match: "ZONA SUR" },
  { name: "Zona Este", match: "ZONA ESTE" },
];

export const CATEGORIES = ["CATEGORIA A", "CATEGORIA B", "CATEGORIA C", "CATEGORIA D"];

export const BRANCH_OPTIONS = [ALL_ZONES, ...ZONES.map((z) => z.name)];
