"use strict";


/* =========================================================
   DOM-HJELPERE
========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


/* =========================================================
   STATE
========================================================= */

const state = {
    pob: null,
    criterion: null
};


/* =========================================================
   KRITERIETEKSTER
========================================================= */

const CRITERIA = {
    1: "Helikopteret svarer ikke på anrop eller planlagt rapportering i henhold til flight following, og vises som rød både på Locus og Nødnett.",

    2: "Helikopteret har ikke meldt landing innen 10 minutter etter oppgitt ETA, og det foreligger samtidig manglende kontakt eller andre indikasjoner på avvik.",

    3: "Observasjoner/meldinger som gir grunn til å mistenke/bekrefte havari."
};


/* =========================================================
   START
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initialiseForm();

});


function initialiseForm() {

    bindGeneralInputs();

    bindPobChips();

    bindCriteria();

    bindCoordinateFields();

    bindTimeFields();

    bindPhoneFields();

    bindCopyButton();

    bindResetButton();

    bindDynamicTg();

    bindDynamicTrainees();

    updateReport();

}


/* =========================================================
   GENERELLE INPUT
========================================================= */

function bindGeneralInputs() {

    $$("input, textarea").forEach((element) => {

        element.addEventListener("input", () => {

            updateReport();

        });

    });

}


/* =========================================================
   POB
========================================================= */

function bindPobChips() {

    $$("#pobChips .chip").forEach((button) => {

        button.addEventListener("click", () => {

            const selectedValue = Number(button.dataset.pob);

            if (state.pob === selectedValue) {

                state.pob = null;

                button.classList.remove("is-selected");

            } else {

                state.pob = selectedValue;

                $$("#pobChips .chip").forEach((chip) => {
                    chip.classList.remove("is-selected");
                });

                button.classList.add("is-selected");

            }

            updateReport();

        });

    });

}


/* =========================================================
   KRITERIUM
========================================================= */

function bindCriteria() {

    $$(".criteria-chip").forEach((button) => {

        button.addEventListener("click", () => {

            const criterion = Number(button.dataset.criterion);

            if (state.criterion === criterion) {

                state.criterion = null;

                button.classList.remove("is-selected");

            } else {

                state.criterion = criterion;

                $$(".criteria-chip").forEach((chip) => {
                    chip.classList.remove("is-selected");
                });

                button.classList.add("is-selected");

            }

            updateObservationVisibility();

            updateReport();

        });

    });

}


function updateObservationVisibility() {

    const wrapper = $("#observationWrapper");

    if (state.criterion === 3) {

        wrapper.classList.remove("hidden");

    } else {

        wrapper.classList.add("hidden");

    }

}


/* =========================================================
   DYNAMISK ANNEN TG
========================================================= */

function bindDynamicTg() {

    $("#otherTgContainer").addEventListener("input", () => {

        maintainDynamicTgFields();

        updateReport();

    });

}


function maintainDynamicTgFields() {

    const container = $("#otherTgContainer");

    let inputs = [...container.querySelectorAll(".other-tg-input")];

    /*
        Hvis siste felt har innhold,
        opprett ett nytt tomt felt.
    */

    const lastInput = inputs[inputs.length - 1];

    if (lastInput && lastInput.value.trim() !== "") {

        const input = document.createElement("input");

        input.type = "text";
        input.className = "other-tg-input";
        input.autocomplete = "off";

        container.appendChild(input);

        inputs = [...container.querySelectorAll(".other-tg-input")];

    }


    /*
        Fjern tomme felt i midten/slutten,
        men behold alltid ett tomt felt.
    */

    for (let i = inputs.length - 2; i >= 0; i--) {

        const current = inputs[i];
        const next = inputs[i + 1];

        if (
            current.value.trim() === "" &&
            next &&
            next.value.trim() === ""
        ) {

            current.remove();

        }

    }

}


/* =========================================================
   DYNAMISKE HOSPITANTER
========================================================= */

