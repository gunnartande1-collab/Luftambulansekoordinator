
"use strict";

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const state = {
    urgency: "",
    gender: "",
    reasons: [],
    responses: [],
    extraResource: "",
    extraCriteria: [],
    extraConclusion: "",
    extraResponses: [],
    pendingRejection: false
  };

  const AMK_CENTRES = [
    "Oslo", "Vestre Viken", "Vestfold Telemark",
    "Sørlandet", "Innlandet", "Stavanger",
    "Haugesund", "Bergen", "Førde", "Ålesund",
    "Sør-Trøndelag", "Nord-Trøndelag",
    "Møre og Romsdal", "Tromsø",
    "Nordland", "Helgeland", "Finnmark"
  ];

  const value = id => $("#" + id)?.value.trim() || "";

  const normalize = text => String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase("nb-NO")
    .trim();

  function currentTime() {
    const d = new Date();
    return [d.getHours(), d.getMinutes()]
      .map(n => String(n).padStart(2, "0"))
      .join(":");
  }

  function formatTime(raw) {
    let text = String(raw || "").trim();
    if (!text) return "";

    if (/^\d{3,4}$/.test(text)) {
      text = text.padStart(4, "0");
      text = text.slice(0, 2) + ":" + text.slice(2);
    }

    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";

    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 23 || m > 59) return "";

    return String(h).padStart(2, "0") +
      ":" + String(m).padStart(2, "0");
  }

  function normalizeResource(raw) {
    const text = String(raw || "").trim();
    const match = text.match(
      /^(?:LA|LUFTAMBULANSE)?\s*(\d+)\s*-\s*(\d+)$/i
    );
    return match
      ? `LA ${match[1]}-${match[2]}`
      : text;
  }

  /* VALGKNAPPER */

  function selectButton(group, button) {
    group.querySelectorAll("button").forEach(b => {
      const selected = b === button;
      b.classList.toggle("is-selected", selected);
      b.setAttribute("aria-pressed", String(selected));
    });
  }

  function setupSingle(id, attribute, callback) {
    const group = $("#" + id);
    if (!group) return;

    group.addEventListener("click", event => {
      const button = event.target.closest(
        "button[" + attribute + "]"
      );
      if (!button || !group.contains(button)) return;

      selectButton(group, button);
      callback(button.getAttribute(attribute));
      updateReport();
    });
  }

  function setupMultiple(id, attribute, array) {
    const group = $("#" + id);
    if (!group) return;

    group.addEventListener("click", event => {
      const button = event.target.closest(
        "button[" + attribute + "]"
      );
      if (!button || !group.contains(button)) return;

      const item = button.getAttribute(attribute);
      const index = array.indexOf(item);

      if (index === -1) array.push(item);
      else array.splice(index, 1);

      button.classList.toggle(
        "is-selected", array.includes(item)
      );
      button.setAttribute(
        "aria-pressed", String(array.includes(item))
      );
      updateReport();
    });
  }

  /* AKSJONS-AMK */

  function initializeAmk() {
    const input = $("#actionAmk");
    const list = $("#amkSuggestions");

    AMK_CENTRES.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      list.appendChild(option);
    });

    input.addEventListener("input", event => {
      if (event.isComposing) return;

      const typed = input.value;
      if (!typed.trim()) {
        updateReport();
        return;
      }

      const matches = AMK_CENTRES.filter(name =>
        normalize(name).startsWith(normalize(typed))
      );

      if (matches.length === 1 &&
          normalize(matches[0]) !== normalize(typed)) {
        input.value = matches[0];
        input.setSelectionRange(
          typed.length, matches[0].length
        );
      }

      updateReport();
    });
  }

  /* TALEGRUPPER */

  function tgKey(text) {
    return normalize(text)
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[\s._–—-]+/g, "");
  }

  const TG = new Map();

  function registerTg(name, index, aliases = []) {
    for (const alias of [name, ...aliases]) {
      const key = tgKey(alias);
      const existing = TG.get(key);
      if (existing && existing.index !== index) continue;
      TG.set(key, { name, index });
    }
  }

  function initTgRegister() {
    const health = [
      ["Oslo", ["osl"], 1010, 20],
      ["Innlandet", ["inn", "innl"], 1710, 20],
      ["Buskerud", ["bus", "busk"], 2210, 16],
      ["Skagerak", ["ska", "skag"], 2610, 10],
      ["Sørlandet", ["sor", "sorl"], 3010, 10]
    ];

    health.forEach(([name, aliases, base, count]) => {
      for (let n = 1; n <= count; n++) {
        const padded = String(n).padStart(2, "0");
        const names = [name, ...aliases];
        registerTg(
          name + "-" + padded,
          base + n,
          names.flatMap(a => [a + n, a + padded])
        );
      }
    });

    [
      ["LA-SØR-ØST1", 1],
      ["LA-SØR-ØST2", 2],
      ["LA-VEST", 3],
      ["LA-MIDT", 4],
      ["LA-NORD", 5],
      ["FKS-01", 60],
      ["FKS-02", 87],
      ["FKS-03", 88],
      ["FKS-04", 89],
      ["HRS-SN-ANROP", 753],
      ["SAR-SJO-1", 751],
      ["SAR-SJO-2", 752],
      ["FINO-HEMS-1", 9219],
      ["FINO-H-70", 9221],
      ["FINO-H-80", 9222]
    ].forEach(([name, index]) => registerTg(name, index));

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
      const prefix = String(area).padStart(2, "0");

      function add(series, n, index) {
        const name = `${prefix}-${series}-${n}`;
        registerTg(name, index, [
          `${area}-${series}-${n}`,
          `${series}-${n}`
        ]);
      }

      for (let n = 1; n <= 9; n++) {
        add("BAPS", n, bapsBase + n);
      }

      for (let n = 1; n <= 4; n++) {
        add("SAR", n, sharedBase + 40 + n);
      }

      for (let n = 1; n <= 5; n++) {
        add("SAMV", n, sharedBase + 10 + n);
      }

      for (let n = 1; n <= 2; n++) {
        add("SAMV", "A" + n, sharedBase + 15 + n);
      }

      for (let n = 11; n <= 29; n++) {
        add("SAMVUP", n, sharedBase + 10 + n);
      }
    });

    for (let n = 1; n <= 8; n++) {
      registerTg(`NOSE-EM-${n}`, 9070 + n);
      registerTg(`NOSE-CO-${n}`, 9085 + n);
      registerTg(`NOSE-H-${n}`, 9010 + n);
    }

    [
      ["RYGGE", 101], ["SOLA", 102],
      ["FLORØ", 103], ["ØRLAND", 104],
      ["BODØ", 105], ["BANAK", 106]
    ].forEach(([name, index]) => {
      registerTg(`330-${name}-3`, index, [`330 ${name}`]);
    });

    [
      ["1-1", "LSK", 11], ["1-2", "LSK", 12],
      ["1-3", "ÅL", 13], ["1-4", "ARN", 14],
      ["1-5", "DOM", 15], ["3-1", "STV", 31],
      ["3-3", "BGN", 33], ["3-5", "FDE", 35],
      ["4-1", "AES", 41], ["4-2", "TRD", 42],
      ["5-1", "BNN", 51], ["5-2", "EVE", 52],
      ["5-3", "TOS", 53], ["5-4", "KKN", 54]
    ].forEach(([id, base, index]) => {
      registerTg(
        `LA RW ${id} ${base}`, index, [`LA RW ${id}`]
      );
    });
  }

  function formatTg(text) {
    const raw = String(text || "").trim();
    if (!raw) return "";

    const match = TG.get(tgKey(raw));
    return match
      ? `${match.name} (indeks ${match.index})`
      : raw;
  }

  function makeTgInput() {
    const input = document.createElement("input");
    input.className = "other-tg-input";
    input.type = "text";
    input.setAttribute("aria-label", "Annen talegruppe");
    return input;
  }

  function maintainDynamicTg() {
    const container = $("#otherTgContainer");
    let inputs = [...container.querySelectorAll("input")];

    if (!inputs.length || inputs.at(-1).value.trim()) {
      container.appendChild(makeTgInput());
    }

    inputs = [...container.querySelectorAll("input")];
    for (let i = inputs.length - 2; i >= 0; i--) {
      if (!inputs[i].value.trim() &&
          !inputs[i + 1].value.trim() &&
          inputs[i] !== document.activeElement) {
        inputs[i].remove();
      }
    }
  }

  function getTgValues() {
    return [
      value("healthTg"),
      value("sarTg"),
      value("bapsTg"),
      ...$$(".other-tg-input").map(i => i.value.trim())
    ].filter(Boolean).map(formatTg);
  }

  /* DYNAMISKE ANDRE RESSURSER OG ETA */

  function makeResourceRow() {
    const row = document.createElement("div");
    row.className = "resource-pair";

    const resource = document.createElement("input");
    resource.type = "text";
    resource.className = "other-resource-name";
    resource.setAttribute("aria-label", "Ressurs");

    const eta = document.createElement("input");
    eta.type = "text";
    eta.className = "other-resource-eta";
    eta.setAttribute("aria-label", "ETA");

    row.append(resource, eta);
    return row;
  }

  function maintainResourceRows() {
    const container = $("#otherResourcesRows");
    let rows = [...container.querySelectorAll(".resource-pair")];

    if (!rows.length ||
        rows.at(-1).querySelector(".other-resource-name")
          .value.trim()) {
      container.appendChild(makeResourceRow());
    }

    rows = [...container.querySelectorAll(".resource-pair")];

    for (let i = rows.length - 2; i >= 0; i--) {
      const inputs = rows[i].querySelectorAll("input");
      const next = rows[i + 1].querySelectorAll("input");

      if ([...inputs, ...next].every(x => !x.value.trim()) &&
          !rows[i].contains(document.activeElement)) {
        rows[i].remove();
      }
    }
  }

  function getOtherResources() {
    return $$(".resource-pair").map(row => {
      const resource = row.querySelector(
        ".other-resource-name"
      ).value.trim();
      const eta = row.querySelector(
        ".other-resource-eta"
      ).value.trim();

      if (!resource && !eta) return "";
      return [resource, eta ? `ETA: ${eta}` : ""]
        .filter(Boolean).join(" – ");
    }).filter(Boolean);
  }

  /* HENDELSESLOGG */

  function addEvent(resource, response, options = {}) {
    const entry = {
      id: crypto.randomUUID?.() ||
        String(Date.now()) + Math.random(),
      resource: normalizeResource(resource),
      time: options.time || currentTime(),
      response,
      rejection: options.rejection || "",
      note: options.note || ""
    };

    state.responses.push(entry);
    renderLog();
    updateReport();
    return entry;
  }

  function renderLog() {
    const container = $("#responseLog");
    container.replaceChildren();

    if (!state.responses.length) return;

    const title = document.createElement("h3");
    title.className = "response-log-title";
    title.textContent = "Hendelseslogg";
    container.appendChild(title);

    state.responses.forEach(entry => {
      const row = document.createElement("div");
      row.className = "response-entry";

      const main = document.createElement("div");
      main.className = "response-entry-main";

      const heading = document.createElement("div");
      const time = document.createElement("span");
      time.className = "response-entry-time";
      time.textContent = entry.time + " ";

      const status = document.createElement("span");
      status.className = "response-status";
      status.textContent = entry.response;

      if (entry.response === "Avvist") {
        status.classList.add("rejected");
      }
      if (entry.response === "Avventer") {
        status.classList.add("waiting");
      }
      if (entry.response === "Rykker ut") {
        status.classList.add("go");
      }

      heading.append(time, status);

      const resource = document.createElement("div");
      resource.className = "response-entry-resource";
      resource.textContent = entry.resource;

      main.append(heading, resource);

      if (entry.rejection || entry.note) {
        const note = document.createElement("div");
        note.className = "response-entry-note";
        note.textContent = [
          entry.rejection, entry.note
        ].filter(Boolean).join(" – ");
        main.appendChild(note);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-entry";
      remove.textContent = "Slett";
      remove.addEventListener("click", () => {
        state.responses = state.responses.filter(
          item => item.id !== entry.id
        );
        renderLog();
        updateReport();
      });

      row.append(main, remove);
      container.appendChild(row);
    });
  }

  /* RESSURSUTALAR MERING */

  function initializeAlerting() {
    $("#alertNow").addEventListener("click", () => {
      const resource = normalizeResource(value("resourceId"));

      if (!resource) {
        $("#responseError").textContent =
          "Angi ressurs-ID før utalarmering.";
        return;
      }

      $("#responseError").textContent = "";
      const time = currentTime();
      $("#alertTime").value = time;
      $("#responseResource").value = resource;

      addEvent(resource, "Utalamert", {
        time
      });
    });

    $("#quickResponseChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-quick-response]"
        );
        if (!button) return;

        const resource = normalizeResource(
          value("responseResource") || value("resourceId")
        );

        if (!resource) {
          $("#responseError").textContent =
            "Angi ressurs-ID før tilbakemelding.";
          return;
        }

        $("#responseError").textContent = "";
        const response = button.dataset.quickResponse;
        selectButton($("#quickResponseChips"), button);

        if (response === "Avvist") {
          $("#quickReject").classList.remove("hidden");
          state.pendingRejection = true;
          updateReport();
          return;
        }

        $("#quickReject").classList.add("hidden");
        state.pendingRejection = false;
        const time = currentTime();
        $("#responseTime").value = time;

        addEvent(resource, response, {
          time,
          note: value("responseNote")
        });
        $("#responseNote").value = "";
      }
    );

    $("#quickRejectChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-quick-rejection]"
        );
        if (!button || !state.pendingRejection) return;

        selectButton($("#quickRejectChips"), button);
        const resource = normalizeResource(
          value("responseResource") || value("resourceId")
        );
        const time = currentTime();
        $("#responseTime").value = time;

        addEvent(resource, "Avvist", {
          time,
          rejection: button.dataset.quickRejection,
          note: value("responseNote")
        });

        $("#responseNote").value = "";
        state.pendingRejection = false;
        $("#quickReject").classList.add("hidden");
      }
    );

    $("#addResponseButton").addEventListener(
      "click", () => {
        const resource = normalizeResource(
          value("responseResource") || value("resourceId")
        );
        const note = value("responseNote");
        const rawTime = value("responseTime");
        const time = rawTime
          ? formatTime(rawTime)
          : currentTime();

        if (!resource || !note || !time) {
          $("#responseError").textContent =
            "Angi ressurs, beskrivelse og gyldig tid.";
          return;
        }

        $("#responseError").textContent = "";
        addEvent(resource, "Supplerende tilbakemelding", {
          time, note
        });
        $("#responseNote").value = "";
      }
    );
  }

  /* EKSTRA RESSURS */

  function initializeExtra() {
    setupSingle(
      "extraResourceChips", "data-extra", resource => {
        state.extraResource = resource;
        state.extraCriteria = [];
        state.extraConclusion = "";
        state.extraResponses = [];

        $$(".criteria-chip[data-extra-criterion]")
          .forEach(button => {
            button.classList.remove("is-selected");
            button.setAttribute("aria-pressed", "false");
          });

        $$("#extraConclusionChips button").forEach(b =>
          b.classList.remove("is-selected")
        );

        $("#laCriteria").classList.toggle(
          "hidden", resource !== "LA"
        );
        $("#rhCriteria").classList.toggle(
          "hidden", resource !== "RH"
        );
        $("#extraOutcome").classList.add("hidden");
        $("#extraReject").classList.add("hidden");
        renderLog();
      }
    );

    setupMultiple(
      "ekstraressurs",
      "data-extra-criterion",
      state.extraCriteria
    );

    setupSingle(
      "extraConclusionChips",
      "data-conclusion",
      conclusion => {
        state.extraConclusion = conclusion;
        $("#extraOutcome").classList.toggle(
          "hidden", conclusion !== "Forespurt"
        );
      }
    );

    $("#extraOutcomeButtons").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-extra-outcome]"
        );
        if (!button) return;

        const resource = normalizeResource(
          value("extraResourceId")
        );
        if (!resource) {
          $("#extraError").textContent =
            "Angi ekstra ressurs-ID først.";
          return;
        }
        $("#extraError").textContent = "";

        const response = button.dataset.extraOutcome;
        selectButton($("#extraOutcomeButtons"), button);

        if (response === "Avvist") {
          $("#extraReject").classList.remove("hidden");
          return;
        }

        $("#extraReject").classList.add("hidden");
        const entry = addEvent(resource, response, {
          note: "Ekstra " + state.extraResource
        });
        state.extraResponses.push(entry.id);
      }
    );

    $("#extraRejectChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-extra-rejection]"
        );
        if (!button) return;

        const resource = normalizeResource(
          value("extraResourceId")
        );
        if (!resource) return;

        selectButton($("#extraRejectChips"), button);

        const entry = addEvent(resource, "Avvist", {
          rejection: button.dataset.extraRejection,
          note: "Ekstra " + state.extraResource
        });
        state.extraResponses.push(entry.id);
        $("#extraReject").classList.add("hidden");
      }
    );
  }

  /* FLIGHT FOLLOWING */

  function openFlightFollowing() {
    const message = $("#flightMessage");
    message.textContent = "";

    // Finn siste status for hver ressurs.
    const latest = new Map();
    state.responses.forEach(entry => {
      if (entry.response !== "Supplerende tilbakemelding" &&
          entry.response !== "Utalamert") {
        latest.set(entry.resource, entry.response);
      }
    });

    const eligible = [...latest.entries()]
      .filter(([, status]) => status === "Rykker ut")
      .map(([resource]) => resource);

    if (!eligible.length) {
      message.textContent =
        "Ingen ressurs har siste status «Rykker ut».";
      return;
    }

    // Prioriter ressursen som er valgt i skjemaet.
    const preferred = normalizeResource(
      value("responseResource") || value("resourceId")
    );
    const resource = eligible.includes(preferred)
      ? preferred
      : eligible.at(-1);

    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      resourceId: resource,
      from: "",
      to: value("patientPosition"),
      description: value("problemDescription"),
      eta: "",
      pob: ""
    };

    // Unngå pasientopplysninger i URL.
    // sessionStorage er kun et forslag til grensesnitt.
    // Mottakende FF-side må støtte overføringen.
    try {
      sessionStorage.setItem(
        "laPendingFlightFollowing",
        JSON.stringify(payload)
      );
    } catch {
      message.textContent =
        "Kunne ikke klargjøre overføring.";
      return;
    }

    const url = "../flight-following/flight-following.html";
    const win = window.open(url, "_blank", "noopener");

    if (!win) {
      message.textContent =
        "Nytt vindu ble blokkert. Tillat popup-vinduer.";
      return;
    }

    message.textContent =
      "Flight following åpnet. Kontroller ressurs og felter.";
  }

  /* RAPPORT */

  function generateReport() {
    const separator = "----------------------------------------";
    const age = value("patientAge");
    const patient = [
      age ? age + " år" : "",
      state.gender ? state.gender.toLowerCase() : ""
    ].filter(Boolean).join(", ");

    const resourceLines = getOtherResources();

    const responseLines = state.responses.map(entry => {
      let line = `${entry.time} – ${entry.resource}: `;
      line += entry.response === "Utalamert"
        ? "Utalarmering"
        : "Svar fra crew: " + entry.response;

      if (entry.rejection) line += ` – ${entry.rejection}`;
      if (entry.note) line += ` – ${entry.note}`;
      return line;
    });

    const lines = [
      "PRIMÆROPPDRAG",
      `TG: ${getTgValues().join(" // ")}`,
      separator,
      `Aksjons-AMK: ${value("actionAmk")}`,
      `Hastegrad: ${state.urgency}`,
      `Posisjon: ${value("patientPosition")}`,
      `Pasient: ${patient}`,
      `Problemstilling: ${value("problemDescription")}`,
      `Årsak til LA: ${state.reasons.join(", ")}`,
      "",
      "ANDRE RESSURSER OG ETA:",
      ...resourceLines,
      "",
      `Forventet leveringssted: ${value("deliveryLocation")}`,
      "",
      "SUPPLERENDE INFORMASJON:",
      value("additionalInformation"),
      separator,
      "RESSURS OG VARSLING:",
      `Ressurs-ID: ${normalizeResource(value("resourceId"))}`,
      `Utalarmering kl.: ${formatTime(value("alertTime"))}`,
      "",
      "HENDELSESLOGG / TILBAKEMELDING:",
      ...responseLines,
      separator,
      "VURDERING AV EKSTRA RESSURS:",
      `Ressurs: ${state.extraResource}`,
      `Kriterier: ${state.extraCriteria.join(", ")}`,
      `Konklusjon: ${state.extraConclusion}`,
      `Ekstra ressurs-ID: ${normalizeResource(value("extraResourceId"))}`,
      `Merknad: ${value("extraNote")}`,
      separator
    ];

    return lines.join("\n");
  }

  function updateReport() {
    const output = $("#reportOutput");
    if (output) output.value = generateReport();
    updateScrollHint();
  }

  /* RAPPORTKNAPPER */

  async function copyReport() {
    const report = generateReport();
    let copied = false;

    try {
      await navigator.clipboard.writeText(report);
      copied = true;
    } catch {
      const output = $("#reportOutput");
      output.focus();
      output.select();
      copied = document.execCommand("copy");
    }

    $("#copyButtonText").textContent =
      copied ? "Tekst kopiert" : "Kopiering mislyktes";

    setTimeout(() => {
      $("#copyButtonText").textContent = "Kopier tekst";
    }, 5000);
  }

  function resetForm() {
    if (!window.confirm("Vil du tømme hele skjemaet?")) {
      return;
    }

    $("#primaryMissionForm").reset();

    state.urgency = "";
    state.gender = "";
    state.reasons = [];
    state.responses = [];
    state.extraResource = "";
    state.extraCriteria = [];
    state.extraConclusion = "";
    state.extraResponses = [];
    state.pendingRejection = false;

    $$(".chip, .criteria-chip").forEach(b => {
      b.classList.remove("is-selected");
      b.setAttribute("aria-pressed", "false");
    });

    $("#quickReject").classList.add("hidden");
    $("#laCriteria").classList.add("hidden");
    $("#rhCriteria").classList.add("hidden");
    $("#extraOutcome").classList.add("hidden");
    $("#extraReject").classList.add("hidden");

    $("#otherTgContainer").replaceChildren(makeTgInput());
    $("#otherResourcesRows").replaceChildren(makeResourceRow());

    $("#responseError").textContent = "";
    $("#extraError").textContent = "";
    $("#flightMessage").textContent = "";

    $$(".auto-grow").forEach(field => {
      field.style.height = "";
    });

    renderLog();
    updateReport();

    $(".form-panel").scrollTo({ top: 0 });
    $("#reportOutput").scrollTop = 0;
  }

  function createEmail() {
    window.location.href =
      "mailto:?subject=" +
      encodeURIComponent(
        "Tilbakemelding – primæroppdragsskjema"
      );
  }

  function resizeTextarea(field) {
    field.style.height = "auto";
    field.style.height = Math.max(
      75, field.scrollHeight + 2
    ) + "px";
  }

  /* RULLEINDIKATOR */

  function updateScrollHint() {
    const panel = $(".form-panel");
    const hint = $("#formScrollHint");
    if (!panel || !hint) return;

    hint.hidden = panel.scrollHeight -
      panel.clientHeight - panel.scrollTop < 12;
  }

  /* INITIALISERING */

  function initialize() {
    if (!$("#primaryMissionForm")) return;

    initTgRegister();
    initializeAmk();

    $("#otherResourcesRows").appendChild(makeResourceRow());

    setupSingle("urgencyChips", "data-urgency",
      selected => state.urgency = selected);

    setupSingle("genderChips", "data-gender",
      selected => state.gender = selected);

    setupMultiple("reasonChips", "data-reason",
      state.reasons);

    initializeAlerting();
    initializeExtra();

    $("#primaryMissionForm").addEventListener(
      "submit", event => event.preventDefault()
    );

    $(".form-panel").addEventListener("input", event => {
      const target = event.target;

      if (target.classList.contains("other-tg-input")) {
        maintainDynamicTg();
      }

      if (target.closest("#otherResourcesRows")) {
        maintainResourceRows();
      }

      if (target.classList.contains("auto-grow")) {
        resizeTextarea(target);
      }

      updateReport();
    });

    $$("[data-time-target]").forEach(button => {
      button.addEventListener("click", () => {
        const input = $("#" + button.dataset.timeTarget);
        if (input) input.value = currentTime();
        updateReport();
      });
    });

    ["alertTime", "responseTime"].forEach(id => {
      $("#" + id).addEventListener("blur", event => {
        const formatted = formatTime(event.target.value);
        if (formatted) event.target.value = formatted;
        updateReport();
      });
    });

    $("#resourceId").addEventListener("blur", event => {
      event.target.value = normalizeResource(
        event.target.value
      );
      updateReport();
    });

    $("#copyButton").addEventListener("click", copyReport);
    $("#resetButton").addEventListener("click", resetForm);
    $("#emailReportButton").addEventListener(
      "click", createEmail
    );
    $("#openFlightFollowing").addEventListener(
      "click", openFlightFollowing
    );

    const panel = $(".form-panel");
    panel.addEventListener("scroll", updateScrollHint);

    $("#formScrollHint").addEventListener("click", () => {
      panel.scrollBy({
        top: panel.clientHeight * 0.7,
        behavior: "smooth"
      });
    });

    window.addEventListener("resize", updateScrollHint);

    updateReport();
    requestAnimationFrame(updateScrollHint);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
