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

export function createDefaultState() {
  return {
    treats: 0,
    laserBest: 0,
    chaos: false,
    stickers: {
      stoic: true,
      greeting: false,
      anger: false,
      doze: false,
      oracle: false,
      laser: false,
      chaos: false,
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

    return {
      ...defaults,
      ...parsed,
      treats: Number.isFinite(parsed.treats) ? parsed.treats : defaults.treats,
      laserBest: Number.isFinite(parsed.laserBest) ? parsed.laserBest : defaults.laserBest,
      chaos: typeof parsed.chaos === "boolean" ? parsed.chaos : defaults.chaos,
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

export function applyMilestones(state) {
  const unlocked = [];

  if (state.treats >= 10 && !state.stickers.greeting) {
    state.stickers.greeting = true;
    unlocked.push("greeting");
  }

  if (state.treats >= 25 && !state.stickers.anger) {
    state.stickers.anger = true;
    unlocked.push("anger");
  }

  if (state.treats >= 50 && !state.stickers.doze) {
    state.stickers.doze = true;
    unlocked.push("doze");
  }

  return unlocked;
}

export function computeStickerProgress(state, totalOverride) {
  const stickers = state.stickers || {};
  const total =
    Number.isFinite(totalOverride) && totalOverride > 0
      ? totalOverride
      : Object.keys(stickers).length || 1;
  const unlocked = Object.values(stickers).filter(Boolean).length;

  return Math.round((unlocked / total) * 100);
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
