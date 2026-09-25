export const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a"
];

// The branch is the joke's limit. Five sub-agents is what the perch holds at 390px,
// and a swarm would trade the delegation gag for a crowd.
export const FLOCK_CAP = 5;

// Two loads a minute apart are one visit; tomorrow morning is another. Without a gap
// this wide, a reload would count as a visit and the branch would fill in seconds.
export const VISIT_GAP_MS = 30 * 60 * 1000;

export function createDefaultState() {
  return {
    laserBest: 0,
    chaos: false,
    flock: 0,
    lastVisitAt: 0,
    stickers: {
      stoic: true,
      greeting: false,
      anger: false,
      doze: false,
      oracle: false,
      laser: false,
      chaos: false,
      stillness: false,
      secret: false
    },
    secretsFound: {
      meow: false,
      konami: false
    }
  };
}

function parseRawState(raw) {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    return JSON.parse(raw);
  }

  if (typeof raw === "object") {
    return raw;
  }

  return null;
}

export function mergeStoredState(raw) {
  const defaults = createDefaultState();

  try {
    const parsed = parseRawState(raw);
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    // Older payloads carry treat and greet counts. Nothing reads them any more, so they
    // are dropped here rather than written back on every save forever.
    const { treats: _treats, greets: _greets, ...rest } = parsed;

    return {
      ...defaults,
      ...rest,
      laserBest: Number.isFinite(parsed.laserBest) ? parsed.laserBest : defaults.laserBest,
      chaos: typeof parsed.chaos === "boolean" ? parsed.chaos : defaults.chaos,
      // Clamped on read, not only on write: a hand-edited or older payload must not be
      // able to put more birds on the branch than the perch can hold.
      flock: Number.isFinite(parsed.flock)
        ? Math.min(FLOCK_CAP, Math.max(0, Math.trunc(parsed.flock)))
        : defaults.flock,
      lastVisitAt: Number.isFinite(parsed.lastVisitAt) ? parsed.lastVisitAt : defaults.lastVisitAt,
      stickers: {
        ...defaults.stickers,
        ...(parsed.stickers || {})
      },
      secretsFound: {
        ...defaults.secretsFound,
        ...(parsed.secretsFound || {})
      }
    };
  } catch {
    return defaults;
  }
}

// Agent 001 has a mood rather than a counter. Each tap moves it along this table, so
// what a tap does depends on how the cat is and how fast you are, never on how many
// taps came before. Quick taps lean toward annoyance; slow ones toward calm or sleep.
// Each row is [mood, weight]; with random() at 0 the first entry wins.
export const QUICK_TAP_MS = 900;

const MOOD_TABLE = {
  idle: { slow: [["content", 1]], quick: [["content", 1]] },
  content: {
    slow: [["content", 0.5], ["tolerant", 0.3], ["asleep", 0.2]],
    quick: [["tolerant", 0.6], ["content", 0.4]]
  },
  tolerant: {
    slow: [["content", 0.5], ["tolerant", 0.3], ["asleep", 0.2]],
    quick: [["annoyed", 0.6], ["tolerant", 0.4]]
  },
  annoyed: {
    slow: [["tolerant", 0.5], ["content", 0.3], ["annoyed", 0.2]],
    quick: [["annoyed", 0.8], ["tolerant", 0.2]]
  },
  asleep: {
    slow: [["asleep", 0.5], ["content", 0.5]],
    quick: [["asleep", 0.6], ["annoyed", 0.4]]
  }
};

export const CAT_MOODS = Object.keys(MOOD_TABLE).filter((mood) => mood !== "idle");

export function nextCatMood(mood, quick, random = Math.random) {
  const row = (MOOD_TABLE[mood] || MOOD_TABLE.idle)[quick ? "quick" : "slow"];
  let roll = random();
  for (const [next, weight] of row) {
    if (roll < weight) {
      return next;
    }
    roll -= weight;
  }
  return row[row.length - 1][0];
}

// The three stickers that used to sit behind treat thresholds now mark the first time
// the cat is seen in each mood.
export const MOOD_STICKERS = {
  content: "greeting",
  annoyed: "anger",
  asleep: "doze"
};

export function countUnlockedStickers(state) {
  return Object.values(state.stickers || {}).filter(Boolean).length;
}

