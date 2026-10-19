
"use strict";

/* =====================================================
   GPS-FORSTYRRELSER
   LUFTAMBULANSEKOORDINATOR
   ===================================================== */

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  altitudeUnit: "",
  altitudeReference: ""
};

let copyTimer = null;

/* =====================================================
   INNSTILLINGER
   ===================================================== */

const LOGO_FILE = "logo-ous-e-post.png";

const EMAIL = {
  to: "ekomvarsling@nkom.no",
  cc: ["geisto@ous-hf.no", "operativ.vakttelefon@nla-helikopter.no", "la.oslo.amk@ous-hf.no"],
  feedback: "b32838@ous-hf.no",
  replyAddress: "la-oslo.amk@ous-hf.no",
  website: "https://www.oslo-universitetssykehus.no"
};

/* =====================================================
   LUFTFARTØYREGISTER
   ===================================================== */

const AIRCRAFT_TYPES = {
  "LN-OUD": "H135T3H",
  "LN-OUE": "H135T3H",
  "LN-OUF": "H135T3H",
  "LN-OUG": "H135T3H",
  "LN-OUH": "H135T3H",
  "LN-OUJ": "H135T3H",

  "LN-OOO": "H145 D2",
  "LN-OOR": "H145 D2",
  "LN-OOT": "H145 D2",
  "LN-OOX": "H145 D2",

  "LN-OOA": "H145 D3",
  "LN-OOB": "H145 D3",
  "LN-OOU": "H145 D3",
  "LN-OTH": "H145 D3",
  "LN-OTI": "H145 D3",
  "LN-OTJ": "H145 D3",
  "LN-OTK": "H145 D3",
  "LN-OTN": "H145 D3",

  "LN-ODL": "AW139",
  "LN-ODM": "AW139",

  "LN-ORA": "AW169",
  "LN-ORB": "AW169",
  "LN-ORC": "AW169"
};

/* =====================================================
   OPPSTART
   ===================================================== */

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

  if (!form || !panel) return;

  setToday();

  form.addEventListener("submit", event => {
    event.preventDefault();
  });

  form.addEventListener("input", handleInput);
  form.addEventListener("focusout", handleFocusOut);

  initialiseAltitudeChips();
  initialiseTimeFields();
  initialiseScrollHint();

  $("#copyButton")?.addEventListener(
    "click", copyReport
  );

  $("#printButton")?.addEventListener(
    "click", printReport
  );

  $("#resetButton")?.addEventListener(
    "click", resetForm
  );

  $("#sendNkomButton")?.addEventListener(
    "click", createNkomEmail
  );

  $("#feedbackButton")?.addEventListener(
    "click", createFeedbackEmail
  );

  updateAircraftType();
  updateReport();
}

/* =====================================================
   HJELPEFUNKSJONER
   ===================================================== */

function value(id) {
  return $("#" + id)?.value?.trim() ?? "";
}

function pad2(number) {
  return String(number).padStart(2, "0");
}

function currentTime() {
  const now = new Date();

  return (
    pad2(now.getHours()) +
    ":" +
    pad2(now.getMinutes())
  );
}

function setToday() {
  const now = new Date();

  const date = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate())
  ].join("-");

  const field = $("#eventDate");

  if (field) field.value = date;
}

function formatDate(text) {
  if (!text) return "";

  const parts = text.split("-");

  if (parts.length !== 3) return text;

  return (
    parts[2] + "." +
    parts[1] + "." +
    parts[0]
  );
}

function formatTime(input) {
  const text = String(input ?? "")
    .trim()
    .replace(".", ":");

  if (!text) return "";

  let hours;
  let minutes;

  const match = text.match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (match) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if (/^\d{3,4}$/.test(text)) {
    const digits = text.padStart(4, "0");

    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  } else {
    return "";
  }

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return "";
  }

  return pad2(hours) + ":" + pad2(minutes);
}

