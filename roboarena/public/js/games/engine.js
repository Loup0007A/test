// RoboArena — Game Engine v3
// Uses CSS class toggling instead of inline display styles (more reliable)

// ── Toast (self-contained, no dependency on main.js) ──
function showToast(message, type) {
  const colors = {
    success: 'background:#0e2a1e;border:1px solid #00ff88;color:#00ff88;',
    error:   'background:#2a0e0e;border:1px solid #ff4444;color:#ff8080;',
    info:    'background:#1a1a30;border:1px solid #555;color:#e8e8f0;'
  };
  const toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:9999;' +
    'padding:14px 24px;border-radius:8px;' +
    'font-family:Orbitron,monospace;font-size:.85rem;max-width:300px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,.5);' +
    (colors[type] || colors.info);
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ── Panel switcher — uses CSS class, NOT inline styles ──
function showPanel(id) {
  var panels = ['gameStart', 'gameContainer', 'gameResult'];
  for (var i = 0; i < panels.length; i++) {
    var el = document.getElementById(panels[i]);
    if (!el) continue;
    if (panels[i] === id) {
      el.classList.remove('game-panel-hidden');
    } else {
      el.classList.add('game-panel-hidden');
    }
  }
}

// ── Arena object ──
var Arena = {
  gameId:   window.GAME_ID   || '',
  gameName: window.GAME_NAME || '',
  isLogged: window.IS_LOGGED || false,
  score:    0,
  startTime: null,
  running:  false,

  getContainer: function() {
    return document.getElementById('gameContainer');
  },

  start: function() {
    this.score     = 0;
    this.startTime = Date.now();
    this.running   = true;
    showPanel('gameContainer');
  },

  end: function(result, score) {
    this.running = false;
    if (score !== undefined && score !== null) this.score = score;

    var duration = Math.round((Date.now() - (this.startTime || Date.now())) / 1000);

    var icons  = { win:'🏆', loss:'😔', draw:'🤝' };
    var titles = { win:'Victoire !', loss:'Défaite...', draw:'Égalité !' };
    var msgs   = {
      win:  'Tu as battu le robot ! Bien joué.',
      loss: 'Le robot a gagné cette fois. Réessaie !',
      draw: 'Match nul. Revanche ?'
    };

    var ri = document.getElementById('resultIcon');
    var rt = document.getElementById('resultTitle');
    var rm = document.getElementById('resultMsg');
    var rs = document.getElementById('resultScore');
    if (ri) ri.textContent = icons[result]  || '🤝';
    if (rt) rt.textContent = titles[result] || 'Fin';
    if (rm) rm.textContent = msgs[result]   || '';
    if (rs) rs.textContent = this.score;

    showPanel('gameResult');

    // Save score if logged in
    if (this.isLogged) {
      var self = this;
      fetch('/games/' + this.gameId + '/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: self.score, result: result, duration: duration })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) showToast(data.message, result === 'win' ? 'success' : 'info');
      })
      .catch(function() {});
    }
  },

  addScore: function(points) {
    this.score += (points || 0);
  }
};

window.Arena    = Arena;
window.showPanel = showPanel;

// ── Default startGame — each game file overrides this ──
window.startGame = function() {
  Arena.start();
  var c = Arena.getContainer();
  if (c) {
    c.innerHTML =
      '<div style="text-align:center;padding:40px">' +
        '<div style="font-size:3rem;margin-bottom:20px">🔧</div>' +
        '<h2 style="font-family:Orbitron,monospace;color:#00ff88">Jeu en construction</h2>' +
        '<p style="color:#9090b0;margin:12px 0 24px">Ce jeu arrive bientôt !</p>' +
        '<button onclick="Arena.end(\'draw\',0)" ' +
          'style="padding:12px 28px;border-radius:8px;background:#00ff88;color:#080813;' +
          'font-family:Orbitron,monospace;border:none;cursor:pointer;font-weight:700">' +
          'Terminer' +
        '</button>' +
      '</div>';
  }
};
