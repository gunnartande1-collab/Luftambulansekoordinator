
/* =========================================================
   LUFTAMBULANSEKOORDINATOR – FELLES JAVASCRIPT

   1. Felles rapportknappdesign
   2. Telefonformatering
   3. Dag- og kveldsmodus
   4. Automatisk skjematittel
   5. H145-inspirert helikopterikon
   6. Felles toppfelt
   7. Standardisering av rapportknapper
   ========================================================= */

(() => {
  "use strict";

  const root = document.documentElement;
  const storageKey = "luftambulansekoordinator-theme";
  const feedbackAddress = "b32838@ous-hf.no";

  /* =========================================================
     1. LAST FELLES RAPPORTKNAPPDESIGN
     ========================================================= */

  const scriptElement = document.currentScript;

  function loadReportStyles() {
    if (!scriptElement?.src) return;

    const url = new URL(
      "rapportknapper.css",
      scriptElement.src
    ).href;

    const exists = [...document.querySelectorAll(
      'link[rel="stylesheet"]'
    )].some(link => link.href === url);

    if (exists) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  }

  loadReportStyles();

  /* =========================================================
     2. TELEFONFORMATERING
     ========================================================= */

  function formatPhoneNumber(raw) {
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

  window.LAK = window.LAK || {};
  window.LAK.formatPhoneNumber = formatPhoneNumber;

  document.addEventListener("focusout", event => {
    const field = event.target;

    if (!(field instanceof HTMLInputElement)) {
      return;
    }

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
     3. DAG- OG KVELDSMODUS
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
     4. IDENTIFISER FREMSIDEN
     ========================================================= */

  function isFrontPage() {
    const filename = decodeURIComponent(
      window.location.pathname.split("/").pop() || ""
    ).toLocaleLowerCase("nb-NO");

    return (
      filename === "fremside.html" ||
      filename === "index.html" ||
      filename === "" ||
      document.body.classList.contains("home-page")
    );
  }

  /* =========================================================
     5. FINN AKTIV SKJEMATITTEL
     ========================================================= */

  function getPageTitle(header) {
    if (isFrontPage()) return "";

    const explicitTitle =
      document.body.dataset.pageTitle ||
      header.dataset.pageTitle;

    if (explicitTitle?.trim()) {
      const title = explicitTitle.trim();

      return title.toLocaleLowerCase("nb-NO") === "fremside"
        ? ""
        : title;
    }

    let title = document.title.split("|")[0].trim();

    if (
      !title ||
      title.toLocaleLowerCase("nb-NO") ===
        "luftambulansekoordinator"
    ) {
      title =
        header.querySelector("h1")?.textContent.trim() || "";
    }

    title = title
      .replace(/!!?\s*TESTVERSJON.*$/i, "")
      .replace(/TESTVERSJON.*$/i, "")
      .trim();

    const lower = title.toLocaleLowerCase("nb-NO");

    if (
      lower === "fremside" ||
      lower === "luftambulanse" ||
      lower === "luftambulansekoordinator"
    ) {
      return "";
    }

    return title;
  }

  /* =========================================================
     6. HELIKOPTERIKON – H145-INSPIRED
     ========================================================= */

  function createHelicopterIcon() {
    const wrapper = document.createElement("span");
    wrapper.className = "app-brand-mark";
    wrapper.setAttribute("aria-hidden", "true");

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");

    const attributes = {
      class: "app-brand-helicopter",
      viewBox: "0 0 120 70",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2.4",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      focusable: "false",
      "aria-hidden": "true"
    };

    Object.entries(attributes).forEach(([key, value]) => {
      svg.setAttribute(key, value);
    });

    function addElement(type, attrs) {
      const element = document.createElementNS(svgNS, type);

      Object.entries(attrs).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });

      svg.appendChild(element);
      return element;
    }

    function addPath(d, extra = {}) {
      return addElement("path", { d, ...extra });
    }

    // Hovedrotor og rotormast.
    addPath("M13 11 H100");
    addPath("M52 11 V18");
    addPath("M46 18 H58");

    // Motorhus.
    addPath(
      "M40 21 Q43 17 50 17 H64 Q70 18 72 23"
    );

    // Avrundet skrog.
    addPath(
      "M38 23 H65 Q76 23 82 30 " +
      "L83 43 Q79 49 68 49 H28 " +
      "Q14 49 10 42 Q6 35 13 29 " +
      "Q21 23 38 23 Z"
    );

    // Cockpitglass.
    addPath(
      "M35 26 L34 40 H16 " +
      "Q12 37 15 33 Q20 27 35 26 Z"
    );
    addPath("M26 27 L24 40");

    // Kabinvinduer.
    addPath("M40 27 H53 V38 H39 Z");
    addPath("M58 27 H67 V38 H58 Z");

    // Kabindør.
    addPath("M55 24 V46");

    // Halebom og halefinne.
    addPath(
      "M81 30 L102 23 L108 19 " +
      "L110 39 L84 42"
    );
    addPath(
      "M101 23 L106 13 L110 13 L110 39"
    );

    // Fenestron – innkapslet halerotor.
    addElement("circle", {
      cx: "104", cy: "29", r: "6.5"
    });
    addElement("circle", {
      cx: "104", cy: "29", r: "1.3"
    });
    addPath(
      "M104 23 V27.5 " +
      "M109 27 L105 28.5 " +
      "M107 34 L104.5 30.5 " +
      "M99 31 L102.5 29"
    );

    // Landingsmeier.
    addPath("M30 49 L27 57");
    addPath("M67 49 L72 57");
    addPath(
      "M19 57 Q17 61 22 61 " +
      "H82 Q87 61 89 57"
    );

    // Skrogets underside.
    addPath("M35 50 H65", {
      "stroke-width": "1.5"
    });

    // Medisinsk kors.
    addPath("M71 34 V42 M67 38 H75", {
      "stroke-width": "2"
    });

    wrapper.appendChild(svg);
    return wrapper;
  }

  /* =========================================================
     7. FELLES TOPPFELT
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

    // Prosjektidentitet.
    const headerTitle = document.createElement("div");
    headerTitle.className = "header-title app-brand";

    const helicopterIcon = createHelicopterIcon();

    const brandCopy = document.createElement("div");
    brandCopy.className = "app-brand-copy";

    const mainHeading = document.createElement("h1");
    mainHeading.textContent = "Luftambulanse";

    const subtitle = document.createElement("p");
    subtitle.className =
      "app-eyebrow app-header-subtitle";
    subtitle.textContent = "LA OSLO";

    brandCopy.append(mainHeading, subtitle);
    headerTitle.append(helicopterIcon, brandCopy);

    // Aktiv side.
    const activePage = document.createElement("div");
    activePage.className = "app-active-page";

    if (pageTitle) {
      const activeHeading = document.createElement("span");
      activeHeading.className = "app-active-page-title";
      activeHeading.textContent = pageTitle;
      activePage.appendChild(activeHeading);
    } else {
      activePage.hidden = true;
    }

    // Temaknapp.
    let themeButton = header.querySelector("#themeToggle");

    if (!themeButton) {
      themeButton = document.createElement("button");
      themeButton.id = "themeToggle";
      themeButton.type = "button";
      themeButton.className = "theme-toggle";
    }

    themeButton.type = "button";
    themeButton.classList.add("theme-toggle");
    themeButton.setAttribute(
      "aria-label", "Slå på kveldsmodus"
    );
    themeButton.setAttribute("aria-pressed", "false");
    themeButton.replaceChildren();

    const themeIcon = document.createElement("span");
    themeIcon.className = "theme-toggle-icon";
    themeIcon.setAttribute("aria-hidden", "true");
    themeIcon.textContent = "🌙";

    const themeText = document.createElement("span");
    themeText.className = "theme-toggle-text";
    themeText.textContent = "Kveldsmodus";

    themeButton.append(themeIcon, themeText);

    // Sett sammen toppfeltet.
    header.replaceChildren(
      headerTitle,
      activePage,
      themeButton
    );

    header.classList.add("shared-app-header");
    header.dataset.sharedHeaderReady = "true";

    document.querySelectorAll(
      ".form-panel > .app-page-title"
    ).forEach(element => element.remove());
  }

  /* =========================================================
     8. TEMAKNAPPENS FUNKSJON
     ========================================================= */

  function initialiseThemeToggle() {
    const button = document.getElementById("themeToggle");
    if (!button) return;

    if (button.dataset.themeReady === "true") {
      return;
    }

    const icon = button.querySelector(".theme-toggle-icon");
    const text = button.querySelector(".theme-toggle-text");

    function updateThemeButton() {
      const isDark = root.dataset.theme === "dark";

      button.setAttribute("aria-pressed", String(isDark));
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
        text.textContent = isDark
          ? "Dagmodus"
          : "Kveldsmodus";
      }
    }

    button.addEventListener("click", () => {
      const nextTheme =
        root.dataset.theme === "dark"
          ? "light"
          : "dark";

      root.dataset.theme = nextTheme;

      try {
        sessionStorage.setItem(storageKey, nextTheme);
      } catch {
        // Temavalg fungerer uten lagring.
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
     9. RAPPORTKNAPPER
     ========================================================= */

  function initialiseReportButtons() {
    const containers = document.querySelectorAll(
      ".action-buttons, .sh-report-actions, .report-actions"
    );

    containers.forEach(container => {
      if (container.dataset.reportDesignReady === "true") {
        return;
      }

      const find = selector =>
        container.querySelector(selector);

      const copy = find(
        ".action-copy, .sh-copy, .copy-btn"
      );
      const print = find(
        ".action-print, .sh-print, .print-btn"
      );
      const reset = find(
        ".action-reset, .sh-reset, .reset-btn"
      );
      const procedure = find(
        ".action-procedure, .sh-procedure, .procedure-btn"
      );
      const feedback = find(
        ".action-feedback, .action-email, " +
        ".sh-feedback, .feedback-btn"
      );

      /*
         Opprett prosedyreknapp automatisk på
         Sekundæroppdrag dersom den mangler.

         Den er deaktivert til korrekt
         eHåndbok-lenke er kjent.
      */

      if (
        document.body.classList.contains("secondary-page") &&
        !procedure
      ) {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "action-btn procedure-btn";
        button.textContent = "Prosedyre";
        button.disabled = true;
        button.title =
          "Prosedyrelenke legges til senere";

        if (print) {
          print.insertAdjacentElement("afterend", button);
        } else {
          container.appendChild(button);
        }
      }

      /*
         Normaliser knappetekst.
         Kopieringsstatus-elementer beholdes.
      */

      if (print) {
        print.textContent = "Skriv ut";
      }

      if (reset) {
        reset.textContent = "Tøm skjema";
      }

      if (procedure) {
        // Behold eventuell eksisterende lenke.
        procedure.textContent = "Prosedyre";
      }

      if (feedback) {
        feedback.textContent = "Gi tilbakemelding";
      }

      if (copy && !copy.querySelector("#copyButtonText")) {
        // Sekundæroppdrag bruker egen statusmelding.
        copy.textContent = "Kopier tekst";
      }

      /*
         Sekundæroppdrag:
         Bruk installert standardprogram for e-post
         i stedet for Outlook i nettleseren.
      */

      if (
        document.body.classList.contains("secondary-page") &&
        feedback?.tagName === "A"
      ) {
        const subject =
          "Tilbakemelding – Sekundæroppdrag | " +
          "Luftambulansekoordinator";

        feedback.setAttribute(
          "href",
          "mailto:" + feedbackAddress +
          "?subject=" + encodeURIComponent(subject)
        );

        feedback.removeAttribute("target");
        feedback.removeAttribute("rel");
      }

      container.dataset.reportDesignReady = "true";
    });
  }

  /* =========================================================
     10. OPPSTART
     ========================================================= */

  function initialiseSharedFunctions() {
    initialisePageHeader();
    initialiseThemeToggle();
    initialiseReportButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseSharedFunctions,
      { once: true }
    );
  } else {
    initialiseSharedFunctions();
  }

})();
