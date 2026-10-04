"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
    pob: null,
    criterion: null
};

let copyTimer = null;

/* KRITERIER */

const CRITERIA = {
    1: "Helikopteret svarer ikke på anrop eller planlagt rapportering i henhold til flight following, og vises som rød både på Locus og Nødnett.",
    2: "Helikopteret har ikke meldt landing innen 10 minutter etter oppgitt ETA, og det foreligger samtidig manglende kontakt eller andre indikasjoner på avvik.",
    3: "Observasjoner/meldinger som gir grunn til å mistenke/bekrefte havari."
};

const CRITERIA_LABELS = {
    1: "Manglende kontakt – rød på både Locus og Nødnett.",
    2: "Ingen landingsmelding 10 minutter etter ETA – samtidig manglende kontakt eller tegn til avvik.",
    3: "Observasjoner/meldinger som gir grunn til å mistenke eller bekrefte havari."
};

/* ICAO / LOKASJONER */

const ICAO_LOCATIONS = {
    XZAH: "Ahus",
    ENAR: "Arendal base",
    ENGK: "Arendal lufthavn",
    ENDB: "Dombås base",
    ENDH: "Drammen SH",
    ENEG: "Eggemoen flyplass",
    ENEL: "Elverum SH",
    ENGJ: "Gjøvik SH",
    XZHM: "Hamar SH",
    ENHA: "Hamar flyplass",
    ENSP: "Kalnes SH",
    ENKO: "Kongsberg SH",
    ENKG: "Kongsvinger SH",
    ENKH: "Kristiansand SH",
    ENCN: "Kjevik flyplass",
    ENLH: "Lillehammer SH",
    ENLX: "Lørenskog base",
    ENNO: "Notodden flyplass",
    ENNT: "Notodden SH",
    ENGM: "Oslo lufthavn",
    ENRH: "Rikshospitalet",
    ENRX: "Ringerike SH",
    ENRY: "Rygge flystasjon",
    ENTE: "Skien SH",
    ENSN: "Skien lufthavn",
    XZSA: "Sunnaas SH",
    ENTX: "Taraldrud",
    XZTP: "Torpomoen",
    XZTY: "Tynset SH",
    ENTH: "Tønsberg SH",
    ENUH: "Ullevål",
    ENAH: "Ål base",
    ENBG: "Bergen base",
    ENEH: "Egersund SH",
    ENFD: "Førde SH / base",
    ENBX: "Haukeland SH",
    ENHX: "Haugesund SH",
    ENLD: "Lærdal SH",
    ENNF: "Nordfjord SH",
    ENLV: "Stord SH",
    ENSX: "Stavanger SH",
    ENVS: "Voss SH",
    ENKS: "Kristiansund SH",
    ENYY: "Levanger SH",
    ENMP: "Molde SH",
    ENNH: "Namsos SH",
    ENRT: "Rosten base",
    ENTR: "St. Olavs",
    ENVI: "Volda SH",
    ENVA: "Værnes flyplass",
    ENOL: "Ørland flystasjon",
    ENAX: "Ålesund SH",
    ENME: "Hjelset SH"
};

/*
 * TALEGRUPPER
 *
 * Indekser fra den vedlagte oversikten, juli 2020.
 * X i oversikten betyr talegruppenummer.
 */

const TG_REGISTER = new Map();

function normaliseTgKey(value) {
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
    const group = {
        name,
        index: String(index)
    };

    for (const alias of [name, ...aliases]) {
        const key = normaliseTgKey(alias);
        const existing = TG_REGISTER.get(key);

        if (
            existing &&
            (
                existing.name !== name ||
                existing.index !== group.index
            )
        ) {
            throw new Error("Tvetydig talegruppe: " + alias);
        }

        TG_REGISTER.set(key, group);
    }
}

/* Regionale helsetalegrupper */

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

/* LA, FKS, HRS og særskilte SAR-/FINO-grupper */

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

/* LA rotary wing */

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

/* LA fixed wing */

[
    ["61-DAG", 61],
    ["61-NAT", 62],
    ["63-DAG", 63],
    ["63-NAT", 64],
    ["64-DAG", 65],
    ["66-DAG", 66],
    ["66-NAT", 67],
    ["71-DAG", 71],
    ["71-NAT", 72],
    ["73-DAG", 73],
    ["73-NAT", 74],
    ["75-DAG", 75],
    ["75-NAT", 76],
    ["76", 77],
    ["81-DAG", 81],
    ["81-NAT", 82],
    ["82-DAG", 84],
    ["85", 85]
].forEach(([suffix, index]) => {
    registerTg(
        "LA-FW-" + suffix,
        index,
        suffix.endsWith("-NAT")
            ? ["LA-FW-" + suffix + "T"]
            : []
    );
});

