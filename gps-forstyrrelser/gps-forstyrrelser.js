"use strict";


const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  [...document.querySelectorAll(selector)];


const state = {
  altitudeUnit: "",
  altitudeReference: "",
  noFollowUp: false
};


let copyTimer = null;


/* =========================================================
   OPPSTART
   ========================================================= */

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initialiseForm
  );

} else {

  initialiseForm();

}


function initialiseForm() {

  const form = $("#gpsForm");

  const panel = $(".form-panel");


  if (!form || !panel) {
    return;
  }


  setToday();


  form.addEventListener(
    "submit",
    (event) => event.preventDefault()
  );


  panel.addEventListener(
    "input",
    handleInput
  );


  panel.addEventListener(
    "focusout",
    handleFocusOut
  );


  initialiseAltitudeChips();

  initialiseFollowUp();

  initialiseScrollHint();


  $("#copyButton")
    ?.addEventListener(
      "click",
      copyReport
    );


  $("#resetButton")
    ?.addEventListener(
      "click",
      resetForm
    );


  $("#sendNkomButton")
    ?.addEventListener(
      "click",
      createNkomEmail
    );


  $("#feedbackButton")
    ?.addEventListener(
      "click",
      createFeedbackEmail
    );


  updateReport();

}


/* =========================================================
   DATO
   ========================================================= */

function setToday() {

  const field =
    $("#eventDate");


  if (!field) {
    return;
  }


  const today =
    new Date();


  const year =
    today.getFullYear();


  const month =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const day =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );


  field.value =
    `${year}-${month}-${day}`;

}


/* =========================================================
   FORMATTER DATO
   ========================================================= */

function formatDate(value) {

  if (!value) {
    return "";
  }


  const parts =
    value.split("-");


  if (parts.length !== 3) {
    return value;
  }


  const [
    year,
    month,
    day
  ] = parts;


  return (
    `${day}.${month}.${year}`
  );

}


/* =========================================================
   KLOKKESLETT

   Tillater:
   2350
   23:50
   950
   09:50
   ========================================================= */

function formatTime(value) {

  const text =
    String(value ?? "")
      .trim()
      .replace(".", ":");


  if (!text) {
    return "";
  }


  let hour;

  let minute;


  const match =
    text.match(
      /^(\d{1,2}):(\d{2})$/
    );


  if (match) {

    hour =
      Number(match[1]);

    minute =
      Number(match[2]);

  } else if (
    /^\d{3,4}$/.test(text)
  ) {

    const digits =
      text.padStart(
        4,
        "0"
      );


    hour =
      Number(
        digits.slice(
          0,
          2
        )
      );


    minute =
      Number(
        digits.slice(2)
      );

  } else {

    return "";

  }


  if (
    hour > 23 ||
    minute > 59
  ) {

    return "";

  }


  return (
    String(hour)
      .padStart(2, "0") +
    ":" +
    String(minute)
      .padStart(2, "0")
  );

}


/* =========================================================
   TIDSSONE

   Bruker valgt dato og Europe/Oslo.
   Resultat:
   CET  = vintertid
   CEST = sommertid
   ========================================================= */

function getTimezone() {

  const value =
    $("#eventDate")
      ?.value;


  if (!value) {
    return "";
  }


  /*
   * Kl. 12 UTC brukes bevisst for å unngå
   * problemer akkurat rundt midnatt.
   */

  const date =
    new Date(
      `${value}T12:00:00Z`
    );


  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Europe/Oslo",

        timeZoneName:
          "shortOffset"
      }
    )
      .formatToParts(date);


  const timezonePart =
    parts.find(
      (part) =>
        part.type ===
        "timeZoneName"
    );


  const offset =
    timezonePart
      ?.value ?? "";


  if (
    offset.includes("+2") ||
    offset.includes("+02")
  ) {

    return "CEST";

  }


  return "CET";

}


/* =========================================================
   INPUT
   ========================================================= */

function handleInput() {

  updateReport();

}


/* =========================================================
   FOCUS OUT

   Klokkeslett formateres først når brukeren
   går ut av feltet.
   ========================================================= */

