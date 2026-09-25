import {
  FLOCK_CAP,
  MOOD_STICKERS,
  QUICK_TAP_MS,
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
} from "./state.js";

export function bootstrapGallery(doc = document, win = window) {
  const storageKey = "gallery-of-meow-state-v2";
  const totalStickers = Object.keys(createDefaultState().stickers).length;

  const now = new Date(win.Date.now());
  const timeBucket = resolveTimeBucket(now);
  const season = resolveSeason(now);

  // Every cell a repeated tap can land on draws from a pool, because the dossier
  // rendering the text it already held is indistinguishable from a dropped click. The
  // voice is observational: say what the animal did, and let the reader supply the joke.
  // Speech lines stay under ~28 characters; the bubble is two lines wide on a phone.
  const catMoods = {
    content: {
      face: "(=^ ◡ ^=)",
      speech: createRotator([
        "slow blink.",
        "a small purr, then none.",
        "leans in. slightly.",
        "eyes half closed.",
        "that spot, apparently.",
        "a long, satisfied exhale.",
        "kneads the air, once.",
        "chin up. go on.",
        "the purr gets louder.",
        "turns the other cheek."
      ]),
      dispatch: createRotator([
        "Contact made. Received well.",
        "Accepted without looking up.",
        "Chin, briefly. No objection.",
        "Petted. Filed as routine.",
        "Ears scratched. Both of them.",
        "Offered a cheek. Took it."
      ]),
      outcome: createRotator([
        "Purring, at low volume.",
        "Settled a little further in.",
        "Nothing said. Nothing needed.",
        "Eyes closed. Not asleep.",
        "Tail wrapped around paws."
      ]),
      objective: createRotator(["Stay put.", "Keep the spot warm.", "Remain available.", "Continue, gently."])
    },
    tolerant: {
      face: "/ᐠ｡ꞈ｡ᐟ\\",
      speech: createRotator([
        "one ear turns away.",
        "watching your hand.",
        "fine. briefly.",
        "a look, then nothing.",
        "allowed. not invited.",
        "the purr stops.",
        "looks at the door.",
        "a slow, careful blink."
      ]),
      dispatch: createRotator([
        "Allowed, under observation.",
        "Hand monitored throughout.",
        "Permitted. Not encouraged.",
        "Received. Not returned.",
        "Contact noted, not welcomed."
      ]),
      outcome: createRotator([
        "Tail tip moving.",
        "Patience holding, for now.",
        "Attention mostly elsewhere.",
        "Still here. Undecided.",
        "One eye on the exit."
      ]),
      objective: createRotator(["Keep an eye on the hand.", "Reserve judgement.", "Wait and see."])
    },
    annoyed: {
      face: "(=｀ω´=)",
      speech: createRotator([
        "ears back.",
        "the tail is going.",
        "a paw on your wrist.",
        "that was one too many.",
        "a flat, level stare.",
        "a short, sharp mrrp.",
        "skin twitches.",
        "turns to face you."
      ]),
      dispatch: createRotator([
        "Contact exceeded terms.",
        "Paw applied to wrist.",
        "Pace of petting noted.",
        "Warning issued. Verbally.",
        "Tail lashing on record."
      ]),
      outcome: createRotator([
        "No claws. This time.",
        "Grace period over.",
        "Relocation under consideration.",
        "Teeth shown, not used.",
        "Your hand has been noted."
      ]),
      objective: createRotator(["Restore some distance.", "Slow down.", "Let it cool off."])
    },
    asleep: {
      face: "/ᐠ_ ꞈ _ᐟ\\",
      speech: createRotator([
        "asleep.",
        "didn't wake.",
        "one paw twitches.",
        "a sigh. still asleep.",
        "deeper, if anything.",
        "whiskers flicker.",
        "curls tighter.",
        "a small snore."
      ]),
      dispatch: createRotator([
        "Petted while asleep.",
        "Contact made. No response.",
        "Out cold.",
        "Stirred. Did not wake.",
        "Dreaming. Legs involved."
      ]),
      outcome: createRotator([
        "Snoring, faintly.",
        "No memory of this will be kept.",
        "Unavailable until further notice.",
        "Warmer than before.",
        "Still asleep."
      ]),
      objective: createRotator(["Let it sleep.", "Keep your voice down.", "Tiptoe."])
    }
  };

  // The dossier's opening triplet. Morning matches the markup in index.html, so the
  // served HTML is one real bucket rather than a fourth state nobody ever sees.
  const idleDossier = {
    night: {
      objective: "Hold the warm spot until morning.",
      dispatch: "Night shift. Nobody assigned it.",
      outcome: "The building is ours."
    },
    morning: {
      objective: "Occupy the warmest rectangle.",
      dispatch: "No request received. Proceeding anyway.",
      outcome: "Pending, with confidence."
    },
    afternoon: {
      objective: "Follow the sunbeam west.",
      dispatch: "The light moved at four. We moved.",
      outcome: "Position improved. Nobody consulted."
    },
    evening: {
      objective: "Supervise the kitchen.",
      dispatch: "Dinner is being watched closely.",
      outcome: "Progress reported as slow."
    }
  };

  // Agent 002 has no ladder: each greeting is its own small event. Her first line is
  // the pool's first entry, so a first visit still meets her the same way.
  const birdGreeting = {
    speech: createRotator([
      "she fluffs up.",
      "a tiny chirp.",
      "hops once. sideways.",
      "she was already here.",
      "a sideways glance.",
      "rounder than before.",
      "no comment from the branch.",
      "tail flick. that's all.",
      "she tilts her head.",
      "a soft tsip.",
      "feathers settle.",
      "blinks, very small.",
      "turns to face you. round.",
      "shuffles along the branch.",
      "wind. she holds on."
    ]),
    dispatch: createRotator([
      "Agent 002 acknowledged you.",
      "Greeting returned. Barely.",
      "One chirp, no context.",
      "She moved along the branch.",
      "Eight grams, fully attentive.",
      "Head tilted. Reason unclear.",
      "A look from the branch.",
      "She preened instead."
    ]),
    outcome: createRotator([
      "Still round.",
      "No further comment.",
      "Back to watching the window.",
      "Roundness unchanged.",
      "Slightly fluffier.",
      "Grip on the branch firm.",
      "Nothing else to report."
    ]),
    objective: createRotator(["Stay round.", "Hold the branch.", "Watch the window.", "Keep warm."])
  };

  // Fires instead of the usual line when the other agent was engaged moments ago. This
  // is the only place the two agents know about each other.
  const bothPresentGreeting = {
    speech: createRotator([
      "both of them, watching you.",
      "the cat saw that.",
      "two agents, one window."
    ]),
    dispatch: createRotator([
      "Both agents present. Neither in charge.",
      "Both on duty. No chain of command.",
      "Two agents, one sunbeam."
    ]),
    outcome: createRotator([
      "Full coverage. Of one sunbeam.",
      "Nothing is happening, jointly.",
      "They exchanged a look."
    ]),
    objective: createRotator(["Remain a set.", "Stay a matching pair."])
  };

  const bothPresentPetting = {
    speech: createRotator([
      "the small one is watching.",
      "observed from the branch.",
      "002 saw that."
    ]),
    dispatch: createRotator([
      "Petting had a witness.",
      "Observed from the perch.",
      "A witness was present."
    ]),
    outcome: createRotator([
      "Seen. No comment offered.",
      "Noted from above. Nothing said.",
      "Observed. Comment withheld."
    ])
  };

  // Both agents forecast. 001 reads rooms, furniture and food; 002 is eight grams of
  // bird and reads weather, branches and the merits of sitting still. The byline is
  // half the joke, so every fortune carries the agent who filed it.
  // A forecast tagged with a bucket or season is only drawn when it fits. Untagged
  // entries always qualify, which is what keeps every month and hour forecastable.
  const fortunes = [
    { from: "001", text: "The sunbeam will move at four. Follow it. Clear your afternoon.", bucket: "morning" },
    { from: "001", text: "A box arrives today. It will be one size too small and you will fit anyway." },
    { from: "001", text: "Sit near the cupboard and look through it. The snack situation resolves itself." },
    { from: "001", text: "Someone will hold a door open for you. Consider it. Take your time." },
    { from: "001", text: "You will be called baby before dinner, in that voice, in front of company.", bucket: "evening" },
    { from: "001", text: "The warmest surface is the one already covered in paperwork." },
    { from: "001", text: "One object leaves one shelf tonight. You will choose it correctly.", bucket: "night" },
    { from: "001", text: "The red dot gets careless around the fourth minute." },
    { from: "001", text: "The radiator comes on at six. Be on it at five.", season: "winter" },
    { from: "001", text: "The floor tiles are the correct temperature today. Lie on them.", season: "summer" },
    { from: "002", text: "Snow tonight. Roost early, eat twice, stay round.", season: "winter" },
    { from: "002", text: "You weigh eight grams. Behave accordingly." },
    { from: "002", text: "The branch will hold. It has held every time so far." },
    { from: "002", text: "Good news is coming. Details will not be provided." },
    { from: "002", text: "Sit very still. Everything you want is about to walk past you." },
    { from: "002", text: "Fluff up. The forecast is unkind and you are not.", season: "winter" },
    { from: "002", text: "The blossom is temporary and so are you. Sit in it anyway.", season: "spring" },
    { from: "002", text: "Too warm to be this round. You will manage.", season: "summer" },
    { from: "002", text: "Everything is falling. None of it is your fault.", season: "autumn" },
    { from: "002", text: "Light goes early now. Say what you mean before four.", season: "autumn" },
    { from: "002", text: "First light is yours. Nobody else is awake to claim it.", bucket: "morning" }
  ];

  const kaomoji = doc.getElementById("kaomoji");
  const speech = doc.getElementById("speech");
  const heroCat = doc.getElementById("hero-cat");
  const shimaenaga = doc.getElementById("shimaenaga");
  const flockEl = doc.getElementById("flock");
  const objective = doc.getElementById("objective");
  const dispatch = doc.getElementById("dispatch");
  const outcome = doc.getElementById("outcome");
  const laserBest = doc.getElementById("laser-best");
  const stickerProgress = doc.getElementById("sticker-progress");
  const stickerGallery = doc.getElementById("sticker-gallery");
  const fortuneBtn = doc.getElementById("fortune-btn");
  const laserBtn = doc.getElementById("laser-btn");
  const chaosBtn = doc.getElementById("chaos-btn");
  const fortuneBox = doc.getElementById("fortune-box");
  const fortuneText = doc.getElementById("fortune-text");
  const fortuneSource = doc.getElementById("fortune-source");
  const fortuneClose = doc.getElementById("fortune-close");
  const laserPanel = doc.getElementById("laser-game");
  const laserClose = doc.getElementById("laser-close");
  const laserArena = doc.getElementById("laser-arena");
  const laserDot = doc.getElementById("laser-dot");
  const laserStatus = doc.getElementById("laser-status");
  const laserScore = doc.getElementById("laser-score");
  const laserTime = doc.getElementById("laser-time");
  const secretBanner = doc.getElementById("secret-banner");
  const neonCat = doc.getElementById("neon-cat");
  const resetBtn = doc.getElementById("reset-btn");
  const resetStatus = doc.getElementById("reset-status");
  const dossierStamp = doc.getElementById("dossier-stamp");

  if (
    !kaomoji ||
    !speech ||
    !heroCat ||
    !shimaenaga ||
    !flockEl ||
    !objective ||
    !dispatch ||
    !outcome ||
    !laserBest ||
    !stickerProgress ||
    !stickerGallery ||
    !fortuneBtn ||
    !laserBtn ||
    !chaosBtn ||
    !fortuneBox ||
    !fortuneText ||
    !fortuneSource ||
    !fortuneClose ||
    !laserPanel ||
    !laserClose ||
    !laserArena ||
    !laserDot ||
    !laserStatus ||
    !laserScore ||
    !laserTime ||
    !secretBanner ||
    !neonCat ||
    !resetBtn ||
    !resetStatus ||
    !dossierStamp
  ) {
    return;
  }

  let state = mergeStoredState(win.localStorage.getItem(storageKey));

  const laserGame = {
    running: false,
    score: 0,
    startAt: 0,
    dotX: null,
    dotY: null,
    moveInterval: null,
    tickInterval: null
  };

  let typedBuffer = "";
  let konamiIndex = 0;
  let secretTimeout = null;
  let incidentTimeout = null;
  let catMood = "idle";
  let lastPetAt = 0;
  let lastGreetAt = 0;
  let petAnimationTimeout = null;
  let shimaenagaAnimationTimeout = null;
  let resetConfirmTimeout = null;
  let resetArmed = false;
  let previousUnlocked = new Set(
    Object.entries(state.stickers)
      .filter(([, unlocked]) => Boolean(unlocked))
      .map(([id]) => id)
  );
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");

  // Nobody approves anything here, so the stamp is the paperwork approving itself.
  const stampWords = createRotator([
    "UNREVIEWED",
    "FILED",
    "NO OBJECTION RECEIVED",
    "SELF-CERTIFIED",
    "RETURNED TO SENDER"
  ]);

  function updateDossier(nextDispatch, nextOutcome, nextObjective) {
    if (nextObjective) {
      objective.textContent = nextObjective;
    }
    if (nextDispatch) {
      dispatch.textContent = nextDispatch;
    }
    if (nextOutcome) {
      outcome.textContent = nextOutcome;
    }

    // Restamping here rather than at each call site means every action that reports a
    // result also gets a non-textual acknowledgement, which is the signal a
    // reduced-motion visitor would otherwise be missing.
    dossierStamp.textContent = stampWords();
    dossierStamp.classList.remove("restamped");
    void dossierStamp.offsetWidth;
    dossierStamp.classList.add("restamped");
  }

  function saveState() {
    win.localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  const COMPANY_WINDOW_MS = 12000;

  // A timestamp of 0 means "never engaged". Without this guard a fresh page load
  // would read as "engaged moments ago", because performance.now() starts near zero.
  function engagedRecently(timestamp, now) {
    return timestamp > 0 && now - timestamp <= COMPANY_WINDOW_MS;
  }

  function unlockSticker(id, message) {
    if (state.stickers[id]) {
      return;
    }
    state.stickers[id] = true;
    if (message) {
      speech.textContent = message;
    }
  }

  function updateStickerGallery() {
    const cards = stickerGallery.querySelectorAll(".gallery-item");
    cards.forEach((card) => {
      const id = card.dataset.sticker;
      const unlocked = Boolean(state.stickers[id]);
      card.classList.toggle("locked", !unlocked);
      if (unlocked && !previousUnlocked.has(id)) {
        card.classList.remove("just-unlocked");
        void card.offsetWidth;
        card.classList.add("just-unlocked");
      }
    });
    previousUnlocked = new Set(
      Object.entries(state.stickers)
        .filter(([, unlocked]) => Boolean(unlocked))
        .map(([id]) => id)
    );
  }

  function updateHud() {
    laserBest.textContent = String(state.laserBest);
    stickerProgress.textContent = `${countUnlockedStickers(state)} OF ${totalStickers}`;

    doc.body.classList.toggle("chaos-mode", state.chaos);
    chaosBtn.setAttribute("aria-pressed", state.chaos ? "true" : "false");
    const chaosCopy = chaosBtn.querySelector(".control-copy");
    if (chaosCopy) {
      chaosCopy.textContent = state.chaos ? "Pretend this was intentional" : "Authorize own incident";
    }
  }

  function render() {
    updateHud();
    updateStickerGallery();
    renderFlock();
  }

  // Rare enough to be a sighting rather than a feature. Checked against the top of the
  // range so a stubbed random() of 0 never produces it.
  const STARE_CHANCE = 0.03;

  function petCat() {
    const now = win.performance.now();
    const withCompany = engagedRecently(lastGreetAt, now);
    const quick = lastPetAt > 0 && now - lastPetAt < QUICK_TAP_MS;
    lastPetAt = now;
    catMood = nextCatMood(catMood, quick);
    const mood = catMoods[catMood];

    kaomoji.textContent = mood.face;
    speech.textContent = withCompany ? bothPresentPetting.speech() : mood.speech();
    if (catMood !== "asleep" && Math.random() > 1 - STARE_CHANCE) {
      kaomoji.textContent = "(=ↀωↀ=)";
      speech.textContent = "staring at nothing. intently.";
    }
    if (withCompany) {
      updateDossier(bothPresentPetting.dispatch(), bothPresentPetting.outcome(), "Operate as a pair.");
    } else {
      updateDossier(mood.dispatch(), mood.outcome(), mood.objective());
    }
    const sticker = MOOD_STICKERS[catMood];
    if (sticker) {
      unlockSticker(sticker);
    }
    if (!reducedMotion.matches) {
      win.clearTimeout(petAnimationTimeout);
      kaomoji.style.setProperty("--squash", "0.96");
      kaomoji.style.setProperty("--tilt", "2deg");
      petAnimationTimeout = win.setTimeout(() => {
        kaomoji.style.removeProperty("--squash");
        kaomoji.style.removeProperty("--tilt");
      }, 140);
    }
    render();
    saveState();
  }

  // An oracle that repeats itself twice running reads as broken rather than mystical,
  // so the last fortune is excluded from the draw instead of trusting the shuffle.
  let lastFortune = null;

  function drawFortune() {
    const inSeason = selectForMoment(fortunes, { bucket: timeBucket, season });
    const pool = inSeason.filter((entry) => entry !== lastFortune);
    const fortune = randomFrom(pool.length > 0 ? pool : inSeason);
    lastFortune = fortune;
    return fortune;
  }

  function readFortune() {
    const fortune = drawFortune();
    const fromBird = fortune.from === "002";
    fortuneText.textContent = fortune.text;
    // Once she delegates, her forecasts carry a sub-agent's byline. The byline already
    // existed, so the whole joke costs one string.
    const byline =
      fromBird && state.flock > 0 && Math.random() < DELEGATION_CHANCE
        ? subAgentName(1 + Math.floor(Math.random() * state.flock))
        : fortune.from;
    fortuneSource.textContent = `FORECAST · AGENT ${byline}`;
    fortuneBox.hidden = false;
    fortuneBtn.setAttribute("aria-expanded", "true");
    speech.textContent = fromBird ? "the small one checked the sky." : "001 has a feeling.";
    updateDossier(
      fromBird ? "The small one filed a forecast." : "Forecast filed. Nobody asked for one.",
      fortune.text,
      "Act on it immediately."
    );
    unlockSticker("oracle");
    render();
    saveState();
  }

  // A dot that teleports anywhere is a test of mouse speed. A dot that scurries a
  // bounded distance and bounces off the walls is an argument you can actually win.
  // Being caught startles it further, so catches cannot be chained on the spot.
  const LASER_STEP_MIN = 60;
  const LASER_STEP_MAX = 150;
  const LASER_STARTLED_MIN = 240;
  const LASER_STARTLED_MAX = 430;
  // Tuned against a simulated player with distance-proportional travel time: a quick
  // player clears this reliably, an average one usually, a distracted one rarely.
  const LASER_UNLOCK_SCORE = 5;

  function reflectIntoRange(value, max) {
    if (max <= 0) {
      return 0;
    }
    let reflected = value < 0 ? -value : value;
    if (reflected > max) {
      reflected = max - (reflected - max);
    }
    return Math.min(max, Math.max(0, reflected));
  }

  function randomStep(startled) {
    const min = startled ? LASER_STARTLED_MIN : LASER_STEP_MIN;
    const max = startled ? LASER_STARTLED_MAX : LASER_STEP_MAX;
    const magnitude = min + Math.random() * (max - min);
    return Math.random() < 0.5 ? -magnitude : magnitude;
  }

  function placeLaserDot(startled = false) {
    const arenaRect = laserArena.getBoundingClientRect();
    const dotSize = laserDot.offsetWidth;
    const maxX = Math.max(0, arenaRect.width - dotSize);
    const maxY = Math.max(0, arenaRect.height - dotSize);

    let x;
    let y;
    if (laserGame.dotX === null || laserGame.dotY === null) {
      x = Math.random() * maxX;
      y = Math.random() * maxY;
    } else {
      x = laserGame.dotX + randomStep(startled);
      y = laserGame.dotY + randomStep(startled);
    }

    laserGame.dotX = reflectIntoRange(x, maxX);
    laserGame.dotY = reflectIntoRange(y, maxY);
    laserDot.style.left = `${Math.round(laserGame.dotX)}px`;
    laserDot.style.top = `${Math.round(laserGame.dotY)}px`;
  }

  function setLaserReadout(score, secondsLeft) {
    laserScore.textContent = `Score: ${score}`;
    laserTime.textContent = `Time: ${secondsLeft.toFixed(1)}s`;
  }

  function endLaserGame() {
    if (!laserGame.running) {
      return;
    }
    laserGame.running = false;
    win.clearInterval(laserGame.moveInterval);
    win.clearInterval(laserGame.tickInterval);
    laserGame.moveInterval = null;
    laserGame.tickInterval = null;
    laserDot.hidden = true;
    laserBtn.disabled = false;
    setLaserReadout(laserGame.score, 0);

    if (laserGame.score > state.laserBest) {
      state.laserBest = laserGame.score;
    }

    if (laserGame.score >= LASER_UNLOCK_SCORE) {
      laserStatus.textContent = "A distinguished dot catcher.";
      speech.textContent = "the dot is handled.";
      unlockSticker("laser");
      updateDossier(
        "The dot has been dealt with.",
        `${laserGame.score} caught. The dot disputes the count.`,
        "Stay ready."
      );
    } else {
      laserStatus.textContent = "The dot has other appointments.";
      speech.textContent = "the dot will be back.";
      updateDossier(
        "The dot has been dealt with.",
        "The dot escaped. This is being called a success.",
        "Move on quickly."
      );
    }

    render();
    saveState();
  }

  function startLaserGame() {
    if (laserGame.running) {
      return;
    }
    laserGame.running = true;
    laserPanel.hidden = false;
    laserBtn.setAttribute("aria-expanded", "true");
    laserGame.score = 0;
    laserGame.startAt = win.performance.now();
    laserGame.dotX = null;
    laserGame.dotY = null;
    laserBtn.disabled = true;
    laserDot.hidden = false;
    laserStatus.textContent = "Catch the dot. You have five seconds.";
    updateDossier(
      "The red dot is out.",
      "Pursuit underway.",
      "Catch the dot."
    );
    setLaserReadout(0, 5);
    placeLaserDot();

    laserGame.moveInterval = win.setInterval(() => placeLaserDot(), 520);
    laserGame.tickInterval = win.setInterval(() => {
      const elapsed = (win.performance.now() - laserGame.startAt) / 1000;
      const left = Math.max(0, 5 - elapsed);
      setLaserReadout(laserGame.score, left);
      if (left <= 0) {
        endLaserGame();
      }
    }, 40);
  }

  function triggerSecretBanner(text) {
    if (secretTimeout) {
      win.clearTimeout(secretTimeout);
    }
    secretBanner.textContent = text;
    secretBanner.hidden = false;
    neonCat.hidden = false;
    secretTimeout = win.setTimeout(() => {
      secretBanner.hidden = true;
      neonCat.hidden = true;
    }, 2300);
  }

  function unlockSecret(type, message) {
    if (!state.secretsFound[type]) {
      state.secretsFound[type] = true;
      triggerSecretBanner(message);
    }
    if (Object.values(state.secretsFound).some(Boolean)) {
      unlockSticker("secret", "Secret sticker unlocked.");
    }
    render();
    saveState();
  }

  heroCat.addEventListener("click", petCat);

  // Once she has sub-agents she sometimes files the request onward instead of
  // answering. The way a small agent becomes a large one is not by getting bigger.
  const DELEGATION_CHANCE = 0.35;
  const delegationSpeech = createRotator([
    "she has people for this.",
    "passed down the branch.",
    "handed to a sub-agent."
  ]);

  function renderFlock() {
    if (flockEl.childElementCount === state.flock) {
      return;
    }
    flockEl.replaceChildren();
    for (let position = 1; position <= state.flock; position += 1) {
      const bird = doc.createElement("img");
      bird.src = "assets/agent-002.webp";
      bird.alt = "";
      flockEl.append(bird);
    }
  }

  function delegate() {
    const filedTo = subAgentName(1 + Math.floor(Math.random() * state.flock));
    // The cycle is the funny place for delegation to bottom out, and it needs two
    // birds to be a cycle rather than a bird talking to itself.
    if (state.flock >= 3 && Math.random() < 0.5) {
      const first = subAgentName(state.flock - 1);
      const second = subAgentName(state.flock);
      return {
        dispatch: `${first} delegated to ${second}.`,
        outcome: `${second} delegated to ${first}.`,
        objective: "Await the outcome."
      };
    }
    return {
      dispatch: `${filedTo} handled it.`,
      outcome: `${filedTo} filed it onward. No recipient named.`,
      objective: "Await the outcome."
    };
  }

  function greetAgentTwo() {
    const now = win.performance.now();
    const withCompany = engagedRecently(lastPetAt, now);
    // She answers the first greeting of a visit herself. Delegating it would mean a
    // first-time visitor's first tap on her reports only a sub-agent they have not met.
    const firstThisVisit = lastGreetAt === 0;
    lastGreetAt = now;

    if (withCompany) {
      speech.textContent = bothPresentGreeting.speech();
      updateDossier(bothPresentGreeting.dispatch(), bothPresentGreeting.outcome(), bothPresentGreeting.objective());
      return;
    }

    if (!firstThisVisit && state.flock > 0 && Math.random() < DELEGATION_CHANCE) {
      const filing = delegate();
      speech.textContent = state.flock >= FLOCK_CAP ? "the branch is full." : delegationSpeech();
      updateDossier(filing.dispatch, filing.outcome, filing.objective);
      return;
    }

    speech.textContent = birdGreeting.speech();
    updateDossier(birdGreeting.dispatch(), birdGreeting.outcome(), birdGreeting.objective());
  }

  shimaenaga.addEventListener("click", () => {
    greetAgentTwo();
    win.clearTimeout(shimaenagaAnimationTimeout);
    shimaenaga.classList.remove("celebrating");
    void shimaenaga.offsetWidth;
    shimaenaga.classList.add("celebrating");
    shimaenagaAnimationTimeout = win.setTimeout(() => {
      shimaenaga.classList.remove("celebrating");
    }, 700);
  });

  // The laser rewards frantic clicking, so Agent 002 gets its inverse. Long enough to
  // be a decision, short enough to happen by accident once, which is how anyone will
  // find it. Any input at all resets it: the whole mechanic is not doing anything.
  const STILLNESS_MS = 7000;
  const stillnessArrival = createRotator([
    "Agent 002 left the perch while nobody moved.",
    "The perch is empty. She is closer than that.",
    "She crossed the page during the quiet."
  ]);
  let stillnessTimer = null;
  let stillnessPointer = null;

  function releaseStillness() {
    if (!shimaenaga.classList.contains("arrived")) {
      return;
    }
    shimaenaga.classList.remove("arrived");
    shimaenaga.style.removeProperty("--arrive-x");
    shimaenaga.style.removeProperty("--arrive-y");
  }

  function arriveFromStillness() {
    if (shimaenaga.classList.contains("arrived") || doc.hidden) {
      return;
    }

    // Transform-only, measured from her resting box, so the band's layout never moves.
    if (stillnessPointer) {
      const rest = shimaenaga.getBoundingClientRect();
      shimaenaga.style.setProperty("--arrive-x", `${Math.round(stillnessPointer.x - (rest.left + rest.width / 2))}px`);
      shimaenaga.style.setProperty("--arrive-y", `${Math.round(stillnessPointer.y - (rest.top + rest.height / 2))}px`);
    }
    win.clearTimeout(shimaenagaAnimationTimeout);
    shimaenaga.classList.remove("celebrating");
    shimaenaga.classList.add("arrived");

    speech.textContent = "you stopped moving. she noticed.";
    updateDossier(
      stillnessArrival(),
      "Approach completed unobserved.",
      "Hold still a little longer."
    );
    unlockSticker("stillness");
    render();
    saveState();
  }

  function restartStillness() {
    releaseStillness();
    win.clearTimeout(stillnessTimer);
    stillnessTimer = win.setTimeout(arriveFromStillness, STILLNESS_MS);
  }

  for (const eventName of ["pointerdown", "wheel", "scroll", "keydown", "touchstart"]) {
    doc.addEventListener(eventName, restartStillness, { passive: true });
  }
  doc.addEventListener("mousemove", (event) => {
    stillnessPointer = { x: event.clientX, y: event.clientY };
    restartStillness();
  });
  // A dwell on focus is the keyboard and touch equivalent: she cannot be a feature that
  // only exists for people holding a mouse.
  shimaenaga.addEventListener("focus", restartStillness);
  doc.addEventListener("visibilitychange", () => {
    if (doc.hidden) {
      win.clearTimeout(stillnessTimer);
      releaseStillness();
    } else {
      restartStillness();
    }
  });
  restartStillness();

  fortuneBtn.addEventListener("click", readFortune);
  fortuneClose.addEventListener("click", () => {
    fortuneBox.hidden = true;
    fortuneBtn.setAttribute("aria-expanded", "false");
    fortuneBtn.focus();
  });
  laserBtn.addEventListener("click", startLaserGame);
  laserClose.addEventListener("click", () => {
    endLaserGame();
    laserPanel.hidden = true;
    laserBtn.setAttribute("aria-expanded", "false");
    laserBtn.focus();
  });
  chaosBtn.addEventListener("click", () => {
    state.chaos = !state.chaos;
    if (state.chaos) {
      // "Authorize own incident" promises an event, so fire one before settling into
      // the persistent skin. The animation itself is CSS, so the global
      // prefers-reduced-motion block suppresses it without a second code path.
      win.clearTimeout(incidentTimeout);
      doc.body.classList.remove("chaos-igniting");
      void doc.body.offsetWidth;
      doc.body.classList.add("chaos-igniting");
      incidentTimeout = win.setTimeout(() => {
        doc.body.classList.remove("chaos-igniting");
      }, 900);
      unlockSticker("chaos");
      speech.textContent = "something fell. on purpose.";
      updateDossier(
        "One incident, self-authorized.",
        "Everything is where it landed.",
        "Rearrange the room."
      );
    } else {
      win.clearTimeout(incidentTimeout);
      doc.body.classList.remove("chaos-igniting");
      speech.textContent = "tidied. mostly.";
      updateDossier(
        "The evidence has been lined up neatly.",
        "The incident is now intentional.",
        "Look composed."
      );
    }
    render();
    saveState();
  });

  function catchDot() {
    if (!laserGame.running) {
      return;
    }
    laserGame.score += 1;
    setLaserReadout(laserGame.score, Math.max(0, 5 - (win.performance.now() - laserGame.startAt) / 1000));
    placeLaserDot(true);
  }

  laserDot.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      catchDot();
    }
  });
  laserDot.addEventListener("click", (event) => {
    if (event.detail === 0 || event.pointerType !== "mouse") {
      catchDot();
    }
  });

  if (win.matchMedia("(pointer: fine)").matches && !reducedMotion.matches) {
    let driftFrame = null;
    doc.addEventListener("mousemove", (event) => {
      const { clientX, clientY } = event;
      if (driftFrame !== null) {
        return;
      }
      driftFrame = win.requestAnimationFrame(() => {
        driftFrame = null;
        const x = (0.5 - clientX / win.innerWidth) * 5;
        const y = (0.5 - clientY / win.innerHeight) * 4;
        kaomoji.style.setProperty("--drift-x", `${x}px`);
        kaomoji.style.setProperty("--drift-y", `${y}px`);
      });
    });
  }

  function disarmReset(message = "") {
    win.clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = null;
    resetArmed = false;
    resetBtn.textContent = "Erase evidence";
    resetBtn.classList.remove("confirming");
    resetStatus.textContent = message;
  }

  resetBtn.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      resetBtn.textContent = "Confirm disappearance";
      resetBtn.classList.add("confirming");
      resetStatus.textContent = "This clears scores, incidents, and discoveries.";
      resetConfirmTimeout = win.setTimeout(() => disarmReset(), 6000);
      return;
    }

    win.localStorage.removeItem(storageKey);
    win.clearTimeout(incidentTimeout);
    doc.body.classList.remove("chaos-igniting");
    state = createDefaultState();
    previousUnlocked = new Set();
    catMood = "idle";
    lastPetAt = 0;
    lastGreetAt = 0;
    kaomoji.textContent = "/ᐠ｡ꞈ｡ᐟ\\";
    speech.textContent = "as if nothing happened.";
    updateDossier(
      "Records misplaced. Convincingly.",
      "Nothing on file. Excellent work.",
      "Occupy the warmest rectangle."
    );
    render();
    saveState();
    disarmReset("Case file erased.");
  });

  doc.addEventListener("keydown", (event) => {
    const progress = advanceSecretTrackers(
      {
        typedBuffer,
        konamiIndex
      },
      event.key
    );

    typedBuffer = progress.typedBuffer;
    konamiIndex = progress.konamiIndex;

    if (progress.meowMatched) {
      unlockSecret("meow", "Secret phrase accepted.");
    }

    if (progress.konamiMatched) {
      unlockSecret("konami", "Konami Cat awakened.");
    }
  });

  // The opening triplet is the one piece of dossier text a visitor reads without
  // clicking anything, so it answers to the clock rather than staying frozen at the
  // markup's morning. Petting or greeting overwrites it immediately, as before.
  const idle = idleDossier[timeBucket];
  if (idle) {
    updateDossier(idle.dispatch, idle.outcome, idle.objective);
  }

  // The branch is the one thing on the page that differs because time passed rather
  // than because the visitor did something. A reload is the same visit; tomorrow is not.
  if (registerVisit(state, win.Date.now())) {
    saveState();
  }

  render();
  setLaserReadout(0, 5);
  win.console.log("Cat Operations v2. Two agents on file. Mind the keyboard.");
}
