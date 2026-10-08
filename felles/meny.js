
/* ==========================================
   FELLES VENSTREMENY
   Luftambulansekoordinator

   Fil: felles/meny.js

   Henter menyen fra fremside.html
   og viser den på alle undersider.
   ========================================== */

(() => {
  "use strict";

  // Finn adressen til denne JS-filen
  const scriptUrl = document.currentScript?.src;

  if (!scriptUrl) {
    console.error("Meny: Fant ikke meny.js");
    return;
  }

  // Finn prosjektets rotmappe
  const rootUrl = new URL("../", scriptUrl);

  // Fremsiden er kilden til fellesmenyen
  const frontUrl = new URL("fremside.html", rootUrl);

  /* ======================================
     HJELPEFUNKSJONER
     ====================================== */

  function normalizePath(url) {
    try {
      const parsed = new URL(url, window.location.href);

      let path = decodeURIComponent(parsed.pathname);

      // Fjern avsluttende skråstrek
      path = path.replace(/\/+$/, "");

      return path;
    } catch {
      return "";
    }
  }

  // Gjør relative lenker absolutte
  function fixLinks(menu) {

    menu.querySelectorAll("[href]").forEach(element => {

      const href = element.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const absoluteUrl = new URL(href, frontUrl);

        element.setAttribute("href", absoluteUrl.href);
      } catch (error) {
        console.warn("Kunne ikke rette lenke:", href);
      }

    });

    // Rett eventuelle bildebaner
    menu.querySelectorAll("[src]").forEach(element => {

      const src = element.getAttribute("src");

      if (!src) return;

      try {
        const absoluteUrl = new URL(src, frontUrl);

        element.setAttribute("src", absoluteUrl.href);
      } catch (error) {
        console.warn("Kunne ikke rette bilde:", src);
      }

    });
  }

  /* ======================================
     MARKER AKTIV SIDE
     ====================================== */

  function setActivePage(menu) {

    const currentPath = normalizePath(window.location.href);

    const links = menu.querySelectorAll(".form-nav-link");

    links.forEach(link => {

      link.classList.remove("is-active");
      link.removeAttribute("aria-current");

      const targetPath = normalizePath(link.href);

      if (targetPath === currentPath) {

        link.classList.add("is-active");
        link.setAttribute("aria-current", "page");

      }

    });

  }

  /* ======================================
     LAST FELLESMENY
     ====================================== */

  async function loadSharedMenu() {

    // Finn plassen hvor menyen skal vises
    const target = document.getElementById("shared-menu");

    // Hvis siden ikke har shared-menu,
    // skal vi ikke gjøre noe.
    if (!target) {
      return;
    }

    try {

      const response = await fetch(frontUrl.href, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw new Error(
          `Kunne ikke hente fremside.html (${response.status})`
        );
      }

      const html = await response.text();

      // Les HTML fra fremsiden
      const parser = new DOMParser();

      const doc = parser.parseFromString(
        html,
        "text/html"
      );

      // Finn selve navigasjonsmenyen
      const sourceMenu = doc.querySelector(
        "nav.form-navigation, .form-navigation"
      );

      if (!sourceMenu) {
        throw new Error(
          "Fant ikke .form-navigation i fremside.html"
        );
      }

      // Lag en kopi av menyen
      const menu = sourceMenu.cloneNode(true);

      // Unngå dupliserte ID-er
      menu.removeAttribute("id");

      // Rett lenker og bilder
      fixLinks(menu);

      // Marker riktig aktiv side
      setActivePage(menu);

      // Fjern eventuelt gammelt innhold
      target.replaceChildren();

      // Sett inn menyen
      target.appendChild(menu);

    } catch (error) {

      console.error(
        "Feil ved lasting av fellesmeny:",
        error
      );

      target.textContent =
        "Kunne ikke laste menyen.";

    }

  }

  /* ======================================
     START
     ====================================== */

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      loadSharedMenu,
      { once: true }
    );

  } else {

    loadSharedMenu();

  }

})();