function handleFocusOut(event) {

  const target =
    event.target;


  if (
    !(target instanceof HTMLInputElement)
  ) {

    return;

  }


  const timeFields = [
    "eventTime",
    "nkomTime",
    "policeTime"
  ];


  if (
    timeFields.includes(
      target.id
    )
  ) {

    const raw =
      target.value.trim();


    if (raw) {

      const formatted =
        formatTime(raw);


      if (formatted) {

        target.value =
          formatted;

      }

    }

  }


  updateReport();

}


/* =========================================================
   VALIDER KLOKKESLETT
   ========================================================= */

function validateEventTime() {

  const field =
    $("#eventTime");


  const error =
    $("#timeError");


  if (
    !field ||
    !error
  ) {

    return true;

  }


  const text =
    field.value.trim();


  if (
    text &&
    !formatTime(text)
  ) {

    error.textContent =
      "Ugyldig klokkeslett. Bruk for eksempel 2350 eller 23:50.";


    field.setAttribute(
      "aria-invalid",
      "true"
    );


    return false;

  }


  error.textContent =
    "";


  field.removeAttribute(
    "aria-invalid"
  );


  return true;

}


/* =========================================================
   HØYDECHIPS
   ========================================================= */

function initialiseAltitudeChips() {

  initialiseSingleChoiceChips(
    "#altitudeUnitChips .chip",
    "altitudeUnit"
  );


  initialiseSingleChoiceChips(
    "#altitudeReferenceChips .chip",
    "altitudeReference"
  );

}


function initialiseSingleChoiceChips(
  selector,
  stateKey
) {

  const buttons =
    $$(selector);


  buttons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const value =
            button.dataset.value;


          const wasSelected =
            state[stateKey] ===
            value;


          state[stateKey] =
            wasSelected
              ? ""
              : value;


          buttons.forEach(
            (item) => {

              const selected =
                item.dataset.value ===
                state[stateKey];


              item.classList.toggle(
                "is-selected",
                selected
              );


              item.setAttribute(
                "aria-pressed",
                String(selected)
              );

            }
          );


          updateReport();

        }
      );

    }
  );

}


/* =========================================================
   INGEN AVTALE
   ========================================================= */

function initialiseFollowUp() {

  const button =
    $("#noFollowUpButton");


  const field =
    $("#followUp");


  if (
    !button ||
    !field
  ) {

    return;

  }


  button.addEventListener(
    "click",
    () => {

      state.noFollowUp =
        !state.noFollowUp;


      button.classList.toggle(
        "is-selected",
        state.noFollowUp
      );


      button.setAttribute(
        "aria-pressed",
        String(
          state.noFollowUp
        )
      );


      if (
        state.noFollowUp
      ) {

        field.value = "";

        field.disabled = true;

        field.placeholder =
          "Ingen avtale valgt";

      } else {

        field.disabled = false;

        field.placeholder =
          "Kort beskrivelse";

      }


      updateReport();

    }
  );

}


/* =========================================================
   HENT VERDI
   ========================================================= */

function value(id) {

  return (
    $("#" + id)
      ?.value
      ?.trim() ??
    ""
  );

}


/* =========================================================
   TIDSPUNKT I RAPPORT
   ========================================================= */

function reportTime(id) {

  const raw =
    value(id);


  if (!raw) {
    return "";
  }


  return (
    formatTime(raw) ||
    "[kontroller klokkeslett]"
  );

}


/* =========================================================
   POSISJON / OMRÅDE
   ========================================================= */

function buildPosition() {

  const position =
    value("position");


  const placeName =
    value("placeName");


  if (
    position &&
    placeName
  ) {

    return (
      `${position} – ${placeName}`
    );

  }


  return (
    position ||
    placeName
  );

}


/* =========================================================
   HØYDE
   ========================================================= */

function buildAltitude() {

  const altitude =
    value("altitude");


  const parts = [];


  if (altitude) {

    parts.push(
      altitude
    );

  }


  if (
    state.altitudeUnit
  ) {

    parts.push(
      state.altitudeUnit
    );

  }


  if (
    state.altitudeReference
  ) {

    parts.push(
      state.altitudeReference
    );

  }


  return parts.join(" ");

}


/* =========================================================
   LUFTFARTØY
   ========================================================= */

function buildAircraft() {

  const callsign =
    value("callsign");


  const type =
    value("aircraftType");


  return [
    callsign,
    type
  ]
    .filter(Boolean)
    .join(" – ");

}


