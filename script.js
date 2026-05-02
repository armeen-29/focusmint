/*============================================================
       JAVASCRIPT
============================================================ */

/* ============================================================
       NAVIGATION — tab switching + home tile clicks
    ============================================================ */
(function () {
  const tabs = document.querySelectorAll(".nav-tab");
  const sections = document.querySelectorAll(".section");

  function show(id) {
    sections.forEach((s) => s.classList.remove("active"));
    tabs.forEach((t) => t.classList.remove("active"));
    document.getElementById("sec-" + id).classList.add("active");
    document
      .querySelector(`.nav-tab[data-section="${id}"]`)
      .classList.add("active");
  }

  tabs.forEach((t) =>
    t.addEventListener("click", () => show(t.dataset.section)),
  );

  // Home feature tiles
  document
    .querySelectorAll(".feature-tile[data-target]")
    .forEach((tile) =>
      tile.addEventListener("click", () => show(tile.dataset.target)),
    );
})();

/* ============================================================
       THEME TOGGLE — light / dark
    ============================================================ */
(function () {
  const html = document.documentElement;
  const btn = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  let isDark = localStorage.getItem("fm_theme") === "dark";

  function apply() {
    html.setAttribute("data-theme", isDark ? "dark" : "light");
    icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    localStorage.setItem("fm_theme", isDark ? "dark" : "light");
  }

  btn.addEventListener("click", () => {
    isDark = !isDark;
    apply();
  });
  apply(); // on load, apply saved preference
})();

/* ============================================================
       DIGITAL CLOCK
    ============================================================ */
(function () {
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const fmtBtn = document.getElementById("clock-fmt-btn");
  const secBtn = document.getElementById("clock-sec-btn");
  let is24h = false,
    showSec = true;

  function tick() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    let sfx = "";
    if (!is24h) {
      sfx = h >= 12 ? " PM" : " AM";
      h = h % 12 || 12;
    }
    timeEl.textContent =
      (is24h ? String(h).padStart(2, "0") : h) +
      ":" +
      m +
      (showSec ? ":" + s : "") +
      sfx;
    dateEl.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  fmtBtn.addEventListener("click", () => {
    is24h = !is24h;
    fmtBtn.textContent = is24h ? "Switch to 12-Hour" : "Switch to 24-Hour";
    tick();
  });
  secBtn.addEventListener("click", () => {
    showSec = !showSec;
    secBtn.textContent = showSec ? "Hide Seconds" : "Show Seconds";
    tick();
  });

  tick();
  setInterval(tick, 1000);
})();

/* ============================================================
       POMODORO TIMER
    ============================================================ */
(function () {
  const modeLbl = document.getElementById("pomo-mode-lbl");
  const timeDsp = document.getElementById("pomo-time");
  const ring = document.getElementById("ring-fill");
  const dots = document.getElementById("pomo-dots");
  const startBtn = document.getElementById("pomo-start");
  const pauseBtn = document.getElementById("pomo-pause");
  const resetBtn = document.getElementById("pomo-reset");
  const skipBtn = document.getElementById("pomo-skip");
  const saveBtn = document.getElementById("pomo-save");

  // r=84, circumference = 2π×84 ≈ 527.8
  const CIRC = 527.8;

  let cfg = loadCfg();
  let total = 0,
    left = 0,
    running = false,
    isWork = true,
    doneSessions = 0,
    tid = null;

  function loadCfg() {
    return (
      JSON.parse(localStorage.getItem("fm_pomo") || "null") || {
        work: 25,
        shortBreak: 5,
        longBreak: 15,
        rounds: 4,
      }
    );
  }
  function saveCfg() {
    cfg.work = +document.getElementById("pomo-work").value || 25;
    cfg.shortBreak = +document.getElementById("pomo-break").value || 5;
    cfg.longBreak = +document.getElementById("pomo-long").value || 15;
    cfg.rounds = +document.getElementById("pomo-rounds").value || 4;
    localStorage.setItem("fm_pomo", JSON.stringify(cfg));
  }
  function syncInputs() {
    document.getElementById("pomo-work").value = cfg.work;
    document.getElementById("pomo-break").value = cfg.shortBreak;
    document.getElementById("pomo-long").value = cfg.longBreak;
    document.getElementById("pomo-rounds").value = cfg.rounds;
  }
  function fmt(s) {
    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  }
  function updateRing() {
    ring.style.strokeDashoffset = CIRC * (1 - (total ? left / total : 1));
  }
  function renderDots() {
    dots.innerHTML = "";
    for (let i = 0; i < cfg.rounds; i++) {
      const d = document.createElement("div");
      d.className = "pomo-dot" + (i < doneSessions ? " done" : "");
      dots.appendChild(d);
    }
  }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      o.start();
      o.stop(ctx.currentTime + 0.9);
    } catch (e) {}
  }
  function setWork() {
    isWork = true;
    total = left = cfg.work * 60;
    modeLbl.textContent = "WORK SESSION";
    updateDisplay();
  }
  function setBreak(long) {
    isWork = false;
    total = left = (long ? cfg.longBreak : cfg.shortBreak) * 60;
    modeLbl.textContent = long ? "LONG BREAK" : "SHORT BREAK";
    updateDisplay();
  }
  function updateDisplay() {
    timeDsp.textContent = fmt(left);
    updateRing();
  }
  function phaseEnd() {
    running = false;
    clearInterval(tid);
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    beep();
    if (isWork) {
      doneSessions++;
      if (doneSessions >= cfg.rounds) {
        setBreak(true);
        doneSessions = 0;
      } else setBreak(false);
    } else setWork();
    renderDots();
  }

  startBtn.addEventListener("click", () => {
    if (running) return;
    running = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    tid = setInterval(() => {
      left--;
      updateDisplay();
      if (left <= 0) phaseEnd();
    }, 1000);
  });
  pauseBtn.addEventListener("click", () => {
    clearInterval(tid);
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
  });
  resetBtn.addEventListener("click", () => {
    clearInterval(tid);
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    isWork ? setWork() : setBreak(false);
  });
  skipBtn.addEventListener("click", () => {
    clearInterval(tid);
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    phaseEnd();
  });
  saveBtn.addEventListener("click", () => {
    clearInterval(tid);
    running = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    doneSessions = 0;
    saveCfg();
    setWork();
  });

  syncInputs();
  setWork();
  renderDots();
})();

