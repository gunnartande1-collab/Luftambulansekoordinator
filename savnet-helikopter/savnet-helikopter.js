"use strict";


const $ = (selector) =>
    document.querySelector(selector);


const $$ = (selector) =>
    [...document.querySelectorAll(selector)];



/* =========================================================
   STATE
   ========================================================= */

const state = {
    pob: null,
    criterion: null
};


let copyTimer = null;



/* =========================================================
   UTLØSENDE KRITERIER
   ========================================================= */

const CRITERIA = {

    1:
        "Helikopteret svarer ikke på anrop eller planlagt rapportering i henhold til flight following, og vises som rød både på Locus og Nødnett.",

    2:
        "Helikopteret har ikke meldt landing innen 10 minutter etter oppgitt ETA, og det foreligger samtidig manglende kontakt eller andre indikasjoner på avvik.",

    3:
        "Observasjoner/meldinger som gir grunn til å mistenke/bekrefte havari."

};



/* =========================================================
   ICAO / LOKASJONER
   ========================================================= */

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



/* =========================================================
   OPPSTART
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialiseForm
);



function initialiseForm() {

    const formPanel =
        $(".form-panel");


    if (!formPanel) {
        return;
    }


    formPanel.addEventListener(
        "input",
        handleInput
    );


    formPanel.addEventListener(
        "focusout",
        handleFocusOut
    );


    initialisePob();

    initialiseCriteria();


    $("#copyButton")
        ?.addEventListener(
            "click",
            copyReport
        );


    $("#resetButton")
        ?.addEventListener(
            "click",
            resetForm
        );


    $("#emailReportButton")
        ?.addEventListener(
            "click",
            createEmail
        );


    renumberPax();

    updateReport();

}



/* =========================================================
   POB
   ========================================================= */

function initialisePob() {

    $$("#pobChips .chip")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        Number(
                            button.dataset.pob
                        );


                    if (
                        state.pob === number
                    ) {

                        state.pob = null;

                    }
                    else {

                        state.pob = number;

                    }


                    updatePobButtons();

                    clearCopyConfirmation();

                    updateReport();

                }
            );

        });

}



function updatePobButtons() {

    $$("#pobChips .chip")
        .forEach((button) => {

            const number =
                Number(
                    button.dataset.pob
                );


            const selected =
                number === state.pob;


            button.classList.toggle(
                "is-selected",
                selected
            );


            button.setAttribute(
                "aria-pressed",
                String(selected)
            );

        });

}



/* =========================================================
   KRITERIER
   ========================================================= */

function initialiseCriteria() {

    $$(".criteria-chip")
        .forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        Number(
                            button.dataset.criterion
                        );


                    if (
                        state.criterion === number
                    ) {

                        state.criterion = null;

                    }
                    else {

                        state.criterion = number;

                    }


                    updateCriteriaButtons();

                    updateObservationField();

                    clearCopyConfirmation();

                    updateReport();

                }
            );

        });

}



function updateCriteriaButtons() {

    $$(".criteria-chip")
        .forEach((button) => {

            const number =
                Number(
                    button.dataset.criterion
                );


            const selected =
                number === state.criterion;


            button.classList.toggle(
                "is-selected",
                selected
            );


            button.setAttribute(
                "aria-pressed",
                String(selected)
            );

        });

}



function updateObservationField() {

    const wrapper =
        $("#observationWrapper");


    if (!wrapper) {
        return;
    }


    wrapper.classList.toggle(
        "hidden",
        state.criterion !== 3
    );

}



/* =========================================================
   INPUT
   ========================================================= */

function handleInput(event) {

    const target =
        event.target;


    if (
        !(
            target instanceof HTMLInputElement
        )
        &&
        !(
            target instanceof HTMLTextAreaElement
        )
    ) {

        return;

    }


    clearCopyConfirmation();


    if (
        target.classList.contains(
            "other-tg-input"
        )
    ) {

        maintainDynamicTgFields();

    }


    if (
        target.classList.contains(
            "trainee-name"
        )
        ||
        target.classList.contains(
            "trainee-phone"
        )
    ) {

        maintainPaxRows();

    }


    updateReport();

}



/* =========================================================
   FOCUS OUT
   ========================================================= */

