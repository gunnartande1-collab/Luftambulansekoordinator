
/* ==========================================
   LANDINGSVARSEL REDNINGSHELIKOPTER
   LA OSLO
   ========================================== */

(() => {
  "use strict";

  /* ======================================
     INNSTILLINGER
     ====================================== */

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
  const resetButton = $("resetButton");
  const testSoundButton = $("testSoundButton");

  /* ======================================
     TILSTAND
     ====================================== */

  let remainingMs = TOTAL_SECONDS * 1000;

  let running = false;
  let starting = false;
  let lastStartTime = null;

  let alertTriggered = false;
  let alertAcknowledged = false;

  let intervalId = null;
  let lastAlarmSoundTime = 0;

  let audioContext = null;
  let timerGeneration = 0;

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
     INITIALISER LYD
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

  /* ======================================
     GENERER LYDTONE
     ====================================== */

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

  /* ======================================
     DØRKLOKKELYD
     ====================================== */

  async function playDoorbell() {

    const generation = timerGeneration;

    const available =
      await initializeAudio();

    if (!available) {
      return;
    }

    if (generation !== timerGeneration) {
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
     UTLØS ALARM
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

  /* ======================================
     KVITTER ALARM
     ====================================== */

  function acknowledgeAlarm() {

    alertAcknowledged = true;

    updateDisplay();
  }

  /* ======================================
     OPPDATER VISNING
     ====================================== */

  function updateDisplay() {

    const ms = currentRemainingMs();

    timerDisplay.textContent =
      formatTime(ms);

    // Beregn fremdrift.

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

    // Alarmstatus.

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

    // Overtid.

    timerCard.classList.toggle(
      "timer-overtime",
      ms < -1000 &&
      !alarmActive
    );

    // Startknapp.

    startButton.disabled =
      running || starting;

    startButton.textContent =
      running
        ? "▶ Pågår"
        : "▶ Start";

    // Vis tid i nettleserfanen.

    document.title =
      formatTime(ms) +
      " | Landingsvarsel RH";
  }

  /* ======================================
     NEDTELLING
     ====================================== */

  function tick() {

    if (!running) {
      return;
    }

    const ms = currentRemainingMs();

    // Varsling ved 01:30.

    if (
      ms <= ALERT_SECONDS * 1000 &&
      !alertTriggered
    ) {

      triggerAlarm();
    }

    // Gjenta lyd hvert 8. sekund
    // frem til brukeren kvitterer.

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

  /* ======================================
     START TIMER
     ====================================== */

  async function startTimer() {

    if (running || starting) {
      return;
    }

    starting = true;
    startButton.disabled = true;

    const generation = timerGeneration;

    try {

      // Aktiver lyd ved brukerklikk.

      await initializeAudio();

    } catch (error) {

      console.warn(
        "Kunne ikke initialisere lyd:",
        error
      );

    } finally {

      starting = false;
    }

    // Unngå oppstart dersom timeren
    // ble nullstilt i mellomtiden.

    if (
      running ||
      generation !== timerGeneration
    ) {

      updateDisplay();
      return;
    }

    running = true;

    lastStartTime =
      performance.now();

    clearInterval(intervalId);

    intervalId = setInterval(
      tick,
      100
    );

    updateDisplay();
  }

  /* ======================================
     NULLSTILL TIMER
     ====================================== */

  function resetTimer() {

    timerGeneration++;

    clearInterval(intervalId);
    intervalId = null;

    running = false;
    starting = false;

    remainingMs =
      TOTAL_SECONDS * 1000;

    lastStartTime = null;

    alertTriggered = false;
    alertAcknowledged = false;

    lastAlarmSoundTime = 0;

    updateDisplay();
  }

  /* ======================================
     KNAPPER
     ====================================== */

  startButton.addEventListener(
    "click",
    startTimer
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

  // Oppdater når nettleservinduet
  // blir aktivt igjen.

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