function bindDynamicTrainees() {

    $("#traineeContainer").addEventListener("input", () => {

        maintainTraineeRows();

        bindPhoneFields();

        updateReport();

    });

}


function createTraineeRow() {

    const row = document.createElement("div");

    row.className = "person-row trainee-row";

    row.innerHTML = `
        <div class="person-role">
            Hospitant
        </div>

        <input
            type="text"
            class="trainee-name"
            aria-label="Hospitant fullt navn"
            autocomplete="off"
        >

        <input
            type="tel"
            class="trainee-phone"
            aria-label="Hospitant mobilnummer"
            placeholder="Mobilnummer"
            autocomplete="off"
        >
    `;

    return row;

}


function maintainTraineeRows() {

    const container = $("#traineeContainer");

    let rows = [...container.querySelectorAll(".trainee-row")];

    const lastRow = rows[rows.length - 1];

    if (lastRow && traineeRowHasContent(lastRow)) {

        container.appendChild(createTraineeRow());

        rows = [...container.querySelectorAll(".trainee-row")];

    }


    /*
        Fjern ekstra tomme hospitantlinjer.
        Vi beholder alltid én tom linje nederst.
    */

    for (let i = rows.length - 2; i >= 0; i--) {

        const current = rows[i];
        const next = rows[i + 1];

        if (
            !traineeRowHasContent(current) &&
            !traineeRowHasContent(next)
        ) {

            current.remove();

        }

    }

}


function traineeRowHasContent(row) {

    const name = row.querySelector(".trainee-name").value.trim();

    const phone = row.querySelector(".trainee-phone").value.trim();

    return name !== "" || phone !== "";

}


/* =========================================================
   TELEFON
========================================================= */

function bindPhoneFields() {

    $$('input[type="tel"]').forEach((input) => {

        if (input.dataset.phoneBound === "true") {
            return;
        }

        input.dataset.phoneBound = "true";

        input.addEventListener("blur", () => {

            if (!input.value.trim()) {
                return;
            }

            input.value = formatPhoneNumber(input.value);

            updateReport();

        });

    });

}


function formatPhoneNumber(value) {

    let digits = value.replace(/\D/g, "");


    /*
        Fjern norsk landskode hvis den er limt inn.
    */

    if (
        digits.startsWith("0047") &&
        digits.length === 12
    ) {

        digits = digits.slice(4);

    }


    if (
        digits.startsWith("47") &&
        digits.length === 10
    ) {

        digits = digits.slice(2);

    }


    /*
        Norsk 8-sifret nummer:
        XXX XX XXX
    */

    if (digits.length === 8) {

        return (
            digits.slice(0, 3) +
            " " +
            digits.slice(3, 5) +
            " " +
            digits.slice(5)
        );

    }


    /*
        Dersom nummeret ikke er åtte sifre,
        ikke gjett.
    */

    return value.trim();

}


/* =========================================================
   TID
========================================================= */

function bindTimeFields() {

    const departure = $("#departureTime");
    const eta = $("#etaTime");


    departure.addEventListener("blur", () => {

        const formatted = formatTime(departure.value);

        if (formatted) {
            departure.value = formatted;
        }

        updateReport();

    });


    eta.addEventListener("blur", () => {

        const formatted = formatTime(eta.value);

        if (formatted) {
            eta.value = formatted;
        }

        updateReport();

    });

}


