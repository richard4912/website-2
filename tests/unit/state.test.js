import { describe, expect, it } from "vitest";
import {
  FLOCK_CAP,
  KONAMI_SEQUENCE,
  VISIT_GAP_MS,
  advanceSecretTrackers,
  applyMilestones,
  countUnlockedStickers,
  createDefaultState,
  createRotator,
  mergeStoredState,
  registerVisit,
  resolveSeason,
  resolveTimeBucket,
  selectForMoment,
  subAgentName
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

describe("createRotator", () => {
  it("opens with the canonical first entry", () => {
    expect(createRotator(["canonical", "b", "c"])()).toBe("canonical");
  });

  it("never returns the same entry twice running", () => {
    const next = createRotator(["a", "b", "c"]);
    let previous = null;

    for (let call = 0; call < 40; call += 1) {
      const value = next();
      expect(value).not.toBe(previous);
      previous = value;
    }
  });

  it("repeats a single-entry pool rather than returning nothing", () => {
    const next = createRotator(["only"]);

    expect(next()).toBe("only");
    expect(next()).toBe("only");
  });

  it("returns null for an empty pool", () => {
    expect(createRotator([])()).toBeNull();
  });
});

describe("resolveTimeBucket", () => {
  const at = (hour) => new Date(2026, 0, 15, hour, 30);

  it("maps the day into four buckets", () => {
    expect(resolveTimeBucket(at(3))).toBe("night");
    expect(resolveTimeBucket(at(8))).toBe("morning");
    expect(resolveTimeBucket(at(14))).toBe("afternoon");
    expect(resolveTimeBucket(at(19))).toBe("evening");
    expect(resolveTimeBucket(at(23))).toBe("night");
  });

  it("closes the night bucket across midnight", () => {
    expect(resolveTimeBucket(new Date(2026, 0, 15, 22, 0))).toBe("night");
    expect(resolveTimeBucket(new Date(2026, 0, 15, 4, 59))).toBe("night");
    expect(resolveTimeBucket(new Date(2026, 0, 15, 5, 0))).toBe("morning");
  });
});

describe("resolveSeason", () => {
  it("groups December with the winter it starts", () => {
    expect(resolveSeason(new Date(2026, 11, 3))).toBe("winter");
    expect(resolveSeason(new Date(2026, 0, 3))).toBe("winter");
    expect(resolveSeason(new Date(2026, 3, 3))).toBe("spring");
    expect(resolveSeason(new Date(2026, 6, 3))).toBe("summer");
    expect(resolveSeason(new Date(2026, 9, 3))).toBe("autumn");
  });
});

describe("selectForMoment", () => {
  const pool = [
    { text: "any" },
    { text: "winter only", season: "winter" },
    { text: "night only", bucket: "night" }
  ];

  it("keeps entries that fit and unconditional entries", () => {
    const fitted = selectForMoment(pool, { bucket: "night", season: "winter" });

    expect(fitted).toHaveLength(3);
  });

  it("drops entries that do not fit", () => {
    const fitted = selectForMoment(pool, { bucket: "morning", season: "summer" });

    expect(fitted.map((entry) => entry.text)).toEqual(["any"]);
  });

  it("falls back to the whole pool when nothing fits", () => {
    const seasonal = [{ text: "winter only", season: "winter" }];

    expect(selectForMoment(seasonal, { bucket: "morning", season: "summer" })).toEqual(seasonal);
  });
});

describe("registerVisit", () => {
  it("grows the flock on a first visit", () => {
    const state = createDefaultState();

    expect(registerVisit(state, 1_000_000)).toBe(true);
    expect(state.flock).toBe(1);
    expect(state.lastVisitAt).toBe(1_000_000);
  });

  it("treats a reload as the same visit", () => {
    const state = createDefaultState();
    registerVisit(state, 1_000_000);

    expect(registerVisit(state, 1_000_000 + 60_000)).toBe(false);
    expect(state.flock).toBe(1);
  });

  it("grows once per distinct visit and stops at the cap", () => {
    const state = createDefaultState();

    for (let visit = 0; visit < FLOCK_CAP + 3; visit += 1) {
      registerVisit(state, (visit + 1) * VISIT_GAP_MS * 2);
    }

    expect(state.flock).toBe(FLOCK_CAP);
  });

  it("records the visit even when the branch is full", () => {
    const state = createDefaultState();
    state.flock = FLOCK_CAP;

    expect(registerVisit(state, 5_000_000)).toBe(false);
    expect(state.lastVisitAt).toBe(5_000_000);
  });
});

describe("subAgentName", () => {
  it("letters the branch from B in arrival order", () => {
    expect(subAgentName(1)).toBe("002-B");
    expect(subAgentName(2)).toBe("002-C");
    expect(subAgentName(FLOCK_CAP)).toBe("002-F");
  });

  it("returns null outside the branch", () => {
    expect(subAgentName(0)).toBeNull();
    expect(subAgentName(FLOCK_CAP + 1)).toBeNull();
  });
});

describe("mergeStoredState flock clamping", () => {
  it("clamps an oversized persisted flock to the cap", () => {
    expect(mergeStoredState({ flock: 99 }).flock).toBe(FLOCK_CAP);
  });

  it("rejects a negative or fractional flock", () => {
    expect(mergeStoredState({ flock: -4 }).flock).toBe(0);
    expect(mergeStoredState({ flock: 2.7 }).flock).toBe(2);
  });
});
