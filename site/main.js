// ALLINKAY project website: wakes the live app, plays the 30-second story and draws the vital-sign trace.

const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---- The live app sleeps on a free plan; asking for /health wakes it while the visitor reads. ---- */
const APP = "https://allinkay.onrender.com";
// Served by the app itself (under /site/), the page asks its own origin, as the app's security
// policy allows; served anywhere else (such as GitHub Pages), it asks the live app.
const HEALTH = window.location.pathname.startsWith("/site/") ? "/health" : `${APP}/health`;

async function wakeApp() {
  const status = document.getElementById("app-status");
  try {
    const response = await fetch(HEALTH, { cache: "no-store" });
    if (response.ok && status) {
      status.textContent = "The live app is ready. It runs a simulated Mars mission: one second is one hour.";
      status.classList.add("ready");
    }
  } catch {
    // Still waking up or unreachable; the request alone is enough to wake it.
    if (status) status.textContent = "The live app is waking up; the first visit can take up to a minute.";
  }
}

/* ---- The 30-second story: seven acts, captions, play and pause, steps, keyboard. ---- */
function initPlayer(root) {
  const stage = root.querySelector("[data-stage]");
  const acts = [...root.querySelectorAll("[data-act]")];
  const durations = acts.map((act) => Number(act.dataset.duration) * 1000);
  const total = durations.reduce((sum, d) => sum + d, 0);
  const dots = root.querySelector("[data-dots]");
  const clock = root.querySelector("[data-clock]");
  const playButton = root.querySelector("[data-play]");
  const record = new URLSearchParams(window.location.search).has("record");

  let index = 0;
  let inAct = 0;
  let playing = false;
  let ended = false;
  let userPaused = false;
  let last = 0;
  let frame = 0;

  const dotButtons = acts.map((act, i) => {
    const item = document.createElement("li");
    item.style.setProperty("--w", String(durations[i]));
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", act.getAttribute("aria-label"));
    button.addEventListener("click", () => go(i));
    item.append(button);
    dots.append(item);
    return button;
  });

  const clockText = (ms) => `00:${String(Math.min(Math.floor(ms / 1000), 99)).padStart(2, "0")}`;

  function show() {
    acts.forEach((act, i) => {
      const on = i === index;
      act.classList.toggle("on", on);
      act.toggleAttribute("inert", !on);
      act.setAttribute("aria-hidden", String(!on));
    });
    dotButtons.forEach((button, i) => button.setAttribute("aria-current", i === index ? "step" : "false"));
  }

  function render() {
    dotButtons.forEach((button, i) => {
      const share = i < index ? 1 : i > index ? 0 : Math.min(inAct / durations[i], 1);
      button.style.setProperty("--p", share.toFixed(3));
    });
    const before = durations.slice(0, index).reduce((sum, d) => sum + d, 0);
    clock.textContent = `${clockText(before + inAct)} / ${clockText(total)}`;
  }

  // The real captures drift slowly while their act plays, like a camera holding on a screen.
  function moveCamera() {
    acts.forEach((act) => act.classList.remove("playing"));
    const act = acts[index];
    act.style.setProperty("--act-ms", `${durations[index]}ms`);
    if (playing && !REDUCE) {
      void act.offsetWidth;
      act.classList.add("playing");
    }
  }

  function go(i) {
    index = (i + acts.length) % acts.length;
    inAct = 0;
    ended = false;
    show();
    moveCamera();
    render();
  }

  function tick(now) {
    if (!playing) return;
    inAct += now - last;
    last = now;
    if (inAct >= durations[index]) {
      if (index < acts.length - 1) {
        go(index + 1);
      } else {
        inAct = durations[index];
        render();
        pause();
        ended = true;
        return;
      }
    }
    render();
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (ended) go(0);
    playing = true;
    root.classList.add("is-playing");
    playButton.setAttribute("aria-label", "Pause");
    last = performance.now();
    moveCamera();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    root.classList.remove("is-playing");
    playButton.setAttribute("aria-label", "Play");
    cancelAnimationFrame(frame);
  }

  playButton.addEventListener("click", () => {
    if (playing) {
      userPaused = true;
      pause();
    } else {
      userPaused = false;
      play();
    }
  });
  root.querySelector("[data-prev]").addEventListener("click", () => go(index - 1));
  root.querySelector("[data-next]").addEventListener("click", () => go(index + 1));
  stage.addEventListener("keydown", (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      playButton.click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    }
  });

  show();
  render();

  if (record) {
    // ?record shows only the stage and plays it once from the start, for the demo video.
    document.body.classList.add("record");
    play();
    return;
  }
  if (REDUCE || !("IntersectionObserver" in window)) return;
  // It plays by itself while it is in view, unless the visitor paused it, and stops when it leaves.
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !userPaused && !ended && !playing) play();
      else if (!entry.isIntersecting && playing) pause();
    },
    { threshold: 0.6 },
  ).observe(stage);
}

