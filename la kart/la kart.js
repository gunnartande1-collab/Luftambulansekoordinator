
/* ==========================================
   NORGESKART LA OG RH
   ZOOM OG FLYTTING
   ========================================== */

(() => {
  "use strict";

  const viewport = document.getElementById("kartViewport");
  const image = document.getElementById("kartBilde");

  if (!viewport || !image) return;

  const MIN_SCALE = 1;
  const MAX_SCALE = 6;
  const ZOOM_SPEED = 0.0015;

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const pointers = new Map();
  let pinchDistance = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function limitOffsets() {
    const rect = viewport.getBoundingClientRect();

    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;

    offsetX = clamp(offsetX, -maxX, maxX);
    offsetY = clamp(offsetY, -maxY, maxY);
  }

  function render() {
    limitOffsets();

    image.style.transform =
      `translate(calc(-50% + ${offsetX}px), ` +
      `calc(-50% + ${offsetY}px)) scale(${scale})`;
  }

  function zoomAt(clientX, clientY, factor) {
    const rect = viewport.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = clientX - centerX;
    const mouseY = clientY - centerY;

    const oldScale = scale;
    const newScale = clamp(
      oldScale * factor,
      MIN_SCALE,
      MAX_SCALE
    );

    if (newScale === oldScale) return;

    const ratio = newScale / oldScale;

    offsetX = mouseX - (mouseX - offsetX) * ratio;
    offsetY = mouseY - (mouseY - offsetY) * ratio;

    scale = newScale;

    render();
  }

  // ZOOM MED MUSEHJUL

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();

    const factor = Math.exp(
      -event.deltaY * ZOOM_SPEED
    );

    zoomAt(event.clientX, event.clientY, factor);
  }, { passive: false });

  // FLYTT MED MUS / BERØRING

  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    viewport.setPointerCapture(event.pointerId);

    if (pointers.size === 1) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewport.classList.add("dragging");
    } else {
      dragging = false;
      viewport.classList.remove("dragging");
      pinchDistance = null;
    }
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;

    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (pointers.size === 2) {
      const points = [...pointers.values()];

      const distance = Math.hypot(
        points[1].x - points[0].x,
        points[1].y - points[0].y
      );

      const centerX = (points[0].x + points[1].x) / 2;
      const centerY = (points[0].y + points[1].y) / 2;

      if (pinchDistance !== null && pinchDistance > 0) {
        zoomAt(
          centerX,
          centerY,
          distance / pinchDistance
        );
      }

      pinchDistance = distance;
      return;
    }

    if (!dragging || pointers.size !== 1) return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;

    lastX = event.clientX;
    lastY = event.clientY;

    if (scale > 1) {
      offsetX += dx;
      offsetY += dy;
      render();
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);

    pinchDistance = null;
    dragging = false;

    viewport.classList.remove("dragging");

    if (pointers.size === 1) {
      const remaining = [...pointers.values()][0];
      lastX = remaining.x;
      lastY = remaining.y;
      dragging = true;
      viewport.classList.add("dragging");
    }
  }

  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("lostpointercapture", endPointer);

  // DOBBELTKLIKK = TILBAKESTILL

  viewport.addEventListener("dblclick", (event) => {
    event.preventDefault();

    scale = 1;
    offsetX = 0;
    offsetY = 0;

    render();
  });

  // JUSTER VED ENDRING AV SKJERMSTØRRELSE

  window.addEventListener("resize", render);

  render();
})();
