// RoboArena — Game Engine v5
// Countdown handled by play.ejs inline script.
// Engine manages: gameContainer <-> gameResult switching, plus the
// live "human robot" relay (Arena.robotMode) used by socket-aware games.

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

    if (Arena.robotMode.socket) {
      Arena.robotMode.socket.emit('robot:end-session');
    }

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

// ── Live "human robot" relay ──
// A game checks `Arena.robotMode.active` once, at the top of startGame().
// If true: use Arena.robotMode.send(type, payload) instead of local AI logic,
// and register Arena.robotMode.onAction(fn) to receive the admin's moves.
// If false (the overwhelming majority of games, for now): behave exactly as
// before — nothing changes for games that don't opt in.
Arena.robotMode = {
  active: false,
  socket: null,
  roomId: null,
  _handler: null,
  onAction: function(fn) { this._handler = fn; },
  send: function(type, payload) {
    if (this.socket && this.active) this.socket.emit('robot:action', { type: type, payload: payload });
  }
};

// Attempts to pair this page with a live admin-controlled robot for
// `gameId`. Always calls `onReady(isLive)` — never hangs the countdown.
function initRobotSocket(gameId, onReady) {
  if (typeof io === 'undefined') { onReady(false); return; }
  var socket = io({ transports: ['websocket', 'polling'] });
  var settled = false;
  var timeout = setTimeout(function() {
    if (!settled) { settled = true; onReady(false); }
  }, 1200);

  socket.on('connect', function() {
    socket.emit('robot:check-live', { gameId: gameId }, function(res) {
      if (settled) return;
      if (!res || !res.available) {
        settled = true; clearTimeout(timeout);
        onReady(false);
        socket.disconnect();
        return;
      }
      socket.emit('robot:request-match', { gameId: gameId }, function(matchRes) {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        if (matchRes && matchRes.matched) {
          Arena.robotMode.socket = socket;
          Arena.robotMode.active = true;
          Arena.robotMode.roomId = matchRes.roomId;
          socket.on('robot:action', function(payload) {
            if (Arena.robotMode._handler) Arena.robotMode._handler(payload.type, payload.payload);
          });
          socket.on('robot:opponent-left', function() {
            Arena.robotMode.active = false;
            showToast('🔌 Le robot humain a quitté.', 'info');
          });
          onReady(true);
        } else {
          onReady(false);
          socket.disconnect();
        }
      });
    });
  });
  socket.on('connect_error', function() {
    if (!settled) { settled = true; clearTimeout(timeout); onReady(false); }
  });
}

window.Arena           = Arena;
window.showPanel       = showPanel;
window.initRobotSocket = initRobotSocket;

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
