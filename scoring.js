/* =============================================
   SCORING.JS — Score Tracking, Report Card, High Scores
   ============================================= */

const ScoringEngine = (() => {

  const POINTS_PER_LEVEL = [0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10]; // index = level
  const BOMB_PENALTY = 5;
  const OBSTACLE_PENALTY = 1;
  const HIGH_SCORES_KEY = 'mathblast_highscores';
  const MAX_HIGH_SCORES = 8;

  let state = {};

  function init() {
    state = {
      playerName: 'Player',
      totalScore: 0,
      levelScores: new Array(11).fill(0),       // index = level
      levelCorrect: new Array(11).fill(0),
      levelAttempted: new Array(11).fill(0),
      // Track by math type
      typeCorrect: { addition: 0, subtraction: 0, multiplication: 0 },
      typeAttempted: { addition: 0, subtraction: 0, multiplication: 0 },
      currentLevel: 1,
    };
  }

  function setPlayer(name) {
    state.playerName = name || 'Player';
  }

  /* ---------- SCORE EVENTS ---------- */

  function onCorrect(level, equationType) {
    const pts = POINTS_PER_LEVEL[level];
    state.totalScore += pts;
    state.levelScores[level] += pts;
    state.levelCorrect[level]++;
    state.levelAttempted[level]++;
    const type = equationType || 'addition';
    state.typeCorrect[type] = (state.typeCorrect[type] || 0) + 1;
    state.typeAttempted[type] = (state.typeAttempted[type] || 0) + 1;
    return pts;
  }

  function onMiss(level, equationType) {
    state.levelAttempted[level]++;
    const type = equationType || 'addition';
    state.typeAttempted[type] = (state.typeAttempted[type] || 0) + 1;
  }

  function onBombHit() {
    state.totalScore = Math.max(0, state.totalScore - BOMB_PENALTY);
    state.levelScores[state.currentLevel] = Math.max(0, state.levelScores[state.currentLevel] - BOMB_PENALTY);
    return -BOMB_PENALTY;
  }

  function onObstacleHit() {
    state.totalScore = Math.max(0, state.totalScore - OBSTACLE_PENALTY);
    state.levelScores[state.currentLevel] = Math.max(0, state.levelScores[state.currentLevel] - OBSTACLE_PENALTY);
    return -OBSTACLE_PENALTY;
  }

  function setLevel(level) {
    state.currentLevel = level;
  }

  function getScore() { return state.totalScore; }
  function getLevelScore(level) { return state.levelScores[level]; }

  /* ---------- LEVEL COMPLETE SUMMARY ---------- */

  function getLevelSummary(level) {
    const correct = state.levelCorrect[level];
    const attempted = state.levelAttempted[level];
    const score = state.levelScores[level];
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    return { correct, attempted, score, accuracy };
  }

  /* ---------- REPORT CARD ---------- */

  function generateReportCard() {
    const total = state.totalScore;
    const levelBreakdown = [];
    for (let l = 1; l <= 10; l++) {
      levelBreakdown.push({
        level: l,
        score: state.levelScores[l],
        correct: state.levelCorrect[l],
        attempted: state.levelAttempted[l],
        accuracy: state.levelAttempted[l] > 0
          ? Math.round((state.levelCorrect[l] / state.levelAttempted[l]) * 100) : 0,
      });
    }

    // Determine strengths and improvement areas
    const typeLabels = {
      addition: 'Addition ➕',
      subtraction: 'Subtraction ➖',
      multiplication: 'Multiplication ✖️',
    };

    const strengths = [];
    const improvements = [];

    Object.keys(state.typeAttempted).forEach(type => {
      const attempted = state.typeAttempted[type];
      if (attempted === 0) return;
      const acc = state.typeCorrect[type] / attempted;
      if (acc >= 0.75) {
        strengths.push(typeLabels[type]);
      } else if (acc < 0.6) {
        improvements.push(typeLabels[type]);
      }
    });

    // Encouraging messages
    const encouragements = [
      "You're a math superstar! 🌟",
      "Amazing work, keep it up! 🦀",
      "The horseshoe crab is so proud! 🎉",
      "You're getting smarter every round! 🧠",
      "Incredible math skills! ⭐",
    ];
    const encouragement = encouragements[Math.floor(Math.random() * encouragements.length)];

    return { total, levelBreakdown, strengths, improvements, encouragement, playerName: state.playerName };
  }

  /* ---------- HIGH SCORES ---------- */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(HIGH_SCORES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHighScore() {
    const scores = loadHighScores();
    scores.push({ name: state.playerName, score: state.totalScore, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, MAX_HIGH_SCORES);
    try {
      localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(trimmed));
    } catch (e) {}
    return trimmed;
  }

  function getHighScores() {
    return loadHighScores();
  }

  /* ---------- REPORT CARD HTML ---------- */

  function renderReportCardHTML(report) {
    const { total, levelBreakdown, strengths, improvements, encouragement, playerName } = report;

    let html = `
      <p style="color:#b0e0ff;margin-bottom:6px;">Well done, <strong style="color:#fff">${playerName}</strong>! ${encouragement}</p>
      <div class="total-score-banner">🏆 Total Score: ${total} points</div>
      <div class="report-section">
        <h3>Score by Level</h3>
    `;

    levelBreakdown.forEach(row => {
      const mathLabel = getLevelMathLabel(row.level);
      html += `
        <div class="report-level-row">
          <span class="rl-label">Level ${row.level} <em style="font-size:0.85em;color:#7ec8e3">(${mathLabel})</em></span>
          <span class="rl-score">${row.score}pts &nbsp;|&nbsp; ${row.correct}/${row.attempted} correct &nbsp;|&nbsp; ${row.accuracy}%</span>
        </div>
      `;
    });

    html += `</div>`;

    if (strengths.length > 0) {
      html += `
        <div class="report-section">
          <h3>🌟 You Really Excelled At</h3>
          <div>${strengths.map(s => `<span class="strength-tag">${s}</span>`).join('')}</div>
        </div>
      `;
    }

    if (improvements.length > 0) {
      html += `
        <div class="report-section">
          <h3>📚 Keep Practicing</h3>
          <div>${improvements.map(s => `<span class="improve-tag">${s}</span>`).join('')}</div>
        </div>
      `;
    }

    return html;
  }

  function getLevelMathLabel(level) {
    const labels = ['','Addition','Addition','Subtraction','Subtraction',
      'Multiplication','Multiplication','Add & Subtract','Add & Subtract','Mixed','Mixed'];
    return labels[level] || '';
  }

  function renderHighScoresHTML() {
    const scores = loadHighScores();
    if (scores.length === 0) {
      return '<p style="color:#7ec8e3;text-align:center;">No scores yet — be the first! 🦀</p>';
    }
    const medals = ['🥇','🥈','🥉'];
    return scores.map((s, i) => `
      <div class="high-score-entry">
        <span class="rank">${medals[i] || (i + 1) + '.'}</span>
        <span class="hs-name">${s.name}</span>
        <span class="hs-score">${s.score} pts</span>
        <span style="color:#7ec8e3;font-size:0.8em;margin-left:8px">${s.date}</span>
      </div>
    `).join('');
  }

  return {
    init, setPlayer, setLevel,
    onCorrect, onMiss, onBombHit, onObstacleHit,
    getScore, getLevelScore, getLevelSummary,
    generateReportCard, saveHighScore, getHighScores,
    renderReportCardHTML, renderHighScoresHTML,
  };
})();
