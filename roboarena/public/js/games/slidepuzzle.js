// Slide Sprint - Puzzle taquin contre le robot
window.startGame = function() {
  Arena.start();
  const SIZE = 3; // 3x3
  let tiles = [], blank = {r:2,c:2}, moves = 0, solved = false;
  const ROBOT_MOVES = 25 + Math.floor(Math.random() * 20);
  let robotMovesLeft = ROBOT_MOVES;
  let robotInterval;

  const GOAL = [1,2,3,4,5,6,7,8,0];

  function shuffle() {
    tiles = [...GOAL];
    blank = {r:2,c:2};
    for (let i = 0; i < 200; i++) {
      const dirs = [{r:-1,c:0},{r:1,c:0},{r:0,c:-1},{r:0,c:1}];
      const valid = dirs.filter(d => {
        const nr = blank.r+d.r, nc = blank.c+d.c;
        return nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE;
      });
      const d = valid[Math.floor(Math.random()*valid.length)];
      const ni = (blank.r+d.r)*SIZE+(blank.c+d.c);
      const bi = blank.r*SIZE+blank.c;
      [tiles[bi],tiles[ni]]=[tiles[ni],tiles[bi]];
      blank = {r:blank.r+d.r,c:blank.c+d.c};
    }
  }

  function isSolved() { return tiles.every((v,i)=>v===GOAL[i]); }

  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:20px;width:100%;max-width:380px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:12px;display:flex;justify-content:space-around;font-size:0.85rem">
        <span>👤 Mouvements: <span id="sp-moves" style="color:var(--accent)">0</span></span>
        <span>🤖 Robot: <span id="sp-robot" style="color:var(--danger)">${ROBOT_MOVES} mouvements</span></span>
      </div>
      <div id="sp-progress" style="height:4px;background:var(--border);border-radius:2px;margin-bottom:16px;overflow:hidden">
        <div id="sp-bar" style="height:100%;background:var(--danger);width:100%;transition:width 0.2s"></div>
      </div>
      <div id="sp-board" style="display:inline-grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px"></div>
      <p style="color:var(--text3);font-size:0.8rem">Clique sur une tuile adjacente à l'espace vide</p>
    </div>
  `;

  function render() {
    const el = document.getElementById('sp-board');
    el.innerHTML = '';
    tiles.forEach((val, i) => {
      const r = Math.floor(i/SIZE), cc = i%SIZE;
      const cell = document.createElement('div');
      const isEmpty = val === 0;
      cell.style.cssText = `
        width:80px;height:80px;border-radius:10px;
        display:flex;align-items:center;justify-content:center;
        font-family:'Orbitron',monospace;font-size:1.8rem;font-weight:900;
        background:${isEmpty?'var(--bg3)':'var(--surface)'};
        border:2px solid ${isEmpty?'var(--bg3)':'var(--border)'};
        cursor:${isEmpty?'default':'pointer'};
        color:var(--accent);
        transition:all 0.12s;
        ${isEmpty?'':'box-shadow:0 2px 8px rgba(0,0,0,0.3)'}
      `;
      if (!isEmpty) {
        cell.textContent = val;
        cell.onmouseenter = () => {
          const isAdj = Math.abs(r-blank.r)+Math.abs(cc-blank.c)===1;
          if (isAdj) { cell.style.background='var(--surface2)'; cell.style.borderColor='var(--accent)'; }
        };
        cell.onmouseleave = () => { cell.style.background='var(--surface)'; cell.style.borderColor='var(--border)'; };
        cell.onclick = () => moveTile(r, cc);
      }
      el.appendChild(cell);
    });
    document.getElementById('sp-moves').textContent = moves;
    document.getElementById('sp-bar').style.width = Math.max(0,(1-robotMovesLeft/ROBOT_MOVES)*100)+'%';
    document.getElementById('sp-robot').textContent = robotMovesLeft > 0 ? robotMovesLeft + ' restants' : 'FINI !';
  }

  function moveTile(r, cc) {
    if (solved) return;
    const isAdj = Math.abs(r-blank.r)+Math.abs(cc-blank.c)===1;
    if (!isAdj) return;
    const fi = r*SIZE+cc, bi = blank.r*SIZE+blank.c;
    [tiles[fi],tiles[bi]]=[tiles[bi],tiles[fi]];
    blank={r,c:cc};
    moves++;
    render();
    if (isSolved()) {
      solved=true;
      clearInterval(robotInterval);
      const result = moves <= ROBOT_MOVES ? 'win' : 'loss';
      document.getElementById('sp-board').style.borderColor='var(--accent)';
      const msg = result==='win'
        ? `<span style="color:var(--accent)">🏆 Résolu en ${moves} mvts ! Robot: ${ROBOT_MOVES}</span>`
        : `<span style="color:var(--warn)">✅ Résolu en ${moves} mvts (robot prévu: ${ROBOT_MOVES})</span>`;
      document.createElement('div'); // flush
      setTimeout(() => {
        const el = document.createElement('div');
        el.style.cssText='font-family:"Orbitron",monospace;margin-top:12px;';
        el.innerHTML = msg;
        document.querySelector('#sp-board').after(el);
        Arena.end(result, Math.max(0, (ROBOT_MOVES - moves + 1) * 20));
      }, 500);
    }
  }

  // Robot countdown
  robotInterval = setInterval(() => {
    if (solved) { clearInterval(robotInterval); return; }
    robotMovesLeft--;
    render();
    if (robotMovesLeft <= 0) {
      clearInterval(robotInterval);
      if (!solved) {
        document.getElementById('sp-robot').textContent = 'FINI !';
        setTimeout(() => Arena.end('loss', 0), 1000);
      }
    }
  }, 1200);

  shuffle();
  render();
};
