import snapshot from "@/data/snapshot.json";
import { Dashboard } from "@/components/Dashboard";
import type { Snapshot } from "@/lib/types";

// Fully static: the snapshot is imported at build time and nothing is fetched at
// request time, so the page cannot fail on a scrape or block on the network.
export const dynamic = "force-static";

export default function Page() {
  return <Dashboard snapshot={snapshot as unknown as Snapshot} />;
}
