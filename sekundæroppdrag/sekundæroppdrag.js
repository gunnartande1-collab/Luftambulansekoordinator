
/* =====================================================
   LUFTAMBULANSEKOORDINATOR – SEKUNDÆROPPDRAG
   SKJEMALOGIKK OG RAPPORTGENERATOR
   ===================================================== */

(() => {
  "use strict";

  const form = document.getElementById("transportForm");
  const rapport = document.getElementById("rapport");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const printBtn = document.getElementById("printButton");
  const copyMsg = document.getElementById("copyMsg");
  const printReport = document.getElementById("printReport");

  if (!form || !rapport) return;

  let copyTimer = null;

  /* ==========================================
     HJELPEFUNKSJONER
     ========================================== */

  function clean(value) {
    return String(value ?? "").trim();
  }

  function value(name) {
    const element = form.elements.namedItem(name);
    if (!element) return "";

    if (element instanceof RadioNodeList) {
      return clean(element.value);
    }

    return clean(element.value);
  }

  function checkedValues(name) {
    return Array.from(
      form.querySelectorAll(
        `input[name="${name}"]:checked`
      )
    ).map(element => element.value);
  }

  function selected(name) {
    return checkedValues(name)[0] || "";
  }

  function appendLine(lines, label, data) {
    const text = clean(data);
    if (text) lines.push(`${label}: ${text}`);
  }

  function appendSection(lines, title, entries) {
    if (!entries.length) return;
    if (lines.length) lines.push("");
    lines.push(title.toUpperCase(), ...entries);
  }

  function appendList(lines, label, items) {
    const filtered = items.map(clean).filter(Boolean);
    if (filtered.length) {
      appendLine(lines, label, filtered.join("; "));
    }
  }

  function setVisible(id, visible) {
    const element = document.getElementById(id);
    if (element) element.hidden = !visible;
  }

  function formatPhone(phone) {
    const raw = clean(phone);
    if (!raw) return "";

    if (typeof window.LAK?.formatPhoneNumber === "function") {
      return window.LAK.formatPhoneNumber(raw);
    }

    return raw;
  }

  /* ==========================================
     DATO – AUTOMATISK DAGENS DATO
     KAN ENDRES UTEN KALENDER
     ========================================== */

  function localDateString() {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    return `${day}.${month}.${year}`;
  }

  const dateField = document.getElementById("oppdragDato");

  function setDefaultDate() {
    if (dateField && !dateField.value) {
      dateField.value = localDateString();
    }
  }

  function validateDate() {
    if (!dateField) return;

    const date = clean(dateField.value);

    if (!date) {
      dateField.setCustomValidity("");
      return;
    }

    const match = date.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (!match) {
      dateField.setCustomValidity(
        "Bruk datoformatet DD.MM.ÅÅÅÅ."
      );
      return;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const parsed = new Date(year, month - 1, day);

    const valid =
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day;

    dateField.setCustomValidity(
      valid ? "" : "Ugyldig dato."
    );
  }

  dateField?.addEventListener("input", validateDate);

  /* ==========================================
     EKSKLUSIVE VALG
     ========================================== */

  document.querySelectorAll(
    "[data-exclusive-group]"
  ).forEach(group => {
    group.addEventListener("change", event => {
      const changed = event.target;

      if (!changed.matches('input[type="checkbox"]')) {
        return;
      }

      if (!changed.checked) return;

      const boxes = Array.from(
        group.querySelectorAll('input[type="checkbox"]')
      );

      if (changed.hasAttribute("data-none")) {
        boxes.forEach(box => {
          if (box !== changed) box.checked = false;
        });
      } else {
        const none = boxes.find(
          box => box.hasAttribute("data-none")
        );

        if (none) none.checked = false;
      }
    });
  });

  /* ==========================================
     BARN
     ========================================== */

  function updateChildDetails() {
    const child = selected("barn");

    setVisible(
      "childDetails",
      Boolean(child && child !== "Nei")
    );
  }

  /* ==========================================
     LUFTVEIER
     ========================================== */

  function updateAirwayDetails() {
    const airway = selected("luftvei");
    const trach = selected("trachForm");

    const oxygen = Boolean(
      airway && airway !== "Spontan uten O2"
    );

    setVisible("oxygenDetails", oxygen);
    setVisible("trachDetails", airway === "Trakeostomi");

    const flow =
      airway === "Spontan med O2" ||
      airway === "High flow" ||
      (
        airway === "Trakeostomi" &&
        trach === "O2 via trakeostomi"
      );

    const fio2 =
      airway === "High flow" ||
      airway === "NIV (CPAP/BiPAP)" ||
      airway === "Intubert" ||
      (
        airway === "Trakeostomi" &&
        trach === "Respirator via trakeostomi"
      );

    const ventilation =
      airway === "Intubert" ||
      (
        airway === "Trakeostomi" &&
        trach === "Respirator via trakeostomi"
      );

    setVisible("flowField", flow);
    setVisible("fio2Field", fio2);
    setVisible("peepField", ventilation);
    setVisible("peakField", ventilation);
  }

  /* ==========================================
     TILGANGER OG UTSTYR
     ========================================== */

  function updateAccessDetails() {
    const access = checkedValues("tilganger");
    const cvk = access.includes("CVK");
    const pvk = access.includes("PVK");

    setVisible("accessDetails", cvk || pvk);
    setVisible("cvkField", cvk);
    setVisible("pvkField", pvk);
  }

  function updateEquipmentDetails() {
    setVisible(
      "pumpDetails",
      checkedValues("utstyr").includes("Sprøytepumper")
    );
  }

  /* ==========================================
     SMITTE
     ========================================== */

  const infectionNone = document.getElementById("smitteIngen");
  const bloodInfection = document.getElementById("blodsmitte");

  function updateInfectionDetails() {
    const infection = selected("smitte");
    const blood = bloodInfection?.checked ?? false;

    setVisible(
      "infectionDetails",
      (
        Boolean(infection) &&
        infection !== "Ingen kjente"
      ) || blood
    );
  }

  infectionNone?.addEventListener("change", () => {
    if (infectionNone.checked && bloodInfection) {
      bloodInfection.checked = false;
    }
  });

  bloodInfection?.addEventListener("change", () => {
    if (bloodInfection.checked && infectionNone) {
      infectionNone.checked = false;
    }
  });

  /* ==========================================
     CAVE
     ========================================== */

  function updateCaveDetails() {
    setVisible("caveDetails", selected("cave") === "Ja");
  }

  function updateConditions() {
    updateChildDetails();
    updateAirwayDetails();
    updateAccessDetails();
    updateEquipmentDetails();
    updateInfectionDetails();
    updateCaveDetails();
  }

  /* ==========================================
     AUTOMATISKE FRITEKSTFELTER
     ========================================== */

  const autoFields = [
    "sedationRows",
    "pressorRows",
    "otherMedicationRows",
    "accessRows",
    "equipmentRows"
  ];

  const autoGroups = {
    sedationRows: "sedasjon",
    pressorRows: "pressor",
    otherMedicationRows: "annenInfusjon",
    accessRows: "tilganger",
    equipmentRows: "utstyr"
  };

  function getAutoInputs(container) {
    return Array.from(
      container.querySelectorAll(".auto-row input")
    );
  }

  function dynamicValues(containerId) {
    const container = document.getElementById(containerId);

    if (!container) return [];

    return getAutoInputs(container)
      .map(input => clean(input.value))
      .filter(Boolean);
  }

  function createAutoRow(container) {
    const row = document.createElement("div");
    row.className = "auto-row";

    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = container.dataset.placeholder || "";

    input.setAttribute(
      "aria-label",
      container.dataset.placeholder || "Opplysning"
    );

    row.appendChild(input);
    container.appendChild(row);

    return input;
  }

  /*
     Regler:
     1. Alle linjer med tekst beholdes.
     2. Det skal finnes én tom linje.
     3. Den tomme linjen skal ligge nederst.
     4. Når tekst slettes, fjernes ekstra tomme linjer.
  */

  function normalizeAutoRows(container, activeInput = null) {
    let inputs = getAutoInputs(container);

    // Fjern tomme felt som ikke brukes.
    inputs.forEach(input => {
      if (
        !clean(input.value) &&
        input !== activeInput
      ) {
        input.closest(".auto-row")?.remove();
      }
    });

    inputs = getAutoInputs(container);

    // Dersom aktivt felt er blitt tømt, behold det som
    // den ene ledige linjen, og flytt det nederst.
    if (
      activeInput &&
      activeInput.isConnected &&
      !clean(activeInput.value)
    ) {
      container.appendChild(
        activeInput.closest(".auto-row")
      );
    }

    inputs = getAutoInputs(container);

    // Hvis siste linje har tekst, opprett ny tom linje.
    const last = inputs[inputs.length - 1];

    if (!last || clean(last.value)) {
      createAutoRow(container);
    }
  }

  function initializeAutoRows() {
    autoFields.forEach(id => {
      const container = document.getElementById(id);

      if (!container) return;

      container.replaceChildren();
      createAutoRow(container);

      container.addEventListener("input", event => {
        if (!event.target.matches("input")) return;

        normalizeAutoRows(container, event.target);
        clearNoneForDynamic(id);
        buildReport();
      });

      container.addEventListener("focusout", () => {
        // Etter at brukeren forlater feltet, rydd listen.
        // Bruk en mikrotask for å la fokusbyttet fullføres.
        queueMicrotask(() => {
          const focused = document.activeElement;

          normalizeAutoRows(
            container,
            container.contains(focused) ? focused : null
          );
        });
      });

      container.addEventListener("keydown", event => {
        if (
          event.key !== "Enter" ||
          !event.target.matches("input")
        ) {
          return;
        }

        event.preventDefault();

        const inputs = getAutoInputs(container);
        const index = inputs.indexOf(event.target);

        normalizeAutoRows(container, event.target);

        const updated = getAutoInputs(container);

        // Gå til neste felt, eventuelt den tomme linjen.
        const next = updated[index + 1];

        if (next) next.focus();
      });
    });
  }

  /* ==========================================
     "NEI" / "INGEN" VED FRITEKST
     ========================================== */

  function clearNoneForDynamic(containerId) {
    if (!dynamicValues(containerId).length) return;

    const groupName = autoGroups[containerId];
    const group = form.querySelector(
      `[data-exclusive-group="${groupName}"]`
    );

    const none = group?.querySelector("[data-none]");

    if (none) none.checked = false;
  }

  function syncNoneWithText() {
    autoFields.forEach(clearNoneForDynamic);
  }

  function getGroupValues(groupName) {
    const values = checkedValues(groupName);

    const entry = Object.entries(autoGroups).find(
      ([, name]) => name === groupName
    );

    if (
      entry &&
      dynamicValues(entry[0]).length
    ) {
      return values.filter(
        item => item !== "Nei" && item !== "Ingen"
      );
    }

    return values;
  }

  /* ==========================================
     RAPPORTGENERATOR
     ========================================== */

  function buildReport() {
    syncNoneWithText();

    const lines = [];

    lines.push("SEKUNDÆROPPDRAG");
    lines.push("Intensiv- og helikoptertransport");

    const haste = selected("hastegrad");

    if (haste) {
      lines.push(`Rekvirert hastegrad: ${haste}`);
    }

    /* TRANSPORT */

    const transport = [];

    appendLine(transport, "Fra", value("fra"));
    appendLine(transport, "Til", value("til"));
    appendLine(transport, "Dato", value("dato"));
    appendLine(transport, "Klokkeslett", value("tidspunkt"));
    appendLine(transport, "Ressurs-ID", value("ressurs"));

    appendLine(
      transport,
      "Transportopplysninger",
      value("transportMerknad")
    );

    appendSection(lines, "Transport", transport);

    /* FØLGEBEHOV */

    const follow = checkedValues("folge");

    if (follow.length) {
      appendSection(lines, "Følgebehov fra rekvirent", [
        follow.join(", ")
      ]);
    }

    /* SPESIALTRANSPORT */

    const special = checkedValues("spesial");
    const specialLines = [];

    if (special.length) {
      specialLines.push(special.join(", "));
    }

    appendLine(
      specialLines,
      "Merknad",
      value("spesialMerknad")
    );

    appendSection(lines, "Spesialtransport", specialLines);

    /* PASIENT */

    const patient = [];

    const age = value("alder");
    const ageUnit = selected("alderEnhet") || "år";

    if (age) {
      appendLine(patient, "Alder", `${age} ${ageUnit}`);
    }

    appendLine(patient, "Kjønn", selected("kjonn"));

    const weight = value("vekt");
    const weightUnit = selected("vektEnhet") || "kg";

    if (weight) {
      appendLine(
        patient,
        "Vekt",
        `${weight} ${weightUnit}`
      );
    }

    const child = selected("barn");

    if (child) {
      appendLine(patient, "Barn", child);

      if (child !== "Nei") {
        const ga = [];

        if (value("gaUker")) {
          ga.push(`${value("gaUker")} uker`);
        }

        if (value("gaDager")) {
          ga.push(`${value("gaDager")} dager`);
        }

        if (ga.length) {
          appendLine(
            patient,
            "Gestasjonsalder",
            ga.join(" + ")
          );
        }

        appendLine(
          patient,
          "Transportform",
          selected("barnTransport")
        );
      }
    }

    appendSection(lines, "Pasient", patient);

    /* MEDISINSK PROBLEMSTILLING */

    const medical = [];

    appendLine(medical, "Aktuelt", value("aktuelt"));
    appendLine(medical, "Tidligere", value("tidligere"));

    appendSection(
      lines,
      "Medisinsk problemstilling",
      medical
    );

    /* LUFTVEIER */

    const airwayLines = [];
    const airway = selected("luftvei");

    if (airway) airwayLines.push(airway);

    if (airway === "Trakeostomi") {
      appendLine(
        airwayLines,
        "Respirasjonsform",
        selected("trachForm")
      );
    }

    function visibleValue(fieldId, name) {
      const field = document.getElementById(fieldId);

      if (
        !airway ||
        !field ||
        field.hidden
      ) {
        return "";
      }

      return value(name);
    }

    const flow = visibleValue("flowField", "flow");
    const fio2 = visibleValue("fio2Field", "fio2");
    const peep = visibleValue("peepField", "peep");
    const peak = visibleValue("peakField", "topptrykk");

    if (flow) {
      appendLine(airwayLines, "O2 / flow", `${flow} l/min`);
    }

    if (fio2) {
      appendLine(airwayLines, "FiO2", `${fio2} %`);
    }

    appendLine(airwayLines, "PEEP", peep);
    appendLine(airwayLines, "Topptrykk", peak);

    appendSection(lines, "Luftveier", airwayLines);

    /* VITALPARAMETRE */

    const vitals = [];

    if (value("rf")) {
      vitals.push(`RF ${value("rf")}`);
    }

    if (value("spo2")) {
      vitals.push(`SpO2 ${value("spo2")} %`);
    }

    if (value("puls")) {
      vitals.push(`Puls ${value("puls")}`);
    }

    const sys = value("sys");
    const dia = value("dia");

    if (sys || dia) {
      vitals.push(`BT ${sys || "?"}/${dia || "?"}`);
    }

    if (value("map")) {
      vitals.push(`MAP ${value("map")}`);
    }

    if (value("temp")) {
      vitals.push(`Tmp ${value("temp")} °C`);
    }

    if (value("gcs")) {
      vitals.push(`GCS ${value("gcs")}`);
    }

    if (vitals.length) {
      appendSection(lines, "Vitalparametre", [
        vitals.join(", ")
      ]);
    }

    /* MEDIKAMENTER */

    const medication = [];

    appendList(
      medication,
      "Sedasjon / analgesi",
      getGroupValues("sedasjon")
    );

    appendList(
      medication,
      "Andre sedativa / dosering",
      dynamicValues("sedationRows")
    );

    appendList(
      medication,
      "Pressorer / vasoaktive medikamenter",
      getGroupValues("pressor")
    );

    appendList(
      medication,
      "Andre pressorer / dosering",
      dynamicValues("pressorRows")
    );

    appendList(
      medication,
      "Andre medikamenter / infusjoner",
      [
        ...getGroupValues("annenInfusjon"),
        ...dynamicValues("otherMedicationRows")
      ]
    );

    appendSection(
      lines,
      "Medikamenter og infusjoner",
      medication
    );

    /* TILGANGER */

    const access = [];
    const accessValues = getGroupValues("tilganger");

    if (accessValues.includes("Ingen")) {
      access.push("Ingen oppgitte tilganger");
    } else {
      if (accessValues.includes("CVK")) {
        const lumen = value("cvkLumen");

        access.push(
          lumen
            ? `CVK, ${lumen} lumen`
            : "CVK"
        );
      }

      if (accessValues.includes("PVK")) {
        const count = value("pvkAntall");

        access.push(
          count
            ? `PVK, ${count} stk`
            : "PVK"
        );
      }
    }

    access.push(...dynamicValues("accessRows"));

    appendSection(lines, "Tilganger", access);

    /* UTSTYR */

    const equipment = [];
    const equipmentValues = getGroupValues("utstyr");

    if (equipmentValues.includes("Ingen")) {
      equipment.push("Ingen oppgitt");
    } else {
      equipmentValues.forEach(item => {
        if (item === "Sprøytepumper") {
          const count = value("pumperAntall");

          equipment.push(
            count
              ? `Sprøytepumper: ${count} stk`
              : "Sprøytepumper"
          );
        } else {
          equipment.push(item);
        }
      });
    }

    equipment.push(...dynamicValues("equipmentRows"));

    appendSection(
      lines,
      "Medisinsk utstyr",
      equipment
    );

    /* SMITTE OG CAVE */

    const safety = [];
    const infection = selected("smitte");
    const blood = bloodInfection?.checked ?? false;

    if (infection === "Ingen kjente" && !blood) {
      safety.push("Smitte: Ingen kjente");
    } else {
      if (
        infection &&
        infection !== "Ingen kjente"
      ) {
        appendLine(safety, "Smitte", infection);
      }

      if (blood) {
        safety.push("Blodsmitte");
      }

      if (infection || blood) {
        appendLine(
          safety,
          "Smitteopplysninger",
          value("smitteMerknad")
        );
      }
    }

    const cave = selected("cave");
    appendLine(safety, "CAVE", cave);

    if (cave === "Ja") {
      appendLine(
        safety,
        "CAVE-spesifisering",
        value("caveMerknad")
      );
    }

    appendSection(lines, "Smitte og CAVE", safety);

    /* LEGEKONTAKT */

    const contacts = [];

    const requestingDoctor = [
      value("rekLege"),
      formatPhone(value("rekTlf"))
    ].filter(Boolean);

    const receivingDoctor = [
      value("mottLege"),
      formatPhone(value("mottTlf"))
    ].filter(Boolean);

    if (requestingDoctor.length) {
      contacts.push(
        `Rekvirerende lege: ${requestingDoctor.join(" / ")}`
      );
    }

    if (receivingDoctor.length) {
      contacts.push(
        `Mottakende lege: ${receivingDoctor.join(" / ")}`
      );
    }

    appendSection(lines, "Legekontakt", contacts);

    /* OPPDATER RAPPORT */

    rapport.value = lines.join("\n");

    if (printReport) {
      printReport.textContent = rapport.value;
    }
  }

  /* ==========================================
     KOPIER RAPPORT
     ========================================== */

  function showCopyMessage(message) {
    if (!copyMsg) return;

    copyMsg.textContent = message;

    if (copyTimer) {
      clearTimeout(copyTimer);
    }

    copyTimer = setTimeout(() => {
      copyMsg.textContent = "";
      copyTimer = null;
    }, 5000);
  }

  async function copyReport() {
    const text = rapport.value;
    if (!text.trim()) return;

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
      } else {
        rapport.focus();
        rapport.select();

        const success = document.execCommand("copy");

        if (!success) {
          throw new Error("Kopiering feilet");
        }

        rapport.setSelectionRange(0, 0);
      }

      showCopyMessage("Tekst kopiert");
    } catch (error) {
      console.error("Kopiering feilet:", error);

      showCopyMessage(
        "Kunne ikke kopiere. Marker rapportteksten manuelt."
      );
    }
  }

  copyBtn?.addEventListener("click", copyReport);

  /* ==========================================
     UTSKRIFT
     ========================================== */

  printBtn?.addEventListener("click", () => {
    buildReport();
    window.print();
  });

  /* ==========================================
     TØM SKJEMA
     ========================================== */

  resetBtn?.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Vil du tømme hele sekundæroppdragsskjemaet?"
    );

    if (!confirmed) return;

    form.reset();

    autoFields.forEach(id => {
      const container = document.getElementById(id);

      if (container) {
        container.replaceChildren();
        createAutoRow(container);
      }
    });

    if (dateField) {
      dateField.value = localDateString();
      dateField.setCustomValidity("");
    }

    if (copyMsg) {
      copyMsg.textContent = "";
    }

    if (copyTimer) {
      clearTimeout(copyTimer);
      copyTimer = null;
    }

    updateConditions();
    buildReport();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  /* ==========================================
     OPPDATERING
     ========================================== */

  form.addEventListener("submit", event => {
    event.preventDefault();
  });

  form.addEventListener("input", () => {
    updateConditions();
    buildReport();
  });

  form.addEventListener("change", () => {
    updateConditions();
    buildReport();
  });

  /* ==========================================
     INITIALISERING
     ========================================== */

  initializeAutoRows();
  setDefaultDate();
  validateDate();
  updateConditions();
  buildReport();

})();