/* ============================================================
       TO-DO LIST
    ============================================================ */
(function () {
  const inp = document.getElementById("todo-input");
  const addBtn = document.getElementById("todo-add");
  const listEl = document.getElementById("todo-list");
  const bar = document.getElementById("todo-bar");
  const lbl = document.getElementById("todo-lbl");
  const chips = document.querySelectorAll(".filter-chip");
  let todos = JSON.parse(localStorage.getItem("fm_todos") || "[]");
  let filter = "all";

  function save() {
    localStorage.setItem("fm_todos", JSON.stringify(todos));
  }
  function progress() {
    const d = todos.filter((t) => t.done).length,
      n = todos.length;
    bar.style.width = n ? (d / n) * 100 + "%" : "0%";
    lbl.textContent = d + " / " + n;
  }
  function render() {
    listEl.innerHTML = "";
    const vis = todos.filter(
      (t) =>
        filter === "all" ||
        (filter === "active" && !t.done) ||
        (filter === "done" && t.done),
    );
    if (!vis.length) {
      listEl.innerHTML = '<div class="todo-empty">Nothing here yet.</div>';
      return;
    }
    vis.forEach((task) => {
      const item = document.createElement("div");
      item.className = "task-item";
      const chk = document.createElement("div");
      chk.className = "task-check" + (task.done ? " checked" : "");
      chk.innerHTML = '<i class="fas fa-check"></i>';
      chk.addEventListener("click", () => {
        task.done = !task.done;
        save();
        render();
        progress();
      });
      const txt = document.createElement("span");
      txt.className = "task-text" + (task.done ? " done" : "");
      txt.textContent = task.text;
      const del = document.createElement("button");
      del.className = "task-del";
      del.innerHTML = '<i class="fas fa-trash-alt"></i>';
      del.addEventListener("click", () => {
        todos = todos.filter((t) => t.id !== task.id);
        save();
        render();
        progress();
      });
      item.append(chk, txt, del);
      listEl.appendChild(item);
    });
    progress();
  }
  function addTask() {
    const t = inp.value.trim();
    if (!t) return;
    todos.push({ id: Date.now(), text: t, done: false });
    inp.value = "";
    save();
    render();
  }
  chips.forEach((c) =>
    c.addEventListener("click", () => {
      chips.forEach((b) => b.classList.remove("active"));
      c.classList.add("active");
      filter = c.dataset.filter;
      render();
    }),
  );
  addBtn.addEventListener("click", addTask);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTask();
  });
  render();
})();

/* ============================================================
       JOURNAL NOTES
    ============================================================ */
