
/* =====================================================
   GPS-FORSTYRRELSER – POSISJONSKONVERTERING

   Toveis konvertering mellom:
   - UTM
   - Grader og desimalminutter

   Eksempler:
   Ø 6 460 73, N 67 460 65 UTM32N
   32V Ø 646073 N 6746065
   60° 49.381' N 11° 41.181' Ø

   Rapport:
   UTM32V Ø 646073 N 6746065

   Bruker WGS84-ellipsoiden.
   Ingen eksterne biblioteker.

   Må kontrolleres før operativ bruk.
   ===================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const A = 6378137;
  const F = 1 / 298.257223563;
  const E2 = F * (2 - F);
  const EP2 = E2 / (1 - E2);
  const K0 = 0.9996;
  const R = Math.PI / 180;

  const BANDS = "CDEFGHJKLMNPQRSTUVWX";

  let lastGood = null;

  /* =====================================================
     UTM-SONE OG BREDDEGRADSBELTE
     ===================================================== */

  function bandFor(lat) {
    if (lat < -80 || lat > 84) return null;

    return BANDS[
      Math.min(19, Math.floor((lat + 80) / 8))
    ];
  }

  function naturalZone(lat, lon) {
    let zone = Math.min(
      60,
      Math.max(1, Math.floor((lon + 180) / 6) + 1)
    );

    // Norge
    if (
      lat >= 56 &&
      lat < 64 &&
      lon >= 3 &&
      lon < 12
    ) {
      zone = 32;
    }

    // Svalbard
    if (lat >= 72 && lat < 84) {
      if (lon >= 0 && lon < 9) zone = 31;
      else if (lon >= 9 && lon < 21) zone = 33;
      else if (lon >= 21 && lon < 33) zone = 35;
      else if (lon >= 33 && lon < 42) zone = 37;
    }

    return zone;
  }

  /* =====================================================
     MERIDIANBUELENGDE
     ===================================================== */

  function meridian(lat) {
    return A * (
      (
        1 -
        E2 / 4 -
        3 * E2 ** 2 / 64 -
        5 * E2 ** 3 / 256
      ) * lat

      -
      (
        3 * E2 / 8 +
        3 * E2 ** 2 / 32 +
        45 * E2 ** 3 / 1024
      ) * Math.sin(2 * lat)

      +
      (
        15 * E2 ** 2 / 256 +
        45 * E2 ** 3 / 1024
      ) * Math.sin(4 * lat)

      -
      (
        35 * E2 ** 3 / 3072
      ) * Math.sin(6 * lat)
    );
  }

  /* =====================================================
     GRADER TIL UTM
     ===================================================== */

  function toUtm(
    lat,
    lon,
    zone = naturalZone(lat, lon)
  ) {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -80 ||
      lat > 84 ||
      lon < -180 ||
      lon > 180
    ) {
      throw new Error(
        "Geografisk posisjon utenfor UTM-området."
      );
    }

    const phi = lat * R;
    const lam = lon * R;

    const center = (
      (zone - 1) * 6 - 180 + 3
    ) * R;

    const t = Math.tan(phi) ** 2;
    const c = EP2 * Math.cos(phi) ** 2;

    const aa = Math.cos(phi) * (
      lam - center
    );

    const n = A / Math.sqrt(
      1 - E2 * Math.sin(phi) ** 2
    );

    const east = K0 * n * (
      aa +
      (1 - t + c) * aa ** 3 / 6 +
      (
        5 -
        18 * t +
        t * t +
        72 * c -
        58 * EP2
      ) * aa ** 5 / 120
    ) + 500000;

    let north = K0 * (
      meridian(phi) +
      n * Math.tan(phi) * (
        aa ** 2 / 2 +
        (
          5 -
          t +
          9 * c +
          4 * c * c
        ) * aa ** 4 / 24 +
        (
          61 -
          58 * t +
          t * t +
          600 * c -
          330 * EP2
        ) * aa ** 6 / 720
      )
    );

    if (lat < 0) {
      north += 10000000;
    }

    return {
      zone,
      east,
      north,
      lat,
      lon,
      band: bandFor(lat)
    };
  }

  /* =====================================================
     UTM TIL GRADER
     ===================================================== */

  function fromUtm(
    zone,
    east,
    north,
    northern = true
  ) {
    if (
      !Number.isInteger(zone) ||
      zone < 1 ||
      zone > 60 ||
      !Number.isFinite(east) ||
      !Number.isFinite(north) ||
      east < 100000 ||
      east > 900000 ||
      north < 0 ||
      north > 10000000
    ) {
      throw new Error(
        "Ugyldig UTM-sone eller øst-/nordverdi."
      );
    }

    const x = east - 500000;

    const y = northern
      ? north
      : north - 10000000;

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

    const phi =
      mu +
      (
        3 * e1 / 2 -
        27 * e1 ** 3 / 32
      ) * Math.sin(2 * mu) +
      (
        21 * e1 * e1 / 16 -
        55 * e1 ** 4 / 32
      ) * Math.sin(4 * mu) +
      151 * e1 ** 3 / 96 * Math.sin(6 * mu) +
      1097 * e1 ** 4 / 512 * Math.sin(8 * mu);

    const sin = Math.sin(phi);
    const cos = Math.cos(phi);
    const tan = Math.tan(phi);

    const n1 = A / Math.sqrt(
      1 - E2 * sin * sin
    );

    const r1 = A * (1 - E2) /
      (1 - E2 * sin * sin) ** 1.5;

    const t1 = tan * tan;
    const c1 = EP2 * cos * cos;
    const d = x / (n1 * K0);

    const lat = (
      phi -
      n1 * tan / r1 * (
        d * d / 2 -
        (
          5 +
          3 * t1 +
          10 * c1 -
          4 * c1 * c1 -
          9 * EP2
        ) * d ** 4 / 24 +
        (
          61 +
          90 * t1 +
          298 * c1 +
          45 * t1 * t1 -
          252 * EP2 -
          3 * c1 * c1
        ) * d ** 6 / 720
      )
    ) / R;

    const lon = (
      (zone - 1) * 6 - 180 + 3
    ) + (
      (
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
          3 * c1 * c1 +
          8 * EP2 +
          24 * t1 * t1
        ) * d ** 5 / 120
      ) / cos
    ) / R;

    if (
      lat < -80 ||
      lat > 84 ||
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180
    ) {
      throw new Error(
        "UTM-koordinaten gir en posisjon utenfor gyldig område."
      );
    }

    return {
      zone,
      east,
      north,
      lat,
      lon,
      band: bandFor(lat)
    };
  }

  /* =====================================================
     TOLK UTM
     ===================================================== */

  function parseUtm(input) {
    const text = String(input)
      .toUpperCase()
      .replace(/\u00a0/g, " ")
      .trim();

    if (!text) return null;

    const zoneMatch =
      text.match(
        /(?:\bUTM\s*)?\b([1-9]|[1-5]\d|60)\s*([C-HJ-NP-X])\b/i
      ) ||
      text.match(
        /\bUTM\s*([1-9]|[1-5]\d|60)\s*([C-HJ-NP-X])/i
      );

    if (!zoneMatch) {
      throw new Error(
        "Oppgi UTM-sone og bokstav, for eksempel 32V eller UTM32N."
      );
    }

    const zone = Number(zoneMatch[1]);
    const code = zoneMatch[2].toUpperCase();

    const body =
      text.slice(0, zoneMatch.index) +
      " " +
      text.slice(
        zoneMatch.index + zoneMatch[0].length
      );

    const eastMatch = body.match(
      /(?:Ø|E)\s*([\d ]+)(?=\s*[,;]|\s+N\s*\d|\s*$)/
    );

    const northMatch = body.match(
      /\bN\s*([\d ]+)(?=\s*[,;]|\s+Ø\s*\d|\s+E\s*\d|\s*$)/
    );

    if (!eastMatch || !northMatch) {
      throw new Error(
        "Oppgi både Ø (øst) og N (nord)."
      );
    }

    const eastDigits = eastMatch[1]
      .replace(/\s/g, "");

    const northDigits = northMatch[1]
      .replace(/\s/g, "");

    if (
      !/^\d{5,6}$/.test(eastDigits) ||
      !/^\d{6,7}$/.test(northDigits)
    ) {
      throw new Error(
        "Øst/nord må ha tilstrekkelig antall sifre. Kontroller mot kilden."
      );
    }

    // 32N kan bety enten breddegradsbelte N
    // eller nordlig halvkule.
    //
    // Godta UTM32N fra kartprogrammet.
    // Avvis 32N alene fordi betydningen er tvetydig.

    if (
      code === "N" &&
      !/\bUTM\s*32N\b/i.test(text)
    ) {
      throw new Error(
        "32N er tvetydig. Oppgi UTM32N fra kartprogrammet eller riktig breddegradsbelte."
      );
    }

    const northern = code >= "N";

    const position = fromUtm(
      zone,
      Number(eastDigits),
      Number(northDigits),
      northern
    );

    // Kontroller faktisk breddegradsbelte.
    if (
      code !== "N" &&
      code !== position.band
    ) {
      throw new Error(
        `UTM-belte ${code} stemmer ikke med koordinaten ` +
        `(beregnet ${position.band}). Kontroller opplysningene.`
      );
    }

    return position;
  }

  /* =====================================================
     TOLK GRADER OG DESIMALMINUTTER
     ===================================================== */

  function parseDm(input) {
    const text = String(input)
      .toUpperCase()
      .replace(/,/g, ".")
      .replace(/\u00a0/g, " ")
      .replace(/º/g, "°");

    if (!text.trim()) return null;

    function coordRx(axes) {
      const pattern =
        "(\\d{1,3})\\s*(?:°|\\s)\\s*" +
        "(\\d{1,2}(?:\\.\\d+)?)\\s*['’′]?";

      const end = new RegExp(
        pattern + "\\s*(" + axes + ")(?=\\s|$)",
        "i"
      ).exec(text);

      if (end) {
        return {
          deg: +end[1],
          min: +end[2],
          axis: end[3]
        };
      }

      const front = new RegExp(
        "(?:^|\\s)(" + axes + ")\\s*" + pattern,
        "i"
      ).exec(text);

      return front
        ? {
            axis: front[1],
            deg: +front[2],
            min: +front[3]
          }
        : null;
    }

    const latitude = coordRx("N|S");
    const longitude = coordRx("Ø|E|W|V");

    if (!latitude || !longitude) {
      throw new Error(
        "Skriv grader og desimalminutter med N og Ø."
      );
    }

    if (
      latitude.deg > 90 ||
      longitude.deg > 180 ||
      latitude.min >= 60 ||
      longitude.min >= 60
    ) {
      throw new Error(
        "Ugyldige grader eller minutter."
      );
    }

    const lat = (
      latitude.deg +
      latitude.min / 60
    ) * (
      latitude.axis === "S" ? -1 : 1
    );

    const lon = (
      longitude.deg +
      longitude.min / 60
    ) * (
      ["W", "V"].includes(longitude.axis)
        ? -1
        : 1
    );

    return toUtm(lat, lon);
  }

  /* =====================================================
     FORMAT GRADER OG DESIMALMINUTTER
     ===================================================== */

  function dmPart(
    number,
    degreeWidth,
    positive,
    negative
  ) {
    const hemisphere = number < 0
      ? negative
      : positive;

    let degrees = Math.floor(
      Math.abs(number)
    );

    let minutes = Math.round(
      (Math.abs(number) - degrees) * 60000
    ) / 1000;

    if (minutes >= 60) {
      degrees++;
      minutes = 0;
    }

    return (
      `${String(degrees).padStart(degreeWidth, "0")}° ` +
      `${minutes.toFixed(3).padStart(6, "0")}' ` +
      hemisphere
    );
  }

  function formatDm(position) {
    return (
      dmPart(position.lat, 2, "N", "S") +
      " " +
      dmPart(position.lon, 2, "Ø", "V")
    );
  }

  /* =====================================================
     FORMAT UTM
     ===================================================== */

  function formatUtm(position) {
    return (
      `UTM${position.zone}${position.band} ` +
      `Ø ${Math.round(position.east)} ` +
      `N ${Math.round(position.north)}`
    );
  }

  /* =====================================================
     OPPRETT POSISJONSFELT
     ===================================================== */

  function initializePosition() {
    const original = $("position");

    if (!original) return;

    const parent = original.closest(
      ".form-field"
    );

    if (!parent) return;

    // Eksisterende rapportgenerator leser
    // fortsatt feltet med ID "position".
    original.type = "hidden";

    original.setAttribute(
      "aria-hidden",
      "true"
    );

    const panel = document.createElement("div");

    panel.className = "position-converter";

    panel.innerHTML = `
      <div class="position-converter-field">
        <label for="utmPosition">UTM</label>

        <input
          id="utmPosition"
          type="text"
          spellcheck="false"
          autocomplete="off"
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
          aria-describedby="positionNotice"
        >
      </div>

      <p
        id="positionNotice"
        role="status"
        aria-live="polite"
      ></p>
    `;

    parent.appendChild(panel);

    /* ===================================================
       STIL FOR FELTENE
       =================================================== */

    const style = document.createElement(
      "style"
    );

    style.textContent = `
      .position-converter {
        display: grid;
        gap: 8px;
        margin-top: 2px;
        width: 100%;
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

    const utm = $("utmPosition");
    const dm = $("dmPosition");
    const notice = $("positionNotice");

    /* ===================================================
       OPPDATER RAPPORT
       =================================================== */

    function propagate() {
      original.dispatchEvent(
        new Event("input", {
          bubbles: true
        })
      );
    }

    /* ===================================================
       KONVERTER INPUT
       =================================================== */

    function handle(source) {
      const field = source === "utm"
        ? utm
        : dm;

      const other = source === "utm"
        ? dm
        : utm;

      const raw = field.value.trim();

      if (!raw) {
        lastGood = null;

        other.value = "";
        original.value = "";

        notice.textContent = "";
        notice.classList.remove(
          "position-error"
        );

        propagate();
        return;
      }

      try {
        const position = source === "utm"
          ? parseUtm(raw)
          : parseDm(raw);

        lastGood = position;

        // Oppdater motsatt felt.
        // Behold teksten i aktivt felt til
        // brukeren forlater feltet.

        if (source === "utm") {
          dm.value = formatDm(position);
        } else {
          utm.value = formatUtm(position);
        }

        // Eksisterende GPS-rapportgenerator
        // leser denne verdien automatisk.
        original.value = formatUtm(position);

        notice.textContent =
          "Posisjonen er tolket og konvertert.";

        notice.classList.remove(
          "position-error"
        );

      } catch (error) {
        lastGood = null;

        // Ikke behold en eldre konvertering.
        other.value = "";

        // Behold originalteksten for kontroll.
        original.value =
          "IKKE VERIFISERT: " + raw;

        notice.textContent =
          error.message ||
          "Koordinaten kunne ikke kontrolleres.";

        notice.classList.add(
          "position-error"
        );
      }

      propagate();
    }

    /* ===================================================
       INPUT-HENDELSER
       =================================================== */

    utm.addEventListener("input", () => {
      handle("utm");
    });

    dm.addEventListener("input", () => {
      handle("dm");
    });

    utm.addEventListener("blur", () => {
      if (lastGood) {
        utm.value = formatUtm(lastGood);
      }
    });

    dm.addEventListener("blur", () => {
      if (lastGood) {
        dm.value = formatDm(lastGood);
      }
    });

    /* ===================================================
       TØM SKJEMA
       =================================================== */

    const reset = $("resetButton");

    reset?.addEventListener("click", () => {
      // Hovedfilen tømmer skjemaet.
      // Rydd opp i koordinatfeltene etterpå.

      setTimeout(() => {
        if (!original.value) {
          utm.value = "";
          dm.value = "";

          lastGood = null;

          notice.textContent = "";
          notice.classList.remove(
            "position-error"
          );
        }
      }, 0);
    });
  }

  /* =====================================================
     OPPSTART
     ===================================================== */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializePosition
    );
  } else {
    initializePosition();
  }

})();