function handleFocusOut(event) {

    const target =
        event.target;


    if (
        !(
            target instanceof HTMLInputElement
        )
    ) {

        return;

    }


    if (
        target.type === "tel"
    ) {

        target.value =
            formatPhoneNumber(
                target.value
            );

    }


    if (
        target.id === "departureTime"
        ||
        target.id === "etaTime"
    ) {

        const formatted =
            formatTime(
                target.value
            );


        if (formatted) {

            target.value =
                formatted;

        }

    }


    if (
        target.id === "resourceId"
    ) {

        target.value =
            normaliseResourceId(
                target.value
            );

    }


    if (
        target.id === "registration"
    ) {

        target.value =
            normaliseRegistration(
                target.value
            );

    }


    if (
        target.id === "utmPosition"
        ||
        target.id === "dmmPosition"
    ) {

        convertCoordinates(
            target.id,
            true
        );

    }


    updateReport();

}



/* =========================================================
   DYNAMISKE TALEGRUPPER
   ========================================================= */

function maintainDynamicTgFields() {

    const container =
        $("#otherTgContainer");


    if (!container) {
        return;
    }


    let inputs = [
        ...container.querySelectorAll(
            ".other-tg-input"
        )
    ];


    const last =
        inputs.at(-1);


    if (
        last
        &&
        last.value.trim()
    ) {

        const input =
            document.createElement(
                "input"
            );


        input.type = "text";

        input.className =
            "other-tg-input";

        input.placeholder =
            "Talegruppe";

        input.autocomplete =
            "off";

        input.setAttribute(
            "aria-label",
            "Annen talegruppe"
        );


        container.appendChild(
            input
        );

    }


    inputs = [
        ...container.querySelectorAll(
            ".other-tg-input"
        )
    ];


    for (
        let i =
            inputs.length - 2;
        i >= 0;
        i--
    ) {

        if (
            !inputs[i]
                .value
                .trim()
            &&
            !inputs[i + 1]
                .value
                .trim()
        ) {

            inputs[i].remove();

        }

    }

}



function getTgValues() {

    const values = [];


    const health =
        $("#healthTg")
            ?.value
            .trim();


    const sar =
        $("#sarTg")
            ?.value
            .trim();


    if (health) {
        values.push(health);
    }


    if (sar) {
        values.push(sar);
    }


    $$(".other-tg-input")
        .forEach((input) => {

            const value =
                input.value.trim();


            if (value) {

                values.push(value);

            }

        });


    return values;

}



/* =========================================================
   DYNAMISK PAX
   ========================================================= */