/* =========================================================
   VARSLING
   ========================================================= */

function buildNotification() {

  const nkomTime =
    reportTime(
      "nkomTime"
    );


  const policeDistrict =
    value(
      "policeDistrict"
    );


  const policeTime =
    reportTime(
      "policeTime"
    );


  const lines = [];


  if (nkomTime) {

    lines.push(
      `Nkoms beredskapsvakt telefonvarslet kl. ${nkomTime}`
    );

  }


  if (
    policeDistrict &&
    policeTime
  ) {

    lines.push(
      `${policeDistrict} varslet kl. ${policeTime}`
    );

  } else if (
    policeDistrict
  ) {

    lines.push(
      `${policeDistrict} varslet`
    );

  } else if (
    policeTime
  ) {

    lines.push(
      `Politiet varslet kl. ${policeTime}`
    );

  }


  return lines.join(". ");

}


/* =========================================================
   VIDERE OPPFØLGING
   ========================================================= */

function buildFollowUp() {

  if (
    state.noFollowUp
  ) {

    return "Ingen avtale";

  }


  return value(
    "followUp"
  );

}


/* =========================================================
   RAPPORT

   Navnet er IKKE et eget rapportpunkt.
   Det brukes kun i signaturen.
   ========================================================= */

function generateReport() {

  const date =
    formatDate(
      value("eventDate")
    );


  const time =
    reportTime(
      "eventTime"
    );


  const timezone =
    getTimezone();


  const senderName =
    value(
      "senderName"
    );


  const lines = [

    "AMK-LA Oslo har mottatt melding om GNSS-forstyrrelser.",

    "",

    `Tidspunkt for forstyrrelsen: ${[
      date,
      time,
      timezone
    ].filter(Boolean).join(", ")}`,

    `Posisjon/område: ${buildPosition()}`,

    `Høyde: ${buildAltitude()}`,

    `Luftfartøy: ${buildAircraft()}`,

    `Beskrivelse: ${value("description")}`,

    `Operative konsekvenser og tiltak: ${value("consequences")}`,

    `Gjennomført varsling: ${buildNotification()}`,

    `Avtalt videre oppfølging: ${buildFollowUp()}`,

    "",

    "Med vennlig hilsen",

    "",

    senderName,

    "Luftambulansekoordinator",

    "Prehospital klinikk | AMK-LA Oslo",

    "Oslo universitetssykehus HF",

    "648 95 749 | la-oslo.amk@ous-hf.no",

    "www.oslo-universitetssykehus.no",

    "",

    "Denne meldingen inneholder ikke sensitiv informasjon som bryter med Oslo universitetssykehus HFs krav til informasjonssikkerhet"

  ];


  return lines.join("\n");

}


/* =========================================================
   OPPDATER RAPPORT
   ========================================================= */

function updateReport() {

  validateEventTime();


  const timezoneInfo =
    $("#timezoneInfo");


  if (timezoneInfo) {

    timezoneInfo.textContent =
      getTimezone()
        ? `Tidssone i rapport: ${getTimezone()}`
        : "";

  }


  const output =
    $("#reportOutput");


  if (output) {

    output.value =
      generateReport();

  }


  updateFormScrollHint();

}


/* =========================================================
   KOPIER RAPPORT
   ========================================================= */

async function copyReport() {

  updateReport();


  const report =
    $("#reportOutput");


  if (!report) {
    return;
  }


  let copied = false;


  try {

    if (
      navigator.clipboard
        ?.writeText
    ) {

      await navigator.clipboard.writeText(
        report.value
      );


      copied = true;

    }

  } catch {

    copied = false;

  }


  /*
   * Fallback for miljøer hvor clipboard-API ikke fungerer.
   */

  if (!copied) {

    const previousFocus =
      document.activeElement;


    report.focus({
      preventScroll: true
    });


    report.select();


    try {

      copied =
        document.execCommand(
          "copy"
        );

    } catch {

      copied = false;

    }


    if (
      previousFocus instanceof
      HTMLElement
    ) {

      previousFocus.focus({
        preventScroll: true
      });

    }

  }


  const button =
    $("#copyButton");


  const text =
    $("#copyButtonText");


  clearTimeout(
    copyTimer
  );


  if (text) {

    text.textContent =
      copied
        ? "Tekst kopiert"
        : "Kopiering mislyktes";

  }


  if (button) {

    button.classList.remove(
      "copy-flash"
    );


    void button.offsetWidth;


    if (copied) {

      button.classList.add(
        "copy-flash"
      );

    }

  }


  copyTimer =
    setTimeout(
      clearCopyConfirmation,
      5000
    );

}


