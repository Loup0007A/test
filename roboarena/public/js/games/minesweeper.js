// Bot Mines - Démine plus vite que le robot
window.startGame = function() {
  Arena.start();
  const ROWS = 9, COLS = 9, MINES = 10;
  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:16px;width:100%;max-width:480px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:12px;display:flex;justify-content:space-around;font-size:0.85rem">
        <span>💣 <span id="ms-mines" style="color:var(--danger)">10</span> mines</span>
        <span style="color:var(--text3)">⏱ <span id="ms-time" style="color:var(--warn)">0</span>s</span>
        <span>🤖 Robot: <span id="ms-robot" style="color:var(--danger)">en route...</span></span>
      </div>
      <div id="ms-board" style="display:inline-grid;grid-template-columns:repeat(9,1fr);gap:2px;background:var(--surface2);padding:6px;border-radius:8px;border:1px solid var(--border)"></div>
      <div id="ms-msg" style="font-family:'Orbitron',monospace;margin-top:12px;min-height:28px"></div>
    </div>
  `;

  let board = [], revealed = [], flagged = [], gameOver = false;
  let startTime = null, timerInterval;
  let firstClick = true;
  const ROBOT_TIME = 45 + Math.floor(Math.random() * 30); // robot finishes in 45-75s

  function initBoard(safeRow, safeCol) {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    revealed = Array.from({length: ROWS}, () => Array(COLS).fill(false));
    flagged = Array.from({length: ROWS}, () => Array(COLS).fill(false));

    // Place mines (avoid first click area)
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c2 = Math.floor(Math.random() * COLS);
      if (board[r][c2] === -1) continue;
      if (Math.abs(r - safeRow) <= 1 && Math.abs(c2 - safeCol) <= 1) continue;
      board[r][c2] = -1;
      placed++;
    }
    // Calculate numbers
    for (let r = 0; r < ROWS; r++) {
      for (let c2 = 0; c2 < COLS; c2++) {
        if (board[r][c2] === -1) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r+dr, nc = c2+dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc] === -1) count++;
          }
        board[r][c2] = count;
      }
    }
  }

  const numColors = ['','#1e90ff','#2ed573','#ff4444','#7b2fff','#ff6348','#00c8ff','#ff00aa','#333'];

  function renderBoard() {
    const el = document.getElementById('ms-board');
    el.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c2 = 0; c2 < COLS; c2++) {
        const cell = document.createElement('div');
        const isRevealed = revealed[r][c2];
        const isFlagged = flagged[r][c2];
        cell.style.cssText = `
          width:34px;height:34px;border-radius:4px;display:flex;align-items:center;justify-content:center;
          font-size:0.85rem;font-weight:700;cursor:${gameOver||isRevealed?'default':'pointer'};
          background:${isRevealed?(board[r][c2]===-1?'rgba(255,68,68,0.3)':'var(--bg3)'):'var(--surface)'};
          border:1px solid ${isRevealed?'var(--bg3)':'var(--border)'};
          transition:all 0.1s;
          color:${board[r][c2] > 0 ? numColors[board[r][c2]] : 'var(--text)'};
        `;
        if (isRevealed) {
          if (board[r][c2] === -1) cell.textContent = '💣';
          else if (board[r][c2] > 0) cell.textContent = board[r][c2];
        } else if (isFlagged) {
          cell.textContent = '🚩';
        } else if (!gameOver) {
          cell.onmouseenter = () => cell.style.background = 'var(--surface2)';
          cell.onmouseleave = () => cell.style.background = 'var(--surface)';
          cell.addEventListener('click', () => clickCell(r, c2));
          cell.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(r, c2); });
        }
        el.appendChild(cell);
      }
    }
    const remaining = MINES - flagged.flat().filter(Boolean).length;
    document.getElementById('ms-mines').textContent = remaining;
  }

  function clickCell(r, c2) {
    if (gameOver || revealed[r][c2] || flagged[r][c2]) return;
    if (firstClick) {
      firstClick = false;
      initBoard(r, c2);
      startTime = Date.now();
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        document.getElementById('ms-time').textContent = elapsed;
      }, 1000);
      // Start robot countdown
      setTimeout(() => {
        if (!gameOver) {
          gameOver = true;
          clearInterval(timerInterval);
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          document.getElementById('ms-robot').textContent = 'TERMINÉ !';
          document.getElementById('ms-msg').innerHTML = `<span style="color:var(--danger)">🤖 Le robot a fini en ${ROBOT_TIME}s ! Tu avais ${elapsed}s...</span>`;
          setTimeout(() => Arena.end('loss', Math.max(0, (ROBOT_TIME - elapsed) * 10)), 2000);
        }
      }, ROBOT_TIME * 1000);
    }

    reveal(r, c2);
    renderBoard();

    if (board[r][c2] === -1) {
      gameOver = true;
      clearInterval(timerInterval);
      // Reveal all mines
      for (let i = 0; i < ROWS; i++)
        for (let j = 0; j < COLS; j++)
          if (board[i][j] === -1) revealed[i][j] = true;
      renderBoard();
      document.getElementById('ms-msg').innerHTML = `<span style="color:var(--danger)">💥 BOOM ! Mine touchée !</span>`;
      setTimeout(() => Arena.end('loss', 0), 1500);
      return;
    }

    // Check win
    let unrevealed = 0;
    for (let i = 0; i < ROWS; i++)
      for (let j = 0; j < COLS; j++)
        if (!revealed[i][j] && board[i][j] !== -1) unrevealed++;

    if (unrevealed === 0) {
      gameOver = true;
      clearInterval(timerInterval);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      document.getElementById('ms-msg').innerHTML = `<span style="color:var(--accent)">🏆 Déminé en ${elapsed}s ! Robot prévu: ${ROBOT_TIME}s</span>`;
      setTimeout(() => Arena.end('win', Math.max(100, (ROBOT_TIME - elapsed) * 20 + 200)), 1500);
    }
  }

  function reveal(r, c2) {
    if (r < 0 || r >= ROWS || c2 < 0 || c2 >= COLS) return;
    if (revealed[r][c2] || flagged[r][c2]) return;
    revealed[r][c2] = true;
    if (board[r][c2] === 0) {
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          reveal(r+dr, c2+dc);
    }
  }

  function toggleFlag(r, c2) {
    if (gameOver || revealed[r][c2]) return;
    flagged[r][c2] = !flagged[r][c2];
    renderBoard();
  }

  // Init empty board for display
  board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
  revealed = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  flagged = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  renderBoard();
  document.getElementById('ms-msg').innerHTML = `<span style="color:var(--text3)">Clique pour commencer • Clic droit = drapeau</span>`;
};