function createPaxRow() {

    const row =
        document.createElement(
            "div"
        );


    row.className =
        "person-row trainee-row";


    row.innerHTML = `

        <div class="person-role">

            <img
                src="../img/pax.svg"
                class="person-ikon"
                alt=""
                aria-hidden="true"
            >

            <span class="pax-label">
                PAX
            </span>

        </div>


        <input
            type="text"
            class="trainee-name"
            placeholder="Navn"
            autocomplete="off"
        >


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

    const name =
        row.querySelector(
            ".trainee-name"
        )
        ?.value
        .trim();


    const phone =
        row.querySelector(
            ".trainee-phone"
        )
        ?.value
        .trim();


    return Boolean(
        name || phone
    );

}



function maintainPaxRows() {

    const container =
        $("#traineeContainer");


    if (!container) {
        return;
    }


    let rows = [
        ...container.querySelectorAll(
            ".trainee-row"
        )
    ];


    const last =
        rows.at(-1);


    if (
        last
        &&
        paxRowHasContent(last)
    ) {

        container.appendChild(
            createPaxRow()
        );

    }


    rows = [
        ...container.querySelectorAll(
            ".trainee-row"
        )
    ];


    for (
        let i =
            rows.length - 2;
        i >= 0;
        i--
    ) {

        if (
            !paxRowHasContent(
                rows[i]
            )
            &&
            !paxRowHasContent(
                rows[i + 1]
            )
        ) {

            rows[i].remove();

        }

    }


    renumberPax();

}



function renumberPax() {

    $$(".trainee-row")
        .forEach(
            (row, index) => {

                const number =
                    index + 1;


                const label =
                    `PAX ${number}`;


                const labelElement =
                    row.querySelector(
                        ".pax-label"
                    );


                if (labelElement) {

                    labelElement.textContent =
                        label;

                }


                row.querySelector(
                    ".trainee-name"
                )
                ?.setAttribute(
                    "aria-label",
                    `${label} navn`
                );


                row.querySelector(
                    ".trainee-phone"
                )
                ?.setAttribute(
                    "aria-label",
                    `${label} mobilnummer`
                );

            }
        );

}



/* =========================================================
   TELEFON
   ========================================================= */

function formatPhoneNumber(value) {

    let digits =
        value.replace(
            /\D/g,
            ""
        );


    if (
        digits.startsWith("0047")
        &&
        digits.length === 12
    ) {

        digits =
            digits.slice(4);

    }


    if (
        digits.startsWith("47")
        &&
        digits.length === 10
    ) {

        digits =
            digits.slice(2);

    }


    if (
        digits.length === 8
    ) {

        return (
            digits.slice(0, 3)
            +
            " "
            +
            digits.slice(3, 5)
            +
            " "
            +
            digits.slice(5)
        );

    }


    return value.trim();

}



/* =========================================================
   KLOKKESLETT
   ========================================================= */

function formatTime(value) {

    const text =
        value.trim();


    if (!text) {
        return "";
    }


    let hour;
    let minute;


    const colon =
        text.match(
            /^(\d{1,2}):(\d{2})(?::\d{2})?$/
        );


    if (colon) {

        hour =
            Number(
                colon[1]
            );

        minute =
            Number(
                colon[2]
            );

    }
    else if (
        /^\d{3,4}$/
            .test(text)
    ) {

        const digits =
            text.padStart(
                4,
                "0"
            );


        hour =
            Number(
                digits.slice(
                    0,
                    2
                )
            );


        minute =
            Number(
                digits.slice(2)
            );

    }
    else {

        return "";

    }


    if (
        hour > 23
        ||
        minute > 59
    ) {

        return "";

    }


    return (
        String(hour)
            .padStart(2, "0")
        +
        ":"
        +
        String(minute)
            .padStart(2, "0")
    );

}



function validateTimes() {

    const ids = [
        "departureTime",
        "etaTime"
    ];


    const invalid =
        ids.some((id) => {

            const element =
                $("#" + id);


            if (!element) {
                return false;
            }


            const text =
                element
                    .value
                    .trim();


            return (
                text
                &&
                !formatTime(text)
            );

        });


    const error =
        $("#timeError");


    if (error) {

        error.textContent =
            invalid
                ? "Ugyldig klokkeslett. Bruk for eksempel 2350 eller 23:50."
                : "";

    }


    return !invalid;

}



/* =========================================================
   RESSURS-ID
   ========================================================= */

function normaliseResourceId(
    value
) {

    const text =
        value.trim();


    const match =
        text.match(
            /^(?:LA|LUFTAMBULANSE)?\s*(\d+)\s*-\s*(\d+)$/i
        );


    if (!match) {
        return text;
    }


    return (
        `LA ${match[1]}-${match[2]}`
    );

}



/* =========================================================
   REGISTRERING
   ========================================================= */

function normaliseRegistration(
    value
) {

    const text =
        value
            .trim()
            .toUpperCase()
            .replace(
                /\s+/g,
                ""
            );


    if (!text) {
        return "";
    }


    if (
        /^LN[A-Z]{3}$/
            .test(text)
    ) {

        return (
            "LN-"
            +
            text.slice(2)
        );

    }


    if (
        /^[A-Z]{3}$/
            .test(text)
    ) {

        return (
            "LN-"
            +
            text
        );

    }


    return text;

}



/* =========================================================
   LOKASJON
   ========================================================= */

function formatLocation(
    value
) {

    const text =
        value.trim();


    if (!text) {
        return "";
    }


    const code =
        text.toUpperCase();


    if (
        Object.prototype
            .hasOwnProperty
            .call(
                ICAO_LOCATIONS,
                code
            )
    ) {

        return (
            `${code} – ${ICAO_LOCATIONS[code]}`
        );

    }


    return text;

}



/* =========================================================
   POSISJON
   ========================================================= */

function parseUtm(value) {

    const text =
        value
            .trim()
            .toUpperCase();


    if (!text) {
        return null;
    }


    const match =
        text.match(
            /[ØE]\s*([\d\s]+?)\s*[,;]?\s*N\s*([\d\s]+)/
        );


    if (!match) {
        return null;
    }


    const easting =
        Number(
            match[1]
                .replace(
                    /\s/g,
                    ""
                )
        );


    const northing =
        Number(
            match[2]
                .replace(
                    /\s/g,
                    ""
                )
        );


    if (
        !Number.isFinite(easting)
        ||
        !Number.isFinite(northing)
    ) {

        return null;

    }


    if (
        easting < 100000
        ||
        easting > 900000
        ||
        northing < 0
        ||
        northing > 10000000
    ) {

        return null;

    }


    return {
        easting,
        northing
    };

}



function parseDmm(value) {

    const text =
        value
            .trim()
            .toUpperCase()
            .replace(
                /,/g,
                "."
            );


    const match =
        text.match(
            /^(\d{1,2})\s*[°º]\s*(\d{1,2}(?:\.\d+)?)\s*['’′]?\s*([NS])\s*[,;]?\s*(\d{1,3})\s*[°º]\s*(\d{1,2}(?:\.\d+)?)\s*['’′]?\s*([EØWV])$/
        );


    if (!match) {
        return null;
    }


    const latDegrees =
        Number(match[1]);


    const latMinutes =
        Number(match[2]);


    const lonDegrees =
        Number(match[4]);


    const lonMinutes =
        Number(match[5]);


    if (
        latDegrees > 90
        ||
        lonDegrees > 180
        ||
        latMinutes >= 60
        ||
        lonMinutes >= 60
    ) {

        return null;

    }


    let latitude =
        latDegrees
        +
        latMinutes / 60;


    let longitude =
        lonDegrees
        +
        lonMinutes / 60;


    if (
        match[3] === "S"
    ) {

        latitude *= -1;

    }


    if (
        match[6] === "W"
        ||
        match[6] === "V"
    ) {

        longitude *= -1;

    }


    return {
        latitude,
        longitude
    };

}



function splitDegrees(
    value
) {

    const absolute =
        Math.abs(value);


    let degrees =
        Math.floor(
            absolute
        );


    let minutes =
        (
            absolute
            -
            degrees
        )
        *
        60;


    minutes =
        Number(
            minutes.toFixed(3)
        );


    if (
        minutes >= 60
    ) {

        degrees++;

        minutes = 0;

    }


    return {
        degrees,
        minutes:
            minutes.toFixed(3)
    };

}



function decimalDegreesToDmm(
    latitude,
    longitude
) {

    const lat =
        splitDegrees(
            latitude
        );


    const lon =
        splitDegrees(
            longitude
        );


    return (

        `${lat.degrees}° ${lat.minutes}' `

        +

        `${latitude >= 0 ? "N" : "S"}, `

        +

        `${lon.degrees}° ${lon.minutes}' `

        +

        `${longitude >= 0 ? "Ø" : "V"}`

    );

}



