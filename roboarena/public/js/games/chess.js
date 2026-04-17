// RoboChess - Échecs express (simplified) contre le robot
window.startGame = function() {
  Arena.start();
  // Simplified chess: pieces on a real 8x8, basic legal moves, AI picks best capture
  const PIECES = {
    'K':'♔','Q':'♕','R':'♖','B':'♗','N':'♘','P':'♙',
    'k':'♚','q':'♛','r':'♜','b':'♝','n':'♞','p':'♟'
  };
  const VALS = {'P':1,'N':3,'B':3,'R':5,'Q':9,'K':100,'p':1,'n':3,'b':3,'r':5,'q':9,'k':100};

  // Standard starting position FEN simplified
  let board = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    [' ',' ',' ',' ',' ',' ',' ',' '],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
  ];

  let selected = null, playerTurn = true, gameOver = false;
  let playerScore = 0, robotScore = 0;

  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:10px;width:100%;max-width:420px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:8px;font-size:0.8rem;display:flex;justify-content:space-around">
        <span>♔ Toi (blanc): <span id="ch-ps" style="color:var(--accent)">0</span></span>
        <span id="ch-turn" style="color:var(--text3)">Ton tour</span>
        <span>♚ Robot (noir): <span id="ch-rs" style="color:var(--danger)">0</span></span>
      </div>
      <div id="ch-board" style="display:inline-grid;grid-template-columns:repeat(8,1fr);gap:0;border:2px solid var(--border);border-radius:4px;overflow:hidden"></div>
      <div id="ch-msg" style="font-family:'Orbitron',monospace;margin-top:10px;min-height:24px;font-size:0.85rem"></div>
    </div>
  `;

  function isWhite(p) { return p !== ' ' && p === p.toUpperCase(); }
  function isBlack(p) { return p !== ' ' && p === p.toLowerCase(); }

  function getMoves(b, r, c2) {
    const p = b[r][c2];
    if (p === ' ') return [];
    const moves = [];
    const add = (nr, nc) => {
      if (nr<0||nr>7||nc<0||nc>7) return false;
      if (isWhite(p) && isWhite(b[nr][nc])) return false;
      if (isBlack(p) && isBlack(b[nr][nc])) return false;
      moves.push([nr, nc]);
      return b[nr][nc] === ' ';
    };
    const slide = (dr, dc) => { let nr=r+dr, nc=c2+dc; while(add(nr,nc)&&b[nr][nc]===' '){nr+=dr;nc+=dc;} };

    if (p==='P') { // white pawn
      if (r>0&&b[r-1][c2]===' ') { moves.push([r-1,c2]); if(r===6&&b[r-2][c2]===' ')moves.push([r-2,c2]); }
      if (r>0&&c2>0&&isBlack(b[r-1][c2-1])) moves.push([r-1,c2-1]);
      if (r>0&&c2<7&&isBlack(b[r-1][c2+1])) moves.push([r-1,c2+1]);
    } else if (p==='p') { // black pawn
      if (r<7&&b[r+1][c2]===' ') { moves.push([r+1,c2]); if(r===1&&b[r+2][c2]===' ')moves.push([r+2,c2]); }
      if (r<7&&c2>0&&isWhite(b[r+1][c2-1])) moves.push([r+1,c2-1]);
      if (r<7&&c2<7&&isWhite(b[r+1][c2+1])) moves.push([r+1,c2+1]);
    } else if (p==='N'||p==='n') {
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c2+dc));
    } else if (p==='B'||p==='b') {
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc));
    } else if (p==='R'||p==='r') {
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc));
    } else if (p==='Q'||p==='q') {
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>slide(dr,dc));
    } else if (p==='K'||p==='k') {
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c2+dc));
    }
    return moves;
  }

  function robotMove() {
    // Find all black moves, prefer captures by value
    let bestMoves = [], bestScore = -999;
    for (let r=0;r<8;r++) for (let c2=0;c2<8;c2++) {
      if (!isBlack(board[r][c2])) continue;
      getMoves(board, r, c2).forEach(([nr,nc]) => {
        const target = board[nr][nc];
        const val = target !== ' ' ? (VALS[target.toUpperCase()]||0) : 0;
        if (val > bestScore) { bestScore = val; bestMoves = [[r,c2,nr,nc]]; }
        else if (val === bestScore) bestMoves.push([r,c2,nr,nc]);
      });
    }
    if (!bestMoves.length) {
      document.getElementById('ch-msg').innerHTML = `<span style="color:var(--accent)">🏆 Le robot n'a plus de coups !</span>`;
      setTimeout(() => Arena.end('win', 500 + playerScore * 50), 1500);
      return;
    }
    const [fr,fc,tr,tc] = bestMoves[Math.floor(Math.random()*bestMoves.length)];
    const captured = board[tr][tc];
    if (captured !== ' ') {
      robotScore += VALS[captured.toUpperCase()] || 0;
      document.getElementById('ch-rs').textContent = robotScore;
      if (captured === 'K') {
        board[tr][tc] = board[fr][fc]; board[fr][fc] = ' ';
        renderBoard();
        document.getElementById('ch-msg').innerHTML = `<span style="color:var(--danger)">💀 Ton roi est capturé !</span>`;
        setTimeout(() => Arena.end('loss', Math.max(0, playerScore * 50 - robotScore * 50)), 1500);
        gameOver = true;
        return;
      }
    }
    board[tr][tc] = board[fr][fc]; board[fr][fc] = ' ';
    // Pawn promotion
    if (board[tr][tc]==='p'&&tr===7) board[tr][tc]='q';
    playerTurn = true;
    document.getElementById('ch-turn').textContent = 'Ton tour';
    renderBoard();
    document.getElementById('ch-msg').textContent = '';
  }

  function renderBoard() {
    const el = document.getElementById('ch-board');
    el.innerHTML = '';
    for (let r=0;r<8;r++) for (let c2=0;c2<8;c2++) {
      const cell = document.createElement('div');
      const isLight = (r+c2)%2===0;
      const piece = board[r][c2];
      const isSel = selected && selected[0]===r && selected[1]===c2;
      const isHint = selected && getMoves(board, selected[0], selected[1]).some(([mr,mc])=>mr===r&&mc===c2);
      cell.style.cssText = `
        width:40px;height:40px;display:flex;align-items:center;justify-content:center;
        font-size:1.6rem;cursor:${!gameOver&&playerTurn&&(isWhite(piece)||isHint)?'pointer':'default'};
        background:${isSel?'rgba(0,255,136,0.4)':isHint?'rgba(0,200,255,0.3)':isLight?'#f0d9b5':'#b58863'};
        user-select:none;position:relative;
      `;
      if (isHint&&piece===' ') {
        const dot = document.createElement('div');
        dot.style.cssText='width:12px;height:12px;border-radius:50%;background:rgba(0,0,0,0.3);position:absolute;';
        cell.appendChild(dot);
      }
      if (piece !== ' ') {
        cell.textContent = PIECES[piece] || piece;
        cell.style.color = isWhite(piece) ? '#fff' : '#111';
        cell.style.textShadow = isWhite(piece) ? '0 1px 2px #000' : '0 1px 2px rgba(255,255,255,0.3)';
      }
      cell.onclick = () => handleClick(r, c2);
      el.appendChild(cell);
    }
  }

  function handleClick(r, c2) {
    if (gameOver || !playerTurn) return;
    const piece = board[r][c2];

    if (selected) {
      const [sr, sc] = selected;
      const moves = getMoves(board, sr, sc);
      if (moves.some(([mr,mc])=>mr===r&&mc===c2)) {
        const captured = board[r][c2];
        if (captured !== ' ') {
          playerScore += VALS[captured.toUpperCase()] || 0;
          document.getElementById('ch-ps').textContent = playerScore;
          if (captured === 'k') {
            board[r][c2] = board[sr][sc]; board[sr][sc] = ' ';
            if (board[r][c2]==='P'&&r===0) board[r][c2]='Q';
            renderBoard();
            document.getElementById('ch-msg').innerHTML = `<span style="color:var(--accent)">🏆 Roi capturé ! Victoire !</span>`;
            setTimeout(() => Arena.end('win', 500 + playerScore * 50), 1500);
            gameOver = true;
            selected = null;
            return;
          }
        }
        board[r][c2] = board[sr][sc]; board[sr][sc] = ' ';
        if (board[r][c2]==='P'&&r===0) board[r][c2]='Q'; // promotion
        selected = null;
        playerTurn = false;
        document.getElementById('ch-turn').textContent = '🤖 Robot réfléchit...';
        renderBoard();
        setTimeout(robotMove, 500 + Math.random()*500);
        return;
      }
      selected = null;
    }

    if (isWhite(piece)) {
      const moves = getMoves(board, r, c2);
      if (moves.length) selected = [r, c2];
    }
    renderBoard();
  }

  renderBoard();
};
