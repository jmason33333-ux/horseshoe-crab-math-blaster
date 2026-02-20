/* =============================================
   BALLOONS.JS — Balloon Spawning & Movement
   ============================================= */

const BalloonManager = (() => {

  const BALLOON_COLORS = [
    '#ff6b6b', '#ffa94d', '#ffe066',
    '#69db7c', '#74c0fc', '#cc5de8',
    '#f783ac', '#63e6be',
  ];
  const BOMB_COLOR = '#333';
  const BOMB_RADIUS = 28;
  const BALLOON_RADIUS = 32;

  // Base speed (pixels per second) at level 1; scales 2.5% per level
  // Speed is CAPPED at level 6 equivalent so higher levels stay playable for kids
  const BASE_SPEED = 90;
  const MAX_SPEED_LEVEL = 6; // levels 7-10 hold this speed; only math gets harder

  let balloons = [];
  let activeBombs = [];

  // Returns speed for a given level (2.5% increase per level, capped at level 6)
  function speedForLevel(level) {
    const effectiveLevel = Math.min(level, MAX_SPEED_LEVEL);
    return BASE_SPEED * Math.pow(1.025, effectiveLevel - 1);
  }

  // Probability a bomb appears (increases slightly with level)
  function bombChanceForLevel(level) {
    return 0.08 + level * 0.01; // 9% at L1 → 18% at L10
  }

  /* ---------- BALLOON OBJECT ---------- */
  function createBalloon(x, y, vx, label, isAnswer, isCorrect, isBomb, color) {
    return { x, y, vx, label, isAnswer, isCorrect, isBomb, color,
      radius: isBomb ? BOMB_RADIUS : BALLOON_RADIUS,
      alive: true,
      alpha: 1,
      popAnimTimer: 0,
      popping: false,
    };
  }

  /* ---------- SPAWN A SET OF BALLOONS FOR AN EQUATION ---------- */
  function spawnEquationBalloons(equation, level, canvasWidth, canvasHeight) {
    balloons = [];
    activeBombs = [];

    const speed = speedForLevel(level);
    const choices = [...equation.choices]; // already shuffled by EquationEngine
    const numBalloons = choices.length;

    // --- HORIZONTAL STAGGER LAYOUT ---
    // Each balloon travels on its own horizontal row.
    // Rows are spread across the UPPER HALF of the play area with generous spacing.
    // Balloons on even rows go LEFT→RIGHT, odd rows go RIGHT→LEFT.
    // Each balloon is OFFSET in time (x start position) so they arrive at different
    // moments — no wall of balloons, always one or two visible at a time.

    // How much vertical space to use (upper portion only, keep bottom free for crab)
    const topMargin = 30;
    const bottomMargin = canvasHeight * 0.45; // balloons stay in top 55%
    const usableHeight = canvasHeight - topMargin - bottomMargin;
    const rowSpacing = usableHeight / (numBalloons + 1);

    // Time-offset stagger: each balloon starts further off-screen so they arrive
    // sequentially rather than all at once. Gap = roughly 1.2 balloon-diameters apart.
    const staggerGap = (BALLOON_RADIUS * 2 + 55); // pixels of extra offset per balloon

    // Shuffle the indices so correct answer isn't always on same row
    const rowOrder = Array.from({ length: numBalloons }, (_, i) => i);
    for (let i = rowOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rowOrder[i], rowOrder[j]] = [rowOrder[j], rowOrder[i]];
    }

    choices.forEach((val, i) => {
      const isCorrect = val === equation.answer;
      const row = rowOrder[i]; // which vertical row this balloon occupies
      const goRight = (row % 2 === 0); // direction alternates by row

      // Base start position — guaranteed fully off-screen with generous margin
      // so balloon 0 never "pops in" visibly on frame 1
      const baseOffscreen = BALLOON_RADIUS + 60;
      // Stagger offset: balloon i starts extra distance off-screen so they arrive
      // at different times. Randomise the order a bit so it doesn't feel mechanical.
      const staggerOffset = staggerGap * i + Math.random() * 30;

      const startX = goRight
        ? -(baseOffscreen + staggerOffset)
        :  canvasWidth + baseOffscreen + staggerOffset;

      const vx = goRight ? speed : -speed;

      // Y: evenly distributed rows, with a small random nudge per row
      const y = topMargin + rowSpacing * (row + 1) + (Math.random() * 12 - 6);

      const color = BALLOON_COLORS[i % BALLOON_COLORS.length];
      balloons.push(createBalloon(startX, y, vx, String(val), true, isCorrect, false, color));
    });

    // Possibly add a bomb balloon — place it on a random row at an extra stagger offset
    const addBomb = Math.random() < bombChanceForLevel(level);
    if (addBomb) {
      const bombRow = Math.floor(Math.random() * numBalloons);
      const goRight = Math.random() < 0.5;
      const bombStagger = staggerGap * (numBalloons + 1) * Math.random();
      const startX = goRight
        ? -(BALLOON_RADIUS + 60 + bombStagger)
        :  canvasWidth + BALLOON_RADIUS + 60 + bombStagger;
      const vx = goRight ? speed * 0.9 : -speed * 0.9;
      const y = topMargin + rowSpacing * (bombRow + 1);
      activeBombs.push(createBalloon(startX, y, vx, '💣', false, false, true, BOMB_COLOR));
    }
  }

  /* ---------- UPDATE ---------- */
  function update(dt) {
    const all = [...balloons, ...activeBombs];
    all.forEach(b => {
      if (!b.alive) return;
      if (b.popping) {
        b.popAnimTimer -= dt;
        if (b.popAnimTimer <= 0) b.alive = false;
        return;
      }
      b.x += b.vx * dt;
    });
  }

  /* ---------- CHECK IF ALL ANSWER BALLOONS GONE ---------- */
  // A balloon is "done" only if it has fully EXITED the screen on the FAR side
  // (i.e. it has actually crossed). Balloons still queued off-screen waiting to
  // enter are NOT done — we must wait for them to cross and exit before moving on.
  function allGone(canvasWidth) {
    const all = [...balloons, ...activeBombs];
    if (all.length === 0) return true;
    return all.every(b => !b.alive || hasExited(b, canvasWidth));
  }

  // hasExited: true only when the balloon has travelled THROUGH the screen and out
  // the other side. We detect this by checking direction of travel vs position.
  function hasExited(b, canvasWidth) {
    if (!b.alive) return true;
    if (b.vx > 0) {
      // Moving right — exited when past right edge
      return b.x > canvasWidth + b.radius + 20;
    } else {
      // Moving left — exited when past left edge
      return b.x < -b.radius - 20;
    }
  }

  // Legacy helper kept for any external uses
  function isOffScreen(b, canvasWidth) {
    return b.x < -b.radius - 20 || b.x > canvasWidth + b.radius + 20;
  }

  /* ---------- HIT TEST ---------- */
  // Returns hit balloon or null
  function checkHit(spineX, spineY) {
    const all = [...balloons, ...activeBombs];
    for (const b of all) {
      if (!b.alive || b.popping) continue;
      const dx = b.x - spineX;
      const dy = b.y - spineY;
      if (Math.sqrt(dx * dx + dy * dy) < b.radius) {
        popBalloon(b);
        return b;
      }
    }
    return null;
  }

  function popBalloon(b) {
    b.popping = true;
    b.popAnimTimer = 0.35; // seconds for pop animation
  }

  /* ---------- DRAW ---------- */
  function draw(ctx) {
    const all = [...balloons, ...activeBombs];
    all.forEach(b => {
      if (!b.alive) return;
      drawBalloon(ctx, b);
    });
  }

  function drawBalloon(ctx, b) {
    ctx.save();
    ctx.globalAlpha = b.popping ? Math.max(0, b.popAnimTimer / 0.35) : 1;

    if (b.popping) {
      // Pop burst effect
      const progress = 1 - (b.popAnimTimer / 0.35);
      const burstR = b.radius * (1 + progress * 1.2);
      ctx.beginPath();
      ctx.arc(b.x, b.y, burstR, 0, Math.PI * 2);
      ctx.fillStyle = b.isBomb ? '#ff4400' : b.color;
      ctx.fill();
      ctx.restore();
      return;
    }

    if (b.isBomb) {
      drawBombBalloon(ctx, b);
    } else {
      drawRegularBalloon(ctx, b);
    }

    ctx.restore();
  }

  function drawRegularBalloon(ctx, b) {
    const r = b.radius;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;

    // Balloon body
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Shine highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(b.x - r * 0.28, b.y - r * 0.28, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    // Knot at bottom
    ctx.beginPath();
    ctx.arc(b.x, b.y + r, 4, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();

    // String
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + r + 4);
    ctx.lineTo(b.x + 6, b.y + r + 22);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r * 0.62}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fillText(b.label, b.x, b.y);
  }

  function drawBombBalloon(ctx, b) {
    const r = b.radius;

    // Dark balloon
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(b.x - r * 0.2, b.y - r * 0.2, r * 0.1, b.x, b.y, r);
    grad.addColorStop(0, '#666');
    grad.addColorStop(1, '#111');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fuse on top
    ctx.beginPath();
    ctx.moveTo(b.x + r * 0.4, b.y - r * 0.7);
    ctx.quadraticCurveTo(b.x + r * 0.7, b.y - r * 1.1, b.x + r * 0.5, b.y - r * 1.3);
    ctx.strokeStyle = '#c8a400';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fuse spark
    ctx.beginPath();
    ctx.arc(b.x + r * 0.5, b.y - r * 1.3, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdd00';
    ctx.fill();

    // Emoji bomb label
    ctx.font = `${r * 0.9}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💣', b.x, b.y + 2);
  }

  /* ---------- RESET ---------- */
  function reset() {
    balloons = [];
    activeBombs = [];
  }

  return {
    spawnEquationBalloons,
    update,
    draw,
    checkHit,
    allGone,
    isOffScreen,
    reset,
    get all() { return [...balloons, ...activeBombs]; }
  };
})();
