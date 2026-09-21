import {
  advanceSecretTrackers,
  applyMilestones,
  countUnlockedStickers,
  createDefaultState,
  mergeStoredState
} from "./state.js";

export function bootstrapGallery(doc = document, win = window) {
  const storageKey = "gallery-of-meow-state-v2";
  const totalStickers = Object.keys(createDefaultState().stickers).length;

  const pettingMoods = [
    { face: "(=^ ◡ ^=)", msg: "yes. this is acceptable." },
    { face: "/ᐠ｡ꞈ｡ᐟ\\", msg: "you may continue." },
    { face: "(=｀ω´=)", msg: "we have discussed personal space." },
    { face: "/ᐠ_ ꞈ _ᐟ\\", msg: "the exhibition is now closed. zzz." }
  ];

  // Agent 002 escalates on the persisted greet count, so a relationship accumulates
  // across visits rather than resetting. Rung 0 is the first-ever greeting.
  const greetingMoods = [
    {
      msg: "a second opinion has arrived.",
      dispatch: "Agent 002 joined without invitation.",
      outcome: "Morale increased beyond measurable limits.",
      objective: "Protect the round one."
    },
    {
      msg: "agent 002 declines to elaborate.",
      dispatch: "Second opinion filed. Unread.",
      outcome: "Round. Still round.",
      objective: "Maintain the round one."
    },
    {
      msg: "the small one has opinions about the schedule.",
      dispatch: "Agenda revised without consultation.",
      outcome: "Revision accepted unanimously. One vote cast.",
      objective: "Defer to the smaller authority."
    },
    {
      msg: "a working arrangement, apparently.",
      dispatch: "Joint operations continuing indefinitely.",
      outcome: "No end date proposed. None requested.",
      objective: "Continue as established."
    }
  ];

  // Fires instead of the ladder when the other agent was engaged moments ago. This is
  // the only place the two agents know about each other.
  const bothPresentGreeting = {
    msg: "both agents accounted for.",
    dispatch: "Both agents present. Neither in charge.",
    outcome: "Coverage complete. Supervision still absent.",
    objective: "Remain a set."
  };

  const bothPresentPetting = {
    msg: "the small one is watching you do that.",
    dispatch: "Treat requisition observed by a second party.",
    outcome: "Witnessed. Filed without comment."
  };

  const fortunes = [
    "You will find exactly one warm sunbeam and claim it.",
    "A cardboard box approaches. Greatness follows.",
    "The next snack appears when you sit dramatically.",
    "Today is excellent for strategic naps.",
    "A mysterious toe will pass nearby. You know what to do.",
    "An unopened package brings fortune and shredded paper.",
    "Your zoomies will be remembered for generations.",
    "The red dot fears your focus.",
    "A polite meow yields unreasonable rewards.",
    "Someone will call you baby in the next hour."
  ];

  const kaomoji = doc.getElementById("kaomoji");
  const speech = doc.getElementById("speech");
  const heroCat = doc.getElementById("hero-cat");
  const shimaenaga = doc.getElementById("shimaenaga");
  const objective = doc.getElementById("objective");
  const dispatch = doc.getElementById("dispatch");
  const outcome = doc.getElementById("outcome");
  const treatCount = doc.getElementById("treat-count");
  const laserBest = doc.getElementById("laser-best");
  const stickerProgress = doc.getElementById("sticker-progress");
  const stickerGallery = doc.getElementById("sticker-gallery");
  const fortuneBtn = doc.getElementById("fortune-btn");
  const laserBtn = doc.getElementById("laser-btn");
  const chaosBtn = doc.getElementById("chaos-btn");
  const fortuneBox = doc.getElementById("fortune-box");
  const fortuneText = doc.getElementById("fortune-text");
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

  if (
    !kaomoji ||
    !speech ||
    !heroCat ||
    !shimaenaga ||
    !objective ||
    !dispatch ||
    !outcome ||
    !treatCount ||
    !laserBest ||
    !stickerProgress ||
    !stickerGallery ||
    !fortuneBtn ||
    !laserBtn ||
    !chaosBtn ||
    !fortuneBox ||
    !fortuneText ||
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
    !resetStatus
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
  let petStreak = 0;
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

  function checkMilestones() {
    applyMilestones(state);
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
    treatCount.textContent = String(state.treats);
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
    checkMilestones();
    updateHud();
    updateStickerGallery();
  }

  function petCat() {
    state.treats += 1;
    const now = win.performance.now();
    const withCompany = engagedRecently(lastGreetAt, now);
    if (now - lastPetAt > COMPANY_WINDOW_MS) {
      petStreak = 0;
    }
    lastPetAt = now;
    const mood = pettingMoods[Math.min(Math.floor(petStreak / 3), pettingMoods.length - 1)];
    petStreak += 1;
    kaomoji.textContent = mood.face;
    speech.textContent = mood.msg;
    if (petStreak === 17) {
      kaomoji.textContent = "(=ↀωↀ=)";
      speech.textContent = "something only cats can see.";
    } else if (withCompany) {
      speech.textContent = bothPresentPetting.msg;
    }
    if (withCompany) {
      updateDossier(
        bothPresentPetting.dispatch,
        bothPresentPetting.outcome,
        "Operate as a pair."
      );
    } else {
      const dossierOutcome =
        petStreak >= 10
          ? "Execution deferred indefinitely."
          : petStreak >= 7
            ? "Personal-space policy invoked."
            : "Compensation accepted without review.";
      updateDossier(
        "Treat requisition approved by recipient.",
        dossierOutcome,
        petStreak >= 10 ? "Remain unavailable until further notice." : "Acquire additional affection."
      );
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

  function readFortune() {
    const fortune = randomFrom(fortunes);
    fortuneText.textContent = fortune;
    fortuneBox.hidden = false;
    fortuneBtn.setAttribute("aria-expanded", "true");
    speech.textContent = "the oracle has spoken";
    updateDossier(
      "Forecasting delegated. Oversight bypassed.",
      fortune,
      "Act on unverifiable information."
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
      speech.textContent = "you caught the dot!";
      unlockSticker("laser");
      updateDossier(
        "Moving target containment concluded.",
        `${laserGame.score} dots contained. No paperwork filed.`,
        "Maintain tactical readiness."
      );
    } else {
      laserStatus.textContent = "The dot has other appointments.";
      speech.textContent = "we shall pretend that never happened.";
      updateDossier(
        "Moving target containment concluded.",
        "Target escaped. Report classified as success.",
        "Avoid accountability."
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
      "Moving target containment initiated.",
      "Pursuit in progress.",
      "Neutralize the red dot."
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
  function greetAgentTwo() {
    const now = win.performance.now();
    const withCompany = engagedRecently(lastPetAt, now);
    lastGreetAt = now;

    const rung = Math.min(Math.floor(state.greets / 3), greetingMoods.length - 1);
    const mood = withCompany ? bothPresentGreeting : greetingMoods[rung];
    state.greets += 1;

    speech.textContent = mood.msg;
    updateDossier(mood.dispatch, mood.outcome, mood.objective);
    saveState();
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
      speech.textContent = "this is why museums have rules.";
      updateDossier(
        "Incident authorized by incident.",
        "Incident created successfully.",
        "Increase entropy."
      );
    } else {
      win.clearTimeout(incidentTimeout);
      doc.body.classList.remove("chaos-igniting");
      speech.textContent = "calm restored";
      updateDossier(
        "Evidence rearranged into a straight line.",
        "Incident declared intentional.",
        "Appear professional."
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
      resetStatus.textContent = "This clears treats, scores, incidents, and discoveries.";
      resetConfirmTimeout = win.setTimeout(() => disarmReset(), 6000);
      return;
    }

    win.localStorage.removeItem(storageKey);
    win.clearTimeout(incidentTimeout);
    doc.body.classList.remove("chaos-igniting");
    state = createDefaultState();
    previousUnlocked = new Set();
    petStreak = 0;
    lastPetAt = 0;
    lastGreetAt = 0;
    kaomoji.textContent = "/ᐠ｡ꞈ｡ᐟ\\";
    speech.textContent = "the evidence has been professionally misplaced.";
    updateDossier(
      "Records removed without authorization.",
      "No evidence found. Excellent work.",
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

  render();
  setLaserReadout(0, 5);
  win.console.log("Cat Operations v2 loaded. Two agents on file. No human found.");
}
