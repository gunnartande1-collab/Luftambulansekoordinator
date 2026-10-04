"use strict";


/* =========================================================
   KORTE HJELPEFUNKSJONER
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);


const $$ = (selector) =>
  [...document.querySelectorAll(selector)];



/* =========================================================
   STATUS
   ========================================================= */

const state = {

  altitudeUnit: "",

  altitudeReference: ""

};


let copyTimer = null;



/* =========================================================
   LUFTFARTØYREGISTER

   Basert på oversikten som er lagt ved.

   LN-ORA / ORB / ORC er lagt inn som AW169.
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


  /* POLITIHELIKOPTER */

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


  /* Dagens dato */

  setToday();


  /* Ikke la skjemaet sendes normalt */

  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

    }
  );


  /* Input */

  panel.addEventListener(
    "input",
    handleInput
  );


  /* Når bruker går ut av et felt */

  panel.addEventListener(
    "focusout",
    handleFocusOut
  );


  /* Chips */

  initialiseAltitudeChips();


  /* Klikkbare klokkeslett */

  initialiseTimeFields();


  /* Rulleindikator */

  initialiseScrollHint();


  /* Kopier */

  $("#copyButton")
    ?.addEventListener(
      "click",
      copyReport
    );


  /* Nullstill */

  $("#resetButton")
    ?.addEventListener(
      "click",
      resetForm
    );


  /* Send til Nkom */

  $("#sendNkomButton")
    ?.addEventListener(
      "click",
      createNkomEmail
    );


  /* Tilbakemelding */

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


  const parts =
    value.split("-");


  if (
    parts.length !==
    3
  ) {

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
   NÅVÆRENDE KLOKKESLETT
   ========================================================= */

function currentTime() {

  const now =
    new Date();


  const hour =
    String(
      now.getHours()
    ).padStart(
      2,
      "0"
    );


  const minute =
    String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    );


  return (
    `${hour}:${minute}`
  );

}



/* =========================================================
   FORMATTER KLOKKESLETT

   Eksempel:
   930   -> 09:30
   0930  -> 09:30
   09:30 -> 09:30
   09.30 -> 09:30
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


  const colonMatch =
    text.match(
      /^(\d{1,2}):(\d{2})$/
    );


  if (colonMatch) {

    hour =
      Number(
        colonMatch[1]
      );


    minute =
      Number(
        colonMatch[2]
      );

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
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
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
   KLIKKBARE KLOKKESLETTFELT
   ========================================================= */

