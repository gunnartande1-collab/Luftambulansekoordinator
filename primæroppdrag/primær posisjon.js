
/* =========================================================
   LUFTAMBULANSEKOORDINATOR – PRIMÆROPPDRAG
   POSISJON OG KOORDINATKONVERTERING

   Støtter:
   - UTM32N fra kartprogram
   - 32V fra politi/HRS
   - Ø 6 460 73, N 67 460 65 UTM32N
   - Grader og desimalminutter
   - Automatisk konvertering begge veier
   - Automatisk UTM-sone og breddegradsbelte
   - Rapportformat:
     UTM32V Ø 646073 N 6746065

   Beregning med WGS84-ellipsoiden.
   Ingen eksterne biblioteker eller nettforbindelse.

   MERK:
   Må valideres mot autoritative kontrollpunkter
   før operativ bruk.
   ========================================================= */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const A = 6378137;
  const F = 1 / 298.257223563;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const K0 = 0.9996;
  const RAD = Math.PI / 180;
  const BANDS = "CDEFGHJKLMNPQRSTUVWX";

  let lastPosition = null;

  /* =======================================================
     UTM-SONE OG BREDDEGRADSBELTE
     ======================================================= */

  function getBand(latitude) {
    if (latitude < -80 || latitude > 84) {
      return null;
    }

    const index = Math.min(
      19,
      Math.floor((latitude + 80) / 8)
    );

    return BANDS[index];
  }

  function getZone(latitude, longitude) {
    let zone = Math.min(
      60,
      Math.max(
        1,
        Math.floor((longitude + 180) / 6) + 1
      )
    );

    // Spesialregel for Sør-Norge.
    if (
      latitude >= 56 &&
      latitude < 64 &&
      longitude >= 3 &&
      longitude < 12
    ) {
      zone = 32;
    }

    // Spesialregler for Svalbard.
    if (latitude >= 72 && latitude < 84) {
      if (longitude >= 0 && longitude < 9) {
        zone = 31;
      } else if (longitude >= 9 && longitude < 21) {
        zone = 33;
      } else if (longitude >= 21 && longitude < 33) {
        zone = 35;
      } else if (longitude >= 33 && longitude < 42) {
        zone = 37;
      }
    }

    return zone;
  }

  /* =======================================================
     MATEMATISKE HJELPEFUNKSJONER
     ======================================================= */

  function meridianArc(latitudeRadians) {
    return A * (
      (
        1 -
        E2 / 4 -
        3 * E2 ** 2 / 64 -
        5 * E2 ** 3 / 256
      ) * latitudeRadians

      -
      (
        3 * E2 / 8 +
        3 * E2 ** 2 / 32 +
        45 * E2 ** 3 / 1024
      ) * Math.sin(2 * latitudeRadians)

      +
      (
        15 * E2 ** 2 / 256 +
        45 * E2 ** 3 / 1024
      ) * Math.sin(4 * latitudeRadians)

      -
      (
        35 * E2 ** 3 / 3072
      ) * Math.sin(6 * latitudeRadians)
    );
  }

  /* =======================================================
     GRADER -> UTM
     ======================================================= */

  function degreesToUtm(
    latitude,
    longitude,
    selectedZone = null
  ) {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -80 ||
      latitude > 84 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error(
        "Posisjonen ligger utenfor gyldig UTM-område."
      );
    }

    const zone = selectedZone ??
      getZone(latitude, longitude);

    if (
      !Number.isInteger(zone) ||
      zone < 1 ||
      zone > 60
    ) {
      throw new Error("Ugyldig UTM-sone.");
    }

    const phi = latitude * RAD;
    const lambda = longitude * RAD;

    const centralMeridian = (
      (zone - 1) * 6 - 180 + 3
    ) * RAD;

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const tanPhi = Math.tan(phi);

    const n = A / Math.sqrt(
      1 - E2 * sinPhi ** 2
    );

    const t = tanPhi ** 2;
    const c = EP2 * cosPhi ** 2;

    const aa = cosPhi * (
      lambda - centralMeridian
    );

    const easting = K0 * n * (
      aa +
      (1 - t + c) * aa ** 3 / 6 +
      (
        5 -
        18 * t +
        t ** 2 +
        72 * c -
        58 * EP2
      ) * aa ** 5 / 120
    ) + 500000;

    let northing = K0 * (
      meridianArc(phi) +
      n * tanPhi * (
        aa ** 2 / 2 +
        (
          5 -
          t +
          9 * c +
          4 * c ** 2
        ) * aa ** 4 / 24 +
        (
          61 -
          58 * t +
          t ** 2 +
          600 * c -
          330 * EP2
        ) * aa ** 6 / 720
      )
    );

    if (latitude < 0) {
      northing += 10000000;
    }

    if (
      !Number.isFinite(easting) ||
      !Number.isFinite(northing) ||
      easting < 100000 ||
      easting > 900000
    ) {
      throw new Error(
        "Koordinaten passer ikke i den beregnede UTM-sonen."
      );
    }

    return {
      zone,
      band: getBand(latitude),
      easting,
      northing,
      latitude,
      longitude
    };
  }

  /* =======================================================
     UTM -> GRADER
     ======================================================= */

  function utmToDegrees(
    zone,
    easting,
    northing,
    northernHemisphere = true
  ) {
    if (
      !Number.isInteger(zone) ||
      zone < 1 ||
      zone > 60 ||
      !Number.isFinite(easting) ||
      !Number.isFinite(northing) ||
      easting < 100000 ||
      easting > 900000 ||
      northing < 0 ||
      northing > 10000000
    ) {
      throw new Error(
        "UTM-sonen eller koordinatverdiene er ugyldige."
      );
    }

    const x = easting - 500000;

    const y = northernHemisphere
      ? northing
      : northing - 10000000;

    const m = y / K0;

    const mu = m / (
      A * (
        1 -
        E2 / 4 -
        3 * E2 ** 2 / 64 -
        5 * E2 ** 3 / 256
      )
    );

    const e1 = (
      1 - Math.sqrt(1 - E2)
    ) / (
      1 + Math.sqrt(1 - E2)
    );

    const phi1 =
      mu +
      (
        3 * e1 / 2 -
        27 * e1 ** 3 / 32
      ) * Math.sin(2 * mu) +
      (
        21 * e1 ** 2 / 16 -
        55 * e1 ** 4 / 32
      ) * Math.sin(4 * mu) +
      151 * e1 ** 3 / 96 * Math.sin(6 * mu) +
      1097 * e1 ** 4 / 512 * Math.sin(8 * mu);

    const sinPhi = Math.sin(phi1);
    const cosPhi = Math.cos(phi1);
    const tanPhi = Math.tan(phi1);

    const n1 = A / Math.sqrt(
      1 - E2 * sinPhi ** 2
    );

    const r1 = A * (1 - E2) /
      (1 - E2 * sinPhi ** 2) ** 1.5;

    const t1 = tanPhi ** 2;
    const c1 = EP2 * cosPhi ** 2;
    const d = x / (n1 * K0);

    const latitude = (
      phi1 -
      n1 * tanPhi / r1 * (
        d ** 2 / 2 -
        (
          5 +
          3 * t1 +
          10 * c1 -
          4 * c1 ** 2 -
          9 * EP2
        ) * d ** 4 / 24 +
        (
          61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 * EP2 -
          3 * c1 ** 2
        ) * d ** 6 / 720
      )
    ) / RAD;

    const longitude = (
      (zone - 1) * 6 - 180 + 3
    ) + (
      d -
      (
        1 +
        2 * t1 +
        c1
      ) * d ** 3 / 6 +
      (
        5 -
        2 * c1 +
        28 * t1 -
        3 * c1 ** 2 +
        8 * EP2 +
        24 * t1 ** 2
      ) * d ** 5 / 120
    ) / cosPhi / RAD;

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -80 ||
      latitude > 84 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error(
        "UTM-koordinaten gir en posisjon utenfor gyldig område."
      );
    }

    return {
      zone,
      band: getBand(latitude),
      easting,
      northing,
      latitude,
      longitude
    };
  }

  /* =======================================================
     TOLKING AV UTM-FRITEKST
     ======================================================= */

  function parseUtm(raw) {
    const input = String(raw || "")
      .toUpperCase()
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!input) {
      return null;
    }

    const zoneMatch = input.match(
      /(?:UTM\s*)?([1-9]|[1-5]\d|60)\s*([C-HJ-NP-X])/i
    );

    if (!zoneMatch) {
      throw new Error(
        "Oppgi UTM-sone og bokstav, f.eks. 32V eller UTM32N."
      );
    }

    const zone = Number(zoneMatch[1]);
    const zoneLetter = zoneMatch[2].toUpperCase();

    // Fjern soneangivelsen før Ø/N leses.
    const remaining = (
      input.slice(0, zoneMatch.index) +
      " " +
      input.slice(
        zoneMatch.index + zoneMatch[0].length
      )
    ).trim();

    const eastMatch = remaining.match(
      /(?:^|[\s,;])(?:Ø|E)\s*([\d\s]+?)(?=\s*[,;]|\s+N\s*\d|\s*$)/
    );

    const northMatch = remaining.match(
      /(?:^|[\s,;])N\s*([\d\s]+?)(?=\s*[,;]|\s*$)/
    );

    if (!eastMatch || !northMatch) {
      throw new Error(
        "Oppgi både øst- og nordkoordinat med Ø og N."
      );
    }

    const eastDigits = eastMatch[1].replace(/\s/g, "");
    const northDigits = northMatch[1].replace(/\s/g, "");

    if (
      !/^\d{5,6}$/.test(eastDigits) ||
      !/^\d{6,7}$/.test(northDigits)
    ) {
      throw new Error(
        "Koordinatene har uventet antall sifre. Kontroller dem mot kilden."
      );
    }

    const easting = Number(eastDigits);
    const northing = Number(northDigits);

    // UTM32N fra kartprogrammet bruker
    // N som betegnelse på nordlig halvkule.
    // Andre bokstaver tolkes som breddegradsbelter.
    //
    // Bokstaven N er tvetydig uten kildekontekst.
    // Denne modulen tolker alltid 32N som halvkule.

    const northernHemisphere = zoneLetter >= "N";

    const position = utmToDegrees(
      zone,
      easting,
      northing,
      northernHemisphere
    );

    if (
      zoneLetter !== "N" &&
      zoneLetter !== position.band
    ) {
      throw new Error(
        `Oppgitt UTM-belte ${zoneLetter} stemmer ` +
        `ikke med beregnet belte ${position.band}.`
      );
    }

    // Kontroll av at koordinaten kan projiseres
    // tilbake i samme UTM-sone.
    const check = degreesToUtm(
      position.latitude,
      position.longitude,
      zone
    );

    if (
      Math.abs(check.easting - easting) > 2 ||
      Math.abs(check.northing - northing) > 2
    ) {
      throw new Error(
        "Koordinaten lot seg ikke kontrollere. Sjekk sone og tall."
      );
    }

    return position;
  }

  /* =======================================================
     TOLKING AV GRADER OG DESIMALMINUTTER
     ======================================================= */

  function parseDegreesMinutes(raw) {
    const input = String(raw || "")
      .toUpperCase()
      .replace(/\u00A0/g, " ")
      .replace(/,/g, ".")
      .replace(/º/g, "°")
      .trim();

    if (!input) {
      return null;
    }

    function findCoordinate(axes) {
      const numeric =
        "(\\d{1,3})\\s*(?:°|\\s)\\s*" +
        "(\\d{1,2}(?:\\.\\d+)?)\\s*['’′]?";

      // Eksempel: 60° 49.381' N
      const suffix = new RegExp(
        numeric + "\\s*(" + axes + ")(?=\\s|$)",
        "i"
      ).exec(input);

      if (suffix) {
        return {
          degrees: Number(suffix[1]),
          minutes: Number(suffix[2]),
          direction: suffix[3]
        };
      }

      // Eksempel: N 60° 49.381'
      const prefix = new RegExp(
        "(?:^|\\s)(" + axes + ")\\s*" + numeric,
        "i"
      ).exec(input);

      if (prefix) {
        return {
          degrees: Number(prefix[2]),
          minutes: Number(prefix[3]),
          direction: prefix[1]
        };
      }

      return null;
    }

    const latitude = findCoordinate("N|S");
    const longitude = findCoordinate("Ø|E|W|V");

    if (!latitude || !longitude) {
      throw new Error(
        "Bruk f.eks. 60° 49.381' N 11° 41.181' Ø."
      );
    }

    if (
      latitude.degrees > 90 ||
      longitude.degrees > 180 ||
      latitude.minutes >= 60 ||
      longitude.minutes >= 60 ||
      (
        latitude.degrees === 90 &&
        latitude.minutes !== 0
      ) ||
      (
        longitude.degrees === 180 &&
        longitude.minutes !== 0
      )
    ) {
      throw new Error(
        "Ugyldige grader eller desimalminutter."
      );
    }

    let lat = latitude.degrees +
      latitude.minutes / 60;

    let lon = longitude.degrees +
      longitude.minutes / 60;

    if (latitude.direction === "S") {
      lat = -lat;
    }

    if (["W", "V"].includes(longitude.direction)) {
      lon = -lon;
    }

    return degreesToUtm(lat, lon);
  }

  /* =======================================================
     RAPPORTFORMATERING
     ======================================================= */

  function formatUtm(position) {
    return (
      `UTM${position.zone}${position.band} ` +
      `Ø ${Math.round(position.easting)} ` +
      `N ${Math.round(position.northing)}`
    );
  }

  function formatDmPart(
    coordinate,
    degreeWidth,
    positiveDirection,
    negativeDirection
  ) {
    const direction = coordinate < 0
      ? negativeDirection
      : positiveDirection;

    let degrees = Math.floor(Math.abs(coordinate));

    let minutes = Math.round(
      (Math.abs(coordinate) - degrees) * 60000
    ) / 1000;

    if (minutes >= 60) {
      degrees += 1;
      minutes = 0;
    }

    return (
      `${String(degrees).padStart(degreeWidth, "0")}° ` +
      `${minutes.toFixed(3).padStart(6, "0")}' ` +
      direction
    );
  }

  function formatDegreesMinutes(position) {
    const latitude = formatDmPart(
      position.latitude,
      2,
      "N",
      "S"
    );

    const longitude = formatDmPart(
      position.longitude,
      2,
      "Ø",
      "V"
    );

    return `${latitude} ${longitude}`;
  }

  /* =======================================================
     SKJEMAINTEGRASJON
     ======================================================= */

  function initializePosition() {
    const reportField = $("patientPosition");

    if (!reportField) {
      return;
    }

    const parent = reportField.closest(".form-field");

    if (!parent) {
      return;
    }

    // Oppretter to synlige posisjonsfelt.
    const container = document.createElement("div");

    container.className = "position-converter";

    container.innerHTML = `
      <div class="position-converter-field">
        <label for="utmPosition">UTM</label>

        <input
          id="utmPosition"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="32V Ø 646073 N 6746065"
          aria-describedby="positionNotice"
        >
      </div>

      <div class="position-converter-field">
        <label for="dmPosition">
          Grader og desimalminutter
        </label>

        <input
          id="dmPosition"
          type="text"
          spellcheck="false"
          autocomplete="off"
          placeholder="60° 49.381' N 11° 41.181' Ø"
          aria-describedby="positionNotice"
        >
      </div>

      <p
        id="positionNotice"
        role="status"
        aria-live="polite"
      ></p>
    `;

    parent.appendChild(container);

    /* =====================================================
       STIL FOR POSISJONSFELTENE
       ===================================================== */

    const style = document.createElement("style");

    style.textContent = `
      .position-converter {
        display: grid;
        gap: 8px;
        width: 100%;
        margin-top: 2px;
      }

      .position-converter-field {
        display: grid;
        gap: 5px;
        min-width: 0;
      }

      .position-converter-field label {
        font-size: 13px;
        font-weight: 650;
      }

      .position-converter-field input {
        width: 100%;
        min-width: 0;
        height: 36px;
        padding: 0 9px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface);
        color: var(--text);
      }

      .position-converter-field input:focus {
        border-color: var(--primary);
        outline: 2px solid var(--primary);
        outline-offset: 1px;
      }

      #positionNotice {
        margin: 0;
        font-size: 12px;
        color: var(--muted);
      }

      #positionNotice:empty {
        display: none;
      }

      #positionNotice.position-error {
        color: var(--red);
      }
    `;

    document.head.appendChild(style);

    const utmInput = $("utmPosition");
    const dmInput = $("dmPosition");
    const notice = $("positionNotice");

    function notifyReport() {
      reportField.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    function clearMessage() {
      notice.textContent = "";
      notice.classList.remove("position-error");
    }

    function resetPosition() {
      lastPosition = null;

      utmInput.value = "";
      dmInput.value = "";
      reportField.value = "";

      clearMessage();
      notifyReport();
    }

    function handleInput(source) {
      const activeInput = source === "utm"
        ? utmInput
        : dmInput;

      const otherInput = source === "utm"
        ? dmInput
        : utmInput;

      const raw = activeInput.value.trim();

      if (!raw) {
        resetPosition();
        return;
      }

      try {
        const position = source === "utm"
          ? parseUtm(raw)
          : parseDegreesMinutes(raw);

        lastPosition = position;

        // Behold teksten man skriver i aktivt felt.
        // Oppdater bare det andre feltet.
        if (source === "utm") {
          dmInput.value = formatDegreesMinutes(position);
        } else {
          utmInput.value = formatUtm(position);
        }

        // Eksisterende rapportgenerator bruker
        // fortsatt patientPosition.
        reportField.value = formatUtm(position);

        notice.textContent =
          "Posisjonen er tolket og konvertert.";

        notice.classList.remove("position-error");

      } catch (error) {
        lastPosition = null;

        // Fjern gammel konvertert koordinat.
        otherInput.value = "";

        // Originalteksten beholdes, men merkes
        // tydelig som ikke verifisert i rapporten.
        reportField.value =
          "IKKE VERIFISERT: " + raw;

        notice.textContent =
          error.message ||
          "Posisjonen kunne ikke tolkes.";

        notice.classList.add("position-error");
      }

      notifyReport();
    }

    /* =====================================================
       HENDELSER
       ===================================================== */

    utmInput.addEventListener("input", () => {
      handleInput("utm");
    });

    dmInput.addEventListener("input", () => {
      handleInput("dm");
    });

    // Formater feltene når operatøren går videre.
    utmInput.addEventListener("blur", () => {
      if (lastPosition) {
        utmInput.value = formatUtm(lastPosition);
      }
    });

    dmInput.addEventListener("blur", () => {
      if (lastPosition) {
        dmInput.value = formatDegreesMinutes(lastPosition);
      }
    });

    // Eksisterende primæroppdrag.js håndterer
    // bekreftelsesdialog og tømming av hovedskjemaet.
    // Vi tømmer derfor disse feltene bare når
    // det skjulte rapportfeltet faktisk er tømt.
    $("resetButton")?.addEventListener("click", () => {
      setTimeout(() => {
        if (!reportField.value) {
          resetPosition();
        }
      }, 0);
    });
  }

  /* =======================================================
     OPPSTART
     ======================================================= */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePosition
    );
  } else {
    initializePosition();
  }

})();
