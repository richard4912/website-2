import {
  advanceSecretTrackers,
  applyMilestones,
  computeStickerProgress,
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
  const coords = doc.getElementById("coords");
  const heroCat = doc.getElementById("hero-cat");
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

  if (
    !kaomoji ||
    !speech ||
    !coords ||
    !heroCat ||
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
    !neonCat
  ) {
    return;
  }

  const state = mergeStoredState(win.localStorage.getItem(storageKey));

  const laserGame = {
    running: false,
    score: 0,
    startAt: 0,
    moveInterval: null,
    tickInterval: null
  };

  let typedBuffer = "";
  let konamiIndex = 0;
  let secretTimeout = null;
  let petStreak = 0;
  let lastPetAt = 0;
  let petAnimationTimeout = null;
  const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");

  function saveState() {
    win.localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
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
      card.setAttribute("aria-disabled", unlocked ? "false" : "true");
    });
  }

  function updateHud() {
    treatCount.textContent = String(state.treats);
    laserBest.textContent = String(state.laserBest);
    stickerProgress.textContent = `${computeStickerProgress(state, totalStickers)}%`;

    doc.body.classList.toggle("chaos-mode", state.chaos);
    chaosBtn.setAttribute("aria-pressed", state.chaos ? "true" : "false");
    chaosBtn.textContent = state.chaos ? "Restore a little dignity" : "Cause a little trouble";
  }

  function render() {
    checkMilestones();
    updateHud();
    updateStickerGallery();
  }

  function petCat() {
    state.treats += 1;
    const now = win.performance.now();
    if (now - lastPetAt > 12000) {
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
    }
    if (!reducedMotion.matches) {
      win.clearTimeout(petAnimationTimeout);
      kaomoji.style.transform = "scale(0.96) rotate(2deg)";
      petAnimationTimeout = win.setTimeout(() => {
        kaomoji.style.transform = "";
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
    unlockSticker("oracle");
    render();
    saveState();
  }

  function placeLaserDot() {
    const arenaRect = laserArena.getBoundingClientRect();
    const dotSize = laserDot.offsetWidth;
    const maxX = Math.max(0, arenaRect.width - dotSize);
    const maxY = Math.max(0, arenaRect.height - dotSize);
    const x = Math.round(Math.random() * maxX);
    const y = Math.round(Math.random() * maxY);
    laserDot.style.left = `${x}px`;
    laserDot.style.top = `${y}px`;
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

    if (laserGame.score >= 6) {
      laserStatus.textContent = "A distinguished dot catcher.";
      speech.textContent = "you caught the dot!";
      unlockSticker("laser");
    } else {
      laserStatus.textContent = "The dot has other appointments.";
      speech.textContent = "we shall pretend that never happened.";
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
    laserBtn.disabled = true;
    laserDot.hidden = false;
    laserStatus.textContent = "Catch the dot. You have five seconds.";
    setLaserReadout(0, 5);
    placeLaserDot();

    laserGame.moveInterval = win.setInterval(placeLaserDot, 550);
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
      unlockSticker("chaos");
      speech.textContent = "this is why museums have rules.";
    } else {
      speech.textContent = "calm restored";
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
    placeLaserDot();
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

  if (win.matchMedia("(pointer: fine)").matches) {
    doc.addEventListener("mousemove", (event) => {
      coords.textContent = `X: ${event.clientX} Y: ${event.clientY}`;
      if (!reducedMotion.matches) {
        const x = (0.5 - event.clientX / win.innerWidth) * 12;
        const y = (0.5 - event.clientY / win.innerHeight) * 8;
        kaomoji.parentElement.style.transform = `translate(${x}px, ${y}px)`;
      }
    });
  } else {
    coords.textContent = "X: touch Y: touch";
  }

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
  win.console.log("Gallery of Meow v2 loaded.");
}