function formatTime(value) {

    if (!value) {
        return "";
    }


    let cleaned = value.trim();


    /*
        Eksempel:
        23:50:49 -> 23:50
    */

    const colonMatch = cleaned.match(
        /^(\d{1,2}):(\d{2})(?::\d{2})?/
    );

    if (colonMatch) {

        const hour = Number(colonMatch[1]);
        const minute = Number(colonMatch[2]);

        if (
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ) {

            return (
                String(hour).padStart(2, "0") +
                ":" +
                String(minute).padStart(2, "0")
            );

        }

    }


    /*
        Fjern alt annet enn tall.
    */

    const digits = cleaned.replace(/\D/g, "");


    /*
        2350 -> 23:50
    */

    if (digits.length === 4) {

        const hour = Number(digits.slice(0, 2));
        const minute = Number(digits.slice(2));

        if (
            hour >= 0 &&
            hour <= 23 &&
            minute >= 0 &&
            minute <= 59
        ) {

            return (
                digits.slice(0, 2) +
                ":" +
                digits.slice(2)
            );

        }

    }


    /*
        950 -> 09:50
    */

    if (digits.length === 3) {

        const hour = Number(digits.slice(0, 1));
        const minute = Number(digits.slice(1));

        if (
            hour >= 0 &&
            hour <= 9 &&
            minute >= 0 &&
            minute <= 59
        ) {

            return (
                "0" +
                digits.slice(0, 1) +
                ":" +
                digits.slice(1)
            );

        }

    }


    return "";

}


/* =========================================================
   RESSURS ID
========================================================= */

function normaliseResourceId(value) {

    if (!value) {
        return "";
    }

    const text = value
        .trim()
        .toUpperCase();


    const match = text.match(
        /(\d+)\s*-\s*(\d+)/
    );


    if (match) {

        return `LA ${match[1]}-${match[2]}`;

    }


    return text;

}


/* =========================================================
   REGISTRERING
========================================================= */

function normaliseRegistration(value) {

    if (!value) {
        return "";
    }


    let text = value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");


    /*
        LNABC -> LN-ABC
    */

    if (/^LN[A-Z]{3}$/.test(text)) {

        return "LN-" + text.slice(2);

    }


    /*
        ABC -> LN-ABC
    */

    if (/^[A-Z]{3}$/.test(text)) {

        return "LN-" + text;

    }


    /*
        Dersom brukeren allerede har skrevet
        en full registrering med bindestrek,
        behold denne.
    */

    return text;

}


/* =========================================================
   KOORDINATER
========================================================= */

function bindCoordinateFields() {

    const utmInput = $("#utmPosition");
    const dmmInput = $("#dmmPosition");


    utmInput.addEventListener("blur", () => {

        convertFromUtm();

    });


    dmmInput.addEventListener("blur", () => {

        convertFromDmm();

    });


    utmInput.addEventListener("paste", () => {

        setTimeout(() => {
            convertFromUtm();
        }, 0);

    });


    dmmInput.addEventListener("paste", () => {

        setTimeout(() => {
            convertFromDmm();
        }, 0);

    });

}


function convertFromUtm() {

    const parsed = parseUtm($("#utmPosition").value);

    if (!parsed) {

        updateReport();

        return;

    }


    const latLon = utm32ToLatLon(
        parsed.easting,
        parsed.northing
    );


    $("#dmmPosition").value =
        decimalDegreesToDmm(
            latLon.latitude,
            latLon.longitude
        );


    updateReport();

}


function convertFromDmm() {

    const parsed = parseDmm($("#dmmPosition").value);

    if (!parsed) {

        updateReport();

        return;

    }


    const utm = latLonToUtm32(
        parsed.latitude,
        parsed.longitude
    );


    $("#utmPosition").value =
        formatUtmInput(
            utm.easting,
            utm.northing
        );


    updateReport();

}


/* =========================================================
   PARSE UTM
========================================================= */

