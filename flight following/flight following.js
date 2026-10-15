
/* ==========================================
   FLIGHT FOLLOWING
   Luftambulansekoordinator

   TESTVERSJON – IKKE OPERATIV BRUK
   ========================================== */

(() => {
  "use strict";

  /* ======================================
     INNSTILLINGER
     ====================================== */

  const STORAGE_KEY = "la-flight-following-v3";
  const ALARM_MINUTES = 10;
  const CHECK_INTERVAL = 5000;
  const SOUND_INTERVAL = 15000;

  const $ = id => document.getElementById(id);

  const container = $("ffContainer");
  const alarmPanel = $("ffAlarmPanel");
  const newDialog = $("newFFDialog");
  const endDialog = $("endFFDialog");

  if (!container || !alarmPanel) {
    console.error("Mangler Flight Following-elementer.");
    return;
  }

  const resources = new Map();

  let resourceToEnd = null;
  let audioContext = null;
  let audioReady = false;
  let lastSoundAt = 0;
  let lastAlarmSignature = "";

  /* ======================================
     DATO OG TID
     ====================================== */

  function nowISO() {
    return new Date().toISOString();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function timeText(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return (
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  function timeInput(value) {
    const time = timeText(value);
    return time === "—" ? "" : time;
  }

  function dateText(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString("nb-NO");
  }

  /* ======================================
     SIKKER HTML-TEKST
     ====================================== */

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character]
    );
  }

  function display(value) {
    if (value === "" || value == null) {
      return "—";
    }

    return escapeHTML(value);
  }

  /* ======================================
     RESSURS-ID
     ====================================== */

  function normalizeResource(value) {
    const text = String(value)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

    const match = text.match(
      /^(?:LA\s*)?0*(\d+)\s*-\s*0*(\d+)$/
    );

    if (match) {
      return (
        "LA " +
        Number(match[1]) +
        "-" +
        Number(match[2])
      );
    }

    return text;
  }

  function resourceSort(a, b) {
    return a.localeCompare(b, "nb", {
      numeric: true,
      sensitivity: "base"
    });
  }

  /* ======================================
     NYTT LEGG
     ====================================== */

  function createFlight() {
    return {
      from: "",
      to: "",
      description: "",
      departureAt: null,
      pob: "",
      ete: "",
      etaAt: null,
      landingPlace: "",
      etaNotifiedAt: null,
      landedAt: null,
      abortedAt: null,
      status: "active",
      expanded: false,
      alarmSilenced: false
    };
  }

  /* ======================================
     LOKAL LAGRING
     ====================================== */

  function saveData() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...resources.values()])
      );
    } catch (error) {
      const notice = $("ffSystemNotice");

      if (notice) {
        notice.textContent =
          "ADVARSEL: Lokal lagring mislyktes. " +
          "Registreringene kan gå tapt.";
      }
    }
  }

  function loadData() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "[]"
      );

      if (!Array.isArray(saved)) return;

      for (const resource of saved) {
        if (
          !resource ||
          typeof resource.id !== "string" ||
          !Array.isArray(resource.flights)
        ) {
          continue;
        }

        resources.set(resource.id, {
          id: resource.id,
          collapsed: Boolean(resource.collapsed),
          flights: resource.flights.map(flight => ({
            ...createFlight(),
            ...flight
          }))
        });
      }

    } catch (error) {
      console.error("Kunne ikke lese FF-data.", error);
    }
  }

  /* ======================================
     ETE / ETA
     ====================================== */

  function parseETE(value) {
    const text = String(value ?? "").trim();

    if (/^\d+$/.test(text)) {
      return Number(text);
    }

    const match = text.match(
      /^(\d+):(\d{1,2})$/
    );

    if (
      match &&
      Number(match[2]) < 60
    ) {
      return (
        Number(match[1]) * 60 +
        Number(match[2])
      );
    }

    return null;
  }

  function calculateETA(flight) {
    const ete = parseETE(flight.ete);

    const departure = flight.departureAt
      ? new Date(flight.departureAt).getTime()
      : NaN;

    if (
      !Number.isFinite(departure) ||
      !Number.isFinite(ete) ||
      ete <= 0 ||
      ete > 1440
    ) {
      flight.etaAt = null;
      return;
    }

    flight.etaAt = new Date(
      departure + ete * 60000
    ).toISOString();
  }

  function alarmDeadline(flight) {
    if (!flight.etaAt) return null;

    const eta = new Date(flight.etaAt).getTime();

    if (!Number.isFinite(eta)) return null;

    return eta + ALARM_MINUTES * 60000;
  }

  /* ======================================
     ALARMSTATUS

     AVBRUTT ER IKKE LANDET.
     Alarmen fortsetter ved manglende
     sikker landingsbekreftelse.
     ====================================== */

  function isOverdue(flight) {
    if (flight.status === "completed") {
      return false;
    }

    const deadline = alarmDeadline(flight);

    if (deadline === null) return false;

    return Date.now() >= deadline;
  }

  function minutesPastETA(flight) {
    if (!flight.etaAt) return 0;

    const eta = new Date(flight.etaAt).getTime();

    if (!Number.isFinite(eta)) return 0;

    return Math.max(
      0,
      Math.floor((Date.now() - eta) / 60000)
    );
  }

  function getActiveFlight(resource) {
    return resource.flights.find(
      flight => flight.status === "active"
    );
  }

  function hasUnresolvedFlight(resource) {
    return resource.flights.some(
      flight =>
        flight.status === "active" ||
        flight.status === "aborted"
    );
  }

  /* ======================================
     HTML-KNAPPER
     ====================================== */

  function button(
    label,
    action,
    resourceId,
    index = null,
    style = "ff-neutral",
    disabled = false
  ) {
    return `
      <button
        type="button"
        class="ff-btn ${style}"
        data-action="${action}"
        data-resource="${escapeHTML(resourceId)}"
        ${
          index === null
            ? ""
            : `data-index="${index}"`
        }
        ${disabled ? "disabled" : ""}>
        ${label}
      </button>
    `;
  }

  /* ======================================
     SKJEMAFELT
     ====================================== */

  function field(
    label,
    key,
    value,
    placeholder = "",
    type = "text"
  ) {
    return `
      <div class="ff-field">
        <label>${label}</label>

        <input
          type="${type}"
          data-field="${key}"
          value="${escapeHTML(value)}"
          placeholder="${escapeHTML(placeholder)}"
          ${
            type === "number"
              ? 'min="0" max="30"'
              : ""
          }>
      </div>
    `;
  }

  /* ======================================
     AKTIVT LEGG
     ====================================== */

  function renderActiveLeg(resource, flight, index) {
    const late = isOverdue(flight);
    const deadline = alarmDeadline(flight);

    return `
      <article class="ff-leg"
               data-leg-index="${index}">

        <div class="ff-leg-header">

          <span class="ff-leg-number">
            Legg ${index + 1}
          </span>

          <span class="ff-leg-status ${late ? "alert" : ""}">
            ${
              late
                ? "● MANGLENDE LANDINGSBEKREFTELSE"
                : "● AKTIVT LEGG"
            }
          </span>

        </div>

        <div class="ff-grid ff-grid-top">

          ${field(
            "Fra",
            "from",
            flight.from,
            "F.eks. ENRH"
          )}

          ${field(
            "Til",
            "to",
            flight.to,
            "F.eks. ENUH"
          )}

          ${field(
            "Beskrivelse",
            "description",
            flight.description,
            "Pasienttransport, retur base ..."
          )}

        </div>

        <div class="ff-grid ff-grid-middle">

          <div class="ff-field">
            <label>Tatt av</label>

            <input
              class="ff-click-time"
              type="text"
              data-action="departure"
              data-resource="${escapeHTML(resource.id)}"
              data-index="${index}"
              value="${timeInput(flight.departureAt)}"
              placeholder="Klikk for nåtid"
              title="Klikk for å registrere nåtid"
              readonly>
          </div>

          ${field(
            "POB",
            "pob",
            flight.pob,
            "0",
            "number"
          )}

          ${field(
            "ETE (min)",
            "ete",
            flight.ete,
            "F.eks. 28"
          )}

          <div class="ff-field">
            <label>ETA</label>

            <input
              type="text"
              data-eta-output
              value="${timeInput(flight.etaAt)}"
              readonly>
          </div>

          <div class="ff-field">
            <label>Bekreftet landet</label>

            <input
              class="ff-click-time"
              type="text"
              data-action="land"
              data-resource="${escapeHTML(resource.id)}"
              data-index="${index}"
              placeholder="Klikk"
              title="Bekreft landing"
              readonly>
          </div>

        </div>

        <div class="ff-grid ff-grid-bottom">

          ${field(
            "Landingssted",
            "landingPlace",
            flight.landingPlace,
            "F.eks. Ullevål / Rikshospitalet"
          )}

          <div class="ff-field">
            <label>ETA varslet helikopter</label>

            <div class="ff-inline-time">

              <input
                type="text"
                value="${timeInput(flight.etaNotifiedAt)}"
                placeholder="Ikke varslet"
                readonly>

              <button
                type="button"
                class="ff-time-button"
                data-action="notified"
                data-resource="${escapeHTML(resource.id)}"
                data-index="${index}">
                Varslet
              </button>

            </div>
          </div>

          <div class="ff-field">
            <label>Status</label>

            <input
              type="text"
              value="${
                late
                  ? "ALARM – oppfølging påkrevd"
                  : "Flight Following aktiv"
              }"
              readonly>
          </div>

        </div>

        <div class="ff-leg-footer">

          <div class="ff-leg-note">
            ${
              deadline
                ? `Alarmgrense:
                   ${timeText(deadline)}`
                : "Registrer Tatt av og ETE " +
                  "for automatisk ETA"
            }
          </div>

          <div class="ff-leg-buttons">

            ${button(
              "✓ Bekreftet landet",
              "land",
              resource.id,
              index,
              "ff-land"
            )}

            ${button(
              "✕ Avbrutt",
              "abort",
              resource.id,
              index,
              "ff-danger"
            )}

          </div>

        </div>
      </article>
    `;
  }

  /* ======================================
     HISTORIKKLEGG
     ====================================== */

  function renderFinishedLeg(
    resource,
    flight,
    index
  ) {
    const completed = flight.status === "completed";
    const unresolved = flight.status === "aborted";

    const finishTime = completed
      ? flight.landedAt
      : flight.abortedAt;

    const statusText = completed
      ? "LANDET"
      : "AVBRUTT – LANDING IKKE BEKREFTET";

    return `
      <article
        class="ff-leg finished ${
          completed ? "completed" : "aborted"
        }">

        <button
          type="button"
          class="ff-finished-toggle"
          data-action="expand"
          data-resource="${escapeHTML(resource.id)}"
          data-index="${index}"
          aria-expanded="${flight.expanded}">

          <span class="ff-finished-number">
            Legg ${index + 1}
          </span>

          <span class="ff-finished-route">
            ${display(flight.from)}
            →
            ${display(flight.to)}
          </span>

          <span class="ff-finished-time">
            Avgang:
            ${timeText(flight.departureAt)}
          </span>

          <span class="ff-finished-time">
            ETA:
            ${timeText(flight.etaAt)}
          </span>

          <span class="ff-finished-result">
            ${statusText}
            ${timeText(finishTime)}
          </span>

          <span>
            ${flight.expanded ? "▲" : "▼"}
          </span>

        </button>

        <div class="ff-finished-details"
             ${flight.expanded ? "" : "hidden"}>

          <div>
            <strong>Beskrivelse:</strong>
            ${display(flight.description)}
          </div>

          <div>
            <strong>POB:</strong>
            ${display(flight.pob)}

            &nbsp; | &nbsp;

            <strong>ETE:</strong>
            ${display(flight.ete)}

            &nbsp; | &nbsp;

            <strong>ETA:</strong>
            ${timeText(flight.etaAt)}
          </div>

          <div>
            <strong>Landingssted:</strong>
            ${display(flight.landingPlace)}
          </div>

          <div>
            <strong>ETA varslet helikopter:</strong>
            ${timeText(flight.etaNotifiedAt)}
          </div>

          <div>
            <strong>Status:</strong>
            ${statusText}
            ${timeText(finishTime)}
          </div>

          ${
            unresolved
              ? `
                <div class="ff-leg-buttons">
                  ${button(
                    "✓ Bekreftet landet",
                    "land",
                    resource.id,
                    index,
                    "ff-land"
                  )}
                </div>
              `
              : ""
          }

        </div>
      </article>
    `;
  }

  /* ======================================
     MINIMERT RESSURSKORT
     ====================================== */

  function renderSummary(resource, flight, index) {
    const overdue = isOverdue(flight);
    const isActive = flight.status === "active";

    return `
      <div class="ff-resource-summary"
           ${resource.collapsed ? "" : "hidden"}>

        <span class="ff-summary-leg">
          Legg ${index + 1}
        </span>

        <span class="ff-summary-route">
          ${display(flight.from)}
          →
          ${display(flight.to)}
        </span>

        <div class="ff-summary-time">
          <small>Tatt av</small>
          <strong>${timeText(flight.departureAt)}</strong>
        </div>

        <div class="ff-summary-time">
          <small>ETA</small>
          <strong>${timeText(flight.etaAt)}</strong>
        </div>

        <div class="ff-summary-time">
          <small>POB</small>
          <strong>${display(flight.pob)}</strong>
        </div>

        ${
          overdue
            ? `
              <span class="ff-summary-alarm">
                ALARM – ETA overskredet
              </span>
            `
            : ""
        }

        <div class="ff-summary-buttons">

          ${button(
            "✓ Bekreftet landet",
            "land",
            resource.id,
            index,
            "ff-land"
          )}

          ${button(
            "Vis detaljer",
            "show",
            resource.id
          )}

        </div>

      </div>
    `;
  }

  /* ======================================
     RESSURSKORT
     ====================================== */

  function renderResource(resource) {
    const active = getActiveFlight(resource);

    const unresolved = resource.flights.some(
      flight => flight.status === "aborted"
    );

    const alarming = resource.flights.some(isOverdue);

    const status = alarming
      ? "ALARM"
      : unresolved
        ? "LANDING IKKE BEKREFTET"
        : active
          ? "FF AKTIV"
          : "AVVENTER NYTT LEGG";

    const statusClass = alarming
      ? "alert"
      : unresolved
        ? "alert"
        : active
          ? ""
          : "waiting";

    const summaryFlight = active ||
      [...resource.flights].reverse().find(
        flight => flight.status === "aborted"
      );

    const summaryIndex = resource.flights.indexOf(
      summaryFlight
    );

    const legs = resource.flights
      .map((flight, index) => ({ flight, index }))
      .reverse()
      .map(({ flight, index }) => {
        return flight.status === "active"
          ? renderActiveLeg(resource, flight, index)
          : renderFinishedLeg(resource, flight, index);
      })
      .join("");

    return `
      <section
        class="ff-resource ${
          alarming ? "alarming" : ""
        } ${
          !active ? "waiting" : ""
        }"
        data-resource-card="${escapeHTML(resource.id)}">

        <header class="ff-resource-header">

          <div class="ff-resource-left">

            <span class="ff-resource-dot"></span>

            <span class="ff-resource-name">
              ${escapeHTML(resource.id)}
            </span>

            <span class="ff-resource-status ${statusClass}">
              ${status}
            </span>

          </div>

          <div class="ff-resource-actions">

            ${button(
              "+ Nytt legg",
              "newleg",
              resource.id,
              null,
              "ff-primary",
              hasUnresolvedFlight(resource)
            )}

            ${button(
              "Avslutt FF",
              "end",
              resource.id,
              null,
              "ff-danger",
              hasUnresolvedFlight(resource)
            )}

            ${button(
              resource.collapsed ? "Vis" : "Skjul",
              "collapse",
              resource.id
            )}

          </div>

          ${
            summaryFlight
              ? renderSummary(
                  resource,
                  summaryFlight,
                  summaryIndex
                )
              : ""
          }

        </header>

        <div class="ff-resource-body"
             ${resource.collapsed ? "hidden" : ""}>

          <div class="ff-leg-list">
            ${legs}
          </div>

        </div>

      </section>
    `;
  }

  /* ======================================
     OPPDATER OVERSIKTEN
     ====================================== */

  function renderAll() {
    const sorted = [...resources.values()].sort(
      (a, b) => resourceSort(a.id, b.id)
    );

    if (!sorted.length) {
      container.innerHTML = `
        <div class="ff-empty">
          <strong>Ingen Flight Following</strong>
          <p>Klikk «+ Ny FF» for å opprette en ressurs.</p>
        </div>
      `;
    } else {
      container.innerHTML = sorted
        .map(renderResource)
        .join("");
    }

    renderAlarms();
  }

  /* ======================================
     OPPRETT NY FF
     ====================================== */

  function startNewFF(event) {
    event.preventDefault();

    const resourceId = normalizeResource(
      $("resourceInput").value
    );

    if (!resourceId) {
      alert("Oppgi ressurs-ID.");
      return;
    }

    if (resources.has(resourceId)) {
      alert(
        resourceId +
        " finnes allerede i Flight Following."
      );
      return;
    }

    resources.set(resourceId, {
      id: resourceId,
      collapsed: false,
      flights: [createFlight()]
    });

    newDialog.close();

    saveData();
    renderAll();
  }

  /* ======================================
     OPPRETT NYTT LEGG
     ====================================== */

  function addNewLeg(resourceId) {
    const resource = resources.get(resourceId);

    if (!resource) return;

    if (hasUnresolvedFlight(resource)) {
      alert(
        "Ressursen har et legg hvor landing " +
        "ikke er bekreftet. Avklar dette først."
      );
      return;
    }

    resource.flights.push(createFlight());
    resource.collapsed = false;

    saveData();
    renderAll();
  }

  /* ======================================
     AVSLUTT LEGG
     ====================================== */

  function finishLeg(resourceId, index, action) {
    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (!flight) return;

    if (action === "land") {
      if (flight.status === "completed") return;

      const confirmed = confirm(
        "Bekrefte at " +
        resourceId +
        ", legg " +
        (index + 1) +
        ", er landet?"
      );

      if (!confirmed) return;

      flight.landedAt = nowISO();
      flight.status = "completed";
      flight.alarmSilenced = true;
      flight.expanded = false;

    } else if (action === "abort") {
      if (flight.status !== "active") return;

      const confirmed = confirm(
        "Registrere legget som avbrutt?\n\n" +
        "Dette er IKKE en landingsbekreftelse. " +
        "Ressursen må fortsatt følges opp " +
        "etter gjeldende rutiner."
      );

      if (!confirmed) return;

      flight.abortedAt = nowISO();
      flight.status = "aborted";
      flight.expanded = true;
    }

    resource.collapsed = false;

    saveData();
    renderAll();
    checkAlarms();
  }

  /* ======================================
     TIDSPUNKTKNAPPER
     ====================================== */

  function setTime(resourceId, index, action) {
    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (
      !flight ||
      flight.status !== "active"
    ) {
      return;
    }

    if (action === "departure") {
      if (flight.departureAt) {
        const confirmed = confirm(
          "Vil du oppdatere avgangstidspunktet " +
          "til nåværende klokkeslett?"
        );

        if (!confirmed) return;
      }

      flight.departureAt = nowISO();
      calculateETA(flight);

    } else if (action === "notified") {
      flight.etaNotifiedAt = nowISO();
    }

    saveData();
    renderAll();
    checkAlarms();
  }

  /* ======================================
     OPPDATER FELTER
     ====================================== */

  function updateField(input) {
    const card = input.closest(
      "[data-resource-card]"
    );

    const leg = input.closest(
      "[data-leg-index]"
    );

    if (!card || !leg) return;

    const resourceId = card.dataset.resourceCard;
    const index = Number(leg.dataset.legIndex);

    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (
      !flight ||
      flight.status !== "active"
    ) {
      return;
    }

    const fieldName = input.dataset.field;

    if (![
      "from",
      "to",
      "description",
      "pob",
      "ete",
      "landingPlace"
    ].includes(fieldName)) {
      return;
    }

    flight[fieldName] = input.value;

    if (fieldName === "ete") {
      calculateETA(flight);

      const etaInput = leg.querySelector(
        "[data-eta-output]"
      );

      if (etaInput) {
        etaInput.value = timeInput(flight.etaAt);
      }
    }

    saveData();
  }

  /* ======================================
     ALARMOVERSIKT
     ====================================== */

  function getAlarms() {
    const alarms = [];

    for (const resource of resources.values()) {
      resource.flights.forEach((flight, index) => {
        if (isOverdue(flight)) {
          alarms.push({
            resource,
            flight,
            index
          });
        }
      });
    }

    return alarms;
  }

  function renderAlarms() {
    const alarms = getAlarms();

    if (!alarms.length) {
      alarmPanel.hidden = true;
      alarmPanel.classList.remove("alarm-active");
      alarmPanel.innerHTML = "";
      return;
    }

    alarmPanel.hidden = false;
    alarmPanel.classList.add("alarm-active");

    alarmPanel.innerHTML = `
      <h3>
        ⚠ MANGLENDE LANDINGSBEKREFTELSE
      </h3>

      <p>
        ETA + ${ALARM_MINUTES} minutter er passert
        uten bekreftet landing.
        Følg gjeldende prosedyre for vurdering
        og håndtering av savnet helikopter.
      </p>

      ${alarms.map(({ resource, flight, index }) => `
        <div class="ff-alarm-item">

          <div>
            <div class="ff-alarm-title">
              ${escapeHTML(resource.id)}
              – Legg ${index + 1}
            </div>

            <div>
              ETA: ${timeText(flight.etaAt)}
              |
              ${minutesPastETA(flight)}
              min siden ETA
            </div>

            <div>
              Fra: ${display(flight.from)}
              →
              Til: ${display(flight.to)}
            </div>
          </div>

          <div class="ff-alarm-actions">

            ${button(
              flight.alarmSilenced
                ? "Lyd kvittert"
                : "Kvitter lyd",
              "silence",
              resource.id,
              index,
              "ff-neutral",
              flight.alarmSilenced
            )}

            ${button(
              "✓ Bekreftet landet",
              "land",
              resource.id,
              index,
              "ff-land"
            )}

            ${button(
              "Vis ressurs",
              "show",
              resource.id
            )}

          </div>

        </div>
      `).join("")}

      <p>
        <strong>
          Kvittering av lyd er ikke en
          landingsbekreftelse.
        </strong>
        Alarmen forblir synlig til
        landingsstatus er avklart.
      </p>
    `;
  }

  /* ======================================
     LYDALARM

     Web Audio kan kreve at brukeren
     først har klikket på siden.
     ====================================== */

  function prepareAudio() {
    try {
      const AudioClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioClass) return;

      if (!audioContext) {
        audioContext = new AudioClass();
      }

      audioContext.resume()
        .then(() => {
          audioReady =
            audioContext.state === "running";
        })
        .catch(() => {
          audioReady = false;
        });

    } catch (error) {
      audioReady = false;
    }
  }

  function playAlarmSound() {
    if (
      !audioReady ||
      !audioContext ||
      audioContext.state !== "running"
    ) {
      return;
    }

    try {
      const start = audioContext.currentTime;

      [0, 0.3, 0.6].forEach(delay => {
        const oscillator =
          audioContext.createOscillator();

        const gain = audioContext.createGain();

        oscillator.type = "square";
        oscillator.frequency.value = 800;

        const t = start + delay;

        gain.gain.setValueAtTime(0.0001, t);

        gain.gain.exponentialRampToValueAtTime(
          0.08,
          t + 0.03
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          t + 0.22
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(t);
        oscillator.stop(t + 0.23);
      });

    } catch (error) {
      console.warn(
        "Alarmlyd kunne ikke spilles.",
        error
      );
    }
  }

  /* ======================================
     ALARMKONTROLL
     ====================================== */

  function alarmSignature() {
    return getAlarms()
      .map(({ resource, index }) =>
        resource.id + ":" + index
      )
      .sort()
      .join("|");
  }

  function checkAlarms() {
    const signature = alarmSignature();

    if (signature !== lastAlarmSignature) {
      lastAlarmSignature = signature;
      renderAll();
    } else {
      renderAlarms();
    }

    const soundRequired = getAlarms().some(
      ({ flight }) => !flight.alarmSilenced
    );

    if (
      soundRequired &&
      Date.now() - lastSoundAt >= SOUND_INTERVAL
    ) {
      lastSoundAt = Date.now();
      playAlarmSound();
    }

    if (!soundRequired) {
      lastSoundAt = 0;
    }
  }

  /* ======================================
     KNAPPEHANDLINGER
     ====================================== */

  function handleAction(action, resourceId, index) {
    const resource = resources.get(resourceId);

    if (!resource) return;

    if (action === "collapse") {
      resource.collapsed = !resource.collapsed;
      saveData();
      renderAll();
      return;
    }

    if (action === "show") {
      resource.collapsed = false;
      saveData();
      renderAll();

      const cards = container.querySelectorAll(
        "[data-resource-card]"
      );

      for (const card of cards) {
        if (
          card.dataset.resourceCard === resourceId
        ) {
          card.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
          break;
        }
      }

      return;
    }

    if (action === "newleg") {
      addNewLeg(resourceId);
      return;
    }

    if (action === "end") {
      if (hasUnresolvedFlight(resource)) {
        alert(
          "Landing er ikke bekreftet for " +
          "alle legg. Avklar status først."
        );
        return;
      }

      resourceToEnd = resourceId;

      $("endFFText").textContent =
        "Vil du avslutte Flight Following for " +
        resourceId +
        "? Alle legg fjernes fra denne " +
        "lokale oversikten. Skriv ut først " +
        "hvis historikken skal beholdes.";

      endDialog.showModal();
      return;
    }

    if (!Number.isInteger(index)) return;

    const flight = resource.flights[index];

    if (!flight) return;

    if (action === "expand") {
      flight.expanded = !flight.expanded;
      saveData();
      renderAll();
      return;
    }

    if (action === "land" || action === "abort") {
      finishLeg(resourceId, index, action);
      return;
    }

    if (
      action === "departure" ||
      action === "notified"
    ) {
      setTime(resourceId, index, action);
      return;
    }

    if (action === "silence") {
      flight.alarmSilenced = true;
      saveData();
      renderAlarms();
      return;
    }
  }

  /* ======================================
     FELLES KLIKKEHÅNDTERING

     FUNGERER OGSÅ PÅ READONLY-INPUT
     ====================================== */

  function delegatedClick(event) {
    const element = event.target.closest(
      "[data-action]"
    );

    if (!element) return;

    const action = element.dataset.action;

    const card = element.closest(
      "[data-resource-card]"
    );

    const leg = element.closest(
      "[data-leg-index]"
    );

    const resourceId =
      element.dataset.resource ||
      card?.dataset.resourceCard;

    let index = null;

    if (element.dataset.index !== undefined) {
      index = Number(element.dataset.index);

    } else if (leg) {
      index = Number(leg.dataset.legIndex);
    }

    if (!resourceId) return;

    handleAction(action, resourceId, index);
  }

  container.addEventListener(
    "click",
    delegatedClick
  );

  alarmPanel.addEventListener(
    "click",
    delegatedClick
  );

  /* ======================================
     INPUT-HÅNDTERING
     ====================================== */

  container.addEventListener("input", event => {
    const input = event.target.closest(
      "[data-field]"
    );

    if (!input) return;

    updateField(input);
  });

  /* Oppfrisk kompakt visning etter endring */

  container.addEventListener("change", event => {
    if (!event.target.matches("[data-field]")) {
      return;
    }

    renderAll();
    checkAlarms();
  });

  /* ======================================
     NY FF – MODAL
     ====================================== */

  $("newFFBtn").addEventListener("click", () => {
    $("resourceInput").value = "";
    newDialog.showModal();
    $("resourceInput").focus();
  });

  $("cancelNewFFBtn").addEventListener(
    "click",
    () => newDialog.close()
  );

  $("newFFForm").addEventListener(
    "submit",
    startNewFF
  );

  /* ======================================
     AVSLUTT FF – MODAL
     ====================================== */

  $("cancelEndFFBtn").addEventListener(
    "click",
    () => {
      resourceToEnd = null;
      endDialog.close();
    }
  );

  $("confirmEndFFBtn").addEventListener(
    "click",
    () => {
      if (resourceToEnd) {
        const resource = resources.get(
          resourceToEnd
        );

        if (
          resource &&
          !hasUnresolvedFlight(resource)
        ) {
          resources.delete(resourceToEnd);
        }
      }

      resourceToEnd = null;
      endDialog.close();

      saveData();
      renderAll();
    }
  );

  /* ======================================
     UTSKRIFT
     ====================================== */

  function printFlightFollowing() {
    if (!resources.size) {
      alert("Ingen Flight Following å skrive ut.");
      return;
    }

    const columns = [
      "Legg",
      "Fra",
      "Til",
      "Beskrivelse",
      "Tatt av",
      "POB",
      "ETE",
      "ETA",
      "Landingssted",
      "ETA varslet",
      "Landet",
      "Status"
    ];

    let html = `
      <h1>
        Flight Following –
        Luftambulansekoordinator
      </h1>

      <p>
        TESTVERSJON – Utskrift:
        ${escapeHTML(new Date().toLocaleString("nb-NO"))}
      </p>
    `;

    const sorted = [...resources.values()].sort(
      (a, b) => resourceSort(a.id, b.id)
    );

    for (const resource of sorted) {
      html += `
        <section>
          <h2>${escapeHTML(resource.id)}</h2>

          <table>
            <thead>
              <tr>
                ${
                  columns.map(column =>
                    `<th>${column}</th>`
                  ).join("")
                }
              </tr>
            </thead>
            <tbody>
      `;

      resource.flights.forEach((flight, index) => {
        let status = "AKTIV";

        if (flight.status === "completed") {
          status = "LANDET";

        } else if (flight.status === "aborted") {
          status = "AVBRUTT – IKKE LANDINGSBEKREFTET";
        }

        const values = [
          index + 1,
          flight.from,
          flight.to,
          flight.description,
          dateText(flight.departureAt),
          flight.pob,
          flight.ete,
          dateText(flight.etaAt),
          flight.landingPlace,
          dateText(flight.etaNotifiedAt),
          dateText(flight.landedAt),
          status
        ];

        html += `
          <tr>
            ${
              values.map(value =>
                `<td>${display(value)}</td>`
              ).join("")
            }
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </section>
      `;
    }

    $("printArea").innerHTML = html;

    window.print();
  }

  $("printFFBtn").addEventListener(
    "click",
    printFlightFollowing
  );

  /* ======================================
     AKTIVER LYD VED FØRSTE INTERAKSJON

     Ingen synlig aktiveringsknapp.
     Nettleseren kan fortsatt blokkere lyd.
     ====================================== */

  document.addEventListener(
    "pointerdown",
    prepareAudio,
    { once: true, capture: true }
  );

  document.addEventListener(
    "keydown",
    prepareAudio,
    { once: true, capture: true }
  );

  /* ======================================
     START
     ====================================== */

  loadData();
  renderAll();
  lastAlarmSignature = alarmSignature();

  setInterval(checkAlarms, CHECK_INTERVAL);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        checkAlarms();
      }
    }
  );

  window.addEventListener(
    "focus",
    checkAlarms
  );

})();