/* ---- The trace: one vital-sign line down the page that beats at every section. ---- */
function initTrace() {
  const wrap = document.querySelector(".trace");
  if (!wrap) return;
  const svg = wrap.querySelector("svg");
  const line = svg.querySelector(".trace-line");
  const ghost = svg.querySelector(".trace-ghost");
  const head = svg.querySelector(".trace-head");
  const alertGroup = svg.querySelector(".trace-alerts");
  const NS = "http://www.w3.org/2000/svg";
  let length = 0;
  let samples = [];
  let alerts = [];
  let minDrawn = 0;
  let scheduled = false;

  // One heartbeat drawn along a vertical line: a small P wave, a sharp QRS spike and a T wave.
  function beat(x, y, amp) {
    return [
      `L ${x} ${y}`,
      `Q ${x + 5} ${y + 5} ${x} ${y + 10}`,
      `L ${x} ${y + 15}`,
      `L ${x - 4} ${y + 19}`,
      `L ${x + amp} ${y + 26}`,
      `L ${x - amp * 0.38} ${y + 33}`,
      `L ${x} ${y + 39}`,
      `L ${x} ${y + 46}`,
      `Q ${x + 8} ${y + 54} ${x} ${y + 62}`,
    ].join(" ");
  }

  function build() {
    const box = wrap.getBoundingClientRect();
    const top = box.top + window.scrollY;
    const width = wrap.offsetWidth;
    const height = wrap.offsetHeight;
    if (!width || !height) return;
    const x = Math.round(width * 0.5);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // Calm beats stay small; the change, the storm and the proof spike well past them.
    const AMP = { calm: 0.16, alert: 0.44, storm: 0.5, confirm: 0.44, end: 0.24 };
    const OVERLAY = { alert: "warn", storm: "crit" };
    const anchors = [...document.querySelectorAll("[data-beat]")].map((el) => {
      const r = el.getBoundingClientRect();
      const kind = el.dataset.beat;
      const offset = Number(el.dataset.beatOffset ?? 70);
      const y = kind === "start" ? r.bottom + window.scrollY - top : r.top + window.scrollY - top + offset;
      return { y: Math.max(0, Math.round(y)), kind, el };
    });
    const startAnchor = anchors.find((a) => a.kind === "start");
    let d;
    let startY = 0;
    if (startAnchor) {
      // The trace leaves the hero capture from its lower left corner, runs under the hero and turns down the gutter.
      const shot = startAnchor.el.querySelector("img") ?? startAnchor.el;
      const s = shot.getBoundingClientRect();
      const heroCopy = document.querySelector(".hero-copy")?.getBoundingClientRect();
      const capX = Math.round(s.left - box.left + 28);
      const capY = Math.round(s.bottom + window.scrollY - top);
      const lowest = Math.max(startAnchor.y, heroCopy ? heroCopy.bottom + window.scrollY - top : 0);
      startY = Math.round(lowest + 30);
      const turn = 12;
      d = `M ${capX} ${capY} L ${capX} ${startY - turn} Q ${capX} ${startY} ${capX - turn} ${startY} L ${x + turn} ${startY} Q ${x} ${startY} ${x} ${startY + turn}`;
    } else {
      d = `M ${x} 0`;
    }
    alerts = [];
    alertGroup.replaceChildren();
    let firstBeat = null;
    for (const a of anchors) {
      if (a.kind === "start" || a.y <= startY + 20) continue;
      const amp = Math.max(4, width * (AMP[a.kind] ?? AMP.calm));
      d += ` ${beat(x, a.y, amp)}`;
      if (firstBeat === null) firstBeat = a.y;
      const tone = OVERLAY[a.kind];
      if (tone) {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", `M ${x} ${a.y} ${beat(x, a.y, amp)}`);
        path.setAttribute("class", tone);
        alertGroup.append(path);
        alerts.push({ y: a.y, path });
      }
    }
    d += ` L ${x} ${height}`;
    line.setAttribute("d", d);
    ghost.setAttribute("d", d);
    length = line.getTotalLength();
    samples = [];
    const steps = 480;
    for (let i = 0; i <= steps; i++) {
      const at = (length * i) / steps;
      samples.push({ at, y: line.getPointAtLength(at).y });
    }
    // On load the stretch from the hero down through the story's first beat is already lit.
    const litTo = (firstBeat ?? startY) + 70;
    minDrawn = samples.find((p) => p.y >= litTo)?.at ?? 0;
    if (REDUCE) {
      line.style.strokeDasharray = "none";
      head.style.display = "none";
      alerts.forEach((a) => a.path.classList.add("lit"));
      return;
    }
    line.style.strokeDasharray = `${length}`;
    update();
  }

  // The pen sits a little below the middle of the viewport, so the line arrives as you read.
  function update() {
    scheduled = false;
    if (!length || REDUCE) return;
    const box = wrap.getBoundingClientRect();
    const pen = window.innerHeight * 0.62 - box.top;
    let drawn = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i].y >= pen) {
        const a = samples[i - 1];
        const b = samples[i];
        const t = b.y === a.y ? 1 : (pen - a.y) / (b.y - a.y);
        drawn = a.at + (b.at - a.at) * Math.min(Math.max(t, 0), 1);
        break;
      }
      drawn = samples[i].at;
    }
    if (pen <= samples[0]?.y) drawn = 0;
    drawn = Math.max(drawn, minDrawn);
    line.style.strokeDashoffset = `${length - drawn}`;
    const point = line.getPointAtLength(Math.max(drawn, 0.01));
    head.setAttribute("cx", point.x.toFixed(1));
    head.setAttribute("cy", point.y.toFixed(1));
    head.style.opacity = drawn > 0 && drawn < length - 1 ? "1" : "0";
    const tip = point.y;
    alerts.forEach((a) => a.path.classList.toggle("lit", tip > a.y + 30));
  }

  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("load", build);
  if ("ResizeObserver" in window) new ResizeObserver(() => build()).observe(document.querySelector("main"));
  build();
}

/* ---- The section in view is marked in the top bar. ---- */
function initNav() {
  const links = new Map([...document.querySelectorAll(".nav a")].map((a) => [a.getAttribute("href").slice(1), a]));
  if (!("IntersectionObserver" in window) || links.size === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const link = links.get(entry.target.id);
        if (link && entry.isIntersecting) {
          links.forEach((a) => a.removeAttribute("aria-current"));
          link.setAttribute("aria-current", "true");
        }
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

document.querySelectorAll("[data-player]").forEach(initPlayer);
initTrace();
initNav();
wakeApp();
