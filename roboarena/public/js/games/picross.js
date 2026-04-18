// Pixel Logic - Nonogramme / Picross en duel
window.startGame = function() {
  Arena.start();
  // 5x5 nonogram puzzles
  const PUZZLES = [
    { // Cross
      solution:[[0,1,0,1,0],[1,1,1,1,1],[0,1,0,1,0],[1,1,1,1,1],[0,1,0,1,0]],
      name:'Grille'
    },
    { // Heart
      solution:[[0,1,0,1,0],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]],
      name:'Cœur'
    },
    { // Arrow
      solution:[[0,0,1,0,0],[0,1,1,0,0],[1,1,1,1,1],[0,1,1,0,0],[0,0,1,0,0]],
      name:'Flèche'
    },
    { // Robot
      solution:[[1,1,1,1,1],[1,0,1,0,1],[1,1,1,1,1],[0,1,0,1,0],[1,0,0,0,1]],
      name:'Robot'
    }
  ];

  const puzzle = PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
  const sol = puzzle.solution;
  const N = 5;
  let grid = Array.from({length:N},()=>Array(N).fill(0)); // 0=empty,1=filled,2=crossed
  let errors=0, robotProgress=0, gameOver=false;
  const ROBOT_TIME = 60;
  let elapsed=0, timerInterval;

  function getClues(arr) {
    const groups=[]; let count=0;
    arr.forEach(v=>{if(v)count++;else if(count){groups.push(count);count=0;}});
    if(count) groups.push(count);
    return groups.length ? groups : [0];
  }

  const rowClues = sol.map(row=>getClues(row));
  const colClues = Array.from({length:N},(_,c)=>getClues(sol.map(r=>r[c])));

  const c = Arena.getContainer();
  c.innerHTML=`
    <div style="text-align:center;padding:12px;width:100%;max-width:400px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:8px;font-size:0.78rem;display:flex;justify-content:space-around">
        <span>⏱ <span id="pc-t" style="color:var(--warn)">0</span>s</span>
        <span style="color:var(--text2)">${puzzle.name}</span>
        <span>🤖 <span id="pc-r" style="color:var(--danger)">0%</span></span>
      </div>
      <div style="display:inline-block" id="pc-wrap"></div>
      <div style="margin-top:10px;font-size:0.78rem;color:var(--text3)">Clic gauche = remplir • Clic droit = croix</div>
      <div id="pc-msg" style="font-family:'Orbitron',monospace;margin-top:8px;min-height:24px;font-size:0.8rem"></div>
    </div>
  `;

  function renderPuzzle() {
    const wrap = document.getElementById('pc-wrap');
    wrap.innerHTML='';
    // Build table
    const table = document.createElement('div');
    table.style.cssText='display:inline-grid;gap:2px;';
    const cols = N+1, rows = N+1;
    table.style.gridTemplateColumns = `40px ${Array(N).fill('36px').join(' ')}`;

    // Top-left empty
    const empty = document.createElement('div');
    empty.style.cssText='width:40px;height:40px;';
    table.appendChild(empty);

    // Column clues
    colClues.forEach(clue=>{
      const div=document.createElement('div');
      div.style.cssText='width:36px;height:40px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:4px;font-family:"Orbitron",monospace;font-size:0.75rem;color:var(--text2);gap:2px;';
      clue.forEach(n=>{const s=document.createElement('span');s.textContent=n;div.appendChild(s);});
      table.appendChild(div);
    });

    // Rows
    for(let r=0;r<N;r++) {
      // Row clue
      const rclue=document.createElement('div');
      rclue.style.cssText='width:40px;height:36px;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;gap:2px;font-family:"Orbitron",monospace;font-size:0.75rem;color:var(--text2);';
      rowClues[r].forEach(n=>{const s=document.createElement('span');s.textContent=n;rclue.appendChild(s);});
      table.appendChild(rclue);

      for(let c2=0;c2<N;c2++) {
        const cell=document.createElement('div');
        const val=grid[r][c2];
        cell.style.cssText=`
          width:36px;height:36px;border-radius:4px;display:flex;align-items:center;justify-content:center;
          background:${val===1?'var(--accent)':val===2?'rgba(255,68,68,0.1)':'var(--surface)'};
          border:2px solid ${val===1?'var(--accent)':'var(--border)'};
          cursor:pointer;font-size:1.2rem;transition:all 0.1s;
        `;
        if(val===2) cell.textContent='×';
        cell.onmouseenter=()=>{ if(val===0) cell.style.background='var(--surface2)'; };
        cell.onmouseleave=()=>{ if(val===0) cell.style.background='var(--surface)'; };
        cell.onclick=()=>clickCell(r,c2,1);
        cell.oncontextmenu=e=>{e.preventDefault();clickCell(r,c2,2);};
        table.appendChild(cell);
      }
    }
    wrap.appendChild(table);
  }

  function clickCell(r,c2,type) {
    if(gameOver) return;
    grid[r][c2] = grid[r][c2]===type ? 0 : type;
    renderPuzzle();
    // Check if solved
    const solved = sol.every((row,ri)=>row.every((v,ci)=>{const want=v===1;const has=grid[ri][ci]===1;return want===has;}));
    if(solved) {
      gameOver=true;
      clearInterval(timerInterval);
      const faster=elapsed<ROBOT_TIME;
      document.getElementById('pc-msg').innerHTML=`<span style="color:var(--accent)">🏆 ${puzzle.name} résolu en ${elapsed}s !</span>`;
      setTimeout(()=>Arena.end(faster?'win':'loss', Math.max(50,200-elapsed*2)), 1200);
    }
  }

  timerInterval=setInterval(()=>{
    elapsed++;
    document.getElementById('pc-t').textContent=elapsed;
    robotProgress=Math.min(100,Math.round(elapsed/ROBOT_TIME*100));
    document.getElementById('pc-r').textContent=robotProgress+'%';
    if(elapsed>=ROBOT_TIME&&!gameOver) {
      gameOver=true;
      clearInterval(timerInterval);
      document.getElementById('pc-msg').innerHTML=`<span style="color:var(--danger)">🤖 Le robot a fini avant toi !</span>`;
      setTimeout(()=>Arena.end('loss',0),1500);
    }
  },1000);

  renderPuzzle();
};