function formatUtmNumber(
    number
) {

    const digits =
        String(
            Math.round(number)
        );


    if (
        digits.length <= 5
    ) {

        return digits;

    }


    return (

        digits.slice(
            0,
            -5
        )

        +

        " "

        +

        digits.slice(
            -5,
            -2
        )

        +

        " "

        +

        digits.slice(-2)

    );

}



function formatUtmInput(
    easting,
    northing
) {

    return (

        `Ø ${formatUtmNumber(easting)}, `

        +

        `N ${formatUtmNumber(northing)} UTM32N`

    );

}



/* =========================================================
   UTM -> LAT/LON
   ========================================================= */

function utm32ToLatLon(
    easting,
    northing
) {

    const a =
        6378137.0;


    const e2 =
        0.00669438;


    const k0 =
        0.9996;


    const ep2 =
        e2 /
        (1 - e2);


    const x =
        easting
        -
        500000;


    const m =
        northing /
        k0;


    const mu =
        m /
        (
            a *
            (
                1
                -
                e2 / 4
                -
                3 * e2 ** 2 / 64
                -
                5 * e2 ** 3 / 256
            )
        );


    const e1 =
        (
            1
            -
            Math.sqrt(
                1 - e2
            )
        )
        /
        (
            1
            +
            Math.sqrt(
                1 - e2
            )
        );


    const phi =
        mu
        +
        (
            3 * e1 / 2
            -
            27 * e1 ** 3 / 32
        )
        *
        Math.sin(
            2 * mu
        )
        +
        (
            21 * e1 ** 2 / 16
            -
            55 * e1 ** 4 / 32
        )
        *
        Math.sin(
            4 * mu
        )
        +
        (
            151 * e1 ** 3 / 96
        )
        *
        Math.sin(
            6 * mu
        )
        +
        (
            1097 * e1 ** 4 / 512
        )
        *
        Math.sin(
            8 * mu
        );


    const sinPhi =
        Math.sin(phi);


    const cosPhi =
        Math.cos(phi);


    const tanPhi =
        Math.tan(phi);


    const n =
        a
        /
        Math.sqrt(
            1
            -
            e2 *
            sinPhi ** 2
        );


    const t =
        tanPhi ** 2;


    const c =
        ep2 *
        cosPhi ** 2;


    const r =
        a *
        (1 - e2)
        /
        (
            1
            -
            e2 *
            sinPhi ** 2
        ) ** 1.5;


    const d =
        x /
        (
            n *
            k0
        );


    const latitude =
        phi
        -
        (
            n *
            tanPhi /
            r
        )
        *
        (
            d ** 2 / 2
            -
            (
                5
                +
                3 * t
                +
                10 * c
                -
                4 * c ** 2
                -
                9 * ep2
            )
            *
            d ** 4 / 24
            +
            (
                61
                +
                90 * t
                +
                298 * c
                +
                45 * t ** 2
                -
                252 * ep2
                -
                3 * c ** 2
            )
            *
            d ** 6 / 720
        );


    const longitude =
        (
            d
            -
            (
                1
                +
                2 * t
                +
                c
            )
            *
            d ** 3 / 6
            +
            (
                5
                -
                2 * c
                +
                28 * t
                -
                3 * c ** 2
                +
                8 * ep2
                +
                24 * t ** 2
            )
            *
            d ** 5 / 120
        )
        /
        cosPhi;


    return {

        latitude:
            latitude
            *
            180
            /
            Math.PI,

        longitude:
            9
            +
            longitude
            *
            180
            /
            Math.PI

    };

}



