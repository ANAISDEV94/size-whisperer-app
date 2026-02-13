/**
 * Unit tests for interval distance and tie-breaking logic.
 * Run with: deno test supabase/functions/recommend-size/interval_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Inline implementations (mirrors index.ts) ──────────────────

function intervalDistance(uMin: number, uMax: number, sMin: number, sMax: number): number {
  if (uMax < sMin) return sMin - uMax;
  if (sMax < uMin) return uMin - sMax;
  return 0;
}

function overlapAmount(uMin: number, uMax: number, sMin: number, sMax: number): number {
  return Math.max(0, Math.min(uMax, sMax) - Math.max(uMin, sMin));
}

interface ScoreEntry {
  size: string;
  score: number;
  matched: number;
  totalOverlap: number;
}

function sortScores(entries: ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.matched !== b.matched) return b.matched - a.matched;
    return b.totalOverlap - a.totalOverlap;
  });
}

// ── intervalDistance tests ───────────────────────────────────────

Deno.test("intervalDistance: full overlap returns 0", () => {
  assertEquals(intervalDistance(30, 34, 32, 36), 0);
});

Deno.test("intervalDistance: contained returns 0", () => {
  assertEquals(intervalDistance(33, 34, 30, 36), 0);
});

Deno.test("intervalDistance: user below target", () => {
  assertEquals(intervalDistance(28, 29, 30, 32), 1);
});

Deno.test("intervalDistance: user above target", () => {
  assertEquals(intervalDistance(35, 37, 30, 33), 2);
});

Deno.test("intervalDistance: touching edges returns 0", () => {
  assertEquals(intervalDistance(28, 30, 30, 32), 0);
});

Deno.test("intervalDistance: single-point intervals", () => {
  assertEquals(intervalDistance(34, 34, 34, 34), 0);
  assertEquals(intervalDistance(34, 34, 36, 36), 2);
});

// ── overlapAmount tests ─────────────────────────────────────────

Deno.test("overlapAmount: partial overlap", () => {
  assertEquals(overlapAmount(30, 34, 32, 36), 2);
});

Deno.test("overlapAmount: no overlap", () => {
  assertEquals(overlapAmount(28, 29, 30, 32), 0);
});

Deno.test("overlapAmount: contained", () => {
  assertEquals(overlapAmount(32, 34, 30, 36), 2);
});

Deno.test("overlapAmount: touching edges", () => {
  assertEquals(overlapAmount(28, 30, 30, 32), 0);
});

// ── Tie-breaking tests ──────────────────────────────────────────

Deno.test("tie-break: lower score wins", () => {
  const sorted = sortScores([
    { size: "M", score: 1.0, matched: 2, totalOverlap: 0 },
    { size: "S", score: 0.5, matched: 2, totalOverlap: 0 },
  ]);
  assertEquals(sorted[0].size, "S");
});

Deno.test("tie-break: same score, higher matched wins", () => {
  const sorted = sortScores([
    { size: "M", score: 0.5, matched: 2, totalOverlap: 0 },
    { size: "L", score: 0.5, matched: 3, totalOverlap: 0 },
  ]);
  assertEquals(sorted[0].size, "L");
});

Deno.test("tie-break: same score + matched, higher overlap wins", () => {
  const sorted = sortScores([
    { size: "M", score: 0, matched: 3, totalOverlap: 2 },
    { size: "S", score: 0, matched: 3, totalOverlap: 4 },
  ]);
  assertEquals(sorted[0].size, "S");
});
