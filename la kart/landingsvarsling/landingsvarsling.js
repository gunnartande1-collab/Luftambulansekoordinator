
/* ==========================================
   LANDINGSVARSEL RH
   Luftambulansekoordinator

   03:00 - Start
   01:30 - Aktiver landingsvarsel
   00:00 - Forventet landing
   -00:01 - Overtid
   ========================================== */

(() => {
  "use strict";

  const TOTAL_SECONDS = 180;
  const ALERT_SECONDS = 90;

  const $ = id => document.getElementById(id);

  const timerDisplay = $("timerDisplay");
  const timerCard = document.querySelector(".lv-timer-card");
  const statusBadge = $("statusBadge");
  const statusText = $("statusText");
  const progressBar = $("progressBar");

  const alarmMessage = $("alarmMessage");
  const ackButton = $("ackButton");

  const startButton = $("startButton");
  const stopButton = $("stopButton");
  const resetButton = $("resetButton");
  const testSoundButton = $("testSoundButton");
  const audioStatus = $("audioStatus");
  const themeButton = $("themeButton");

  let remainingMs = TOTAL_SECONDS * 1000;
  let running = false;
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

    const elapsed = performance.now() - lastStartTime;

    return remainingMs - elapsed;
  }

  function formatTime(milliseconds) {
    // Avrunding mot null gir 00:00 i selve
    // sekundet rundt forventet landing.
    const totalSeconds = Math.trunc(
      Math.abs(milliseconds) / 1000
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const sign = milliseconds <= -1000 ? "−" : "";

    return sign +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");
  }

  /* ======================================
     LYD
     Dørklokke: to toner med etterklang
     ====================================== */

  async function initializeAudio() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        audioStatus.textContent =
          "⚠ Lyd støttes ikke i nettleseren";
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
      console.warn("Lyd kunne ikke startes:", error);
      audioStatus.textContent =
        "⚠ Lyd utilgjengelig – kontroller PC";
      return false;
    }
  }

  function playTone(frequency, start, duration, volume) {
    if (!audioContext ||
        audioContext.state !== "running") {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

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
    oscillator.stop(start + duration + 0.02);
  }

  async function playDoorbell() {
    const available = await initializeAudio();

    if (!available) {
      return;
    }

    const now = audioContext.currentTime;

    // DING
    playTone(880, now, 0.9, 0.27);
    playTone(1320, now, 0.7, 0.10);

    // DONG
    playTone(659.25, now + 0.55, 1.3, 0.30);
    playTone(987.77, now + 0.55, 1.0, 0.09);

    // Gjentatt DING
    playTone(880, now + 1.9, 0.9, 0.27);
    playTone(1320, now + 1.9, 0.7, 0.10);

    // Gjentatt DONG
    playTone(659.25, now + 2.45, 1.3, 0.30);
    playTone(987.77, now + 2.45, 1.0, 0.09);
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
     OPPDATER VISNING
     ====================================== */

  function updateDisplay() {
    const ms = currentRemainingMs();

    timerDisplay.textContent = formatTime(ms);

    const elapsed = TOTAL_SECONDS * 1000 - ms;

    const percent = Math.min(
      100,
      Math.max(
        0,
        elapsed / (TOTAL_SECONDS * 1000) * 100
      )
    );

    progressBar.style.width = percent + "%";

    const alarmActive =
      alertTriggered && !alertAcknowledged;

    timerCard.classList.toggle(
      "alarm-active",
      alarmActive
    );

    alarmMessage.hidden = !alarmActive;
    ackButton.hidden = !alarmActive;

    if (alarmActive) {
      statusBadge.textContent = "VARSLING";
      statusText.textContent =
        "Aktiver landingsvarslingsanlegget nå!";

    } else if (!startedOnce) {
      statusBadge.textContent = "KLAR";
      statusText.textContent =
        "Klar til å starte nedtelling";

    } else if (!running) {
      statusBadge.textContent = "STOPPET";
      statusText.textContent =
        "Nedtelling stoppet";

    } else if (ms <= 0) {
      statusBadge.textContent = "OVERTID";
      statusText.textContent =
        "Forventet landingstid er passert";

    } else if (alertAcknowledged) {
      statusBadge.textContent = "KVITTERT";
      statusText.textContent =
        "Landingsvarsel er kvittert aktivert";

    } else {
      statusBadge.textContent = "PÅGÅR";
      statusText.textContent =
        "Nedtelling pågår";
    }

    startButton.disabled = running;
    stopButton.disabled = !running;

    startButton.textContent =
      startedOnce ? "▶ Fortsett" : "▶ Start";

    if (running) {
      startButton.textContent = "▶ Pågår";
    }

    document.title =
      formatTime(ms) + " | Landingsvarsel RH";
  }

  /* ======================================
     TIMER
     ====================================== */

  function tick() {
    if (!running) {
      return;
    }

    const ms = currentRemainingMs();

    // Første passering av 01:30
    if (ms <= ALERT_SECONDS * 1000 &&
        !alertTriggered) {
      triggerAlarm();
    }

    // Gjenta dørklokken hvert 8. sekund
    // helt til varselet er kvittert.
    if (alertTriggered &&
        !alertAcknowledged &&
        performance.now() - lastAlarmSoundTime >= 8000) {

      lastAlarmSoundTime = performance.now();
      playDoorbell();
    }

    updateDisplay();
  }

  async function startTimer() {
    if (running) {
      return;
    }

    // Start lyd fra brukerens klikk
    await initializeAudio();

    if (running) {
      return;
    }

    running = true;
    startedOnce = true;
    lastStartTime = performance.now();

    clearInterval(intervalId);
    intervalId = setInterval(tick, 100);

    updateDisplay();
  }

  function stopTimer() {
    if (!running) {
      return;
    }

    remainingMs = currentRemainingMs();

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

    remainingMs = TOTAL_SECONDS * 1000;
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
    const dark = theme === "dark";

    document.body.classList.toggle(
      "dark-mode",
      dark
    );

    themeButton.textContent = dark ? "☀" : "☾";

    localStorage.setItem(
      "luftambulanse-theme",
      theme
    );
  }

  const savedTheme =
    localStorage.getItem("luftambulanse-theme");

  applyTheme(savedTheme === "dark" ? "dark" : "light");

  themeButton.addEventListener("click", () => {
    const dark =
      document.body.classList.contains("dark-mode");

    applyTheme(dark ? "light" : "dark");
  });

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

  // Når vinduet blir synlig igjen,
  // oppdateres klokken umiddelbart.
  document.addEventListener(
    "visibilitychange",
    () => {
      tick();
    }
  );

  window.addEventListener("focus", tick);

})();
