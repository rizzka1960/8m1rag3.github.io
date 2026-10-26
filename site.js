/* ============================================================
   НАСТРОЙКИ — меняйте здесь
   ============================================================ */

// Момент следующего «сигнала» для обратного отсчёта (UTC).
const NEXT_SIGNAL = "2026-11-01T03:30:01Z";

// Аналитика GoatCounter (без cookie). Код сайта из goatcounter.com, например "8m1rag3".
// Пустая строка — аналитика выключена.
const GOATCOUNTER = "";

// Данные загадок (только шифротексты) лежат в puzzles-data.js и собираются генератором
// вне репозитория: Документы\8m1rag3-secrets\gen.mjs. Ответов в публичном коде нет.

/* ============================================================ */

(function () {
  const root = document.documentElement;
  const DATA = typeof PUZZLE_DATA === "undefined" ? null : PUZZLE_DATA;

  // ---------- analytics ----------
  if (GOATCOUNTER && location.hostname.endsWith("github.io")) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://gc.zgo.at/count.js";
    s.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
    document.head.appendChild(s);
  }
  function track(name) {
    try { window.goatcounter && window.goatcounter.count && window.goatcounter.count({ path: name, event: true }); } catch (e) {}
  }

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
  function flash(ms) {
    document.body.classList.add("flash");
    setTimeout(() => document.body.classList.remove("flash"), ms || 140);
  }
  function disturb() {
    if (Math.random() < .35) flash();
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

  // ---------- crypto: slow key derivation + authenticated decryption ----------
  // A wrong answer fails AES-GCM authentication, so nothing in the code reveals the answer,
  // and every guess costs a full PBKDF2 run.
  const te = new TextEncoder(), td = new TextDecoder();
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const norm = s => s.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
  async function derive(secret, salt, iterations) {
    const base = await crypto.subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base,
      { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  }
  async function open(key, blob) {
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.i) }, key, unb64(blob.c));
      return td.decode(pt);
    } catch (e) { return null; }
  }

  // ---------- puzzle key form ----------
  const form = document.querySelector(".keyform");
  if (form && DATA) {
    const verdict = document.querySelector(".verdict");
    const btn = form.querySelector("button");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const val = norm(form.key.value);
      if (!val || btn.disabled) return;
      btn.disabled = true;
      verdict.textContent = "···";
      const key = await derive(val, unb64(DATA.keys.s), DATA.iter);
      let hit = null;
      for (const blob of DATA.keys.list) { hit = await open(key, blob); if (hit) break; }
      btn.disabled = false;
      if (hit) {
        const { page, k } = JSON.parse(hit);
        track("key-accepted/" + page);
        location.href = `${page}#${k}`;
        return;
      }
      verdict.textContent = root.dataset.lang === "ru" ? "НЕВЕРНО. ПОПРОБУЙ ЕЩЁ РАЗ." : "INCORRECT. TRY AGAIN.";
      form.classList.remove("shake"); void form.offsetWidth; form.classList.add("shake");
      flash();
    });
  }

  // ---------- sealed level pages: content decrypts only with the secret from the link ----------
  const sealed = document.querySelector(".sealed[data-page]");
  if (sealed && DATA) {
    const page = sealed.dataset.page, blob = DATA.pages[page], k = location.hash.slice(1);
    if (blob && k) {
      derive(k, te.encode(page), 1).then(key => open(key, blob)).then(html => {
        if (html) { sealed.innerHTML = html; track("level-open/" + page); }
      });
    }
  }

  // ---------- I · lift panel ----------
  const panel = document.querySelector(".panel");
  if (panel && DATA) {
    const display = panel.querySelector(".display");
    const b13 = panel.querySelector(".b13");
    const reveal = document.querySelector(".reveal");
    const pressed = [];
    let liftKey = null, attempt = 0, timer = null;

    async function showReveal() {
      const text = await open(liftKey, DATA.lift[root.dataset.lang]);
      reveal.querySelector(".reveal-text").textContent = text || "";
    }
    async function check(seq, id) {
      display.textContent = "··";
      const key = await derive("8M1RAG3:" + seq, unb64(DATA.lift.s), DATA.iter);
      if (id !== attempt) return;
      if (await open(key, DATA.lift.en)) {
        liftKey = key;
        flash(180);
        display.textContent = "??";
        b13.hidden = false;
        track("lift-solved");
      } else {
        display.textContent = seq.split("-").pop().padStart(2, "0");
      }
    }

    panel.querySelectorAll(".buttons button").forEach(btn => btn.addEventListener("click", () => {
      const f = btn.dataset.floor;
      display.textContent = f.padStart(2, "0");
      btn.classList.add("lit");
      setTimeout(() => btn.classList.remove("lit"), 600);
      pressed.push(f);
      if (pressed.length > 3) pressed.shift();
      if (liftKey || pressed.length < 3) return;
      // wait until the rider stops pressing, then let the car "think"
      const id = ++attempt, seq = pressed.join("-");
      clearTimeout(timer);
      timer = setTimeout(() => check(seq, id), 450);
    }));

    b13.addEventListener("click", async () => {
      if (!liftKey) return;
      display.textContent = "13";
      panel.classList.add("arrive");
      await showReveal();
      reveal.hidden = false;
      reveal.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.addEventListener("langchange", () => { if (liftKey && !reveal.hidden) showReveal(); });
  }

  // ---------- for those who open the console ----------
  console.log("%c8M1RAG3", "font:700 36px monospace;letter-spacing:8px;color:#a9d6ff;text-shadow:0 0 12px #3d8fe0");
  console.log("%cYou are looking beneath the surface. Good. Now look at the reflection.", "font:14px monospace;color:#888");
})();
