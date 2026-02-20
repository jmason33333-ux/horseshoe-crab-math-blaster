/* =============================================
   EQUATIONS.JS — Math Question Generator
   ============================================= */

const EquationEngine = (() => {

  // Returns a random integer between min and max (inclusive)
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate wrong answers that are plausible but not correct
  function generateDistractors(correct, count, min, max) {
    const distractors = new Set();
    let attempts = 0;
    while (distractors.size < count && attempts < 200) {
      attempts++;
      // Vary by small offsets to make plausible wrong answers
      const offset = randInt(1, Math.max(3, Math.floor(Math.abs(correct) * 0.3) + 2));
      const sign = Math.random() < 0.5 ? 1 : -1;
      const candidate = correct + sign * offset;
      if (candidate !== correct && candidate >= min && candidate <= max) {
        distractors.add(candidate);
      }
    }
    // Fill remaining with random in range if needed
    while (distractors.size < count) {
      const candidate = randInt(min, max);
      if (candidate !== correct) distractors.add(candidate);
    }
    return Array.from(distractors).slice(0, count);
  }

  /* ---------- LEVEL EQUATION GENERATORS ---------- */

  // Levels 1-2: Single/double digit addition
  function additionSimple() {
    const a = randInt(1, 20);
    const b = randInt(1, 20);
    const answer = a + b;
    return { question: `${a} + ${b} = ?`, answer, type: 'addition', min: 0, max: 45 };
  }

  // Levels 3-4: Subtraction (result always >= 0)
  function subtraction() {
    const a = randInt(5, 30);
    const b = randInt(1, a);
    const answer = a - b;
    return { question: `${a} − ${b} = ?`, answer, type: 'subtraction', min: 0, max: 30 };
  }

  // Levels 5-6: Multiplication (times tables 1-10)
  function multiplication() {
    const a = randInt(1, 10);
    const b = randInt(1, 10);
    const answer = a * b;
    return { question: `${a} × ${b} = ?`, answer, type: 'multiplication', min: 0, max: 100 };
  }

  // Levels 7-8: Larger number addition and subtraction
  function addSubLarge() {
    const useAdd = Math.random() < 0.5;
    if (useAdd) {
      const a = randInt(15, 75);
      const b = randInt(10, 50);
      const answer = a + b;
      return { question: `${a} + ${b} = ?`, answer, type: 'addition', min: 20, max: 130 };
    } else {
      const a = randInt(30, 99);
      const b = randInt(10, a);
      const answer = a - b;
      return { question: `${a} − ${b} = ?`, answer, type: 'subtraction', min: 0, max: 90 };
    }
  }

  // Levels 9-10: Mixed (addition, subtraction, multiplication)
  function mixed() {
    const roll = Math.random();
    if (roll < 0.33) return additionSimple();
    if (roll < 0.66) return subtraction();
    return multiplication();
  }

  /* ---------- LEVEL CONFIG ---------- */

  const levelConfig = [
    null, // index 0 unused (levels are 1-based)
    { gen: additionSimple,  label: 'Addition',                  balloons: 3 }, // 1
    { gen: additionSimple,  label: 'Addition',                  balloons: 3 }, // 2
    { gen: subtraction,     label: 'Subtraction',               balloons: 3 }, // 3
    { gen: subtraction,     label: 'Subtraction',               balloons: 3 }, // 4
    { gen: multiplication,  label: 'Multiplication',            balloons: 4 }, // 5
    { gen: multiplication,  label: 'Multiplication',            balloons: 4 }, // 6
    { gen: addSubLarge,     label: 'Addition & Subtraction',    balloons: 4 }, // 7
    { gen: addSubLarge,     label: 'Addition & Subtraction',    balloons: 5 }, // 8
    { gen: mixed,           label: 'Mixed Math',                balloons: 5 }, // 9
    { gen: mixed,           label: 'Mixed Math',                balloons: 5 }, // 10
  ];

  /* ---------- DUPLICATE PREVENTION ---------- */

  // Tracks questions already seen this round (keyed by question string)
  let usedQuestionsThisRound = new Set();
  const MAX_RETRIES = 20; // attempts to find a fresh question before giving up

  // Call this at the start of each level to clear the used-question history
  function resetRound() {
    usedQuestionsThisRound = new Set();
  }

  /* ---------- PUBLIC API ---------- */

  // Generate one full equation with answer + wrong choices.
  // Avoids repeating the same question string within a round.
  function generate(level) {
    const cfg = levelConfig[level];

    let eq;
    let attempts = 0;
    do {
      eq = cfg.gen();
      attempts++;
      // Accept if we haven't seen this question yet, or if we've exhausted retries
    } while (usedQuestionsThisRound.has(eq.question) && attempts < MAX_RETRIES);

    // Mark this question as used for the rest of the round
    usedQuestionsThisRound.add(eq.question);

    const numWrong = cfg.balloons - 1; // one slot is correct
    const distractors = generateDistractors(eq.answer, numWrong, eq.min, eq.max);
    const choices = [eq.answer, ...distractors];
    // Shuffle choices
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return {
      question: eq.question,
      answer: eq.answer,
      choices,
      type: eq.type,
    };
  }

  function getBalloonCount(level) {
    return levelConfig[level].balloons;
  }

  function getLevelLabel(level) {
    return levelConfig[level].label;
  }

  return { generate, getBalloonCount, getLevelLabel, resetRound };
})();