(function () {
  const grid = document.getElementById("notes-grid");
  const newBtn = document.getElementById("notes-new");
  const expBtn = document.getElementById("notes-export");
  let notes = JSON.parse(localStorage.getItem("fm_notes") || "[]");

  function save() {
    localStorage.setItem("fm_notes", JSON.stringify(notes));
  }
  function fmtD(iso) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function render() {
    grid.innerHTML = "";
    if (!notes.length) {
      grid.innerHTML =
        '<div class="notes-empty"><i class="fas fa-feather-alt" style="font-size:2rem;display:block;margin-bottom:.7rem;opacity:.3"></i>No notes yet. Click New Note.</div>';
      return;
    }
    notes.forEach((n) => {
      const card = document.createElement("div");
      card.className = "note-card";
      const meta = document.createElement("div");
      meta.className = "note-meta";
      meta.textContent = fmtD(n.updatedAt);
      const body = document.createElement("textarea");
      body.className = "note-body";
      body.placeholder = "Write here…";
      body.value = n.content;
      body.addEventListener("input", () => {
        n.content = body.value;
        n.updatedAt = new Date().toISOString();
        meta.textContent = fmtD(n.updatedAt);
        save();
      });
      const acts = document.createElement("div");
      acts.className = "note-actions";
      const dl = document.createElement("button");
      dl.className = "note-icon-btn";
      dl.title = "Download";
      dl.innerHTML = '<i class="fas fa-download"></i>';
      dl.addEventListener("click", () => {
        const b = new Blob([n.content], { type: "text/plain" });
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(b),
          download: "Note_" + n.createdAt.split("T")[0] + ".txt",
        });
        a.click();
        URL.revokeObjectURL(a.href);
      });
      const del = document.createElement("button");
      del.className = "note-icon-btn del";
      del.innerHTML = '<i class="fas fa-trash-alt"></i>';
      del.addEventListener("click", () => {
        notes = notes.filter((x) => x.id !== n.id);
        save();
        render();
      });
      acts.append(dl, del);
      card.append(meta, body, acts);
      grid.appendChild(card);
    });
  }

  newBtn.addEventListener("click", () => {
    const n = {
      id: Date.now(),
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.unshift(n);
    save();
    render();
    const ta = grid.querySelector("textarea");
    if (ta) ta.focus();
  });
  expBtn.addEventListener("click", () => {
    if (!notes.length) {
      alert("No notes to export.");
      return;
    }
    const c = notes
      .map(
        (n, i) =>
          "=== Note " +
          (i + 1) +
          " (" +
          fmtD(n.createdAt) +
          ") ===\n" +
          n.content,
      )
      .join("\n\n");
    const b = new Blob([c], { type: "text/plain" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(b),
      download:
        "FocusMint_Notes_" + new Date().toISOString().split("T")[0] + ".txt",
    });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  render();
})();

/* ============================================================
       CALENDAR + EVENTS
    ============================================================ */
(function () {
  const labelEl = document.getElementById("cal-label");
  const gridEl = document.getElementById("cal-grid");
  const wkdaysEl = document.getElementById("cal-weekdays");
  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  const chips = document.querySelectorAll(".view-chip");
  const selLbl = document.getElementById("cal-sel-lbl");
  const form = document.getElementById("event-form");
  const titleInp = document.getElementById("event-title");
  const noteInp = document.getElementById("event-note");
  const saveBtn = document.getElementById("event-save");
  const evListEl = document.getElementById("event-list");

  let cur = new Date(),
    view = "month",
    selDate = null;
  let evts = JSON.parse(localStorage.getItem("fm_events") || "[]");

  function saveEvts() {
    localStorage.setItem("fm_events", JSON.stringify(evts));
  }
  function toKey(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function prettyD(k) {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  function evOn(k) {
    return evts.filter((e) => e.date === k);
  }

  function renderMonth() {
    wkdaysEl.style.display = "grid";
    const y = cur.getFullYear(),
      mo = cur.getMonth(),
      today = new Date();
    labelEl.textContent = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(cur);
    const first = new Date(y, mo, 1).getDay(),
      days = new Date(y, mo + 1, 0).getDate(),
      prev = new Date(y, mo, 0).getDate();
    gridEl.className = "cal-grid";
    gridEl.innerHTML = "";
    for (let i = 0; i < first; i++) {
      const d = document.createElement("div");
      d.className = "cal-day other-month";
      d.textContent = prev - first + i + 1;
      gridEl.appendChild(d);
    }
    for (let d = 1; d <= days; d++) {
      const key = toKey(new Date(y, mo, d));
      const el = document.createElement("div");
      el.className = "cal-day";
      el.textContent = d;
      if (
        d === today.getDate() &&
        mo === today.getMonth() &&
        y === today.getFullYear()
      )
        el.classList.add("today");
      if (key === selDate) el.classList.add("selected");
      if (evOn(key).length) el.classList.add("has-event");
      el.addEventListener("click", () => {
        selDate = key;
        renderMonth();
        renderEvtPanel();
      });
      gridEl.appendChild(el);
    }
    const tr = (first + days) % 7;
    if (tr)
      for (let i = 1; i <= 7 - tr; i++) {
        const d = document.createElement("div");
        d.className = "cal-day other-month";
        d.textContent = i;
        gridEl.appendChild(d);
      }
  }

  function renderWeek() {
    wkdaysEl.style.display = "none";
    const today = new Date(),
      sun = new Date(cur);
    sun.setDate(cur.getDate() - cur.getDay());
    labelEl.textContent =
      "Week of " +
      sun.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    gridEl.className = "cal-week-grid";
    gridEl.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(sun);
      d.setDate(sun.getDate() + i);
      const k = toKey(d);
      const col = document.createElement("div");
      col.className = "week-day-col";
      if (toKey(d) === toKey(today)) col.classList.add("today");
      col.innerHTML =
        '<div class="wday-name">' +
        d.toLocaleDateString("en-US", { weekday: "short" }) +
        '</div><div class="wday-num">' +
        d.getDate() +
        "</div>";
      evOn(k).forEach((ev) => {
        const c = document.createElement("div");
        c.className = "week-event-chip";
        c.textContent = ev.title;
        col.appendChild(c);
      });
      col.addEventListener("click", () => {
        selDate = k;
        renderEvtPanel();
      });
      gridEl.appendChild(col);
    }
  }

  function renderEvtPanel() {
    if (selDate) {
      selLbl.textContent = "Selected: " + prettyD(selDate);
      form.style.display = "flex";
    } else {
      selLbl.textContent = "Click a day to add or view events.";
      form.style.display = "none";
    }
    const sorted = [...evts].sort((a, b) => a.date.localeCompare(b.date));
    evListEl.innerHTML = "";
    if (!sorted.length) {
      evListEl.innerHTML = '<div class="events-empty">No events yet.</div>';
      return;
    }
    sorted.forEach((ev) => {
      const item = document.createElement("div");
      item.className = "event-item";
      const txt = document.createElement("div");
      txt.className = "event-item-text";
      txt.innerHTML =
        '<div class="ev-date">' +
        prettyD(ev.date) +
        '</div><div class="ev-title">' +
        ev.title +
        "</div>" +
        (ev.note ? '<div class="ev-note">' + ev.note + "</div>" : "");
      const del = document.createElement("button");
      del.className = "event-del";
      del.innerHTML = '<i class="fas fa-times"></i>';
      del.addEventListener("click", () => {
        evts = evts.filter((e) => e.id !== ev.id);
        saveEvts();
        view === "month" ? renderMonth() : renderWeek();
        renderEvtPanel();
      });
      item.append(txt, del);
      evListEl.appendChild(item);
    });
  }

  saveBtn.addEventListener("click", () => {
    const t = titleInp.value.trim();
    if (!t || !selDate) return;
    evts.push({
      id: Date.now(),
      date: selDate,
      title: t,
      note: noteInp.value.trim(),
    });
    saveEvts();
    titleInp.value = "";
    noteInp.value = "";
    view === "month" ? renderMonth() : renderWeek();
    renderEvtPanel();
  });
  titleInp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
  });

  prevBtn.addEventListener("click", () => {
    if (view === "month") cur.setMonth(cur.getMonth() - 1);
    else cur.setDate(cur.getDate() - 7);
    view === "month" ? renderMonth() : renderWeek();
  });
  nextBtn.addEventListener("click", () => {
    if (view === "month") cur.setMonth(cur.getMonth() + 1);
    else cur.setDate(cur.getDate() + 7);
    view === "month" ? renderMonth() : renderWeek();
  });
  chips.forEach((c) =>
    c.addEventListener("click", () => {
      chips.forEach((x) => x.classList.remove("active"));
      c.classList.add("active");
      view = c.dataset.view;
      view === "month" ? renderMonth() : renderWeek();
    }),
  );

  renderMonth();
  renderEvtPanel();
})();

