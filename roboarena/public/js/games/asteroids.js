// Robo Asteroids - Asteroids contre le robot
window.startGame = function() {
  Arena.start();
  const c = Arena.getContainer();
  c.innerHTML = `
    <canvas id="astCanvas" style="border:2px solid var(--border);border-radius:8px;display:block;max-width:100%"></canvas>
    <div style="color:var(--text3);font-size:0.78rem;margin-top:6px">← → Tourner | ↑/W Accélérer | Espace Tirer</div>
  `;
  const canvas = document.getElementById('astCanvas');
  const ctx = canvas.getContext('2d');
  const W = Math.min(500, window.innerWidth-80), H = 400;
  canvas.width = W; canvas.height = H;

  let ship = { x:W/2, y:H/2, angle:0, vx:0, vy:0, alive:true };
  let bullets = [], asteroids = [], particles = [];
  let score = 0, lives = 3, wave = 1, running = true;
  const keys = {};
  const ROBOT_SCORE_RATE = 5; // robot scores 5pts/sec

  let robotScore = 0;
  const robotInterval = setInterval(() => {
    if (!running) return;
    robotScore += ROBOT_SCORE_RATE;
  }, 1000);

  function spawnAsteroids(count, size) {
    for (let i=0;i<count;i++) {
      let x,y;
      do { x=Math.random()*W; y=Math.random()*H; }
      while (Math.abs(x-ship.x)<80&&Math.abs(y-ship.y)<80);
      const speed = 0.5+Math.random()*1.5;
      const angle = Math.random()*Math.PI*2;
      asteroids.push({
        x, y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        r:size, angle:0, spin:( Math.random()-0.5)*0.04,
        verts: Array.from({length:8+Math.floor(Math.random()*4)}, (_,i)=>{
          const a=i*Math.PI*2/12; return {a, r:size*(0.7+Math.random()*0.5)};
        })
      });
    }
  }

  function explode(x, y, color) {
    for (let i=0;i<8;i++) {
      const a=Math.random()*Math.PI*2, speed=1+Math.random()*3;
      particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:30,color});
    }
  }

  document.addEventListener('keydown', e=>{keys[e.code]=true; if(e.code==='Space')e.preventDefault();});
  document.addEventListener('keyup', e=>keys[e.code]=false);

  // Touch controls
  let touchAngle = null;
  canvas.addEventListener('touchstart', e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    const tx=(e.touches[0].clientX-r.left)*(W/r.width);
    const ty=(e.touches[0].clientY-r.top)*(H/r.height);
    touchAngle = Math.atan2(ty-ship.y, tx-ship.x);
    keys['Space'] = true;
    setTimeout(()=>{keys['Space']=false;},100);
  },{passive:false});

  spawnAsteroids(4+wave, 35);

  function update() {
    if (!running) return;
    // Ship controls
    if (keys['ArrowLeft']||keys['KeyA']) ship.angle -= 0.07;
    if (keys['ArrowRight']||keys['KeyD']) ship.angle += 0.07;
    if (keys['ArrowUp']||keys['KeyW']) {
      ship.vx += Math.cos(ship.angle)*0.3;
      ship.vy += Math.sin(ship.angle)*0.3;
    }
    if (touchAngle !== null) { ship.angle = touchAngle; touchAngle=null; }
    ship.vx *= 0.97; ship.vy *= 0.97;
    ship.x = (ship.x+ship.vx+W)%W; ship.y = (ship.y+ship.vy+H)%H;

    // Shoot
    if (keys['Space'] && ship.alive) {
      if (!ship._lastShot || Date.now()-ship._lastShot > 200) {
        ship._lastShot = Date.now();
        bullets.push({x:ship.x,y:ship.y,vx:Math.cos(ship.angle)*8,vy:Math.sin(ship.angle)*8,life:40});
      }
    }

    // Bullets
    bullets = bullets.filter(b=>{
      b.x+=b.vx; b.y+=b.vy; b.x=(b.x+W)%W; b.y=(b.y+H)%H; b.life--;
      return b.life>0;
    });

    // Asteroids
    asteroids.forEach(a=>{ a.x=(a.x+a.vx+W)%W; a.y=(a.y+a.vy+H)%H; a.angle+=a.spin; });

    // Bullet-asteroid collisions
    bullets.forEach((b,bi)=>{
      asteroids.forEach((a,ai)=>{
        if (Math.hypot(b.x-a.x,b.y-a.y) < a.r) {
          bullets.splice(bi,1);
          explode(a.x,a.y,'#ffa500');
          score += a.r > 25 ? 20 : 50;
          if (a.r > 22) {
            // Split
            for(let i=0;i<2;i++){
              const angle=Math.random()*Math.PI*2, sp=1.5+Math.random()*2;
              asteroids.push({...a, r:a.r/2, vx:Math.cos(angle)*sp, vy:Math.sin(angle)*sp,
                verts:Array.from({length:8},(_,i)=>({a:i*Math.PI*2/8,r:a.r/2*(0.7+Math.random()*0.5)}))
              });
            }
          }
          asteroids.splice(ai,1);
        }
      });
    });

    // Ship-asteroid collision
    if (ship.alive) {
      asteroids.forEach(a=>{
        if (Math.hypot(ship.x-a.x,ship.y-a.y) < a.r+12) {
          lives--;
          explode(ship.x,ship.y,'#ff4444');
          ship.x=W/2; ship.y=H/2; ship.vx=0; ship.vy=0;
          if (lives<=0) {
            running=false;
            clearInterval(robotInterval);
            Arena.end(score>robotScore?'win':'loss', score);
          }
        }
      });
    }

    // Particles
    particles = particles.filter(p=>{ p.x+=p.vx; p.y+=p.vy; return --p.life>0; });

    // New wave
    if (asteroids.length===0) {
      wave++;
      spawnAsteroids(3+wave, 35);
    }

    // Time limit
    if (score+robotScore > 2000) {
      running=false;
      clearInterval(robotInterval);
      Arena.end(score>=robotScore?'win':'loss', score);
    }
  }

  function draw() {
    ctx.fillStyle='#080813'; ctx.fillRect(0,0,W,H);

    // Scores
    ctx.font='11px Orbitron,monospace'; ctx.textAlign='left';
    ctx.fillStyle='rgba(0,255,136,0.8)'; ctx.fillText(`👤 ${score} pts`, 10, 20);
    ctx.fillStyle='rgba(255,68,68,0.8)'; ctx.textAlign='right';
    ctx.fillText(`🤖 ${robotScore} pts`, W-10, 20);
    ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillText('❤️'.repeat(lives), W/2, 20);

    // Asteroids
    asteroids.forEach(a=>{
      ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.angle);
      ctx.strokeStyle='#5588ff'; ctx.shadowBlur=6; ctx.shadowColor='#5588ff';
      ctx.lineWidth=2; ctx.beginPath();
      a.verts.forEach((v,i)=>{
        const x=Math.cos(v.a)*v.r, y=Math.sin(v.a)*v.r;
        i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.closePath(); ctx.stroke();
      ctx.restore(); ctx.shadowBlur=0;
    });

    // Ship
    if (ship.alive) {
      ctx.save(); ctx.translate(ship.x,ship.y); ctx.rotate(ship.angle);
      ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
      ctx.shadowBlur=10; ctx.shadowColor='#00ff88';
      ctx.beginPath();
      ctx.moveTo(18,0); ctx.lineTo(-10,10); ctx.lineTo(-6,0); ctx.lineTo(-10,-10);
      ctx.closePath(); ctx.stroke();
      if(keys['ArrowUp']||keys['KeyW']) {
        ctx.strokeStyle='#ff6600'; ctx.beginPath();
        ctx.moveTo(-6,4); ctx.lineTo(-14,0); ctx.lineTo(-6,-4); ctx.stroke();
      }
      ctx.restore(); ctx.shadowBlur=0;
    }

    // Bullets
    bullets.forEach(b=>{
      ctx.fillStyle='#ffff00'; ctx.shadowBlur=8; ctx.shadowColor='#ffff00';
      ctx.beginPath(); ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.fill();
    });

    // Particles
    particles.forEach(p=>{
      ctx.fillStyle=p.color; ctx.globalAlpha=p.life/30;
      ctx.beginPath(); ctx.arc(p.x,p.y,2,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1; ctx.shadowBlur=0;
  }

  function loop() {
    if (!running) return;
    update(); draw();
    requestAnimationFrame(loop);
  }
  loop();
};
