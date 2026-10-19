
/* ============================================================
   LUFTAMBULANSEKOORDINATOR – SAVNET HELIKOPTER
   KOMPLETT JAVASCRIPT
   ============================================================ */

(() => {
  "use strict";

  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const state = {
    pob: null,
    criterion: null,
    checked: {},
    sub: {},
    answers: {
      atcc: null,
      elt: null,
      tracking: null
    },
    events: [],
    nextEventId: 1
  };

  let copyTimer = null;

  const CRITERIA = {
    1: "Manglende kontakt og rød på Locus og Nødnett",
    2: "Ingen landingsmelding 10 minutter etter ETA",
    3: "Observasjon eller melding som gir mistanke om havari"
  };

  const ANSWER_TITLES = {
    atcc: "ATCC har hatt kontakt",
    elt: "ELT eller PLB aktivert",
    tracking: "Bedt HRS om mobilsporing"
  };

  /* ============================================================
     1. SJEKKLISTER
     ============================================================ */

  const PHASES = [
    {
      id: "varsling",
      items: [
        {
          id: "v1",
          title: "Opprett hendelse i AMIS",
          bullets: [
            "Sted: Savnet helikopter",
            "Hastegrad: A",
            "Sett markering for sist kjente posisjon i Transmed",
            "Legg UTM inn i AMIS",
            "Type: Søk og redning",
            "Legg inn aksjonsmal"
          ]
        },
        {
          id: "v2",
          title: "Sett tiltak OPL AMK og ressurs OPL A"
        }
      ]
    },
    {
      id: "kontakt",
      items: [
        {
          id: "k1",
          title: "Anrop ressurs i LA SØR-ØST1, LA RW og eventuelt annen relevant TG × 3",
          report: "Anropt ressurs i LA SØR-ØST1, LA RW og evt. annen relevant TG",
          timed: true
        },
        {
          id: "k2",
          title: "Ring helikopterets DDI 1, DDI 2, GSM og SAT i én konferanse",
          report: "Ringt helikopterets DDI 1, DDI 2, GSM og SAT i én konferanse",
          timed: true
        },
        {
          id: "k3",
          title: "Ring ressurs-ID SAT (håndholdt) og håndradioene til crew",
          report: "Ringt ressursens SAT (håndholdt) og håndradioene til crewet",
          timed: true
        },
        {
          id: "k4",
          title: "Ring crewets private mobiltelefoner",
          report: "Ringt besetningens private mobiltelefoner",
          timed: true
        },
        {
          id: "k5",
          title: "Kontakt Oslo ATCC Supervisor",
          report: "Kontaktet Oslo ATCC Supervisor",
          timed: true,
          extra: "atcc"
        },
        {
          id: "k6",
          title: "Kontakt aktuelle kilder som kan ha informasjon",
          subs: [
            "Lokal AMK",
            "Pasient",
            "Innringer på skadestedet",
            "Andre ressurser"
          ],
          subTimed: true
        }
      ]
    },
    {
      id: "havari",
      items: [
        {
          id: "h1",
          title: "Iverksett SAR-varsling og sett tiltak i AMIS",
          extra: "sar"
        },
        {
          id: "h2",
          title: "Varsle nærmeste LA-ressurser i RW til savnet helikopter",
          bullets: [
            "Flight following i LA SØR-ØST1",
            "Oppdraget i aktuell SAR-TG"
          ]
        },
        {
          id: "h3",
          title: "Varsle NBKO dersom politihelikopter er involvert eller i området",
          report: "Varslet NBKO",
          timed: true,
          note: true
        },
        {
          id: "h4",
          title: "Varsle OPL AMK",
          report: "Varslet OPL AMK Oslo",
          timed: true
        },
        {
          id: "h5",
          title: "Varsle operativ vakt NLA",
          report: "Varslet operativ vakt NLA",
          timed: true
        },
        {
          id: "h6",
          title: "Kontakt HDO for status og posisjonslogg",
          report: "Kontaktet HDO for status og posisjonslogg",
          timed: true
        },
        {
          id: "h7",
          title: "Før fortløpende i AMIS og oppdater ressurser og HRS i SAR-TG"
        }
      ]
    },
    {
      id: "dokumentasjon",
      items: [
        {
          id: "d3",
          title: "Aksjonen avsluttet",
          report: "Aksjonen avsluttet",
          timed: true,
          extra: "closure"
        },
        {
          id: "d4",
          title: "Meld avvik med referanse til aksjonsnummeret",
          extra: "deviation"
        }
      ]
    }
  ];

  const ITEM_MAP = new Map();

  PHASES.forEach(phase => {
    phase.items.forEach(item => {
      ITEM_MAP.set(item.id, item);
    });
  });

  /* ============================================================
     2. HJELPEFUNKSJONER
     ============================================================ */

  function make(tag, className = "", content = null) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (content !== null) {
      element.textContent = content;
    }

    return element;
  }

  function value(id) {
    return String($("#" + id)?.value || "").trim();
  }

  function clock(date = new Date()) {
    return (
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  }

  function normalizeText(text) {
    return String(text || "")
      .normalize("NFKC")
      .toLocaleLowerCase("nb-NO")
      .trim();
  }

  /* ============================================================
     3. TELEFONNUMMER – 3+2+3
     ============================================================ */

  function formatPhoneNumber(raw) {
    if (window.LAK?.formatPhoneNumber) {
      return window.LAK.formatPhoneNumber(raw);
    }

    const original = String(raw ?? "").trim();

    if (!original) return "";

    const digits = original.replace(/\D/g, "");

    if (
      !/^\d{8}$/.test(digits) ||
      !/^[\d\s().-]+$/.test(original)
    ) {
      return original;
    }

    return (
      digits.slice(0, 3) + " " +
      digits.slice(3, 5) + " " +
      digits.slice(5)
    );
  }

  function formatTimeInput(raw) {
    const text = String(raw || "").trim();

    if (!text) return "";

    let hours;
    let minutes;

    const match = text.match(/^(\d{1,2}):(\d{2})$/);

    if (match) {
      hours = Number(match[1]);
      minutes = Number(match[2]);
    } else if (/^\d{3,4}$/.test(text)) {
      const padded = text.padStart(4, "0");

      hours = Number(padded.slice(0, 2));
      minutes = Number(padded.slice(2));
    } else {
      return text;
    }

    if (hours > 23 || minutes > 59) {
      return text;
    }

    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0")
    );
  }

  /* ============================================================
     4. TALEGRUPPER OG INDEKS
     ============================================================ */

  const TG = new Map();

  function tgKey(text) {
    return normalizeText(text)
      .replace(/æ/g, "ae")
      .replace(/ø/g, "o")
      .replace(/å/g, "a")
      .replace(/[\s._–—-]+/g, "");
  }

  function registerTg(name, index, aliases = []) {
    for (const alias of [name, ...aliases]) {
      const key = tgKey(alias);
      const existing = TG.get(key);

      if (existing && existing.index !== index) {
        continue;
      }

      TG.set(key, { name, index });
    }
  }

  function initializeTgRegister() {
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
          name + "-" + padded,
          base + n,
          [name, ...aliases].flatMap(alias => [
            alias + n,
            alias + padded
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
    ].forEach(([name, index]) => {
      registerTg(name, index);
    });

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

      function add(series, number, index) {
        registerTg(
          `${prefix}-${series}-${number}`,
          index,
          [`${area}-${series}-${number}`]
        );
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

  /* ============================================================
     5. TALEGRUPPER – SKJEMA OG RAPPORT
     ============================================================ */

  function formatTgField(raw) {
    const text = String(raw || "").trim();

    if (!text) return "";

    const result = TG.get(tgKey(text));

    return result ? result.name : text;
  }

  function formatTg(raw) {
    const text = String(raw || "").trim();

    if (!text) return "";

    const result = TG.get(tgKey(text));

    return result
      ? `${result.name} (indeks ${result.index})`
      : text;
  }

  function getTalkgroups() {
    return [
      value("healthTg"),
      value("BAPS"),
      value("sarTg"),
      ...$$("#otherTgContainer .other-tg-input")
        .map(input => input.value.trim())
    ]
      .filter(Boolean)
      .map(formatTg);
  }

  function isTalkgroupField(target) {
    return (
      [
        "healthTg",
        "BAPS",
        "sarTg"
      ].includes(target.id) ||
      target.classList.contains("other-tg-input")
    );
  }

  function normalizeTalkgroupField(target) {
    if (!isTalkgroupField(target)) return;

    target.value = formatTgField(target.value);
  }

  /* ============================================================
     6. HELIKOPTER OG CREW
     ============================================================ */

  function normalizeResource(raw) {
    const text = String(raw || "").trim();

    if (!text) return "";

    const match = text.match(
      /^(?:LA|LUFTAMBULANSE)?\s*(\d+)\s*-\s*(\d+)$/i
    );

    return match
      ? `LA ${match[1]}-${match[2]}`
      : text;
  }

  function normalizeRegistration(raw) {
    const original = String(raw || "").trim();

    if (!original) return "";

    const clean = original
      .toUpperCase()
      .replace(/[\s-]/g, "");

    if (/^[A-Z]{3}$/.test(clean)) {
      return "LN-" + clean;
    }

    if (/^LN[A-Z0-9]{3}$/.test(clean)) {
      return "LN-" + clean.slice(2);
    }

    return original.toUpperCase();
  }

  function policeHelicopter() {
    return /^LN-OR[ABC]$/.test(
      normalizeRegistration(value("registration"))
    );
  }

  function updateCrewRoles() {
    const police = policeHelicopter();

    if ($("#rescuerRole")) {
      $("#rescuerRole").textContent =
        police ? "PCM" : "HCM";
    }

    if ($("#doctorRole")) {
      $("#doctorRole").textContent =
        police ? "PCM" : "Lege";
    }

    if ($("#doctorIcon")) {
      $("#doctorIcon").src = police
        ? "../img/redningsmann.svg"
        : "../img/lege.svg";
    }
  }

  /* ============================================================
     7. POB
     ============================================================ */

  function setupPob() {
    $$("#pobChips button").forEach(button => {
      button.addEventListener("click", () => {
        const n = Number(button.dataset.pob);

        state.pob = state.pob === n
          ? null
          : n;

        refreshPob();
        updateReport();
      });
    });

    refreshPob();
  }

  function refreshPob() {
    $$("#pobChips button").forEach(button => {
      const active =
        Number(button.dataset.pob) === state.pob;

      button.classList.toggle("active", active);

      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
  }

  /* ============================================================
     8. DYNAMISKE PAX-FELTER
     ============================================================ */

  function createPaxRow() {
    const row = make("div", "sh-person pax-row");
    const role = make("div", "sh-role");
    const icon = make("img");

    icon.src = "../img/hospitant.svg";
    icon.alt = "";

    role.append(
      icon,
      make("span", "pax-label", "PAX")
    );

    const name = make("input", "pax-name");
    name.type = "text";
    name.placeholder = "Navn";

    const phone = make("input", "pax-phone");
    phone.type = "tel";
    phone.placeholder = "Mobilnummer";
    phone.dataset.phoneFormat = "true";

    row.append(role, name, phone);

    return row;
  }

  function paxHasContent(row) {
    return Boolean(
      $(".pax-name", row)?.value.trim() ||
      $(".pax-phone", row)?.value.trim()
    );
  }

  function maintainPax() {
    const container = $("#traineeContainer");

    if (!container) return;

    $$(".pax-row", container).forEach(row => {
      if (
        !paxHasContent(row) &&
        !row.contains(document.activeElement)
      ) {
        row.remove();
      }
    });

    let rows = $$(".pax-row", container);

    if (
      !rows.length ||
      paxHasContent(rows[rows.length - 1])
    ) {
      container.appendChild(createPaxRow());
    }

    rows = $$(".pax-row", container);

    const blanks = rows.filter(
      row => !paxHasContent(row)
    );

    if (blanks.length > 1) {
      const keep = blanks.find(
        row => row.contains(document.activeElement)
      ) || blanks[blanks.length - 1];

      blanks.forEach(row => {
        if (row !== keep) row.remove();
      });
    }

    $$(".pax-row", container).forEach((row, index) => {
      const n = index + 1;

      $(".pax-label", row).textContent =
        "PAX " + n;

      $(".pax-name", row).setAttribute(
        "aria-label",
        `PAX ${n} navn`
      );

      $(".pax-phone", row).setAttribute(
        "aria-label",
        `PAX ${n} mobilnummer`
      );
    });
  }

  /* ============================================================
     9. DYNAMISKE TALEGRUPPER
     ============================================================ */

  function createOtherTgField() {
    const input = make("input", "other-tg-input");

    input.type = "text";

    input.setAttribute(
      "aria-label",
      "Annen talegruppe"
    );

    return input;
  }

  function maintainOtherTg() {
    const container = $("#otherTgContainer");

    if (!container) return;

    $$(".other-tg-input", container).forEach(input => {
      if (
        !input.value.trim() &&
        input !== document.activeElement
      ) {
        input.remove();
      }
    });

    let inputs = $$(".other-tg-input", container);

    if (
      !inputs.length ||
      inputs[inputs.length - 1].value.trim()
    ) {
      container.appendChild(createOtherTgField());
    }

    inputs = $$(".other-tg-input", container);

    const blanks = inputs.filter(
      input => !input.value.trim()
    );

    if (blanks.length > 1) {
      const keep = blanks.find(
        input => input === document.activeElement
      ) || blanks[blanks.length - 1];

      blanks.forEach(input => {
        if (input !== keep) input.remove();
      });
    }

    $$(".other-tg-input", container).forEach(
      (input, index) => {
        if (index === 0) {
          input.id = "otherTgFirst";
        } else {
          input.removeAttribute("id");
        }
      }
    );
  }

  /* ============================================================
     10. UTLØSENDE KRITERIUM
     ============================================================ */

  function setupCriteria() {
    $$("#criteriaButtons button").forEach(button => {
      button.addEventListener("click", () => {
        const n = Number(button.dataset.criterion);

        state.criterion =
          state.criterion === n ? null : n;

        refreshCriteria();
        updateReport();
      });
    });

    refreshCriteria();
  }

  function refreshCriteria() {
    $$("#criteriaButtons button").forEach(button => {
      const active =
        Number(button.dataset.criterion) ===
        state.criterion;

      button.classList.toggle("active", active);

      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });

    const wrapper = $("#observationWrapper");

    if (wrapper) {
      wrapper.hidden = state.criterion !== 3;
    }
  }

  /* ============================================================
     11. BYGG SJEKKLISTER
     ============================================================ */

  function buildChecklist() {
    PHASES.forEach(phase => {
      const container = $("#phase-" + phase.id);

      if (!container) return;

      container.replaceChildren();

      phase.items.forEach(item => {
        container.appendChild(
          createChecklistRow(item)
        );
      });
    });
  }

  function createChecklistRow(item) {
    const row = make("div", "sh-check-row");
    row.dataset.row = item.id;

    const main = make("div", "sh-check-main");
    const label = make("label", "sh-check-label");
    const checkbox = make("input");

    checkbox.type = "checkbox";
    checkbox.dataset.check = item.id;

    label.append(
      checkbox,
      make("span", "", item.title)
    );

    main.appendChild(label);

    if (item.timed) {
      const time = make("span", "sh-time");
      time.dataset.time = item.id;
      main.appendChild(time);
    }

    row.appendChild(main);

    /* MERKNAD */

    if (item.note) {
      const note = make(
        "textarea",
        "sh-nbko-note"
      );

      note.rows = 1;
      note.placeholder = "Merknad";
      note.dataset.note = item.id;

      note.setAttribute(
        "aria-label",
        "Merknad – " + item.title
      );

      row.appendChild(note);
    }

    /* KULEPUNKTER */

    if (item.bullets?.length) {
      const detail = make("div", "sh-detail");
      const list = make("ul", "sh-bullet-list");

      item.bullets.forEach(text => {
        list.appendChild(
          make("li", "", text)
        );
      });

      detail.appendChild(list);
      row.appendChild(detail);
    }

    /* ========================================================
       KONTAKT AKTUELLE KILDER

       1. Lokal AMK
       2. Pasient
       3. Innringer på skadestedet
       4. Andre ressurser
       ======================================================== */

    if (item.subs?.length) {
      const detail = make("div", "sh-detail");

      item.subs.forEach((text, index) => {
        const isOtherResource =
          item.id === "k6" &&
          index === 3;

        const sub = make(
          "label",
          isOtherResource
            ? "sh-sub sh-other-resource"
            : "sh-sub"
        );

        const check = make("input");

        check.type = "checkbox";
        check.dataset.sub = item.id + ":" + index;

        sub.appendChild(check);

        if (isOtherResource) {
          const other = make(
            "input",
            "sh-inline-note sh-resource-input"
          );

          other.type = "text";
          other.id = "otherContactResource";
          other.placeholder = "Andre ressurser?";

          other.setAttribute(
            "aria-label",
            "Navn på annen kontaktet ressurs"
          );

          sub.appendChild(other);
        } else {
          sub.appendChild(
            make("span", "", text)
          );
        }

        if (item.subTimed) {
          const time = make("span", "sh-time");

          time.dataset.subtime =
            item.id + ":" + index;

          sub.appendChild(time);
        }

        detail.appendChild(sub);
      });

      row.appendChild(detail);
    }

    /* OSLO ATCC */

    if (item.extra === "atcc") {
      const panel = make(
        "div",
        "sh-atcc-question"
      );

      panel.appendChild(
        createChoiceGroup(
          "atcc",
          "Har Oslo ATCC hatt kontakt med helikopteret?",
          ["Ja", "Nei"]
        )
      );

      const detail = make("div");

      detail.id = "atccDetail";
      detail.hidden = true;

      const detailLabel = make(
        "label",
        "sh-field-label",
        "Beskrivelse og tidspunkt for siste kontakt"
      );

      detailLabel.htmlFor = "atccDescription";

      const description = make("textarea");

      description.id = "atccDescription";
      description.rows = 2;

      detail.append(detailLabel, description);
      panel.appendChild(detail);

      row.appendChild(panel);
    }

    /* SAR */

    if (item.extra === "sar") {
      row.appendChild(createSarInformation());
    }

    /* ========================================================
       AVSLUTNING
       ======================================================== */

    if (item.extra === "closure") {
      const closure = make("div", "sh-closure");

      const label = make(
        "label",
        "",
        "Begrunnelse for avslutning"
      );

      label.htmlFor = "closureReason";

      const description = make("textarea");

      description.id = "closureReason";
      description.rows = 3;

      description.placeholder =
        "Skriv begrunnelse for avslutning";

      closure.append(label, description);
      row.appendChild(closure);
    }

    /* ========================================================
       AVVIK
       ======================================================== */

    if (item.extra === "deviation") {
      const closure = make("div", "sh-closure");

      const label = make(
        "label",
        "",
        "Avviksnummer / referanse"
      );

      label.htmlFor = "deviationNumber";

      const input = make("input");

      input.id = "deviationNumber";
      input.type = "text";

      closure.append(label, input);
      row.appendChild(closure);
    }

    return row;
  }

  /* ============================================================
     12. SAR-SPØRSMÅL
     ============================================================ */

  function createSarInformation() {
    const detail = make("div", "sh-detail");
    const list = make("ul", "sh-bullet-list");

    list.appendChild(
      make(
        "li",
        "",
        "Gi informasjon fra rapportteksten"
      )
    );

    list.appendChild(
      make(
        "li",
        "",
        "Oppgi hvilke LA-ressurser som er varslet"
      )
    );

    const elt = make("li");

    elt.appendChild(
      createChoiceGroup(
        "elt",
        "ELT eller PLB aktivert?",
        ["Ja", "Nei", "Uavklart"]
      )
    );

    elt.appendChild(
      createSarDescription("elt")
    );

    list.appendChild(elt);

    const tracking = make("li");

    tracking.appendChild(
      createChoiceGroup(
        "tracking",
        "Bedt HRS om mobilsporing?",
        ["Ja", "Nei", "Uavklart"]
      )
    );

    tracking.appendChild(
      createSarDescription("tracking")
    );

    list.appendChild(tracking);

    detail.appendChild(list);

    return detail;
  }

  function createSarDescription(key) {
    const wrapper = make(
      "div",
      "sh-sar-description"
    );

    wrapper.id = key + "Detail";
    wrapper.hidden = true;

    const label = make(
      "label",
      "sh-field-label",
      "Beskrivelse / opplysninger"
    );

    label.htmlFor = key + "Description";

    const textarea = make("textarea");

    textarea.id = key + "Description";
    textarea.rows = 2;
    textarea.placeholder = "Utdyp svaret";

    wrapper.append(label, textarea);

    return wrapper;
  }

  function createChoiceGroup(key, title, options) {
    const row = make("div", "sh-question-row");

    row.appendChild(
      make("span", "", title)
    );

    const buttons = make(
      "div",
      "sh-answer-buttons"
    );

    options.forEach(option => {
      const button = make(
        "button",
        "",
        option
      );

      button.type = "button";
      button.dataset.answer = key;
      button.dataset.value = option;

      buttons.appendChild(button);
    });

    row.appendChild(buttons);

    return row;
  }

  /* ============================================================
     13. TIDSREGISTRERING
     ============================================================ */

  function mainEventKey(id) {
    return "i:" + id;
  }

  function subEventKey(id, index) {
    return "s:" + id + ":" + index;
  }

  function answerEventKey(key) {
    return "answer:" + key;
  }

  function addEvent(key, title, note = "") {
    state.events.push({
      id: state.nextEventId++,
      key,
      title,
      note,
      time: new Date()
    });
  }

  function eventsFor(key) {
    return state.events
      .filter(event => event.key === key)
      .sort(
        (a, b) =>
          a.time.getTime() - b.time.getTime() ||
          a.id - b.id
      );
  }

  function removeEventsFor(key) {
    state.events = state.events.filter(
      event => event.key !== key
    );
  }

  function getNote(id) {
    return String(
      $(`[data-note="${id}"]`)?.value || ""
    ).trim();
  }

  /* ============================================================
     14. HOVEDPUNKTER
     ============================================================ */

  function changeMainCheckbox(id, checked) {
    const item = ITEM_MAP.get(id);

    if (!item) return;

    if (
      checked &&
      id === "d3" &&
      !value("closureReason")
    ) {
      alert(
        "Skriv begrunnelse for avslutning først."
      );

      refreshChecklist();
      $("#closureReason")?.focus();

      return;
    }

    if (
      checked &&
      id === "d4" &&
      !value("deviationNumber")
    ) {
      alert(
        "Skriv inn avviksnummer eller referanse først."
      );

      refreshChecklist();
      $("#deviationNumber")?.focus();

      return;
    }

    state.checked[id] = checked;

    if (item.timed) {
      const key = mainEventKey(id);

      if (!checked) {
        removeEventsFor(key);
      } else if (!eventsFor(key).length) {
        addEvent(
          key,
          item.report || item.title,
          id === "d3"
            ? value("closureReason")
            : getNote(id)
        );
      }
    }

    /* ATCC */

    if (id === "k5") {
      if (checked && state.answers.atcc) {
        removeEventsFor(mainEventKey("k5"));
      }

      if (!checked && state.answers.atcc === "Ja") {
        state.answers.atcc = null;
        removeEventsFor(answerEventKey("atcc"));
      }
    }

    /* Kontaktkilder */

    if (id === "k6" && !checked) {
      item.subs.forEach((_, index) => {
        state.sub["k6:" + index] = false;

        removeEventsFor(
          subEventKey("k6", index)
        );
      });
    }

    refreshChecklist();
    updateReport();
  }

  /* ============================================================
     15. UNDERPUNKTER
     ============================================================ */

  function changeSubCheckbox(key, checked) {
    const [id, indexText] = key.split(":");
    const item = ITEM_MAP.get(id);
    const index = Number(indexText);

    if (!item || !item.subs?.[index]) {
      return;
    }

    if (
      checked &&
      id === "k6" &&
      index === 3 &&
      !value("otherContactResource")
    ) {
      alert(
        "Skriv inn hvilken ressurs som er kontaktet."
      );

      refreshChecklist();
      $("#otherContactResource")?.focus();

      return;
    }

    state.sub[key] = checked;

    if (item.subTimed) {
      const eventKey = subEventKey(id, index);

      removeEventsFor(eventKey);

      if (checked) {
        const title =
          id === "k6" && index === 3
            ? "Kontaktet: " +
              value("otherContactResource")
            : "Kontaktet: " +
              item.subs[index];

        addEvent(eventKey, title);
      }
    }

    if (id === "k6") {
      state.checked.k6 = item.subs.some(
        (_, i) => Boolean(state.sub["k6:" + i])
      );
    }

    refreshChecklist();
    updateReport();
  }

  /* ============================================================
     16. JA/NEI/UAVKLART
     ============================================================ */

  function changeAnswer(key, selected) {
    if (!(key in state.answers)) return;

    const previous = state.answers[key];

    const next =
      previous === selected ? null : selected;

    state.answers[key] = next;

    const eventKey = answerEventKey(key);

    removeEventsFor(eventKey);

    if (next) {
      addEvent(
        eventKey,
        ANSWER_TITLES[key] + ": " + next
      );
    }

    /* ATCC */

    if (key === "atcc") {
      if (next === "Ja") {
        state.checked.k5 = true;

        removeEventsFor(
          mainEventKey("k5")
        );
      } else {
        state.checked.k5 = false;

        removeEventsFor(
          mainEventKey("k5")
        );
      }
    }

    /* MOBILSPORING */

    if (key === "tracking") {
      if (next === "Ja") {
        state.checked.h1 = true;
      } else {
        state.checked.h1 = false;
      }
    }

    refreshChecklist();
    updateReport();
  }

  /* ============================================================
     17. AUTOMATISK AVHUKING VED AVSLUTNING

     NY FUNKSJON

     Når begrunnelse skrives:
       - Huk av Aksjonen avsluttet
       - Registrer klokkeslett
       - Oppdater rapport

     Når avviksnummer skrives:
       - Huk av Meld avvik
       - Oppdater rapport

     Når feltet tømmes:
       - Fjern avhuking
       - Fjern tilhørende registrering
     ============================================================ */

  function updateClosureFromText() {
    const reason = value("closureReason");
    const hasReason = Boolean(reason);

    const wasChecked = Boolean(state.checked.d3);

    state.checked.d3 = hasReason;

    const eventKey = mainEventKey("d3");

    if (hasReason) {
      /* Registrer kun første gang feltet fylles ut */

      if (!eventsFor(eventKey).length) {
        addEvent(
          eventKey,
          "Aksjonen avsluttet",
          reason
        );
      }

      /* Oppdater begrunnelsen uten å endre klokkeslett */

      const event = eventsFor(eventKey)[0];

      if (event) {
        event.note = reason;
      }
    } else {
      /* Fjern tidsregistrering hvis begrunnelsen slettes */

      if (wasChecked || eventsFor(eventKey).length) {
        removeEventsFor(eventKey);
      }
    }

    refreshChecklist();
    updateReport();
  }

  function updateDeviationFromText() {
    const deviationNumber = value("deviationNumber");

    const hasDeviation = Boolean(deviationNumber);

    /* Automatisk avhuking */

    state.checked.d4 = hasDeviation;

    /* Rapporten bruker avviksnummeret direkte fra feltet */

    refreshChecklist();
    updateReport();
  }

  /* ============================================================
     18. SJEKKLISTEHENDELSER
     ============================================================ */

  function setupChecklistEvents() {
    document.addEventListener("change", event => {
      const target = event.target;

      if (!target.closest(".sh-phase")) {
        return;
      }

      if (target.dataset.check) {
        changeMainCheckbox(
          target.dataset.check,
          target.checked
        );
      } else if (target.dataset.sub) {
        changeSubCheckbox(
          target.dataset.sub,
          target.checked
        );
      }
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("button");

      if (
        !button ||
        !button.closest(".sh-phase")
      ) {
        return;
      }

      if (button.dataset.answer) {
        changeAnswer(
          button.dataset.answer,
          button.dataset.value
        );
      }
    });
  }

  /* ============================================================
     19. OPPDATER SJEKKLISTEN
     ============================================================ */

  function refreshChecklist() {
    PHASES.forEach(phase => {
      phase.items.forEach(item => {
        const row = $(`[data-row="${item.id}"]`);

        if (!row) return;

        const checked =
          Boolean(state.checked[item.id]);

        const checkbox = $(
          `[data-check="${item.id}"]`,
          row
        );

        if (checkbox) {
          checkbox.checked = checked;
        }

        row.classList.toggle(
          "is-done",
          checked
        );

        /* UNDERPUNKTER */

        $$("[data-sub]", row).forEach(sub => {
          const key = sub.dataset.sub;
          const active = Boolean(state.sub[key]);

          sub.checked = active;

          const time = $(
            `[data-subtime="${key}"]`,
            row
          );

          if (time) {
            const event = eventsFor(
              "s:" + key
            )[0];

            time.textContent =
              active && event
                ? clock(event.time)
                : "";
          }
        });

        /* HOVEDPUNKT – TID */

        const time = $(
          `[data-time="${item.id}"]`,
          row
        );

        if (time) {
          const events = eventsFor(
            mainEventKey(item.id)
          );

          const latest = events[events.length - 1];

          if (
            item.id === "k5" &&
            state.answers.atcc === "Ja"
          ) {
            const atccEvent = eventsFor(
              answerEventKey("atcc")
            )[0];

            time.textContent = atccEvent
              ? clock(atccEvent.time)
              : "";
          } else {
            time.textContent =
              latest ? clock(latest.time) : "";
          }
        }
      });
    });

    /* SVARKNAPPER */

    $$("[data-answer]").forEach(button => {
      const active =
        state.answers[button.dataset.answer] ===
        button.dataset.value;

      button.classList.toggle(
        "active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        String(active)
      );
    });

    /* ATCC */

    const atcc = $("#atccDetail");

    if (atcc) {
      atcc.hidden =
        state.answers.atcc !== "Ja";
    }

    /* ELT OG MOBILSPORING */

    for (const key of ["elt", "tracking"]) {
      const detail = $("#" + key + "Detail");

      if (detail) {
        detail.hidden = ![
          "Ja",
          "Uavklart"
        ].includes(state.answers[key]);
      }
    }
  }

  /* ============================================================
     20. SKJEMAHENDELSER
     ============================================================ */

  function autoGrowTextarea(textarea) {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height =
      textarea.scrollHeight + "px";
  }

  function setupFormEvents() {
    const form = $("#missingHelicopterForm");

    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();
    });

    /* ========================================================
       OPPDATER RAPPORT MENS MAN SKRIVER
       ======================================================== */

    form.addEventListener("input", event => {
      const target = event.target;

      if (target.id === "registration") {
        updateCrewRoles();
      }

      if (target.closest("#traineeContainer")) {
        maintainPax();
      }

      if (target.closest("#otherTgContainer")) {
        maintainOtherTg();
      }

      if (
        target.classList.contains(
          "sh-nbko-note"
        )
      ) {
        autoGrowTextarea(target);
      }

      /* ======================================================
         NYTT: AUTOMATISK AVHUKING VED AVSLUTNING
         ====================================================== */

      if (target.id === "closureReason") {
        updateClosureFromText();
        return;
      }

      /* ======================================================
         NYTT: AUTOMATISK AVHUKING VED AVVIKSNUMMER
         ====================================================== */

      if (target.id === "deviationNumber") {
        updateDeviationFromText();
        return;
      }

      /* ANDRE RESSURSER */

      if (
        target.id === "otherContactResource" &&
        state.sub["k6:3"]
      ) {
        const event = eventsFor(
          subEventKey("k6", 3)
        )[0];

        if (event) {
          event.title =
            "Kontaktet: " +
            value("otherContactResource");
        }
      }

      updateReport();
    });

    /* ========================================================
       NORMALISER FELTER VED FOKUSSKIFTE
       ======================================================== */

    form.addEventListener("focusout", event => {
      const target = event.target;

      /* TALEGRUPPER */

      if (isTalkgroupField(target)) {
        normalizeTalkgroupField(target);
      }

      /* REGISTRERINGSNUMMER */

      if (target.id === "registration") {
        target.value = normalizeRegistration(
          target.value
        );

        updateCrewRoles();
      }

      /* TELEFONNUMMER */

      const isPhoneField =
        [
          "pilotPhone",
          "rescuerPhone",
          "doctorPhone"
        ].includes(target.id) ||
        target.classList.contains("pax-phone");

      if (
        isPhoneField &&
        !window.LAK?.formatPhoneNumber
      ) {
        target.value = formatPhoneNumber(
          target.value
        );
      }

      /* RESSURS-ID */

      if (target.id === "resourceId") {
        target.value = normalizeResource(
          target.value
        );
      }

      /* KLOKKESLETT */

      if (
        target.id === "departureTime" ||
        target.id === "etaTime"
      ) {
        target.value = formatTimeInput(
          target.value
        );
      }

      /* DYNAMISKE FELTER */

      if (target.closest("#traineeContainer")) {
        maintainPax();
      }

      if (target.closest("#otherTgContainer")) {
        maintainOtherTg();
      }

      updateReport();
    });
  }

  /* ============================================================
     21. CREW OG PAX I RAPPORT
     ============================================================ */

  function personLine(role, nameId, phoneId) {
    const name = value(nameId);

    const phone = formatPhoneNumber(
      value(phoneId)
    );

    return (
      role + ": " +
      [name, phone]
        .filter(Boolean)
        .join(" – ")
    );
  }

  function paxLines() {
    return $$("#traineeContainer .pax-row")
      .filter(paxHasContent)
      .map((row, index) => {
        const name =
          $(".pax-name", row)?.value.trim() || "";

        const phone = formatPhoneNumber(
          $(".pax-phone", row)?.value.trim() || ""
        );

        return (
          "PAX " + (index + 1) + ": " +
          [name, phone]
            .filter(Boolean)
            .join(" – ")
        );
      });
  }

  /* ============================================================
     22. RAPPORTGENERATOR
     ============================================================ */

  function generateReport() {
    const separator =
      "----------------------------------------";

    const police = policeHelicopter();

    const lines = [
      "SAVNET HELIKOPTER",
      "TG: " + getTalkgroups().join(" // "),
      separator,

      "SIST KJENTE POSISJON:",
      "UTM: " + value("utmPosition"),
      "Grader/desimalminutter: " +
        value("dmmPosition"),
      "Stedsnavn: " + value("placeName"),
      separator,

      "HELIKOPTER:",
      "Ressurs-ID: " +
        normalizeResource(value("resourceId")),
      "Reg.nr.: " +
        normalizeRegistration(value("registration")),
      "Callsign: " + value("callsign"),
      "POB: " + (state.pob ?? ""),
      separator,

      "FLIGHT FOLLOWING:",
      "Fra: " + value("fromLocation"),
      "Til: " + value("toLocation"),
      "Planlagt flyrute: " +
        value("plannedRoute"),
      "Tatt av: " +
        formatTimeInput(value("departureTime")),
      "ETA: " +
        formatTimeInput(value("etaTime")),
      separator,

      "UTLØSENDE KRITERIUM:",
      CRITERIA[state.criterion] || ""
    ];

    if (state.criterion === 3) {
      lines.push(
        "Observasjoner: " +
        value("observations")
      );
    }

    lines.push(
      separator,
      "CREW manifest:",

      personLine(
        "Pilot",
        "pilotName",
        "pilotPhone"
      ),

      personLine(
        police ? "PCM" : "HCM",
        "rescuerName",
        "rescuerPhone"
      ),

      personLine(
        police ? "PCM" : "Lege",
        "doctorName",
        "doctorPhone"
      ),

      ...paxLines(),

      separator,
      "KRONOLOGISK HENDELSESLOGG:"
    );

    /* SORTER HENDELSER KRONOLOGISK */

    const events = [...state.events].sort(
      (a, b) =>
        a.time.getTime() - b.time.getTime() ||
        a.id - b.id
    );

    if (!events.length) {
      lines.push(
        "Ingen tidsfestede tiltak registrert."
      );
    }

    events.forEach(event => {
      /* ATCC, ELT OG MOBILSPORING */

      if (event.key.startsWith("answer:")) {
        const key = event.key.slice(
          "answer:".length
        );

        const answer = state.answers[key];

        if (!answer) return;

        const title = ANSWER_TITLES[key];

        if (!title) return;

        const descriptionId =
          key === "atcc"
            ? "atccDescription"
            : key + "Description";

        const detail = value(descriptionId);

        let reportLine =
          clock(event.time) +
          " – " +
          title +
          ": " +
          answer;

        if (
          detail &&
          (
            (key === "atcc" && answer === "Ja") ||
            (
              key !== "atcc" &&
              ["Ja", "Uavklart"].includes(answer)
            )
          )
        ) {
          reportLine += ". " + detail;
        }

        lines.push(reportLine);

        return;
      }

      /* ØVRIGE TIDSFESTEDE TILTAK */

      let note = event.note;

      if (
        event.key === mainEventKey("h3")
      ) {
        note = getNote("h3") || note;
      }

      /* ======================================================
         AVSLUTNING

         HENT ALLTID OPPDATERT BEGRUNNELSE FRA FELTET
         ====================================================== */

      if (
        event.key === mainEventKey("d3")
      ) {
        if (!state.checked.d3) return;

        note = value("closureReason") || note;
      }

      /* HINDRE DOBBEL ATCC-RAPPORTERING */

      if (
        event.key === mainEventKey("k5") &&
        state.answers.atcc
      ) {
        return;
      }

      lines.push(
        clock(event.time) +
        " – " +
        event.title +
        (note ? " – " + note : "")
      );
    });

    /* ========================================================
       AVVIK

       AUTOMATISK OPPDATERT FRA AVVIKSNUMMER-FELTET
       ======================================================== */

    if (
      state.checked.d4 ||
      value("deviationNumber")
    ) {
      lines.push(
        separator,
        "AVVIK:",
        "Avviksnummer: " +
          (
            value("deviationNumber") ||
            "Ikke angitt"
          )
      );
    }

    return lines.join("\n");
  }

  /* ============================================================
     23. OPPDATER RAPPORT
     ============================================================ */

  function updateReport() {
    const output = $("#reportOutput");

    if (!output) return;

    try {
      output.value = generateReport();

      const status = $("#reportStatus");

      if (status) {
        status.textContent =
          "Oppdateres automatisk";
      }
    } catch (error) {
      console.error(
        "Rapportfeil:",
        error
      );

      const status = $("#reportStatus");

      if (status) {
        status.textContent =
          "Rapportfeil – kontroller konsollen";
      }
    }
  }

  /* ============================================================
     24. KOPIER RAPPORT
     ============================================================ */

  async function copyReport() {
    const output = $("#reportOutput");

    if (!output) return;

    let copied = false;

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(
          output.value
        );

        copied = true;
      } else {
        output.focus();
        output.select();

        copied = document.execCommand("copy");

        output.setSelectionRange(0, 0);
      }
    } catch (error) {
      console.error(
        "Kopiering feilet:",
        error
      );
    }

    const label = $("#copyButtonText");

    if (!label) return;

    label.textContent =
      copied
        ? "Tekst kopiert"
        : "Kopiering feilet";

    clearTimeout(copyTimer);

    copyTimer = setTimeout(() => {
      label.textContent = "Kopier tekst";
    }, 5000);
  }

  /* ============================================================
     25. SKRIV UT RAPPORT
     ============================================================ */

  function printReport() {
    const report =
      $("#reportOutput")?.value || "";

    const win = window.open("", "_blank");

    if (!win) {
      alert(
        "Nettleseren blokkerte utskriftsvinduet."
      );

      return;
    }

    const doc = win.document;

    doc.open();

    doc.write(
      "<!doctype html><html lang='no'><head>" +
      "<meta charset='UTF-8'>" +
      "<title>Savnet helikopter – rapport</title>" +
      "<style>" +
      "body{font-family:Arial,sans-serif;margin:18mm}" +
      "pre{white-space:pre-wrap;overflow-wrap:anywhere;" +
      "font:11px Consolas,monospace;line-height:1.55}" +
      "</style></head><body>" +
      "<h2>Savnet helikopter</h2>" +
      "<pre id='printText'></pre>" +
      "</body></html>"
    );

    doc.close();

    doc.getElementById(
      "printText"
    ).textContent = report;

    win.focus();
    win.print();
  }

  /* ============================================================
     26. TØM SKJEMA
     ============================================================ */

  function resetAll() {
    if (
      !confirm(
        "Vil du tømme hele skjemaet og alle registreringer?"
      )
    ) {
      return;
    }

    $("#missingHelicopterForm")?.reset();

    state.pob = null;
    state.criterion = null;
    state.checked = {};
    state.sub = {};

    state.answers = {
      atcc: null,
      elt: null,
      tracking: null
    };

    state.events = [];
    state.nextEventId = 1;

    $("#traineeContainer")?.replaceChildren();
    $("#otherTgContainer")?.replaceChildren();

    maintainPax();
    maintainOtherTg();

    refreshPob();
    refreshCriteria();
    updateCrewRoles();
    refreshChecklist();
    updateReport();

    $$(".sh-nbko-note").forEach(
      autoGrowTextarea
    );

    $(".form-panel")?.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  /* ============================================================
     27. TILBAKEMELDING
     ============================================================ */

  function sendFeedback() {
    const subject = encodeURIComponent(
      "Tilbakemelding – Savnet helikopter"
    );

    const body = encodeURIComponent(
      "Hei!\n\n" +
      "Jeg har følgende tilbakemelding på skjemaet:\n\n"
    );

    window.location.href =
      "mailto:b32838@ous-hf.no" +
      "?subject=" + subject +
      "&body=" + body;
  }

  /* ============================================================
     28. KNAPPER
     ============================================================ */

  function setupButtons() {
    $("#copyButton")?.addEventListener(
      "click",
      copyReport
    );

    $("#printButton")?.addEventListener(
      "click",
      printReport
    );

    $("#resetButton")?.addEventListener(
      "click",
      resetAll
    );

    $("#emailReportButton")?.addEventListener(
      "click",
      sendFeedback
    );
  }

  /* ============================================================
     29. OPPSTART
     ============================================================ */

  function initialize() {
    if (
      !$("#missingHelicopterForm") ||
      !$("#reportOutput")
    ) {
      console.error(
        "Savnet helikopter: Fant ikke skjema eller rapport."
      );

      return;
    }

    try {
      initializeTgRegister();
      buildChecklist();

      maintainPax();
      maintainOtherTg();

      setupPob();
      setupCriteria();
      setupFormEvents();
      setupChecklistEvents();
      setupButtons();

      updateCrewRoles();
      refreshChecklist();
      updateReport();

      console.info(
        "Savnet helikopter – skjema initialisert."
      );
    } catch (error) {
      console.error(
        "Savnet helikopter – oppstartsfeil:",
        error
      );

      const status = $("#reportStatus");

      if (status) {
        status.textContent =
          "Feil ved oppstart – kontroller konsollen";
      }
    }
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
