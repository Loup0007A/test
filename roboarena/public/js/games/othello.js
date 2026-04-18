// Flip-Bot - Othello / Reversi contre l'IA
window.startGame = function() {
  Arena.start();
  const SIZE = 8;
  let board = [], currentPlayer = 1; // 1=human(black), 2=robot(white)
  let gameOver = false;

  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:16px;width:100%;max-width:480px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:10px;display:flex;justify-content:space-around;font-size:0.9rem">
        <span>⚫ Toi: <span id="ot-ps" style="color:var(--accent)">2</span></span>
        <span id="ot-turn" style="color:var(--text3)">Ton tour</span>
        <span>⚪ Robot: <span id="ot-rs" style="color:var(--danger)">2</span></span>
      </div>
      <div id="ot-board" style="display:inline-grid;grid-template-columns:repeat(8,1fr);gap:2px;background:var(--surface2);padding:6px;border-radius:8px;border:1px solid var(--border)"></div>
      <div id="ot-msg" style="font-family:'Orbitron',monospace;margin-top:12px;min-height:28px"></div>
    </div>
  `;

  function initBoard() {
    board = Array.from({length: SIZE}, () => Array(SIZE).fill(0));
    board[3][3] = 2; board[3][4] = 1;
    board[4][3] = 1; board[4][4] = 2;
  }

  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

  function getFlips(b, r, c2, player) {
    if (b[r][c2] !== 0) return [];
    const opponent = player === 1 ? 2 : 1;
    let allFlips = [];
    for (const [dr, dc] of DIRS) {
      let flips = [], nr = r+dr, nc = c2+dc;
      while (nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&b[nr][nc]===opponent) {
        flips.push([nr,nc]); nr+=dr; nc+=dc;
      }
      if (flips.length && nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE&&b[nr][nc]===player)
        allFlips = allFlips.concat(flips);
    }
    return allFlips;
  }

  function getValidMoves(b, player) {
    const moves = [];
    for (let r = 0; r < SIZE; r++)
      for (let c2 = 0; c2 < SIZE; c2++)
        if (getFlips(b, r, c2, player).length > 0) moves.push([r, c2]);
    return moves;
  }

  function applyMove(b, r, c2, player) {
    const flips = getFlips(b, r, c2, player);
    if (!flips.length) return false;
    b[r][c2] = player;
    flips.forEach(([fr, fc]) => b[fr][fc] = player);
    return true;
  }

  function countScore() {
    let p1 = 0, p2 = 0;
    board.flat().forEach(v => { if (v===1) p1++; else if (v===2) p2++; });
    return {p1, p2};
  }

  function robotMove() {
    const moves = getValidMoves(board, 2);
    if (!moves.length) {
      document.getElementById('ot-turn').textContent = 'Robot passe !';
      setTimeout(() => nextTurn(1), 800);
      return;
    }
    // Greedy: pick move that flips most + prefer corners
    const corners = [[0,0],[0,7],[7,0],[7,7]];
    const cornerMove = moves.find(([r,c2]) => corners.some(([cr,cc]) => cr===r&&cc===c2));
    let best = cornerMove || moves.reduce((a, b) =>
      getFlips(board, b[0], b[1], 2).length > getFlips(board, a[0], a[1], 2).length ? b : a
    );
    applyMove(board, best[0], best[1], 2);
    updateScore();
    renderBoard();
    if (checkEnd()) return;
    const playerMoves = getValidMoves(board, 1);
    if (!playerMoves.length) {
      document.getElementById('ot-turn').textContent = 'Tu dois passer !';
      setTimeout(() => nextTurn(2), 800);
    } else {
      currentPlayer = 1;
      document.getElementById('ot-turn').textContent = 'Ton tour ⚫';
      renderBoard();
    }
  }

  function nextTurn(player) {
    currentPlayer = player;
    renderBoard();
    if (player === 2) {
      document.getElementById('ot-turn').textContent = '🤖 Robot réfléchit...';
      setTimeout(robotMove, 600 + Math.random()*400);
    }
  }

  function updateScore() {
    const {p1, p2} = countScore();
    document.getElementById('ot-ps').textContent = p1;
    document.getElementById('ot-rs').textContent = p2;
  }

  function checkEnd() {
    const p1moves = getValidMoves(board, 1);
    const p2moves = getValidMoves(board, 2);
    if (p1moves.length > 0 || p2moves.length > 0) return false;
    gameOver = true;
    const {p1, p2} = countScore();
    const result = p1 > p2 ? 'win' : p1 < p2 ? 'loss' : 'draw';
    document.getElementById('ot-turn').textContent = 'Fin de partie !';
    document.getElementById('ot-msg').innerHTML = result === 'win'
      ? `<span style="color:var(--accent)">🏆 Victoire ! ${p1} vs ${p2}</span>`
      : result === 'loss'
      ? `<span style="color:var(--danger)">🤖 Défaite ! ${p1} vs ${p2}</span>`
      : `<span style="color:var(--warn)">🤝 Égalité ! ${p1} vs ${p2}</span>`;
    setTimeout(() => Arena.end(result, p1 * 10), 1500);
    return true;
  }

  function renderBoard() {
    const el = document.getElementById('ot-board');
    el.innerHTML = '';
    const validMoves = !gameOver && currentPlayer === 1 ? getValidMoves(board, 1) : [];
    for (let r = 0; r < SIZE; r++) {
      for (let c2 = 0; c2 < SIZE; c2++) {
        const cell = document.createElement('div');
        const val = board[r][c2];
        const isValid = validMoves.some(([vr,vc]) => vr===r&&vc===c2);
        cell.style.cssText = `
          width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          background:${val===1?'#222':val===2?'#fff':isValid?'rgba(0,255,136,0.15)':'var(--bg3)'};
          border:2px solid ${val===1?'#555':val===2?'#ccc':isValid?'var(--accent)':'var(--border)'};
          cursor:${isValid?'pointer':'default'};transition:all 0.15s;font-size:1.3rem;
          ${isValid?'box-shadow:0 0 8px rgba(0,255,136,0.3)':''}
        `;
        if (val===1) cell.textContent='⚫';
        else if (val===2) cell.textContent='⚪';
        if (isValid) {
          cell.onmouseenter = () => { cell.style.background='rgba(0,255,136,0.3)'; };
          cell.onmouseleave = () => { cell.style.background='rgba(0,255,136,0.15)'; };
          cell.onclick = () => {
            if (gameOver || currentPlayer !== 1) return;
            applyMove(board, r, c2, 1);
            updateScore();
            currentPlayer = 0;
            renderBoard();
            if (!checkEnd()) {
              document.getElementById('ot-turn').textContent = '🤖 Robot réfléchit...';
              setTimeout(robotMove, 500);
            }
          };
        }
        el.appendChild(cell);
      }
    }
  }

  initBoard();
  updateScore();
  renderBoard();
};
