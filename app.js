(function () {
  const gallery = document.getElementById("gallery");
  const tilts = [-1.5, 1, -0.5, 1.5, -1, 0.5];

  // Build the cards
  PHOTOS.forEach((p, i) => {
    const fig = document.createElement("figure");
    fig.className = "card";
    fig.style.setProperty("--tilt", tilts[i % tilts.length] + "deg");
    fig.innerHTML = `<img loading="lazy" alt=""><figcaption></figcaption>`;
    fig.querySelector("img").src = p.src;
    fig.querySelector("img").alt = p.caption || "";
    fig.querySelector("figcaption").textContent = p.caption || "";
    fig.addEventListener("click", () => open(i));
    gallery.appendChild(fig);
  });

  // Fade cards in as they scroll into view
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".card").forEach((c) => io.observe(c));

  // Lightbox
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbCap = document.getElementById("lb-cap");
  const lbCount = document.getElementById("lb-count");
  let current = 0;

  function show(i) {
    current = (i + PHOTOS.length) % PHOTOS.length;
    lbImg.src = PHOTOS[current].src;
    lbImg.alt = PHOTOS[current].caption || "";
    lbCap.textContent = PHOTOS[current].caption || "";
    lbCount.textContent = `${current + 1} מתוך ${PHOTOS.length}`;
  }
  function open(i) {
    show(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = "";
  }

  lb.querySelector(".lb-close").addEventListener("click", close);
  lb.querySelector(".lb-prev").addEventListener("click", (e) => { e.stopPropagation(); show(current - 1); });
  lb.querySelector(".lb-next").addEventListener("click", (e) => { e.stopPropagation(); show(current + 1); });
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") show(current - 1); // RTL: right = previous
    if (e.key === "ArrowLeft") show(current + 1);
  });

  // Swipe left/right to change photo, swipe down to close
  let sx = 0, sy = 0;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx > 0 ? 1 : -1)); // RTL: swipe right = next
    else if (dy > 90) close();
  });
})();
