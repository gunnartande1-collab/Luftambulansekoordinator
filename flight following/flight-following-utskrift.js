
/* ==========================================
   FLIGHT FOLLOWING – UTSKRIFT
   Luftambulansekoordinator

   Separat utskriftsmodul.
   Endrer ikke hovedregistrering eller alarmer.

   PROTOTYPE – IKKE OPERATIV BRUK
   ========================================== */

(() => {
  "use strict";

  const STORAGE_KEY = "la-flight-following-v3";

  const ROWS_PER_BLOCK = 6;
  const BLOCKS_PER_PAGE = 3;

  const $ = id => document.getElementById(id);

  /* ========================================
     TEKST OG DATO
     ======================================== */

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

  function safeText(value) {
    return value === null ||
      value === undefined ||
      value === ""
      ? ""
      : escapeHTML(value);
  }

  function formatTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }

  function formatDate(value = new Date()) {
    const date = new Date(value);

    return date.toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function addMinutesToDate(dateValue, minutesValue) {
    if (!dateValue) return null;

    const start = new Date(dateValue);
    const text = String(minutesValue ?? "").trim();

    let minutes = null;

    if (/^\d+$/.test(text)) {
      minutes = Number(text);
    } else {
      const match = text.match(/^(\d+):(\d{1,2})$/);

      if (match && Number(match[2]) < 60) {
        minutes =
          Number(match[1]) * 60 +
          Number(match[2]);
      }
    }

    if (
      Number.isNaN(start.getTime()) ||
      !Number.isFinite(minutes) ||
      minutes <= 0 ||
      minutes > 1440
    ) {
      return null;
    }

    return new Date(
      start.getTime() + minutes * 60000
    ).toISOString();
  }

  /* ========================================
     LES LAGREDE REGISTRERINGER
     ======================================== */

  function readResources() {
    let saved;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return [];
      }

      saved = JSON.parse(raw);
    } catch (error) {
      console.error(
        "Kunne ikke lese Flight Following-data.",
        error
      );

      throw new Error(
        "Kunne ikke lese de lagrede Flight Following-registreringene."
      );
    }

    if (!Array.isArray(saved)) {
      throw new Error(
        "De lagrede Flight Following-dataene har feil format."
      );
    }

    return saved
      .filter(resource =>
        resource &&
        typeof resource.id === "string" &&
        Array.isArray(resource.flights)
      )
      .map(resource => ({
        id: resource.id,
        flights: resource.flights.filter(
          flight => flight && typeof flight === "object"
        )
      }))
      .sort((a, b) =>
        a.id.localeCompare(b.id, "nb", {
          numeric: true,
          sensitivity: "base"
        })
      );
  }

  /* ========================================
     KOLONNEOPPSETT
     ======================================== */

  const columns = [
    { title: "Fra", width: "11%" },
    { title: "Til", width: "11%" },
    { title: "Beskrivelse", width: "23%" },
    { title: "Tatt av kl.", width: "12%" },
    { title: "POB", width: "6%" },
    { title: "ETA", width: "10%" },
    { title: "Landet kl.", width: "13%" },
    { title: "Avbrutt", width: "14%" }
  ];

  function renderTableHeader() {
    return `
      <colgroup>
        ${columns.map(column => `
          <col style="width:${column.width}">
        `).join("")}
      </colgroup>

      <thead>
        <tr>
          ${columns.map(column => `
            <th scope="col">
              ${column.title}
            </th>
          `).join("")}
        </tr>
      </thead>
    `;
  }

  /* ========================================
     INNHOLD I FLIGHT LEG
     ======================================== */

  function descriptionContent(flight) {
    const description = safeText(
      flight.description
    );

    const details = [];

    if (flight.purpose) {
      details.push(String(flight.purpose));
    }

    if (flight.slingLoad) {
      details.push("Underhengende");
    }

    if (flight.searchRescue) {
      details.push("Søk/redning");
    }

    if (flight.landingPlaceNotified) {
      details.push("Landingssted informert");
    }

    if (details.length === 0) {
      return description;
    }

    return `
      <span class="ff-paper-cell-main">
        ${description}
      </span>

      <span class="ff-paper-cell-note">
        ${escapeHTML(details.join(" · "))}
      </span>
    `;
  }

  function renderFlightRow(flight) {
    const eta =
      flight.etaAt ||
      addMinutesToDate(
        flight.departureAt,
        flight.ete
      );

    const isAborted =
      flight.status === "aborted";

    const abortedContent = isAborted
      ? `
          <strong>JA</strong>
          ${flight.abortedAt
            ? `
                <span class="ff-paper-cell-note">
                  ${formatTime(flight.abortedAt)}
                </span>
              `
            : ""}
        `
      : "";

    return `
      <tr>
        <td>${safeText(flight.from)}</td>
        <td>${safeText(flight.to)}</td>

        <td>
          ${descriptionContent(flight)}
        </td>

        <td>
          ${formatTime(flight.departureAt)}
        </td>

        <td>
          ${safeText(flight.pob)}
        </td>

        <td>
          ${formatTime(eta)}
        </td>

        <td>
          ${formatTime(flight.landedAt)}
        </td>

        <td>
          ${abortedContent}
        </td>
      </tr>
    `;
  }

  function renderEmptyRow() {
    return `
      <tr>
        ${columns.map(() => "<td></td>").join("")}
      </tr>
    `;
  }

  /* ========================================
     RESSURSBLOKK
     ======================================== */

  function renderResourceBlock(block) {
    const flights = block.flights || [];

    const resourceId = safeText(block.id);

    const destination =
      block.destination || "";

    const rows = flights.map(
      renderFlightRow
    );

    while (rows.length < ROWS_PER_BLOCK) {
      rows.push(renderEmptyRow());
    }

    return `
      <section class="ff-paper-block">

        <div class="ff-paper-resource-row">

          <div class="ff-paper-resource-field">
            <strong>LA ressurs:</strong>

            <span class="ff-paper-resource-value">
              ${resourceId}
            </span>
          </div>

          <div class="ff-paper-resource-field">
            <strong>Destinasjon:</strong>

            <span class="ff-paper-resource-value">
              ${safeText(destination)}
            </span>
          </div>

        </div>

        <table class="ff-paper-table">

          ${renderTableHeader()}

          <tbody>
            ${rows.join("")}
          </tbody>

        </table>

      </section>
    `;
  }

  function emptyBlock() {
    return {
      id: "",
      destination: "",
      flights: []
    };
  }

  /* ========================================
     DEL RESSURSER I BLOKKER
     ======================================== */

  function buildActiveBlocks(resources) {
    const blocks = [];

    for (const resource of resources) {
      const flights = resource.flights;

      if (!flights.length) {
        blocks.push({
          id: resource.id,
          destination: "",
          flights: []
        });

        continue;
      }

      for (
        let index = 0;
        index < flights.length;
        index += ROWS_PER_BLOCK
      ) {
        const chunk = flights.slice(
          index,
          index + ROWS_PER_BLOCK
        );

        const activeOrLatest = [...chunk]
          .reverse()
          .find(flight =>
            flight.status === "active" ||
            flight.status === "aborted"
          ) || chunk[chunk.length - 1];

        blocks.push({
          id: resource.id,
          destination: activeOrLatest?.to || "",
          flights: chunk
        });
      }
    }

    return blocks;
  }

  function splitIntoPages(blocks) {
    const pages = [];

    for (
      let index = 0;
      index < blocks.length;
      index += BLOCKS_PER_PAGE
    ) {
      pages.push(
        blocks.slice(
          index,
          index + BLOCKS_PER_PAGE
        )
      );
    }

    if (!pages.length) {
      pages.push([]);
    }

    for (const page of pages) {
      while (page.length < BLOCKS_PER_PAGE) {
        page.push(emptyBlock());
      }
    }

    return pages;
  }

  /* ========================================
     DOKUMENTHODE
     ======================================== */

  function renderHeader(
    pageNumber,
    totalPages,
    blank
  ) {
    const subtitle = blank
      ? "Skjema for manuell registrering"
      : "Registrerte Flight Following-opplysninger";

    return `
      <header class="ff-paper-header">

        <div>
          <div class="ff-paper-brand">
            AMK-LA | Luftambulansekoordinator
          </div>

          <h1 class="ff-paper-title">
            Flight Following
          </h1>

          <div class="ff-paper-subtitle">
            ${subtitle}
          </div>
        </div>

        <div class="ff-paper-meta">

          <div class="ff-paper-meta-row">
            <span class="ff-paper-meta-label">
              Dato
            </span>

            <span class="ff-paper-meta-value">
              ${blank ? "" : formatDate()}
            </span>
          </div>

          <div class="ff-paper-meta-row">
            <span class="ff-paper-meta-label">
              Side
            </span>

            <span class="ff-paper-meta-value">
              ${pageNumber} av ${totalPages}
            </span>
          </div>

          <div class="ff-paper-meta-row">
            <span class="ff-paper-meta-label">
              Type
            </span>

            <span class="ff-paper-meta-value">
              ${blank ? "Manuell" : "Registrert"}
            </span>
          </div>

        </div>

      </header>
    `;
  }

  /* ========================================
     BUNNTEKST
     ======================================== */

  function renderFooter(pageNumber) {
    return `
      <footer class="ff-paper-footer">

        <span>
          <strong>
            Flight Following – arbeidsutkast
          </strong>
          |
          Ikke godkjent operativt skjema.
          Følg gjeldende OUS-prosedyre.
        </span>

        <span class="ff-paper-footer-page">
          Side ${pageNumber}
        </span>

      </footer>
    `;
  }

  /* ========================================
     BYGG A4-SIDENE
     ======================================== */

  function buildPrintPages(blocks, blank) {
    const pages = splitIntoPages(blocks);
    const totalPages = pages.length;

    return pages.map((page, index) => {
      const pageNumber = index + 1;

      return `
        <section class="ff-paper-page">

          ${renderHeader(
            pageNumber,
            totalPages,
            blank
          )}

          <div class="ff-paper-blocks">
            ${page.map(
              renderResourceBlock
            ).join("")}
          </div>

          ${renderFooter(pageNumber)}

        </section>
      `;
    }).join("");
  }

  /* ========================================
     UTSKRIFT
     ======================================== */

  function preparePrint(html) {
    const printArea = $("printArea");

    if (!printArea) {
      alert("Utskriftsområdet mangler.");
      return;
    }

    printArea.innerHTML = html;

    // Nettleserens utskriftsdialog.
    // Brukeren velger selv skriver eller PDF.
    window.print();
  }

  function printRegistered() {
    let resources;

    try {
      resources = readResources();
    } catch (error) {
      alert(error.message);
      return;
    }

    if (!resources.length) {
      alert(
        "Ingen Flight Following er registrert."
      );
      return;
    }

    const blocks = buildActiveBlocks(resources);

    preparePrint(
      buildPrintPages(blocks, false)
    );
  }

  function printBlank() {
    const blocks = Array.from(
      { length: BLOCKS_PER_PAGE },
      () => emptyBlock()
    );

    preparePrint(
      buildPrintPages(blocks, true)
    );
  }

  /* ========================================
     KOBLE UTSKRIFTSKNAPPENE
     ======================================== */

  function connectPrintButton(id, callback) {
    const oldButton = $(id);

    if (!oldButton) {
      console.warn(
        "Fant ikke utskriftsknappen:",
        id
      );
      return;
    }

    /*
      Den eksisterende hovedfilen registrerer
      også klikkhendelser for utskrift.

      Vi erstatter bare selve knappelementet
      med en identisk kopi uten gamle
      klikkhendelser.

      Alle øvrige FF-funksjoner beholdes.
    */

    const newButton = oldButton.cloneNode(true);

    oldButton.replaceWith(newButton);

    newButton.addEventListener(
      "click",
      callback
    );
  }

  function initialize() {
    connectPrintButton(
      "printActiveBtn",
      printRegistered
    );

    connectPrintButton(
      "printBlankBtn",
      printBlank
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
