/**
 * Re-scrapes DeepSWE + arena.ai and rewrites data/snapshot.json.
 *
 * This is the ONLY thing that touches the network. The website itself is fully
 * static and reads the committed snapshot, so a broken scrape shows up here in the
 * terminal rather than in front of a visitor.
 *
 *   npm run refresh -- --dry-run    scrape, print the diff, write nothing
 *   npm run refresh                 scrape, print the diff, write the snapshot
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fetchDeepSwe } from "../lib/sources/deepswe";
import { fetchArena } from "../lib/sources/arena";
import { diffSnapshots, formatDiff, isEmpty } from "../lib/diff";
import type { Snapshot } from "../lib/types";

const SNAPSHOT_PATH = resolve(process.cwd(), "data/snapshot.json");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\nBangBuck refresh${dryRun ? " (dry run)" : ""}\n`);

  process.stdout.write("  DeepSWE  ... ");
  const deepswe = await fetchDeepSwe();
  console.log(`${deepswe.configs.length} configs, benchmark generated ${deepswe.generatedAt.slice(0, 10)}`);

  // Arena is a second opinion only. If it breaks, the DeepSWE-driven ranking must
  // still refresh, so a failure here degrades to null rather than aborting.
  process.stdout.write("  Arena    ... ");
  let arena: Snapshot["arena"] = null;
  try {
    arena = await fetchArena();
    console.log(`${arena.entries.length} entries`);
  } catch (err) {
    console.log(`FAILED (${(err as Error).message})`);
    console.log("           continuing without Arena — ranking is unaffected");
  }

  const next: Snapshot = { capturedAt: new Date().toISOString(), deepswe, arena };

  const luna = deepswe.configs.find((c) => c.model === "gpt-5-6-luna" && c.effort === "max");
  console.log(
    `\n  Live-price check: gpt-5.6-luna [max] = $${luna?.meanCostUsd.toFixed(4)} ` +
      `(stale artifact would report $3.0281)`,
  );

  if (existsSync(SNAPSHOT_PATH)) {
    const prev = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
    const d = diffSnapshots(prev, next);
    console.log(`\n  Changes vs committed snapshot:`);
    console.log(isEmpty(d) ? "    (none)" : formatDiff(d));
  } else {
    console.log("\n  No existing snapshot — this will be the first capture.");
  }

  if (dryRun) {
    console.log("\n  Dry run: nothing written.\n");
    return;
  }

  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(`\n  Wrote data/snapshot.json\n  Review the diff above, then commit.\n`);
}

main().catch((err) => {
  console.error(`\n  REFRESH FAILED: ${(err as Error).message}`);
  console.error("  data/snapshot.json was NOT modified.\n");
  process.exit(1);
});
