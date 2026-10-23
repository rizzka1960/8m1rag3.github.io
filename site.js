/* ============================================================
   НАСТРОЙКИ — меняйте здесь
   ============================================================ */

// Момент следующего «сигнала» для обратного отсчёта (UTC).
const NEXT_SIGNAL = "2026-11-01T03:30:01Z";

// Ключи загадок: SHA-256 от ответа (в нижнем регистре, без пробелов по краям) -> страница.
// Хэш ответа получить: в консоли браузера выполнить  await mirageHash("ответ")
const PUZZLE_KEYS = {
  // "хэш": "level1.html",
};

/* ============================================================ */

(function () {
  const root = document.documentElement;

  // ---------- language ----------
  function getLang() {
    try {
      const saved = localStorage.getItem("lang");
      if (saved === "ru" || saved === "en") return saved;
    } catch (e) {}
    return (navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
  }
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l;
    try { localStorage.setItem("lang", l); } catch (e) {}
    document.querySelectorAll(".lang button").forEach(b => b.classList.toggle("on", b.dataset.set === l));
    const t = document.querySelector("title[data-ru]");
    if (t) document.title = t.dataset[l];
    document.dispatchEvent(new CustomEvent("langchange", { detail: l }));
  }
  document.querySelectorAll(".lang button").forEach(b => b.addEventListener("click", () => setLang(b.dataset.set)));
  setLang(getLang());

  // ---------- film noise ----------
  const cv = document.getElementById("noise");
  if (cv && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = cv.getContext("2d");
    const W = 160, H = 100;
    cv.width = W; cv.height = H;
    const img = ctx.createImageData(W, H);
    (function frame() {
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      setTimeout(() => requestAnimationFrame(frame), 60);
    })();
  }

  // ---------- random disturbances ----------
  const word = document.querySelector(".word:not(.reflect)");
  function disturb() {
    if (Math.random() < .35) {
      document.body.classList.add("flash");
      setTimeout(() => document.body.classList.remove("flash"), 140);
    }
    if (word) {
      word.classList.add("shiver");
      setTimeout(() => word.classList.remove("shiver"), 360);
    }
    setTimeout(disturb, 4000 + Math.random() * 9000);
  }
  setTimeout(disturb, 3000);

  // ---------- typed message ----------
  const box = document.querySelector(".message[data-typed]");
  let typingRun = 0;
  function typeMessage(lang) {
    if (!box) return;
    const src = document.querySelector(`template[data-msg="${lang}"]`);
    if (!src) return;
    const lines = Array.from(src.content.querySelectorAll("p")).map(p => p.textContent);
    const run = ++typingRun;
    box.innerHTML = "";
    let li = 0, ci = 0, p = null;
    (function step() {
      if (run !== typingRun) return;
      if (li >= lines.length) { if (p) p.classList.add("typed"); return; }
      if (!p) { p = document.createElement("p"); p.className = "typed"; box.appendChild(p); }
      p.textContent = lines[li].slice(0, ++ci);
      if (ci >= lines[li].length) {
        p.classList.remove("typed");
        li++; ci = 0; p = null;
        setTimeout(step, 650);
      } else {
        setTimeout(step, 24 + Math.random() * 50);
      }
    })();
  }
  document.addEventListener("langchange", e => typeMessage(e.detail));
  typeMessage(root.dataset.lang);

  // ---------- countdown ----------
  const cd = document.querySelector(".countdown");
  if (cd) {
    const target = Date.parse(NEXT_SIGNAL);
    const f = n => String(n).padStart(2, "0");
    const tick = () => {
      let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      if (s === 0) { document.querySelectorAll(".signal-live").forEach(e => e.hidden = false); }
      cd.querySelector("[data-d]").textContent = f(Math.floor(s / 86400)); s %= 86400;
      cd.querySelector("[data-h]").textContent = f(Math.floor(s / 3600)); s %= 3600;
      cd.querySelector("[data-m]").textContent = f(Math.floor(s / 60));
      cd.querySelector("[data-s]").textContent = f(s % 60);
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- puzzle key form ----------
  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  window.mirageHash = s => sha256(s.trim().toLowerCase());

  const form = document.querySelector(".keyform");
  if (form) {
    const verdict = document.querySelector(".verdict");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const val = form.key.value.trim().toLowerCase();
      if (!val) return;
      let page = null;
      try { page = PUZZLE_KEYS[await sha256(val)]; } catch (err) {}
      if (page) { location.href = page; return; }
      const lang = root.dataset.lang;
      verdict.textContent = lang === "ru" ? "НЕВЕРНО. ПОПРОБУЙ ЕЩЁ РАЗ." : "INCORRECT. TRY AGAIN.";
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      document.body.classList.add("flash");
      setTimeout(() => document.body.classList.remove("flash"), 140);
    });
  }

  // ---------- for those who open the console ----------
  console.log("%c8M1RAG3", "font:700 36px monospace;letter-spacing:8px;color:#a9d6ff;text-shadow:0 0 12px #3d8fe0");
  console.log("%cYou are looking beneath the surface. Good. Now look at the reflection.", "font:14px monospace;color:#888");
})();