/* 330 */

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

/*
 * Område, BAPS-base, felles SAR/SAMV/SAMVUP-base.
 *
 * BAPS:   1–9
 * SAR:    1–4
 * SAMV:   1–5 og A1–A2
 * SAMVUP: 11–29
 */

const TG_AREAS = [
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

TG_AREAS.forEach(([area, bapsBase, sharedBase]) => {
    const padded = String(area).padStart(2, "0");

    const add = (series, number, index, extraSeries = []) => {
        const aliases = [series, ...extraSeries].flatMap(
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
    };

    for (let number = 1; number <= 9; number++) {
        add("BAPS", number, bapsBase + number);
    }

    for (let number = 1; number <= 4; number++) {
        add("SAR", number, sharedBase + 40 + number);
    }

    for (let number = 1; number <= 5; number++) {
        add(
            "SAMV",
            number,
            sharedBase + 10 + number,
            ["SAMVIRKE"]
        );
    }

    for (let number = 1; number <= 2; number++) {
        add(
            "SAMV",
            "A" + number,
            sharedBase + 15 + number,
            ["SAMVIRKE"]
        );
    }

    for (let number = 11; number <= 29; number++) {
        add("SAMVUP", number, sharedBase + 10 + number);
    }
});

/* Sverige */

for (let number = 1; number <= 8; number++) {
    registerTg("NOSE-H-" + number, 9010 + number);
    registerTg("NOSE-EM-" + number, 9070 + number);
    registerTg("NOSE-CO-" + number, 9080 + number);
}

[10, 20, 30, 40, 50, 60, 70].forEach((number, index) => {
    registerTg("NOSE-H-" + number, 9019 + index);
});

[
    11, 12, 13, 14,
    21, 22, 23, 24,
    31, 32, 33, 34
].forEach((number, index) => {
    registerTg("NOSE-SAR-" + number, 9091 + index);
});

/* Finland */

for (let number = 1; number <= 4; number++) {
    registerTg("FINO-H-" + number, 9210 + number);
    registerTg("FINO-SAR-" + number, 9290 + number);
}

function formatTgForReport(value) {
    const text = String(value ?? "").trim();

    if (!text) {
        return "";
    }

    const group = TG_REGISTER.get(normaliseTgKey(text));

    return group
        ? `${group.name} (indeks ${group.index})`
        : `${text} (indeks ikke funnet)`;
}

/* OPPSTART */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialiseForm);
} else {
    initialiseForm();
}

function initialiseForm() {
    const panel = $(".form-panel");

    if (!panel) {
        return;
    }

    panel.addEventListener("input", handleInput);
    panel.addEventListener("focusout", handleFocusOut);

    $("#missingHelicopterForm")?.addEventListener(
        "submit",
        (event) => event.preventDefault()
    );

    initialisePob();
    initialiseCriteria();

    $("#copyButton")?.addEventListener("click", copyReport);
    $("#resetButton")?.addEventListener("click", resetForm);
    $("#emailReportButton")?.addEventListener("click", createEmail);

    initialiseFormEnhancements();
    clearCoordinateError();
    renumberPax();
    updateReport();
}

/* POB */

function initialisePob() {
    $$("#pobChips .chip").forEach((button) => {
        button.addEventListener("click", () => {
            const number = Number(button.dataset.pob);

            state.pob = state.pob === number ? null : number;

            updatePobButtons();
            updateReport();
        });
    });
}

