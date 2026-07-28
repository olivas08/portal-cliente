import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDelta, WindowAggregator, windowEventId } from "./counter.mjs";

test("computeDelta: first read establishes a baseline (no delta)", () => {
  assert.equal(computeDelta(null, 100), 0);
  assert.equal(computeDelta(undefined, 5), 0);
});

test("computeDelta: normal forward count", () => {
  assert.equal(computeDelta(100, 107), 7);
  assert.equal(computeDelta(100, 100), 0);
});

test("computeDelta: reset to zero counts parts made since reset", () => {
  assert.equal(computeDelta(500, 3), 3);
});

test("computeDelta: register overflow wraps around the max", () => {
  // 16-bit counter 65530 -> 3: 5 to reach max, +1 to wrap, +3 = 9
  assert.equal(computeDelta(65530, 3, 65535), 9);
});

test("computeDelta: ignores garbage reads", () => {
  assert.equal(computeDelta(10, NaN), 0);
  assert.equal(computeDelta(10, -4), 0);
});

test("WindowAggregator sums per machine and drains once", () => {
  const agg = new WindowAggregator();
  agg.add("PRENSA-01", 1, 0);
  agg.add("PRENSA-01", 2, 1);
  agg.add("CNC-02", 3, 0);
  const drained = agg.drain().sort((a, b) => a.code.localeCompare(b.code));
  assert.deepEqual(drained, [
    { code: "CNC-02", good: 3, scrap: 0 },
    { code: "PRENSA-01", good: 3, scrap: 1 },
  ]);
  assert.deepEqual(agg.drain(), []); // cleared after draining
});

test("WindowAggregator skips empty buckets", () => {
  const agg = new WindowAggregator();
  agg.add("X", 0, 0);
  assert.deepEqual(agg.drain(), []);
});

test("windowEventId is stable within a window and changes across windows", () => {
  assert.equal(windowEventId("A", 10500, 5000), windowEventId("A", 12000, 5000));
  assert.notEqual(windowEventId("A", 10500, 5000), windowEventId("A", 16000, 5000));
});
