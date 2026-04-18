// RoboArena — Game Engine v4
// Countdown handled by play.ejs inline script.
// Engine manages: gameContainer <-> gameResult switching.

function showToast(msg, type) {
  var colors = {
    success: 'background:#0a2a14;border:1px solid #00ff88;color:#00ff88;',
    error:   'background:#2a0a0a;border:1px solid #ff4444;color:#ff8080;',
    info:    'background:#13132a;border:1px solid #444;color:#ccc;'
  };
  var t = document.createElement('div');
  t.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:9999;' +
    'padding:12px 20px;border-radius:8px;' +
    'font-family:Orbitron,monospace;font-size:.82rem;max-width:280px;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.6);' +
    (colors[type] || colors.info);
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 3000);
}

// Show one panel, hide the others
function showPanel(id) {
  var all = ['gpCountdown', 'gameContainer', 'gameResult'];
  for (var i = 0; i < all.length; i++) {
    var el = document.getElementById(all[i]);
    if (!el) continue;
    if (all[i] === id) {
      el.classList.remove('game-panel-hidden');
    } else {
      el.classList.add('game-panel-hidden');
    }
  }
  // Also show reload bar when result is visible
  var bar = document.querySelector('.gp-reload-bar');
  if (bar) bar.style.opacity = id === 'gameResult' ? '1' : '0.4';
}

var Arena = {
  gameId:    window.GAME_ID   || '',
  gameName:  window.GAME_NAME || '',
  isLogged:  window.IS_LOGGED || false,
  score:     0,
  startTime: null,
  running:   false,

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

    var duration = this.startTime
      ? Math.round((Date.now() - this.startTime) / 1000)
      : 0;

    var icons  = { win: '🏆', loss: '😔', draw: '🤝' };
    var titles = { win: 'Victoire !',  loss: 'Défaite…', draw: 'Égalité !' };
    var msgs   = {
      win:  'Tu as battu le robot !',
      loss: 'Le robot gagne cette fois…',
      draw: 'Match nul — revanche ?'
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

    if (this.isLogged) {
      var self = this;
      fetch('/games/' + this.gameId + '/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: self.score, result: result, duration: duration })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) showToast(d.message, result === 'win' ? 'success' : 'info');
      })
      .catch(function() {});
    }
  },

  addScore: function(pts) {
    this.score += (pts || 0);
  }
};

window.Arena     = Arena;
window.showPanel = showPanel;

// Default startGame — every game file overrides this
window.startGame = function() {
  Arena.start();
  var c = Arena.getContainer();
  if (c) {
    c.innerHTML =
      '<div style="text-align:center;padding:60px 20px;">' +
        '<div style="font-size:3rem;margin-bottom:16px">🔧</div>' +
        '<h2 style="font-family:Orbitron,monospace;color:#00ff88;margin-bottom:8px">Bientôt disponible</h2>' +
        '<p style="color:#777;margin-bottom:24px">Ce jeu est en cours de développement.</p>' +
        '<button onclick="Arena.end(\'draw\',0)" ' +
          'style="padding:10px 24px;background:#00ff88;color:#08080f;border:none;' +
          'border-radius:6px;font-family:Orbitron,monospace;cursor:pointer;font-weight:700;">' +
          'Terminer' +
        '</button>' +
      '</div>';
  }
};
