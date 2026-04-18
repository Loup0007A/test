// Word Hunter - Trouve les mots cachés plus vite que le robot
window.startGame = function() {
  Arena.start();
  const WORDS_TO_FIND = ['ROBOT','PIXEL','ARENE','CODE','LASER','DATA'];
  const GRID_SIZE = 10;
  const ROBOT_DELAY = 8000; // robot finds one every 8s

  let grid = [], wordPositions = {}, found = [], robotFound = [];
  let selecting = false, selStart = null, selCells = [];

  function generateGrid() {
    grid = Array.from({length:GRID_SIZE}, () => Array(GRID_SIZE).fill(''));
    wordPositions = {};

    const dirs = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    WORDS_TO_FIND.forEach(word => {
      let placed = false, tries = 0;
      while (!placed && tries++ < 200) {
        const [dr, dc] = dirs[Math.floor(Math.random()*dirs.length)];
        const r = Math.floor(Math.random()*GRID_SIZE);
        const c = Math.floor(Math.random()*GRID_SIZE);
        const cells = [];
        let ok = true;
        for (let i = 0; i < word.length; i++) {
          const nr = r+dr*i, nc = c+dc*i;
          if (nr<0||nr>=GRID_SIZE||nc<0||nc>=GRID_SIZE) { ok=false; break; }
          if (grid[nr][nc] !== '' && grid[nr][nc] !== word[i]) { ok=false; break; }
          cells.push([nr,nc]);
        }
        if (ok) {
          cells.forEach(([nr,nc],i) => grid[nr][nc] = word[i]);
          wordPositions[word] = cells;
          placed = true;
        }
      }
    });
    // Fill blanks
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r=0;r<GRID_SIZE;r++) for (let c=0;c<GRID_SIZE;c++)
      if (!grid[r][c]) grid[r][c] = letters[Math.floor(Math.random()*26)];
  }

  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:12px;width:100%;max-width:540px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-family:'Orbitron',monospace;font-size:0.75rem">
        <span>👤 Toi: <span id="ws-ps" style="color:var(--accent)">0</span>/${WORDS_TO_FIND.length}</span>
        <span>🤖 Robot: <span id="ws-rs" style="color:var(--danger)">0</span>/${WORDS_TO_FIND.length}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:10px" id="ws-words"></div>
      <div id="ws-grid" style="display:inline-grid;grid-template-columns:repeat(10,1fr);gap:2px;user-select:none;touch-action:none"></div>
      <div id="ws-msg" style="font-family:'Orbitron',monospace;margin-top:10px;min-height:24px;font-size:0.8rem"></div>
    </div>
  `;

  function renderWords() {
    const el = document.getElementById('ws-words');
    el.innerHTML = '';
    WORDS_TO_FIND.forEach(w => {
      const span = document.createElement('span');
      const playerFound = found.includes(w);
      const robFound = robotFound.includes(w);
      span.style.cssText = `
        padding:3px 10px;border-radius:12px;font-family:'Orbitron',monospace;font-size:0.75rem;font-weight:700;
        background:${playerFound?'rgba(0,255,136,0.2)':robFound?'rgba(255,68,68,0.2)':'var(--surface)'};
        color:${playerFound?'var(--accent)':robFound?'var(--danger)':'var(--text2)'};
        border:1px solid ${playerFound?'var(--accent)':robFound?'var(--danger)':'var(--border)'};
        text-decoration:${playerFound||robFound?'line-through':'none'};
      `;
      span.textContent = w;
      el.appendChild(span);
    });
  }

  let highlightedCells = new Set();
  let robotHighlight = new Set();

  function renderGrid() {
    const el = document.getElementById('ws-grid');
    el.innerHTML = '';
    for (let r=0;r<GRID_SIZE;r++) for (let c2=0;c2<GRID_SIZE;c2++) {
      const cell = document.createElement('div');
      const key = `${r},${c2}`;
      const isSel = selCells.some(([sr,sc])=>sr===r&&sc===c2);
      const isFound = highlightedCells.has(key);
      const isRobot = robotHighlight.has(key);
      cell.style.cssText = `
        width:32px;height:32px;border-radius:4px;display:flex;align-items:center;justify-content:center;
        font-family:'Orbitron',monospace;font-size:0.8rem;font-weight:700;
        cursor:pointer;
        background:${isSel?'rgba(0,200,255,0.4)':isFound?'rgba(0,255,136,0.3)':isRobot?'rgba(255,68,68,0.25)':'var(--surface)'};
        border:1px solid ${isSel?'var(--accent2)':isFound?'var(--accent)':isRobot?'var(--danger)':'var(--border)'};
        color:${isFound?'var(--accent)':isRobot?'var(--danger)':'var(--text)'};
        transition:background 0.1s;
      `;
      cell.textContent = grid[r][c2];
      cell.dataset.r = r; cell.dataset.c = c2;
      el.appendChild(cell);
    }
  }

  // Mouse/touch drag selection
  let isDragging = false;
  document.getElementById('ws-grid').addEventListener('mousedown', e => {
    const cell = e.target.closest('div[data-r]');
    if (!cell) return;
    isDragging = true;
    selStart = [parseInt(cell.dataset.r), parseInt(cell.dataset.c)];
    selCells = [selStart];
    renderGrid();
  });
  document.getElementById('ws-grid').addEventListener('mouseover', e => {
    if (!isDragging) return;
    const cell = e.target.closest('div[data-r]');
    if (!cell) return;
    const end = [parseInt(cell.dataset.r), parseInt(cell.dataset.c)];
    selCells = getCellsBetween(selStart, end);
    renderGrid();
  });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    checkSelection();
    selCells = [];
    renderGrid();
  });

  function getCellsBetween([r1,c1],[r2,c2]) {
    const dr = Math.sign(r2-r1), dc = Math.sign(c2-c1);
    if (dr===0&&dc===0) return [[r1,c1]];
    if (dr!==0&&dc!==0&&Math.abs(r2-r1)!==Math.abs(c2-c1)) return [[r1,c1]];
    const cells = [];
    let r=r1,c=c1;
    while(true) { cells.push([r,c]); if(r===r2&&c===c2) break; r+=dr; c+=dc; }
    return cells;
  }

  function checkSelection() {
    const word = selCells.map(([r,c])=>grid[r][c]).join('');
    const wordRev = [...word].reverse().join('');
    const match = WORDS_TO_FIND.find(w => (w===word||w===wordRev) && !found.includes(w));
    if (match) {
      found.push(match);
      selCells.forEach(([r,c]) => highlightedCells.add(`${r},${c}`));
      document.getElementById('ws-ps').textContent = found.length;
      document.getElementById('ws-msg').innerHTML = `<span style="color:var(--accent)">✅ ${match} trouvé !</span>`;
      renderWords();
      if (checkEnd()) return;
    }
  }

  function checkEnd() {
    const total = found.length + robotFound.length;
    if (total >= WORDS_TO_FIND.length) {
      clearInterval(robotTimer);
      const result = found.length > robotFound.length ? 'win' : found.length < robotFound.length ? 'loss' : 'draw';
      setTimeout(() => Arena.end(result, found.length * 200), 800);
      return true;
    }
    return false;
  }

  // Robot finds words on timer
  const remaining = () => WORDS_TO_FIND.filter(w => !found.includes(w) && !robotFound.includes(w));
  const robotTimer = setInterval(() => {
    const rem = remaining();
    if (!rem.length) { clearInterval(robotTimer); return; }
    const word = rem[Math.floor(Math.random()*rem.length)];
    robotFound.push(word);
    (wordPositions[word]||[]).forEach(([r,c]) => robotHighlight.add(`${r},${c}`));
    document.getElementById('ws-rs').textContent = robotFound.length;
    document.getElementById('ws-msg').innerHTML = `<span style="color:var(--danger)">🤖 Le robot a trouvé ${word} !</span>`;
    renderWords();
    renderGrid();
    checkEnd();
  }, ROBOT_DELAY);

  generateGrid();
  renderWords();
  renderGrid();
};
