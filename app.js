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
        el.textContent = line.replace(/^#\s*/, "");
        div.appendChild(el);
      });
      body.appendChild(div);
    });
    if (!SONG.lyrics || !SONG.lyrics.trim()) songEl.querySelector(".song-lyrics").hidden = true;
  } else if (songEl) {
    songEl.hidden = true;
  }

  // Build the cards
  PHOTOS.forEach((p, i) => {
    const fig = document.createElement("figure");
    fig.className = "card";
    fig.style.setProperty("--tilt", tilts[i % tilts.length] + "deg");
    if (isVideo(p.src)) {
      // Muted + playsinline so phones allow autoplay in the feed
      fig.classList.add("is-video");
      fig.innerHTML = `<div class="media"><video muted loop playsinline preload="metadata"></video><span class="badge">🔊 הקישו לסאונד</span></div><figcaption></figcaption>`;
      fig.querySelector("video").src = p.src + "#t=0.1";
    } else {
      fig.innerHTML = `<img loading="lazy" alt=""><figcaption></figcaption>`;
      fig.querySelector("img").src = p.src;
      fig.querySelector("img").alt = p.caption || "";
    }
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

  // Play feed videos only while they're on screen
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && lb.hidden) e.target.play().catch(() => {});
      else e.target.pause();
    });
  }, { threshold: 0.3 });
  document.querySelectorAll(".card video").forEach((v) => vio.observe(v));
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
  let sx = 0, sy = 0;
  lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx > 0 ? 1 : -1)); // RTL: swipe right = next
    else if (dy > 90) close();
  });
})();
