
/* =========================================================
   LUFTAMBULANSEKOORDINATOR - SEKUNDÆROPPDRAG
   ========================================================= */

(() => {
  "use strict";

  const form = document.getElementById("transportForm");
  const rapport = document.getElementById("rapport");
  const copyBtn = document.getElementById("copyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyMsg = document.getElementById("copyMsg");

  if (!form || !rapport) return;

  let copyTimer = null;

  /* HJELPEFUNKSJONER */

  const clean = value => String(value ?? "").trim();

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
      form.querySelectorAll(`input[name="${name}"]:checked`)
    ).map(element => element.value);
  }

  function selected(name) {
    return checkedValues(name)[0] || "";
  }

  function appendLine(lines, label, data) {
    const text = clean(data);

    if (text) {
      lines.push(`${label}: ${text}`);
    }
  }

  function appendSection(lines, title, entries) {
    if (!entries.length) return;
    if (lines.length) lines.push("");

    lines.push(title.toUpperCase());
    lines.push(...entries);
  }

  function dynamicValues(containerId) {
    const container = document.getElementById(containerId);

    if (!container) return [];

    return Array.from(
      container.querySelectorAll("input")
    ).map(input => clean(input.value)).filter(Boolean);
  }

  function setVisible(id, visible) {
    const element = document.getElementById(id);
    if (element) element.hidden = !visible;
  }

  function showField(id, visible) {
    setVisible(id, visible);
  }

  /* VALG DER 'INGEN' SKAL VÆRE EKSKLUSIVT */

  document.querySelectorAll(
    "[data-exclusive-group]"
  ).forEach(group => {

    group.addEventListener("change", event => {
      const changed = event.target;

      if (!changed.matches('input[type="checkbox"]')) {
        return;
      }

      const boxes = Array.from(
        group.querySelectorAll('input[type="checkbox"]')
      );

      if (!changed.checked) return;

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

  /* BARN / KUVØSE */

  function updateChildDetails() {
    const child = selected("barn");
    const visible = !!child && child !== "Nei";

    setVisible("childDetails", visible);
  }

  /* LUFTVEIER */

  function updateAirwayDetails() {
    const airway = selected("luftvei");
    const trach = selected("trachForm");

    const oxygen =
      airway && airway !== "Spontan uten O2";

    setVisible("oxygenDetails", Boolean(oxygen));
    setVisible("trachDetails", airway === "Trakeostomi");

    const oxygenFlow =
      airway === "Spontan med O2" ||
      airway === "High flow" ||
      (airway === "Trakeostomi" &&
        trach === "O2 via trakeostomi");

    const fio2 =
      airway === "High flow" ||
      airway === "NIV (CPAP/BiPAP)" ||
      airway === "Intubert" ||
      (airway === "Trakeostomi" &&
        trach === "Respirator via trakeostomi");

    const ventilation =
      airway === "Intubert" ||
      (airway === "Trakeostomi" &&
        trach === "Respirator via trakeostomi");

    showField("flowField", oxygenFlow);
    showField("fio2Field", fio2);
    showField("peepField", ventilation);
    showField("peakField", ventilation);
  }

  /* TILGANGER */

  function updateAccessDetails() {
    const access = checkedValues("tilganger");

    setVisible(
      "accessDetails",
      access.includes("CVK") || access.includes("PVK")
    );

    showField("cvkField", access.includes("CVK"));
    showField("pvkField", access.includes("PVK"));
  }

  /* UTSTYR */

  function updateEquipmentDetails() {
    setVisible(
      "pumpDetails",
      checkedValues("utstyr").includes("Sprøytepumper")
    );
  }

  /* CAVE */

  function updateCaveDetails() {
    setVisible("caveDetails", selected("cave") === "Ja");
  }

  function updateConditions() {
    updateChildDetails();
    updateAirwayDetails();
    updateAccessDetails();
    updateEquipmentDetails();
    updateCaveDetails();
  }

  /* DYNAMISKE LINJER */

  const dynamicLists = {
    sedationRows: "Preparat, dose / infusjon",
    pressorRows: "Medikament, dose / infusjon",
    otherMedicationRows: "Medikament eller infusjon",
    accessRows: "Annen tilgang",
    equipmentRows: "Annet utstyr"
  };

  function addDynamicRow(containerId, initialValue = "") {
    const container = document.getElementById(containerId);

    if (!container) return;

    const row = document.createElement("div");
    row.className = "dynamic-row";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = dynamicLists[containerId] || "Opplysning";
    input.setAttribute("aria-label", input.placeholder);
    input.value = initialValue;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-btn";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Fjern linje");

    remove.addEventListener("click", () => {
      row.remove();
      buildReport();
    });

    input.addEventListener("input", buildReport);

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        addDynamicRow(containerId);
      }
    });

    row.append(input, remove);
    container.appendChild(row);

    input.focus();
  }

  document.querySelectorAll("[data-add]").forEach(button => {
    button.addEventListener("click", () => {
      addDynamicRow(button.dataset.add);
    });
  });

  /* RAPPORTBYGGING */

  function buildReport() {
    const lines = [];
    const haste = selected("hastegrad");

    lines.push("SEKUNDÆROPPDRAG");
    lines.push("Intensiv- og helikoptertransport");

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

    appendLine(patient, "Alder", value("alder"));
    appendLine(patient, "Kjønn", value("kjonn"));

    if (value("vekt")) {
      appendLine(patient, "Vekt", `${value("vekt")} kg`);
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
          appendLine(patient, "Gestasjonsalder", ga.join(" + "));
        }

        appendLine(
          patient,
          "Transportform",
          selected("barnTransport")
        );
      }
    }

    appendSection(lines, "Pasient", patient);

    /* PROBLEMSTILLING */

    const medical = [];

    appendLine(medical, "Aktuelt", value("aktuelt"));
    appendLine(medical, "Tidligere", value("tidligere"));

    appendSection(lines, "Medisinsk problemstilling", medical);

    /* LUFTVEIER */

    const airwayLines = [];
    const airway = selected("luftvei");

    if (airway) {
      airwayLines.push(airway);
    }

    if (airway === "Trakeostomi") {
      appendLine(
        airwayLines,
        "Respirasjonsform",
        selected("trachForm")
      );
    }

    const flowVisible =
      !document.getElementById("flowField").hidden;

    const fio2Visible =
      !document.getElementById("fio2Field").hidden;

    const peepVisible =
      !document.getElementById("peepField").hidden;

    const peakVisible =
      !document.getElementById("peakField").hidden;

    if (airway && flowVisible && value("flow")) {
      appendLine(
        airwayLines,
        "O2 / flow",
        `${value("flow")} l/min`
      );
    }

    if (airway && fio2Visible && value("fio2")) {
      appendLine(
        airwayLines,
        "FiO2",
        `${value("fio2")} %`
      );
    }

    if (airway && peepVisible) {
      appendLine(airwayLines, "PEEP", value("peep"));
    }

    if (airway && peakVisible) {
      appendLine(
        airwayLines,
        "Topptrykk",
        value("topptrykk")
      );
    }

    appendSection(lines, "Luftveier", airwayLines);

    /* VITALPARAMETRE */

    const vitals = [];

    if (value("rf")) vitals.push(`RF ${value("rf")}`);
    if (value("spo2")) vitals.push(`SpO2 ${value("spo2")} %`);
    if (value("puls")) vitals.push(`Puls ${value("puls")}`);

    const sys = value("sys");
    const dia = value("dia");

    if (sys || dia) {
      vitals.push(`BT ${sys || "?"}/${dia || "?"}`);
    }

    if (value("map")) vitals.push(`MAP ${value("map")}`);
    if (value("temp")) vitals.push(`Tmp ${value("temp")} °C`);
    if (value("gcs")) vitals.push(`GCS ${value("gcs")}`);

    if (vitals.length) {
      appendSection(lines, "Vitalparametre", [
        vitals.join(", ")
      ]);
    }

    /* MEDIKAMENTER */

    const medication = [];

    const sedations = checkedValues("sedasjon");

    if (sedations.length) {
      appendLine(
        medication,
        "Sedasjon / analgesi",
        sedations.join(", ")
      );
    }

    const sedationRows = dynamicValues("sedationRows");

    if (sedationRows.length) {
      appendLine(
        medication,
        "Sedasjon / infusjon",
        sedationRows.join("; ")
      );
    }

    const pressorRows = dynamicValues("pressorRows");

    if (pressorRows.length) {
      appendLine(
        medication,
        "Vasoaktive medikamenter",
        pressorRows.join("; ")
      );
    }

    const otherRows = dynamicValues("otherMedicationRows");

    if (otherRows.length) {
      appendLine(
        medication,
        "Andre medikamenter / infusjoner",
        otherRows.join("; ")
      );
    }

    appendSection(lines, "Medikamenter", medication);

    /* TILGANGER */

    const access = [];
    const accessValues = checkedValues("tilganger");

    if (accessValues.includes("Ingen")) {
      access.push("Ingen oppgitte tilganger");
    } else {
      if (accessValues.includes("CVK")) {
        let cvk = "CVK";

        if (value("cvkLumen")) {
          cvk += `, ${value("cvkLumen")} lumen`;
        }

        access.push(cvk);
      }

      if (accessValues.includes("PVK")) {
        let pvk = "PVK";

        if (value("pvkAntall")) {
          pvk += `, ${value("pvkAntall")} stk`;
        }

        access.push(pvk);
      }
    }

    const moreAccess = dynamicValues("accessRows");

    if (moreAccess.length) {
      access.push(...moreAccess);
    }

    appendSection(lines, "Tilganger", access);

    /* UTSTYR */

    const equipment = [];
    const equipmentValues = checkedValues("utstyr");

    if (equipmentValues.includes("Ingen")) {
      equipment.push("Ingen oppgitt");
    } else {
      equipmentValues.forEach(item => {
        if (item === "Sprøytepumper") {
          const count = value("pumperAntall");

          equipment.push(
            count ? `Sprøytepumper: ${count} stk` : "Sprøytepumper"
          );
        } else {
          equipment.push(item);
        }
      });
    }

    equipment.push(...dynamicValues("equipmentRows"));

    appendSection(lines, "Medisinsk utstyr", equipment);

    /* SMITTE OG CAVE */

    const safety = [];
    const infection = selected("smitte");

    appendLine(safety, "Smitte", infection);

    if (checkedValues("blodsmitte").length) {
      safety.push("Blodsmitte");
    }

    appendLine(
      safety,
      "Smitteopplysninger",
      value("smitteMerknad")
    );

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

    if (value("rekLege") || value("rekTlf")) {
      contacts.push(
        `Rekvirerende lege: ${
          [value("rekLege"), value("rekTlf")]
            .filter(Boolean).join(" / ")
        }`
      );
    }

    if (value("mottLege") || value("mottTlf")) {
      contacts.push(
        `Mottakende lege: ${
          [value("mottLege"), value("mottTlf")]
            .filter(Boolean).join(" / ")
        }`
      );
    }

    appendSection(lines, "Legekontakt", contacts);

    rapport.value = lines.join("\n");
    rapport.scrollTop = 0;
  }

  /* KOPIER RAPPORT */

  async function copyReport() {
    const text = rapport.value;

    if (!text.trim()) return;

    try {
      if (navigator.clipboard &&
          window.isSecureContext) {

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

  function showCopyMessage(message) {
    copyMsg.textContent = message;

    if (copyTimer) {
      clearTimeout(copyTimer);
    }

    copyTimer = setTimeout(() => {
      copyMsg.textContent = "";
    }, 5000);
  }

  copyBtn.addEventListener("click", copyReport);

  /* TØM SKJEMA */

  resetBtn.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Vil du tømme hele sekundæroppdragsskjemaet?"
    );

    if (!confirmed) return;

    form.reset();

    Object.keys(dynamicLists).forEach(id => {
      const container = document.getElementById(id);

      if (container) container.replaceChildren();
    });

    copyMsg.textContent = "";

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

  /* OPPDATERING AV SKJEMA */

  form.addEventListener("input", buildReport);

  form.addEventListener("change", () => {
    updateConditions();
    buildReport();
  });

  /* DAGENS DATO */

  function localDateString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      today.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const dateField = document.getElementById("oppdragDato");

  if (dateField && !dateField.value) {
    dateField.value = localDateString();
  }

  /* INITIALISERING */

  updateConditions();
  buildReport();

})();