// The dossier is the only feedback surface in the viewport, so a cell that renders the
// text it already held reads as a dropped click. Every pooled cell draws through this:
// it excludes the previous value rather than trusting the shuffle not to repeat.
//
// The first draw is the pool's first entry. Each rung's canonical line is therefore
// still the one a reader meets first, and only the repeats vary.
export function createRotator(pool, random = Math.random) {
  const entries = Array.isArray(pool) ? pool.slice() : [];
  let previous = null;
  let drawn = false;

  return function next() {
    if (entries.length === 0) {
      return null;
    }
    if (!drawn) {
      drawn = true;
      previous = entries[0];
      return previous;
    }
    const candidates = entries.length > 1 ? entries.filter((entry) => entry !== previous) : entries;
    const chosen = candidates[Math.floor(random() * candidates.length)];
    previous = chosen;
    return chosen;
  };
}

// Coarse enough that the copy stays writable: four buckets, not twenty-four hours.
export function resolveTimeBucket(date) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 22) {
    return "night";
  }
  if (hour < 12) {
    return "morning";
  }
  if (hour < 17) {
    return "afternoon";
  }
  return "evening";
}

// Northern-hemisphere meteorological seasons. December belongs to the winter that ends
// in the next calendar year, which is why it groups with January rather than November.
export function resolveSeason(date) {
  const month = date.getMonth();
  if (month === 11 || month <= 1) {
    return "winter";
  }
  if (month <= 4) {
    return "spring";
  }
  if (month <= 7) {
    return "summer";
  }
  return "autumn";
}

// Filters to the entries that fit the moment, then falls back to the whole pool rather
// than returning nothing. A season with no written fortunes must still forecast.
export function selectForMoment(pool, { bucket, season }) {
  const fitted = pool.filter((entry) => {
    if (entry.bucket && entry.bucket !== bucket) {
      return false;
    }
    if (entry.season && entry.season !== season) {
      return false;
    }
    return true;
  });

  return fitted.length > 0 ? fitted : pool;
}

// Mutates and reports, because the caller needs both the new count and whether this
// load earned a bird. Returns false at the cap so the caller can say so instead.
export function registerVisit(state, nowMs, gapMs = VISIT_GAP_MS) {
  const returning = state.lastVisitAt > 0 && nowMs - state.lastVisitAt <= gapMs;
  state.lastVisitAt = nowMs;

  if (returning || state.flock >= FLOCK_CAP) {
    return false;
  }

  state.flock += 1;
  return true;
}

// 002 keeps her number; the birds she files to are lettered from B. Index 1 is the
// first sub-agent, so the branch reads 002-B, 002-C, … in arrival order.
export function subAgentName(index) {
  const position = Math.trunc(index);
  if (position < 1 || position > FLOCK_CAP) {
    return null;
  }
  return `002-${String.fromCharCode(65 + position)}`;
}

export function advanceSecretTrackers(trackers, key) {
  const typedBufferInput = typeof trackers?.typedBuffer === "string" ? trackers.typedBuffer : "";
  const konamiInput = Number.isInteger(trackers?.konamiIndex) ? trackers.konamiIndex : 0;
  const normalizedKey = typeof key === "string" ? key : "";

  let typedBuffer = typedBufferInput;
  let konamiIndex = konamiInput;
  let meowMatched = false;
  let konamiMatched = false;

  if (normalizedKey.length === 1) {
    typedBuffer = (typedBuffer + normalizedKey.toLowerCase()).slice(-12);
    if (typedBuffer.includes("meow")) {
      typedBuffer = "";
      meowMatched = true;
    }
  }

  if (normalizedKey.toLowerCase() === KONAMI_SEQUENCE[konamiIndex].toLowerCase()) {
    konamiIndex += 1;
    if (konamiIndex === KONAMI_SEQUENCE.length) {
      konamiIndex = 0;
      konamiMatched = true;
    }
  } else {
    konamiIndex = normalizedKey.toLowerCase() === KONAMI_SEQUENCE[0].toLowerCase() ? 1 : 0;
  }

  return {
    typedBuffer,
    konamiIndex,
    meowMatched,
    konamiMatched
  };
}