function parseUtm(value) {

    if (!value) {
        return null;
    }


    const text = value
        .toUpperCase()
        .replace(/EASTING/g, "E")
        .replace(/NORTHING/g, "N");


    /*
        Eksempel:
        Ø 5 951 53, N 66 455 37 UTM32N
    */

    const labelledMatch = text.match(
        /[ØE]\s*([\d\s]+?)[,\s]+N\s*([\d\s]+)(?:\D|$)/
    );


    if (labelledMatch) {

        const easting =
            Number(labelledMatch[1].replace(/\s/g, ""));

        const northing =
            Number(labelledMatch[2].replace(/\s/g, ""));


        if (isValidUtm(easting, northing)) {

            return {
                easting,
                northing
            };

        }

    }


    /*
        Fallback:
        finn grupper som ser ut som UTM-koordinater.
    */

    const numberGroups =
        text.match(/\d[\d\s]*\d/g) || [];


    const values = numberGroups
        .map((group) =>
            Number(group.replace(/\s/g, ""))
        )
        .filter((number) =>
            Number.isFinite(number)
        );


    const easting =
        values.find(
            (number) =>
                number >= 100000 &&
                number <= 900000
        );


    const northing =
        values.find(
            (number) =>
                number >= 1000000 &&
                number <= 10000000
        );


    if (
        easting !== undefined &&
        northing !== undefined
    ) {

        return {
            easting,
            northing
        };

    }


    return null;

}


function isValidUtm(easting, northing) {

    return (
        Number.isFinite(easting) &&
        Number.isFinite(northing) &&
        easting >= 100000 &&
        easting <= 900000 &&
        northing >= 0 &&
        northing <= 10000000
    );

}


/* =========================================================
   PARSE GRADER + DESIMALMINUTTER
========================================================= */

function parseDmm(value) {

    if (!value) {
        return null;
    }


    const text = value
        .trim()
        .toUpperCase()
        .replace(/,/g, ".");


    /*
        Eksempel:
        59° 56.176' N 10° 42.167' Ø
    */

    const regex =
        /(\d{1,2})\s*[°º]?\s*(\d{1,2}(?:\.\d+)?)\s*['’′]?\s*([NS])\s*[,\s;]*\s*(\d{1,3})\s*[°º]?\s*(\d{1,2}(?:\.\d+)?)\s*['’′]?\s*([EØWV])/i;


    const match = text.match(regex);


    if (!match) {
        return null;
    }


    const latDegrees = Number(match[1]);
    const latMinutes = Number(match[2]);

    const latDirection = match[3];


    const lonDegrees = Number(match[4]);
    const lonMinutes = Number(match[5]);

    const lonDirection = match[6];


    let latitude =
        latDegrees +
        latMinutes / 60;


    let longitude =
        lonDegrees +
        lonMinutes / 60;


    if (latDirection === "S") {

        latitude *= -1;

    }


    if (
        lonDirection === "W" ||
        lonDirection === "V"
    ) {

        longitude *= -1;

    }


    return {
        latitude,
        longitude
    };

}


/* =========================================================
   DESIMALGRADER -> DMM
========================================================= */

function decimalDegreesToDmm(latitude, longitude) {

    const latDirection =
        latitude >= 0 ? "N" : "S";

    const lonDirection =
        longitude >= 0 ? "Ø" : "V";


    const latAbsolute = Math.abs(latitude);
    const lonAbsolute = Math.abs(longitude);


    const latDegrees =
        Math.floor(latAbsolute);

    const lonDegrees =
        Math.floor(lonAbsolute);


    const latMinutes =
        (latAbsolute - latDegrees) * 60;

    const lonMinutes =
        (lonAbsolute - lonDegrees) * 60;


    return (
        `${latDegrees}° ${latMinutes.toFixed(3)}' ${latDirection} ` +
        `${lonDegrees}° ${lonMinutes.toFixed(3)}' ${lonDirection}`
    );

}


/* =========================================================
   DMM TIL RAPPORTFORMAT
========================================================= */

