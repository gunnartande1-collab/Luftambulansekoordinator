/*
 * FELLES MENY
 *
 * Plassering: felles/meny.js
 *
 * Henter menyen fra fremside.html.
 * Menyen på fremsiden må ha klassen form-navigation
 * eller attributtet data-shared-menu.
 *
 * Bruk Live Server eller en webserver.
 */

(() => {
    "use strict";

    const scriptUrl = document.currentScript?.src;

    if (!scriptUrl) {
        return;
    }

    const frontUrl = new URL("../fremside.html", scriptUrl);

    async function loadSharedMenu() {
        const target = document.querySelector(
            "[data-shared-menu]"
        );

        if (
            !target ||
            location.href.split("#")[0] === frontUrl.href
        ) {
            return;
        }

        try {
            const response = await fetch(frontUrl.href, {
                cache: "no-cache",
                credentials: "same-origin"
            });

            if (!response.ok) {
                throw new Error("Fremsiden kunne ikke lastes.");
            }

            const html = await response.text();

            const documentFromFront = new DOMParser()
                .parseFromString(html, "text/html");

            const source = documentFromFront.querySelector(
                "[data-shared-menu], .form-navigation"
            );

            if (!source) {
                throw new Error(
                    "Menyen ble ikke funnet på fremsiden."
                );
            }

            const menu = source.cloneNode(true);

            menu.querySelectorAll("script").forEach((node) => {
                node.remove();
            });

            /*
             * Lenker og bilder på fremsiden har baner relativt
             * til fremsiden. Gjør dem om til fullstendige baner
             * før menyen settes inn på undersiden.
             */
            for (
                const node of menu.querySelectorAll(
                    "[href], [src]"
                )
            ) {
                for (const attribute of ["href", "src"]) {
                    if (node.hasAttribute(attribute)) {
                        const original =
                            node.getAttribute(attribute);

                        const resolved = new URL(
                            original,
                            frontUrl
                        );

                        node.setAttribute(
                            attribute,
                            resolved.href
                        );
                    }
                }
            }

            menu.querySelectorAll("a[href]").forEach((link) => {
                link.removeAttribute("aria-current");

                if (
                    new URL(link.href).pathname ===
                    location.pathname
                ) {
                    link.setAttribute(
                        "aria-current",
                        "page"
                    );
                }
            });

            target.replaceChildren(...menu.childNodes);
            target.dataset.menuLoaded = "true";

        } catch (error) {
            target.dataset.menuLoaded = "false";

            console.warn(
                "Felles meny: " + error.message
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            loadSharedMenu
        );
    } else {
        loadSharedMenu();
    }
})();