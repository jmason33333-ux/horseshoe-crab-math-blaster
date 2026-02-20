/* =============================================
   OBSTACLES.JS — Sharks, Sea Turtles, Seagulls
   ============================================= */

const ObstacleManager = (() => {

  let obstacles = [];
  let spawnTimer = 0;

  // How often (seconds) a new obstacle can spawn per level
  // Starts infrequent; increases slightly with level but stays sparse
  function spawnInterval(level) {
    // Level 1: ~10s between spawns. Level 10: ~6s. Always feels like an occasional surprise.
    return Math.max(6, 11 - level * 0.5);
  }

  // Max simultaneous obstacles on screen
  function maxObstacles(level) {
    if (level <= 3) return 1;
    if (level <= 6) return 2;
    return 2; // cap at 2 — math stays the focus
  }

  /* ---------- OBSTACLE TYPES ---------- */

  function createShark(canvasWidth, canvasHeight) {
    // S-curve top to bottom, moderate speed, comes from random x at top
    const x = Math.random() * (canvasWidth * 0.6) + canvasWidth * 0.2;
    const speed = 110 + Math.random() * 30;
    const amplitude = 55 + Math.random() * 40; // horizontal swing
    const frequency = 1.2 + Math.random() * 0.6; // oscillations per second
    return {
      type: 'shark',
      x, y: -60,
      baseX: x,
      speed,        // vertical pixels/sec
      amplitude,
      frequency,
      time: 0,      // used for sine wave
      width: 64, height: 50,
      alive: true,
    };
  }

  function createSeaTurtle(canvasWidth, canvasHeight) {
    // Straight down, slow, random x column
    const x = Math.random() * (canvasWidth * 0.8) + canvasWidth * 0.1;
    const speed = 55 + Math.random() * 20;
    return {
      type: 'turtle',
      x, y: -55,
      speed,
      width: 55, height: 55,
      alive: true,
    };
  }

  function createSeagull(canvasWidth, canvasHeight) {
    // Diagonal swoop from top-left or top-right, angled down
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -60 : canvasWidth + 60;
    const targetX = fromLeft
      ? canvasWidth * 0.3 + Math.random() * canvasWidth * 0.4
      : Math.random() * canvasWidth * 0.4 + canvasWidth * 0.3;
    const startY = Math.random() * 80 + 20;
    const endY = canvasHeight + 60;
    const totalDist = Math.sqrt(Math.pow(targetX - startX, 2) + Math.pow(endY - startY, 2));
    const speed = 160 + Math.random() * 40;
    const vx = ((targetX - startX) / totalDist) * speed;
    const vy = ((endY - startY) / totalDist) * speed;
    return {
      type: 'seagull',
      x: startX, y: startY,
      vx, vy,
      facingLeft: !fromLeft,
      width: 60, height: 40,
      alive: true,
    };
  }

  /* ---------- SPAWN ---------- */
  function trySpawn(level, canvasWidth, canvasHeight) {
    const activeCount = obstacles.filter(o => o.alive).length;
    if (activeCount >= maxObstacles(level)) return;

    const roll = Math.random();
    let obstacle;
    if (roll < 0.33) {
      obstacle = createShark(canvasWidth, canvasHeight);
    } else if (roll < 0.66) {
      obstacle = createSeaTurtle(canvasWidth, canvasHeight);
    } else {
      obstacle = createSeagull(canvasWidth, canvasHeight);
    }
    obstacles.push(obstacle);
  }

  /* ---------- UPDATE ---------- */
  function update(dt, level, canvasWidth, canvasHeight) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      trySpawn(level, canvasWidth, canvasHeight);
      spawnTimer = spawnInterval(level) + (Math.random() * 3 - 1.5); // ±1.5s jitter
    }

    obstacles.forEach(o => {
      if (!o.alive) return;

      if (o.type === 'shark') {
        o.time += dt;
        o.y += o.speed * dt;
        o.x = o.baseX + Math.sin(o.time * o.frequency * Math.PI * 2) * o.amplitude;

      } else if (o.type === 'turtle') {
        o.y += o.speed * dt;

      } else if (o.type === 'seagull') {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
      }

      // Remove when off screen
      if (o.y > canvasHeight + 80 || o.x < -100 || o.x > canvasWidth + 100) {
        o.alive = false;
      }
    });

    // Cleanup dead
    obstacles = obstacles.filter(o => o.alive);
  }

  /* ---------- COLLISION WITH CRAB ---------- */
  // Returns true if any obstacle overlaps the crab center
  function checkCrabHit(crabX, crabY, crabRadius) {
    for (const o of obstacles) {
      if (!o.alive) continue;
      const hw = o.width / 2;
      const hh = o.height / 2;
      // Simple AABB vs circle
      const nearX = Math.max(o.x - hw, Math.min(crabX, o.x + hw));
      const nearY = Math.max(o.y - hh, Math.min(crabY, o.y + hh));
      const dx = crabX - nearX;
      const dy = crabY - nearY;
      if (dx * dx + dy * dy < crabRadius * crabRadius) {
        // Remove the obstacle that was hit (so one bump = one penalty)
        o.alive = false;
        return true;
      }
    }
    return false;
  }

  /* ---------- DRAW ---------- */
  function draw(ctx) {
    obstacles.forEach(o => {
      if (!o.alive) return;
      ctx.save();
      if (o.type === 'shark') drawShark(ctx, o);
      else if (o.type === 'turtle') drawTurtle(ctx, o);
      else if (o.type === 'seagull') drawSeagull(ctx, o);
      ctx.restore();
    });
  }

  function drawShark(ctx, o) {
    ctx.translate(o.x, o.y);
    // Body
    ctx.fillStyle = '#607d8b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dorsal fin
    ctx.fillStyle = '#546e7a';
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.lineTo(5, -38);
    ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();
    // Tail fin (at top since swimming down)
    ctx.fillStyle = '#546e7a';
    ctx.beginPath();
    ctx.moveTo(-8, 16);
    ctx.lineTo(-22, 28);
    ctx.lineTo(0, 20);
    ctx.lineTo(22, 28);
    ctx.lineTo(8, 16);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(18, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(19, -6, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#fff';
    const teethX = [10, 15, 20];
    teethX.forEach(tx => {
      ctx.beginPath();
      ctx.moveTo(tx - 3, 16);
      ctx.lineTo(tx, 22);
      ctx.lineTo(tx + 3, 16);
      ctx.fill();
    });
  }

  function drawTurtle(ctx, o) {
    ctx.translate(o.x, o.y);
    // Shell
    const shellGrad = ctx.createRadialGradient(-5, -5, 4, 0, 0, 26);
    shellGrad.addColorStop(0, '#81c784');
    shellGrad.addColorStop(1, '#388e3c');
    ctx.fillStyle = shellGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Shell pattern
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -14); ctx.lineTo(-14, 14); ctx.stroke();
    // Head (at top since moving down)
    ctx.fillStyle = '#66bb6a';
    ctx.beginPath();
    ctx.ellipse(0, -26, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-4, -28, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -28, 2.5, 0, Math.PI * 2); ctx.fill();
    // Flippers
    ctx.fillStyle = '#66bb6a';
    [[-28, -10, 10, 8], [28, -10, 10, 8]].forEach(([fx, fy, fw, fh]) => {
      ctx.beginPath();
      ctx.ellipse(fx, fy, fw, fh, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
    });
    // Bottom flippers (smaller)
    [[-18, 20, 8, 6], [18, 20, 8, 6]].forEach(([fx, fy, fw, fh]) => {
      ctx.beginPath();
      ctx.ellipse(fx, fy, fw, fh, -Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSeagull(ctx, o) {
    ctx.translate(o.x, o.y);
    if (o.facingLeft) ctx.scale(-1, 1);
    // Body
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(18, -6, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beak
    ctx.fillStyle = '#ffa726';
    ctx.beginPath();
    ctx.moveTo(26, -6);
    ctx.lineTo(36, -4);
    ctx.lineTo(26, -2);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(21, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Wing (upper)
    ctx.fillStyle = '#b0bec5';
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.quadraticCurveTo(-5, -28, 18, -18);
    ctx.quadraticCurveTo(5, -10, -5, -5);
    ctx.fill();
    // Wing tip
    ctx.fillStyle = '#78909c';
    ctx.beginPath();
    ctx.moveTo(-5, -28);
    ctx.lineTo(5, -38);
    ctx.lineTo(18, -18);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.fillStyle = '#eceff1';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-32, 8);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-32, -6);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- RESET ---------- */
  function reset() {
    obstacles = [];
    spawnTimer = 4; // short initial delay before first obstacle
  }

  return { update, draw, checkCrabHit, reset };
})();