function dmmToReportText(value) {

    const parsed = parseDmm(value);

    if (!parsed) {

        return value.trim();

    }


    const latitude = parsed.latitude;
    const longitude = parsed.longitude;


    const latAbs = Math.abs(latitude);
    const lonAbs = Math.abs(longitude);


    const latDegrees =
        Math.floor(latAbs);

    const lonDegrees =
        Math.floor(lonAbs);


    const latMinutes =
        (latAbs - latDegrees) * 60;

    const lonMinutes =
        (lonAbs - lonDegrees) * 60;


    const latDirection =
        latitude >= 0
            ? "nordlig"
            : "sørlig";


    const lonDirection =
        longitude >= 0
            ? "østlig"
            : "vestlig";


    return (
        `${latDegrees} grader ${latMinutes.toFixed(3)} ${latDirection}, ` +
        `${lonDegrees} grader ${lonMinutes.toFixed(3)} ${lonDirection}`
    );

}


/* =========================================================
   UTM-FORMATERING
========================================================= */

function formatUtmNumber(number) {

    const digits =
        String(Math.round(number));


    /*
        Eksempler:

        595153
        -> 5 951 53

        6645537
        -> 66 455 37
    */

    if (digits.length > 5) {

        const first =
            digits.slice(0, -5);

        const middle =
            digits.slice(-5, -2);

        const last =
            digits.slice(-2);


        return `${first} ${middle} ${last}`;

    }


    return digits;

}


function formatUtmInput(easting, northing) {

    return (
        `Ø ${formatUtmNumber(easting)}, ` +
        `N ${formatUtmNumber(northing)} UTM32N`
    );

}


function utmToReportText(value) {

    const parsed = parseUtm(value);

    if (!parsed) {

        return value.trim();

    }


    return (
        `UTM 32 Ø ${formatUtmNumber(parsed.easting)}, ` +
        `N ${formatUtmNumber(parsed.northing)}`
    );

}


/* =========================================================
   UTM32N -> WGS84
========================================================= */

function utm32ToLatLon(easting, northing) {

    const a = 6378137.0;

    const eccSquared = 0.00669438;

    const k0 = 0.9996;


    const x =
        easting - 500000.0;

    const y =
        northing;


    const longOrigin = 9.0;


    const eccPrimeSquared =
        eccSquared /
        (1 - eccSquared);


    const M =
        y / k0;


    const mu =
        M /
        (
            a *
            (
                1 -
                eccSquared / 4 -
                3 *
                    eccSquared *
                    eccSquared /
                    64 -
                5 *
                    eccSquared *
                    eccSquared *
                    eccSquared /
                    256
            )
        );


    const e1 =
        (1 - Math.sqrt(1 - eccSquared)) /
        (1 + Math.sqrt(1 - eccSquared));


    const phi1Rad =
        mu +
        (
            3 * e1 / 2 -
            27 * Math.pow(e1, 3) / 32
        ) *
            Math.sin(2 * mu) +
        (
            21 * Math.pow(e1, 2) / 16 -
            55 * Math.pow(e1, 4) / 32
        ) *
            Math.sin(4 * mu) +
        (
            151 * Math.pow(e1, 3) / 96
        ) *
            Math.sin(6 * mu) +
        (
            1097 * Math.pow(e1, 4) / 512
        ) *
            Math.sin(8 * mu);


    const N1 =
        a /
        Math.sqrt(
            1 -
            eccSquared *
                Math.pow(
                    Math.sin(phi1Rad),
                    2
                )
        );


    const T1 =
        Math.pow(
            Math.tan(phi1Rad),
            2
        );


    const C1 =
        eccPrimeSquared *
        Math.pow(
            Math.cos(phi1Rad),
            2
        );


    const R1 =
        a *
        (1 - eccSquared) /
        Math.pow(
            1 -
                eccSquared *
                    Math.pow(
                        Math.sin(phi1Rad),
                        2
                    ),
            1.5
        );


    const D =
        x /
        (N1 * k0);


    let latitude =
        phi1Rad -
        (
            N1 *
            Math.tan(phi1Rad) /
            R1
        ) *
        (
            Math.pow(D, 2) / 2 -

            (
                5 +
                3 * T1 +
                10 * C1 -
                4 * Math.pow(C1, 2) -
                9 * eccPrimeSquared
            ) *
            Math.pow(D, 4) /
            24 +

            (
                61 +
                90 * T1 +
                298 * C1 +
                45 * Math.pow(T1, 2) -
                252 * eccPrimeSquared -
                3 * Math.pow(C1, 2)
            ) *
            Math.pow(D, 6) /
            720
        );


    latitude =
        latitude *
        180 /
        Math.PI;


    let longitude =
        (
            D -

            (
                1 +
                2 * T1 +
                C1
            ) *
            Math.pow(D, 3) /
            6 +

            (
                5 -
                2 * C1 +
                28 * T1 -
                3 * Math.pow(C1, 2) +
                8 * eccPrimeSquared +
                24 * Math.pow(T1, 2)
            ) *
            Math.pow(D, 5) /
            120
        ) /
        Math.cos(phi1Rad);


    longitude =
        longOrigin +
        longitude *
        180 /
        Math.PI;


    return {
        latitude,
        longitude
    };

}


