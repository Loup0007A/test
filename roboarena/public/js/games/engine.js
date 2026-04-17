// RoboArena - Game Engine
// Shared infrastructure for all mini-games

// ─────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────

function showToast(message, type) {
  if (window._showToast) {
    window._showToast(message, type);
    return;
  }

  const toast = document.createElement('div');

  const colors = {
    success: 'background:#0e2a1e;border:1px solid #00ff88;color:#00ff88;',
    error: 'background:#2a0e0e;border:1px solid #ff4444;color:#ff8080;',
    info: 'background:#1a1a30;border:1px solid #444;color:#e8e8f0;'
  };

  toast.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    padding:14px 24px;border-radius:8px;font-family:'Orbitron',monospace;
    font-size:0.88rem;max-width:320px;
    box-shadow:0 8px 32px rgba(0,0,0,0.4);
    animation:toastIn 0.3s ease;
    ${colors[type] || colors.info}
  `;

  toast.textContent = message;

  if (!document.getElementById('_toastStyle')) {
    const s = document.createElement('style');
    s.id = '_toastStyle';
    s.textContent = `
      @keyframes toastIn {
        from { transform:translateX(100px); opacity:0; }
        to { transform:translateX(0); opacity:1; }
      }
    `;
    document.head.appendChild(s);
  }

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
    return document.getElementById('gameContainer');
  },

  show(elementId) {
    ['gameStart', 'gameContainer', 'gameResult'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      if (id === elementId) {
        el.style.display = 'flex';

        if (id === 'gameContainer') {
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.flexDirection = 'column';
          el.style.width = '100%';
        }
      } else {
        el.style.display = 'none';
      }
    });
  },

  start() {
    this.score = 0;
    this.startTime = Date.now();
    this.running = true;
    this.show('gameContainer');
  },

  async end(result, score) {
    this.running = false;

    this.score = (score !== undefined && score !== null)
      ? score
      : this.score;

    const duration = Math.round(
      (Date.now() - (this.startTime || Date.now())) / 1000
    );

    const icons = {
      win: '🏆',
      loss: '😔',
      draw: '🤝'
    };

    const titles = {
      win: 'Victoire !',
      loss: 'Défaite...',
      draw: 'Égalité !'
    };

    const msgs = {
      win: 'Tu as battu le robot ! Bien joué.',
      loss: 'Le robot a gagné cette fois. Réessaie !',
      draw: 'Match nul. Revanche ?'
    };

    const ri = document.getElementById('resultIcon');
    const rt = document.getElementById('resultTitle');
    const rm = document.getElementById('resultMsg');
    const rs = document.getElementById('resultScore');

    if (ri) ri.textContent = icons[result] || '🤝';
    if (rt) rt.textContent = titles[result] || 'Fin';
    if (rm) rm.textContent = msgs[result] || '';
    if (rs) rs.textContent = this.score;

    this.show('gameResult');

    if (this.isLogged) {
      try {
        const res = await fetch(`/games/${this.gameId}/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: this.score,
            result,
            duration
          })
        });

        const data = await res.json();
        if (data.success) {
          showToast(
            data.message,
            result === 'win' ? 'success' : 'info'
          );
        }
      } catch (e) {
        console.error("Score save failed", e);
      }
    }
  },

  addScore(points) {
    this.score += (points || 0);
  }
};

window.Arena = Arena;

// ─────────────────────────────────────────────
// DEFAULT GAME START (fallback)
// ─────────────────────────────────────────────

window.startGame = function () {
  Arena.start();

  Arena.getContainer().innerHTML = `
    <div style="text-align:center;padding:40px">
      <div style="font-size:3rem;margin-bottom:20px">🔧</div>
      <h2 style="font-family:'Orbitron',monospace;color:#00ff88">
        Jeu en construction
      </h2>
      <p style="color:#9090b0;margin:12px 0 24px">
        Ce jeu arrive bientôt !
      </p>
      <button id="endBtn"
        style="padding:12px 28px;border-radius:8px;
        background:#00ff88;color:#080813;
        font-family:'Orbitron',monospace;
        border:none;cursor:pointer;font-weight:700">
        Terminer
      </button>
    </div>
  `;

  const endBtn = document.getElementById("endBtn");

  if (endBtn) {
    endBtn.addEventListener("click", () => {
      Arena.end('draw', 0);
    });
  }
};

// ─────────────────────────────────────────────
// BUTTON BINDING (FIX FINAL)
// ─────────────────────────────────────────────

function initEngine() {
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      startGame();
    });
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      startGame();
    });
  }
}

// Important: works even if DOM already loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initEngine);
} else {
  initEngine();
}
