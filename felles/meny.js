
/* =========================================================
   LUFTAMBULANSEKOORDINATOR
   FELLES VENSTREMENY

   Fil: felles/meny.js

   FUNKSJONER:
   1. Felles meny fra fremside.html
   2. Korrekte lenker på alle undersider
   3. Forside øverst INNE i menyboksen
   4. Tydeligere seksjonsoverskrifter
   5. Markering av aktiv side
   6. Utvidbare nyttige hjelpemidler
   7. Husker åpen/lukket tilstand
   8. Eksterne lenker åpnes i ny fane
   9. Automatisk lasting av meny-CSS
   ========================================================= */

(() => {
  "use strict";

  /* =======================================================
     1. INNSTILLINGER
     ======================================================= */

  const MENU_STORAGE_KEY =
    "lak-nyttige-hjelpemidler-open";

  const MENU_STYLE_ID =
    "lak-menu-adjustments";

  const scriptUrl = document.currentScript?.src;

  if (!scriptUrl) {
    console.error(
      "Meny: Kunne ikke finne adressen til meny.js"
    );
    return;
  }

  const rootUrl = new URL("../", scriptUrl);

  const frontUrl = new URL(
    "fremside.html",
    rootUrl
  );

  const toolsCssUrl = new URL(
    "felles/hjelpemidler.css",
    rootUrl
  );

  /* =======================================================
     2. LAST INN FELLES MENYSTILER
     ======================================================= */

  function loadMenuStyles() {

    const exists = [
      ...document.querySelectorAll(
        'link[rel="stylesheet"]'
      )
    ].some(link => link.href === toolsCssUrl.href);

    if (!exists) {

      const stylesheet =
        document.createElement("link");

      stylesheet.rel = "stylesheet";
      stylesheet.href = toolsCssUrl.href;

      document.head.appendChild(stylesheet);
    }
  }

  /* =======================================================
     3. MENYENS VISUELLE JUSTERINGER

     Beholder eksisterende CSS, men forbedrer
     overskrifter og mellomrom.

     Gjelder både dagmodus og kveldsmodus.
     ======================================================= */

  function loadMenuAdjustments() {

    if (document.getElementById(MENU_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = MENU_STYLE_ID;

    style.textContent = `

      /* ======================================
         FORSIDE ØVERST I HVIT MENYBOKS
         ====================================== */

      html body
      .form-navigation-inner
      .form-nav-home-list {

        display: grid;
        grid-template-columns: minmax(0, 1fr);

        gap: 0;

        margin: 0;
        padding: 0;

        list-style: none;
      }

      html body
      .form-nav-home-list .form-nav-link {

        font-weight: 600;
      }

      html body
      .form-navigation-inner
      .form-nav-home-divider {

        height: 1px;

        margin: 11px 8px 15px;

        background: var(
          --border-light,
          #e4e7ec
        );

        border: 0;
      }

      /* ======================================
         SEKSJONSOVERSKRIFTER
         ====================================== */

      html body
      .form-navigation-inner
      .form-navigation-label {

        display: block;

        margin: 5px 8px 9px;

        color: #263442;

        font-size: 12px;
        font-weight: 800;

        line-height: 1.4;
        letter-spacing: 0.045em;

        text-transform: uppercase;
      }

      html body
      .form-navigation-inner
      .form-navigation-label:not(:first-child) {

        margin-top: 19px;
      }

      /* ======================================
         MENYPUNKTER UNDER OVERSKRIFTENE
         ====================================== */

      html body
      .form-navigation-inner
      .form-nav-list .form-nav-link {

        font-size: 14px;
        font-weight: 500;

        line-height: 1.45;
      }

      html body
      .form-navigation-inner
      .form-nav-link[aria-current="page"] {

        font-weight: 650;
      }

      /* ======================================
         NYTTIGE HJELPEMIDLER
         ====================================== */

      html body
      .form-navigation-inner
      .nav-tools-heading {

        margin: 0 4px 8px;

        color: #263442;
      }

      html body
      .form-navigation-inner
      .nav-tools-heading-text {

        color: inherit;

        font-size: 12px;
        font-weight: 800;

        letter-spacing: 0.045em;
      }

      /* ======================================
         KVELDSMODUS
         ====================================== */

      html[data-theme="dark"] body
      .form-navigation-inner
      .form-navigation-label {

        color: #e0e8f1;
      }

      html[data-theme="dark"] body
      .form-navigation-inner
      .nav-tools-heading {

        color: #e0e8f1;
      }

      html[data-theme="dark"] body
      .form-navigation-inner
      .form-nav-home-divider {

        background: #344252;
      }

      /* ======================================
         FOKUS FOR TASTATURNAVIGASJON
         ====================================== */

      html body
      .form-nav-home-list
      .form-nav-link:focus-visible {

        outline: 3px solid var(
          --primary,
          #0066a1
        );

        outline-offset: 2px;
      }

      /* ======================================
         MINDRE SKJERMER
         ====================================== */

      @media (max-width: 1200px) {

        html body
        .form-navigation-inner
        .form-nav-list .form-nav-link {

          font-size: 13px;
        }

      }

      @media (max-width: 900px) {

        html body
        .form-navigation-inner
        .form-nav-home-list {

          grid-template-columns: 1fr;
        }

        html body
        .form-navigation-inner
        .form-nav-list .form-nav-link {

          font-size: 14px;
        }

      }

    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     4. NORMALISER ADRESSER
     ======================================================= */

  function normalizePath(url) {

    try {

      const parsed = new URL(
        url,
        window.location.href
      );

      let path = decodeURIComponent(
        parsed.pathname
      );

      path = path.replace(/\/+$/, "");

      return path;

    } catch (error) {

      console.warn(
        "Meny: Kunne ikke normalisere adresse.",
        error
      );

      return "";
    }
  }

  /* =======================================================
     5. RETT RELATIVE LENKER
     ======================================================= */

  function fixLinks(menu) {

    menu.querySelectorAll(
      "[href]"
    ).forEach(element => {

      const href = element.getAttribute("href");

      if (!href) return;

      const ignoredProtocols = [
        "#",
        "mailto:",
        "tel:",
        "javascript:",
        "data:"
      ];

      if (
        ignoredProtocols.some(
          prefix => href.toLowerCase().startsWith(prefix)
        )
      ) {
        return;
      }

      try {

        const absoluteUrl = new URL(
          href,
          frontUrl
        );

        element.setAttribute(
          "href",
          absoluteUrl.href
        );

      } catch (error) {

        console.warn(
          "Meny: Kunne ikke rette lenke:",
          href,
          error
        );
      }
    });

    // Korriger eventuelle bildebaner.

    menu.querySelectorAll(
      "[src]"
    ).forEach(element => {

      const src = element.getAttribute("src");

      if (!src) return;

      try {

        element.setAttribute(
          "src",
          new URL(src, frontUrl).href
        );

      } catch (error) {

        console.warn(
          "Meny: Kunne ikke rette bildebane:",
          src,
          error
        );
      }
    });
  }

  /* =======================================================
     6. PLASSER FORSIDE RIKTIG

     VIKTIG:
     Forside skal plasseres innenfor
     .form-navigation-inner, ikke direkte i nav.

     Beholder riktig HTML-struktur:
     ul > li > a
     ======================================================= */

  function arrangeFrontPageLink(menu) {

    const inner = menu.querySelector(
      ".form-navigation-inner"
    );

    if (!inner) {
      console.warn(
        "Meny: Fant ikke .form-navigation-inner"
      );
      return;
    }

    const frontPath = normalizePath(
      frontUrl.href
    );

    // Finn eksisterende Forside-lenke.

    let frontLink = [
      ...inner.querySelectorAll("a[href]")
    ].find(link => {

      return normalizePath(link.href) === frontPath;

    });

    // Opprett lenke dersom den mangler.

    if (!frontLink) {

      frontLink = document.createElement("a");

      frontLink.href = frontUrl.href;
      frontLink.className = "form-nav-link";

      const copy = document.createElement("span");

      copy.className = "form-nav-copy";
      copy.textContent = "Forside";

      frontLink.appendChild(copy);
    }

    // Korrekt tekst.

    const copy = frontLink.querySelector(
      ".form-nav-copy"
    );

    if (copy) {
      copy.textContent = "Forside";
    } else {
      frontLink.textContent = "Forside";
    }

    frontLink.classList.add("form-nav-link");

    // Finn eksisterende listepunkt.

    let listItem = frontLink.closest("li");

    if (!listItem) {

      listItem = document.createElement("li");

      listItem.appendChild(frontLink);
    }

    // Finn eller opprett egen liste for Forside.

    let homeList = inner.querySelector(
      ".form-nav-home-list"
    );

    if (!homeList) {

      homeList = document.createElement("ul");

      homeList.className =
        "form-nav-list form-nav-home-list";
    }

    // Flytt eksisterende listepunkt.
    // Dette forhindrer duplisering.

    homeList.appendChild(listItem);

    // Finn eksisterende overskrift Skjemaer.

    const firstHeading = [
      ...inner.querySelectorAll(
        ".form-navigation-label"
      )
    ][0];

    // Plasser listen innenfor den hvite boksen.

    if (firstHeading) {

      inner.insertBefore(
        homeList,
        firstHeading
      );

    } else {

      inner.prepend(homeList);
    }

    // Diskret skillelinje.

    let divider = inner.querySelector(
      ".form-nav-home-divider"
    );

    if (!divider) {

      divider = document.createElement("div");

      divider.className =
        "form-nav-home-divider";

      divider.setAttribute(
        "aria-hidden",
        "true"
      );
    }

    homeList.insertAdjacentElement(
      "afterend",
      divider
    );

    // Gi seksjonen riktig navn.
    // Endrer kun navigasjonsoverskriften.

    if (firstHeading) {

      const headingText =
        firstHeading.textContent.trim().toLowerCase();

      if (
        headingText === "skjemaer" ||
        headingText === "skjema"
      ) {
        firstHeading.textContent = "Skjema";
      }
    }
  }

  /* =======================================================
     7. MARKER AKTIV SIDE
     ======================================================= */

  function setActivePage(menu) {

    const currentPath = normalizePath(
      window.location.href
    );

    const links = menu.querySelectorAll(
      ".form-nav-link"
    );

    links.forEach(link => {

      link.classList.remove("is-active");

      link.removeAttribute(
        "aria-current"
      );

      const targetPath = normalizePath(
        link.href
      );

      if (
        targetPath &&
        targetPath === currentPath
      ) {

        link.classList.add("is-active");

        link.setAttribute(
          "aria-current",
          "page"
        );
      }
    });
  }

  /* =======================================================
     8. LAGRE TILSTAND FOR HJELPEMIDLER
     ======================================================= */

  function getStoredMenuState() {

    try {

      const stored = sessionStorage.getItem(
        MENU_STORAGE_KEY
      );

      // Åpen som standard første gang.

      if (stored === null) {
        return true;
      }

      return stored === "true";

    } catch {

      return true;
    }
  }

  function saveMenuState(isOpen) {

    try {

      sessionStorage.setItem(
        MENU_STORAGE_KEY,
        String(isOpen)
      );

    } catch {

      // Menyen fungerer også uten lagring.
    }
  }

  /* =======================================================
     9. KLARGJØR UTVIDBAR HJELPEMIDDELMENY
     ======================================================= */

  function initializeToolsMenu(menu) {

    const toolsSection = menu.querySelector(
      "[data-tools-section]"
    );

    if (!toolsSection) return;

    if (
      toolsSection.dataset.menuInitialized === "true"
    ) {
      return;
    }

    // Hent lagret tilstand.

    toolsSection.open = getStoredMenuState();

    // Lagre når brukeren åpner eller lukker.

    toolsSection.addEventListener(
      "toggle",
      () => {

        saveMenuState(
          toolsSection.open
        );
      }
    );

    toolsSection.dataset.menuInitialized =
      "true";
  }

  /* =======================================================
     10. EKSTERNE LENKER
     ======================================================= */

  function initializeExternalLinks(menu) {

    const links = menu.querySelectorAll(
      "a.nav-external-link"
    );

    links.forEach(link => {

      link.setAttribute(
        "target",
        "_blank"
      );

      link.setAttribute(
        "rel",
        "noopener noreferrer"
      );
    });
  }

  /* =======================================================
     11. KLARGJØR EN MENY
     ======================================================= */

  function initializeMenu(menu, copied = false) {

    if (!menu) return;

    if (copied) {

      // Undersider bruker absolutte stier.

      fixLinks(menu);
    }

    // Riktig plassering av Forside.

    arrangeFrontPageLink(menu);

    // Marker aktiv side.

    setActivePage(menu);

    // Aktiver hjelpemiddelmenyen.

    initializeToolsMenu(menu);

    // Sikre trygg åpning av eksterne sider.

    initializeExternalLinks(menu);
  }

  /* =======================================================
     12. LAST FELLESMENY PÅ UNDERSIDER
     ======================================================= */

  async function loadSharedMenu() {

    const target = document.getElementById(
      "shared-menu"
    );

    // På fremsiden finnes menyen i HTML.

    if (!target) {
      return;
    }

    try {

      const response = await fetch(
        frontUrl.href,
        {
          cache: "no-cache"
        }
      );

      if (!response.ok) {

        throw new Error(
          "Kunne ikke hente fremsiden. " +
          "HTTP-status: " + response.status
        );
      }

      const html = await response.text();

      const parser = new DOMParser();

      const documentCopy = parser.parseFromString(
        html,
        "text/html"
      );

      // Finn hovedmenyen.

      const sourceMenu =
        documentCopy.querySelector(
          "nav.form-navigation"
        );

      if (!sourceMenu) {

        throw new Error(
          "Fant ikke navigasjonsmenyen " +
          "i fremside.html"
        );
      }

      // Lag kopi til undersiden.

      const menu = sourceMenu.cloneNode(true);

      // Unngå dupliserte ID-er.

      menu.removeAttribute("id");

      // Erstatt tidligere meny.

      target.replaceChildren(menu);

      // Klargjør kopien.

      initializeMenu(
        menu,
        true
      );

    } catch (error) {

      console.error(
        "Meny: Feil ved lasting av fellesmeny:",
        error
      );

      target.textContent =
        "Kunne ikke laste navigasjonsmenyen.";
    }
  }

  /* =======================================================
     13. OPPSTART
     ======================================================= */

  function initializeSharedNavigation() {

    // Last nødvendig CSS.

    loadMenuStyles();

    // Last visuelle justeringer.

    loadMenuAdjustments();

    // Finn eventuell meny på fremsiden.

    const localMenu = document.querySelector(
      "nav.form-navigation[data-shared-menu]"
    );

    if (localMenu) {

      initializeMenu(
        localMenu,
        false
      );
    }

    // Last meny på undersidene.

    loadSharedMenu();
  }

  if (
    document.readyState === "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initializeSharedNavigation,
      {
        once: true
      }
    );

  } else {

    initializeSharedNavigation();
  }

})();