function updatePobButtons() {
    $$("#pobChips .chip").forEach((button) => {
        const selected = Number(button.dataset.pob) === state.pob;

        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

/* KRITERIEKNAPPER */

function initialiseCriteria() {
    $$(".criteria-chip").forEach((button) => {
        const number = Number(button.dataset.criterion);

        if (CRITERIA_LABELS[number]) {
            button.textContent = CRITERIA_LABELS[number];
        }

        button.addEventListener("click", () => {
            state.criterion =
                state.criterion === number ? null : number;

            updateCriteriaButtons();
            updateObservationField();
            updateReport();
        });
    });

    updateObservationField();
}

function updateCriteriaButtons() {
    $$(".criteria-chip").forEach((button) => {
        const selected =
            Number(button.dataset.criterion) === state.criterion;

        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

function updateObservationField() {
    const wrapper = $("#observationWrapper");

    if (!wrapper) {
        return;
    }

    const wasHidden = wrapper.classList.contains("hidden");
    const visible = state.criterion === 3;

    wrapper.classList.toggle("hidden", !visible);

    $(".criteria-chip[data-criterion='3']")?.setAttribute(
        "aria-expanded",
        String(visible)
    );

    if (visible && wasHidden) {
        requestAnimationFrame(() => {
            const panel = $(".form-panel");

            if (panel && panel.scrollHeight > panel.clientHeight) {
                const bottom = wrapper.getBoundingClientRect().bottom;
                const panelBottom =
                    panel.getBoundingClientRect().bottom - 16;

                panel.scrollBy({
                    top: Math.max(0, bottom - panelBottom),
                    behavior: motionBehavior()
                });
            } else {
                wrapper.scrollIntoView({
                    block: "nearest",
                    behavior: motionBehavior()
                });
            }

            wrapper.classList.remove("field-revealed");
            void wrapper.offsetWidth;
            wrapper.classList.add("field-revealed");

            updateFormScrollHint();
        });
    }
}

/* INPUT */

function handleInput(event) {
    const target = event.target;

    if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
    ) {
        return;
    }

    if (target.classList.contains("other-tg-input")) {
        maintainDynamicTgFields();
    }

    if (
        target.classList.contains("trainee-name") ||
        target.classList.contains("trainee-phone")
    ) {
        maintainPaxRows();
    }

    if (
        target.id === "utmPosition" ||
        target.id === "dmmPosition"
    ) {
        delete target.dataset.generatedCoordinate;
        delete target.dataset.coordinateSource;

        const otherId =
            target.id === "utmPosition"
                ? "dmmPosition"
                : "utmPosition";

        const other = $("#" + otherId);

        if (
            other &&
            other.dataset.coordinateSource === target.id
        ) {
            if (
                other.value === other.dataset.generatedCoordinate
            ) {
                other.value = "";
            }

            delete other.dataset.generatedCoordinate;
            delete other.dataset.coordinateSource;
        }

        clearCoordinateError();
    }

    updateReport();
}

function handleFocusOut(event) {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
        return;
    }

    if (target.type === "tel") {
        target.value = formatPhoneNumber(target.value);
    }

    if (
        target.id === "departureTime" ||
        target.id === "etaTime"
    ) {
        const formatted = formatTime(target.value);

        if (formatted) {
            target.value = formatted;
        }
    }

    if (target.id === "resourceId") {
        target.value = normaliseResourceId(target.value);
    }

    if (target.id === "registration") {
        target.value = normaliseRegistration(target.value);
    }

    if (
        target.id === "utmPosition" ||
        target.id === "dmmPosition"
    ) {
        convertCoordinates(target.id);
    }

    updateReport();
}

/* DYNAMISKE TALEGRUPPER */

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

    if (!container) {
        return;
    }

    let inputs = [
        ...container.querySelectorAll(".other-tg-input")
    ];

    if (!inputs.length || inputs.at(-1).value.trim()) {
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
        $("#healthTg")?.value.trim() ?? "",
        $("#sarTg")?.value.trim() ?? "",
        ...$$(".other-tg-input").map(
            (input) => input.value.trim()
        )
    ];

    return values.filter(Boolean).map(formatTgForReport);
}

/* DYNAMISKE PAX-RADER */

function createPaxRow() {
    const row = document.createElement("div");

    row.className = "person-row trainee-row";

    row.innerHTML = `
        <div class="person-role">
            <span class="role-icon" aria-hidden="true">👤</span>
            <span class="pax-label">PAX</span>
        </div>

        <textarea
            rows="1"
            class="trainee-name crew-name"
            placeholder="Navn"
            autocomplete="off"
        ></textarea>

        <input
            type="tel"
            class="trainee-phone"
            placeholder="Mobilnummer"
            autocomplete="off"
        >
    `;

    return row;
}

function paxRowHasContent(row) {
    const name = row.querySelector(".trainee-name")?.value.trim();
    const phone = row.querySelector(".trainee-phone")?.value.trim();

    return Boolean(name || phone);
}

function maintainPaxRows() {
    const container = $("#traineeContainer");

    if (!container) {
        return;
    }

    let rows = [
        ...container.querySelectorAll(".trainee-row")
    ];

    if (!rows.length || paxRowHasContent(rows.at(-1))) {
        container.appendChild(createPaxRow());
    }

    rows = [
        ...container.querySelectorAll(".trainee-row")
    ];

    for (let i = rows.length - 2; i >= 0; i--) {
        if (
            !paxRowHasContent(rows[i]) &&
            !paxRowHasContent(rows[i + 1]) &&
            !rows[i].contains(document.activeElement)
        ) {
            rows[i].remove();
        }
    }

    renumberPax();
}

function renumberPax() {
    $$(".trainee-row").forEach((row, index) => {
        const label = `PAX ${index + 1}`;
        const labelElement = row.querySelector(".pax-label");

        if (labelElement) {
            labelElement.textContent = label;
        }

        row.querySelector(".trainee-name")?.setAttribute(
            "aria-label",
            `${label} navn`
        );

        row.querySelector(".trainee-phone")?.setAttribute(
            "aria-label",
            `${label} mobilnummer`
        );
    });
}

/* TELEFON */

function formatPhoneNumber(value) {
    let digits = value.replace(/\D/g, "");

    if (digits.startsWith("0047") && digits.length === 12) {
        digits = digits.slice(4);
    } else if (
        digits.startsWith("47") &&
        digits.length === 10
    ) {
        digits = digits.slice(2);
    }

    if (digits.length === 8) {
        return (
            digits.slice(0, 3) + " " +
            digits.slice(3, 5) + " " +
            digits.slice(5)
        );
    }

    return value.trim();
}

/* KLOKKESLETT */

function formatTime(value) {
    const text = value.trim();

    if (!text) {
        return "";
    }

    let hour;
    let minute;

    const match = text.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

    if (match) {
        hour = Number(match[1]);
        minute = Number(match[2]);

        if (match[3] && Number(match[3]) > 59) {
            return "";
        }
    } else if (/^\d{3,4}$/.test(text)) {
        const digits = text.padStart(4, "0");

        hour = Number(digits.slice(0, 2));
        minute = Number(digits.slice(2));
    } else {
        return "";
    }

    if (hour > 23 || minute > 59) {
        return "";
    }

    return (
        String(hour).padStart(2, "0") + ":" +
        String(minute).padStart(2, "0")
    );
}

function validateTimes() {
    const invalid = ["departureTime", "etaTime"].some((id) => {
        const text = $("#" + id)?.value.trim() ?? "";

        return text && !formatTime(text);
    });

    const error = $("#timeError");

    if (error) {
        error.textContent = invalid
            ? "Ugyldig klokkeslett. Bruk for eksempel 2350 eller 23:50."
            : "";
    }

    return !invalid;
}

/* RESSURS-ID, REGISTRERING OG LOKASJON */

function normaliseResourceId(value) {
    const text = value.trim();

    const match = text.match(
        /^(?:LA|LUFTAMBULANSE)?\s*(\d+)\s*-\s*(\d+)$/i
    );

    return match
        ? `LA ${match[1]}-${match[2]}`
        : text;
}

function normaliseRegistration(value) {
    const text = value
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

function formatLocation(value) {
    const text = value.trim();
    const code = text.toUpperCase();

    if (
        Object.prototype.hasOwnProperty.call(
            ICAO_LOCATIONS,
            code
        )
    ) {
        return `${code} – ${ICAO_LOCATIONS[code]}`;
    }

    return text;
}

/* LES KOORDINATER */

function parseUtm(value) {
    const text = value.trim().toUpperCase();

    const match = text.match(
        /^[ØE]\s*(\d[\d\s]*?)\s*[,;]?\s*N\s*(\d[\d\s]*?)\s+UTM\s*32N$/
    );

    if (!match) {
        return null;
    }

    const easting = Number(match[1].replace(/\s/g, ""));
    const northing = Number(match[2].replace(/\s/g, ""));

    if (
        !Number.isFinite(easting) ||
        !Number.isFinite(northing) ||
        easting < 100000 ||
        easting > 900000 ||
        northing < 0 ||
        northing > 10000000
    ) {
        return null;
    }

    return { easting, northing };
}

function parseDmm(value) {
    const text = value.trim().toUpperCase();

    const match = text.match(
        /^(\d{1,2})\s*[°º]\s*(\d{1,2}(?:[.,]\d+)?)\s*['’′]?\s*([NS])\s*[,;]?\s*(\d{1,3})\s*[°º]\s*(\d{1,2}(?:[.,]\d+)?)\s*['’′]?\s*([EØWV])$/
    );

    if (!match) {
        return null;
    }

    const latDegrees = Number(match[1]);
    const latMinutes = Number(match[2].replace(",", "."));
    const lonDegrees = Number(match[4]);
    const lonMinutes = Number(match[5].replace(",", "."));

    if (
        latDegrees > 90 ||
        lonDegrees > 180 ||
        latMinutes >= 60 ||
        lonMinutes >= 60 ||
        (latDegrees === 90 && latMinutes > 0) ||
        (lonDegrees === 180 && lonMinutes > 0)
    ) {
        return null;
    }

    let latitude = latDegrees + latMinutes / 60;
    let longitude = lonDegrees + lonMinutes / 60;

    if (match[3] === "S") {
        latitude *= -1;
    }

    if (match[6] === "W" || match[6] === "V") {
        longitude *= -1;
    }

    return { latitude, longitude };
}

/* FORMATER KOORDINATER */

function splitDegrees(value) {
    const absolute = Math.abs(value);

    let degrees = Math.floor(absolute);
    let minutes = Number(
        ((absolute - degrees) * 60).toFixed(3)
    );

    if (minutes >= 60) {
        degrees++;
        minutes = 0;
    }

    return {
        degrees,
        minutes: minutes.toFixed(3)
    };
}

function decimalDegreesToDmm(latitude, longitude) {
    const lat = splitDegrees(latitude);
    const lon = splitDegrees(longitude);

    return (
        `${lat.degrees}° ${lat.minutes}' ${latitude >= 0 ? "N" : "S"}, ` +
        `${lon.degrees}° ${lon.minutes}' ${longitude >= 0 ? "Ø" : "V"}`
    );
}

function formatUtmNumber(number) {
    const digits = String(Math.round(number));

    if (digits.length <= 5) {
        return digits;
    }

    return (
        digits.slice(0, -5) + " " +
        digits.slice(-5, -2) + " " +
        digits.slice(-2)
    );
}

function formatUtmInput(easting, northing) {
    return (
        `Ø ${formatUtmNumber(easting)}, ` +
        `N ${formatUtmNumber(northing)} UTM32N`
    );
}

/* UTM32N TIL LATITUDE / LONGITUDE */

function utm32ToLatLon(easting, northing) {
    const a = 6378137;
    const e2 = 0.00669438;
    const k0 = 0.9996;
    const ep2 = e2 / (1 - e2);

    const x = easting - 500000;
    const m = northing / k0;

    const mu = m / (
        a * (
            1 -
            e2 / 4 -
            3 * e2 ** 2 / 64 -
            5 * e2 ** 3 / 256
        )
    );

    const e1 =
        (1 - Math.sqrt(1 - e2)) /
        (1 + Math.sqrt(1 - e2));

    const phi =
        mu +
        (3 * e1 / 2 - 27 * e1 ** 3 / 32) *
            Math.sin(2 * mu) +
        (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) *
            Math.sin(4 * mu) +
        (151 * e1 ** 3 / 96) *
            Math.sin(6 * mu) +
        (1097 * e1 ** 4 / 512) *
            Math.sin(8 * mu);

    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const tanPhi = Math.tan(phi);

    const n = a / Math.sqrt(1 - e2 * sinPhi ** 2);
    const t = tanPhi ** 2;
    const c = ep2 * cosPhi ** 2;

    const r =
        a * (1 - e2) /
        (1 - e2 * sinPhi ** 2) ** 1.5;

    const d = x / (n * k0);

    const latitude = phi - (n * tanPhi / r) * (
        d ** 2 / 2 -
        (
            5 +
            3 * t +
            10 * c -
            4 * c ** 2 -
            9 * ep2
        ) * d ** 4 / 24 +
        (
            61 +
            90 * t +
            298 * c +
            45 * t ** 2 -
            252 * ep2 -
            3 * c ** 2
        ) * d ** 6 / 720
    );

    const longitude = (
        d -
        (1 + 2 * t + c) * d ** 3 / 6 +
        (
            5 -
            2 * c +
            28 * t -
            3 * c ** 2 +
            8 * ep2 +
            24 * t ** 2
        ) * d ** 5 / 120
    ) / cosPhi;

    return {
        latitude: latitude * 180 / Math.PI,
        longitude: 9 + longitude * 180 / Math.PI
    };
}

/* LATITUDE / LONGITUDE TIL UTM32N */

function latLonToUtm32(latitude, longitude) {
    const a = 6378137;
    const e2 = 0.00669438;
    const k0 = 0.9996;
    const ep2 = e2 / (1 - e2);

    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    const origin = 9 * Math.PI / 180;

    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const tanLat = Math.tan(lat);

    const n = a / Math.sqrt(1 - e2 * sinLat ** 2);
    const t = tanLat ** 2;
    const c = ep2 * cosLat ** 2;
    const aa = cosLat * (lon - origin);

    const m = a * (
        (
            1 -
            e2 / 4 -
            3 * e2 ** 2 / 64 -
            5 * e2 ** 3 / 256
        ) * lat -
        (
            3 * e2 / 8 +
            3 * e2 ** 2 / 32 +
            45 * e2 ** 3 / 1024
        ) * Math.sin(2 * lat) +
        (
            15 * e2 ** 2 / 256 +
            45 * e2 ** 3 / 1024
        ) * Math.sin(4 * lat) -
        (35 * e2 ** 3 / 3072) *
            Math.sin(6 * lat)
    );

    const easting = k0 * n * (
        aa +
        (1 - t + c) * aa ** 3 / 6 +
        (
            5 -
            18 * t +
            t ** 2 +
            72 * c -
            58 * ep2
        ) * aa ** 5 / 120
    ) + 500000;

    const northing = k0 * (
        m + n * tanLat * (
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
                330 * ep2
            ) * aa ** 6 / 720
        )
    );

    return {
        easting: Math.round(easting),
        northing: Math.round(northing)
    };
}

/* KOORDINATKONVERTERING */

function clearCoordinateError() {
    const error = $("#coordinateError");

    if (error) {
        error.textContent = "";
    }

    ["utmPosition", "dmmPosition"].forEach((id) => {
        const input = $("#" + id);

        if (input) {
            input.removeAttribute("aria-invalid");
            input.setCustomValidity("");
        }
    });
}

function setGeneratedCoordinate(target, value, sourceId) {
    if (!target) {
        return;
    }

    const isGenerated =
        target.dataset.coordinateSource === sourceId &&
        target.value === target.dataset.generatedCoordinate;

    if (target.value.trim() && !isGenerated) {
        return;
    }

    target.value = value;
    target.dataset.generatedCoordinate = value;
    target.dataset.coordinateSource = sourceId;
}

function convertCoordinates(sourceId) {
    clearCoordinateError();

    const source = $("#" + sourceId);

    if (!source || !source.value.trim()) {
        return;
    }

    if (sourceId === "utmPosition") {
        const parsed = parseUtm(source.value);

        if (!parsed) {
            return;
        }

        const result = utm32ToLatLon(
            parsed.easting,
            parsed.northing
        );

        if (
            !Number.isFinite(result.latitude) ||
            !Number.isFinite(result.longitude) ||
            result.latitude < 0 ||
            result.latitude > 84
        ) {
            return;
        }

        setGeneratedCoordinate(
            $("#dmmPosition"),
            decimalDegreesToDmm(
                result.latitude,
                result.longitude
            ),
            sourceId
        );
    }

    if (sourceId === "dmmPosition") {
        const parsed = parseDmm(source.value);

        if (!parsed) {
            return;
        }

        if (
            parsed.latitude < 0 ||
            parsed.latitude > 84 ||
            parsed.longitude < 6 ||
            parsed.longitude > 12
        ) {
            return;
        }

        const result = latLonToUtm32(
            parsed.latitude,
            parsed.longitude
        );

        if (
            !Number.isFinite(result.easting) ||
            !Number.isFinite(result.northing)
        ) {
            return;
        }

        setGeneratedCoordinate(
            $("#utmPosition"),
            formatUtmInput(
                result.easting,
                result.northing
            ),
            sourceId
        );
    }
}

/* POSISJON I RAPPORTEN */

function dmmToReportText(value) {
    if (!value.trim()) {
        return "";
    }

    const parsed = parseDmm(value);

    if (!parsed) {
        return value;
    }

    const lat = splitDegrees(parsed.latitude);
    const lon = splitDegrees(parsed.longitude);

    return (
        `${lat.degrees} grader ${lat.minutes} ` +
        `${parsed.latitude >= 0 ? "nordlig" : "sørlig"}, ` +
        `${lon.degrees} grader ${lon.minutes} ` +
        `${parsed.longitude >= 0 ? "østlig" : "vestlig"}`
    );
}

function utmToReportText(value) {
    if (!value.trim()) {
        return "";
    }

    const parsed = parseUtm(value);

    if (!parsed) {
        return value;
    }

    return (
        `32 Ø ${formatUtmNumber(parsed.easting)}, ` +
        `N ${formatUtmNumber(parsed.northing)}`
    );
}

/* CREW-ROLLER */

function isPoliceHelicopter() {
    const registration = normaliseRegistration(
        $("#registration")?.value ?? ""
    );

    return /^LN-OR[ABC]$/.test(registration);
}

function updateCrewRoles() {
    const police = isPoliceHelicopter();

    const roles = [
        [
            "rescuer",
            police ? "PCM" : "HCM",
            police
                ? "Police Crew Member (PCM)"
                : "Helicopter Crew Member (HCM)"
        ],
        [
            "doctor",
            police ? "PCM" : "Lege",
            police ? "Police Crew Member (PCM)" : "Lege"
        ]
    ];

    for (const [prefix, label, explanation] of roles) {
        const element = $("#" + prefix + "Role");

        if (element) {
            element.textContent = label;
            element.title = explanation;
            element.setAttribute("aria-label", explanation);
        }

        $("#" + prefix + "Name")?.setAttribute(
            "aria-label",
            label + " navn"
        );

        $("#" + prefix + "Phone")?.setAttribute(
            "aria-label",
            label + " mobilnummer"
        );
    }

    const hcmIcon = $("#rescuerName")
        ?.closest(".person-row")
        ?.querySelector("img");

    const doctorIcon = $("#doctorName")
        ?.closest(".person-row")
        ?.querySelector("img");

    if (doctorIcon && hcmIcon) {
        doctorIcon.dataset.originalSrc ??=
            doctorIcon.getAttribute("src");

        doctorIcon.setAttribute(
            "src",
            police
                ? hcmIcon.getAttribute("src")
                : doctorIcon.dataset.originalSrc
        );
    }
}

/* NAVNEFELTER SOM VOKSER */

function resizeCrewNames() {
    $$(".crew-name").forEach((field) => {
        field.style.height = "auto";

        field.style.height =
            Math.max(36, field.scrollHeight + 2) + "px";
    });
}

/* RULLEINDIKATOR */

function motionBehavior() {
    return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches
        ? "auto"
        : "smooth";
}

function updateFormScrollHint() {
    const panel = $(".form-panel");
    const hint = $("#formScrollHint");

    if (!panel || !hint) {
        return;
    }

    hint.hidden =
        panel.scrollHeight -
        panel.clientHeight -
        panel.scrollTop < 12;
}

function initialiseFormEnhancements() {
    const panel = $(".form-panel");

    panel?.addEventListener(
        "scroll",
        updateFormScrollHint,
        { passive: true }
    );

    $("#formScrollHint")?.addEventListener("click", () => {
        panel?.scrollBy({
            top: panel.clientHeight * 0.7,
            behavior: motionBehavior()
        });
    });

    $(".criteria-chip[data-criterion='3']")?.setAttribute(
        "aria-controls",
        "observationWrapper"
    );

    window.addEventListener("resize", () => {
        resizeCrewNames();
        updateFormScrollHint();
    });

    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => {
            resizeCrewNames();
            updateFormScrollHint();
        });

        if (panel) {
            observer.observe(panel);
        }

        const form = $("#missingHelicopterForm");

        if (form) {
            observer.observe(form);
        }
    }
}

/* PERSONER I RAPPORTEN */

function personReportLine(role, name, phone) {
    const parts = [];

    if (name.trim()) {
        parts.push(name.trim());
    }

    if (phone.trim()) {
        parts.push(formatPhoneNumber(phone));
    }

    return `${role}: ${parts.join(" - ")}`;
}

/* GENERER RAPPORT */

function generateReport() {
    const value = (id) => $("#" + id)?.value.trim() ?? "";
    const separator = "----------------------------------------";

    const reportTime = (id) => {
        const raw = value(id);

        if (!raw) {
            return "";
        }

        return formatTime(raw) || "[kontroller klokkeslett]";
    };

    const police = isPoliceHelicopter();

    const lines = [
        "SAVNET HELIKOPTER",
        `TG: ${getTgValues().join(" // ")}`,
        separator,

        "SIST KJENTE POSISJON:",
        `UTM: ${utmToReportText(value("utmPosition"))}`,
        `Grader og desimalmin: ${dmmToReportText(value("dmmPosition"))}`,
        `Stedsnavn: ${value("placeName")}`,
        separator,

        `Ressurs ID: ${normaliseResourceId(value("resourceId"))}`,
        `Reg.nr: ${normaliseRegistration(value("registration"))}`,
        `Callsign (HD): ${value("callsign")}`,
        `POB: ${state.pob ?? ""}`,
        "---",

        `Fra: ${formatLocation(value("fromLocation"))}`,
        `Til: ${formatLocation(value("toLocation"))}`,
        `Planlagt flyrute: ${value("plannedRoute")}`,
        `Avgangstid: ${reportTime("departureTime")}`,
        `ETA landing: ${reportTime("etaTime")}`,
        separator,

        "UTLØSENDE KRITERIUM FOR SAVNET HELIKOPTER:",
        state.criterion ? CRITERIA[state.criterion] : "",
        `Observasjoner/meldinger: ${
            state.criterion === 3
                ? value("observations")
                : ""
        }`,
        separator,

        "NAVN OG TELEFON TIL PERSONER OM BORD:",

        personReportLine(
            "Pilot",
            value("pilotName"),
            value("pilotPhone")
        ),
        "-",

        personReportLine(
            police ? "PCM" : "HCM",
            value("rescuerName"),
            value("rescuerPhone")
        ),
        "-",

        personReportLine(
            police ? "PCM" : "Lege",
            value("doctorName"),
            value("doctorPhone")
        )
    ];

    $$(".trainee-row").forEach((row, index) => {
        const name =
            row.querySelector(".trainee-name")?.value.trim() ?? "";

        const phone =
            row.querySelector(".trainee-phone")?.value.trim() ?? "";

        if (!name && !phone) {
            return;
        }

        lines.push("-");
        lines.push(
            personReportLine(
                `PAX ${index + 1}`,
                name,
                phone
            )
        );
    });

    lines.push(separator);

    return lines.join("\n");
}

function updateReport() {
    validateTimes();
    updateCrewRoles();
    resizeCrewNames();
    updateFormScrollHint();

    const output = $("#reportOutput");

    if (output) {
        output.value = generateReport();
    }
}

/* KOPIER RAPPORT */

async function copyReport() {
    updateReport();

    const report = $("#reportOutput");

    if (!report) {
        return;
    }

    let copied = false;

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(report.value);
            copied = true;
        }
    } catch {
        copied = false;
    }

    if (!copied) {
        const previousFocus = document.activeElement;

        report.focus({ preventScroll: true });
        report.select();

        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        }

        if (previousFocus instanceof HTMLElement) {
            previousFocus.focus({ preventScroll: true });
        }
    }

    clearTimeout(copyTimer);

    const button = $("#copyButton");
    const text = $("#copyButtonText");

    if (text) {
        text.textContent = copied
            ? "Tekst kopiert"
            : "Kopiering mislyktes";
    }

    if (button) {
        button.classList.remove("copy-flash");
        void button.offsetWidth;

        if (copied) {
            button.classList.add("copy-flash");
        }

        button.title = copied
            ? ""
            : "Marker og kopier rapportteksten manuelt.";
    }

    copyTimer = setTimeout(clearCopyConfirmation, 5000);
}

