
/* =========================================================
   LUFTAMBULANSEKOORDINATOR
   FELLES VENSTREMENY

   Fil: felles/meny.js

   FUNKSJONER:
   1. Felles meny fra fremside.html
   2. Korrekte lenker på alle undersider
   3. Markering av aktiv side
   4. Utvidbare nyttige hjelpemidler
   5. Husker åpen/lukket tilstand
   6. Åpner eksterne lenker i ny fane
   7. Laster felles meny-CSS automatisk
   ========================================================= */

(() => {
  "use strict";


  /* =======================================================
     1. INNSTILLINGER
     ======================================================= */

  const MENU_STORAGE_KEY =
    "lak-nyttige-hjelpemidler-open";

  const scriptUrl = document.currentScript?.src;

  if (!scriptUrl) {
    console.error(
      "Meny: Kunne ikke finne adressen til meny.js"
    );
    return;
  }

  // Finn prosjektets rotmappe.

  const rootUrl = new URL("../", scriptUrl);

  // Fremsiden er hovedkilden til venstremenyen.

  const frontUrl = new URL(
    "fremside.html",
    rootUrl
  );

  // Eget stilark for hjelpemiddelmenyen.

  const toolsCssUrl = new URL(
    "felles/hjelpemidler.css",
    rootUrl
  );


  /* =======================================================
     2. LAST INN FELLES MENYSTILER
     ======================================================= */

  function loadMenuStyles() {

    const existingStylesheet = [
      ...document.querySelectorAll(
        'link[rel="stylesheet"]'
      )
    ].some(link => {
      return link.href === toolsCssUrl.href;
    });

    if (existingStylesheet) {
      return;
    }

    const stylesheet = document.createElement(
      "link"
    );

    stylesheet.rel = "stylesheet";
    stylesheet.href = toolsCssUrl.href;

    document.head.appendChild(stylesheet);

  }


  /* =======================================================
     3. NORMALISER ADRESSER
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
     4. RETT RELATIVE LENKER
     ======================================================= */

  function fixLinks(menu) {

    menu.querySelectorAll(
      "[href]"
    ).forEach(element => {

      const href = element.getAttribute(
        "href"
      );

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
          prefix => href.startsWith(prefix)
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

      const src = element.getAttribute(
        "src"
      );

      if (!src) return;

      try {

        const absoluteUrl = new URL(
          src,
          frontUrl
        );

        element.setAttribute(
          "src",
          absoluteUrl.href
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
     5. MARKER AKTIV SIDE
     ======================================================= */

  function setActivePage(menu) {

    const currentPath = normalizePath(
      window.location.href
    );

    const links = menu.querySelectorAll(
      ".form-nav-link"
    );

    links.forEach(link => {

      link.classList.remove(
        "is-active"
      );

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

        link.classList.add(
          "is-active"
        );

        link.setAttribute(
          "aria-current",
          "page"
        );

      }

    });

  }


  /* =======================================================
     6. LAGRE TILSTAND FOR HJELPEMIDLER
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

      // Menyen fungerer også dersom lagring
      // ikke er tilgjengelig.

    }

  }


  /* =======================================================
     7. KLARGJØR UTVIDBAR MENY
     ======================================================= */

  function initializeToolsMenu(menu) {

    const toolsSection = menu.querySelector(
      "[data-tools-section]"
    );

    if (!toolsSection) {
      return;
    }

    if (
      toolsSection.dataset.menuInitialized ===
      "true"
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
     8. EKSTERNE LENKER
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
     9. KLARGJØR EN MENY
     ======================================================= */

  function initializeMenu(menu, copied = false) {

    if (!menu) return;

    if (copied) {

      // Undersider bruker absolutte stier.

      fixLinks(menu);

    }

    // Marker aktiv side.

    setActivePage(menu);

    // Aktiver hjelpemiddelmenyen.

    initializeToolsMenu(menu);

    // Sikre trygg åpning av eksterne sider.

    initializeExternalLinks(menu);

  }


  /* =======================================================
     10. LAST FELLESMENY PÅ UNDERSIDER
     ======================================================= */

  async function loadSharedMenu() {

    const target = document.getElementById(
      "shared-menu"
    );

    // Dersom vi er på fremsiden, finnes
    // navigasjonen allerede direkte i HTML.

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
          `Kunne ikke hente fremsiden. ` +
          `HTTP-status: ${response.status}`
        );

      }

      const html = await response.text();

      const parser = new DOMParser();

      const documentCopy =
        parser.parseFromString(
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

      // Lag en kopi til undersiden.

      const menu = sourceMenu.cloneNode(
        true
      );

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
     11. OPPSTART
     ======================================================= */

  function initializeSharedNavigation() {

    // Last nødvendig CSS.

    loadMenuStyles();

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