function reportTime(id) {
  return formatTime(value(id)) || value(id);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlText(text) {
  return escapeHtml(text).replace(
    /\r?\n/g, "<br>"
  );
}

/* =====================================================
   RESSURS-ID
   ===================================================== */

function normaliseResourceId(input) {
  const original = String(input ?? "").trim();

  if (!original) return "";

  const compact = original
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-");

  const match = compact.match(
    /^(?:LA\s*)?(\d{1,2})\s*-\s*(\d{1,2})$/
  );

  if (match) {
    return `LA ${match[1]}-${match[2]}`;
  }

  return compact;
}

function updateResourceId() {
  const field = $("#resourceId");

  if (!field) return;

  field.value = normaliseResourceId(
    field.value
  );

  updateReport();
}

/* =====================================================
   REGISTRERINGSNUMMER OG TYPE
   ===================================================== */

function normaliseRegistration(input) {
  const text = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (/^LN[A-Z]{3}$/.test(text)) {
    return "LN-" + text.slice(2);
  }

  if (/^[A-Z]{3}$/.test(text)) {
    return "LN-" + text;
  }

  return text;
}

function updateAircraftType() {
  const registrationField = $("#registration");
  const typeField = $("#aircraftType");

  if (!registrationField || !typeField) return;

  const registration = normaliseRegistration(
    registrationField.value
  );

  typeField.value = AIRCRAFT_TYPES[registration] || "";
}

/* =====================================================
   INPUT
   ===================================================== */

function handleInput(event) {
  const target = event.target;

  if (target.id === "registration") {
    updateAircraftType();
  }

  updateReport();
}

function handleFocusOut(event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.id === "eventTime") {
    const formatted = formatTime(target.value);

    if (formatted) {
      target.value = formatted;
    }
  }

  if (target.id === "resourceId") {
    updateResourceId();
  }

  if (target.id === "registration") {
    target.value = normaliseRegistration(
      target.value
    );

    updateAircraftType();
  }

  updateReport();
}

/* =====================================================
   KLOKKESLETT
   ===================================================== */

function initialiseTimeFields() {
  const eventTime = $("#eventTime");

  eventTime?.addEventListener("click", () => {
    if (!eventTime.value.trim()) {
      eventTime.value = currentTime();
      updateReport();
    }
  });

  const notificationIds = [
    "flightFollowingTime",
    "policeTime",
    "nkomTime",
    "oplTime"
  ];

  notificationIds.forEach(id => {
    const field = $("#" + id);

    if (!field) return;

    const setTime = () => {
      field.value = currentTime();
      field.classList.add("has-time");

      updateReport();
    };

    field.addEventListener("click", setTime);

    field.addEventListener("keydown", event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setTime();
      }
    });
  });
}

function validateEventTime() {
  const field = $("#eventTime");
  const error = $("#timeError");

  if (!field || !error) return true;

  if (
    field.value.trim() &&
    !formatTime(field.value)
  ) {
    error.textContent =
      "Ugyldig klokkeslett. Bruk for eksempel 0930 eller 09:30.";

    field.setAttribute(
      "aria-invalid", "true"
    );

    return false;
  }

  error.textContent = "";
  field.removeAttribute("aria-invalid");

  return true;
}

/* =====================================================
   TIDSSONE
   ===================================================== */

function getTimezone() {
  const dateText = value("eventDate");

  if (!dateText) return "";

  const date = new Date(
    dateText + "T12:00:00Z"
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  try {
    const parts = new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/Oslo",
        timeZoneName: "shortOffset"
      }
    ).formatToParts(date);

    const timezone = parts.find(
      part => part.type === "timeZoneName"
    )?.value || "";

    return /(?:\+2|\+02)(?::00)?$/.test(timezone)
      ? "CEST"
      : "CET";
  } catch {
    return "";
  }
}

/* =====================================================
   HØYDEVALG
   ===================================================== */

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
  const buttons = $$(selector);

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      const selectedValue = button.dataset.value;

      state[stateKey] =
        state[stateKey] === selectedValue
          ? ""
          : selectedValue;

      buttons.forEach(item => {
        const active =
          item.dataset.value === state[stateKey];

        item.classList.toggle(
          "is-selected",
          active
        );

        item.setAttribute(
          "aria-pressed",
          String(active)
        );
      });

      updateReport();
    });
  });
}

/* =====================================================
   RAPPORTDATA
   ===================================================== */

