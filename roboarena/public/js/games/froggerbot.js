// Frogger Bot - Traverse la route avant le robot
window.startGame = function() {
  Arena.start();
  const c = Arena.getContainer();
  const COLS = 11, ROWS = 9, CS = 44;
  const W = COLS*CS, H = ROWS*CS;
  c.innerHTML = `
    <canvas id="frogCanvas" style="border:2px solid var(--border);border-radius:8px;display:block;max-width:100%"></canvas>
    <div style="color:var(--text3);font-size:0.78rem;margin-top:6px">Flèches ou WASD pour sauter</div>
  `;
  const canvas = document.getElementById('frogCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;

  let px=5, py=8, lives=3, score=0, running=true, won=false;
  let robotY = 8, robotInterval;
  let godTimer = 0; // invincibility frames after dying

  // Lanes: cars moving left or right
  const lanes = [
    { row:7, dir:1, speed:1.5, color:'#ff4444', cars:[{x:2},{x:6},{x:9}] },
    { row:6, dir:-1,speed:2,   color:'#ffa500', cars:[{x:1},{x:5},{x:8}] },
    { row:5, dir:1, speed:1.2, color:'#ff00aa', cars:[{x:3},{x:7}] },
    { row:4, dir:-1,speed:1.8, color:'#00c8ff', cars:[{x:0},{x:4},{x:8}] },
    { row:3, dir:1, speed:2.5, color:'#ff6348', cars:[{x:2},{x:6}] },
  ];
  // Convert to pixel positions
  lanes.forEach(l => { l.carPx = l.cars.map(car=>({x: car.x * CS})); });

  function reset(full=false) {
    if (full) { px=5; py=8; score=0; robotY=8; won=false; }
    else { px=5; py=8; }
    godTimer=60;
  }

  // Robot moves upward automatically
  let robotMoveTimer=0;
  robotInterval = setInterval(() => {
    if (!running||won) return;
    robotMoveTimer++;
    if (robotMoveTimer % 2 === 0 && robotY > 0) {
      robotY--;
      if (robotY === 0) {
        running=false;
        clearInterval(robotInterval);
        Arena.end('loss', score);
      }
    }
  }, 800);

  const keys = {};
  document.addEventListener('keydown', e=>{
    if (!running) return;
    const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
                 w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
    const m=moves[e.key];
    if(m){
      e.preventDefault();
      const nx=px+m[0], ny=py+m[1];
      if(nx>=0&&nx<COLS&&ny>=0&&ny<ROWS){px=nx;py=ny;}
      if(py===0){
        score+=100; won=true; running=false;
        clearInterval(robotInterval);
        Arena.end('win',score);
      }
    }
  });

  // Touch
  let ts=null;
  canvas.addEventListener('touchstart',e=>{ts={x:e.touches[0].clientX,y:e.touches[0].clientY};});
  canvas.addEventListener('touchend',e=>{
    if(!ts||!running) return;
    const dx=e.changedTouches[0].clientX-ts.x, dy=e.changedTouches[0].clientY-ts.y;
    ts=null;
    const threshold=20;
    if(Math.abs(dx)<threshold&&Math.abs(dy)<threshold) return;
    if(Math.abs(dx)>Math.abs(dy)){px=Math.max(0,Math.min(COLS-1,px+(dx>0?1:-1)));}
    else {
      const ny=py+(dy>0?1:-1);
      if(ny>=0&&ny<ROWS){py=ny;}
      if(py===0){score+=100;won=true;running=false;clearInterval(robotInterval);Arena.end('win',score);}
    }
  });

  function update() {
    // Move cars
    lanes.forEach(l => {
      l.carPx.forEach(car => {
        car.x += l.dir * l.speed;
        if (l.dir===1 && car.x > W) car.x = -CS;
        if (l.dir===-1 && car.x < -CS) car.x = W;
      });
    });

    // Collision
    if (godTimer > 0) { godTimer--; return; }
    lanes.forEach(l => {
      if (l.row !== py) return;
      l.carPx.forEach(car => {
        if (px*CS+8 < car.x+CS-8 && (px+1)*CS-8 > car.x+8) {
          lives--;
          if (lives <= 0) {
            running=false; clearInterval(robotInterval);
            Arena.end('loss',score);
          } else reset();
        }
      });
    });
  }

  function draw() {
    // Background
    ctx.fillStyle='#1a2a1a'; ctx.fillRect(0,0,W,H);
    // Safe zones
    ctx.fillStyle='#1a3a1a';
    ctx.fillRect(0,0,W,CS); // top
    ctx.fillRect(0,8*CS,W,CS); // bottom
    // Road lanes
    lanes.forEach(l => {
      ctx.fillStyle='#2a2a2a';
      ctx.fillRect(0,l.row*CS,W,CS);
      // Lane markings
      ctx.setLineDash([20,15]); ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,l.row*CS+CS/2); ctx.lineTo(W,l.row*CS+CS/2); ctx.stroke();
      ctx.setLineDash([]);
    });

    // Grid lines
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
    for(let i=0;i<COLS;i++){ctx.beginPath();ctx.moveTo(i*CS,0);ctx.lineTo(i*CS,H);ctx.stroke();}

    // Cars
    lanes.forEach(l => {
      l.carPx.forEach(car=>{
        ctx.fillStyle=l.color; ctx.shadowBlur=6; ctx.shadowColor=l.color;
        ctx.fillRect(car.x+4, l.row*CS+6, CS-8, CS-12);
        ctx.fillStyle='rgba(0,0,0,0.3)';
        ctx.fillRect(car.x+8, l.row*CS+10, 10, 8);
        ctx.fillRect(car.x+CS-18, l.row*CS+10, 10, 8);
      });
    });
    ctx.shadowBlur=0;

    // Robot frog
    if (robotY > 0 && robotY < ROWS) {
      ctx.font=`${CS-8}px serif`;
      ctx.textAlign='center';
      ctx.globalAlpha=0.7;
      ctx.fillText('🤖', 0.5*CS, robotY*CS+CS-6);
      ctx.globalAlpha=1;
    }

    // Player frog
    const alpha = godTimer > 0 ? (Math.floor(godTimer/5)%2===0?0.3:1) : 1;
    ctx.globalAlpha=alpha;
    ctx.font=`${CS-8}px serif`;
    ctx.fillText('🐸', (px+0.5)*CS, py*CS+CS-6);
    ctx.globalAlpha=1; ctx.shadowBlur=0;

    // Goal
    ctx.fillStyle='rgba(0,255,136,0.3)';
    ctx.fillRect(0,0,W,CS);
    ctx.fillStyle='rgba(0,255,136,0.8)'; ctx.font='12px Orbitron,monospace';
    ctx.fillText('🏁 ARRIVÉE', W/2, 28);

    // HUD
    ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='11px Orbitron,monospace';
    ctx.fillText('❤️'.repeat(lives) + '  Score:'+score, 8, H-8);
    ctx.textAlign='right'; ctx.fillStyle='rgba(255,68,68,0.7)';
    ctx.fillText('🤖 Ligne '+robotY, W-8, H-8);
  }

  function loop() {
    if (!running) return;
    update(); draw();
    requestAnimationFrame(loop);
  }
  loop();
};
