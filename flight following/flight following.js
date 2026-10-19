
/* ==========================================
   FLIGHT FOLLOWING
   LUFTAMBULANSEKOORDINATOR

   PROTOTYPE – IKKE OPERATIV BRUK
   ========================================== */

(() => {
  "use strict";

  /* ======================================
     INNSTILLINGER
     ========================================== */

  const STORAGE_KEY = "la-flight-following-v3";
  const ALARM_MINUTES = 10;
  const CHECK_INTERVAL = 5000;
  const SOUND_INTERVAL = 15000;

  const TITLE =
    "Flight Following | Luftambulansekoordinator";

  const $ = id => document.getElementById(id);

  const container = $("ffContainer");
  const overview = $("ffOverview");
  const alarmPanel = $("ffAlarmPanel");

  if (!container || !overview || !alarmPanel) {
    console.error("Mangler Flight Following-elementer.");
    return;
  }

  const resources = new Map();
  const notifiedAlarms = new Set();

  let selectedResource = null;
  let landingTarget = null;
  let resourceToEnd = null;

  let audioContext = null;
  let audioReady = false;
  let lastSoundAt = 0;
  let lastAlarmSignature = "";

  /* ======================================
     DATO OG KLOKKESLETT
     ========================================== */

  function nowISO() {
    return new Date().toISOString();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function validDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  function timeText(value) {
    const date = validDate(value);

    if (!date) return "—";

    return (
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  function localDateTime(value) {
    const date = validDate(value);

    if (!date) return "";

    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes())
    );
  }

  function fromLocalDateTime(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString();
  }

  function minutesUntil(value) {
    const date = validDate(value);

    if (!date) return null;

    return Math.ceil(
      (date.getTime() - Date.now()) / 60000
    );
  }

  /* ======================================
     TEKST OG RESSURS-ID
     ========================================== */

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
    return value === "" || value == null
      ? "—"
      : escapeHTML(value);
  }

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

  function sortedResources() {
    return [...resources.values()].sort(
      (a, b) =>
        a.id.localeCompare(b.id, "nb", {
          numeric: true,
          sensitivity: "base"
        })
    );
  }

  /* ======================================
     DATA
     ========================================== */

  function createFlight(from = "") {
    return {
      from,
      to: "",
      description: "",
      purpose: "",
      departureAt: null,
      pob: "",
      ete: "",
      etaAt: null,

      slingLoad: false,
      searchRescue: false,
      landingPlaceNotified: false,

      landedAt: null,
      abortedAt: null,
      status: "active",
      expanded: false,
      alarmSilenced: false
    };
  }

  function saveData() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...resources.values()])
      );
    } catch (error) {
      console.error("FF-lagring mislyktes.", error);
      alert("Registreringene kunne ikke lagres lokalt.");
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
          flights: resource.flights.map(flight => ({
            ...createFlight(),
            ...flight,
            landingPlaceNotified:
              Boolean(flight.landingPlaceNotified) ||
              Boolean(flight.landingPlaceNotifiedAt)
          }))
        });
      }
    } catch (error) {
      console.error("Kunne ikke lese FF-data.", error);
    }
  }

  /* ======================================
     ETE OG ETA
     ========================================== */

  function parseETE(value) {
    const text = String(value ?? "").trim();

    if (/^\d+$/.test(text)) {
      return Number(text);
    }

    const match = text.match(
      /^(\d+):(\d{1,2})$/
    );

    if (match && Number(match[2]) < 60) {
      return (
        Number(match[1]) * 60 +
        Number(match[2])
      );
    }

    return null;
  }

  function calculateETA(flight) {
    const departure = validDate(flight.departureAt);
    const ete = parseETE(flight.ete);

    if (
      !departure ||
      !Number.isFinite(ete) ||
      ete <= 0 ||
      ete > 1440
    ) {
      flight.etaAt = null;
      return;
    }

    flight.etaAt = new Date(
      departure.getTime() + ete * 60000
    ).toISOString();
  }

  function isOverdue(flight) {
    if (flight.status === "completed") return false;

    const eta = validDate(flight.etaAt);

    if (!eta) return false;

    return Date.now() >=
      eta.getTime() + ALARM_MINUTES * 60000;
  }

  function countdownText(flight) {
    if (flight.status === "completed") {
      return "Landet";
    }

    const remaining = minutesUntil(flight.etaAt);

    if (remaining === null) {
      return "Ingen ETA";
    }

    if (remaining > 0) {
      return remaining + " min";
    }

    const passed = Math.max(
      0,
      Math.floor(
        (Date.now() -
          new Date(flight.etaAt).getTime()) / 60000
      )
    );

    return passed === 0
      ? "ETA nå"
      : "+" + passed + " min";
  }

  /* ======================================
     RESSURSSTATUS
     ========================================== */

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

  function latestUnresolved(resource) {
    return [...resource.flights]
      .reverse()
      .find(flight =>
        flight.status === "active" ||
        flight.status === "aborted"
      );
  }

  function latestFlight(resource) {
    return resource.flights.at(-1);
  }

  function resourceStatus(resource) {
    if (resource.flights.some(isOverdue)) {
      return {
        text: "ALARM",
        className: "alert"
      };
    }

    if (resource.flights.some(
      flight => flight.status === "aborted"
    )) {
      return {
        text: "LANDING IKKE BEKREFTET",
        className: "alert"
      };
    }

    if (getActiveFlight(resource)) {
      return {
        text: "I LUFTEN",
        className: ""
      };
    }

    return {
      text: "PÅ BAKKEN",
      className: "waiting"
    };
  }

  /* ======================================
     HTML-HJELPERE
     ========================================== */

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
        ${index === null
          ? ""
          : `data-index="${index}"`}
        ${disabled ? "disabled" : ""}>
        ${label}
      </button>
    `;
  }

  function field(label, key, value, type = "text") {
    return `
      <div class="ff-field">
        <label>${label}</label>
        <input
          type="${type}"
          data-field="${key}"
          value="${escapeHTML(value ?? "")}"
          ${type === "number"
            ? 'min="0" max="30"'
            : ""}>
      </div>
    `;
  }

  function clickTimeField(label, action, value) {
    return `
      <div class="ff-field">
        <label>${label}</label>
        <input
          type="text"
          class="ff-click-time"
          data-action="${action}"
          value="${timeText(value)}"
          title="Klikk for å registrere nåtid"
          readonly>
      </div>
    `;
  }

  function checkbox(label, key, checked) {
    return `
      <label>
        <input
          type="checkbox"
          data-field="${key}"
          ${checked ? "checked" : ""}>
        ${label}
      </label>
    `;
  }

  /* ======================================
     AKTIV FLIGHT LEG
     ========================================== */

  function renderActiveLeg(resource, flight, index) {
    const purposes = [
      "Transport",
      "Retur",
      "Rescue",
      "Trening",
      "Annet"
    ];

    const options = purposes.map(value => `
      <option value="${value}"
        ${flight.purpose === value ? "selected" : ""}>
        ${value}
      </option>
    `).join("");

    return `
      <article class="ff-leg"
               data-leg-index="${index}">

        <div class="ff-leg-header">
          <span class="ff-leg-number">
            Flight leg ${index + 1}
          </span>

          <span class="ff-leg-status
            ${isOverdue(flight) ? "alert" : ""}">
            ${isOverdue(flight)
              ? "● MANGLENDE LANDINGSBEKREFTELSE"
              : "● AKTIV FLIGHT LEG"}
          </span>
        </div>

        <!-- TATT AV OG HENSIKT -->
        <div class="ff-grid ff-grid-flight">

          ${clickTimeField(
            "Tatt av",
            "departure",
            flight.departureAt
          )}

          <div class="ff-field">
            <label>Hensikt</label>
            <select data-field="purpose">
              <option value="">Velg hensikt</option>
              ${options}
            </select>
          </div>

        </div>

        <!-- FRA OG TIL -->
        <div class="ff-grid ff-grid-route">
          ${field("Fra", "from", flight.from)}
          ${field("Til", "to", flight.to)}
        </div>

        <!-- POB OG ETE -->
        <div class="ff-grid ff-grid-flight">
          ${field("POB", "pob", flight.pob, "number")}
          ${field("ETE (min)", "ete", flight.ete)}
        </div>

        <!-- ETA -->
        <div class="ff-grid ff-grid-flight">

          <div class="ff-field">
            <label>ETA</label>
            <input
              type="text"
              data-eta-output
              value="${timeText(flight.etaAt)}"
              readonly>
          </div>

          <div class="ff-field">
            <label>Nedtelling ETA</label>
            <input
              type="text"
              data-countdown-output
              value="${escapeHTML(countdownText(flight))}"
              readonly>
          </div>

        </div>

        <!-- KOMMENTAR -->
        <div class="ff-grid ff-grid-info">
          <div class="ff-field ff-wide">
            <label>Kommentar</label>
            <textarea
              data-field="description"
              rows="2">${escapeHTML(flight.description)}</textarea>
          </div>
        </div>

        <!-- AVHUKINGER -->
        <div class="ff-checks">

          ${checkbox(
            "Underhengende",
            "slingLoad",
            flight.slingLoad
          )}

          ${checkbox(
            "Søk og redning",
            "searchRescue",
            flight.searchRescue
          )}

          ${checkbox(
            "Landingssted informert",
            "landingPlaceNotified",
            flight.landingPlaceNotified
          )}

        </div>

        <div class="ff-leg-footer">
          <span class="ff-leg-note">
            Alarm ved ETA + ${ALARM_MINUTES} min
            uten bekreftet landing.
          </span>

          ${button(
            "Avbrutt",
            "abort",
            resource.id,
            index,
            "ff-danger"
          )}
        </div>

      </article>
    `;
  }

  /* ======================================
     TIDLIGERE FLIGHT LEGS
     ========================================== */

  function renderFinishedLeg(resource, flight, index) {
    const completed = flight.status === "completed";

    return `
      <article
        class="ff-leg finished
          ${completed ? "completed" : "aborted"}"
        data-leg-index="${index}">

        <button
          type="button"
          class="ff-finished-toggle"
          data-action="expand"
          aria-expanded="${Boolean(flight.expanded)}">

          <span class="ff-finished-number">
            Flight leg ${index + 1}
          </span>

          <span class="ff-finished-route">
            ${display(flight.from)}
            →
            ${display(flight.to)}
          </span>

          <span class="ff-finished-time">
            Tatt av ${timeText(flight.departureAt)}
          </span>

          <span class="ff-finished-time">
            ETA ${timeText(flight.etaAt)}
          </span>

          <span class="ff-finished-result">
            ${completed
              ? "LANDET " + timeText(flight.landedAt)
              : "AVBRUTT – LANDING IKKE BEKREFTET"}
          </span>

          <span>${flight.expanded ? "▲" : "▼"}</span>
        </button>

        <div class="ff-finished-details"
             ${flight.expanded ? "" : "hidden"}>

          <div>
            <strong>Hensikt:</strong>
            ${display(flight.purpose)}
          </div>

          <div>
            <strong>Kommentar:</strong>
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
            <strong>Underhengende:</strong>
            ${flight.slingLoad ? "Ja" : "Nei"}
          </div>

          <div>
            <strong>Søk og redning:</strong>
            ${flight.searchRescue ? "Ja" : "Nei"}
          </div>

          <div>
            <strong>Landingssted informert:</strong>
            ${flight.landingPlaceNotified ? "Ja" : "Nei"}
          </div>

          <div class="ff-leg-buttons"
               style="margin-top:12px">

            ${completed
              ? button(
                  "Korriger landingstid",
                  "correctland",
                  resource.id,
                  index
                )
              : button(
                  "Bekreft landing",
                  "land",
                  resource.id,
                  index,
                  "ff-land"
                )}

            ${completed
              ? button(
                  "Angre landing",
                  "undo",
                  resource.id,
                  index,
                  "ff-danger"
                )
              : ""}

          </div>
        </div>
      </article>
    `;
  }

  /* ======================================
     VALGT RESSURS
     ========================================== */

  function renderResource(resource) {
    const active = getActiveFlight(resource);
    const unresolved = latestUnresolved(resource);

    const current =
      active || unresolved || latestFlight(resource);

    const currentIndex = current
      ? resource.flights.indexOf(current)
      : -1;

    const status = resourceStatus(resource);

    const legs = resource.flights
      .map((flight, index) => ({ flight, index }))
      .reverse();

    const activeHTML = legs
      .filter(item => item.flight.status === "active")
      .map(item => renderActiveLeg(
        resource,
        item.flight,
        item.index
      ))
      .join("");

    const finishedHTML = legs
      .filter(item => item.flight.status !== "active")
      .map(item => renderFinishedLeg(
        resource,
        item.flight,
        item.index
      ))
      .join("");

    return `
      <section
        class="ff-resource
          ${status.className === "alert" ? "alarming" : ""}"
        data-resource-card="${escapeHTML(resource.id)}">

        <div class="ff-resource-header">

          <div class="ff-resource-identity">

            <div class="ff-resource-title">
              <span class="ff-resource-name">
                ${escapeHTML(resource.id)}
              </span>

              <span class="ff-resource-status
                ${status.className}">
                ${status.text}
              </span>
            </div>

            <div class="ff-resource-eta">

              <div class="ff-resource-eta-item">
                <small>ETA</small>
                <strong data-header-eta>
                  ${current
                    ? timeText(current.etaAt)
                    : "—"}
                </strong>
              </div>

              <div class="ff-resource-eta-item">
                <small>Nedtelling</small>
                <strong data-header-countdown>
                  ${current
                    ? escapeHTML(countdownText(current))
                    : "—"}
                </strong>
              </div>

            </div>
          </div>

          <div class="ff-resource-actions">

            ${current && current.status !== "completed"
              ? button(
                  "✓ Registrer landing",
                  "land",
                  resource.id,
                  currentIndex,
                  "ff-land ff-landing-primary"
                )
              : ""}

            ${button(
              "+ Ny Flight leg",
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

          </div>
        </div>

        <div class="ff-resource-body">

          <div class="ff-leg-list">
            ${activeHTML}
          </div>

          ${finishedHTML
            ? `
              <h3 class="ff-history-heading">
                Tidligere Flight legs
              </h3>

              <div class="ff-leg-list">
                ${finishedHTML}
              </div>
            `
            : ""}

        </div>
      </section>
    `;
  }

  /* ======================================
     HØYREPANEL
     ========================================== */

  function renderOverviewCard(resource, flight, ground) {
    const unresolved = flight.status === "aborted";
    const overdue = !ground && isOverdue(flight);
    const remaining = minutesUntil(flight.etaAt);
    const index = resource.flights.indexOf(flight);

    let progress = 0;

    if (!ground && flight.etaAt) {
      const ete = parseETE(flight.ete);

      if (ete && remaining !== null) {
        progress = Math.max(
          0,
          Math.min(
            100,
            ((ete - remaining) / ete) * 100
          )
        );
      }
    }

    return `
      <div class="ff-overview-card
        ${ground ? "ground" : ""}
        ${overdue ? "overdue" : ""}
        ${unresolved ? "unresolved" : ""}
        ${selectedResource === resource.id
          ? "selected"
          : ""}">

        <button
          type="button"
          class="ff-overview-select"
          data-action="select"
          data-resource="${escapeHTML(resource.id)}"
          aria-pressed="${selectedResource === resource.id}">

          <div class="ff-overview-top">
            <span class="ff-overview-name">
              ${escapeHTML(resource.id)}
              ${selectedResource === resource.id
                ? " · VALGT"
                : ""}
            </span>

            <span class="ff-overview-countdown">
              ${ground
                ? "Landet " + timeText(flight.landedAt)
                : escapeHTML(countdownText(flight))}
            </span>
          </div>

          <div class="ff-overview-route">
            ${display(flight.from)}
            →
            ${display(flight.to)}
          </div>

          ${!ground
            ? `
              <div class="ff-overview-bar">
                <div
                  class="ff-overview-progress"
                  style="width:${progress}%">
                </div>
              </div>
            `
            : ""}

          <div class="ff-overview-bottom">
            <span>
              ${ground
                ? "Bekreftet landing"
                : unresolved
                  ? "Må avklares"
                  : overdue
                    ? "ALARM"
                    : "Flight Following"}
            </span>

            <strong>
              ${ground
                ? ""
                : "ETA " + timeText(flight.etaAt)}
            </strong>
          </div>

        </button>

        ${!ground
          ? `
            <div class="ff-overview-actions">
              ${button(
                "✓ Landet",
                "land",
                resource.id,
                index,
                "ff-land ff-small"
              )}
            </div>
          `
          : ""}
      </div>
    `;
  }

  function renderOverview() {
    const airborne = [];
    const grounded = [];

    for (const resource of sortedResources()) {
      const unresolved = latestUnresolved(resource);

      if (unresolved) {
        airborne.push(
          renderOverviewCard(resource, unresolved, false)
        );
        continue;
      }

      const last = latestFlight(resource);

      if (last && last.status === "completed") {
        grounded.push(
          renderOverviewCard(resource, last, true)
        );
      }
    }

    $("ffActiveCount").textContent = airborne.length;

    overview.innerHTML = `
      <div class="ff-group-heading">
        ↗ I luften / ikke avklart (${airborne.length})
      </div>

      ${airborne.length
        ? airborne.join("")
        : `
          <div class="ff-overview-empty">
            Ingen aktive flyginger
          </div>
        `}

      <div class="ff-group-heading">
        ↘ På bakken (${grounded.length})
      </div>

      ${grounded.length
        ? grounded.join("")
        : `
          <div class="ff-overview-empty">
            Ingen registrerte landinger
          </div>
        `}
    `;
  }

  function renderMain() {
    const resource = resources.get(selectedResource);

    if (!resource) {
      container.innerHTML = `
        <div class="ff-empty">
          <strong>Ingen ressurs valgt</strong>
          <p>
            Opprett Flight Following eller velg
            en ressurs fra høyreoversikten.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = renderResource(resource);
  }

  function renderAll() {
    renderMain();
    renderOverview();
    renderAlarms();
  }

  /* ======================================
     NY FLIGHT FOLLOWING
     ========================================== */

  function startNewFF(event) {
    event.preventDefault();

    const id = normalizeResource(
      $("resourceInput").value
    );

    if (!id) {
      alert("Oppgi ressurs-ID.");
      return;
    }

    if (resources.has(id)) {
      alert(id + " finnes allerede.");
      return;
    }

    resources.set(id, {
      id,
      flights: [createFlight()]
    });

    selectedResource = id;

    $("newFFDialog").close();

    saveData();
    renderAll();
  }

  /* ======================================
     NY FLIGHT LEG
     ========================================== */

  function addNewLeg(resourceId) {
    const resource = resources.get(resourceId);

    if (!resource) return;

    if (hasUnresolvedFlight(resource)) {
      alert(
        "Landing må avklares før en ny Flight leg " +
        "kan opprettes."
      );
      return;
    }

    const previous = latestFlight(resource);

    // Fra på neste Flight leg er
    // Til fra forrige Flight leg.
    const nextFrom = previous?.to || "";

    resource.flights.push(
      createFlight(nextFrom)
    );

    selectedResource = resourceId;

    saveData();
    renderAll();
  }

  /* ======================================
     TATT AV
     ========================================== */

  function registerDeparture(resourceId, index) {
    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (!flight || flight.status !== "active") {
      return;
    }

    if (flight.departureAt) {
      if (!confirm(
        "Tatt av er registrert kl. " +
        timeText(flight.departureAt) +
        ".\n\nOppdatere til nåværende klokkeslett?"
      )) return;
    }

    flight.departureAt = nowISO();

    calculateETA(flight);

    saveData();
    renderAll();
    checkAlarms();
  }

  /* ======================================
     LANDING
     ========================================== */

  function openLandingDialog(
    resourceId,
    index,
    correction = false
  ) {
    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (!flight) return;

    landingTarget = {
      resourceId,
      index,
      correction
    };

    $("landFFText").textContent =
      (correction
        ? "Korriger landingstid for "
        : "Bekreft landing for ") +
      resourceId +
      ", Flight leg " +
      (index + 1) +
      ".";

    $("landTimeInput").value = localDateTime(
      correction && flight.landedAt
        ? flight.landedAt
        : nowISO()
    );

    $("landFFDialog").showModal();
  }

  function confirmLanding(event) {
    event.preventDefault();

    if (!landingTarget) return;

    const { resourceId, index, correction } =
      landingTarget;

    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (!flight) return;

    const landedAt = fromLocalDateTime(
      $("landTimeInput").value
    );

    if (!landedAt) {
      alert("Oppgi gyldig landingstid.");
      return;
    }

    const departure = validDate(flight.departureAt);

    if (
      departure &&
      new Date(landedAt).getTime() <
        departure.getTime()
    ) {
      alert(
        "Landingstid kan ikke være før registrert avgang."
      );
      return;
    }

    if (!correction) {
      if (flight.status === "completed") return;

      flight.status = "completed";
      flight.alarmSilenced = true;
      flight.expanded = false;
    }

    flight.landedAt = landedAt;

    landingTarget = null;
    selectedResource = resourceId;

    $("landFFDialog").close();

    saveData();
    renderAll();
    checkAlarms();
  }

  function abortLeg(resourceId, index) {
    const flight = resources.get(resourceId)
      ?.flights[index];

    if (!flight || flight.status !== "active") {
      return;
    }

    if (!confirm(
      "Registrere Flight leg " +
      (index + 1) +
      " som avbrutt?\n\n" +
      "Dette er ikke en landingsbekreftelse."
    )) return;

    flight.status = "aborted";
    flight.abortedAt = nowISO();
    flight.expanded = true;

    saveData();
    renderAll();
    checkAlarms();
  }

  function undoLanding(resourceId, index) {
    const resource = resources.get(resourceId);
    const flight = resource?.flights[index];

    if (!flight || flight.status !== "completed") {
      return;
    }

    if (hasUnresolvedFlight(resource)) {
      alert(
        "Kan ikke angre landing mens en annen " +
        "Flight leg er uavklart."
      );
      return;
    }

    if (!confirm(
      "Angre landing? Flight leg " +
      (index + 1) +
      " blir aktiv igjen."
    )) return;

    flight.status = "active";
    flight.landedAt = null;
    flight.alarmSilenced = false;
    flight.expanded = false;

    saveData();
    renderAll();
    checkAlarms();
  }

  /* ======================================
     FELTOPPDATERING
     ========================================== */

  function updateField(input) {
    const card = input.closest(
      "[data-resource-card]"
    );

    const leg = input.closest(
      "[data-leg-index]"
    );

    if (!card || !leg) return;

    const resource = resources.get(
      card.dataset.resourceCard
    );

    const flight = resource?.flights[
      Number(leg.dataset.legIndex)
    ];

    if (!flight || flight.status !== "active") {
      return;
    }

    const key = input.dataset.field;

    const allowed = [
      "from",
      "to",
      "description",
      "purpose",
      "pob",
      "ete",
      "slingLoad",
      "searchRescue",
      "landingPlaceNotified"
    ];

    if (!allowed.includes(key)) return;

    if (input.type === "checkbox") {
      flight[key] = input.checked;
    } else {
      flight[key] = input.value;
    }

    if (key === "ete") {
      calculateETA(flight);

      const etaOutput = leg.querySelector(
        "[data-eta-output]"
      );

      if (etaOutput) {
        etaOutput.value = timeText(flight.etaAt);
      }
    }

    saveData();
    renderOverview();
    updateVisibleTimes();
  }

  function updateVisibleTimes() {
    const resource = resources.get(selectedResource);

    if (!resource) return;

    const current =
      latestUnresolved(resource) ||
      latestFlight(resource);

    if (!current) return;

    const headerETA = container.querySelector(
      "[data-header-eta]"
    );

    const headerCountdown = container.querySelector(
      "[data-header-countdown]"
    );

    if (headerETA) {
      headerETA.textContent =
        timeText(current.etaAt);
    }

    if (headerCountdown) {
      headerCountdown.textContent =
        countdownText(current);
    }

    const countdown = container.querySelector(
      "[data-countdown-output]"
    );

    const active = getActiveFlight(resource);

    if (countdown && active) {
      countdown.value = countdownText(active);
    }
  }

  /* ======================================
     ALARMOVERSIKT
     ========================================== */

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

    alarmPanel.hidden = alarms.length === 0;

    if (!alarms.length) {
      alarmPanel.classList.remove("alarm-active");
      alarmPanel.innerHTML = "";
      return;
    }

    alarmPanel.classList.add("alarm-active");

    alarmPanel.innerHTML = `
      <h3>⚠ MANGLENDE LANDINGSBEKREFTELSE</h3>

      <p>
        ETA + ${ALARM_MINUTES} minutter er passert
        uten bekreftet landing.
        Følg gjeldende prosedyre.
      </p>

      ${alarms.map(({ resource, flight, index }) => `
        <div class="ff-alarm-item">

          <div>
            <div class="ff-alarm-title">
              ${escapeHTML(resource.id)}
              – Flight leg ${index + 1}
            </div>

            <div>
              ETA: ${timeText(flight.etaAt)}
            </div>

            <div>
              ${display(flight.from)}
              →
              ${display(flight.to)}
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
              "Bekreft landing",
              "land",
              resource.id,
              index,
              "ff-land"
            )}

            ${button(
              "Vis ressurs",
              "select",
              resource.id
            )}

          </div>
        </div>
      `).join("")}
    `;
  }

  /* ======================================
     LYDALARM
     ========================================== */

  async function prepareAudio() {
    try {
      const AudioClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioClass) return false;

      if (
        !audioContext ||
        audioContext.state === "closed"
      ) {
        audioContext = new AudioClass();
      }

      if (audioContext.state !== "running") {
        await audioContext.resume();
      }

      audioReady =
        audioContext.state === "running";

      return audioReady;

    } catch (error) {
      audioReady = false;

      console.warn(
        "Alarmlyd kunne ikke aktiveres.",
        error
      );

      return false;
    }
  }

  function playAlarmSound() {
    if (
      !audioReady ||
      !audioContext ||
      audioContext.state !== "running"
    ) return false;

    try {
      const start = audioContext.currentTime;

      [0, 0.35, 0.7, 1.05].forEach(delay => {
        const oscillator =
          audioContext.createOscillator();

        const gain = audioContext.createGain();

        oscillator.type = "square";
        oscillator.frequency.value = 880;

        const t = start + delay;

        gain.gain.setValueAtTime(0.0001, t);

        gain.gain.exponentialRampToValueAtTime(
          0.09,
          t + 0.035
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          t + 0.27
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(t);
        oscillator.stop(t + 0.28);
      });

      return true;

    } catch (error) {
      console.warn("Alarmlyd mislyktes.", error);
      return false;
    }
  }

  /* ======================================
     SKRIVEBORDSVARSLER
     ========================================== */

  function sendNotification(resource, flight, index) {
    if (
      !("Notification" in window) ||
      !window.isSecureContext ||
      Notification.permission !== "granted"
    ) return;

    try {
      const notification = new Notification(
        "⚠ Flight Following – " + resource.id,
        {
          body:
            "Flight leg " + (index + 1) +
            ". ETA " + timeText(flight.etaAt) +
            ". Landing ikke bekreftet.",
          tag: "ff-" + resource.id + "-" + index,
          requireInteraction: true
        }
      );

      notification.onclick = () => {
        selectedResource = resource.id;
        renderAll();

        try {
          window.focus();
        } catch (error) {
          // Fokus er ikke garantert.
        }

        notification.close();
      };

    } catch (error) {
      console.warn(
        "Skrivebordsvarsel mislyktes.",
        error
      );
    }
  }

  /* ======================================
     ALARMKONTROLL
     ========================================== */

  function alarmSignature() {
    return getAlarms()
      .map(({ resource, index }) =>
        resource.id + ":" + index
      )
      .sort()
      .join("|");
  }

  function checkAlarms() {
    const alarms = getAlarms();
    const signature = alarmSignature();

    if (signature !== lastAlarmSignature) {
      lastAlarmSignature = signature;
      renderMain();
    }

    renderOverview();
    renderAlarms();
    updateVisibleTimes();

    const currentKeys = new Set(
      alarms.map(({ resource, index }) =>
        resource.id + ":" + index
      )
    );

    for (const key of notifiedAlarms) {
      if (!currentKeys.has(key)) {
        notifiedAlarms.delete(key);
      }
    }

    for (const { resource, flight, index } of alarms) {
      const key = resource.id + ":" + index;

      if (!notifiedAlarms.has(key)) {
        notifiedAlarms.add(key);
        sendNotification(resource, flight, index);
      }
    }

    if (alarms.length) {
      const names = [
        ...new Set(
          alarms.map(({ resource }) => resource.id)
        )
      ];

      document.title =
        "⚠ ALARM – " +
        names.join(", ") +
        " | Flight Following";
    } else {
      document.title = TITLE;
    }

    const soundRequired = alarms.some(
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
     KNAPPEHANDLING
     ========================================== */

  function handleAction(element) {
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

    if (!resourceId) return;

    const resource = resources.get(resourceId);

    if (!resource) return;

    const index = element.dataset.index !== undefined
      ? Number(element.dataset.index)
      : leg
        ? Number(leg.dataset.legIndex)
        : null;

    if (action === "select") {
      selectedResource = resourceId;
      renderAll();
      return;
    }

    if (action === "newleg") {
      addNewLeg(resourceId);
      return;
    }

    if (action === "end") {
      if (hasUnresolvedFlight(resource)) {
        alert(
          "Alle Flight legs må ha bekreftet landing " +
          "før Flight Following avsluttes."
        );
        return;
      }

      resourceToEnd = resourceId;

      $("endFFText").textContent =
        "Vil du avslutte Flight Following for " +
        resourceId +
        "? Alle Flight legs fjernes fra den lokale " +
        "oversikten. Skriv ut først dersom " +
        "historikken skal beholdes.";

      $("endFFDialog").showModal();
      return;
    }

    if (!Number.isInteger(index)) return;

    const flight = resource.flights[index];

    if (!flight) return;

    if (action === "expand") {
      flight.expanded = !flight.expanded;
      saveData();
      renderMain();
      return;
    }

    if (action === "departure") {
      registerDeparture(resourceId, index);
      return;
    }

    if (action === "land") {
      openLandingDialog(resourceId, index);
      return;
    }

    if (action === "correctland") {
      openLandingDialog(resourceId, index, true);
      return;
    }

    if (action === "abort") {
      abortLeg(resourceId, index);
      return;
    }

    if (action === "undo") {
      undoLanding(resourceId, index);
      return;
    }

    if (action === "silence") {
      flight.alarmSilenced = true;
      saveData();
      checkAlarms();
    }
  }

  function delegatedClick(event) {
    const element = event.target.closest(
      "[data-action]"
    );

    if (!element) return;

    handleAction(element);
  }

  container.addEventListener(
    "click",
    delegatedClick
  );

  overview.addEventListener(
    "click",
    delegatedClick
  );

  alarmPanel.addEventListener(
    "click",
    delegatedClick
  );

  container.addEventListener("input", event => {
    const input = event.target.closest(
      "[data-field]"
    );

    if (!input) return;

    updateField(input);
  });

  container.addEventListener("change", event => {
    const input = event.target.closest(
      "[data-field]"
    );

    if (!input) return;

    updateField(input);
    renderAll();
    checkAlarms();
  });

  /* ======================================
     DIALOGER
     ========================================== */

  $("newFFBtn").addEventListener("click", () => {
    $("resourceInput").value = "";
    $("newFFDialog").showModal();
    $("resourceInput").focus();
  });

  $("cancelNewFFBtn").addEventListener(
    "click",
    () => $("newFFDialog").close()
  );

  $("newFFForm").addEventListener(
    "submit",
    startNewFF
  );

  $("cancelLandFFBtn").addEventListener(
    "click",
    () => {
      landingTarget = null;
      $("landFFDialog").close();
    }
  );

  $("landFFForm").addEventListener(
    "submit",
    confirmLanding
  );

  $("cancelEndFFBtn").addEventListener(
    "click",
    () => {
      resourceToEnd = null;
      $("endFFDialog").close();
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

          if (selectedResource === resourceToEnd) {
            selectedResource =
              sortedResources()[0]?.id || null;
          }
        }
      }

      resourceToEnd = null;
      $("endFFDialog").close();

      saveData();
      renderAll();
      checkAlarms();
    }
  );

  /* ======================================
     UTSKRIFT
     ========================================== */

  function printColumns() {
    return [
      { label: "Flight leg", width: "6%" },
      { label: "Hensikt", width: "9%" },
      { label: "Fra", width: "9%" },
      { label: "Til", width: "9%" },
      { label: "Kommentar", width: "15%" },
      { label: "POB", width: "4%" },
      { label: "Tatt av", width: "8%" },
      { label: "ETE", width: "5%" },
      { label: "ETA", width: "8%" },
      { label: "Landing", width: "8%" },
      { label: "Landingssted informert", width: "10%" },
      { label: "Merknader", width: "9%" }
    ];
  }

  function printTableHeader() {
    return `
      <thead>
        <tr>
          ${printColumns().map(column => `
            <th style="width:${column.width}">
              ${column.label}
            </th>
          `).join("")}
        </tr>
      </thead>
    `;
  }

  function printFlightRow(flight, index) {
    const status =
      flight.status === "completed"
        ? "Landet"
        : flight.status === "aborted"
          ? "Avbrutt – ikke bekreftet"
          : "Aktiv";

    const notes = [
      flight.slingLoad ? "Underhengende" : "",
      flight.searchRescue ? "Søk/redning" : "",
      status
    ].filter(Boolean).join(", ");

    const values = [
      index + 1,
      flight.purpose,
      flight.from,
      flight.to,
      flight.description,
      flight.pob,
      timeText(flight.departureAt),
      flight.ete,
      timeText(flight.etaAt),
      timeText(flight.landedAt),
      flight.landingPlaceNotified ? "Ja" : "Nei",
      notes
    ];

    return `
      <tr>
        ${values.map(value => `
          <td>${display(value)}</td>
        `).join("")}
      </tr>
    `;
  }

  function printEmptyRow(number) {
    return `
      <tr class="ff-print-new">
        <td>${number}</td>
        ${Array.from(
          { length: printColumns().length - 1 },
          () => "<td></td>"
        ).join("")}
      </tr>
    `;
  }

  function printPageHeading(title, resourceId = "") {
    return `
      <div class="ff-print-heading">
        <h1>${escapeHTML(title)}</h1>
        <span>
          ${resourceId
            ? "Ressurs: " + escapeHTML(resourceId)
            : "Luftambulansekoordinator"}
        </span>
      </div>
    `;
  }

  function printResourceInfo(resourceId = "") {
    return `
      <div class="ff-print-info">

        <div class="ff-print-info-cell">
          <span class="ff-print-info-label">
            Ressurs-ID
          </span>
          <span class="ff-print-info-value">
            ${escapeHTML(resourceId)}
          </span>
        </div>

        <div class="ff-print-info-cell">
          <span class="ff-print-info-label">
            Dato
          </span>
          <span class="ff-print-info-value"></span>
        </div>

        <div class="ff-print-info-cell">
          <span class="ff-print-info-label">
            Flight Following – ansvarlig
          </span>
          <span class="ff-print-info-value"></span>
        </div>

      </div>
    `;
  }

  function printFooter() {
    return `
      <div class="ff-print-footer">
        Flight Following – reservepapir for manuell
        dokumentasjon. Følg gjeldende operative rutiner.
      </div>
    `;
  }

  /* ======================================
     AKTIVE FF + 5 TOMME FLIGHT LEGS
     ========================================== */

  function printActiveFF() {
    const items = sortedResources();

    if (!items.length) {
      alert("Ingen Flight Following er registrert.");
      return;
    }

    let html = "";

    for (const resource of items) {
      const existingRows = resource.flights
        .map((flight, index) =>
          printFlightRow(flight, index)
        )
        .join("");

      const emptyRows = Array.from(
        { length: 5 },
        (_, index) =>
          printEmptyRow(
            resource.flights.length + index + 1
          )
      ).join("");

      html += `
        <section class="ff-print-page">

          ${printPageHeading(
            "Flight Following – registrerte Flight legs",
            resource.id
          )}

          ${printResourceInfo(resource.id)}

          <table class="ff-print-table">
            ${printTableHeader()}
            <tbody>
              ${existingRows}
              ${emptyRows}
            </tbody>
          </table>

          <div class="ff-print-comment">
            <strong>Supplerende merknader:</strong>
          </div>

          ${printFooter()}

        </section>
      `;
    }

    $("printArea").innerHTML = html;
    window.print();
  }

  /* ======================================
     TOM FF – 10 FLIGHT LEGS
     ========================================== */

  function printBlankFF() {
    const emptyRows = Array.from(
      { length: 10 },
      (_, index) => printEmptyRow(index + 1)
    ).join("");

    $("printArea").innerHTML = `
      <section class="ff-print-page">

        ${printPageHeading(
          "Flight Following – blankt registreringsskjema"
        )}

        ${printResourceInfo()}

        <table class="ff-print-table">
          ${printTableHeader()}
          <tbody>
            ${emptyRows}
          </tbody>
        </table>

        <div class="ff-print-comment">
          <strong>Supplerende merknader:</strong>
        </div>

        ${printFooter()}

      </section>
    `;

    window.print();
  }

  $("printActiveBtn").addEventListener(
    "click",
    printActiveFF
  );

  $("printBlankBtn").addEventListener(
    "click",
    printBlankFF
  );

  /* ======================================
     LYDAKTIVERING
     ========================================== */

  document.addEventListener(
    "pointerdown",
    () => {
      if (!audioReady) {
        prepareAudio();
      }
    },
    { capture: true }
  );

  document.addEventListener(
    "keydown",
    () => {
      if (!audioReady) {
        prepareAudio();
      }
    },
    { capture: true }
  );

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

  /* ======================================
     START
     ========================================== */

  loadData();

  selectedResource =
    sortedResources()[0]?.id || null;

  renderAll();

  lastAlarmSignature = alarmSignature();

  checkAlarms();

  setInterval(
    checkAlarms,
    CHECK_INTERVAL
  );

})();
