/* =============================================
   GAME.JS — Main Game Loop & Controller
   ============================================= */

'use strict';

/* ---- CANVAS SETUP ---- */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 60; // 60px for HUD
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

/* ---- GAME STATE ---- */
const GameState = {
  MENU: 'menu',
  NAME: 'name',
  LEVEL_INTRO: 'level_intro',
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'level_complete',
  REPORT: 'report',
  HIGH_SCORES: 'high_scores',
};

let currentState = GameState.MENU;
let currentLevel = 1;
const TOTAL_LEVELS = 10;
const ROUND_DURATION = 120; // seconds

/* ---- CRAB ---- */
const crab = {
  x: 0,
  y: 0,
  width: 70,
  height: 50,
  speed: 320,       // pixels/sec
};

/* ---- SPINES ---- */
const spines = [];
const SPINE_SPEED = 520;
const SPINE_COOLDOWN = 0.28; // seconds between shots
let spineCooldown = 0;

/* ---- GAME LOOP VARS ---- */
let lastTime = 0;
let gameTimer = ROUND_DURATION;
let animFrameId = null;

/* ---- CURRENT EQUATION ---- */
let currentEquation = null;
let equationPending = false; // waiting to spawn next equation balloons
let equationDelay = 0;       // brief pause between equations
const EQUATION_DELAY = 1.0;  // seconds between equations

/* ---- SCORE FLASH ---- */
let scoreFlash = null; // { text, x, y, timer, color }

/* ---- BACKGROUND WAVES ---- */
const waves = Array.from({ length: 6 }, (_, i) => ({
  y: 0.2 + i * 0.13,
  offset: Math.random() * Math.PI * 2,
  speed: 0.3 + i * 0.08,
  amp: 12 + i * 4,
  color: `rgba(0, ${90 + i * 15}, ${160 + i * 10}, ${0.18 - i * 0.02})`,
}));
let waveTime = 0;

/* ---- PARTICLES ---- */
let particles = [];

/* =============================================
   SCREENS
   ============================================= */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* =============================================
   MAIN MENU
   ============================================= */
document.getElementById('startBtn').addEventListener('click', () => {
  showScreen('nameScreen');
  currentState = GameState.NAME;
  document.getElementById('playerName').focus();
});

document.getElementById('highScoreBtn').addEventListener('click', () => {
  document.getElementById('highScoreList').innerHTML = ScoringEngine.renderHighScoresHTML();
  showScreen('highScoreScreen');
  currentState = GameState.HIGH_SCORES;
});

document.getElementById('backFromHighScore').addEventListener('click', () => {
  showScreen('mainMenu');
  currentState = GameState.MENU;
});

/* =============================================
   NAME SCREEN
   ============================================= */
document.getElementById('nameConfirmBtn').addEventListener('click', startGameFromName);
document.getElementById('playerName').addEventListener('keydown', e => {
  if (e.key === 'Enter') startGameFromName();
});

function startGameFromName() {
  const name = document.getElementById('playerName').value.trim() || 'Player';
  ScoringEngine.init();
  ScoringEngine.setPlayer(name);
  document.getElementById('hudName').textContent = name;
  currentLevel = 1;
  showLevelIntro(currentLevel);
}

/* =============================================
   LEVEL INTRO
   ============================================= */
function showLevelIntro(level) {
  currentState = GameState.LEVEL_INTRO;
  const mathLabel = EquationEngine.getLevelLabel(level);
  const balloons = EquationEngine.getBalloonCount(level);
  const pointsPerQ = [0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10][level];

  const content = `
    <h2>Level ${level} of ${TOTAL_LEVELS}</h2>
    <p class="level-detail">Math focus:</p>
    <div class="math-type">${mathLabel}</div>
    <p class="level-detail">🎈 ${balloons} balloons per question</p>
    <p class="level-detail">⭐ ${pointsPerQ} points per correct answer</p>
    <p class="level-detail">⏱ You have ${ROUND_DURATION} seconds — get as many as you can!</p>
    <p class="level-detail" style="margin-top:12px;color:#ffe066">Move: ← → Arrow keys&nbsp;&nbsp;|&nbsp;&nbsp;Shoot: Spacebar</p>
  `;
  document.getElementById('levelIntroContent').innerHTML = content;
  showScreen('levelIntro');
}

