
"use strict";

/* ==========================================
   PRIMÆROPPDRAG
========================================== */

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) =>
    [...document.querySelectorAll(selector)];

  const state = {
    urgency: null,
    gender: null,
    reasons: [],
    response: null,
    rejection: null,
    responses: [],
    extraResource: null,
    extraCriteria: [],
    extraConclusion: null
  };

  const AMK_CENTRES = [
    "Oslo",
    "Vestre Viken",
    "Vestfold Telemark",
    "Sørlandet",
    "Innlandet",
    "Stavanger",
    "Haugesund",
    "Bergen",
    "Førde",
    "Ålesund",
    "Sør-Trøndelag",
    "Nord-Trøndelag",
    "Møre og Romsdal",
    "Tromsø",
    "Nordland",
    "Helgeland",
    "Finnmark"
  ];

  /* ========================================
     FELLESHJELPERE
  ======================================== */

  function value(id) {
    return $("#" + id)?.value.trim() ?? "";
  }

  function normalize(text) {
    return String(text ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase("nb-NO")
      .trim();
  }

  function setError(text) {
    const element = $("#responseError");
    if (element) element.textContent = text;
  }

  function selectSingle(group, attribute, callback) {
    group?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "button[" + attribute + "]"
      );

      if (!button) return;

      const selectedValue = button.getAttribute(attribute);

      $$("#" + group.id + " button").forEach((item) => {
        const selected = item === button;

        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-pressed", String(selected));
      });

      callback(selectedValue);
      updateReport();
    });
  }

  function toggleMultiple(
    container,
    attribute,
    selectedItems
  ) {
    container?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "button[" + attribute + "]"
      );

      if (!button) return;

      const selectedValue = button.getAttribute(attribute);
      const index = selectedItems.indexOf(selectedValue);

      if (index === -1) {
        selectedItems.push(selectedValue);
      } else {
        selectedItems.splice(index, 1);
      }

      const selected = selectedItems.includes(selectedValue);

      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));

      updateReport();
    });
  }

  /* ========================================
     AKSJONS-AMK – AUTOFULLFØRING

     Entydige prefikser fullføres automatisk.
     Den foreslåtte delen markeres slik at
     brukeren kan skrive videre eller endre.
  ======================================== */

  function initializeAmkAutocomplete() {
    const input = $("#actionAmk");
    const datalist = $("#amkSuggestions");

    if (!input || !datalist) return;

    for (const centre of AMK_CENTRES) {
      const option = document.createElement("option");
      option.value = centre;
      datalist.appendChild(option);
    }

    input.addEventListener("input", (event) => {
      if (event.isComposing) return;

      const typed = input.value;
      const search = normalize(typed);

      if (!search) {
        updateReport();
        return;
      }

      // Ikke overstyr et eksakt sentralnavn.
      const exact = AMK_CENTRES.find(
        (centre) => normalize(centre) === search
      );

      if (exact) {
        input.value = exact;
        updateReport();
        return;
      }

      const matches = AMK_CENTRES.filter(
        (centre) => normalize(centre).startsWith(search)
      );

      if (matches.length === 1) {
        const match = matches[0];

        // Fullfør, men marker bare den foreslåtte delen.
        // Da kan brukeren skrive over forslaget.
        input.value = match;

        if (document.activeElement === input) {
          input.setSelectionRange(
            typed.length,
            match.length
          );
        }
      }

      // Flere mulige treff:
      // Behold brukerens tekst og vis datalist-forslag.
      updateReport();
    });

    input.addEventListener("blur", () => {
      const current = normalize(input.value);

      const exact = AMK_CENTRES.find(
        (centre) => normalize(centre) === current
      );

      if (exact) {
        input.value = exact;
      }

      updateReport();
    });
  }

  /* ========================================
     TALEGRUPPER OG INDEKSREGISTER

     Basert på registerstrukturen fra
     Savnet helikopter.
  ======================================== */

  const TG_REGISTER = new Map();

  function normalizeTgKey(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[\s._–—-]+/g, "");
  }

  function registerTg(name, index, aliases = []) {
    const item = {
      name,
      index: String(index)
    };

    for (const alias of [name, ...aliases]) {
      const key = normalizeTgKey(alias);
      const existing = TG_REGISTER.get(key);

      if (
        existing &&
        (
          existing.name !== item.name ||
          existing.index !== item.index
        )
      ) {
        console.warn("Tvetydig talegruppe:", alias);
        continue;
      }

      TG_REGISTER.set(key, item);
    }
  }

  function initializeTgRegister() {
    // Regionale helsetalegrupper
    [
      ["Oslo", ["osl"], 1010, 20],
      ["Innlandet", ["inn", "innl"], 1710, 20],
      ["Buskerud", ["bus", "busk"], 2210, 16],
      ["Skagerak", ["ska", "skag"], 2610, 10],
      ["Sørlandet", ["sor", "sorl"], 3010, 10]
    ].forEach(([name, aliases, base, count]) => {
      for (let number = 1; number <= count; number++) {
        const padded = String(number).padStart(2, "0");

        registerTg(
          name + "-" + padded,
          base + number,
          [name, ...aliases].flatMap((prefix) => [
            prefix + number,
            prefix + padded
          ])
        );
      }
    });

    // LA, FKS, HRS, SAR og FINO
    [
      ["LA-SØR-ØST1", 1, ["la so 1", "la sor ost 1"]],
      ["LA-SØR-ØST2", 2, ["la so 2", "la sor ost 2"]],
      ["LA-VEST", 3, []],
      ["LA-MIDT", 4, []],
      ["LA-NORD", 5, []],

      ["FKS-01", 60, ["fks1"]],
      ["FKS-02", 87, ["fks2"]],
      ["FKS-03", 88, ["fks3"]],
      ["FKS-04", 89, ["fks4"]],

      ["HRS-SN-ANROP", 753, ["hrs sn"]],
      ["SAR-SJO-1", 751, ["sar sjø 1"]],
      ["SAR-SJO-2", 752, ["sar sjø 2"]],

      ["FINO-HEMS-1", 9219, []],
      ["FINO-H-70", 9221, []],
      ["FINO-H-80", 9222, []]
    ].forEach(([name, index, aliases]) => {
      registerTg(name, index, aliases);
    });

    // LA RW
    [
      ["1-1", "LSK", 11],
      ["1-2", "LSK", 12],
      ["1-3", "ÅL", 13],
      ["1-4", "ARN", 14],
      ["1-5", "DOM", 15],
      ["3-1", "STV", 31],
      ["3-3", "BGN", 33],
      ["3-5", "FDE", 35],
      ["4-1", "AES", 41],
      ["4-2", "TRD", 42],
      ["5-1", "BNN", 51],
      ["5-2", "EVE", 52],
      ["5-3", "TOS", 53],
      ["5-4", "KKN", 54]
    ].forEach(([resource, base, index]) => {
      registerTg(
        "LA RW " + resource + " " + base,
        index,
        ["LA RW " + resource]
      );
    });

    // LA fixed wing
    [
      ["61-DAG", 61], ["61-NAT", 62],
      ["63-DAG", 63], ["63-NAT", 64],
      ["64-DAG", 65],
      ["66-DAG", 66], ["66-NAT", 67],
      ["71-DAG", 71], ["71-NAT", 72],
      ["73-DAG", 73], ["73-NAT", 74],
      ["75-DAG", 75], ["75-NAT", 76],
      ["76", 77],
      ["81-DAG", 81], ["81-NAT", 82],
      ["82-DAG", 84], ["85", 85]
    ].forEach(([suffix, index]) => {
      registerTg(
        "LA-FW-" + suffix,
        index,
        suffix.endsWith("-NAT")
          ? ["LA-FW-" + suffix + "T"]
          : []
      );
    });

    // Redningshelikopter
    [
      ["RYGGE", 101],
      ["SOLA", 102],
      ["FLORØ", 103],
      ["ØRLAND", 104],
      ["BODØ", 105],
      ["BANAK", 106]
    ].forEach(([base, index]) => {
      registerTg(
        "330-" + base + "-3",
        index,
        ["330 " + base]
      );
    });

    // BAPS, SAR, SAMV og SAMVUP
    const areas = [
      [1, 1070, 1100],
      [2, 1470, 1500],
      [3, 1770, 1800],
      [4, 2670, 2700],
      [5, 3070, 3100],
      [6, 3670, 3700],
      [7, 4370, 4400],
      [8, 5170, 5200],
      [9, 5570, 5600]
    ];

    areas.forEach(([area, bapsBase, sharedBase]) => {
      const padded = String(area).padStart(2, "0");

      function add(series, number, index, extra = []) {
        const aliases = [series, ...extra].flatMap(
          (prefix) => [
            area + "-" + prefix + "-" + number,
            padded + "-" + prefix + "-" + number
          ]
        );

        registerTg(
          padded + "-" + series + "-" + number,
          index,
          aliases
        );
      }

      for (let n = 1; n <= 9; n++) {
        add("BAPS", n, bapsBase + n);
      }

      for (let n = 1; n <= 4; n++) {
        add("SAR", n, sharedBase + 40 + n);
      }

      for (let n = 1; n <= 5; n++) {
        add("SAMV", n, sharedBase + 10 + n, ["SAMVIRKE"]);
      }

      for (let n = 1; n <= 2; n++) {
        add(
          "SAMV",
          "A" + n,
          sharedBase + 15 + n,
          ["SAMVIRKE"]
        );
      }

      for (let n = 11; n <= 29; n++) {
        add("SAMVUP", n, sharedBase + 10 + n);
      }
    });

    // Sverige
    for (let n = 1; n <= 8; n++) {
      registerTg("NOSE-H-" + n, 9010 + n);
      registerTg("NOSE-EM-" + n, 9070 + n);
      registerTg("NOSE-CO-" + n, 9080 + n);
    }

    [10, 20, 30, 40, 50, 60, 70].forEach((n, i) => {
      registerTg("NOSE-H-" + n, 9019 + i);
    });

    [
      11, 12, 13, 14,
      21, 22, 23, 24,
      31, 32, 33, 34
    ].forEach((n, i) => {
      registerTg("NOSE-SAR-" + n, 9091 + i);
    });

    // Finland
    for (let n = 1; n <= 4; n++) {
      registerTg("FINO-H-" + n, 9210 + n);
      registerTg("FINO-SAR-" + n, 9290 + n);
    }
  }

  function formatTgForReport(value) {
    const text = String(value ?? "").trim();

    if (!text) return "";

    const match = TG_REGISTER.get(
      normalizeTgKey(text)
    );

    return match
      ? `${match.name} (indeks ${match.index})`
      : `${text} (indeks ikke funnet)`;
  }

  function createTgInput() {
    const input = document.createElement("input");

    input.type = "text";
    input.className = "other-tg-input";
    input.placeholder = "Talegruppe";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Annen talegruppe");

    return input;
  }

  function maintainDynamicTgFields() {
    const container = $("#otherTgContainer");
    if (!container) return;

    let inputs = [
      ...container.querySelectorAll(".other-tg-input")
    ];

    if (
      !inputs.length ||
      inputs.at(-1).value.trim()
    ) {
      container.appendChild(createTgInput());
    }

    inputs = [
      ...container.querySelectorAll(".other-tg-input")
    ];

    for (let i = inputs.length - 2; i >= 0; i--) {
      if (
        !inputs[i].value.trim() &&
        !inputs[i + 1].value.trim() &&
        inputs[i] !== document.activeElement
      ) {
        inputs[i].remove();
      }
    }
  }

  function getTgValues() {
    const values = [
      value("healthTg"),
      value("sarTg"),
      ...$$(".other-tg-input").map(
        (input) => input.value.trim()
      )
    ];

    return values
      .filter(Boolean)
      .map(formatTgForReport);
  }

  /* ========================================
     KLOKKESLETT
  ======================================== */

  function currentTime() {
    const now = new Date();

    return (
      String(now.getHours()).padStart(2, "0") +
      ":" +
      String(now.getMinutes()).padStart(2, "0")
    );
  }

  function formatTime(raw) {
    const text = String(raw ?? "").trim();

    if (!text) return "";

    let hours;
    let minutes;

    const colon = text.match(/^(\d{1,2}):(\d{2})$/);

    if (colon) {
      hours = Number(colon[1]);
      minutes = Number(colon[2]);
    } else if (/^\d{3,4}$/.test(text)) {
      const digits = text.padStart(4, "0");

      hours = Number(digits.slice(0, 2));
      minutes = Number(digits.slice(2));
    } else {
      return "";
    }

    if (hours > 23 || minutes > 59) return "";

    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0")
    );
  }

  function initializeTimeFields() {
    $$("[data-time-target]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = $("#" + button.dataset.timeTarget);

        if (!target) return;

        target.value = currentTime();
        updateReport();
      });
    });

    ["alertTime", "responseTime"].forEach((id) => {
      const field = $("#" + id);

      field?.addEventListener("blur", () => {
        const formatted = formatTime(field.value);

        if (formatted) field.value = formatted;

        updateReport();
      });
    });
  }

  /* ========================================
     RESSURS-ID
  ======================================== */

  function normalizeResourceId(raw) {
    const text = String(raw ?? "").trim();

    const match = text.match(
      /^(?:LA|LUFTAMBULANSE)?\s*(\d+)\s*-\s*(\d+)$/i
    );

    return match
      ? `LA ${match[1]}-${match[2]}`
      : text;
  }

  /* ========================================
     FELTER SOM VOKSER VED SKRIVING
  ======================================== */

  function resizeTextarea(field) {
    if (!field) return;

    field.style.height = "auto";
    field.style.height =
      Math.max(75, field.scrollHeight + 2) + "px";
  }

  /* ========================================
     VALG AV HASTEGRAD / KJØNN
  ======================================== */

  function initializeChoices() {
    selectSingle(
      $("#urgencyChips"),
      "data-urgency",
      (selected) => {
        state.urgency = selected;
      }
    );

    selectSingle(
      $("#genderChips"),
      "data-gender",
      (selected) => {
        state.gender = selected;
      }
    );

    toggleMultiple(
      $("#reasonChips"),
      "data-reason",
      state.reasons
    );

    selectSingle(
      $("#responseChips"),
      "data-response",
      (selected) => {
        state.response = selected;

        const rejected = selected === "Avvist";

        $("#rejectionWrapper")?.classList.toggle(
          "hidden",
          !rejected
        );

        if (!rejected) {
          state.rejection = null;

          $$("#rejectionChips .chip").forEach((button) => {
            button.classList.remove("is-selected");
            button.setAttribute("aria-pressed", "false");
          });
        }
      }
    );

    selectSingle(
      $("#rejectionChips"),
      "data-rejection",
      (selected) => {
        state.rejection = selected;
      }
    );

    selectSingle(
      $("#extraResourceChips"),
      "data-extra",
      (selected) => {
        state.extraResource = selected;
        state.extraCriteria.length = 0;

        $$(".criteria-chip[data-extra-criterion]").forEach(
          (button) => {
            button.classList.remove("is-selected");
            button.setAttribute("aria-pressed", "false");
          }
        );

        $("#rhCriteria")?.classList.toggle(
          "hidden",
          selected !== "RH"
        );

        $("#laCriteria")?.classList.toggle(
          "hidden",
          selected !== "LA"
        );
      }
    );

    toggleMultiple(
      $("#ekstraressurs"),
      "data-extra-criterion",
      state.extraCriteria
    );

    selectSingle(
      $("#extraConclusionChips"),
      "data-conclusion",
      (selected) => {
        state.extraConclusion = selected;
      }
    );
  }

  /* ========================================
     REGISTRERING AV TILBAKEMELDING

     Registrerte meldinger beholdes i
     hendelsesloggen inntil skjemaet tømmes.
  ======================================== */

  function addResponse() {
    setError("");

    const resource = normalizeResourceId(
      value("resourceId")
    );

    const time = formatTime(value("responseTime"));

    if (!resource) {
      setError("Du må angi ressurs-ID.");
      return;
    }

    if (!state.response) {
      setError("Velg tilbakemelding fra besetningen.");
      return;
    }

    if (!time) {
      setError(
        "Angi et gyldig klokkeslett, f.eks. 14:35."
      );
      return;
    }

    if (
      state.response === "Avvist" &&
      !state.rejection
    ) {
      setError("Velg årsak til avvisning.");
      return;
    }

    state.responses.push({
      resource,
      time,
      response: state.response,
      rejection:
        state.response === "Avvist"
          ? state.rejection
          : "",
      note: value("responseNote")
    });

    $("#responseNote").value = "";
    $("#responseTime").value = "";

    renderResponseLog();
    updateReport();
  }

  function renderResponseLog() {
    const container = $("#responseLog");

    if (!container) return;

    container.replaceChildren();

    if (!state.responses.length) return;

    const title = document.createElement("h3");
    title.className = "response-log-title";
    title.textContent = "Registrerte tilbakemeldinger";

    container.appendChild(title);

    state.responses.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "response-entry";

      const main = document.createElement("div");
      main.className = "response-entry-main";

      const time = document.createElement("span");
      time.className = "response-entry-time";
      time.textContent = entry.time + " ";

      const status = document.createElement("span");
      status.className = "response-status";

      if (entry.response === "Avvist") {
        status.classList.add("rejected");
      }

      if (entry.response === "Avventer") {
        status.classList.add("waiting");
      }

      status.textContent = entry.response;

      const resource = document.createElement("div");
      resource.className = "response-entry-resource";
      resource.textContent = entry.resource;

      main.append(time, status, resource);

      if (entry.rejection || entry.note) {
        const note = document.createElement("div");
        note.className = "response-entry-note";
        note.textContent = [
          entry.rejection,
          entry.note
        ].filter(Boolean).join(" – ");

        main.appendChild(note);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-entry";
      remove.textContent = "Slett";
      remove.setAttribute(
        "aria-label",
        "Slett tilbakemelding " + (index + 1)
      );

      remove.addEventListener("click", () => {
        state.responses.splice(index, 1);
        renderResponseLog();
        updateReport();
      });

      row.append(main, remove);
      container.appendChild(row);
    });
  }

  /* ========================================
     RAPPORTGENERATOR
  ======================================== */

  function generateReport() {
    const separator = "----------------------------------------";
    const resource = normalizeResourceId(
      value("resourceId")
    );

    const age = value("patientAge");
    const gender = state.gender
      ? state.gender.toLowerCase()
      : "";

    const patientParts = [];

    if (age) patientParts.push(age + " år");
    if (gender) patientParts.push(gender);

    const responseLines = state.responses.map(
      (entry) => {
        const details = [];

        if (entry.rejection) {
          details.push(entry.rejection);
        }

        if (entry.note) {
          details.push(entry.note);
        }

        return (
          `${entry.time} – ${entry.resource}: ` +
          entry.response +
          (details.length
            ? " – " + details.join(" – ")
            : "")
        );
      }
    );

    const amk = value("actionAmk");

    const lines = [
      "PRIMÆROPPDRAG",
      `TG: ${getTgValues().join(" // ")}`,
      separator,

      `Aksjons-AMK: ${amk}`,
      `Hastegrad: ${state.urgency ?? ""}`,
      `Posisjon: ${value("patientPosition")}`,
      `Pasient: ${patientParts.join(", ")}`,
      `Problemstilling: ${value("problemDescription")}`,
      `Årsak til LA: ${state.reasons.join(", ")}`,

      "",
      "ANDRE RESSURSER OG ETA:",
      value("otherResources"),

      "",
      `Forventet leveringssted: ${value("deliveryLocation")}`,

      "",
      "SUPPLERENDE INFORMASJON:",
      value("additionalInformation"),

      separator,
      "RESSURS OG VARSLING:",
      `Ressurs-ID: ${resource}`,
      `Utalarmering kl.: ${
        formatTime(value("alertTime")) ||
        value("alertTime")
      }`,

      "",
      "TILBAKEMELDING FRA BESETNING:",
      ...responseLines,

      separator,
      "VURDERING AV EKSTRA RESSURS:",
      `Ressurs: ${state.extraResource ?? ""}`,
      `Kriterier: ${state.extraCriteria.join(", ")}`,
      `Konklusjon: ${state.extraConclusion ?? ""}`,
      `Merknad: ${value("extraNote")}`,

      separator
    ];

    return lines.join("\n");
  }

  function updateReport() {
    const output = $("#reportOutput");

    if (output) {
      output.value = generateReport();
    }

    updateScrollHint();
  }

  /* ========================================
     RAPPORTKNAPPER
  ======================================== */

  async function copyReport() {
    const report = generateReport();
    let success = false;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        success = true;
      }
    } catch {
      success = false;
    }

    if (!success) {
      const output = $("#reportOutput");

      if (output) {
        const previousFocus = document.activeElement;

        output.focus({ preventScroll: true });
        output.select();

        try {
          success = document.execCommand("copy");
        } catch {
          success = false;
        }

        if (previousFocus instanceof HTMLElement) {
          previousFocus.focus({ preventScroll: true });
        }
      }
    }

    const text = $("#copyButtonText");

    if (text) {
      text.textContent = success
        ? "Tekst kopiert"
        : "Kopiering mislyktes";
    }

    window.setTimeout(() => {
      if (text) text.textContent = "Kopier tekst";
    }, 3000);
  }

  function createEmail() {
    const subject = encodeURIComponent(
      "Tilbakemelding – primæroppdragsskjema"
    );

    window.location.href =
      "mailto:?subject=" + subject;
  }

  function resetForm() {
    const form = $("#primaryMissionForm");

    form?.reset();

    state.urgency = null;
    state.gender = null;
    state.reasons = [];
    state.response = null;
    state.rejection = null;
    state.responses = [];
    state.extraResource = null;
    state.extraCriteria = [];
    state.extraConclusion = null;

    $$(".chip, .criteria-chip").forEach((button) => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });

    $("#rejectionWrapper")?.classList.add("hidden");
    $("#rhCriteria")?.classList.add("hidden");
    $("#laCriteria")?.classList.add("hidden");

    const tgContainer = $("#otherTgContainer");

    if (tgContainer) {
      const input = createTgInput();
      input.id = "otherTgFirst";

      tgContainer.replaceChildren(input);
    }

    $$(".auto-grow").forEach((field) => {
      field.style.height = "";
    });

    setError("");
    renderResponseLog();
    updateReport();

    const output = $("#reportOutput");

    if (output) output.scrollTop = 0;

    $(".form-panel")?.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* ========================================
     SKJEMA-RULLING
  ======================================== */

  function updateScrollHint() {
    const panel = $(".form-panel");
    const hint = $("#formScrollHint");

    if (!panel || !hint) return;

    hint.hidden =
      panel.scrollHeight -
      panel.clientHeight -
      panel.scrollTop < 12;
  }

  function initializeScrollHint() {
    const panel = $(".form-panel");

    panel?.addEventListener(
      "scroll",
      updateScrollHint,
      { passive: true }
    );

    $("#formScrollHint")?.addEventListener("click", () => {
      panel?.scrollBy({
        top: panel.clientHeight * 0.7,
        behavior: "smooth"
      });
    });

    window.addEventListener("resize", updateScrollHint);
  }

  /* ========================================
     INITIALISERING
  ======================================== */

  function initializeForm() {
    if (!$("#primaryMissionForm")) return;

    initializeTgRegister();
    initializeAmkAutocomplete();
    initializeChoices();
    initializeTimeFields();
    initializeScrollHint();

    $("#primaryMissionForm").addEventListener(
      "submit",
      (event) => event.preventDefault()
    );

    $(".form-panel")?.addEventListener("input", (event) => {
      const target = event.target;

      if (target.classList.contains("other-tg-input")) {
        maintainDynamicTgFields();
      }

      if (target.classList.contains("auto-grow")) {
        resizeTextarea(target);
      }

      updateReport();
    });

    $("#resourceId")?.addEventListener("blur", () => {
      $("#resourceId").value = normalizeResourceId(
        value("resourceId")
      );

      updateReport();
    });

    $("#addResponseButton")?.addEventListener(
      "click",
      addResponse
    );

    $("#copyButton")?.addEventListener(
      "click",
      copyReport
    );

    $("#resetButton")?.addEventListener(
      "click",
      resetForm
    );

    $("#emailReportButton")?.addEventListener(
      "click",
      createEmail
    );

    updateReport();

    // Beregn rulleindikatoren etter første opptegning.
    requestAnimationFrame(updateScrollHint);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeForm
    );
  } else {
    initializeForm();
  }
})();
