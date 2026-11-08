import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { profiles } = require("../fate/sword-profiles.js");
const width = 1800;
const height = 1000;
const seam = 350;
const total = 1000;

let seed = 19097731;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const between = (a, b) => a + (b - a) * random();
const format = n => Number(n.toFixed(3));
const choose = ids => ids[Math.floor(random() * ids.length)];
const slim = ["katana", "katana", "tachi", "naginata", "naginata", "ken", "greatsword", "short-cleaver"];
const mixed = profiles.map(profile => profile.id);

// Match the narrow steel, angular guard and hanging chain of the 3D katana.
const hero = {
  id: "hero",
  blade: [[0, 0], [.011, .022], [.018, .08], [.023, .172], [.029, .295], [.033, .457], [.035, .62], [.036, .816],
    [.002, .816], [.002, .68], [0, .55], [-.003, .42], [-.006, .28], [-.008, .155], [-.008, .066], [-.007, .023]],
  guard: [[-.024, .802], [-.008, .803], [0, .809], [.038, .809], [.049, .804], [.06, .806],
    [.055, .818], [.04, .825], [-.003, .825], [-.018, .82]],
  grip: [[.009, .815], [.028, .815], [.034, .984], [.015, .984]],
  pommel: [[.012, .976], [.036, .976], [.037, .993], [.033, 1], [.014, 1], [.012, .993]],
  ornament: [[.032, .986], [.045, .94], [.054, .883], [.053, .825], [.048, .745], [.04, .674], [.028, .632],
    [.025, .633], [.037, .675], [.045, .746], [.05, .826], [.051, .884], [.042, .941], [.029, .985]],
};

// Hand-positioned giants leave a pocket of white around the central katana.
const foreground = [
  [54, 137, -8, "short-cleaver"], [146, 186, 7, "tachi"], [244, 155, -4, "hooked-cleaver"],
  [330, 198, 9, "naginata"], [437, 194, -8, "angular-cleaver"], [548, 160, 12, "ken"],
  [649, 181, -9, "chained-cleaver"], [758, 162, 7, "greatsword"],
  [1045, 190, -8, "hooked-cleaver"], [1156, 162, 10, "naginata"], [1232, 202, -7, "chained-cleaver"],
  [1368, 152, 12, "short-cleaver"], [1468, 192, -8, "tachi"], [1549, 154, 7, "greatsword"],
  [1649, 187, -9, "angular-cleaver"], [1740, 146, 11, "ken"],
];
const middleCount = 82;
const farCount = total - foreground.length - middleCount - 1;
const swords = [];

for (let i = 0; i < farCount; i++) {
  const x = Math.max(2, Math.min(width - 2, (i + .5) / farCount * width + between(-4, 4)));
  const bladeHeight = 8 + Math.pow(random(), 1.6) * 29 + (1 + Math.sin(x * .013)) * 2.4;
  swords.push([x, bladeHeight, between(-20, 20), choose(slim)]);
}
for (let i = 0; i < middleCount; i++) {
  const x = 14 + (i + .5) / middleCount * (width - 28) + between(-11, 11);
  const gap = Math.min(1, Math.abs(x - width / 2) / 110);
  const bladeHeight = 41 + gap * Math.pow(random(), 1.35) * 86;
  swords.push([x, bladeHeight, between(-14, 14), choose(mixed)]);
}
swords.push(...foreground, [width / 2, 260, 0, hero.id, "hero"]);

const definitions = [...profiles, hero].map(({ id, ...parts }) => {
  const outlines = Object.values(parts).map(contour => `M${contour.map(([x, y]) => `${format(x)} ${format(y)}`).join("L")}Z`);
  return `    <g id="profile-${id}" class="sword-profile">${outlines.map(d => `<path d="${d}"/>`).join("")}</g>`;
}).join("\n");

const instances = swords.map(([x, bladeHeight, angle, id, role], index) => {
  const h = format(bladeHeight);
  const roleAttribute = role ? ` data-role="${role}"` : "";
  return `    <use data-sword="${index + 1}"${roleAttribute} href="#profile-${id}" transform="translate(${format(x)} ${seam}) rotate(${format(angle)}) scale(${h} ${-h})"/>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-labelledby="title desc">
  <title id="title">A thousand blades</title>
  <desc id="desc">A tall katana rises from an ink-black horizon surrounded by a thousand-sword field of curved, straight and hooked blades.</desc>
  <style>
    @media (max-aspect-ratio: 4/5) { .sword-profile { transform: scaleX(2.1); } }
    @media (max-aspect-ratio: 3/5) { .sword-profile { transform: scaleX(3.2); } }
    @media (max-aspect-ratio: 2/5) { .sword-profile { transform: scaleX(4.1); } }
  </style>
  <defs>
${definitions}
  </defs>
  <rect width="${width}" height="${height}" fill="#fff"/>
  <rect data-horizon="black" x="0" y="${seam}" width="${width}" height="${height - seam}" fill="#000"/>
  <g fill="#000" data-sword-count="${swords.length}">
${instances}
  </g>
</svg>
`;

await writeFile(new URL("../assets/fate/sword-horizon.svg", import.meta.url), svg);
