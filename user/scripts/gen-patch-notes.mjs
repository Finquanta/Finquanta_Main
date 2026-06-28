// Generate public/patch-notes.json from git history at build time.
// Runs before `next build` (see package.json). If git isn't available (or the
// clone is too shallow), it writes an empty list rather than failing the build.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = join(here, "..");
const outFile = join(here, "..", "public", "patch-notes.json");

// Unit separator (\x1f) between fields, record separator (\x1e) between commits —
// safe against commit messages that contain commas/newlines.
const FORMAT = "%h%x1f%an%x1f%aI%x1f%s%x1e";

let commits = [];
try {
  const raw = execSync(`git log -200 --no-merges --pretty=format:${FORMAT}`, {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  commits = raw
    .split("\x1e")
    .map((r) => r.replace(/^\n/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, author, date, subject] = line.split("\x1f");
      return { hash, author, date, subject };
    });
} catch (err) {
  console.warn("[patch-notes] git log unavailable:", err?.message || err);
}

try {
  mkdirSync(dirname(outFile), { recursive: true });
} catch {}
writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), commits }, null, 2));
console.log(`[patch-notes] wrote ${commits.length} commits to public/patch-notes.json`);