function buildPosition() {
  return [
    value("position"),
    value("placeName")
  ].filter(Boolean).join(" – ");
}

function buildAltitude() {
  return [
    value("altitude"),
    state.altitudeUnit,
    state.altitudeReference
  ].filter(Boolean).join(" ");
}

function buildAircraft() {
  return [
    normaliseResourceId(value("resourceId")),
    normaliseRegistration(value("registration")),
    value("aircraftType")
  ].filter(Boolean).join(" – ");
}

function buildNotificationLines() {
  const lines = [];

  if (value("flightFollowingTime")) {
    lines.push(
      "HKP med flight following fått beskjed på TG kl. " +
      value("flightFollowingTime")
    );
  }

  if (value("policeTime")) {
    lines.push(
      "Politiets lokale operasjonssentral varslet kl. " +
      value("policeTime")
    );
  }

  if (value("nkomTime")) {
    lines.push(
      "Nkom beredskapsvakt varslet kl. " +
      value("nkomTime")
    );
  }

  if (value("oplTime")) {
    lines.push(
      "OPL AMK Oslo varslet kl. " +
      value("oplTime")
    );
  }

  return lines;
}

function getReportData() {
  return {
    date: formatDate(value("eventDate")),
    time: reportTime("eventTime"),
    timezone: getTimezone(),
    position: buildPosition(),
    altitude: buildAltitude(),
    aircraft: buildAircraft(),
    description: value("description"),
    consequences: value("consequences"),
    notificationLines: buildNotificationLines(),
    followUp: value("followUp"),
    senderName: value("senderName")
  };
}

/* =====================================================
   GENERER RAPPORT
   ===================================================== */

function generateReport() {
  const data = getReportData();

  const timestamp = [
    data.date,
    data.time,
    data.timezone
  ].filter(Boolean).join(", ");

  return [
    "AMK-LA Oslo har mottatt melding om GNSS-forstyrrelser.",
    "",
    `Tidspunkt for forstyrrelsen: ${timestamp}`,
    `Posisjon/område: ${data.position}`,
    `Høyde: ${data.altitude}`,
    `Luftfartøy: ${data.aircraft}`,
    `Beskrivelse: ${data.description}`,
    `Operative konsekvenser og tiltak: ${data.consequences}`,
    `Varsling: ${data.notificationLines.join(". ")}`,
    `Videre oppfølging: ${data.followUp}`,
    "",
    "Med vennlig hilsen",
    "",
    data.senderName || "Fornavn Etternavn",
    "Luftambulansekoordinator",
    "Prehospital klinikk | AMK-LA Oslo",
    "Oslo universitetssykehus HF",
    "648 95 749 | la-oslo.amk@ous-hf.no",
    "www.oslo-universitetssykehus.no",
    "",
    "Denne meldingen inneholder ikke sensitiv informasjon som bryter med Oslo universitetssykehus HFs krav til informasjonssikkerhet"
  ].join("\n");
}

function updateReport() {
  validateEventTime();

  const timezoneInfo = $("#timezoneInfo");

  if (timezoneInfo) {
    const timezone = getTimezone();

    timezoneInfo.textContent = timezone
      ? `Tidssone i rapport: ${timezone}`
      : "";
  }

  const output = $("#reportOutput");

  if (output) {
    output.value = generateReport();
  }

  updateFormScrollHint();
}

/* =====================================================
   HTML-FORMATERT RAPPORT FOR OUTLOOK
   Aptos, 10 pkt
   ===================================================== */