document.getElementById('levelStartBtn').addEventListener('click', () => {
  startLevel(currentLevel);
});

/* =============================================
   START LEVEL
   ============================================= */
function startLevel(level) {
  currentState = GameState.PLAYING;
  ScoringEngine.setLevel(level);
  EquationEngine.resetRound(); // clear duplicate-prevention history for this level
  gameTimer = ROUND_DURATION;
  spineCooldown = 0;
  spines.length = 0;
  particles.length = 0;
  BalloonManager.reset();
  ObstacleManager.reset();
  currentEquation = null;
  equationPending = true;
  equationDelay = 0.5; // short intro pause

  // Reset crab position
  crab.x = canvas.width / 2;
  crab.y = canvas.height - crab.height / 2 - 18;
  crab.targetX = crab.x;

  document.getElementById('levelDisplay').textContent = level;
  document.getElementById('scoreDisplay').textContent = ScoringEngine.getScore();
  document.getElementById('timerDisplay').textContent = Math.ceil(gameTimer);
  document.getElementById('equationDisplay').textContent = 'Ready!';

  showScreen('gameScreen');

  lastTime = performance.now();
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(gameLoop);
}

/* =============================================
   MAIN GAME LOOP
   ============================================= */
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;

  if (currentState !== GameState.PLAYING) return;

  update(dt);
  render();

  animFrameId = requestAnimationFrame(gameLoop);
}

/* =============================================
   UPDATE
   ============================================= */
function update(dt) {
  waveTime += dt;

  // Timer
  gameTimer -= dt;
  document.getElementById('timerDisplay').textContent = Math.ceil(Math.max(0, gameTimer));

  if (gameTimer <= 0) {
    endLevel();
    return;
  }

  // Spine cooldown
  if (spineCooldown > 0) spineCooldown -= dt;

  // Crab movement
  updateCrab(dt);

  // Score flash
  if (scoreFlash) {
    scoreFlash.timer -= dt;
    scoreFlash.y -= 40 * dt;
    if (scoreFlash.timer <= 0) scoreFlash = null;
  }

  // Particles
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 80 * dt; // gravity
  });
  particles = particles.filter(p => p.life > 0);

  // Equation / balloon management
  updateEquationFlow(dt);

  // Spines
  for (let i = spines.length - 1; i >= 0; i--) {
    const s = spines[i];
    s.y -= SPINE_SPEED * dt;
    // Check balloon hit
    if (currentEquation) {
      const hit = BalloonManager.checkHit(s.x, s.y);
      if (hit) {
        spines.splice(i, 1);
        handleBalloonHit(hit);
        continue;
      }
    }
    if (s.y < -20) spines.splice(i, 1);
  }

  // Obstacles
  ObstacleManager.update(dt, currentLevel, canvas.width, canvas.height);

  // Crab-obstacle collision
  if (ObstacleManager.checkCrabHit(crab.x, crab.y, crab.width * 0.38)) {
    const delta = ScoringEngine.onObstacleHit();
    showScoreFlash(delta, crab.x, crab.y - 30, '#ff6b6b');
    updateScoreDisplay();
    spawnHitParticles(crab.x, crab.y, '#ff6b6b');
    playSound('obstacleHit');
  }

  // Balloons
  BalloonManager.update(dt);
}

function updateCrab(dt) {
  // Keyboard movement
  if (keys['ArrowLeft'])  crab.x -= crab.speed * dt;
  if (keys['ArrowRight']) crab.x += crab.speed * dt;

  // Clamp to canvas
  const half = crab.width / 2;
  crab.x = Math.max(half, Math.min(canvas.width - half, crab.x));

  // Keep crab at bottom
  crab.y = canvas.height - crab.height / 2 - 18;
}

