
"use strict";

(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  const initialState = () => ({
    urgency: "",
    gender: "",
    ageUnit: "år",
    reasons: [],
    responses: [],
    extraResource: "",
    extraCriteria: [],
    extraConclusion: "",
    quickWaitId: null,
    quickRejectId: null,
    extraRejectId: null,
    alertEventId: null,
    nextId: 1
  });

  let state = initialState();

  const AMK_CENTRES = [
    "Oslo", "Vestre Viken", "Vestfold Telemark",
    "Sørlandet", "Innlandet", "Stavanger",
    "Haugesund", "Bergen", "Førde", "Ålesund",
    "Sør-Trøndelag", "Nord-Trøndelag",
    "Møre og Romsdal", "Tromsø",
    "Nordland", "Helgeland", "Finnmark"
  ];

  const TG = new Map();

  const value = id => $("#" + id)?.value.trim() || "";

  function normalize(text) {
    return String(text || "")
      .normalize("NFKC")
      .toLocaleLowerCase("nb-NO")
      .trim();
  }

  function currentTime() {
    const d = new Date();

    return [
      d.getHours(),
      d.getMinutes()
    ].map(n => String(n).padStart(2, "0"))
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

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    if (hours > 23 || minutes > 59) return "";

    return [
      hours,
      minutes
    ].map(n => String(n).padStart(2, "0"))
     .join(":");
  }

  function normalizeResource(raw, defaultType = "LA") {
    const text = String(raw || "").trim();

    if (!text) return "";

    const match = text.match(
      /^(?:(LA|LUFTAMBULANSE|RH|REDNINGSHELIKOPTER)\s*)?(\d+)\s*-\s*(\d+)$/i
    );

    if (!match) return text;

    const type = match[1]
      ? (/^(RH|REDNINGSHELIKOPTER)$/i.test(match[1])
          ? "RH"
          : "LA")
      : defaultType;

    return `${type} ${match[2]}-${match[3]}`;
  }

  function setError(id, message = "") {
    const element = $("#" + id);
    if (element) element.textContent = message;
  }

  /* VALGKNAPPER */

  function selectButton(group, selected) {
    if (!group) return;

    group.querySelectorAll("button").forEach(button => {
      const active = button === selected;

      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function clearButtons(group) {
    if (!group) return;

    group.querySelectorAll("button").forEach(button => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function setupSingle(id, attribute, callback) {
    const group = $("#" + id);
    if (!group) return;

    group.addEventListener("click", event => {
      const button = event.target.closest(
        `button[${attribute}]`
      );

      if (!button || !group.contains(button)) return;

      const chosen = button.getAttribute(attribute);

      selectButton(group, button);
      callback(chosen);
      updateReport();
    });
  }

  // Bruker en state-nøkkel, ikke en gammel array-referanse.
  // Dermed fungerer kriteriene også etter "Tøm skjema".
  function setupMultiple(id, attribute, stateKey) {
    const group = $("#" + id);
    if (!group) return;

    group.addEventListener("click", event => {
      const button = event.target.closest(
        `button[${attribute}]`
      );

      if (!button || !group.contains(button)) return;

      const chosen = button.getAttribute(attribute);
      const items = state[stateKey];

      const index = items.indexOf(chosen);

      if (index === -1) {
        items.push(chosen);
      } else {
        items.splice(index, 1);
      }

      const active = items.includes(chosen);

      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));

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

      if (
        matches.length === 1 &&
        normalize(matches[0]) !== normalize(typed)
      ) {
        input.value = matches[0];

        input.setSelectionRange(
          typed.length,
          matches[0].length
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

  function registerTg(name, index, aliases = []) {
    for (const alias of [name, ...aliases]) {
      const key = tgKey(alias);
      const existing = TG.get(key);

      if (existing && existing.index !== index) continue;

      TG.set(key, { name, index });
    }
  }

  function initTgRegister() {
    TG.clear();

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

        registerTg(
          `${name}-${padded}`,
          base + n,
          [name, ...aliases].flatMap(a => [
            a + n,
            a + padded,
            a + "-" + n,
            a + "-" + padded
          ])
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
      ["RYGGE", 101],
      ["SOLA", 102],
      ["FLORØ", 103],
      ["ØRLAND", 104],
      ["BODØ", 105],
      ["BANAK", 106]
    ].forEach(([name, index]) => {
      registerTg(
        `330-${name}-3`,
        index,
        [`330 ${name}`]
      );
    });

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
    ].forEach(([id, base, index]) => {
      registerTg(
        `LA RW ${id} ${base}`,
        index,
        [`LA RW ${id}`]
      );
    });
  }

  function lookupTg(raw) {
    return TG.get(tgKey(raw)) || null;
  }

  function formatTg(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";

    const match = lookupTg(text);

    return match
      ? `${match.name} (indeks ${match.index})`
      : text;
  }

  function expandTgInput(input) {
    const match = lookupTg(input.value);

    if (match) input.value = match.name;
  }

  function makeTgInput() {
    const input = document.createElement("input");

    input.type = "text";
    input.className = "other-tg-input tg-input";
    input.setAttribute("aria-label", "Annen talegruppe");
    input.spellcheck = false;

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
    return [
      value("healthTg"),
      value("sarTg"),
      value("bapsTg"),
      ...$$(".other-tg-input").map(i => i.value.trim())
    ].filter(Boolean).map(formatTg);
  }

  /* DYNAMISKE ANDRE RESSURSER */

  function calculateEta(minutes, startTime = Date.now()) {
    const totalMinutes = Math.round(
      startTime / 60000 + minutes
    );

    const minutesInDay = 24 * 60;

    const now = new Date(
      totalMinutes * 60000
    );

    return [
      now.getHours(),
      now.getMinutes()
    ].map(n => String(n).padStart(2, "0"))
     .join(":");
  }

  function parseEte(raw) {
    const text = String(raw || "").trim();

    if (!text) return null;

    // ETE i hele minutter.
    if (!/^\d+$/.test(text)) return null;

    const minutes = Number(text);

    if (
      !Number.isSafeInteger(minutes) ||
      minutes < 0 ||
      minutes > 1440
    ) {
      return null;
    }

    return minutes;
  }

  function makeResourceRow() {
    const row = document.createElement("div");
    row.className = "resource-pair";

    const resource = document.createElement("input");
    resource.type = "text";
    resource.className = "other-resource-name";
    resource.setAttribute("aria-label", "Ressurs");

    const ete = document.createElement("input");
    ete.type = "text";
    ete.inputMode = "numeric";
    ete.className = "other-resource-ete";
    ete.setAttribute("aria-label", "ETE i minutter");

    const eta = document.createElement("input");
    eta.type = "text";
    eta.inputMode = "numeric";
    eta.maxLength = 5;
    eta.className = "other-resource-eta";
    eta.setAttribute("aria-label", "ETA");

    row.append(resource, ete, eta);

    return row;
  }

  function calculateResourceEta(row) {
    const eteInput = row.querySelector(
      ".other-resource-ete"
    );

    const etaInput = row.querySelector(
      ".other-resource-eta"
    );

    const minutes = parseEte(eteInput.value);

    if (minutes === null) {
      if (!eteInput.value.trim()) {
        if (row.dataset.etaCalculated === "true") {
          etaInput.value = "";
        }

        row.dataset.etaCalculated = "false";
      }
      return;
    }

    // Beregning fra tidspunktet ETE ble registrert.
    const startTime = Date.now();

    etaInput.value = calculateEta(
      minutes,
      startTime
    );

    row.dataset.etaCalculated = "true";
  }

  function maintainResourceRows() {
    const container = $("#otherResourcesRows");

    let rows = [...container.querySelectorAll(".resource-pair")];

    if (
      !rows.length ||
      rows.at(-1).querySelector(
        ".other-resource-name"
      ).value.trim()
    ) {
      container.appendChild(makeResourceRow());
    }

    rows = [...container.querySelectorAll(".resource-pair")];

    for (let i = rows.length - 2; i >= 0; i--) {
      const inputs = rows[i].querySelectorAll("input");
      const nextInputs = rows[i + 1].querySelectorAll("input");

      if (
        [...inputs, ...nextInputs].every(x => !x.value.trim()) &&
        !rows[i].contains(document.activeElement)
      ) {
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

      return [
        resource,
        eta ? `ETA: ${formatTime(eta) || eta}` : ""
      ].filter(Boolean).join(" – ");
    }).filter(Boolean);
  }

  function initializeResourceRows() {
    const container = $("#otherResourcesRows");

    container.appendChild(makeResourceRow());

    container.addEventListener("input", event => {
      const input = event.target;
      const row = input.closest(".resource-pair");

      if (!row) return;

      if (input.classList.contains("other-resource-ete")) {
        calculateResourceEta(row);
      }

      if (input.classList.contains("other-resource-eta")) {
        row.dataset.etaCalculated = "false";
      }

      maintainResourceRows();
      updateReport();
    });

    container.addEventListener("blur", event => {
      if (
        !event.target.classList.contains(
          "other-resource-eta"
        )
      ) {
        return;
      }

      const formatted = formatTime(event.target.value);

      if (formatted) {
        event.target.value = formatted;
      }

      updateReport();
    }, true);
  }

  /* HENDELSESLOGG I RAPPORTEN */

  function addEvent(resource, response, options = {}) {
    const entry = {
      id: state.nextId++,
      resource: normalizeResource(
        resource,
        options.type || "LA"
      ),
      time: options.time || currentTime(),
      response,
      rejection: options.rejection || "",
      note: options.note || ""
    };

    state.responses.push(entry);
    updateReport();

    return entry;
  }

  function findEvent(id) {
    return state.responses.find(
      entry => entry.id === id
    );
  }

  function getPrimaryResource() {
    return normalizeResource(value("resourceId"));
  }

  /* UTALARMERING OG BESNINGENS SVAR */

  function initializeAlerting() {
    const alertInput = $("#alertTime");

    alertInput.addEventListener("focus", () => {
      const resource = getPrimaryResource();

      if (!resource) {
        setError(
          "responseError",
          "Angi ressurs-ID før utalarmering."
        );
        return;
      }

      setError("responseError");

      $("#resourceId").value = resource;

      if (alertInput.value.trim()) return;

      const time = currentTime();
      alertInput.value = time;

      const entry = addEvent(
        resource,
        "Utalarmert",
        { time }
      );

      state.alertEventId = entry.id;

      updateReport();
    });

    alertInput.addEventListener("change", () => {
      const formatted = formatTime(alertInput.value);

      if (formatted) alertInput.value = formatted;

      const entry = findEvent(state.alertEventId);

      if (entry && formatted) {
        entry.time = formatted;
      }

      updateReport();
    });

    $("#resourceId").addEventListener("blur", event => {
      event.target.value = normalizeResource(
        event.target.value
      );

      const entry = findEvent(state.alertEventId);

      if (entry) {
        entry.resource = getPrimaryResource();
      }

      updateReport();
    });

    $("#quickResponseChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-quick-response]"
        );

        if (!button) return;

        const resource = getPrimaryResource();

        if (!resource) {
          setError(
            "responseError",
            "Angi ressurs-ID før tilbakemelding."
          );
          return;
        }

        setError("responseError");
        selectButton($("#quickResponseChips"), button);

        const response = button.dataset.quickResponse;
        const time = currentTime();

        if (response === "Avventer") {
          const entry = addEvent(
            resource,
            "Avventer",
            { time }
          );

          state.quickWaitId = entry.id;

          $("#quickWaitDescription").value = "";
          $("#quickWait").classList.remove("hidden");
          $("#quickReject").classList.add("hidden");

          updateReport();
          return;
        }

        if (response === "Avvist") {
          const entry = addEvent(
            resource,
            "Avvist",
            { time }
          );

          state.quickRejectId = entry.id;

          $("#quickReject").classList.remove("hidden");
          $("#quickWait").classList.add("hidden");

          $("#quickRejectDescription").value = "";
          clearButtons($("#quickRejectChips"));

          updateReport();
          return;
        }

        $("#quickWait").classList.add("hidden");
        $("#quickReject").classList.add("hidden");

        addEvent(
          resource,
          response,
          { time }
        );
      }
    );

    $("#quickWaitDescription").addEventListener(
      "input", () => {
        const entry = findEvent(
          state.quickWaitId
        );

        if (entry) {
          entry.note = value("quickWaitDescription");
        }

        updateReport();
      }
    );

    $("#quickRejectChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-quick-rejection]"
        );

        if (!button) return;

        selectButton($("#quickRejectChips"), button);

        const entry = findEvent(
          state.quickRejectId
        );

        if (entry) {
          entry.rejection = button.dataset.quickRejection;
        }

        updateReport();
      }
    );

    $("#quickRejectDescription").addEventListener(
      "input", () => {
        const entry = findEvent(
          state.quickRejectId
        );

        if (entry) {
          entry.note = value("quickRejectDescription");
        }

        updateReport();
      }
    );
  }

  /* EKSTRA RESSURS */

  function updateConclusionLabel() {
    const button = $("#extraActiveConclusion");

    if (!button) return;

    if (state.extraResource === "LA") {
      button.textContent = "Utalarmert";
    } else if (state.extraResource === "RH") {
      button.textContent = "Forespurt";
    } else {
      button.textContent = "Utalarmert / Forespurt";
    }
  }

  function actualConclusion() {
    if (state.extraConclusion === "Aktivert") {
      if (state.extraResource === "LA") {
        return "Utalarmert";
      }

      if (state.extraResource === "RH") {
        return "Forespurt";
      }
    }

    return state.extraConclusion;
  }

  function initializeExtra() {
    setupSingle(
      "extraResourceChips",
      "data-extra",
      resource => {
        state.extraResource = resource;
        state.extraCriteria = [];
        state.extraConclusion = "";
        state.extraRejectId = null;

        $$("#ekstraressurs [data-extra-criterion]")
          .forEach(button => {
            button.classList.remove("is-selected");
            button.setAttribute("aria-pressed", "false");
          });

        clearButtons($("#extraConclusionChips"));
        clearButtons($("#extraOutcomeButtons"));
        clearButtons($("#extraRejectChips"));

        $("#laCriteria").classList.toggle(
          "hidden",
          resource !== "LA"
        );

        $("#rhCriteria").classList.toggle(
          "hidden",
          resource !== "RH"
        );

        $("#extraOutcome").classList.add("hidden");
        $("#extraReject").classList.add("hidden");

        $("#extraResourceId").value = "";
        $("#extraRejectDescription").value = "";

        setError("extraError");
        updateConclusionLabel();
      }
    );

    // Kriteriene registreres fra begge kriterieområdene.
    // Hver knapp oppdaterer rapportteksten umiddelbart.
    ["laCriteria", "rhCriteria"].forEach(id => {
      const group = $("#" + id);

      group.addEventListener("click", event => {
        const button = event.target.closest(
          "button[data-extra-criterion]"
        );

        if (!button || !group.contains(button)) return;

        const criterion = button.dataset.extraCriterion;
        const index = state.extraCriteria.indexOf(criterion);

        if (index === -1) {
          state.extraCriteria.push(criterion);
        } else {
          state.extraCriteria.splice(index, 1);
        }

        const active = state.extraCriteria.includes(
          criterion
        );

        button.classList.toggle("is-selected", active);
        button.setAttribute(
          "aria-pressed",
          String(active)
        );

        updateReport();
      });
    });

    setupSingle(
      "extraConclusionChips",
      "data-conclusion",
      conclusion => {
        if (!state.extraResource) {
          state.extraConclusion = "";
          clearButtons($("#extraConclusionChips"));

          setError(
            "extraError",
            "Velg LA eller RH før konklusjon."
          );
          return;
        }

        state.extraConclusion = conclusion;
        setError("extraError");

        $("#extraOutcome").classList.toggle(
          "hidden",
          conclusion !== "Aktivert"
        );

        if (conclusion !== "Aktivert") {
          $("#extraReject").classList.add("hidden");
        }
      }
    );

    $("#extraOutcomeButtons").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-extra-outcome]"
        );

        if (!button) return;

        const type = state.extraResource;

        const resource = normalizeResource(
          value("extraResourceId"),
          type
        );

        if (!resource) {
          setError(
            "extraError",
            "Angi ekstra ressurs-ID først."
          );
          return;
        }

        setError("extraError");

        $("#extraResourceId").value = resource;

        const response = button.dataset.extraOutcome;

        selectButton(
          $("#extraOutcomeButtons"),
          button
        );

        if (response === "Avvist") {
          const entry = addEvent(
            resource,
            "Avvist",
            {
              type,
              note: `Ekstra ${type}`
            }
          );

          state.extraRejectId = entry.id;

          $("#extraReject").classList.remove("hidden");

          $("#extraRejectDescription").value = "";
          clearButtons($("#extraRejectChips"));

          return;
        }

        $("#extraReject").classList.add("hidden");

        addEvent(
          resource,
          response,
          {
            type,
            note: `Ekstra ${type}`
          }
        );
      }
    );

    $("#extraRejectChips").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "[data-extra-rejection]"
        );

        if (!button) return;

        selectButton(
          $("#extraRejectChips"),
          button
        );

        const entry = findEvent(
          state.extraRejectId
        );

        if (entry) {
          entry.rejection = button.dataset.extraRejection;
        }

        updateReport();
      }
    );

    $("#extraRejectDescription").addEventListener(
      "input", () => {
        const entry = findEvent(
          state.extraRejectId
        );

        if (entry) {
          entry.note = [
            `Ekstra ${state.extraResource}`,
            value("extraRejectDescription")
          ].filter(Boolean).join(" – ");
        }

        updateReport();
      }
    );

    $("#extraResourceId").addEventListener(
      "blur", event => {
        event.target.value = normalizeResource(
          event.target.value,
          state.extraResource || "LA"
        );

        updateReport();
      }
    );
  }

  /* ALDER: ÅR / MÅNEDER */

  function initializeAge() {
    const ageInput = $("#patientAge");

    setupSingle(
      "ageUnitChips",
      "data-age-unit",
      unit => {
        state.ageUnit = unit;

        // Endring av enhet endrer ikke den innskrevne alderen.
        ageInput.max = unit === "mnd" ? "1500" : "125";
      }
    );
  }

  /* SUPPLERENDE TILBAKEMELDING */

  function initializeFeedback() {
    const resourceInput = $("#responseResource");
    const timeInput = $("#responseTime");

    resourceInput.addEventListener("blur", () => {
      resourceInput.value = normalizeResource(
        resourceInput.value
      );

      updateReport();
    });

    timeInput.addEventListener("focus", () => {
      if (!timeInput.value.trim()) {
        timeInput.value = currentTime();
        updateReport();
      }
    });

    timeInput.addEventListener("blur", () => {
      const formatted = formatTime(timeInput.value);

      if (formatted) {
        timeInput.value = formatted;
      }

      updateReport();
    });
  }

  /* FLIGHT FOLLOWING */

  function openFlightFollowing() {
    const message = $("#flightMessage");
    message.textContent = "";

    const url = new URL(
      "../flight following/flight following.html",
      window.location.href
    ).href;

    const win = window.open(url, "_blank");

    if (!win) {
      message.textContent =
        "Nettleseren blokkerte ny fane. Tillat popup-vinduer.";
      return;
    }

    try {
      win.opener = null;
    } catch {
      // Noen nettlesere begrenser tilgang.
    }

    message.textContent =
      "Flight following åpnet i ny fane.";
  }

  /* RAPPORTGENERERING */

  function generateReport() {
    const separator = "----------------------------------------";

    const age = value("patientAge");

    const patient = [
      age
        ? `${age} ${state.ageUnit}`
        : "",
      state.gender
        ? state.gender.toLowerCase()
        : ""
    ].filter(Boolean).join(", ");

    const eventLines = state.responses.map(entry => {
      let line = `${entry.time} – ${entry.resource}: `;

      if (entry.response === "Utalarmert") {
        line += "Utalarmert";
      } else {
        line += `Tilbakemelding: ${entry.response}`;
      }

      if (entry.rejection) {
        line += ` – ${entry.rejection}`;
      }

      if (entry.note) {
        line += ` – ${entry.note}`;
      }

      return line;
    });

    // Tilbakemeldingen nederst er et redigerbart felt.
    const feedbackResource = normalizeResource(
      value("responseResource")
    );

    const feedbackTime = formatTime(
      value("responseTime")
    );

    const feedbackNote = value("responseNote");

    if (
      feedbackResource ||
      feedbackTime ||
      feedbackNote
    ) {
      const prefix = [
        feedbackTime,
        feedbackResource
      ].filter(Boolean).join(" – ");

      eventLines.push(
        [
          prefix,
          feedbackNote
            ? `Tilbakemelding: ${feedbackNote}`
            : "Tilbakemelding"
        ].filter(Boolean).join(": ")
      );
    }

    const lines = [
      "PRIMÆROPPDRAG",
      `TG: ${getTgValues().join(" // ")}`,
      separator,

      `Aksjons-AMK: ${value("actionAmk")}`,
      `Hastegrad: ${state.urgency}`,
      `Posisjon: ${value("patientPosition")}`,
      `Pasient: ${patient}`,
      `Problemstilling: ${value("problemDescription")}`,

      // Vis alle valgte årsaker.
      `Årsak til LA: ${state.reasons.join(", ")}`,
      "",

      "ANDRE RESSURSER OG ETA:",
      ...getOtherResources(),
      "",

      `Forventet leveringssted: ${value("deliveryLocation")}`,
      "",

      "SUPPLERENDE INFORMASJON:",
      value("additionalInformation"),

      separator,

      "RESSURS OG VARSLING:",
      `Ressurs-ID: ${getPrimaryResource()}`,
      `Utalarmering kl.: ${formatTime(value("alertTime"))}`,
      "",

      "HENDELSESLOGG / TILBAKEMELDING:",
      ...eventLines,

      separator,

      "VURDERING AV EKSTRA RESSURS:",
      `Ressurs: ${state.extraResource}`,

      // Vis samtlige aktive LA- eller RH-kriterier.
      `Kriterier: ${state.extraCriteria.join(", ")}`,

      `Konklusjon: ${actualConclusion()}`,

      `Ekstra ressurs-ID: ${normalizeResource(
        value("extraResourceId"),
        state.extraResource || "LA"
      )}`,

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

      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }
    }

    $("#copyButtonText").textContent = copied
      ? "Tekst kopiert"
      : "Kopiering mislyktes";

    setTimeout(() => {
      $("#copyButtonText").textContent = "Kopier tekst";
    }, 5000);
  }

  function printReport() {
    const report = generateReport();
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      window.alert(
        "Nettleseren blokkerte utskriftsvinduet."
      );
      return;
    }

    const doc = printWindow.document;

    doc.open();

    doc.write(
      "<!DOCTYPE html><html lang='no'><head>" +
      "<meta charset='UTF-8'>" +
      "<title>Primæroppdrag – Rapport</title>" +
      "<style>" +
      "body{font-family:Arial,sans-serif;" +
      "margin:25mm;color:#17212b}" +
      "h1{font-size:20px}" +
      "pre{white-space:pre-wrap;overflow-wrap:anywhere;" +
      "font:12px/1.6 Consolas,monospace}" +
      "</style></head><body>" +
      "<h1>Primæroppdrag</h1><pre id='report'></pre>" +
      "</body></html>"
    );

    doc.close();

    doc.getElementById("report").textContent = report;

    printWindow.focus();
    printWindow.print();
  }

  function createEmail() {
    const recipient = "b32838@ous-hf.no";

    const subject =
      "Tilbakemelding – Primæroppdrag | Luftambulansekoordinator";

    const body = [
      "Hei!",
      "",
      "Jeg ønsker å gi en tilbakemelding på",
      "Primæroppdrag-skjemaet i Luftambulansekoordinator.",
      "",
      "Type tilbakemelding:",
      "Feil / forbedringsforslag / annet:",
      "",
      "Beskrivelse:",
      "",
      "",
      "Hva forventet du skulle skje?",
      "",
      "",
      "Hva skjedde?",
      "",
      "",
      "Eventuell annen informasjon:",
      "",
      "",
      "Vennlig hilsen",
      ""
    ].join("\r\n");

    window.location.href =
      `mailto:${recipient}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  /* TØM SKJEMA */

  function resetForm() {
    if (!window.confirm("Vil du tømme hele skjemaet?")) {
      return;
    }

    $("#primaryMissionForm").reset();

    state = initialState();

    $$(".chip, .criteria-chip").forEach(button => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });

    const ageYears = $(
      '#ageUnitChips [data-age-unit="år"]'
    );

    selectButton($("#ageUnitChips"), ageYears);
    $("#patientAge").max = "125";

    [
      "quickWait",
      "quickReject",
      "laCriteria",
      "rhCriteria",
      "extraOutcome",
      "extraReject"
    ].forEach(id => {
      $("#" + id).classList.add("hidden");
    });

    $("#otherTgContainer").replaceChildren(
      makeTgInput()
    );

    $("#otherResourcesRows").replaceChildren(
      makeResourceRow()
    );

    $("#quickWaitDescription").value = "";
    $("#quickRejectDescription").value = "";
    $("#extraRejectDescription").value = "";

    setError("responseError");
    setError("extraError");
    setError("flightMessage");

    updateConclusionLabel();

    $$(".auto-grow").forEach(field => {
      field.style.height = "";
    });

    updateReport();

    $(".form-panel").scrollTo({ top: 0 });
    $("#reportOutput").scrollTop = 0;
  }

  /* SKJEMAHJELP */

  function resizeTextarea(field) {
    field.style.height = "auto";

    field.style.height = Math.max(
      75,
      field.scrollHeight + 2
    ) + "px";
  }

  function updateScrollHint() {
    const panel = $(".form-panel");
    const hint = $("#formScrollHint");

    if (!panel || !hint) return;

    hint.hidden =
      panel.scrollHeight -
      panel.clientHeight -
      panel.scrollTop < 12;
  }

  /* INITIALISERING */

  function initialize() {
    if (!$("#primaryMissionForm")) return;

    initTgRegister();
    initializeAmk();
    initializeResourceRows();
    initializeAge();

    setupSingle(
      "urgencyChips",
      "data-urgency",
      selected => {
        state.urgency = selected;
      }
    );

    setupSingle(
      "genderChips",
      "data-gender",
      selected => {
        state.gender = selected;
      }
    );

    setupMultiple(
      "reasonChips",
      "data-reason",
      "reasons"
    );

    initializeAlerting();
    initializeExtra();
    initializeFeedback();
    updateConclusionLabel();

    $("#primaryMissionForm").addEventListener(
      "submit",
      event => event.preventDefault()
    );

    $(".form-panel").addEventListener(
      "input",
      event => {
        const target = event.target;

        if (target.classList.contains("other-tg-input")) {
          maintainDynamicTg();
        }

        if (target.classList.contains("auto-grow")) {
          resizeTextarea(target);
        }

        updateReport();
      }
    );

    $(".form-panel").addEventListener(
      "focusout",
      event => {
        const target = event.target;

        if (target.classList.contains("tg-input")) {
          expandTgInput(target);
          maintainDynamicTg();
          updateReport();
        }
      }
    );

    $("#copyButton").addEventListener(
      "click",
      copyReport
    );

    $("#printButton").addEventListener(
      "click",
      printReport
    );

    $("#resetButton").addEventListener(
      "click",
      resetForm
    );

    $("#emailReportButton").addEventListener(
      "click",
      createEmail
    );

    $("#openFlightFollowing").addEventListener(
      "click",
      openFlightFollowing
    );

    const panel = $(".form-panel");

    panel.addEventListener(
      "scroll",
      updateScrollHint
    );

    $("#formScrollHint").addEventListener(
      "click",
      () => {
        panel.scrollBy({
          top: panel.clientHeight * 0.7,
          behavior: "smooth"
        });
      }
    );

    window.addEventListener(
      "resize",
      updateScrollHint
    );

    updateReport();
    requestAnimationFrame(updateScrollHint);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();
