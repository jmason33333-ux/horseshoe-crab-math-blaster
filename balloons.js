/* =============================================
   BALLOONS.JS — Fish Spawning & Movement
   (Replaces balloons with canvas-drawn fish;
    bomb replaced by a pufferfish 🐡)
   ============================================= */

const BalloonManager = (() => {

  const FISH_COLORS = [
    '#ff6b6b', '#ffa94d', '#ffe066',
    '#69db7c', '#74c0fc', '#cc5de8',
    '#f783ac', '#63e6be',
  ];

  const FISH_RADIUS = 36;   // hit-test radius (half body length approx)
  const PUFFER_RADIUS = 34; // slightly smaller hit circle for pufferfish

  // Base speed (pixels per second) at level 1; scales 2.5% per level
  // Speed is CAPPED at level 6 equivalent so higher levels stay playable for kids
  const BASE_SPEED = 90;
  const MAX_SPEED_LEVEL = 6;

  let fish = [];
  let activePuffers = [];

  function speedForLevel(level) {
    const effectiveLevel = Math.min(level, MAX_SPEED_LEVEL);
    return BASE_SPEED * Math.pow(1.025, effectiveLevel - 1);
  }

  function pufferChanceForLevel(level) {
    return 0.08 + level * 0.01; // 9% L1 → 18% L10
  }

  /* ---------- FISH OBJECT ---------- */
  function createFish(x, y, vx, label, isCorrect, isPuffer, color) {
    return {
      x, y, vx, label, isCorrect, isPuffer, color,
      radius: isPuffer ? PUFFER_RADIUS : FISH_RADIUS,
      alive: true,
      popAnimTimer: 0,
      popping: false,
      // gentle bob offset per fish so they don't all bob in sync
      bobOffset: Math.random() * Math.PI * 2,
      bobTime: 0,
    };
  }

  /* ---------- SPAWN ---------- */
  function spawnEquationBalloons(equation, level, canvasWidth, canvasHeight) {
    fish = [];
    activePuffers = [];

    const speed = speedForLevel(level);
    const choices = [...equation.choices];
    const numFish = choices.length;

    const topMargin = 30;
    const bottomMargin = canvasHeight * 0.45;
    const usableHeight = canvasHeight - topMargin - bottomMargin;
    const rowSpacing = usableHeight / (numFish + 1);
    const staggerGap = FISH_RADIUS * 2 + 55;

    // Shuffle row assignments so correct answer isn't always same row
    const rowOrder = Array.from({ length: numFish }, (_, i) => i);
    for (let i = rowOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
    }

    choices.forEach((val, i) => {
      const isCorrect = val === equation.answer;
      const row = rowOrder[i];
      const goRight = (row % 2 === 0);
      const baseOffscreen = FISH_RADIUS + 60;
      const staggerOffset = staggerGap * i + Math.random() * 30;
      const startX = goRight
        ? -(baseOffscreen + staggerOffset)
        :  canvasWidth + baseOffscreen + staggerOffset;
      const vx = goRight ? speed : -speed;
      const y = topMargin + rowSpacing * (row + 1) + (Math.random() * 12 - 6);
      const color = FISH_COLORS[i % FISH_COLORS.length];
      fish.push(createFish(startX, y, vx, String(val), isCorrect, false, color));
    });

    // Pufferfish bomb
    const addPuffer = Math.random() < pufferChanceForLevel(level);
    if (addPuffer) {
      const bombRow = Math.floor(Math.random() * numFish);
      const goRight = Math.random() < 0.5;
      const bombStagger = staggerGap * (numFish + 1) * Math.random();
      const startX = goRight
        ? -(PUFFER_RADIUS + 60 + bombStagger)
        :  canvasWidth + PUFFER_RADIUS + 60 + bombStagger;
      const vx = goRight ? speed * 0.85 : -speed * 0.85;
      const y = topMargin + rowSpacing * (bombRow + 1);
      activePuffers.push(createFish(startX, y, vx, '!', false, true, '#e65100'));
    }
  }

  /* ---------- UPDATE ---------- */
  function update(dt) {
    const all = [...fish, ...activePuffers];
    all.forEach(f => {
      if (!f.alive) return;
      if (f.popping) {
        f.popAnimTimer -= dt;
        if (f.popAnimTimer <= 0) f.alive = false;
        return;
      }
      f.x += f.vx * dt;
      f.bobTime += dt;
    });
  }

  /* ---------- ALL GONE CHECK ---------- */
  function allGone(canvasWidth) {
    const all = [...fish, ...activePuffers];
    if (all.length === 0) return true;
    return all.every(f => !f.alive || hasExited(f, canvasWidth));
  }

  function hasExited(f, canvasWidth) {
    if (!f.alive) return true;
    if (f.vx > 0) return f.x > canvasWidth + f.radius + 20;
    return f.x < -f.radius - 20;
  }

  function isOffScreen(f, canvasWidth) {
    return f.x < -f.radius - 20 || f.x > canvasWidth + f.radius + 20;
  }

  /* ---------- HIT TEST ---------- */
  function checkHit(spineX, spineY) {
    const all = [...fish, ...activePuffers];
    for (const f of all) {
      if (!f.alive || f.popping) continue;
      const dx = f.x - spineX;
      const dy = f.y - spineY;
      if (Math.sqrt(dx * dx + dy * dy) < f.radius) {
        popFish(f);
        return f;
      }
    }
    return null;
  }

  function popFish(f) {
    f.popping = true;
    f.popAnimTimer = 0.4;
  }

  /* ---------- DRAW ---------- */
  function draw(ctx) {
    const all = [...fish, ...activePuffers];
    all.forEach(f => {
      if (!f.alive) return;
      ctx.save();
      ctx.globalAlpha = f.popping ? Math.max(0, f.popAnimTimer / 0.4) : 1;
      if (f.popping) {
        drawPopBurst(ctx, f);
      } else if (f.isPuffer) {
        drawPufferfish(ctx, f);
      } else {
        drawFish(ctx, f);
      }
      ctx.restore();
    });
  }

  /* ---------- POP BURST ---------- */
  function drawPopBurst(ctx, f) {
    const progress = 1 - (f.popAnimTimer / 0.4);
    const burstR = f.radius * (1 + progress * 1.5);
    // Bubble-burst rings
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, burstR * (0.4 + ring * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = f.isPuffer ? '#ff6600' : f.color;
      ctx.lineWidth = 3 - ring;
      ctx.globalAlpha = Math.max(0, (f.popAnimTimer / 0.4) - ring * 0.2);
      ctx.stroke();
    }
    // Bubble droplets
    for (let d = 0; d < 6; d++) {
      const angle = (d / 6) * Math.PI * 2 + progress * 2;
      const dist = burstR * 0.9;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(angle) * dist, f.y + Math.sin(angle) * dist, 4, 0, Math.PI * 2);
      ctx.fillStyle = f.isPuffer ? '#ffaa00' : f.color;
      ctx.globalAlpha = Math.max(0, f.popAnimTimer / 0.4);
      ctx.fill();
    }
  }

  /* ---------- DRAW REGULAR FISH ---------- */
  function drawFish(ctx, f) {
    const r = f.radius;
    // Gentle bob: small vertical sine wave
    const bob = Math.sin(f.bobTime * 2.2 + f.bobOffset) * 3;
    const cx = f.x;
    const cy = f.y + bob;

    // Fish faces the direction it swims
    const facingRight = f.vx > 0;
    const dir = facingRight ? 1 : -1;

    ctx.save();
    ctx.translate(cx, cy);
    if (!facingRight) ctx.scale(-1, 1); // flip horizontally when swimming left

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // --- TAIL FIN ---
    ctx.fillStyle = shadeColor(f.color, -20);
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, 0);
    ctx.lineTo(-r * 1.22, -r * 0.55);
    ctx.lineTo(-r * 1.05, 0);
    ctx.lineTo(-r * 1.22, r * 0.55);
    ctx.closePath();
    ctx.fill();

    // --- BODY (ellipse) ---
    const bodyGrad = ctx.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r * 0.9);
    bodyGrad.addColorStop(0, lightenColor(f.color, 40));
    bodyGrad.addColorStop(1, f.color);
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeColor(f.color, -30);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- TOP FIN ---
    ctx.fillStyle = shadeColor(f.color, -15);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.52);
    ctx.quadraticCurveTo(r * 0.1, -r * 0.92, r * 0.35, -r * 0.52);
    ctx.closePath();
    ctx.fill();

    // --- SCALES (3 arcs) ---
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    [-r * 0.3, r * 0.05, r * 0.38].forEach(sx => {
      ctx.beginPath();
      ctx.arc(sx, 0, r * 0.28, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    });

    // --- BELLY highlight ---
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(r * 0.05, r * 0.18, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- EYE ---
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.58, -r * 0.1, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(r * 0.61, -r * 0.1, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.65, -r * 0.14, r * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // --- MOUTH (cute smile) ---
    ctx.strokeStyle = shadeColor(f.color, -40);
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(r * 0.78, r * 0.06, r * 0.1, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // --- NUMBER LABEL on body ---
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    const fontSize = f.label.length > 2 ? r * 0.42 : r * 0.52;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Un-flip text so it always reads left-to-right
    if (!facingRight) ctx.scale(-1, 1);
    ctx.fillText(f.label, facingRight ? 0 : 0, r * 0.06);

    ctx.restore();
  }

  /* ---------- DRAW PUFFERFISH ---------- */
  function drawPufferfish(ctx, f) {
    const r = f.radius;
    const bob = Math.sin(f.bobTime * 1.6 + f.bobOffset) * 2.5;
    const cx = f.x;
    const cy = f.y + bob;

    ctx.save();
    ctx.translate(cx, cy);

    const facingRight = f.vx > 0;
    if (!facingRight) ctx.scale(-1, 1);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    // SPINES all around (puffer is inflated)
    const spineCount = 14;
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 2;
    for (let s = 0; s < spineCount; s++) {
      const angle = (s / spineCount) * Math.PI * 2;
      const innerR = r * 0.88;
      const outerR = r * 1.28;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.stroke();
    }

    // Body — round inflated ball
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r);
    bodyGrad.addColorStop(0, '#ffcc80');
    bodyGrad.addColorStop(0.6, '#ff8f00');
    bodyGrad.addColorStop(1, '#e65100');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spots
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    [[r * 0.25, -r * 0.3, r * 0.12], [-r * 0.25, r * 0.2, r * 0.09], [r * 0.1, r * 0.35, r * 0.08]].forEach(([sx, sy, sr]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    });

    // Belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, r * 0.2, r * 0.38, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye (wide, alarmed look)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.42, -r * 0.22, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(r * 0.44, -r * 0.22, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(r * 0.49, -r * 0.27, r * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Alarmed eyebrow
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r * 0.26, -r * 0.44);
    ctx.lineTo(r * 0.58, -r * 0.48);
    ctx.stroke();

    // Puckered mouth
    ctx.strokeStyle = '#bf360c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r * 0.62, r * 0.1, r * 0.1, -0.5, 0.5);
    ctx.stroke();

    // "!" danger label — un-flip for readability
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r * 0.55}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!facingRight) ctx.scale(-1, 1);
    ctx.fillText('✕', 0, r * 0.08);

    ctx.restore();
  }

  /* ---------- COLOR HELPERS ---------- */
  function shadeColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  function lightenColor(hex, amount) {
    return shadeColor(hex, amount);
  }

  /* ---------- RESET ---------- */
  function reset() {
    fish = [];
    activePuffers = [];
  }

  // Keep public API identical to old balloons.js so game.js needs no changes
  return {
    spawnEquationBalloons,
    update,
    draw,
    checkHit,
    allGone,
    isOffScreen,
    reset,
    get all() { return [...fish, ...activePuffers]; }
  };
})();