/* =============================================
   EQUATION FLOW
   ============================================= */
function updateEquationFlow(dt) {
  if (equationPending) {
    equationDelay -= dt;
    if (equationDelay <= 0) {
      spawnNextEquation();
      equationPending = false;
    }
    return;
  }

  if (!currentEquation) return;

  // Check if all balloons are gone (off screen or popped)
  if (BalloonManager.allGone(canvas.width)) {
    currentEquation = null;
    equationPending = true;
    equationDelay = EQUATION_DELAY;
    document.getElementById('equationDisplay').textContent = '…';
  }
}

function spawnNextEquation() {
  currentEquation = EquationEngine.generate(currentLevel);
  BalloonManager.spawnEquationBalloons(currentEquation, currentLevel, canvas.width, canvas.height);
  document.getElementById('equationDisplay').textContent = currentEquation.question;
}

/* =============================================
   BALLOON HIT HANDLING
   ============================================= */
function handleBalloonHit(balloon) {
  if (balloon.isBomb) {
    // Bomb hit
    const delta = ScoringEngine.onBombHit();
    showScoreFlash('💣 -5', balloon.x, balloon.y - 20, '#ff4400');
    updateScoreDisplay();
    spawnHitParticles(balloon.x, balloon.y, '#ff4400', 14);
    playSound('bomb');
    // Move on to next equation
    currentEquation = null;
    equationPending = true;
    equationDelay = EQUATION_DELAY;
    document.getElementById('equationDisplay').textContent = '🐡 Ouch!';

  } else if (balloon.isCorrect) {
    // Correct answer
    const pts = ScoringEngine.onCorrect(currentLevel, currentEquation ? currentEquation.type : 'addition');
    showScoreFlash(`+${pts}`, balloon.x, balloon.y - 20, '#ffe066');
    updateScoreDisplay();
    spawnHitParticles(balloon.x, balloon.y, balloon.color, 12);
    playSound('correct');
    // Move on to next equation
    currentEquation = null;
    equationPending = true;
    equationDelay = EQUATION_DELAY;
    document.getElementById('equationDisplay').textContent = '🐠 Correct!';

  } else {
    // Wrong answer — just register miss and move on
    ScoringEngine.onMiss(currentLevel, currentEquation ? currentEquation.type : 'addition');
    showScoreFlash('Wrong!', balloon.x, balloon.y - 20, '#aaa');
    spawnHitParticles(balloon.x, balloon.y, '#aaa', 6);
    playSound('wrong');
    currentEquation = null;
    equationPending = true;
    equationDelay = EQUATION_DELAY;
    document.getElementById('equationDisplay').textContent = '🐟 Try again!';
  }
}

function updateScoreDisplay() {
  document.getElementById('scoreDisplay').textContent = ScoringEngine.getScore();
}

/* =============================================
   END LEVEL
   ============================================= */
function endLevel() {
  cancelAnimationFrame(animFrameId);
  currentState = GameState.LEVEL_COMPLETE;

  const summary = ScoringEngine.getLevelSummary(currentLevel);
  const isLastLevel = currentLevel === TOTAL_LEVELS;

  let feedbackMsg = '';
  if (summary.accuracy >= 80) feedbackMsg = '🌟 Excellent work!';
  else if (summary.accuracy >= 60) feedbackMsg = '👍 Good job!';
  else feedbackMsg = '💪 Keep practicing!';

  const html = `
    <h2>${isLastLevel ? '🎉 Final Level Complete!' : `✅ Level ${currentLevel} Complete!`}</h2>
    <p style="color:#ffe066;margin-bottom:14px">${feedbackMsg}</p>
    <div class="level-stat"><span class="stat-label">Score this level</span><span class="stat-value">${summary.score} pts</span></div>
    <div class="level-stat"><span class="stat-label">Correct answers</span><span class="stat-value">${summary.correct} / ${summary.attempted}</span></div>
    <div class="level-stat"><span class="stat-label">Accuracy</span><span class="stat-value">${summary.accuracy}%</span></div>
    <div class="level-stat"><span class="stat-label">Total score so far</span><span class="stat-value">${ScoringEngine.getScore()} pts</span></div>
  `;
  document.getElementById('levelCompleteContent').innerHTML = html;

  const nextBtn = document.getElementById('nextLevelBtn');
  if (isLastLevel) {
    nextBtn.textContent = '📊 See Report Card';
  } else {
    nextBtn.textContent = `Level ${currentLevel + 1} →`;
  }

  playSound('levelComplete');
  showScreen('levelComplete');
}

