// Patient-screen icon set: one family, one colour (currentColor), 64x64 canvas.
// Glyph fills ~52 of 64 units. Cut-outs use fill-rule="evenodd" (never white), so
// icons work on any tile colour. Stroke details use width 5, round caps/joins.

const STROKE = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
const line = (d) => `<path d="${d}" ${STROKE}/>`;
const solid = (d) => `<path d="${d}"/>`;
const cut = (d) => `<path fill-rule="evenodd" d="${d}"/>`;

// Shared sub-shapes
const BOWL_STEAM_SPOON = [
  // bowl + foot
  solid("M8 30 H56 C56 45 46 54 32 54 C18 54 8 45 8 30 Z"),
  `<rect x="22" y="52" width="20" height="6" rx="3"/>`,
  // steam curls
  line("M20 23 C15 19 25 15 20 9"),
  line("M31 23 C26 19 36 15 31 9"),
  // spoon (handle + head)
  line("M38 31 L46 20"),
  `<ellipse cx="50" cy="13.5" rx="5.5" ry="7.5" transform="rotate(36 50 13.5)"/>`,
].join("");

// Water glass: wavy air-gap cut-out above the water (x offset applied by caller via path)
const GLASS_BIG = cut(
  "M12 8 H52 L47.5 52.5 Q47 58 42 58 H22 Q17 58 16.5 52.5 Z " +
    "M18 13.5 H46 V28 Q41 22 32 28 Q23 34 18 28 Z"
);

export const PATHS = {
  toilet: [
    // tank with flush button cut-out
    cut("M13 6 H23 A4 4 0 0 1 27 10 V23 A4 4 0 0 1 23 27 H13 A4 4 0 0 1 9 23 V10 A4 4 0 0 1 13 6 Z " +
        "M16.5 12 A2.5 2.5 0 1 0 21.5 12 A2.5 2.5 0 1 0 16.5 12 Z"),
    // seat
    `<rect x="8" y="31" width="50" height="6.5" rx="3.25"/>`,
    // bowl + pedestal
    solid("M15 40.5 H51 C51 46.5 47.5 50.5 42 52 V58 H24 V52 C18.5 50.5 15 46.5 15 40.5 Z"),
  ].join(""),

  food: BOWL_STEAM_SPOON,

  drink: GLASS_BIG,

  foodDrink: [
    // small bowl, steam, spoon
    solid("M4 34 H32 C32 46 26.5 54 18 54 C9.5 54 4 46 4 34 Z"),
    `<rect x="11" y="52" width="14" height="6" rx="3"/>`,
    line("M11 27 C7 23 15 19 11 13"),
    line("M20 27 C16 23 24 19 20 13"),
    line("M24 35 L28.5 26"),
    `<ellipse cx="31" cy="20" rx="4" ry="5.8" transform="rotate(26.6 31 20)"/>`,
    // glass with wave
    cut("M38 14 H58 L55.5 55 Q55.2 58 52 58 H44 Q40.8 58 40.5 55 Z " +
        "M42.2 18 H53.8 V27 Q51 23.5 48 27 Q45 30.5 42.2 27 Z"),
  ].join(""),

  pain: [
    // face with squeezed eyes (> <) and small frown cut out
    cut("M6 39 A19 19 0 1 0 44 39 A19 19 0 1 0 6 39 Z " +
        "M11.4 31.1 L15.5 34 L11.4 36.9 L13.6 40.1 L22.5 34 L13.6 27.9 Z " +
        "M36.4 27.9 L27.5 34 L36.4 40.1 L38.6 36.9 L34.5 34 L38.6 31.1 Z " +
        "M17.2 49 A9 9 0 0 1 32.8 49 L29.3 51 A5 5 0 0 0 20.7 51 Z"),
    // "hurt" bursts
    line("M31.6 14.4 L33 9.1"),
    line("M44.5 22.6 L48.7 19.1"),
    line("M50.4 36.8 L55.9 36.3"),
  ].join(""),

  symptom: [
    // thermometer (glass + mercury slot/bulb cut-out)
    cut("M16 12 A6 6 0 0 1 28 12 V35.6 A12 12 0 1 1 16 35.6 Z " +
        "M20 14 A2 2 0 0 1 24 14 V41.9 A5 5 0 1 1 20 41.9 Z"),
    // sparkle
    solid("M44 11 Q46 20 55 22 Q46 24 44 33 Q42 24 33 22 Q42 20 44 11 Z"),
    // drop
    solid("M46 38 C46 38 40.5 44 40.5 48 A5.5 5.5 0 0 0 51.5 48 C51.5 44 46 38 46 38 Z"),
  ].join(""),

  speech: cut(
    // bubble with tail
    "M20 7 H44 A14 14 0 0 1 58 21 V33 A14 14 0 0 1 44 47 H34 L19.5 56.6 Q14.5 59.5 16 53 L20 47 " +
      "A14 14 0 0 1 6 33 V21 A14 14 0 0 1 20 7 Z " +
      // microphone capsule
      "M26.5 18.5 A5.5 5.5 0 0 1 37.5 18.5 V22.5 A5.5 5.5 0 0 1 26.5 22.5 Z " +
      // holder U + stem + base
      "M19 23 A13 13 0 0 0 29.5 35.76 V38.5 H25 V43 H39 V38.5 H34.5 V35.76 A13 13 0 0 0 45 23 H41 A9 9 0 0 1 23 23 Z"
  ),

  bell: [
    solid("M32 13 C21 13 17 22 17 31 V38 L10 45 H54 L47 38 V31 C47 22 43 13 32 13 Z"),
    `<rect x="9" y="42" width="46" height="7" rx="3.5"/>`,
    `<circle cx="32" cy="9.5" r="3.5"/>`,
    `<ellipse cx="32" cy="56" rx="6" ry="3.5"/>`,
  ].join(""),
};

export const ICON_NAMES = ["toilet", "foodDrink", "food", "drink", "pain", "symptom", "speech", "bell"];

const TYPE_TO_ICON = {
  toilet: "toilet",
  drink: "drink",
  food: "food",
  pain: "pain",
  symptom: "symptom",
  speech: "speech",
};

const SVG_NS = "http://www.w3.org/2000/svg";

function resolve(name) {
  return Object.prototype.hasOwnProperty.call(PATHS, name) ? name : "bell";
}

export function iconNode(name, { size = "1em", className = "" } = {}) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `svg-icon ${className}`.trim());
  svg.setAttribute("fill", "currentColor");
  svg.innerHTML = PATHS[resolve(name)];
  return svg;
}

export function typeIconNode(type, opts) {
  return iconNode(TYPE_TO_ICON[type] || "bell", opts);
}

export function iconSvgString(name) {
  return (
    `<svg class="svg-icon" viewBox="0 0 64 64" width="1em" height="1em" aria-hidden="true" ` +
    `focusable="false" fill="currentColor">${PATHS[resolve(name)]}</svg>`
  );
}
