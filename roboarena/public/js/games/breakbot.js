// Break-Bot - Casse-briques en compétition
window.startGame = function() {
  Arena.start();
  const c = Arena.getContainer();
  c.innerHTML = `
    <canvas id="bbCanvas" style="border:2px solid var(--border);border-radius:8px;display:block;max-width:100%"></canvas>
    <div style="color:var(--text3);font-size:0.78rem;margin-top:6px">Souris/tactile pour bouger la raquette</div>
  `;
  const canvas = document.getElementById('bbCanvas');
  const ctx = canvas.getContext('2d');
  const W = Math.min(480, window.innerWidth - 80), H = 400;
  canvas.width = W; canvas.height = H;

  const PAD_W = 80, PAD_H = 10, BALL_R = 7;
  const BRICK_ROWS = 4, BRICK_COLS = 8;
  const BRICK_W = (W - 40) / BRICK_COLS, BRICK_H = 20;
  const BRICK_PAD = 3;

  let px = W/2 - PAD_W/2, py = H - 40;
  let bx = W/2, by = H/2;
  let vx = 3, vy = -3;
  let playerBricks = 0, robotBricks = 0;
  let running = true, lives = 3;

  // Create bricks
  const bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c2 = 0; c2 < BRICK_COLS; c2++) {
      bricks.push({
        x: 20 + c2 * BRICK_W, y: 60 + r * (BRICK_H + BRICK_PAD),
        alive: true,
        color: `hsl(${(r*30+c2*10) % 360}, 70%, 55%)`
      });
    }
  }
  const totalBricks = bricks.length;

  // Robot score bar simulation
  let robotProgress = 0;
  const robotInterval = setInterval(() => {
    if (!running) return;
    robotBricks++;
    robotProgress = robotBricks / totalBricks;
  }, 1200);

  // Controls
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    px = ((e.clientX - r.left) * (W / r.width)) - PAD_W/2;
    px = Math.max(0, Math.min(W - PAD_W, px));
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    px = ((e.touches[0].clientX - r.left) * (W / r.width)) - PAD_W/2;
    px = Math.max(0, Math.min(W - PAD_W, px));
  }, {passive:false});

  function update() {
    bx += vx; by += vy;
    // Wall bounce
    if (bx - BALL_R < 0) { bx = BALL_R; vx = Math.abs(vx); }
    if (bx + BALL_R > W) { bx = W - BALL_R; vx = -Math.abs(vx); }
    if (by - BALL_R < 0) { by = BALL_R; vy = Math.abs(vy); }

    // Paddle
    if (by + BALL_R >= py && by - BALL_R <= py + PAD_H && bx >= px && bx <= px + PAD_W && vy > 0) {
      vy = -Math.abs(vy);
      vx += (bx - (px + PAD_W/2)) * 0.1;
      vx = Math.max(-6, Math.min(6, vx));
      by = py - BALL_R;
    }

    // Ball lost
    if (by + BALL_R > H + 20) {
      lives--;
      if (lives <= 0) {
        running = false;
        clearInterval(robotInterval);
        Arena.end(playerBricks > robotBricks ? 'win' : 'loss', playerBricks * 20);
        return;
      }
      bx = W/2; by = H/2;
      vx = (Math.random() > 0.5 ? 1 : -1) * 3;
      vy = -3;
    }

    // Bricks
    bricks.forEach(b => {
      if (!b.alive) return;
      if (bx + BALL_R > b.x + BRICK_PAD && bx - BALL_R < b.x + BRICK_W - BRICK_PAD &&
          by + BALL_R > b.y + BRICK_PAD && by - BALL_R < b.y + BRICK_H - BRICK_PAD) {
        b.alive = false;
        playerBricks++;
        // Bounce
        const cx = bx - (b.x + BRICK_W/2);
        const cy = by - (b.y + BRICK_H/2);
        if (Math.abs(cx / (BRICK_W/2)) > Math.abs(cy / (BRICK_H/2))) vx = -vx;
        else vy = -vy;

        const aliveBricks = bricks.filter(b => b.alive).length;
        if (aliveBricks === 0 || playerBricks + robotBricks >= totalBricks) {
          running = false;
          clearInterval(robotInterval);
          Arena.end(playerBricks >= robotBricks ? 'win' : 'loss', playerBricks * 20);
        }
      }
    });

    // Speed up slightly over time
    const speed = Math.sqrt(vx*vx+vy*vy);
    if (speed < 5) { vx *= 1.001; vy *= 1.001; }
  }

  function draw() {
    ctx.fillStyle = '#080813'; ctx.fillRect(0,0,W,H);

    // Score bars
    ctx.fillStyle = 'rgba(0,255,136,0.2)';
    ctx.fillRect(10, 10, (W-20) * (playerBricks/totalBricks), 8);
    ctx.strokeStyle = 'var(--accent)';ctx.lineWidth=1;
    ctx.strokeRect(10,10,W-20,8);
    ctx.fillStyle='rgba(0,255,136,0.8)'; ctx.font='10px Orbitron,monospace';
    ctx.textAlign='left';
    ctx.fillText(`👤 ${playerBricks}`, 12, 8);

    ctx.fillStyle = 'rgba(255,68,68,0.2)';
    ctx.fillRect(10, 22, (W-20) * robotProgress, 8);
    ctx.strokeStyle='var(--danger)';ctx.strokeRect(10,22,W-20,8);
    ctx.fillStyle='rgba(255,68,68,0.8)';
    ctx.fillText(`🤖 ${robotBricks}`, 12, 20);

    // Lives
    ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillText('❤️'.repeat(lives), W-10, 8);

    // Bricks
    bricks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 4; ctx.shadowColor = b.color;
      ctx.fillRect(b.x + BRICK_PAD, b.y + BRICK_PAD, BRICK_W - BRICK_PAD*2, BRICK_H - BRICK_PAD*2);
    });
    ctx.shadowBlur = 0;

    // Paddle
    ctx.fillStyle = '#00ff88'; ctx.shadowBlur = 8; ctx.shadowColor = '#00ff88';
    const pr = 5;
    ctx.beginPath();
    ctx.moveTo(px+pr, py);
    ctx.lineTo(px+PAD_W-pr, py);
    ctx.quadraticCurveTo(px+PAD_W, py, px+PAD_W, py+pr);
    ctx.lineTo(px+PAD_W, py+PAD_H-pr);
    ctx.quadraticCurveTo(px+PAD_W, py+PAD_H, px+PAD_W-pr, py+PAD_H);
    ctx.lineTo(px+pr, py+PAD_H);
    ctx.quadraticCurveTo(px, py+PAD_H, px, py+PAD_H-pr);
    ctx.lineTo(px, py+pr);
    ctx.quadraticCurveTo(px, py, px+pr, py);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(bx, by, BALL_R, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function loop() {
    if (!running) return;
    update(); draw();
    requestAnimationFrame(loop);
  }
  loop();
};