function buildEmailHTML(logoSource = "") {
  const data = getReportData();

  const timestamp = [
    data.date,
    data.time,
    data.timezone
  ].filter(Boolean).join(", ");

  const notification = data.notificationLines.join(". ");

  const row = (label, content) => `
    <tr>
      <td style="
        padding:4px 12px 4px 0;
        font-weight:700;
        vertical-align:top;
        width:190px;
      ">${escapeHtml(label)}</td>
      <td style="
        padding:4px 0;
        vertical-align:top;
        overflow-wrap:break-word;
      ">${htmlText(content)}</td>
    </tr>
  `;

  const logo = logoSource ? `
    <div style="margin:16px 0 12px;">
      <img
        src="${escapeHtml(logoSource)}"
        alt="Oslo universitetssykehus"
        style="
          display:block;
          max-width:270px;
          max-height:90px;
          width:auto;
          height:auto;
        "
      >
    </div>
  ` : "";

  return `
    <div style="
      font-family:Aptos,'Aptos Body',Calibri,Arial,sans-serif;
      font-size:10pt;
      line-height:1.4;
      color:#17212b;
      background:#ffffff;
    ">

      <p style="margin:0 0 14px;">
        AMK-LA Oslo har mottatt melding om GNSS-forstyrrelser.
      </p>

      <table
        role="presentation"
        cellpadding="0"
        cellspacing="0"
        style="
          font-family:Aptos,'Aptos Body',Calibri,Arial,sans-serif;
          font-size:10pt;
          border-collapse:collapse;
          color:#17212b;
        "
      >
        ${row("Tidspunkt for forstyrrelsen:", timestamp)}
        ${row("Posisjon/område:", data.position)}
        ${row("Høyde:", data.altitude)}
        ${row("Luftfartøy:", data.aircraft)}
        ${row("Beskrivelse:", data.description)}
        ${row("Operative konsekvenser og tiltak:", data.consequences)}
        ${row("Varsling:", notification)}
        ${row("Videre oppfølging:", data.followUp)}
      </table>

      <div style="margin-top:24px;">

        <p style="margin:0 0 12px;">
          Med vennlig hilsen
        </p>

        <p style="margin:0;">
          <strong style="font-size:12pt;">
            ${escapeHtml(data.senderName || "Fornavn Etternavn")}
          </strong>
        </p>

        <p style="margin:0;">
          <em>Luftambulansekoordinator</em>
        </p>

        <p style="margin:0;">
          Prehospital klinikk | AMK-LA Oslo
        </p>

        <p style="margin:0;">
          <strong>Oslo universitetssykehus HF</strong>
        </p>

        <p style="margin:0;">
          648 95 749 |
          <a
            href="mailto:la-oslo.amk@ous-hf.no"
            style="color:#0066a1;"
          >la-oslo.amk@ous-hf.no</a>
        </p>

        <p style="margin:0;">
          <a
            href="https://www.oslo-universitetssykehus.no"
            style="color:#0066a1;"
          >www.oslo-universitetssykehus.no</a>
        </p>

        ${logo}

        <p style="
          margin:18px 0 0;
          font-size:9pt;
          color:#52606d;
        ">
          Denne meldingen inneholder ikke sensitiv informasjon
          som bryter med Oslo universitetssykehus HFs krav
          til informasjonssikkerhet
        </p>
      </div>
    </div>
  `;
}

/* =====================================================
   LOGO
   ===================================================== */

async function loadLogoDataUrl() {
  if (!LOGO_FILE) return "";

  try {
    const imageUrl = new URL(
      LOGO_FILE,
      document.baseURI
    );

    const response = await fetch(imageUrl.href);

    if (!response.ok) return "";

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      return "";
    }

    return await new Promise(resolve => {
      const reader = new FileReader();

      reader.onload = () => resolve(
        typeof reader.result === "string"
          ? reader.result
          : ""
      );

      reader.onerror = () => resolve("");

      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

/* =====================================================
   KOPIER REN TEKST
   ===================================================== */

async function copyPlainText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Forsøk eldre metode.
  }

  const temporary = document.createElement(
    "textarea"
  );

  temporary.value = text;
  temporary.style.position = "fixed";
  temporary.style.left = "-9999px";

  document.body.appendChild(temporary);
  temporary.select();

  let success = false;

  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }

  temporary.remove();

  return success;
}

async function copyReport() {
  updateReport();

  const report = $("#reportOutput");

  if (!report) return;

  const copied = await copyPlainText(
    report.value
  );

  clearTimeout(copyTimer);

  const label = $("#copyButtonText");
  const button = $("#copyButton");

  if (label) {
    label.textContent = copied
      ? "Tekst kopiert"
      : "Kopiering mislyktes";
  }

  if (button) {
    button.classList.toggle(
      "copy-flash",
      copied
    );
  }

  copyTimer = setTimeout(
    clearCopyConfirmation,
    5000
  );
}

