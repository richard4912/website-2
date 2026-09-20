import { describe, expect, it } from "vitest";
import {
  KONAMI_SEQUENCE,
  advanceSecretTrackers,
  applyMilestones,
  countUnlockedStickers,
  createDefaultState,
  mergeStoredState
} from "../../src/state.js";

describe("createDefaultState", () => {
  it("creates expected baseline shape", () => {
    const state = createDefaultState();

    expect(state.treats).toBe(0);
    expect(state.greets).toBe(0);
    expect(state.laserBest).toBe(0);
    expect(state.chaos).toBe(false);
    expect(state.stickers.stoic).toBe(true);
    expect(state.stickers.greeting).toBe(false);
    expect(state.secretsFound.meow).toBe(false);
    expect(state.secretsFound.konami).toBe(false);
  });
});

describe("mergeStoredState", () => {
  it("falls back to defaults on corrupt payload", () => {
    const state = mergeStoredState("{not-valid-json}");

    expect(state).toEqual(createDefaultState());
  });

  it("merges persisted chaos and nested keys", () => {
    const raw = JSON.stringify({
      chaos: true,
      treats: 11,
      stickers: {
        oracle: true
      }
    });

    const state = mergeStoredState(raw);

    expect(state.chaos).toBe(true);
    expect(state.treats).toBe(11);
    expect(state.stickers.stoic).toBe(true);
    expect(state.stickers.oracle).toBe(true);
  });

  it("restores a persisted greet count and rejects a non-numeric one", () => {
    expect(mergeStoredState(JSON.stringify({ greets: 7 })).greets).toBe(7);
    expect(mergeStoredState(JSON.stringify({ greets: "lots" })).greets).toBe(0);
  });
});

describe("applyMilestones", () => {
  it("unlocks stickers at 10, 25, and 50 treats", () => {
    const state = createDefaultState();

    state.treats = 9;
    expect(applyMilestones(state)).toEqual([]);
    expect(state.stickers.greeting).toBe(false);

    state.treats = 10;
    expect(applyMilestones(state)).toEqual(["greeting"]);
    expect(state.stickers.greeting).toBe(true);

    state.treats = 25;
    expect(applyMilestones(state)).toEqual(["anger"]);
    expect(state.stickers.anger).toBe(true);

    state.treats = 50;
    expect(applyMilestones(state)).toEqual(["doze"]);
    expect(state.stickers.doze).toBe(true);
  });
});

describe("countUnlockedStickers", () => {
  it("counts unlocked entries", () => {
    const state = createDefaultState();

    expect(countUnlockedStickers(state)).toBe(1);

    state.stickers.greeting = true;
    state.stickers.anger = true;

    expect(countUnlockedStickers(state)).toBe(3);
  });

  it("tolerates a state with no stickers map", () => {
    expect(countUnlockedStickers({})).toBe(0);
  });
});

describe("advanceSecretTrackers", () => {
  it("detects meow sequence from typed buffer", () => {
    let trackers = {
      typedBuffer: "",
      konamiIndex: 0
    };

    trackers = advanceSecretTrackers(trackers, "m");
    trackers = advanceSecretTrackers(trackers, "e");
    trackers = advanceSecretTrackers(trackers, "o");
    trackers = advanceSecretTrackers(trackers, "w");

    expect(trackers.meowMatched).toBe(true);
    expect(trackers.typedBuffer).toBe("");
  });

  it("detects full Konami sequence", () => {
    let trackers = {
      typedBuffer: "",
      konamiIndex: 0
    };

    for (const key of KONAMI_SEQUENCE) {
      trackers = advanceSecretTrackers(trackers, key);
    }

    expect(trackers.konamiMatched).toBe(true);
    expect(trackers.konamiIndex).toBe(0);
  });
});
