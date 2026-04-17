// RoboArena - DEBUG Game Engine
// Every step is logged to find EXACT failure point

console.log("[ENGINE] file loaded");

function log(step, data) {
  console.log(`[ENGINE] ${step}`, data ?? "");
}

// ─────────────────────────────────────────────
// TOAST (safe)
// ─────────────────────────────────────────────

function showToast(message, type) {
  log("toast", { message, type });

  if (window._showToast) {
    window._showToast(message, type);
    return;
  }

  const toast = document.createElement('div');

  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:10px 18px;background:#111;color:#0f0;
    border:1px solid #0f0;font-family:monospace;
  `;

  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ─────────────────────────────────────────────
// ARENA CORE
// ─────────────────────────────────────────────

const Arena = {
  gameId: window.GAME_ID,
  gameName: window.GAME_NAME,
  isLogged: window.IS_LOGGED,
  score: 0,
  startTime: null,
  running: false,

  getContainer() {
    const el = document.getElementById("gameContainer");
    log("getContainer", el);
    return el;
  },

  show(id) {
    log("show()", id);

    ["gameStart", "gameContainer", "gameResult"].forEach(x => {
      const el = document.getElementById(x);
      log("toggle element", { id: x, exists: !!el });

      if (!el) return;

      el.style.display = (x === id) ? "flex" : "none";
    });
  },

  start() {
    log("Arena.start called");

    this.score = 0;
    this.startTime = Date.now();
    this.running = true;

    this.show("gameContainer");

    const container = this.getContainer();
    log("container after start", container);
  },

  end(result, score) {
    log("Arena.end called", { result, score });

    this.running = false;
    this.score = score ?? this.score;

    const ri = document.getElementById("resultIcon");
    const rt = document.getElementById("resultTitle");
    const rm = document.getElementById("resultMsg");
    const rs = document.getElementById("resultScore");

    log("result elements", {
      ri: !!ri,
      rt: !!rt,
      rm: !!rm,
      rs: !!rs
    });

    if (ri) ri.textContent = result;
    if (rt) rt.textContent = result;
    if (rm) rm.textContent = "debug";
    if (rs) rs.textContent = this.score;

    this.show("gameResult");
  }
};

window.Arena = Arena;

// ─────────────────────────────────────────────
// START GAME
// ─────────────────────────────────────────────

window.startGame = function () {
  log("startGame CALLED");

  Arena.start();

  const container = Arena.getContainer();

  log("container in startGame", container);

  if (!container) {
    console.error("[ENGINE] ❌ gameContainer NOT FOUND");
    return;
  }

  container.innerHTML = `
    <div style="text-align:center;padding:40px">
      <h2>DEBUG MODE</h2>
      <button id="endBtn">END TEST</button>
    </div>
  `;

  log("innerHTML injected");

  const endBtn = document.getElementById("endBtn");

  log("endBtn lookup", endBtn);

  if (endBtn) {
    endBtn.addEventListener("click", () => {
      log("endBtn CLICKED");
      Arena.end("draw", 0);
    });
  } else {
    console.error("[ENGINE] ❌ endBtn NOT FOUND");
  }
};

// ─────────────────────────────────────────────
// INIT ENGINE (VERY IMPORTANT DEBUG)
// ─────────────────────────────────────────────

function initEngine() {
  console.log("[ENGINE] initEngine");

  const startBtn = document.getElementById("startBtn");

  console.log("[ENGINE] startBtn =", startBtn);

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      console.log("[ENGINE] CLICK startBtn");
      window.startGame();
    });
  }
}

window.addEventListener("load", () => {
  console.log("[ENGINE] window load");
  initEngine();
});

// robust init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    log("DOMContentLoaded fired");
    initEngine();
  });
} else {
  log("DOM already ready");
  initEngine();
}