/* =========================================================
   LAT/LON -> UTM
   ========================================================= */

function latLonToUtm32(
    latitude,
    longitude
) {

    const a =
        6378137.0;


    const e2 =
        0.00669438;


    const k0 =
        0.9996;


    const ep2 =
        e2 /
        (1 - e2);


    const lat =
        latitude
        *
        Math.PI
        /
        180;


    const lon =
        longitude
        *
        Math.PI
        /
        180;


    const origin =
        9
        *
        Math.PI
        /
        180;


    const sinLat =
        Math.sin(lat);


    const cosLat =
        Math.cos(lat);


    const tanLat =
        Math.tan(lat);


    const n =
        a
        /
        Math.sqrt(
            1
            -
            e2 *
            sinLat ** 2
        );


    const t =
        tanLat ** 2;


    const c =
        ep2 *
        cosLat ** 2;


    const aa =
        cosLat *
        (
            lon
            -
            origin
        );


    const m =
        a *
        (
            (
                1
                -
                e2 / 4
                -
                3 * e2 ** 2 / 64
                -
                5 * e2 ** 3 / 256
            )
            *
            lat

            -

            (
                3 * e2 / 8
                +
                3 * e2 ** 2 / 32
                +
                45 * e2 ** 3 / 1024
            )
            *
            Math.sin(
                2 * lat
            )

            +

            (
                15 * e2 ** 2 / 256
                +
                45 * e2 ** 3 / 1024
            )
            *
            Math.sin(
                4 * lat
            )

            -

            (
                35 * e2 ** 3 / 3072
            )
            *
            Math.sin(
                6 * lat
            )
        );


    const easting =
        k0 *
        n *
        (
            aa

            +

            (
                1
                -
                t
                +
                c
            )
            *
            aa ** 3 / 6

            +

            (
                5
                -
                18 * t
                +
                t ** 2
                +
                72 * c
                -
                58 * ep2
            )
            *
            aa ** 5 / 120
        )
        +
        500000;


    const northing =
        k0 *
        (
            m
            +
            n *
            tanLat *
            (
                aa ** 2 / 2

                +

                (
                    5
                    -
                    t
                    +
                    9 * c
                    +
                    4 * c ** 2
                )
                *
                aa ** 4 / 24

                +

                (
                    61
                    -
                    58 * t
                    +
                    t ** 2
                    +
                    600 * c
                    -
                    330 * ep2
                )
                *
                aa ** 6 / 720
            )
        );


    return {

        easting:
            Math.round(
                easting
            ),

        northing:
            Math.round(
                northing
            )

    };

}