function clearCopyConfirmation() {
    clearTimeout(copyTimer);

    const text = $("#copyButtonText");

    if (text) {
        text.textContent = "Kopier tekst";
    }

    $("#copyButton")?.classList.remove("copy-flash");
}

/* OPPRETT E-POST */

function createEmail() {
    updateReport();

    const report = $("#reportOutput")?.value ?? "";
    const subject = encodeURIComponent("Savnet helikopter");
    const body = encodeURIComponent(report);

    window.location.href =
        `mailto:?subject=${subject}&body=${body}`;
}

/* TØM SKJEMA */

function resetForm() {
    $$(".form-panel input, .form-panel textarea").forEach(
        (field) => {
            field.value = "";

            delete field.dataset.generatedCoordinate;
            delete field.dataset.coordinateSource;

            field.removeAttribute("aria-invalid");
            field.setCustomValidity("");
        }
    );

    state.pob = null;
    state.criterion = null;

    updatePobButtons();
    updateCriteriaButtons();
    updateObservationField();

    const tgContainer = $("#otherTgContainer");

    if (tgContainer) {
        const input = createTgInput();
        input.id = "otherTgFirst";

        tgContainer.replaceChildren(input);
    }

    const paxContainer = $("#traineeContainer");

    if (paxContainer) {
        paxContainer.replaceChildren(createPaxRow());
    }

    renumberPax();
    clearCoordinateError();
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