document.getElementById('nextLevelBtn').addEventListener('click', () => {
  if (currentLevel >= TOTAL_LEVELS) {
    showReportCard();
  } else {
    currentLevel++;
    showLevelIntro(currentLevel);
  }
});

/* =============================================
   REPORT CARD
   ============================================= */
function showReportCard() {
  currentState = GameState.REPORT;
  const report = ScoringEngine.generateReportCard();
  ScoringEngine.saveHighScore();
  document.getElementById('reportContent').innerHTML = ScoringEngine.renderReportCardHTML(report);
  showScreen('reportCard');
}

document.getElementById('playAgainBtn').addEventListener('click', () => {
  showScreen('nameScreen');
  currentState = GameState.NAME;
  document.getElementById('playerName').value = '';
  document.getElementById('playerName').focus();
});

document.getElementById('menuBtn').addEventListener('click', () => {
  showScreen('mainMenu');
  currentState = GameState.MENU;
});

/* =============================================
   RENDER
   ============================================= */
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawObstacles();
  drawBalloons();
  drawSpines();
  drawCrab();
  drawParticles();
  drawScoreFlash();
}

function drawBackground() {
  // Ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#001a33');
  grad.addColorStop(0.5, '#002244');
  grad.addColorStop(1, '#003366');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Animated waves
  waves.forEach(w => {
    const y = w.y * canvas.height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= canvas.width; x += 8) {
      ctx.lineTo(x, y + Math.sin((x / canvas.width) * Math.PI * 4 + waveTime * w.speed + w.offset) * w.amp);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fillStyle = w.color;
    ctx.fill();
  });

  // Sandy bottom strip
  const sandGrad = ctx.createLinearGradient(0, canvas.height - 40, 0, canvas.height);
  sandGrad.addColorStop(0, 'rgba(194, 154, 108, 0.6)');
  sandGrad.addColorStop(1, 'rgba(210, 180, 140, 0.8)');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

  // Sand ripple details
  ctx.strokeStyle = 'rgba(180, 140, 100, 0.4)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const sy = canvas.height - 30 + i * 5;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    for (let x = 0; x <= canvas.width; x += 30) {
      ctx.lineTo(x + 15, sy + 3);
      ctx.lineTo(x + 30, sy);
    }
    ctx.stroke();
  }

  // Bubbles
  drawBubbles();
}

// Static bubbles for ambiance
const bubbleList = Array.from({ length: 18 }, () => ({
  x: Math.random(),
  y: Math.random() * 0.8 + 0.05,
  r: 2 + Math.random() * 4,
  speed: 0.01 + Math.random() * 0.02,
  phase: Math.random() * Math.PI * 2,
}));

