// Patient-screen icon set: one family, one colour (currentColor), 64x64 canvas.
// Glyph fills ~52 of 64 units. Cut-outs use fill-rule="evenodd" (never white), so
// icons work on any tile colour. Stroke details use width 5, round caps/joins.

const STROKE = 'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
const line = (d) => `<path d="${d}" ${STROKE}/>`;
const solid = (d) => `<path d="${d}"/>`;
const cut = (d) => `<path fill-rule="evenodd" d="${d}"/>`;

// Geometry helpers. All solid parts wind clockwise so overlapping parts union under
// the default non-zero rule; cut-outs inside a non-zero path must wind counter-clockwise.
const n2 = (v) => +v.toFixed(2);
const rr = (x, y, w, h, r) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
  `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circ = (cx, cy, r, ccw = false) =>
  `M${cx - r} ${cy}A${r} ${r} 0 1 ${ccw ? 0 : 1} ${cx + r} ${cy}A${r} ${r} 0 1 ${ccw ? 0 : 1} ${cx - r} ${cy}Z`;
const capsule = (x1, y1, x2, y2, r) => {
  const l = Math.hypot(x2 - x1, y2 - y1), nx = ((y2 - y1) / l) * r, ny = (-(x2 - x1) / l) * r;
  const q = (a, b) => `${n2(a)} ${n2(b)}`;
  return `M${q(x1 + nx, y1 + ny)}L${q(x2 + nx, y2 + ny)}A${r} ${r} 0 0 1 ${q(x2 - nx, y2 - ny)}` +
    `L${q(x1 - nx, y1 - ny)}A${r} ${r} 0 0 1 ${q(x1 + nx, y1 + ny)}Z`;
};
// Polygon with rounded corners (r = number or per-vertex array)
const poly = (pts, r) => pts.map((p, i) => {
  const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
  const t = Array.isArray(r) ? r[i] : r;
  const u = (q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); return [p[0] + ((q[0] - p[0]) / d) * t, p[1] + ((q[1] - p[1]) / d) * t]; };
  const s = u(a), e = u(b);
  return `${i ? "L" : "M"}${n2(s[0])} ${n2(s[1])}Q${p[0]} ${p[1]} ${n2(e[0])} ${n2(e[1])}`;
}).join("") + "Z";
// Water drop with tip above (cx, cy - k*r) and round belly of radius r
const drop = (cx, cy, r, k = 2) => {
  const ty = n2(cy - k * r), cy9 = n2(cy - 0.9 * r);
  return `M${cx} ${ty}C${cx} ${ty} ${cx - r} ${cy9} ${cx - r} ${cy}A${r} ${r} 0 0 0 ${cx + r} ${cy}C${cx + r} ${cy9} ${cx} ${ty} ${cx} ${ty}Z`;
};

// Fork + knife, full size (food) and compact (foodDrink)
const CUTLERY_BIG = [
  ...[11.5, 21, 30.5].map((x) => solid(capsule(x, 9, x, 30, 3))),
  solid(rr(8.5, 24, 25, 18, 9)),
  solid(capsule(21, 34, 21, 54, 4)),
  solid(poly([[50, 6], [55, 6], [55, 40], [42, 40], [42, 18]], [5, 3.5, 3, 4, 8])),
  solid(capsule(51, 36, 51, 54, 4)),
].join("");
const CUTLERY_SMALL = [
  ...[7.5, 14.5, 21.5].map((x) => solid(capsule(x, 7.8, x, 28, 1.8))),
  solid(rr(5.7, 22, 17.6, 14, 6.5)),
  solid(capsule(14.5, 32, 14.5, 55.5, 2.5)),
  solid(poly([[31, 6], [35, 6], [35, 38], [27, 38], [27, 17]], [3, 2.5, 2.5, 3, 6])),
  solid(capsule(32.25, 34, 32.25, 55.25, 2.75)),
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

  food: CUTLERY_BIG,

  drink: GLASS_BIG,

  foodDrink: [
    CUTLERY_SMALL,
    // glass with wave
    cut("M40 12 H59 L56.7 55 Q56.4 58 53.5 58 H45.5 Q42.6 58 42.3 55 Z " +
        "M44 16 H55 V25 Q52.5 21.5 49.5 25 Q46.5 28.5 44 25 Z"),
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
  water: GLASS_BIG,

  check: cut(
    circ(32, 32, 26) +
      "M21.6 30.8L28.4 37.2L43.3 21.9A3.75 3.75 0 0 1 48.7 27.1L31.2 45.1A3.75 3.75 0 0 1 25.9 45.2L16.4 36.2A3.75 3.75 0 0 1 21.6 30.8Z"
  ),

  hourglass: [
    solid(rr(10, 6, 44, 7, 3.5)),
    solid(rr(10, 51, 44, 7, 3.5)),
    cut("M16 12H48C48 22 41 27 37 32C41 37 48 42 48 52H16C16 42 23 37 27 32C23 27 16 22 16 12Z" +
        poly([[22, 17.5], [42, 17.5], [34.5, 27], [29.5, 27]], 2.5) +
        poly([[21, 46.5], [43, 46.5], [35, 37.5], [29, 37.5]], 2.5)),
  ].join(""),

  warning: cut(
    poly([[32, 6], [59, 54], [5, 54]], [5, 6, 6]) +
      capsule(32, 24.5, 32, 35, 3.6) + circ(32, 45.5, 4)
  ),

  pee: [drop(23, 41, 15, 2.2), drop(49, 19.5, 7), drop(49, 46, 7)].map(solid).join(""),

  poo: solid(
    rr(6, 34, 52, 24, 12) + rr(14.5, 20, 35, 19, 9.5) + rr(22.5, 9, 19, 17, 8.5) +
      "M27 13C27 9 31 6.5 36 5C35 8 37 10 38 14Z" +
      // counter-clockwise cut-outs: eyes + smile
      circ(22, 43.5, 2.8, true) + circ(42, 43.5, 2.8, true) +
      "M24.5 48.5A7.5 5.5 0 0 0 39.5 48.5L36 48.5A4 2 0 0 1 28 48.5Z"
  ),

  help: [
    ...[[21.75, 13], [32.75, 7], [43.75, 12], [54.75, 21]].map(([x, t]) => solid(capsule(x, t + 3.75, x, 44, 3.75))),
    solid(rr(18, 34, 40.5, 24, 12)),
    solid(capsule(17, 50, 9.5, 33, 4.2)),
  ].join(""),

  milk: cut(
    poly([[14, 58], [14, 25], [25, 6.5], [39, 6.5], [50, 25], [50, 58]], [4, 3, 3.5, 3.5, 3, 4]) +
      capsule(22, 26.5, 42, 26.5, 1.9) + drop(32, 47, 6.5)
  ),

  tea: [
    solid("M12 31H44V38C44 47 38 53 28 53C18 53 12 47 12 38Z"),
    solid(rr(5, 51.5, 46, 7, 3.5)),
    line("M44 34H49A6 6 0 0 1 49 46H43"),
    line("M17 24C12 20 22 16 17 10"),
    line("M26 24C21 20 31 16 26 10"),
    `<path d="M39 30L40.5 16" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`,
    cut(rr(35, 5.5, 12, 11, 3) + circ(41, 9.5, 1.9)),
  ].join(""),

  snack: cut(
    "M56.3 22.8A26 26 0 1 1 42.9 8.4A10 10 0 0 0 56.3 22.8Z" +
      circ(22, 25, 3.8) + circ(36, 30, 3.4) + circ(23, 42, 3.6) + circ(42, 43, 3.8) + circ(32, 52, 3.3)
  ),

  fruit: [
    solid("M32 22C29 17.5 22 15.5 16 19C8 23.5 6.5 36 12 47C16 55 22 59 27.5 57Q32 55.5 36.5 57C42 59 48 55 52 47C57.5 36 56 23.5 48 19C42 15.5 35 17.5 32 22Z"),
    line("M32 22C32 16 33 12 36 8"),
    solid("M36 12C37 5 45 3 52 5C52 11 45 16 36 12Z"),
  ].join(""),

  yoghurt: [
    solid(rr(7, 21, 40, 9, 4.5)),
    solid(poly([[10.5, 33.5], [43.5, 33.5], [40, 58], [14, 58]], [3, 3, 4, 4])),
    solid(capsule(35, 24, 44, 13, 2.8)),
    `<ellipse cx="49.5" cy="9.5" rx="4.8" ry="6.8" transform="rotate(40 49.5 9.5)"/>`,
  ].join(""),

  more: cut(rr(6, 6, 52, 52, 16) + circ(17, 32, 5.2) + circ(32, 32, 5.2) + circ(47, 32, 5.2)),
};

export const ICON_NAMES = [
  "toilet", "foodDrink", "food", "drink", "pain", "symptom", "speech", "bell",
  "check", "hourglass", "warning", "pee", "poo", "help", "water", "milk", "tea", "snack", "fruit", "yoghurt", "more",
];

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
