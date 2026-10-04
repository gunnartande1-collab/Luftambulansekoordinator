"use strict";


const $ = (selector) =>
  document.querySelector(selector);


const $$ = (selector) =>
  [...document.querySelectorAll(selector)];



/* =========================================================
   STATUS
   ========================================================= */

const state = {

  altitudeUnit: "",

  altitudeReference: "",

  noFollowUp: false,

  notifications: {

    flightFollowing: "",
    police: "",
    nkom: "",
    opl: ""

  }

};


let copyTimer = null;



/* =========================================================
   LUFTFARTØYREGISTER

   Basert på oversikten som er lagt ved.

   Nye registreringer kan senere legges til her.
   ========================================================= */

const AIRCRAFT_TYPES = {

  /* H135 T3H */

  "LN-OUD": "H135T3H",
  "LN-OUE": "H135T3H",
  "LN-OUF": "H135T3H",
  "LN-OUG": "H135T3H",
  "LN-OUH": "H135T3H",
  "LN-OUJ": "H135T3H",


  /* H145 D2 */

  "LN-OOO": "H145 D2",
  "LN-OOR": "H145 D2",
  "LN-OOT": "H145 D2",
  "LN-OOX": "H145 D2",


  /* H145 D3 */

  "LN-OOA": "H145 D3",
  "LN-OOB": "H145 D3",
  "LN-OOU": "H145 D3",

  "LN-OTH": "H145 D3",
  "LN-OTI": "H145 D3",
  "LN-OTJ": "H145 D3",
  "LN-OTK": "H145 D3",
  "LN-OTN": "H145 D3",


  /* AW139 */

  "LN-ODL": "AW139",
  "LN-ODM": "AW139",


  /* POLITI */

  "LN-ORA": "AW169",
  "LN-ORB": "AW169",
  "LN-ORC": "AW169"

};



/* =========================================================
   OPPSTART
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialiseForm
  );

} else {

  initialiseForm();

}



function initialiseForm() {

  const form =
    $("#gpsForm");


  const panel =
    $(".form-panel");


  if (
    !form ||
    !panel
  ) {

    return;

  }


  setToday();


  form.addEventListener(
    "submit",
    (event) =>
      event.preventDefault()
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

  initialiseNotifications();

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



function formatDate(value) {

  if (!value) {
    return "";
  }


  const [
    year,
    month,
    day
  ] = value.split("-");


  if (
    !year ||
    !month ||
    !day
  ) {

    return value;

  }


  return (
    `${day}.${month}.${year}`
  );

}



/* =========================================================
   KLOKKESLETT
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
      .padStart(
        2,
        "0"
      ) +
    ":" +
    String(minute)
      .padStart(
        2,
        "0"
      )
  );

}



/* =========================================================
   NÅVÆRENDE KLOKKESLETT
   ========================================================= */

function currentTime() {

  const now =
    new Date();


  return (
    String(
      now.getHours()
    ).padStart(
      2,
      "0"
    ) +
    ":" +
    String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    )
  );

}



/* =========================================================
   TIDSSONE
   ========================================================= */

function getTimezone() {

  const dateValue =
    $("#eventDate")
      ?.value;


  if (!dateValue) {
    return "";
  }


  const date =
    new Date(
      `${dateValue}T12:00:00Z`
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

function handleInput(event) {

  const target =
    event.target;


  if (
    target.id ===
    "registration"
  ) {

    updateAircraftType();

  }


  if (
    target.id ===
    "aircraftType"
  ) {

    /*
     * Dersom operatøren selv skriver i typefeltet,
     * regnes det ikke lenger som automatisk utfylt.
     */

    delete target.dataset.autoFilled;

  }


  updateReport();

}



/* =========================================================
   FOCUS OUT
   ========================================================= */

function handleFocusOut(event) {

  const target =
    event.target;


  if (
    !(target instanceof HTMLInputElement)
  ) {

    return;

  }


  if (
    target.id ===
    "eventTime"
  ) {

    const formatted =
      formatTime(
        target.value
      );


    if (formatted) {

      target.value =
        formatted;

    }

  }


  if (
    target.id ===
    "registration"
  ) {

    target.value =
      normaliseRegistration(
        target.value
      );


    updateAircraftType();

  }


  updateReport();

}



/* =========================================================
   REGISTRERINGSNUMMER
   ========================================================= */

function normaliseRegistration(
  value
) {

  const text =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");


  if (
    /^LN[A-Z]{3}$/.test(text)
  ) {

    return (
      "LN-" +
      text.slice(2)
    );

  }


  if (
    /^[A-Z]{3}$/.test(text)
  ) {

    return (
      "LN-" +
      text
    );

  }


  return text;

}



/* =========================================================
   AUTOMATISK LUFTFARTØYTYPE
   ========================================================= */

function updateAircraftType() {

  const registrationField =
    $("#registration");


  const typeField =
    $("#aircraftType");


  if (
    !registrationField ||
    !typeField
  ) {

    return;

  }


  const registration =
    normaliseRegistration(
      registrationField.value
    );


  const type =
    AIRCRAFT_TYPES[
      registration
    ];


  /*
   * Treffer registreringen i registeret:
   * fyll type automatisk.
   */

  if (type) {

    typeField.value =
      type;


    typeField.dataset.autoFilled =
      "true";


    return;

  }


  /*
   * Dersom tidligere automatisk type ikke lenger
   * passer registreringen, fjernes den.
   *
   * Manuelt skrevet type beholdes.
   */

  if (
    typeField.dataset.autoFilled ===
    "true"
  ) {

    typeField.value =
      "";


    delete typeField.dataset.autoFilled;

  }

}



/* =========================================================
   VALIDER HENDELSESTID
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
   HØYDE
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


          state[stateKey] =
            state[stateKey] ===
            value
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
   VARSLING
   ========================================================= */

function initialiseNotifications() {

  $$(".notification-time-button")
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const key =
              button.dataset.notification;


            if (!key) {
              return;
            }


            /*
             * Første klikk setter tidspunkt nå.
             *
             * Klikker man igjen, fjernes registreringen.
             * Dermed fungerer den som en avkrysningsboks.
             */

            if (
              state.notifications[key]
            ) {

              state.notifications[key] =
                "";

            } else {

              state.notifications[key] =
                currentTime();

            }


            updateNotificationButtons();

            updateReport();

          }
        );

      }
    );


  updateNotificationButtons();

}



