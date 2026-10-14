(function () {
  const gallery = document.getElementById("gallery");
  const tilts = [-1.5, 1, -0.5, 1.5, -1, 0.5];
  const isVideo = (src) => /\.(mp4|webm|mov|m4v)$/i.test(src);

  // Song section
  const songEl = document.getElementById("song");
  let songVideo = null;
  if (typeof SONG !== "undefined" && songEl) {
    songEl.innerHTML = `
      <h2 class="song-title"></h2>
      <p class="song-sub"></p>
      <div class="song-player"></div>
      <details class="song-lyrics">
        <summary>📝 מילות השיר</summary>
        <div class="lyrics-body"></div>
      </details>`;
    songEl.querySelector(".song-title").textContent = SONG.title || "";
    songEl.querySelector(".song-sub").textContent = SONG.subtitle || "";
    const player = songEl.querySelector(".song-player");
    if (SONG.video) {
      songVideo = document.createElement("video");
      songVideo.controls = true;
      songVideo.playsInline = true;
      songVideo.preload = "metadata";
      if (SONG.poster) songVideo.poster = SONG.poster;
      songVideo.src = SONG.video + (SONG.poster ? "" : "#t=0.1");
      player.appendChild(songVideo);
    } else {
      player.innerHTML = `<div class="song-soon"><span class="soon-icon">🎬</span><strong>הקליפ בדרך...</strong><span>עוד קצת סבלנות, זה שווה את זה</span></div>`;
    }
    // Lyrics: blank line = new stanza, "# " = section heading
    const body = songEl.querySelector(".lyrics-body");
    (SONG.lyrics || "").trim().split(/\n\s*\n/).forEach((stanza) => {
      const div = document.createElement("div");
      div.className = "stanza";
      stanza.split("\n").forEach((line) => {
        const el = document.createElement(line.startsWith("#") ? "h3" : "p");
        let text = line.replace(/^#\s*/, "");
        // English-only lines read left-to-right; in mixed lines keep "!" glued to the English words
        if (!/[\u0590-\u05FF]/.test(text)) el.dir = "ltr";
        else text = text.replace(/([A-Za-z][!?.,)]+)/g, "$1\u200E");
        el.textContent = text;
        div.appendChild(el);
      });
      body.appendChild(div);
    });
    if (!SONG.lyrics || !SONG.lyrics.trim()) songEl.querySelector(".song-lyrics").hidden = true;
  } else if (songEl) {
    songEl.hidden = true;
  }

  // Build the cards in batches of 10; the next batch loads as you scroll near the bottom,
  // so a weak connection isn't flooded and the song clip gets the bandwidth first.
  const BATCH = 10;
  let rendered = 0;

  // Fade cards in as they scroll into view
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });

  // Play feed videos only while they're on screen (and not while the song clip plays)
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && lb.hidden) e.target.play().catch(() => {});
      else e.target.pause();
    });
  }, { threshold: 0.3 });
  const songPlaying = () => songVideo && !songVideo.paused;

  function buildCard(p, i) {
    const fig = document.createElement("figure");
    fig.className = "card";
    fig.style.setProperty("--tilt", tilts[i % tilts.length] + "deg");
    if (isVideo(p.src)) {
      // Muted + playsinline so phones allow autoplay; nothing downloads until it's on screen
      fig.classList.add("is-video");
      fig.innerHTML = `<div class="media"><video muted loop playsinline preload="none"></video><span class="badge">🔊 הקישו לסאונד</span></div><figcaption></figcaption>`;
      const v = fig.querySelector("video");
      v.addEventListener("loadedmetadata", () => v.setAttribute("data-ready", ""), { once: true });
      v.src = p.src;
    } else {
      fig.innerHTML = `<img loading="lazy" decoding="async" fetchpriority="low" alt=""><figcaption></figcaption>`;
      const img = fig.querySelector("img");
      img.classList.add("pending");                       // reserves space until the photo arrives
      img.addEventListener("load", () => img.classList.remove("pending"), { once: true });
      img.src = p.src;
      img.alt = p.caption || "";
    }
    fig.querySelector("figcaption").textContent = p.caption || "";
    fig.addEventListener("click", () => open(i));
    return fig;
  }

  const sentinel = document.createElement("div");
  sentinel.className = "load-more";
  gallery.after(sentinel);

  function renderMore() {
    const end = Math.min(rendered + BATCH, PHOTOS.length);
    for (let i = rendered; i < end; i++) {
      const fig = buildCard(PHOTOS[i], i);
      gallery.appendChild(fig);
      io.observe(fig);
      const v = fig.querySelector("video");
      if (v && !songPlaying()) vio.observe(v);
    }
    rendered = end;
    if (rendered >= PHOTOS.length) {
      more.disconnect(); sentinel.remove();
      window.removeEventListener("scroll", onScroll);
    } else {
      setTimeout(checkMore, 120);   // the new cards may still leave the end in view
    }
  }
  // Load the next batch when the end of the gallery is within ~one screen of the viewport
  function checkMore() {
    if (rendered < PHOTOS.length && sentinel.getBoundingClientRect().top < innerHeight + 900) renderMore();
  }
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    setTimeout(() => { ticking = false; checkMore(); }, 100);
  }
  const more = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) renderMore();
  }, { rootMargin: "0px 0px 900px 0px" });
  renderMore();
  more.observe(sentinel);
  window.addEventListener("scroll", onScroll, { passive: true });

  if (songVideo) songVideo.addEventListener("play", () => {
    document.querySelectorAll(".card video").forEach((v) => { vio.unobserve(v); v.pause(); });
  });
  if (songVideo) songVideo.addEventListener("pause", () => {
    document.querySelectorAll(".card video").forEach((v) => vio.observe(v));
  });

  // Lightbox
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lb-img");
  const lbVideo = document.getElementById("lb-video");
  const lbCap = document.getElementById("lb-cap");
  const lbCount = document.getElementById("lb-count");
  let current = 0;

  function show(i) {
    current = (i + PHOTOS.length) % PHOTOS.length;
    const src = PHOTOS[current].src;
    lbVideo.pause();
    if (isVideo(src)) {
      lbImg.hidden = true;
      lbImg.removeAttribute("src");
      lbVideo.hidden = false;
      lbVideo.src = src;
      lbVideo.muted = false;
      lbVideo.play().catch(() => {});
    } else {
      lbVideo.hidden = true;
      lbVideo.removeAttribute("src");
      lbVideo.load();
      lbImg.hidden = false;
      lbImg.src = src;
      lbImg.alt = PHOTOS[current].caption || "";
    }
    lbCap.textContent = PHOTOS[current].caption || "";
    lbCount.textContent = `${current + 1} מתוך ${PHOTOS.length}`;
  }
  function open(i) {
    document.querySelectorAll(".card video").forEach((v) => v.pause());
    if (songVideo) songVideo.pause();
    show(i);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function close() {
    lb.hidden = true;
    lbVideo.pause();
    lbVideo.removeAttribute("src");
    lbVideo.load();
    document.body.style.overflow = "";
    // Resume whichever feed videos are on screen
    document.querySelectorAll(".card video").forEach((v) => { vio.unobserve(v); vio.observe(v); });
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
  // (ignored for two-finger pinches and while zoomed in, so zooming doesn't change photo)
  let sx = 0, sy = 0, multi = false;
  lb.addEventListener("touchstart", (e) => {
    if (e.touches.length > 1) { multi = true; return; }
    multi = false;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (multi || (window.visualViewport && visualViewport.scale > 1.05)) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx > 0 ? 1 : -1)); // RTL: swipe right = next
    else if (dy > 90) close();
  });
})();
