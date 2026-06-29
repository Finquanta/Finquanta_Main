// Generate public/patch-notes.json from git history at build time.
// Runs before `next build` (see package.json).
//
// To guarantee the notes reach all the way back to the start of the product —
// even when the deploy host (e.g. Vercel) only does a shallow clone — we MERGE
// the freshly-read git commits with whatever is already committed in
// public/patch-notes.json (which was generated locally with full history).
// The union is de-duplicated by hash and sorted newest-first, so history is
// only ever added to, never truncated.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = join(here, "..");
const outFile = join(here, "..", "public", "patch-notes.json");

const FORMAT = "%h%x1f%an%x1f%aI%x1f%s%x1e";

let fromGit = [];
try {
  // No -n limit: take the entire history that this clone can see.
  const raw = execSync(`git log --no-merges --pretty=format:${FORMAT}`, {
    cwd: repoDir,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  fromGit = raw
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

let existing = [];
try {
  existing = JSON.parse(readFileSync(outFile, "utf8"))?.commits ?? [];
} catch {
  /* no prior file — fine */
}

// Union by hash, newest first.
const byHash = new Map();
for (const cm of [...fromGit, ...existing]) {
  if (cm && cm.hash && !byHash.has(cm.hash)) byHash.set(cm.hash, cm);
}
const commits = [...byHash.values()].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

try {
  mkdirSync(dirname(outFile), { recursive: true });
} catch {}
writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), commits }, null, 2));
console.log(`[patch-notes] ${fromGit.length} from git + ${existing.length} existing → ${commits.length} total`);
