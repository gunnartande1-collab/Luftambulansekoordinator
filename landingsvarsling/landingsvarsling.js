
/* ==========================================
   LANDINGSVARSEL RH
   ========================================== */

(() => {
  "use strict";

  const TOTAL_SECONDS = 180;
  const ALERT_SECONDS = 90;
  const REPEAT_ALARM_MS = 8000;

  const $ = id => document.getElementById(id);

  const timerDisplay = $("timerDisplay");
  const timerCard = document.querySelector(
    ".lv-timer-card"
  );

  const progressBar = $("progressBar");
  const progressTrack = document.querySelector(
    ".lv-progress"
  );

  const alarmMessage = $("alarmMessage");
  const ackButton = $("ackButton");

  const startButton = $("startButton");
  const stopButton = $("stopButton");
  const resetButton = $("resetButton");
  const testSoundButton = $("testSoundButton");
  const themeButton = $("themeButton");

  let remainingMs = TOTAL_SECONDS * 1000;
  let running = false;
  let starting = false;
  let lastStartTime = null;

  let alertTriggered = false;
  let alertAcknowledged = false;
  let startedOnce = false;

  let intervalId = null;
  let lastAlarmSoundTime = 0;

  let audioContext = null;


  /* ======================================
     TIDSBEREGNING
     ====================================== */

  function currentRemainingMs() {

    if (!running) {
      return remainingMs;
    }

    const elapsed =
      performance.now() - lastStartTime;

    return remainingMs - elapsed;
  }


  function formatTime(milliseconds) {

    const totalSeconds = Math.trunc(
      Math.abs(milliseconds) / 1000
    );

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const seconds = totalSeconds % 60;

    const sign =
      milliseconds <= -1000 ? "−" : "";

    return (
      sign +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }


  /* ======================================
     LYD
     ====================================== */

  async function initializeAudio() {

    try {

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        console.warn(
          "Lyd støttes ikke i nettleseren."
        );
        return false;
      }

      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      return audioContext.state === "running";

    } catch (error) {

      console.warn(
        "Lyd kunne ikke startes:",
        error
      );

      return false;
    }
  }


  function playTone(
    frequency,
    start,
    duration,
    volume
  ) {

    if (
      !audioContext ||
      audioContext.state !== "running"
    ) {
      return;
    }

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(
      0.0001,
      start
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      start + 0.025
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    oscillator.start(start);
    oscillator.stop(
      start + duration + 0.02
    );
  }


  async function playDoorbell() {

    const available =
      await initializeAudio();

    if (!available) {
      return;
    }

    const now = audioContext.currentTime;

    // Første DING

    playTone(880, now, 0.9, 0.27);
    playTone(1320, now, 0.7, 0.10);

    // Første DONG

    playTone(
      659.25,
      now + 0.55,
      1.3,
      0.30
    );

    playTone(
      987.77,
      now + 0.55,
      1.0,
      0.09
    );

    // Andre DING

    playTone(
      880,
      now + 1.9,
      0.9,
      0.27
    );

    playTone(
      1320,
      now + 1.9,
      0.7,
      0.10
    );

    // Andre DONG

    playTone(
      659.25,
      now + 2.45,
      1.3,
      0.30
    );

    playTone(
      987.77,
      now + 2.45,
      1.0,
      0.09
    );
  }


  /* ======================================
     VARSLING
     ====================================== */

  function triggerAlarm() {

    if (alertTriggered) {
      return;
    }

    alertTriggered = true;
    alertAcknowledged = false;

    lastAlarmSoundTime = performance.now();

    playDoorbell();

    updateDisplay();
  }


  function acknowledgeAlarm() {

    alertAcknowledged = true;

    updateDisplay();
  }


  /* ======================================
     OPPDATER KLOKKEN
     ====================================== */

  function updateDisplay() {

    const ms = currentRemainingMs();

    timerDisplay.textContent =
      formatTime(ms);

    const elapsed =
      TOTAL_SECONDS * 1000 - ms;

    const percent = Math.min(
      100,
      Math.max(
        0,
        elapsed /
          (TOTAL_SECONDS * 1000) *
          100
      )
    );

    progressBar.style.width =
      percent + "%";

    if (progressTrack) {
      progressTrack.setAttribute(
        "aria-valuenow",
        String(Math.round(percent))
      );
    }

    // Vis alarm til den blir kvittert.

    const alarmActive =
      alertTriggered &&
      !alertAcknowledged;

    timerCard.classList.toggle(
      "alarm-active",
      alarmActive
    );

    alarmMessage.hidden =
      !alarmActive;

    ackButton.hidden =
      !alarmActive;

    // Marker overtid visuelt.

    timerCard.classList.toggle(
      "timer-overtime",
      ms < -1000 &&
      !alarmActive
    );

    // Start / stopp-knapper.

    startButton.disabled =
      running || starting;

    stopButton.disabled =
      !running;

    if (running) {

      startButton.textContent =
        "▶ Pågår";

    } else if (startedOnce) {

      startButton.textContent =
        "▶ Fortsett";

    } else {

      startButton.textContent =
        "▶ Start";

    }

    // Klokken vises også i vindustittelen.

    document.title =
      formatTime(ms) +
      " | Landingsvarsel RH";
  }


  /* ======================================
     TIMER
     ====================================== */

  function tick() {

    if (!running) {
      return;
    }

    const ms = currentRemainingMs();

    // Utløs alarm ved første passering
    // av 01:30.

    if (
      ms <= ALERT_SECONDS * 1000 &&
      !alertTriggered
    ) {
      triggerAlarm();
    }

    // Gjenta alarmen hvert 8. sekund
    // til varselet er kvittert.

    if (
      alertTriggered &&
      !alertAcknowledged &&
      performance.now() -
        lastAlarmSoundTime >=
        REPEAT_ALARM_MS
    ) {

      lastAlarmSoundTime =
        performance.now();

      playDoorbell();
    }

    updateDisplay();
  }


  async function startTimer() {

    if (running || starting) {
      return;
    }

    starting = true;
    startButton.disabled = true;

    // Forsøk å aktivere lyd fra brukerklikket.

    try {
      await initializeAudio();
    } finally {
      starting = false;
    }

    if (running) {
      return;
    }

    running = true;
    startedOnce = true;

    lastStartTime =
      performance.now();

    clearInterval(intervalId);

    intervalId = setInterval(
      tick,
      100
    );

    updateDisplay();
  }


  function stopTimer() {

    if (!running) {
      return;
    }

    remainingMs =
      currentRemainingMs();

    running = false;
    lastStartTime = null;

    clearInterval(intervalId);
    intervalId = null;

    updateDisplay();
  }


  function resetTimer() {

    clearInterval(intervalId);
    intervalId = null;

    running = false;
    startedOnce = false;

    remainingMs =
      TOTAL_SECONDS * 1000;

    lastStartTime = null;

    alertTriggered = false;
    alertAcknowledged = false;

    lastAlarmSoundTime = 0;

    updateDisplay();
  }


  /* ======================================
     DAG- OG NATTMODUS
     ====================================== */

  function applyTheme(theme) {

    const dark =
      theme === "dark";

    document.body.classList.toggle(
      "dark-mode",
      dark
    );

    themeButton.textContent =
      dark ? "☀" : "☾";

    themeButton.setAttribute(
      "aria-label",
      dark
        ? "Slå på dagmodus"
        : "Slå på nattmodus"
    );

    try {

      localStorage.setItem(
        "luftambulanse-theme",
        theme
      );

    } catch {
      // Tema fungerer uten lagring.
    }
  }


  let savedTheme = "light";

  try {

    savedTheme =
      localStorage.getItem(
        "luftambulanse-theme"
      ) || "light";

  } catch {
    savedTheme = "light";
  }

  applyTheme(
    savedTheme === "dark"
      ? "dark"
      : "light"
  );


  themeButton.addEventListener(
    "click",
    () => {

      const dark =
        document.body.classList.contains(
          "dark-mode"
        );

      applyTheme(
        dark ? "light" : "dark"
      );
    }
  );


  /* ======================================
     KNAPPER
     ====================================== */

  startButton.addEventListener(
    "click",
    startTimer
  );

  stopButton.addEventListener(
    "click",
    stopTimer
  );

  resetButton.addEventListener(
    "click",
    resetTimer
  );

  ackButton.addEventListener(
    "click",
    acknowledgeAlarm
  );

  testSoundButton.addEventListener(
    "click",
    playDoorbell
  );


  /* ======================================
     INITIALISERING
     ====================================== */

  updateDisplay();

  // Oppdater etter at vinduet har
  // vært i bakgrunnen.

  document.addEventListener(
    "visibilitychange",
    () => {
      tick();
    }
  );

  window.addEventListener(
    "focus",
    tick
  );

})();
