#!/usr/bin/env node
/**
 * Feature-boundary enforcement.
 *
 * Three rules, checked mechanically because documented conventions decay
 * under time pressure:
 *
 *   1. Features never import each other. map/ and insights/ are independent
 *      slices; they communicate only through the router (/parcel/:apn).
 *   2. shared/ never imports a feature. It is the leaf, not the trunk.
 *   3. Nothing deep-imports past a feature's index.ts from outside it.
 *
 * Run: npm run check:boundaries   (also runs as part of npm run build)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;
const FEATURES = ["map", "insights"];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const IMPORT_RE = /(?:from|import)\s+["']([^"']+)["']/g;
const violations = [];

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).replaceAll("\\", "/");
  const src = readFileSync(file, "utf8");
  const owner = rel.startsWith("features/") ? rel.split("/")[1] : null;

  for (const [, spec] of src.matchAll(IMPORT_RE)) {
    if (!spec.startsWith(".")) continue;

    // Resolve the specifier to a path relative to src/
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    const parts = (dir ? dir.split("/") : []).concat(spec.split("/"));
    const stack = [];
    for (const p of parts) {
      if (p === "." || p === "") continue;
      else if (p === "..") stack.pop();
      else stack.push(p);
    }
    const target = stack.join("/");

    // Rule 1 + 3: cross-feature imports
    if (target.startsWith("features/")) {
      const targetFeature = target.split("/")[1];

      if (owner && targetFeature !== owner) {
        violations.push(
          `${rel}\n    imports ${spec}\n    → features/${owner} may not import features/${targetFeature}. ` +
            `Features are independent; route through the URL instead.`,
        );
        continue;
      }
      if (!owner && rel.startsWith("shared/")) {
        violations.push(
          `${rel}\n    imports ${spec}\n    → shared/ may not import a feature. shared/ is the leaf.`,
        );
        continue;
      }
      // Rule 3: outside callers must stop at the barrel
      const depth = target.split("/").length;
      if (!owner && depth > 2) {
        violations.push(
          `${rel}\n    imports ${spec}\n    → deep import. Import from "features/${targetFeature}" (its index.ts) only.`,
        );
      }
    }

    // Rule 2 restated from the other direction
    if (rel.startsWith("shared/") && target.startsWith("features/")) {
      violations.push(`${rel}\n    imports ${spec}\n    → shared/ may not depend on a feature.`);
    }
  }
}

if (violations.length > 0) {
  console.error(`\n✗ ${violations.length} feature-boundary violation(s):\n`);
  for (const v of violations) console.error("  " + v + "\n");
  console.error("See frontend/CONTRIBUTING.md for the rules.\n");
  process.exit(1);
}

console.log(`✓ feature boundaries clean (${FEATURES.join(", ")} + shared)`);