function clearCopyConfirmation() {
  clearTimeout(copyTimer);

  const label = $("#copyButtonText");

  if (label) {
    label.textContent = "Kopier tekst";
  }

  $("#copyButton")?.classList.remove(
    "copy-flash"
  );
}

/* =====================================================
   KOPIER FORMATERT HTML TIL UTKLIPPSTAVLEN
   ===================================================== */

async function copyFormattedEmail(html, plain) {
  if (
    !navigator.clipboard?.write ||
    !window.ClipboardItem
  ) {
    return false;
  }

  try {
    const item = new ClipboardItem({
      "text/html": new Blob(
        [html],
        { type: "text/html" }
      ),
      "text/plain": new Blob(
        [plain],
        { type: "text/plain" }
      )
    });

    await navigator.clipboard.write([item]);

    return true;
  } catch {
    return false;
  }
}

/* =====================================================
   E-POSTEMNE
   ===================================================== */

function buildEmailSubject() {
  const area =
    value("placeName") || "område ikke oppgitt";

  const details = [
    area,
    formatDate(value("eventDate")),
    reportTime("eventTime")
  ].filter(Boolean).join(", ");

  return `GNSS-forstyrrelser ${details}`;
}

/* =====================================================
   ÅPNE OUTLOOK MED UTFYLT E-POST

   NB:
   mailto støtter ren tekst, ikke HTML.
   En formatert versjon kopieres til utklippstavlen.

   Ingen automatisk sending.
   ===================================================== */