function clearCopyConfirmation() {

  clearTimeout(
    copyTimer
  );


  const text =
    $("#copyButtonText");


  if (text) {

    text.textContent =
      "Kopier tekst";

  }


  $("#copyButton")
    ?.classList.remove(
      "copy-flash"
    );

}


/* =========================================================
   EMNE TIL NKOM
   ========================================================= */

function buildEmailSubject() {

  const area =
    value("placeName") ||
    "område ikke oppgitt";


  const date =
    formatDate(
      value("eventDate")
    );


  const time =
    reportTime(
      "eventTime"
    );


  return (
    `GNSS-forstyrrelser ${area}, ${date} ${time}`
  ).trim();

}


/* =========================================================
   SEND E-POST TIL NKOM

   Åpner standard e-postprogram.
   Dersom Outlook er standard på OUS-PC-en, åpnes Outlook.
   ========================================================= */

function createNkomEmail() {

  updateReport();


  const recipient =
    "ekomvarsling@nkom.no";


  const cc =
    "geisto@ous-hf.no";


  const subject =
    buildEmailSubject();


  const body =
    generateReport();


  const url =
    `mailto:${recipient}` +
    `?cc=${encodeURIComponent(cc)}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;


  window.location.href =
    url;

}


/* =========================================================
   TILBAKEMELDING PÅ SKJEMA
   ========================================================= */

function createFeedbackEmail() {

  const recipient =
    "b32838@ous.hf.no";


  const subject =
    "GPS forstyrrelser";


  window.location.href =
    `mailto:${recipient}` +
    `?subject=${encodeURIComponent(subject)}`;

}


/* =========================================================
   TØM SKJEMA
   ========================================================= */

function resetForm() {

  const form =
    $("#gpsForm");


  form?.reset();


  state.altitudeUnit = "";

  state.altitudeReference = "";

  state.noFollowUp = false;


  $$(".chip").forEach(
    (button) => {

      button.classList.remove(
        "is-selected"
      );


      button.setAttribute(
        "aria-pressed",
        "false"
      );

    }
  );


  const followUp =
    $("#followUp");


  if (followUp) {

    followUp.disabled = false;

    followUp.placeholder =
      "Kort beskrivelse";

  }


  setToday();


  clearCopyConfirmation();


  updateReport();


  const report =
    $("#reportOutput");


  if (report) {

    report.scrollTop = 0;

  }


  $(".form-panel")
    ?.scrollTo({

      top: 0,

      behavior:
        motionBehavior()

    });


  window.scrollTo({

    top: 0,

    behavior:
      motionBehavior()

  });

}


/* =========================================================
   RULLEINDIKATOR
   ========================================================= */

function motionBehavior() {

  return window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
    ? "auto"
    : "smooth";

}


function initialiseScrollHint() {

  const panel =
    $(".form-panel");


  panel?.addEventListener(

    "scroll",

    updateFormScrollHint,

    {
      passive: true
    }

  );


  $("#formScrollHint")
    ?.addEventListener(
      "click",
      () => {

        panel?.scrollBy({

          top:
            panel.clientHeight *
            0.7,

          behavior:
            motionBehavior()

        });

      }
    );


  window.addEventListener(
    "resize",
    updateFormScrollHint
  );


  if (
    window.ResizeObserver
  ) {

    const observer =
      new ResizeObserver(
        updateFormScrollHint
      );


    if (panel) {

      observer.observe(
        panel
      );

    }


    const form =
      $("#gpsForm");


    if (form) {

      observer.observe(
        form
      );

    }

  }


  updateFormScrollHint();

}


function updateFormScrollHint() {

  const panel =
    $(".form-panel");


  const hint =
    $("#formScrollHint");


  if (
    !panel ||
    !hint
  ) {

    return;

  }


  hint.hidden =
    panel.scrollHeight -
    panel.clientHeight -
    panel.scrollTop <
    12;

}