function drawBubbles() {
  bubbleList.forEach(b => {
    b.y -= b.speed * 0.016; // moves up slowly
    if (b.y < 0) b.y = 1;
    const bx = b.x * canvas.width + Math.sin(waveTime * 0.5 + b.phase) * 8;
    const by = b.y * canvas.height;
    ctx.beginPath();
    ctx.arc(bx, by, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

function drawCrab() {
  const x = crab.x;
  const y = crab.y;
  ctx.save();
  ctx.translate(x, y);
  drawHorseshoeCrab(ctx);
  ctx.restore();
}

function drawHorseshoeCrab(ctx) {
  // Squishmallow-style: round, soft, cute

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;

  // Prosoma (main dome shell) - rounder for squishmallow look
  const shellGrad = ctx.createRadialGradient(-8, -14, 4, 0, -8, 38);
  shellGrad.addColorStop(0, '#e8c89a');
  shellGrad.addColorStop(0.5, '#c8975a');
  shellGrad.addColorStop(1, '#8b6535');
  ctx.fillStyle = shellGrad;
  ctx.beginPath();
  ctx.arc(0, -12, 34, 0, Math.PI * 2);
  ctx.fill();

  // Dome shine (squishmallow highlight)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-10, -24, 14, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Telson (tail spike) going downward since crab faces screen
  ctx.fillStyle = '#8b6535';
  ctx.beginPath();
  ctx.moveTo(-4, 20);
  ctx.lineTo(4, 20);
  ctx.lineTo(2, 44);
  ctx.lineTo(0, 48);
  ctx.lineTo(-2, 44);
  ctx.closePath();
  ctx.fill();

  // Abdomen (smaller dome behind prosoma)
  const abdGrad = ctx.createRadialGradient(-4, 12, 2, 0, 14, 22);
  abdGrad.addColorStop(0, '#d4a870');
  abdGrad.addColorStop(1, '#9a7040');
  ctx.fillStyle = abdGrad;
  ctx.beginPath();
  ctx.ellipse(0, 14, 22, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (3 pairs each side, small cute rounded legs)
  ctx.fillStyle = '#8b6535';
  const legPositions = [-26, -18, -10];
  const legAngles   = [ 2.4,  2.0,  1.7]; // radians from horizontal

  [-1, 1].forEach(side => {
    legPositions.forEach((lx, i) => {
      const angle = side === -1 ? Math.PI - legAngles[i] : legAngles[i];
      const startX = side * 28;
      const startY = -5 + i * 9;
      const endX = startX + Math.cos(angle) * 22;
      const endY = startY + Math.sin(angle) * 10;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(startX + side * 14, startY + 4, endX, endY);
      ctx.strokeStyle = '#7a5528';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      // Claw tip
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#5a3a10';
      ctx.fill();
    });
  });

  // Cute eyes on the shell
  const eyeY = -20;
  [-10, 10].forEach(ex => {
    // Eye white
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, eyeY, 7, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    ctx.fillStyle = '#3d2200';
    ctx.beginPath();
    ctx.arc(ex + 1, eyeY + 1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex + 2.5, eyeY - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Rosy cheek
    ctx.fillStyle = 'rgba(255, 150, 130, 0.45)';
    ctx.beginPath();
    ctx.ellipse(ex + (ex > 0 ? 4 : -4), eyeY + 6, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Smile
  ctx.strokeStyle = '#5a3a10';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -10, 8, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawSpines() {
  spines.forEach(s => {
    ctx.save();
    ctx.beginPath();
    // Spine: sharp elongated spike
    ctx.moveTo(s.x, s.y + 12);
    ctx.lineTo(s.x - 3, s.y + 6);
    ctx.lineTo(s.x, s.y - 12);
    ctx.lineTo(s.x + 3, s.y + 6);
    ctx.closePath();
    const spineGrad = ctx.createLinearGradient(s.x, s.y - 12, s.x, s.y + 12);
    spineGrad.addColorStop(0, '#ffe8a0');
    spineGrad.addColorStop(1, '#c87820');
    ctx.fillStyle = spineGrad;
    ctx.fill();
    ctx.strokeStyle = '#8b5c10';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Glow
    ctx.shadowColor = '#ffcc44';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  });
}

function drawBalloons() {
  BalloonManager.draw(ctx);
}

function drawObstacles() {
  ObstacleManager.draw(ctx);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawScoreFlash() {
  if (!scoreFlash) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, scoreFlash.timer / 0.6);
  ctx.fillStyle = scoreFlash.color;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 5;
  ctx.fillText(scoreFlash.text, scoreFlash.x, scoreFlash.y);
  ctx.restore();
}

/* =============================================
   HELPERS
   ============================================= */
function showScoreFlash(text, x, y, color) {
  scoreFlash = { text: String(text), x, y, timer: 1.0, color };
}

function spawnHitParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      r: 3 + Math.random() * 5,
      color,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9,
    });
  }
}

/* =============================================
   CONTROLS
   ============================================= */
const keys = {};

window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' && currentState === GameState.PLAYING) {
    e.preventDefault();
    fireSpine();
  }
});

window.addEventListener('keyup', e => {
  keys[e.key] = false;
});

// Mouse/trackpad movement and click-to-fire intentionally removed.
// Desktop controls: Arrow keys to move, Spacebar to shoot.

function fireSpine() {
  if (spineCooldown > 0) return;
  spines.push({ x: crab.x, y: crab.y - crab.height / 2 });
  spineCooldown = SPINE_COOLDOWN;
  playSound('shoot');
}

/* =============================================
   SOUND (Web Audio API — chiptune style)
   ============================================= */
let audioCtx = null;
let bgMusicNodes = null;
let musicPlaying = false;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioCtx();

    if (type === 'shoot') {
      beep(ctx, 880, 0.08, 'square', 0.12);
    } else if (type === 'correct') {
      beep(ctx, 523, 0.06, 'sine', 0.0);
      beep(ctx, 659, 0.06, 'sine', 0.08);
      beep(ctx, 784, 0.14, 'sine', 0.16);
    } else if (type === 'wrong') {
      beep(ctx, 200, 0.18, 'sawtooth', 0.0);
    } else if (type === 'bomb') {
      beep(ctx, 100, 0.3, 'sawtooth', 0.0, 0.4);
      beep(ctx, 80,  0.3, 'square',   0.05, 0.3);
    } else if (type === 'obstacleHit') {
      beep(ctx, 300, 0.15, 'square', 0.0, 0.2);
    } else if (type === 'levelComplete') {
      [523, 587, 659, 698, 784].forEach((f, i) => {
        beep(ctx, f, 0.12, 'sine', i * 0.1);
      });
    }
  } catch(e) {}
}

function beep(ctx, freq, duration, type = 'sine', delay = 0, freqEnd = null) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + delay + duration);
  gain.gain.setValueAtTime(0.18, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.01);
}