async function createNkomEmail() {
  updateResourceId();
  updateAircraftType();
  updateReport();

  if (!validateEventTime()) {
    $("#eventTime")?.focus();

    setEmailStatus(
      "Kontroller klokkeslettet før varsling.",
      true
    );

    return;
  }

  const button = $("#sendNkomButton");

  if (button) {
    button.disabled = true;
  }

  setEmailStatus("");

  const plain = generateReport();
  const subject = buildEmailSubject();

  // Lag mailto umiddelbart fra brukerens klikk.
  // Dette gir størst sjanse for at Outlook åpnes.
  const mailto =
    `mailto:${EMAIL.to}` +
    `?cc=${encodeURIComponent(EMAIL.cc)}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(plain)}`;

  try {
    window.location.href = mailto;

    // Lag formatert versjon som også kan limes inn.
    const logo = await loadLogoDataUrl();
    const html = buildEmailHTML(logo);

    const formatted = await copyFormattedEmail(
      html,
      plain
    );

    if (formatted) {
      setEmailStatus(
        "Outlook-utkast forsøkt åpnet. Formatert rapport er også kopiert. Kontroller e-posten og send manuelt."
      );
    } else {
      setEmailStatus(
        "Outlook-utkast forsøkt åpnet med vanlig tekst. Kontroller e-posten og send manuelt."
      );
    }
  } catch (error) {
    console.error(
      "Kunne ikke klargjøre e-post:",
      error
    );

    setEmailStatus(
      "Kunne ikke klargjøre formatert e-post. Bruk rapportfeltet til høyre.",
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function setEmailStatus(message, isError = false) {
  const status = $("#emailStatus");

  if (!status) return;

  status.textContent = message;

  status.classList.toggle(
    "is-error",
    isError
  );
}

/* =====================================================
   TILBAKEMELDING PÅ SKJEMA
   ===================================================== */

function createFeedbackEmail() {
  const subject =
    "GPS-forstyrrelser – tilbakemelding på skjema";

  window.location.href =
    `mailto:${EMAIL.feedback}` +
    `?subject=${encodeURIComponent(subject)}`;
}

/* =====================================================
   SKRIV UT
   ===================================================== */

async function printReport() {
  updateResourceId();
  updateAircraftType();
  updateReport();

  const printWindow = window.open(
    "",
    "_blank"
  );

  if (!printWindow) {
    alert(
      "Nettleseren blokkerte utskriftsvinduet. Tillat popup-vinduer."
    );

    return;
  }

  try {
    const logoData = await loadLogoDataUrl();

    const logo = logoData || (
      LOGO_FILE
        ? new URL(
            LOGO_FILE,
            document.baseURI
          ).href
        : ""
    );

    const report = buildEmailHTML(logo);

    printWindow.document.open();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="no">
      <head>
        <meta charset="UTF-8">
        <title>GPS-forstyrrelser – rapport</title>

        <style>
          @page {
            size: A4;
            margin: 18mm;
          }

          body {
            margin: 0;
            background: white;
            color: #17212b;
            font-family:
              Aptos,
              "Aptos Body",
              Calibri,
              Arial,
              sans-serif;
            font-size: 10pt;
          }

          .print-header {
            border-bottom: 1px solid #d0d5dd;
            padding-bottom: 12px;
            margin-bottom: 22px;
          }

          .print-header h1 {
            margin: 0;
            font-size: 16pt;
          }

          .print-header p {
            margin: 0 0 4px;
            color: #667085;
            font-size: 9pt;
          }

          table {
            width: 100%;
          }

          td {
            overflow-wrap: anywhere;
          }

          a {
            color: #0066a1;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>

      <body>
        <div class="print-header">
          <p>Luftambulansekoordinator | AMK-LA Oslo</p>
          <h1>GPS-/GNSS-forstyrrelser</h1>
        </div>

        ${report}
      </body>
      </html>
    `);

    printWindow.document.close();

    const images = [
      ...printWindow.document.images
    ];

    await Promise.all(
      images.map(img => {
        if (img.complete) {
          return Promise.resolve();
        }

        return new Promise(resolve => {
          img.addEventListener(
            "load",
            resolve,
            { once: true }
          );

          img.addEventListener(
            "error",
            resolve,
            { once: true }
          );
        });
      })
    );

    printWindow.focus();
    printWindow.print();
  } catch (error) {
    console.error(
      "Utskrift feilet:",
      error
    );

    printWindow.close();

    alert(
      "Kunne ikke klargjøre utskrift."
    );
  }
}

/* =====================================================
   TØM SKJEMA
   ===================================================== */

function resetForm() {
  const form = $("#gpsForm");

  form?.reset();

  state.altitudeUnit = "";
  state.altitudeReference = "";

  $$(".chip").forEach(button => {
    button.classList.remove(
      "is-selected"
    );

    button.setAttribute(
      "aria-pressed",
      "false"
    );
  });

  $$(".notification-time-field").forEach(field => {
    field.value = "";

    field.classList.remove(
      "has-time"
    );
  });

  const aircraftType = $("#aircraftType");

  if (aircraftType) {
    aircraftType.value = "";
  }

  setEmailStatus("");

  setToday();
  clearCopyConfirmation();
  updateReport();

  const report = $("#reportOutput");

  if (report) {
    report.scrollTop = 0;
  }

  $(".form-panel")?.scrollTo({
    top: 0,
    behavior: motionBehavior()
  });

  window.scrollTo({
    top: 0,
    behavior: motionBehavior()
  });
}

/* =====================================================
   RULLEINDIKATOR
   ===================================================== */

function motionBehavior() {
  return window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches
    ? "auto"
    : "smooth";
}

function initialiseScrollHint() {
  const panel = $(".form-panel");

  panel?.addEventListener(
    "scroll",
    updateFormScrollHint,
    { passive: true }
  );

  $("#formScrollHint")?.addEventListener(
    "click",
    () => {
      if (!panel) return;

      panel.scrollBy({
        top: panel.clientHeight * 0.7,
        behavior: motionBehavior()
      });
    }
  );

  window.addEventListener(
    "resize",
    updateFormScrollHint
  );

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(
      updateFormScrollHint
    );

    if (panel) observer.observe(panel);

    const form = $("#gpsForm");

    if (form) observer.observe(form);
  }

  updateFormScrollHint();
}

function updateFormScrollHint() {
  const panel = $(".form-panel");
  const hint = $("#formScrollHint");

  if (!panel || !hint) return;

  hint.hidden =
    panel.scrollHeight -
    panel.clientHeight -
    panel.scrollTop < 12;
}
