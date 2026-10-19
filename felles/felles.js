
/* =========================================================
   LUFTAMBULANSEKOORDINATOR
   FELLES JAVASCRIPT

   - Felles toppfelt
   - Aktivt sidenavn
   - Dag- og kveldsmodus
   - Telefonformatering i merkede telefonfelt
   ========================================================= */

(() => {
  "use strict";

  const root = document.documentElement;
  const storageKey = "luftambulansekoordinator-theme";

  /* =========================================================
     1. FORMATER TELEFONNUMMER
     ========================================================= */

  function formatPhoneNumber(raw) {
    const original = String(raw ?? "").trim();
    if (!original) return "";

    const digits = original.replace(/\D/g, "");

    // Bare norske åttesifrede nummer uten landskode.
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

  // Tilgjengelig for rapportgeneratorene i andre moduler.
  window.LAK = window.LAK || {};
  window.LAK.formatPhoneNumber = formatPhoneNumber;

  // Gjelder bare eksplisitt utvalgte telefonfelt.
  // data-phone-format="true" kan brukes på senere moduler.
  document.addEventListener("focusout", event => {
    const field = event.target;

    if (!(field instanceof HTMLInputElement)) return;


const phoneSelector = [
  '[data-phone-format="true"]',
  '#pilotPhone',
  '#rescuerPhone',
  '#doctorPhone',
  '.pax-phone',
  '#rekTlf',
  '#mottTlf',
  '[name="rekTlf"]',
  '[name="mottTlf"]'
].join(", ");

    if (!field.matches(phoneSelector)) return;

    const formatted = formatPhoneNumber(field.value);

    if (formatted !== field.value) {
      field.value = formatted;
      field.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }
  });

  /* =========================================================
     2. HENT LAGRET TEMA
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
     3. FINN NAVNET PÅ AKTIV SIDE
     ========================================================= */

  function getPageTitle(header) {
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

    // Fjern eventuell testtekst fra navnet.
    title = title
      .replace(/!!?\s*TESTVERSJON.*$/i, "")
      .replace(/TESTVERSJON.*$/i, "")
      .trim();

    const filename = decodeURIComponent(
      window.location.pathname.split("/").pop() || ""
    ).toLocaleLowerCase("nb-NO");

    // Fremsiden får ikke egen skjematittel.
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
     4. BYGG FELLES TOPPFELT
     ========================================================= */

  function initialisePageHeader() {
    let header = document.querySelector(".app-header");

    if (!header) {
      header = document.createElement("header");
      header.className = "app-header";
      document.body.prepend(header);
    }

    if (header.dataset.sharedHeaderReady === "true") {
      return;
    }

    const pageTitle = getPageTitle(header);

    /* 4A. PROSJEKTNAVN */

    const headerTitle = document.createElement("div");
    headerTitle.className = "header-title";

    const mainHeading = document.createElement("h1");
    mainHeading.textContent = "Luftambulansekoordinator";

    const subtitle = document.createElement("p");
    subtitle.className = "app-eyebrow app-header-subtitle";
    subtitle.textContent = "LA OSLO";

    headerTitle.append(mainHeading, subtitle);

    /* 4B. AKTIVT SKJEMA */

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

    /* 4C. DAG- OG KVELDSMODUSKNAPP */

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

    themeButton.replaceChildren();

    const themeIcon = document.createElement("span");
    themeIcon.className = "theme-toggle-icon";
    themeIcon.setAttribute("aria-hidden", "true");
    themeIcon.textContent = "🌙";

    const themeText = document.createElement("span");
    themeText.className = "theme-toggle-text";
    themeText.textContent = "Kveldsmodus";

    themeButton.append(themeIcon, themeText);

    /* 4D. BYGG TOPPFELTET */

    header.replaceChildren(
      headerTitle,
      activePage,
      themeButton
    );

    header.classList.add("shared-app-header");
    header.dataset.sharedHeaderReady = "true";

    /* 4E. FJERN GAMMEL EKSTRA SIDETITTEL */

    document.querySelectorAll(
      ".form-panel > .app-page-title"
    ).forEach(element => {
      element.remove();
    });
  }

  /* =========================================================
     5. DAG- OG KVELDSMODUS
     ========================================================= */

  function initialiseThemeToggle() {
    const button = document.getElementById(
      "themeToggle"
    );

    if (!button) return;

    if (button.dataset.themeReady === "true") {
      return;
    }

    const icon = button.querySelector(
      ".theme-toggle-icon"
    );

    const text = button.querySelector(
      ".theme-toggle-text"
    );

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
        icon.textContent = isDark ? "☀️" : "🌙";
      }

      if (text) {
        text.textContent =
          isDark ? "Dagmodus" : "Kveldsmodus";
      }
    }

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

    window.addEventListener("pageshow", () => {
      root.dataset.theme = getStoredTheme();
      updateThemeButton();
    });

    button.dataset.themeReady = "true";
    updateThemeButton();
  }

  /* =========================================================
     6. OPPSTART
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