/* --- Background Music (looping chiptune arpeggio) --- */
function startBackgroundMusic() {
  if (musicPlaying) return;
  try {
    const ctx = getAudioCtx();
    musicPlaying = true;

    // Ocean-themed chiptune: cycle through a simple melody
    const notes = [261, 329, 392, 329, 261, 329, 392, 440,
                   349, 440, 523, 440, 349, 294, 329, 261];
    let noteIndex = 0;
    const tempo = 0.22; // seconds per note

    function scheduleNote() {
      if (!musicPlaying) return;
      const freq = notes[noteIndex % notes.length];
      noteIndex++;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tempo * 0.9);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + tempo);
      setTimeout(scheduleNote, tempo * 1000);
    }
    scheduleNote();
  } catch(e) {}
}

function stopBackgroundMusic() {
  musicPlaying = false;
}

// Start music on first user interaction (browser autoplay policy)
let musicStarted = false;
function tryStartMusic() {
  if (!musicStarted) {
    musicStarted = true;
    startBackgroundMusic();
  }
}
document.addEventListener('keydown', tryStartMusic, { once: false });
document.addEventListener('click', tryStartMusic, { once: false });

/* =============================================
   INIT
   ============================================= */
showScreen('mainMenu');
currentState = GameState.MENU;