function initialiseTimeFields() {

  /*
   * Tidspunkt for selve hendelsen.
   *
   * Brukeren kan:
   * - klikke i tomt felt -> tiden nå settes inn
   * - skrive manuelt
   */

  const eventTime =
    $("#eventTime");


  eventTime
    ?.addEventListener(
      "click",
      () => {

        if (
          !eventTime.value.trim()
        ) {

          eventTime.value =
            currentTime();


          updateReport();

        }

      }
    );


  /*
   * Varslingsfeltene.
   *
   * Et klikk setter klokkeslettet til tiden akkurat nå.
   * Klikker man igjen senere, oppdateres klokkeslettet.
   */

  const notificationFields = [

    "flightFollowingTime",

    "policeTime",

    "nkomTime",

    "oplTime"

  ];


  notificationFields
    .forEach(
      (id) => {

        const field =
          $("#" + id);


        if (!field) {

          return;

        }


        field.addEventListener(
          "click",
          () => {

            field.value =
              currentTime();


            field.classList.add(
              "has-time"
            );


            updateReport();

          }
        );


        /*
         * Keyboard:
         * Enter / mellomrom setter også tiden.
         */

        field.addEventListener(
          "keydown",
          (event) => {

            if (
              event.key !==
                "Enter" &&
              event.key !==
                " "
            ) {

              return;

            }


            event.preventDefault();


            field.value =
              currentTime();


            field.classList.add(
              "has-time"
            );


            updateReport();

          }
        );

      }
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
      .formatToParts(
        date
      );


  const timezonePart =
    parts.find(
      (part) => {

        return (
          part.type ===
          "timeZoneName"
        );

      }
    );


  const offset =
    timezonePart
      ?.value ??
    "";


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


  /*
   * Når registreringsnummer skrives,
   * forsøk automatisk å finne luftfartøytype.
   */

  if (
    target.id ===
    "registration"
  ) {

    updateAircraftType();

  }


  updateReport();

}



/* =========================================================
   NÅR BRUKER FORLATER FELT
   ========================================================= */

function handleFocusOut(event) {

  const target =
    event.target;


  if (
    !(target instanceof HTMLInputElement)
  ) {

    return;

  }


  /*
   * Formatter hendelsestid.
   */

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


  /*
   * Formatter registreringsnummer.
   */

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

          const buttonValue =
            button.dataset.value;


          /*
           * Klikk på valgt chip en gang til
           * fjerner valget.
           */

          if (
            state[stateKey] ===
            buttonValue
          ) {

            state[stateKey] =
              "";

          } else {

            state[stateKey] =
              buttonValue;

          }


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
   REGISTRERINGSNUMMER
   ========================================================= */

function normaliseRegistration(
  value
) {

  const text =
    String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(
        /\s+/g,
        ""
      );


  /*
   * LNOUD -> LN-OUD
   */

  if (
    /^LN[A-Z]{3}$/.test(text)
  ) {

    return (
      "LN-" +
      text.slice(2)
    );

  }


  /*
   * OUD -> LN-OUD
   */

  if (
    /^[A-Z]{3}$/.test(text)
  ) {

    return (
      "LN-" +
      text
    );

  }


  /*
   * LN-OUD beholdes.
   */

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


  const aircraftType =
    AIRCRAFT_TYPES[
      registration
    ];


  if (aircraftType) {

    typeField.value =
      aircraftType;

  } else {

    typeField.value =
      "";

  }

}



/* =========================================================
   VERDI FRA FELT
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
   TID I RAPPORT
   ========================================================= */

function reportTime(id) {

  const raw =
    value(id);


  if (!raw) {

    return "";

  }


  return (
    formatTime(raw) ||
    raw
  );

}



/* =========================================================
   POSISJON / OMRÅDE
   ========================================================= */

function buildPosition() {

  const position =
    value(
      "position"
    );


  const placeName =
    value(
      "placeName"
    );


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

  const parts = [

    value(
      "altitude"
    ),

    state.altitudeUnit,

    state.altitudeReference

  ]
    .filter(Boolean);


  return (
    parts.join(" ")
  );

}



/* =========================================================
   LUFTFARTØY
   ========================================================= */

function buildAircraft() {

  const resourceId =
    value(
      "resourceId"
    );


  const registration =
    normaliseRegistration(
      value(
        "registration"
      )
    );


  const aircraftType =
    value(
      "aircraftType"
    );


  return [

    resourceId,

    registration,

    aircraftType

  ]
    .filter(Boolean)
    .join(" – ");

}



/* =========================================================
   VARSLING I RAPPORT
   ========================================================= */

function buildNotificationReport() {

  const lines = [];


  const flightFollowingTime =
    value(
      "flightFollowingTime"
    );


  const policeTime =
    value(
      "policeTime"
    );


  const nkomTime =
    value(
      "nkomTime"
    );


  const oplTime =
    value(
      "oplTime"
    );


  if (
    flightFollowingTime
  ) {

    lines.push(
      `HKP med flight following fått beskjed på TG kl. ${flightFollowingTime}`
    );

  }


  if (
    policeTime
  ) {

    lines.push(
      `Politiets lokale operasjonssentral varslet kl. ${policeTime}`
    );

  }


  if (
    nkomTime
  ) {

    lines.push(
      `Nkom beredskapsvakt varslet kl. ${nkomTime}`
    );

  }


  if (
    oplTime
  ) {

    lines.push(
      `OPL AMK Oslo varslet kl. ${oplTime}`
    );

  }


  return (
    lines.join(". ")
  );

}



/* =========================================================
   GENERER RAPPORT
   ========================================================= */

function generateReport() {

  const date =
    formatDate(
      value(
        "eventDate"
      )
    );


  const time =
    reportTime(
      "eventTime"
    );


  const timezone =
    getTimezone();


  const followUp =
    value(
      "followUp"
    );


  const senderName =
    value(
      "senderName"
    );


  const lines = [

    "AMK-LA Oslo har mottatt melding om GNSS-forstyrrelser.",

    "",

    `Tidspunkt for forstyrrelsen: ${
      [
        date,
        time,
        timezone
      ]
        .filter(Boolean)
        .join(", ")
    }`,

    `Posisjon/område: ${buildPosition()}`,

    `Høyde: ${buildAltitude()}`,

    `Luftfartøy: ${buildAircraft()}`,

    `Beskrivelse: ${value("description")}`,

    `Operative konsekvenser og tiltak: ${value("consequences")}`,

    `Varsling: ${buildNotificationReport()}`,

    `Videre oppfølging: ${followUp}`,

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


  return (
    lines.join("\n")
  );

}



/* =========================================================
   OPPDATER RAPPORT
   ========================================================= */

function updateReport() {

  validateEventTime();


  /*
   * Oppdater tidssoneinformasjon.
   */

  const timezoneInfo =
    $("#timezoneInfo");


  if (timezoneInfo) {

    const timezone =
      getTimezone();


    timezoneInfo.textContent =
      timezone
        ? `Tidssone i rapport: ${timezone}`
        : "";

  }


  /*
   * Oppdater rapportfelt.
   */

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


  /*
   * Moderne clipboard API.
   */

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


  /*
   * Fallback.
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


  clearTimeout(
    copyTimer
  );


  const button =
    $("#copyButton");


  const text =
    $("#copyButtonText");


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
    value(
      "placeName"
    ) ||
    "område ikke oppgitt";


  const date =
    formatDate(
      value(
        "eventDate"
      )
    );


  const time =
    reportTime(
      "eventTime"
    );


  const details =
    [
      area,
      date,
      time
    ]
      .filter(Boolean)
      .join(", ");


  return (
    `GNSS-forstyrrelser ${details}`
  );

}



/* =========================================================
   SEND VARSLING PÅ E-POST
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


  const mailto =
    `mailto:${recipient}` +
    `?cc=${encodeURIComponent(cc)}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;


  window.location.href =
    mailto;

}



/* =========================================================
   TILBAKEMELDING PÅ SKJEMA
   ========================================================= */

function createFeedbackEmail() {

  const recipient =
    "b32838@ous.hf.no";


  const subject =
    "GPS forstyrrelser";


  const mailto =
    `mailto:${recipient}` +
    `?subject=${encodeURIComponent(subject)}`;


  window.location.href =
    mailto;

}



/* =========================================================
   NULLSTILL SKJEMA
   ========================================================= */

function resetForm() {

  const form =
    $("#gpsForm");


  if (form) {

    form.reset();

  }


  /*
   * Nullstill chips.
   */

  state.altitudeUnit =
    "";


  state.altitudeReference =
    "";


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


  /*
   * Fjern grønne klokkeslett.
   */

  $$(".notification-time-field")
    .forEach(
      (field) => {

        field.value =
          "";


        field.classList.remove(
          "has-time"
        );

      }
    );


  /*
   * Typefelt må også tømmes.
   */

  const aircraftType =
    $("#aircraftType");


  if (aircraftType) {

    aircraftType.value =
      "";

  }


  /*
   * Dato skal automatisk settes tilbake til i dag.
   */

  setToday();


  /*
   * Kopieringsstatus.
   */

  clearCopyConfirmation();


  /*
   * Oppdater rapport.
   */

  updateReport();


  /*
   * Rapport til toppen.
   */

  const report =
    $("#reportOutput");


  if (report) {

    report.scrollTop =
      0;

  }


  /*
   * Skjema til toppen.
   */

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
   BEVEGELSE
   ========================================================= */

function motionBehavior() {

  return (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? "auto"
      : "smooth"
  );

}



/* =========================================================
   RULLEINDIKATOR
   ========================================================= */

function initialiseScrollHint() {

  const panel =
    $(".form-panel");


  panel
    ?.addEventListener(

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

        if (!panel) {

          return;

        }


        panel.scrollBy({

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
        () => {

          updateFormScrollHint();

        }
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