/* =========================================================
   WGS84 -> UTM32N
========================================================= */

function latLonToUtm32(latitude, longitude) {

    const a = 6378137.0;

    const eccSquared = 0.00669438;

    const k0 = 0.9996;


    const longOrigin = 9.0;


    const latRad =
        latitude * Math.PI / 180;

    const lonRad =
        longitude * Math.PI / 180;

    const longOriginRad =
        longOrigin * Math.PI / 180;


    const eccPrimeSquared =
        eccSquared /
        (1 - eccSquared);


    const N =
        a /
        Math.sqrt(
            1 -
            eccSquared *
                Math.pow(
                    Math.sin(latRad),
                    2
                )
        );


    const T =
        Math.pow(
            Math.tan(latRad),
            2
        );


    const C =
        eccPrimeSquared *
        Math.pow(
            Math.cos(latRad),
            2
        );


    const A =
        Math.cos(latRad) *
        (lonRad - longOriginRad);


    const M =
        a *
        (
            (
                1 -
                eccSquared / 4 -
                3 * Math.pow(eccSquared, 2) / 64 -
                5 * Math.pow(eccSquared, 3) / 256
            ) *
            latRad

            -

            (
                3 * eccSquared / 8 +
                3 * Math.pow(eccSquared, 2) / 32 +
                45 * Math.pow(eccSquared, 3) / 1024
            ) *
            Math.sin(2 * latRad)

            +

            (
                15 * Math.pow(eccSquared, 2) / 256 +
                45 * Math.pow(eccSquared, 3) / 1024
            ) *
            Math.sin(4 * latRad)

            -

            (
                35 * Math.pow(eccSquared, 3) / 3072
            ) *
            Math.sin(6 * latRad)
        );


    const easting =
        k0 *
        N *
        (
            A +

            (
                1 -
                T +
                C
            ) *
            Math.pow(A, 3) /
            6 +

            (
                5 -
                18 * T +
                Math.pow(T, 2) +
                72 * C -
                58 * eccPrimeSquared
            ) *
            Math.pow(A, 5) /
            120
        ) +
        500000.0;


    let northing =
        k0 *
        (
            M +

            N *
            Math.tan(latRad) *
            (
                Math.pow(A, 2) / 2 +

                (
                    5 -
                    T +
                    9 * C +
                    4 * Math.pow(C, 2)
                ) *
                Math.pow(A, 4) /
                24 +

                (
                    61 -
                    58 * T +
                    Math.pow(T, 2) +
                    600 * C -
                    330 * eccPrimeSquared
                ) *
                Math.pow(A, 6) /
                720
            )
        );


    if (latitude < 0) {

        northing += 10000000.0;

    }


    return {
        easting: Math.round(easting),
        northing: Math.round(northing)
    };

}


/* =========================================================
   RAPPORT
========================================================= */

function updateReport() {

    $("#reportOutput").value =
        generateReport();

}