function updateNotificationButtons() {

  $$(".notification-time-button")
    .forEach(
      (button) => {

        const key =
          button.dataset.notification;


        const time =
          state.notifications[key];


        const selected =
          Boolean(time);


        button.classList.toggle(
          "is-selected",
          selected
        );


        button.setAttribute(
          "aria-pressed",
          String(selected)
        );


        const text =
          button.querySelector(
            ".notification-time-text"
          );


        if (text) {

          text.textContent =
            selected
              ? time
              : "Registrer";

        }

      }
    );

}



/* =========================================================
   VIDERE OPPFØLGING
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

        field.value =
          "";


        field.disabled =
          true;

      } else {

        field.disabled =
          false;

      }


      updateReport();

    }
  );

}



/* =========================================================
   FELTVERDI
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
   RAPPORTTID
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
   POSISJON
   ========================================================= */

function buildPosition() {

  const position =
    value("position");


  const area =
    value("placeName");


  if (
    position &&
    area
  ) {

    return (
      `${position} – ${area}`
    );

  }


  return (
    position ||
    area
  );

}



/* =========================================================
   HØYDE
   ========================================================= */

function buildAltitude() {

  return [

    value("altitude"),

    state.altitudeUnit,

    state.altitudeReference

  ]
    .filter(Boolean)
    .join(" ");

}



/* =========================================================
   LUFTFARTØY
   ========================================================= */

function buildAircraft() {

  return [

    normaliseRegistration(
      value("registration")
    ),

    value("callsign"),

    value("aircraftType")

  ]
    .filter(Boolean)
    .join(" – ");

}



/* =========================================================
   VARSLING I RAPPORT
   ========================================================= */

function buildNotificationReport() {

  const lines = [];


  const flightFollowing =
    state.notifications
      .flightFollowing;


  const police =
    state.notifications
      .police;


  const nkom =
    state.notifications
      .nkom;


  const opl =
    state.notifications
      .opl;


  if (flightFollowing) {

    lines.push(
      `HKP med flight following fått beskjed på TG kl. ${flightFollowing}`
    );

  }


  if (police) {

    const district =
      value(
        "policeDistrict"
      );


    lines.push(
      district
        ? `${district} operasjonssentral varslet kl. ${police}`
        : `Politiets lokale operasjonssentral varslet kl. ${police}`
    );

  }


  if (nkom) {

    lines.push(
      `Nkom beredskapsvakt varslet kl. ${nkom}`
    );

  }


  if (opl) {

    lines.push(
      `OPL AMK Oslo varslet kl. ${opl}`
    );

  }


  return lines.join(
    ". "
  );

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
   GENERER RAPPORT
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

    `Varsling: ${buildNotificationReport()}`,

    `Videre oppfølging: ${buildFollowUp()}`,

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


  let copied =
    false;


  try {

    if (
      navigator.clipboard
        ?.writeText
    ) {

      await navigator.clipboard
        .writeText(
          report.value
        );


      copied =
        true;

    }

  } catch {

    copied =
      false;

  }


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

      copied =
        false;

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
   E-POSTEMNE
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
   SEND TIL NKOM
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
   TILBAKEMELDING
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
   NULLSTILL SKJEMA
   ========================================================= */

function resetForm() {

  $("#gpsForm")
    ?.reset();


  state.altitudeUnit =
    "";


  state.altitudeReference =
    "";


  state.noFollowUp =
    false;


  state.notifications = {

    flightFollowing: "",
    police: "",
    nkom: "",
    opl: ""

  };


  $$(".chip")
    .forEach(
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

    followUp.disabled =
      false;

  }


  const aircraftType =
    $("#aircraftType");


  if (aircraftType) {

    delete aircraftType
      .dataset
      .autoFilled;

  }


  updateNotificationButtons();


  setToday();


  clearCopyConfirmation();


  updateReport();


  $("#reportOutput")
    ?.scrollTo({
      top: 0
    });


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