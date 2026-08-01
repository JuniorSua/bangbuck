import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is fully static: all data comes from the committed snapshot in
  // data/snapshot.json. Nothing is fetched at request time.

  // A verification build must never write into the dev server's .next: it
  // replaces the chunks dev is actively serving and the running page dies with
  // "Cannot find module './873.js'". `npm run build:check` sets this so the two
  // can coexist.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Pin the workspace root. If a stray lockfile exists anywhere above this
  // directory, Next infers that ancestor as the root and traces files from
  // there, which bloats the deployment bundle.
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