function generateReport() {

    const lines = [];


    /*
        TG
    */

    const tgValues = getTgValues();


    lines.push("SAVNET HELIKOPTER");

    lines.push(
        tgValues.length
            ? `TG: ${tgValues.join(" // ")}`
            : "TG:"
    );


    lines.push(
        "----------------------------------------"
    );


    /*
        POSISJON
    */

    lines.push("SIST KJENTE POSISJON:");


    const utm =
        $("#utmPosition").value.trim();

    const dmm =
        $("#dmmPosition").value.trim();

    const place =
        $("#placeName").value.trim();


    if (utm) {

        lines.push(
            utmToReportText(utm)
        );

    }


    if (dmm) {

        lines.push(
            dmmToReportText(dmm)
        );

    }


    if (place) {

        lines.push(
            `Stedsnavn: ${place}`
        );

    }


    lines.push(
        "----------------------------------------"
    );


    /*
        LUFTFARTØY
    */

    const resourceId =
        normaliseResourceId(
            $("#resourceId").value
        );


    const registration =
        normaliseRegistration(
            $("#registration").value
        );


    const callsign =
        $("#callsign").value.trim();


    if (resourceId) {

        lines.push(
            `Ressurs ID: ${resourceId}`
        );

    }


    if (registration) {

        lines.push(
            `Reg.nr: ${registration}`
        );

    }


    if (callsign) {

        lines.push(
            `Callsign (HD): ${callsign}`
        );

    }


    if (state.pob !== null) {

        lines.push(
            `POB: ${state.pob}`
        );

    }


    lines.push("---");


    /*
        FLYRUTE
    */

    const from =
        $("#fromLocation").value.trim();

    const to =
        $("#toLocation").value.trim();

    const route =
        $("#plannedRoute").value.trim();


    const departure =
        formatTime(
            $("#departureTime").value
        );


    const eta =
        formatTime(
            $("#etaTime").value
        );


    if (from) {

        lines.push(
            `Fra: ${from}`
        );

    }


    if (to) {

        lines.push(
            `Til: ${to}`
        );

    }


    if (route) {

        lines.push(
            `Planlagt flyrute: ${route}`
        );

    }


    if (departure) {

        lines.push(
            `Avgangstid: ${departure}`
        );

    }


    if (eta) {

        lines.push(
            `ETA landing: ${eta}`
        );

    }


    lines.push(
        "----------------------------------------"
    );


    /*
        KRITERIUM
    */

    lines.push(
        "UTLØSENDE KRITERIUM FOR SAVNET HELIKOPTER:"
    );


    if (state.criterion) {

        lines.push(
            CRITERIA[state.criterion]
        );

    }


    if (
        state.criterion === 3 &&
        $("#observations").value.trim()
    ) {

        lines.push(
            $("#observations").value.trim()
        );

    }


    lines.push(
        "----------------------------------------"
    );


    /*
        PERSONER
    */

    lines.push(
        "NAVN OG TELEFON TIL PERSONER OM BORD:"
    );


    addPersonToReport(
        lines,
        "Pilot",
        $("#pilotName").value,
        $("#pilotPhone").value
    );


    addPersonToReport(
        lines,
        "Redningsmann",
        $("#rescuerName").value,
        $("#rescuerPhone").value
    );


    addPersonToReport(
        lines,
        "Lege",
        $("#doctorName").value,
        $("#doctorPhone").value
    );


    $$(".trainee-row").forEach((row) => {

        const name =
            row
                .querySelector(".trainee-name")
                .value;


        const phone =
            row
                .querySelector(".trainee-phone")
                .value;


        addPersonToReport(
            lines,
            "Hospitant",
            name,
            phone
        );

    });


    return lines.join("\n");

}


/* =========================================================
   TG
========================================================= */

