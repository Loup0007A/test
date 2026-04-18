// Sudoku Bot - Course au Sudoku contre l'IA
window.startGame = function() {
  Arena.start();
  // Generate a valid easy 9x9 sudoku
  function generateSudoku() {
    // Start with a solved board
    const base = [
      [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
    ];
    // Shuffle by swapping rows within bands and columns within stacks
    for (let b=0;b<3;b++) {
      const r1=b*3+Math.floor(Math.random()*3), r2=b*3+Math.floor(Math.random()*3);
      [base[r1],base[r2]]=[base[r2],base[r1]];
    }
    // Transpose randomly
    if (Math.random()>0.5) {
      for(let i=0;i<9;i++) for(let j=i;j<9;j++) [base[i][j],base[j][i]]=[base[j][i],base[i][j]];
    }
    const solution = base.map(r=>[...r]);
    // Remove ~45 cells (easy difficulty)
    const puzzle = base.map(r=>[...r]);
    let removed=0;
    while(removed<45) {
      const r=Math.floor(Math.random()*9), c=Math.floor(Math.random()*9);
      if(puzzle[r][c]!==0){puzzle[r][c]=0;removed++;}
    }
    return {puzzle, solution};
  }

  const {puzzle, solution} = generateSudoku();
  let grid = puzzle.map(r=>[...r]);
  const fixed = puzzle.map(r=>r.map(v=>v!==0));
  let selected = null, errors = 0, robotProgress = 0;
  const ROBOT_TIME = 120; // robot finishes in 120s
  let elapsed = 0, timerInterval;

  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:12px;width:100%;max-width:420px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:8px;font-size:0.75rem;display:flex;justify-content:space-around">
        <span>⏱ <span id="sdk-t" style="color:var(--warn)">0</span>s</span>
        <span>❌ Erreurs: <span id="sdk-e" style="color:var(--danger)">0</span>/5</span>
        <span>🤖 Robot: <span id="sdk-r" style="color:var(--danger)">0%</span></span>
      </div>
      <div id="sdk-grid" style="display:inline-grid;grid-template-columns:repeat(9,1fr);gap:1px;background:var(--border);border:2px solid var(--accent);border-radius:4px;overflow:hidden"></div>
      <div id="sdk-numpad" style="display:flex;gap:6px;justify-content:center;margin-top:10px;flex-wrap:wrap"></div>
      <div id="sdk-msg" style="font-family:'Orbitron',monospace;margin-top:8px;min-height:24px;font-size:0.8rem"></div>
    </div>
  `;

  // Numpad
  const numpad = document.getElementById('sdk-numpad');
  [1,2,3,4,5,6,7,8,9,'⌫'].forEach(n => {
    const btn = document.createElement('button');
    btn.textContent = n;
    btn.style.cssText=`width:38px;height:38px;border-radius:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-family:'Orbitron',monospace;font-size:1rem;cursor:pointer;transition:all 0.1s;`;
    btn.onmouseenter=()=>btn.style.borderColor='var(--accent)';
    btn.onmouseleave=()=>btn.style.borderColor='var(--border)';
    btn.onclick=()=>inputNum(n);
    numpad.appendChild(btn);
  });

  function renderGrid() {
    const el = document.getElementById('sdk-grid');
    el.innerHTML='';
    for(let r=0;r<9;r++) for(let c2=0;c2<9;c2++) {
      const cell=document.createElement('div');
      const isSel=selected&&selected[0]===r&&selected[1]===c2;
      const val=grid[r][c2];
      const isFixed=fixed[r][c2];
      const isWrong=val!==0&&val!==solution[r][c2];
      const borderT=r%3===0?'border-top:2px solid var(--accent)':'';
      const borderL=c2%3===0?'border-left:2px solid var(--accent)':'';
      cell.style.cssText=`
        width:38px;height:38px;display:flex;align-items:center;justify-content:center;
        font-family:'Orbitron',monospace;font-size:${isFixed?'1rem':'0.95rem'};
        font-weight:${isFixed?'900':'400'};
        background:${isSel?'rgba(0,200,255,0.3)':isWrong?'rgba(255,68,68,0.2)':'var(--bg3)'};
        cursor:${isFixed?'default':'pointer'};
        color:${isFixed?'var(--text)':isWrong?'var(--danger)':'var(--accent2)'};
        ${borderT};${borderL};transition:background 0.1s;
      `;
      if(val) cell.textContent=val;
      if(!isFixed) cell.onclick=()=>{selected=[r,c2];renderGrid();};
      el.appendChild(cell);
    }
  }

  function inputNum(n) {
    if(!selected) return;
    const [r,c2]=selected;
    if(fixed[r][c2]) return;
    if(n==='⌫') { grid[r][c2]=0; renderGrid(); return; }
    grid[r][c2]=parseInt(n);
    if(grid[r][c2]!==solution[r][c2]) {
      errors++;
      document.getElementById('sdk-e').textContent=errors;
      if(errors>=5) {
        clearInterval(timerInterval);
        document.getElementById('sdk-msg').innerHTML=`<span style="color:var(--danger)">💀 Trop d'erreurs !</span>`;
        setTimeout(()=>Arena.end('loss',Math.max(0,100-elapsed*2)),1500);
        return;
      }
    }
    renderGrid();
    // Check win
    if(grid.every((row,r)=>row.every((v,c2)=>v===solution[r][c2]))) {
      clearInterval(timerInterval);
      const faster = elapsed < ROBOT_TIME;
      document.getElementById('sdk-msg').innerHTML=`<span style="color:var(--accent)">🏆 Sudoku résolu en ${elapsed}s !</span>`;
      setTimeout(()=>Arena.end(faster?'win':'loss', Math.max(0,(ROBOT_TIME-elapsed)*10)),1200);
    }
  }

  // Keyboard
  document.addEventListener('keydown', e=>{
    if(e.key>='1'&&e.key<='9') inputNum(parseInt(e.key));
    if(e.key==='Backspace'||e.key==='Delete') inputNum('⌫');
    const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    const m=moves[e.key];
    if(m&&selected){
      selected=[Math.max(0,Math.min(8,selected[0]+m[0])),Math.max(0,Math.min(8,selected[1]+m[1]))];
      renderGrid();
    }
  });

  timerInterval = setInterval(()=>{
    elapsed++;
    document.getElementById('sdk-t').textContent=elapsed;
    robotProgress=Math.min(100,Math.round(elapsed/ROBOT_TIME*100));
    document.getElementById('sdk-r').textContent=robotProgress+'%';
    if(elapsed>=ROBOT_TIME) {
      clearInterval(timerInterval);
      // Check if player solved it
      const solved=grid.every((row,r)=>row.every((v,c2)=>v===solution[r][c2]));
      if(!solved) {
        document.getElementById('sdk-msg').innerHTML=`<span style="color:var(--danger)">🤖 Le robot a fini avant toi !</span>`;
        setTimeout(()=>Arena.end('loss',50),1500);
      }
    }
  },1000);

  renderGrid();
  document.getElementById('sdk-msg').innerHTML=`<span style="color:var(--text3)">Clique une case puis tape un chiffre</span>`;
};
