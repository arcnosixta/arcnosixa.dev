import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");
// Only this generated child directory may be cleared, including on Windows.
if (dirname(output) !== root || relative(root, output) !== "dist") throw new Error("Unsafe build destination");
const includeAudio = process.env.FATE_AUDIO_LICENSED === "1";
if (includeAudio) {
  try { await stat(join(root, "assets/audio/fate.mp3")); }
  catch { throw new Error("FATE_AUDIO_LICENSED=1 but assets/audio/fate.mp3 is missing."); }
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const version = (process.env.GITHUB_SHA || "local").slice(0, 8);
const extensions = /\.(html|css|js|png|jpg|jpeg|webp|svg|ico|woff2?|mp3|xml|txt)$/i;
let count = 0;
async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const src = join(source, entry.name), dest = join(destination, entry.name);
    if (entry.isDirectory()) { await copyDirectory(src, dest); continue; }
    if (!extensions.test(entry.name)) continue;
    if (src === join(root, "assets/audio/fate.mp3") && !includeAudio) continue;
    if (entry.name.endsWith(".html")) {
      await writeFile(dest, (await readFile(src, "utf8")).replace(/\?v=[\da-z]+/gi, `?v=${version}`));
    } else await cp(src, dest);
    count++;
  }
}
for (const folder of ["assets", "vendor", "fate"]) await copyDirectory(join(root, folder), join(output, folder));
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isFile() || !extensions.test(entry.name)) continue;
  const src = join(root, entry.name), dest = join(output, entry.name);
  if (entry.name.endsWith(".html")) await writeFile(dest, (await readFile(src, "utf8")).replace(/\?v=[\da-z]+/gi, `?v=${version}`));
  else await cp(src, dest);
  count++;
}
await writeFile(join(output, "fate/audio-config.js"), `window.FATE_AUDIO = ${JSON.stringify({ available: includeAudio, src: "../assets/audio/fate.mp3" })};\n`);
await writeFile(join(output, ".nojekyll"), "");
console.log(`Built ${count} files in dist/. FATE recording: ${includeAudio ? "included (rights confirmed by FATE_AUDIO_LICENSED=1)" : "excluded; silent public edition"}.`);
