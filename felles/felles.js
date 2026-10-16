
/* =========================================================
   LUFTAMBULANSEKOORDINATOR
   FELLES JAVASCRIPT

   Felles toppfelt for alle sider.

   - Bygger toppfelt automatisk
   - Henter sidenavn fra HTML-tittel
   - Viser Luftambulansekoordinator
   - Viser LA OSLO
   - Viser aktivt skjema i midten
   - Kveldsmodus til høyre
   - Husker valgt tema mellom sider

   ========================================================= */

(() => {
  "use strict";

  const root = document.documentElement;

  const storageKey =
    "luftambulansekoordinator-theme";


  /* =========================================================
     1. HENT LAGRET TEMA
     ========================================================= */

  function getStoredTheme() {
    try {
      return sessionStorage.getItem(storageKey) === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  }

  root.dataset.theme = getStoredTheme();


  /* =========================================================
     2. FINN NAVNET PÅ AKTIV SIDE
     ========================================================= */

  function getPageTitle(header) {

    /*
      Prioritet:

      1. data-page-title på body
      2. data-page-title på header
      3. HTML document.title
      4. Eksisterende H1

      Eksempel:

      <title>
        GPS-forstyrrelser | Luftambulansekoordinator
      </title>

      Gir: GPS-forstyrrelser
    */

    const explicitTitle =
      document.body.dataset.pageTitle ||
      header.dataset.pageTitle;

    if (explicitTitle?.trim()) {
      return explicitTitle.trim();
    }

    let title = document.title
      .split("|")[0]
      .trim();

    if (
      !title ||
      title.toLocaleLowerCase("nb-NO") ===
        "luftambulansekoordinator"
    ) {
      const heading = header.querySelector("h1");

      title = heading?.textContent.trim() || "";
    }

    /*
      Fjern eventuell testtekst fra navnet.
    */

    title = title
      .replace(/!!?\s*TESTVERSJON.*$/i, "")
      .replace(/TESTVERSJON.*$/i, "")
      .trim();

    /*
      Fremsiden får ikke egen skjematittel.
    */

    const filename = decodeURIComponent(
      window.location.pathname.split("/").pop() || ""
    ).toLocaleLowerCase("nb-NO");

    if (
      /^(fremside|index)\.html$/.test(filename) ||
      /^fremside$/i.test(title) ||
      /^luftambulansekoordinator$/i.test(title)
    ) {
      return "";
    }

    return title;
  }


  /* =========================================================
     3. BYGG FELLES TOPPFELT
     ========================================================= */

  function initialisePageHeader() {

    /*
      Finn toppfeltet på siden.

      Dersom siden ikke har toppfelt,
      opprettes det automatisk.
    */

    let header = document.querySelector(".app-header");

    if (!header) {
      header = document.createElement("header");

      header.className = "app-header";

      document.body.prepend(header);
    }

    /*
      Unngå dobbel opprettelse.
    */

    if (
      header.dataset.sharedHeaderReady === "true"
    ) {
      return;
    }

    /*
      Hent sidenavnet FØR vi bygger toppfeltet.
    */

    const pageTitle = getPageTitle(header);


    /* =====================================================
       3A. OPPRETT PROSJEKTNAVN
       ===================================================== */

    const headerTitle = document.createElement("div");

    headerTitle.className = "header-title";

    const mainHeading = document.createElement("h1");

    mainHeading.textContent =
      "Luftambulansekoordinator";

    const subtitle = document.createElement("p");

    subtitle.className =
      "app-eyebrow app-header-subtitle";

    subtitle.textContent = "LA OSLO";

    headerTitle.append(
      mainHeading,
      subtitle
    );


    /* =====================================================
       3B. OPPRETT AKTIVT SKJEMA
       ===================================================== */

    const activePage = document.createElement("div");

    activePage.className = "app-active-page";

    if (pageTitle) {

      const activeHeading =
        document.createElement("span");

      activeHeading.className =
        "app-active-page-title";

      activeHeading.textContent = pageTitle;

      activePage.appendChild(activeHeading);

    } else {

      activePage.hidden = true;

    }


    /* =====================================================
       3C. OPPRETT KVELDSMODUSKNAPP
       ===================================================== */

    /*
      Bruk eksisterende knapp hvis den finnes.

      Dette gjør løsningen kompatibel
      med eksisterende skjemaer.
    */

    let themeButton = header.querySelector(
      "#themeToggle"
    );

    if (!themeButton) {

      themeButton = document.createElement("button");

      themeButton.id = "themeToggle";
      themeButton.type = "button";

      themeButton.className = "theme-toggle";

    }

    themeButton.type = "button";
    themeButton.classList.add("theme-toggle");

    themeButton.setAttribute(
      "aria-label",
      "Slå på kveldsmodus"
    );

    themeButton.setAttribute(
      "aria-pressed",
      "false"
    );

    /*
      Opprett standard innhold i knappen.
    */

    themeButton.replaceChildren();

    const themeIcon = document.createElement("span");

    themeIcon.className = "theme-toggle-icon";
    themeIcon.setAttribute("aria-hidden", "true");

    themeIcon.textContent = "🌙";

    const themeText = document.createElement("span");

    themeText.className = "theme-toggle-text";
    themeText.textContent = "Kveldsmodus";

    themeButton.append(
      themeIcon,
      themeText
    );


    /* =====================================================
       3D. BYGG TOPPFELTET I RIKTIG REKKEFØLGE
       ===================================================== */

    /*
      Vi erstatter kun innholdet i header.

      Alt utenfor header, inkludert:

      - Venstremeny
      - Skjema
      - Rapportpanel
      - Rapportgenerator

      beholdes uendret.
    */

    header.replaceChildren(
      headerTitle,
      activePage,
      themeButton
    );

    header.classList.add("shared-app-header");

    header.dataset.sharedHeaderReady = "true";


    /* =====================================================
       3E. FJERN GAMMEL SKJEMATITTEL
       ===================================================== */

    /*
      Tidligere versjon la en ekstra
      overskrift i midtkolonnen.

      Fjern kun denne spesifikke
      overskriften dersom den finnes.
    */

    document.querySelectorAll(
      ".form-panel > .app-page-title"
    ).forEach(element => {
      element.remove();
    });

  }


  /* =========================================================
     4. DAG- OG KVELDSMODUS
     ========================================================= */

  function initialiseThemeToggle() {

    const button = document.getElementById(
      "themeToggle"
    );

    if (!button) return;

    if (
      button.dataset.themeReady === "true"
    ) {
      return;
    }

    const icon = button.querySelector(
      ".theme-toggle-icon"
    );

    const text = button.querySelector(
      ".theme-toggle-text"
    );


    /* =====================================================
       4A. OPPDATER KNAPP
       ===================================================== */

    function updateThemeButton() {

      const isDark =
        root.dataset.theme === "dark";

      button.setAttribute(
        "aria-pressed",
        String(isDark)
      );

      button.setAttribute(
        "aria-label",
        isDark
          ? "Slå på dagmodus"
          : "Slå på kveldsmodus"
      );

      if (icon) {
        icon.textContent =
          isDark ? "☀️" : "🌙";
      }

      if (text) {
        text.textContent =
          isDark ? "Dagmodus" : "Kveldsmodus";
      }
    }


    /* =====================================================
       4B. BYTT TEMA
       ===================================================== */

    button.addEventListener("click", () => {

      const nextTheme =
        root.dataset.theme === "dark"
          ? "light"
          : "dark";

      root.dataset.theme = nextTheme;

      try {

        sessionStorage.setItem(
          storageKey,
          nextTheme
        );

      } catch {
        // Temaet fungerer fortsatt på åpen side.
      }

      updateThemeButton();

    });


    /* =====================================================
       4C. GJENOPPRETT TEMA
       ===================================================== */

    window.addEventListener("pageshow", () => {

      root.dataset.theme = getStoredTheme();

      updateThemeButton();

    });


    button.dataset.themeReady = "true";

    updateThemeButton();

  }


  /* =========================================================
     5. OPPSTART
     ========================================================= */

  function initialiseSharedFunctions() {

    initialisePageHeader();

    initialiseThemeToggle();

  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initialiseSharedFunctions
    );

  } else {

    initialiseSharedFunctions();

  }

})();