/* =========================================================
   KONVERTER POSISJON
   ========================================================= */

function convertCoordinates(
    sourceId,
    showError
) {

    const source =
        $("#" + sourceId);


    const error =
        $("#coordinateError");


    if (
        !source
        ||
        !error
    ) {

        return;

    }


    const value =
        source
            .value
            .trim();


    error.textContent = "";


    if (!value) {
        return;
    }


    if (
        sourceId ===
        "utmPosition"
    ) {

        const parsed =
            parseUtm(value);


        if (!parsed) {

            if (showError) {

                error.textContent =
                    "Kontroller UTM-posisjonen.";

            }

            return;

        }


        const result =
            utm32ToLatLon(
                parsed.easting,
                parsed.northing
            );


        const dmm =
            $("#dmmPosition");


        if (dmm) {

            dmm.value =
                decimalDegreesToDmm(
                    result.latitude,
                    result.longitude
                );

        }

    }


    if (
        sourceId ===
        "dmmPosition"
    ) {

        const parsed =
            parseDmm(value);


        if (!parsed) {

            if (showError) {

                error.textContent =
                    "Kontroller grader og desimalminutter.";

            }

            return;

        }


        const result =
            latLonToUtm32(
                parsed.latitude,
                parsed.longitude
            );


        const utm =
            $("#utmPosition");


        if (utm) {

            utm.value =
                formatUtmInput(
                    result.easting,
                    result.northing
                );

        }

    }

}



/* =========================================================
   RAPPORTPOSISJON
   ========================================================= */

function dmmToReportText(
    value
) {

    if (!value.trim()) {
        return "";
    }


    const parsed =
        parseDmm(value);


    if (!parsed) {

        return (
            "[kontroller koordinater]"
        );

    }


    const lat =
        splitDegrees(
            parsed.latitude
        );


    const lon =
        splitDegrees(
            parsed.longitude
        );


    return (

        `${lat.degrees} grader ${lat.minutes} `

        +

        `${
            parsed.latitude >= 0
                ? "nordlig"
                : "sørlig"
        }, `

        +

        `${lon.degrees} grader ${lon.minutes} `

        +

        `${
            parsed.longitude >= 0
                ? "østlig"
                : "vestlig"
        }`

    );

}



function utmToReportText(
    value
) {

    if (!value.trim()) {
        return "";
    }


    const parsed =
        parseUtm(value);


    if (!parsed) {

        return (
            "[kontroller koordinater]"
        );

    }


    return (

        `32 Ø ${formatUtmNumber(parsed.easting)}, `

        +

        `N ${formatUtmNumber(parsed.northing)}`

    );

}



/* =========================================================
   RAPPORT PERSON
   ========================================================= */

function personReportLine(
    role,
    name,
    phone
) {

    const parts = [];


    if (
        name.trim()
    ) {

        parts.push(
            name.trim()
        );

    }


    if (
        phone.trim()
    ) {

        parts.push(
            formatPhoneNumber(
                phone
            )
        );

    }


    return (
        `${role}: ${parts.join(" - ")}`
    );

}



/* =========================================================
   GENERER RAPPORT
   ========================================================= */