function getTgValues() {

    const values = [];


    const health =
        $("#healthTg").value.trim();

    const sar =
        $("#sarTg").value.trim();


    if (health) {
        values.push(health);
    }


    if (sar) {
        values.push(sar);
    }


    $$(".other-tg-input").forEach((input) => {

        const value =
            input.value.trim();

        if (value) {
            values.push(value);
        }

    });


    return values;

}


/* =========================================================
   PERSON TIL RAPPORT
========================================================= */

function addPersonToReport(
    lines,
    role,
    name,
    phone
) {

    const cleanName =
        name.trim();

    const cleanPhone =
        formatPhoneNumber(phone);


    if (
        !cleanName &&
        !cleanPhone
    ) {

        return;

    }


    if (
        cleanName &&
        cleanPhone
    ) {

        lines.push(
            `${role}: ${cleanName} - ${cleanPhone}`
        );

        return;

    }


    if (cleanName) {

        lines.push(
            `${role}: ${cleanName}`
        );

        return;

    }


    lines.push(
        `${role}: ${cleanPhone}`
    );

}


/* =========================================================
   KOPIER
========================================================= */

function bindCopyButton() {

    $("#copyButton").addEventListener(
        "click",
        async () => {

            const text =
                $("#reportOutput").value;


            try {

                await navigator.clipboard.writeText(
                    text
                );

                showCopyConfirmation();

            } catch (error) {

                fallbackCopy(text);

            }

        }
    );

}


function fallbackCopy(text) {

    const textarea =
        $("#reportOutput");


    textarea.focus();

    textarea.select();


    try {

        document.execCommand("copy");

        showCopyConfirmation();

    } catch (error) {

        console.error(
            "Kopiering mislyktes:",
            error
        );

    }


    window.getSelection()?.removeAllRanges();

}


function showCopyConfirmation() {

    const confirmation =
        $("#copyConfirmation");


    confirmation.textContent =
        "Tekst kopiert";


    clearTimeout(
        showCopyConfirmation.timer
    );


    showCopyConfirmation.timer =
        setTimeout(() => {

            confirmation.textContent = "";

        }, 2500);

}


/* =========================================================
   NULLSTILL
========================================================= */

function bindResetButton() {

    $("#resetButton").addEventListener(
        "click",
        () => {

            resetForm();

        }
    );

}


function resetForm() {

    /*
        Nullstill standard input.
    */

    $$(
        '.form-panel input[type="text"], ' +
        '.form-panel input[type="tel"], ' +
        ".form-panel textarea"
    ).forEach((element) => {

        element.value = "";

    });


    /*
        Nullstill state.
    */

    state.pob = null;
    state.criterion = null;


    /*
        Nullstill chips.
    */

    $$(".chip").forEach((button) => {

        button.classList.remove(
            "is-selected"
        );

    });


    $$(".criteria-chip").forEach(
        (button) => {

            button.classList.remove(
                "is-selected"
            );

        }
    );


    /*
        Skjul kriterium 3-felt.
    */

    $("#observationWrapper")
        .classList
        .add("hidden");


    /*
        Nullstill annen TG.
    */

    $("#otherTgContainer").innerHTML = `
        <input
            type="text"
            class="other-tg-input"
            autocomplete="off"
        >
    `;


    /*
        Nullstill hospitant.
    */

    $("#traineeContainer").innerHTML = `
        <div class="person-row trainee-row">

            <div class="person-role">
                Hospitant
            </div>

            <input
                type="text"
                class="trainee-name"
                aria-label="Hospitant fullt navn"
                autocomplete="off"
            >

            <input
                type="tel"
                class="trainee-phone"
                aria-label="Hospitant mobilnummer"
                placeholder="Mobilnummer"
                autocomplete="off"
            >

        </div>
    `;


    /*
        Bind dynamiske telefonfelt igjen.
    */

    bindPhoneFields();


    /*
        Fjern kopibekreftelse.
    */

    $("#copyConfirmation").textContent = "";


    updateReport();


    /*
        Tilbake til toppen.
    */

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}
