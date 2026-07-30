import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD,
  applyCricketHit,
  applyThreeOhOneHit,
  chooseAiTarget,
  createCricketMarks,
  createSeededRandom,
  hasClosedCricket,
  makeAiImpact,
  scoreImpact,
  targetCoordinates,
} from "../../app/game/lib/darts";

test("scores bulls and misses", () => {
  assert.equal(scoreImpact(0, 0).score, 50);
  assert.equal(scoreImpact(0, BOARD.bull + 0.03).score, 25);
  assert.equal(scoreImpact(BOARD.doubleOuter + 0.01, 0).score, 0);
});

test("scores standard wedges, doubles, and triples", () => {
  assert.deepEqual(
    { base: scoreImpact(0, 1).base, multiplier: scoreImpact(0, 1).multiplier },
    { base: 20, multiplier: 1 },
  );
  assert.equal(scoreImpact(0, 1.45).score, 60);
  assert.equal(scoreImpact(0, 2.12).score, 40);
  assert.equal(scoreImpact(1, 0).base, 6);
});

test("aim target coordinates land in the requested bed", () => {
  for (const target of [
    { base: 20, multiplier: 3 as const },
    { base: 16, multiplier: 2 as const },
    { base: 25, multiplier: 2 as const },
  ]) {
    const point = targetCoordinates(target);
    const hit = scoreImpact(point.x, point.y);
    assert.equal(hit.base, target.base);
    assert.equal(hit.multiplier, target.multiplier);
  }
});

test("cricket closure and AI checkout choices are rule-aware", () => {
  const open = createCricketMarks();
  assert.equal(hasClosedCricket(open), false);
  const closed = Object.fromEntries(Object.keys(open).map((key) => [key, 3]));
  assert.equal(hasClosedCricket(closed), true);

  assert.deepEqual(
    chooseAiTarget("301", { score: 40, marks: open }, []),
    { base: 20, multiplier: 2 },
  );
  assert.deepEqual(
    chooseAiTarget("cricket", { score: 0, marks: open }, []),
    { base: 20, multiplier: 3 },
  );
});

test("seeded CPU throws are reproducible", () => {
  const first = makeAiImpact({ base: 20, multiplier: 3 }, "pub", createSeededRandom(42));
  const second = makeAiImpact({ base: 20, multiplier: 3 }, "pub", createSeededRandom(42));
  assert.deepEqual(first, second);
});

test("301 applies busts and double-out finishes", () => {
  assert.deepEqual(
    applyThreeOhOneHit(40, 40, { score: 40, ring: "double" }, true),
    { score: 0, bust: false, won: true },
  );
  assert.deepEqual(
    applyThreeOhOneHit(40, 40, { score: 40, ring: "single" }, true),
    { score: 40, bust: true, won: false },
  );
  assert.deepEqual(
    applyThreeOhOneHit(39, 80, { score: 38, ring: "double" }, true),
    { score: 80, bust: true, won: false },
  );
});

test("cricket closes targets and awards only overflow marks", () => {
  const open = createCricketMarks();
  const first = applyCricketHit(open, 0, 20, 3, true);
  assert.equal(first.marks[20], 3);
  assert.equal(first.score, 0);

  const second = applyCricketHit(first.marks, first.score, 20, 3, true);
  assert.equal(second.marks[20], 3);
  assert.equal(second.overflow, 3);
  assert.equal(second.score, 60);

  const blocked = applyCricketHit(second.marks, second.score, 20, 3, false);
  assert.equal(blocked.score, 60);
});
