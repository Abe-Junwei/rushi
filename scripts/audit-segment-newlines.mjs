#!/usr/bin/env node
/**
 * Audit SegmentDto[].text for embedded newlines.
 * Usage:
 *   node scripts/audit-segment-newlines.mjs path/to/segments.json
 *   node scripts/audit-segment-newlines.mjs path/to/file-detail.json  # { segments: [...] }
 *
 * Does not mutate data. Prints hit count / rate for research §7.
 */
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node scripts/audit-segment-newlines.mjs <segments.json|file-detail.json>");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const segments = Array.isArray(raw) ? raw : Array.isArray(raw?.segments) ? raw.segments : null;
if (!segments) {
  console.error("Expected an array of segments or an object with .segments");
  process.exit(2);
}

const hits = [];
for (let i = 0; i < segments.length; i++) {
  const text = String(segments[i]?.text ?? "");
  const newlineCount = (text.match(/\r\n|\n|\r/g) ?? []).length;
  if (newlineCount > 0) {
    hits.push({
      idx: i,
      uid: segments[i]?.uid,
      newlineCount,
      textLength: text.length,
    });
  }
}

const report = {
  source: path,
  totalSegments: segments.length,
  hitCount: hits.length,
  hitRate: segments.length === 0 ? 0 : hits.length / segments.length,
  sampleHits: hits.slice(0, 20),
};

console.log(JSON.stringify(report, null, 2));
