// Robo Soccer - Penalty contre le robot gardien
window.startGame = function() {
  Arena.start();
  const c = Arena.getContainer();
  c.innerHTML = `
    <div style="text-align:center;padding:24px;width:100%;max-width:460px">
      <div style="font-family:'Orbitron',monospace;margin-bottom:12px;display:flex;justify-content:space-around">
        <span>⚽ Buts: <span id="rs-goals" style="color:var(--accent)">0</span>/5</span>
        <span style="color:var(--text3)">Tir <span id="rs-shot">1</span>/5</span>
        <span>🤖 Arrêts: <span id="rs-saves" style="color:var(--danger)">0</span></span>
      </div>

      <!-- Goal visualization -->
      <div id="rs-goal-wrap" style="position:relative;width:320px;height:180px;margin:0 auto 16px;border:4px solid #fff;border-top:4px solid #fff;border-radius:4px 4px 0 0;background:linear-gradient(180deg,#1a3a2a,#0f2a1a);overflow:hidden">
        <!-- Net lines -->
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.2" xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="net" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 0 L20 0 M0 0 L0 20" stroke="white" stroke-width="0.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#net)"/>
        </svg>
        <!-- Zone buttons (3x3 grid of invisible click areas) -->
        <div id="rs-zones" style="position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:2px;padding:4px"></div>
        <!-- Ball -->
        <div id="rs-ball" style="position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);font-size:2rem;transition:all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)">⚽</div>
        <!-- Goalkeeper -->
        <div id="rs-keeper" style="position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:2.5rem;transition:all 0.3s ease">🤖</div>
        <!-- Result overlay -->
        <div id="rs-overlay" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:2rem;background:rgba(0,0,0,0.5)"></div>
      </div>

      <div id="rs-inst" style="color:var(--text2);font-size:0.9rem;margin-bottom:12px">Choisis une zone pour tirer !</div>
      <div id="rs-msg" style="font-family:'Orbitron',monospace;min-height:28px"></div>
    </div>
  `;

  let goals = 0, saves = 0, shot = 0, SHOTS = 5;
  let shooting = false;

  const ZONE_NAMES = ['Haut gauche','Haut centre','Haut droite','Milieu gauche','Centre','Milieu droite','Bas gauche','Bas centre','Bas droite'];
  const KEEPER_POS = ['10%','40%','70%']; // left positions
  const KEEPER_TOP = ['8px','45%','auto']; // top positions

  function buildZones() {
    const zoneWrap = document.getElementById('rs-zones');
    zoneWrap.innerHTML='';
    for(let i=0;i<9;i++) {
      const z=document.createElement('div');
      z.style.cssText=`border-radius:4px;cursor:pointer;border:2px solid transparent;transition:all 0.15s;display:flex;align-items:center;justify-content:center;`;
      z.onmouseenter=()=>{ if(!shooting) z.style.borderColor='rgba(0,255,136,0.5)'; z.style.background='rgba(0,255,136,0.1)'; };
      z.onmouseleave=()=>{ z.style.borderColor='transparent'; z.style.background=''; };
      z.onclick=()=>takeShot(i);
      zoneWrap.appendChild(z);
    }
  }

  function takeShot(zone) {
    if(shooting||shot>=SHOTS) return;
    shooting=true;
    shot++;
    document.getElementById('rs-shot').textContent=shot;
    document.getElementById('rs-inst').textContent='';

    // Goalkeeper picks random zone column (0-2)
    const keeperCol = Math.floor(Math.random()*3);
    const keeperRow = Math.floor(Math.random()*3);
    const keeperZone = keeperRow*3+keeperCol;

    // Move keeper
    const keeper=document.getElementById('rs-keeper');
    keeper.style.left=KEEPER_POS[keeperCol];
    keeper.style.top=KEEPER_TOP[keeperRow]==='auto' ? 'auto' : KEEPER_TOP[keeperRow];
    if(keeperRow===2) { keeper.style.top='auto'; keeper.style.bottom='10px'; }
    else keeper.style.bottom='auto';

    // Move ball to shot zone
    const col=zone%3, row=Math.floor(zone/3);
    const ballX=col*33+16+'%';
    const ballY=['10px','35%','60%'][row];
    const ball=document.getElementById('rs-ball');
    ball.style.bottom='auto';
    ball.style.left=ballX;
    ball.style.top=ballY;

    setTimeout(()=>{
      const saved = keeperZone===zone || (keeperCol===col && Math.random()<0.25);
      const overlay=document.getElementById('rs-overlay');
      overlay.style.display='flex';

      if(!saved) {
        goals++;
        document.getElementById('rs-goals').textContent=goals;
        overlay.innerHTML=`<span style="color:#00ff88">⚽ BUT !</span>`;
        overlay.style.background='rgba(0,80,0,0.5)';
      } else {
        saves++;
        document.getElementById('rs-saves').textContent=saves;
        overlay.innerHTML=`<span style="color:#ff4444">🛑 ARRÊTÉ !</span>`;
        overlay.style.background='rgba(80,0,0,0.5)';
        keeper.textContent='🤲';
        setTimeout(()=>keeper.textContent='🤖',600);
      }

      setTimeout(()=>{
        overlay.style.display='none';
        // Reset ball
        ball.style.top='auto'; ball.style.bottom='-30px'; ball.style.left='50%';
        shooting=false;

        if(shot>=SHOTS) {
          const result=goals>saves?'win':goals<saves?'loss':'draw';
          document.getElementById('rs-msg').innerHTML=result==='win'
            ? `<span style="color:var(--accent)">🏆 ${goals} buts sur ${SHOTS} ! Victoire !</span>`
            : `<span style="color:var(--danger)">🤖 Seulement ${goals} buts... Défaite !</span>`;
          setTimeout(()=>Arena.end(result, goals*120), 1500);
        } else {
          document.getElementById('rs-inst').textContent='Choisis une zone pour tirer !';
        }
      },800);
    },500);
  }

  buildZones();
  document.getElementById('rs-msg').innerHTML=`<span style="color:var(--text3)">Clique sur une zone dans le but pour tirer !</span>`;
};
