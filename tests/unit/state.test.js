import { describe, expect, it } from "vitest";
import {
  CAT_MOODS,
  FLOCK_CAP,
  KONAMI_SEQUENCE,
  MOOD_STICKERS,
  VISIT_GAP_MS,
  advanceSecretTrackers,
  countUnlockedStickers,
  createDefaultState,
  createRotator,
  mergeStoredState,
  nextCatMood,
  registerVisit,
  resolveSeason,
  resolveTimeBucket,
  selectForMoment,
  subAgentName
} from "../../src/state.js";

describe("createDefaultState", () => {
  it("creates expected baseline shape", () => {
    const state = createDefaultState();

    expect(state).not.toHaveProperty("treats");
    expect(state).not.toHaveProperty("greets");
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
      stickers: {
        oracle: true
      }
    });

    const state = mergeStoredState(raw);

    expect(state.chaos).toBe(true);
    expect(state.stickers.stoic).toBe(true);
    expect(state.stickers.oracle).toBe(true);
  });

  it("drops the retired treat and greet counts from older payloads", () => {
    const state = mergeStoredState(JSON.stringify({ treats: 40, greets: 7, laserBest: 3 }));

    expect(state).not.toHaveProperty("treats");
    expect(state).not.toHaveProperty("greets");
    expect(state.laserBest).toBe(3);
  });
});

describe("nextCatMood", () => {
  it("wakes from idle into contentment on the first tap", () => {
    expect(nextCatMood("idle", false, () => 0.99)).toBe("content");
    expect(nextCatMood("idle", true, () => 0.99)).toBe("content");
  });

  it("lets quick taps climb to annoyance", () => {
    let mood = "idle";
    for (let tap = 0; tap < 3; tap += 1) {
      mood = nextCatMood(mood, true, () => 0);
    }
    expect(mood).toBe("annoyed");
  });

  it("lets slow taps reach sleep and come back from it", () => {
    expect(nextCatMood("content", false, () => 0.99)).toBe("asleep");
    expect(nextCatMood("asleep", false, () => 0.99)).toBe("content");
  });

  it("only ever returns a known mood", () => {
    for (const mood of ["idle", ...CAT_MOODS, "unknown"]) {
      for (const quick of [false, true]) {
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
          expect(CAT_MOODS).toContain(nextCatMood(mood, quick, () => roll));
        }
      }
    }
  });

  it("maps the three mood stickers onto real moods", () => {
    for (const mood of Object.keys(MOOD_STICKERS)) {
      expect(CAT_MOODS).toContain(mood);
    }
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
