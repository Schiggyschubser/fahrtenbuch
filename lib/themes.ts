export const THEME_STORAGE_KEY = "fahrtenbuch-theme";

export const THEMES = [
  {
    id: "route-light",
    name: "Atlas",
    description: "Helle Navigationsansicht mit Kartenblau, klaren Linien und ruhigem Flotten-Grau.",
    mode: "light",
    colors: ["#f4f7fb", "#ffffff", "#2463eb", "#172033"],
  },
  {
    id: "dispatch-light",
    name: "Dispatch",
    description: "Leichtes Disponenten-Design mit Petrol, Asphaltgrau und dezentem Signalgelb.",
    mode: "light",
    colors: ["#f3f7f6", "#ffffff", "#0f766e", "#17252f"],
  },
  {
    id: "fleet-light",
    name: "Fleet",
    description: "Frische Fuhrpark-Optik mit Grün, weichen Kartenflächen und sachlichen Kontrasten.",
    mode: "light",
    colors: ["#f4f8f3", "#ffffff", "#2f7d4f", "#1f3328"],
  },
  {
    id: "paper-trail",
    name: "Paper Trail",
    description: "Modernes Fahrtenbuch-Papier mit warmer Tinte und einem Kilometer-Marker.",
    mode: "light",
    colors: ["#f7f5ef", "#fffdf8", "#8a5a12", "#2f2b24"],
  },
  {
    id: "electric-light",
    name: "Charge",
    description: "Helles EV-Cockpit mit Cyan, tiefem Tintenblau und präzisen UI-Linien.",
    mode: "light",
    colors: ["#eef8fa", "#ffffff", "#078c9b", "#15343d"],
  },
  {
    id: "night-drive",
    name: "Night Drive",
    description: "Nachtfahrt-Cockpit mit Cyan-Licht, Route-Kontrast und ruhigem Navy.",
    mode: "dark",
    colors: ["#08111f", "#101d30", "#38bdf8", "#e7f2ff"],
  },
  {
    id: "asphalt-dark",
    name: "Asphalt",
    description: "Dunkler Straßenbelag mit Markierungsgelb, klaren Kanten und hoher Lesbarkeit.",
    mode: "dark",
    colors: ["#111315", "#1c2024", "#e6a817", "#f2f4f5"],
  },
  {
    id: "control-dark",
    name: "Control Room",
    description: "Dunkles Leitstand-Theme mit Teal, neutralem Graphit und Statusgrün.",
    mode: "dark",
    colors: ["#0c1416", "#131f22", "#22c7a6", "#e7f5f1"],
  },
  {
    id: "tunnel-dark",
    name: "Tunnel",
    description: "Gedämpftes Tunnellicht mit Grün, Amber und robusten Kontrasten.",
    mode: "dark",
    colors: ["#101512", "#1a241f", "#95d06b", "#eef7e9"],
  },
  {
    id: "garage-dark",
    name: "Garage",
    description: "Werkstatt-Nacht mit Rücklicht-Rot, warmem Metall und soliden Linien.",
    mode: "dark",
    colors: ["#151112", "#241b1d", "#e35d4f", "#f7efef"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeDefinition = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeId = "route-light";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