/* ============================================================
       WEATHER WIDGET - in Hero  section
    ============================================================ */

/* ============================================================
   WEATHER WIDGET
   All API calls go to our FastAPI backend (/weather)
   The real OpenWeather key lives in backend .env — never here
============================================================ */
(function () {
  const cityInput = document.getElementById("weather-city-input");
  const searchBtn = document.getElementById("weather-search-btn");
  const displayEl = document.getElementById("weather-display");
  const heroTemp = document.getElementById("hero-weather-temp");
  const heroCity = document.getElementById("hero-weather-city");
  const heroDesc = document.getElementById("hero-weather-desc");
  const heroIcon = document.getElementById("hero-weather-icon");

  // ── Point to YOUR backend, not OpenWeatherMap directly ──
  const BACKEND = "http://localhost:8000";

  const iconMap = {
    "01d": "fa-sun",
    "01n": "fa-moon",
    "02d": "fa-cloud-sun",
    "02n": "fa-cloud-moon",
    "03d": "fa-cloud",
    "03n": "fa-cloud",
    "04d": "fa-cloud",
    "04n": "fa-cloud",
    "09d": "fa-cloud-rain",
    "09n": "fa-cloud-rain",
    "10d": "fa-cloud-sun-rain",
    "10n": "fa-cloud-moon-rain",
    "11d": "fa-bolt",
    "11n": "fa-bolt",
    "13d": "fa-snowflake",
    "13n": "fa-snowflake",
    "50d": "fa-smog",
    "50n": "fa-smog",
  };

  // ── Fetch from backend by city name ──
  async function fetchByCity(city) {
    try {
      const res = await fetch(
        `${BACKEND}/weather?city=${encodeURIComponent(city)}`,
      );
      if (!res.ok) throw new Error("City not found");
      return await res.json();
    } catch (err) {
      showError(err.message);
      return null;
    }
  }

  // ── Fetch from backend by coordinates ──
  async function fetchByCoords(lat, lon) {
    try {
      const res = await fetch(`${BACKEND}/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error("Location fetch failed");
      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  // ── Update the hero banner widget ──
  function updateHero(data) {
    if (!data) return;
    const icon = iconMap[data.weather[0].icon] || "fa-cloud";
    if (heroTemp) heroTemp.textContent = Math.round(data.main.temp) + "°C";
    if (heroCity) heroCity.textContent = data.name;
    if (heroDesc) heroDesc.textContent = data.weather[0].description;
    if (heroIcon) heroIcon.innerHTML = `<i class="fas ${icon}"></i>`;
  }

  // ── Update the full weather section page ──
  function updateDisplay(data) {
    if (!displayEl || !data) return;
    const icon = iconMap[data.weather[0].icon] || "fa-cloud";
    const wind = Math.round(data.wind.speed * 3.6);
    displayEl.innerHTML = `
      <div class="weather-icon-big"><i class="fas ${icon}"></i></div>
      <div class="weather-city-name">${data.name}, ${data.sys.country}</div>
      <div class="weather-temp-big">${Math.round(data.main.temp)}°C</div>
      <div class="weather-desc-text">${data.weather[0].description}</div>
      <div class="weather-details-row">
        <div class="weather-detail-item">
          <i class="fas fa-tint"></i>
          <span>${data.main.humidity}% humidity</span>
        </div>
        <div class="weather-detail-item">
          <i class="fas fa-wind"></i>
          <span>${wind} km/h wind</span>
        </div>
        <div class="weather-detail-item">
          <i class="fas fa-thermometer-half"></i>
          <span>Feels ${Math.round(data.main.feels_like)}°C</span>
        </div>
      </div>`;
  }

  function showError(msg) {
    if (displayEl)
      displayEl.innerHTML = `<div class="weather-placeholder">${msg}</div>`;
    if (heroCity) heroCity.textContent = "Unavailable";
  }

  // ── Auto-detect location on load ──
  function autoDetect() {
    if (heroCity) heroCity.textContent = "Detecting...";
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const data = await fetchByCoords(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          updateHero(data);
          updateDisplay(data);
        },
        () => {
          // User denied location — fall back to default
          fetchByCity("New Delhi").then((data) => {
            updateHero(data);
            updateDisplay(data);
          });
        },
      );
    } else {
      fetchByCity("New Delhi").then((data) => {
        updateHero(data);
        updateDisplay(data);
      });
    }
  }

  // ── Manual search ──
  async function handleSearch() {
    const city = cityInput?.value.trim();
    if (!city) return;
    const data = await fetchByCity(city);
    updateHero(data);
    updateDisplay(data);
  }

  if (searchBtn) searchBtn.addEventListener("click", handleSearch);
  if (cityInput)
    cityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });

  autoDetect();
})();

/* ============================================================
       WATER INTAKE TRACKER
    ============================================================ */
(function () {
  const cupsGrid = document.getElementById("cups-grid");
  const ringEl = document.getElementById("water-ring");
  const totalEl = document.getElementById("water-total");
  const subEl = document.getElementById("water-ring-sub");
  const logEl = document.getElementById("water-log");
  const goalInput = document.getElementById("water-goal-input");
  const goalSetBtn = document.getElementById("water-goal-set");
  const customInp = document.getElementById("water-custom-ml");
  const customAdd = document.getElementById("water-custom-add");
  const resetBtn = document.getElementById("water-reset");

  // SVG ring: r=70, circumference = 2π×70 ≈ 439.8
  const CIRC = 439.8;
  const NUM_CUPS = 8;

  // State stored in localStorage under 'fm_water'
  // { date:'YYYY-MM-DD', goal:2000, cups:[false*8], log:[{id,ml,time}] }
  function todayKey() {
    return new Date().toISOString().split("T")[0];
  }

  function loadState() {
    const raw = localStorage.getItem("fm_water");
    const s = raw ? JSON.parse(raw) : null;
    // If saved data is from a previous day → reset
    if (!s || s.date !== todayKey()) {
      return {
        date: todayKey(),
        goal: s ? s.goal : 2000,
        cups: Array(NUM_CUPS).fill(false),
        log: [],
      };
    }
    return s;
  }

  let state = loadState();
  goalInput.value = state.goal;

  function saveState() {
    localStorage.setItem("fm_water", JSON.stringify(state));
  }

  function totalMl() {
    // sum from log entries
    return state.log.reduce((acc, e) => acc + e.ml, 0);
  }

  function updateRing() {
    const pct = Math.min(totalMl() / state.goal, 1);
    ringEl.style.strokeDashoffset = CIRC * (1 - pct);
    totalEl.textContent = totalMl();
    subEl.textContent = "of " + state.goal + " ml";
  }

  function renderCups() {
    cupsGrid.innerHTML = "";
    for (let i = 0; i < NUM_CUPS; i++) {
      const btn = document.createElement("button");
      btn.className = "cup-btn" + (state.cups[i] ? " filled" : "");
      btn.innerHTML = '<i class="fas fa-tint"></i>';
      btn.title = "250 ml";
      btn.addEventListener("click", () => {
        if (!state.cups[i]) {
          // Add 250 ml
          state.cups[i] = true;
          state.log.push({
            id: Date.now(),
            ml: 250,
            time: new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            cupIdx: i,
          });
        } else {
          // Undo this cup
          state.cups[i] = false;
          // Remove the most recent 250 ml log entry that was from a cup
          const idx = state.log.map((e) => e.cupIdx).lastIndexOf(i);
          if (idx !== -1) state.log.splice(idx, 1);
        }
        saveState();
        renderCups();
        updateRing();
        renderLog();
      });
      cupsGrid.appendChild(btn);
    }
  }

  function renderLog() {
    logEl.innerHTML = "";
    if (!state.log.length) {
      logEl.innerHTML =
        '<div class="water-log-empty">No intake logged yet.</div>';
      return;
    }
    // Show most recent first
    [...state.log].reverse().forEach((entry) => {
      const item = document.createElement("div");
      item.className = "water-log-item";
      item.innerHTML = `<span class="log-amt"><i class="fas fa-tint" style="margin-right:.3rem"></i>${entry.ml} ml</span><span class="log-time">${entry.time}</span>`;
      const del = document.createElement("button");
      del.className = "water-log-del";
      del.innerHTML = '<i class="fas fa-times"></i>';
      del.addEventListener("click", () => {
        const idx = state.log.findIndex((e) => e.id === entry.id);
        if (idx !== -1) {
          // If from a cup, un-fill that cup
          if (entry.cupIdx !== undefined) state.cups[entry.cupIdx] = false;
          state.log.splice(idx, 1);
        }
        saveState();
        renderCups();
        updateRing();
        renderLog();
      });
      item.appendChild(del);
      logEl.appendChild(item);
    });
  }

  // Set goal
  goalSetBtn.addEventListener("click", () => {
    const g = parseInt(goalInput.value) || 2000;
    state.goal = Math.max(500, Math.min(g, 5000));
    goalInput.value = state.goal;
    saveState();
    updateRing();
  });

  // Add custom ml
  customAdd.addEventListener("click", () => {
    const ml = parseInt(customInp.value) || 0;
    if (ml <= 0) return;
    state.log.push({
      id: Date.now(),
      ml,
      time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });
    customInp.value = "";
    saveState();
    updateRing();
    renderLog();
  });
  customInp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") customAdd.click();
  });

  // Reset today
  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset today's water intake?")) return;
    state.cups = Array(NUM_CUPS).fill(false);
    state.log = [];
    saveState();
    renderCups();
    updateRing();
    renderLog();
  });

  renderCups();
  updateRing();
  renderLog();
})();

/* ============================================================
       CALCULATOR
    ============================================================ */
(function () {
  const exprEl = document.getElementById("calc-expr");
  const resultEl = document.getElementById("calc-result");

  // State: current entry string and last operator context
  let current = "0"; // what's being built/shown
  let expr = ""; // full expression string for display
  let justEq = false; // did we just press equals?

  function updateDisplay() {
    // Show current number in result, expression above
    resultEl.textContent =
      current.length > 12 ? parseFloat(current).toExponential(4) : current;
    exprEl.textContent = expr;
  }

  function safeEval(str) {
    // Replace × and ÷ with JS operators, then compute
    try {
      // Only allow digits, operators, dots, parens
      const clean = str.replace(/[^0-9+\-*/.()%]/g, "");
      // Use Function to avoid direct eval but same effect
      const result = Function('"use strict"; return (' + clean + ")")();
      return isFinite(result)
        ? String(parseFloat(result.toFixed(10)))
        : "Error";
    } catch (e) {
      return "Error";
    }
  }

  document.querySelectorAll(".calc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const val = btn.dataset.val;

      if (action === "clear") {
        current = "0";
        expr = "";
        justEq = false;
      } else if (action === "backspace") {
        if (justEq) {
          current = "0";
          expr = "";
          justEq = false;
        } else {
          current = current.length > 1 ? current.slice(0, -1) : "0";
        }
      } else if (action === "digit") {
        if (justEq) {
          current = val;
          expr = "";
          justEq = false;
        } else {
          current = current === "0" && val !== "." ? val : current + val;
        }
      } else if (action === "dot") {
        if (justEq) {
          current = "0.";
          expr = "";
          justEq = false;
        } else if (!current.includes(".")) current += ".";
      } else if (action === "op") {
        // Append current number and operator to expression
        if (justEq) {
          expr = current + val;
          current = "0";
          justEq = false;
        } else {
          // If expression ends with operator, replace it
          if (/[+\-*/]$/.test(expr)) {
            expr = expr.slice(0, -1) + val;
          } else {
            expr += (current === "0" && expr ? "" : current) + val;
            current = "0";
          }
        }
      } else if (action === "percent") {
        current = String(parseFloat(current) / 100);
      } else if (action === "negate") {
        current = current.startsWith("-")
          ? current.slice(1)
          : current === "0"
            ? "0"
            : "-" + current;
      } else if (action === "equals") {
        const full = expr + current;
        const res = safeEval(full);
        exprEl.textContent = full + " =";
        current = res;
        expr = "";
        justEq = true;
      }

      updateDisplay();
    });
  });

  // Keyboard support for calculator
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("sec-calc").classList.contains("active"))
      return;
    const map = {
      0: "0",
      1: "1",
      2: "2",
      3: "3",
      4: "4",
      5: "5",
      6: "6",
      7: "7",
      8: "8",
      9: "9",
      "+": "+",
      "-": "-",
      "*": "*",
      "/": "/",
    };
    if (map[e.key])
      document.querySelector(`.calc-btn[data-val="${map[e.key]}"]`)?.click();
    else if (e.key === ".")
      document.querySelector('.calc-btn[data-action="dot"]').click();
    else if (e.key === "Enter" || e.key === "=")
      document.querySelector('.calc-btn[data-action="equals"]').click();
    else if (e.key === "Backspace")
      document.querySelector('.calc-btn[data-action="backspace"]').click();
    else if (e.key === "Escape")
      document.querySelector('.calc-btn[data-action="clear"]').click();
  });

  updateDisplay();
})();
/* ============================================================
   HABIT TRACKER 
============================================================ */
(function () {
  const inp = document.getElementById("habit-input");
  const addBtn = document.getElementById("habit-add");
  const listEl = document.getElementById("habit-list");

  let habits = JSON.parse(localStorage.getItem("fm_habits") || "[]");

  function save() {
    localStorage.setItem("fm_habits", JSON.stringify(habits));
  }

  function todayKey() {
    return new Date().toISOString().split("T")[0];
  }

  // Returns last 7 days oldest → newest
  function last7() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }

  // Short 2-letter day label from date key
  function dayLabel(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString("en-US", { weekday: "short" })
      .slice(0, 2);
  }

  // Current streak — consecutive days ending today
  function streak(habit) {
    const done = new Set(habit.log);
    let count = 0;
    const check = new Date();
    while (true) {
      const key = check.toISOString().split("T")[0];
      if (done.has(key)) {
        count++;
        check.setDate(check.getDate() - 1);
      } else break;
    }
    return count;
  }

  function render() {
    listEl.innerHTML = "";
    if (!habits.length) {
      listEl.innerHTML = `<div class="habit-empty">
        <i class="fas fa-seedling" style="font-size:1.8rem;display:block;margin-bottom:.6rem;opacity:.3"></i>
        No habits yet — add one above.
      </div>`;
      return;
    }

    const today = todayKey();
    const days7 = last7();

    habits.forEach((habit) => {
      const doneToday = habit.log.includes(today);
      const s = streak(habit);

      const item = document.createElement("div");
      item.className = "habit-item";

      // ── Left: name + 7 dots ──
      const left = document.createElement("div");

      const name = document.createElement("div");
      name.className = "habit-name";
      name.textContent = habit.name;

      const week = document.createElement("div");
      week.className = "habit-week";
      days7.forEach((dk) => {
        const wrap = document.createElement("div");
        wrap.className = "week-dot-wrap";

        const lbl = document.createElement("div");
        lbl.className = "day-lbl";
        lbl.textContent = dayLabel(dk);

        const dot = document.createElement("div");
        dot.className =
          "streak-dot" +
          (habit.log.includes(dk) ? " done" : "") +
          (dk === today ? " today-dot" : "");

        wrap.append(lbl, dot);
        week.appendChild(wrap);
      });

      left.append(name, week);

      // ── Right: streak flame + check + delete ──
      const right = document.createElement("div");
      right.className = "habit-right";

      // Streak count — only show if > 0, keeps it clean
      if (s > 0) {
        const flame = document.createElement("div");
        flame.style.cssText =
          "font-size:.8rem;color:var(--accent);text-align:center;line-height:1.3";
        flame.innerHTML = `<i class="fas fa-fire"></i><br><span style="font-family:Cormorant Garamond,serif;font-size:1.1rem">${s}</span>`;
        right.appendChild(flame);
      }

      // Check button
      const chk = document.createElement("button");
      chk.className = "habit-check-btn" + (doneToday ? " checked-today" : "");
      chk.title = doneToday ? "Unmark today" : "Mark done today";
      chk.innerHTML = '<i class="fas fa-check"></i>';
      chk.addEventListener("click", () => {
        if (doneToday) habit.log = habit.log.filter((d) => d !== today);
        else if (!habit.log.includes(today)) habit.log.push(today);
        save();
        render();
      });

      // Delete
      const del = document.createElement("button");
      del.className = "habit-del-btn";
      del.innerHTML = '<i class="fas fa-trash-alt"></i>';
      del.addEventListener("click", () => {
        if (!confirm(`Delete "${habit.name}"?`)) return;
        habits = habits.filter((h) => h.id !== habit.id);
        save();
        render();
      });

      right.append(chk, del);
      item.append(left, right);
      listEl.appendChild(item);
    });
  }

  function addHabit() {
    const name = inp.value.trim();
    if (!name) return;
    if (habits.find((h) => h.name.toLowerCase() === name.toLowerCase())) {
      inp.placeholder = "Already exists!";
      setTimeout(() => (inp.placeholder = "Add a habit…"), 1500);
      return;
    }
    habits.push({ id: Date.now(), name, log: [] });
    inp.value = "";
    save();
    render();
  }

  addBtn.addEventListener("click", addHabit);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
  });

  render();
})();
/* ============================================================
   MINTY AI CHATBOT
============================================================ */
(function () {
  const messagesEl = document.getElementById("chat-messages");
  const typingEl = document.getElementById("chat-typing");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const clearBtn = document.getElementById("chat-clear");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const chips = document.getElementById("suggestion-chips");

  // Backend URL
  const API_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : "https://focusmint.onrender.com"; // ← Render URL

  // Unique session ID for this browser tab (new conversation per reload)
  const SESSION_ID = "fm_" + Math.random().toString(36).slice(2);

  // ── Check if backend is alive ──────────────────────────────
  async function checkHealth() {
    try {
      const r = await fetch(API_URL + "/health", {
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        statusDot.classList.add("online");
        statusText.textContent = "Online · GPT-4o-mini";
      } else {
        throw new Error();
      }
    } catch {
      statusDot.classList.remove("online");
      statusText.textContent = "Backend offline";
      appendError(
        "⚠️ Cannot reach the backend. Make sure you ran: uvicorn main:app --reload",
      );
    }
  }

  // Simple markdown renderer — handles what Minty actually outputs
  function renderMarkdown(text) {
    return (
      text
        // Escape HTML first to prevent XSS
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")

        // ### Heading 3
        .replace(
          /^### (.+)$/gm,
          '<strong style="font-size:.95rem;color:var(--accent);display:block;margin:.6rem 0 .3rem">$1</strong>',
        )

        // ## Heading 2
        .replace(
          /^## (.+)$/gm,
          '<strong style="font-size:1rem;color:var(--accent);display:block;margin:.7rem 0 .35rem">$1</strong>',
        )

        // # Heading 1
        .replace(
          /^# (.+)$/gm,
          '<strong style="font-size:1.05rem;color:var(--accent);display:block;margin:.8rem 0 .4rem">$1</strong>',
        )

        // **bold**
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

        // *italic*
        .replace(/\*(.+?)\*/g, "<em>$1</em>")

        // `inline code`
        .replace(
          /`(.+?)`/g,
          '<code style="background:var(--surface-2);padding:.1rem .35rem;border-radius:4px;font-size:.8rem;font-family:monospace">$1</code>',
        )

        // Numbered list: 1. item
        .replace(
          /^\d+\.\s(.+)$/gm,
          '<div style="display:flex;gap:.5rem;margin:.2rem 0"><span style="color:var(--accent);font-weight:500;flex-shrink:0">•</span><span>$1</span></div>',
        )

        // Bullet list: - item or * item
        .replace(
          /^[-*]\s(.+)$/gm,
          '<div style="display:flex;gap:.5rem;margin:.2rem 0"><span style="color:var(--accent);flex-shrink:0">•</span><span>$1</span></div>',
        )

        // Blank lines → spacing
        .replace(/\n\n/g, '<div style="margin:.4rem 0"></div>')

        // Single newlines → line break
        .replace(/\n/g, "<br>")
    );
  }

  // ── Append a chat bubble ───────────────────────────────────
  function appendMsg(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "chat-msg " + (role === "user" ? "user" : "bot");

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.innerHTML =
      role === "user"
        ? '<i class="fas fa-user"></i>'
        : '<i class="fas fa-leaf"></i>';

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";

    // Render markdown for bot messages, plain text for user
    if (role === "user") {
      bubble.textContent = text;
    } else {
      bubble.innerHTML = renderMarkdown(text);
    }
    wrap.append(avatar, bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrap;
  }

  function appendError(msg) {
    const el = document.createElement("div");
    el.className = "chat-error";
    el.textContent = msg;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Show / hide typing indicator ──────────────────────────
  function setTyping(visible) {
    typingEl.style.display = visible ? "block" : "none";
    if (visible) messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Send a message to the backend ─────────────────────────
  async function sendMessage(text) {
    text = text.trim();
    if (!text) return;

    // Disable input while waiting
    inputEl.value = "";
    inputEl.style.height = "44px";
    sendBtn.disabled = true;

    appendMsg("user", text);
    setTyping(true);

    try {
      const res = await fetch(API_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID, message: text }),
      });

      if (!res.ok) {
        throw new Error("Server error " + res.status);
      }

      const data = await res.json();
      setTyping(false);
      appendMsg("bot", data.reply);
    } catch (err) {
      setTyping(false);
      appendError("Something went wrong: " + err.message);
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  // ── Auto-resize textarea as user types ────────────────────
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "44px";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
  });

  // ── Send on Enter (Shift+Enter for newline) ───────────────
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputEl.value);
    }
  });

  sendBtn.addEventListener("click", () => sendMessage(inputEl.value));

  // ── Suggestion chip clicks ─────────────────────────────────
  chips.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      // Strip the emoji prefix and send just the text
      const text = chip.textContent.replace(/^[^\s]+\s/, "");
      sendMessage(text);
    });
  });

  // ── Clear conversation ─────────────────────────────────────
  clearBtn.addEventListener("click", async () => {
    if (!confirm("Clear the conversation?")) return;
    // Delete session on backend
    try {
      await fetch(`${API_URL}/chat/${SESSION_ID}`, { method: "DELETE" });
    } catch {}
    messagesEl.innerHTML = "";
    showWelcome();
  });

  // ── Welcome message ────────────────────────────────────────
  function showWelcome() {
    appendMsg(
      "bot",
      "Hi! I'm Minty 🌿 — your FocusMint AI assistant.\n\n" +
        "I can help with productivity tips, task planning, habit advice, focus strategies, and more.\n\n" +
        "What's on your mind today?",
    );
  }

  // ── Home tile for chatbot (add to feature grid) ────────────
  // (already wired via data-target="chat" in the tile HTML below)

  // ── Init ──────────────────────────────────────────────────
  checkHealth();
  showWelcome();
})();