function generateReport() {

    const value =
        (id) =>
            $("#" + id)
                ?.value
                .trim()
            ??
            "";


    const separator =
        "----------------------------------------";


    const reportTime =
        (id) => {

            const raw =
                value(id);


            if (!raw) {
                return "";
            }


            return (
                formatTime(raw)
                ||
                "[kontroller klokkeslett]"
            );

        };


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

        state.criterion
            ? CRITERIA[state.criterion]
            : "",

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
            "Redningsmann",
            value("rescuerName"),
            value("rescuerPhone")
        ),

        "-",

        personReportLine(
            "Lege",
            value("doctorName"),
            value("doctorPhone")
        )

    ];



    $$(".trainee-row")
        .forEach(
            (row, index) => {

                const name =
                    row
                        .querySelector(
                            ".trainee-name"
                        )
                        ?.value
                        .trim()
                    ??
                    "";


                const phone =
                    row
                        .querySelector(
                            ".trainee-phone"
                        )
                        ?.value
                        .trim()
                    ??
                    "";


                if (
                    !name
                    &&
                    !phone
                ) {

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

            }
        );


    lines.push(
        separator
    );


    return lines.join("\n");

}



/* =========================================================
   OPPDATER RAPPORT
   ========================================================= */

function updateReport() {

    validateTimes();


    const output =
        $("#reportOutput");


    if (!output) {
        return;
    }


    output.value =
        generateReport();

}



/* =========================================================
   KOPIER
   ========================================================= */

async function copyReport() {

    validateTimes();


    const report =
        $("#reportOutput");


    if (!report) {
        return;
    }


    let copied =
        false;


    try {

        if (
            navigator.clipboard
            &&
            navigator.clipboard.writeText
        ) {

            await navigator
                .clipboard
                .writeText(
                    report.value
                );


            copied = true;

        }

    }
    catch {

        copied = false;

    }


    if (!copied) {

        report.focus();

        report.select();


        try {

            copied =
                document.execCommand(
                    "copy"
                );

        }
        catch {

            copied = false;

        }

    }


    clearTimeout(
        copyTimer
    );


    const buttonText =
        $("#copyButtonText");


    const confirmation =
        $("#copyConfirmation");


    if (copied) {

        if (buttonText) {

            buttonText.textContent =
                "Tekst kopiert";

        }


        if (confirmation) {

            confirmation.textContent =
                "Tekst kopiert";

        }


        copyTimer =
            setTimeout(
                clearCopyConfirmation,
                2500
            );

    }
    else {

        if (confirmation) {

            confirmation.textContent =
                "Kopiering ble blokkert.";

        }

    }

}



/* =========================================================
   NULLSTILL KOPIERINGSTEKST
   ========================================================= */

function clearCopyConfirmation() {

    clearTimeout(
        copyTimer
    );


    const buttonText =
        $("#copyButtonText");


    const confirmation =
        $("#copyConfirmation");


    if (buttonText) {

        buttonText.textContent =
            "Kopier tekst";

    }


    if (confirmation) {

        confirmation.textContent =
            "";

    }

}



/* =========================================================
   E-POST
   ========================================================= */

function createEmail() {

    updateReport();


    const report =
        $("#reportOutput")
            ?.value
        ??
        "";


    const subject =
        encodeURIComponent(
            "Savnet helikopter"
        );


    const body =
        encodeURIComponent(
            report
        );


    window.location.href =
        `mailto:?subject=${subject}&body=${body}`;

}



/* =========================================================
   NULLSTILL SKJEMA
   ========================================================= */

function resetForm() {

    $$(".form-panel input, .form-panel textarea")
        .forEach((field) => {

            field.value =
                "";

        });


    state.pob =
        null;


    state.criterion =
        null;


    updatePobButtons();

    updateCriteriaButtons();

    updateObservationField();


    const tgContainer =
        $("#otherTgContainer");


    if (tgContainer) {

        tgContainer.innerHTML = `

            <input
                type="text"
                id="otherTgFirst"
                class="other-tg-input"
                aria-label="Annen talegruppe"
                placeholder="Talegruppe"
                autocomplete="off"
            >

        `;

    }


    const paxContainer =
        $("#traineeContainer");


    if (paxContainer) {

        paxContainer.replaceChildren(
            createPaxRow()
        );

    }


    renumberPax();


    const coordinateError =
        $("#coordinateError");


    if (coordinateError) {

        coordinateError.textContent =
            "";

    }


    const timeError =
        $("#timeError");


    if (timeError) {

        timeError.textContent =
            "";

    }


    clearCopyConfirmation();

    updateReport();


    window.scrollTo({

        top: 0,

        behavior:
            window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches
                ? "auto"
                : "smooth"

    });

}