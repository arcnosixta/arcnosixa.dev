import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const folder of [".", "fate", "scripts"]) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(m?js)$/.test(entry.name)) continue;
    const path = `${folder}/${entry.name}`;
    const result = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
    if (result.status) process.exit(result.status);
  }
}
console.log("JavaScript syntax checks passed.");
