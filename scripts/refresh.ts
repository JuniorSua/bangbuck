/**
 * Re-scrapes DeepSWE, arena.ai and Artificial Analysis, then rewrites data/snapshot.json.
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
import { fetchArtificialAnalysis } from "../lib/sources/artificial-analysis";
import { diffSnapshots, formatDiff, isEmpty, snapshotUpdate, type SnapshotUpdate } from "../lib/diff";
import type { Snapshot } from "../lib/types";

const SNAPSHOT_PATH = resolve(process.cwd(), "data/snapshot.json");
const UPDATE_PATH = resolve(process.cwd(), "data/update.json");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  console.log(`\nBangBuck refresh${dryRun ? " (dry run)" : ""}\n`);

  process.stdout.write("  DeepSWE  ... ");
  const deepswe = await fetchDeepSwe();
  console.log(`${deepswe.configs.length} configs, benchmark generated ${deepswe.generatedAt.slice(0, 10)}`);

  // The WebDev board is the Craft axis, so it is load-bearing: without it there is
  // no ranking at all, only half of one. A failure here must abort rather than
  // quietly write a snapshot that scores every config on capability alone — that
  // is precisely the mistake this version exists to correct.
  process.stdout.write("  WebDev   ... ");
  const arenaWebdev = await fetchArena("webdev");
  console.log(`${arenaWebdev.entries.length} entries (Craft axis)`);

  // The general chat board is context only and never scored, so it may degrade.
  process.stdout.write("  Chat     ... ");
  let arena: Snapshot["arena"] = null;
  try {
    arena = await fetchArena("text");
    console.log(`${arena.entries.length} entries`);
  } catch (err) {
    console.log(`FAILED (${(err as Error).message})`);
    console.log("           continuing without it — ranking is unaffected");
  }

  // A second opinion, never scored — so, like Chat, it may degrade.
  process.stdout.write("  AA       ... ");
  let artificialAnalysis: Snapshot["artificialAnalysis"] = null;
  try {
    artificialAnalysis = await fetchArtificialAnalysis();
    const top = artificialAnalysis.models[0];
    console.log(`${artificialAnalysis.models.length} models, ${artificialAnalysis.codingAgents.length} coding agents; ` +
      `smartest ${top.name} [${top.effort}] ${top.intelligence.toFixed(1)}`);
  } catch (err) {
    console.log(`FAILED (${(err as Error).message})`);
    console.log("           continuing without it — ranking is unaffected");
  }

  const next: Snapshot = { capturedAt: new Date().toISOString(), deepswe, arena, arenaWebdev, artificialAnalysis };

  const luna = deepswe.configs.find((c) => c.model === "gpt-5-6-luna" && c.effort === "max");
  console.log(
    `\n  Live-price check: gpt-5.6-luna [max] = $${luna?.meanCostUsd.toFixed(4)} ` +
      `(stale artifact would report $3.0281)`,
  );

  let update: SnapshotUpdate | null = null;
  if (existsSync(SNAPSHOT_PATH)) {
    const prev = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
    const d = diffSnapshots(prev, next);
    update = snapshotUpdate(prev, next, d);
    console.log(`\n  Changes vs saved snapshot:`);
    console.log(isEmpty(d) ? "    (none)" : formatDiff(d));
  } else {
    console.log("\n  No existing snapshot — this will be the first capture.");
  }

  if (dryRun) {
    console.log("\n  Dry run: nothing written.\n");
    return;
  }

  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  // Write the summary first. The UI only displays it when capturedAt matches
  // the snapshot, so a partial write cannot attach stale news to different data.
  writeFileSync(UPDATE_PATH, JSON.stringify(update, null, 2) + "\n");
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(`\n  Wrote data/snapshot.json\n  Review the diff above, then commit.\n`);
}

main().catch((err) => {
  console.error(`\n  REFRESH FAILED: ${(err as Error).message}`);
  console.error("  data/snapshot.json was NOT modified.\n");
  process.exit(1);
});
