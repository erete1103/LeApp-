(() => {
  const SECTION_SIZE = 100;

  let currentPool = [];
  let currentQuestion = null;
  let currentType = 'ja4'; // 'ja4' | 'en4' | 'spell'
  let answeredCurrent = false;
  let lastResult = null; // { wordId, direction, appliedDelta, isCorrect }

  function getPoolWords(words, sectionValue) {
    if (!Array.isArray(words) || words.length === 0) return [];
    if (sectionValue === 'all') return words;

    const targetSec = Number(sectionValue) || 1;
    const matchedByProp = words.filter((w) => Number(w.section) === targetSec);
    if (matchedByProp.length > 0) {
      return matchedByProp;
    }

    const startIdx = (targetSec - 1) * SECTION_SIZE;
    return words.slice(startIdx, startIdx + SECTION_SIZE);
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function getQuestionDirection(type) {
    return type === 'ja4' ? 'enToJa' : 'jaToEn';
  }

  function buildChoices(targetWord, allWords, type) {
    const isMeaningChoice = type === 'ja4';
    const getAnswerText = (w) => (isMeaningChoice ? String(w.meaning ?? '') : String(w.word ?? ''));

    const customList = isMeaningChoice
      ? Array.isArray(targetWord.similarMeanings) ? targetWord.similarMeanings : []
      : Array.isArray(targetWord.similarWords) ? targetWord.similarWords : [];

    const correctText = getAnswerText(targetWord);
    const distractors = [];

    for (const candidate of shuffleArray(customList)) {
      const text = String(candidate ?? '').trim();
      if (text && text !== correctText && !distractors.includes(text)) {
        distractors.push(text);
      }
      if (distractors.length === 3) break;
    }

    if (distractors.length < 3) {
      const pool = shuffleArray(allWords.length >= 4 ? allWords : window.LeApp?.getWords() || []);
      for (const w of pool) {
        const text = getAnswerText(w).trim();
        if (text && text !== correctText && !distractors.includes(text)) {
          distractors.push(text);
        }
        if (distractors.length === 3) break;
      }
    }

    return shuffleArray([correctText, ...distractors]);
  }

  function setControlsDisabled(disabled) {
    const choiceButtons = document.querySelectorAll('#choices-area .choice-btn');
    choiceButtons.forEach((btn) => {
      btn.disabled = disabled;
    });

    const spellInput = document.getElementById('spell-input');
    const spellSubmit = document.getElementById('spell-submit-btn');
    if (spellInput) spellInput.disabled = disabled;
    if (spellSubmit) spellSubmit.disabled = disabled;
  }

  function showFeedback(isCorrect, correctAnswerText, extraNote = '') {
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackText = document.getElementById('feedback-text');
    const flukeBtn = document.getElementById('fluke-penalty-btn');

    if (!feedbackArea || !feedbackText || !flukeBtn) return;

    answeredCurrent = true;
    setControlsDisabled(true);
    feedbackArea.classList.remove('hidden');

    if (isCorrect) {
      feedbackText.textContent = `正解！（+1スコア）${extraNote}`;
      feedbackText.style.color = 'var(--success)';
      flukeBtn.classList.remove('hidden');
      flukeBtn.disabled = false;
      flukeBtn.textContent = 'まぐれだったのでマイナスにする';
    } else {
      feedbackText.textContent = `不正解（-1スコア） 正解: ${correctAnswerText}${extraNote}`;
      feedbackText.style.color = 'var(--danger)';
      flukeBtn.classList.add('hidden');
    }
  }

  function recordAnswer(isCorrect, correctAnswerText) {
    if (answeredCurrent || !currentQuestion) return;

    const app = window.LeApp;
    const delta = isCorrect ? 1 : -1;
    const direction = getQuestionDirection(currentType);

    lastResult = {
      wordId: currentQuestion.wordId,
      direction,
      appliedDelta: delta,
      isCorrect,
    };

    if (app) {
      app.updateWordScore(currentQuestion.wordId, direction, delta);
      app.incrementPlayCount(1);
    }

    showFeedback(isCorrect, correctAnswerText);
  }

  function renderQuestion() {
    const promptLabel = document.getElementById('check-prompt-label');
    const questionEl = document.getElementById('check-question');
    const choicesArea = document.getElementById('choices-area');
    const spellArea = document.getElementById('spell-area');
    const spellInput = document.getElementById('spell-input');
    const feedbackArea = document.getElementById('feedback-area');

    if (!promptLabel || !questionEl || !choicesArea || !spellArea || !feedbackArea) return;

    answeredCurrent = false;
    lastResult = null;
    feedbackArea.classList.add('hidden');
    choicesArea.innerHTML = '';

    const app = window.LeApp;
    const allWords = app ? app.getWords() : [];

    if (!currentPool || currentPool.length === 0) {
      promptLabel.textContent = '出題できる単語データがありません';
      questionEl.textContent = '---';
      spellArea.classList.add('hidden');
      return;
    }

    const picked = currentPool[Math.floor(Math.random() * currentPool.length)];
    const wordId = picked.id ?? '';
    const wordText = String(picked.word ?? '').trim();
    const meaningText = String(picked.meaning ?? '').trim();

    currentQuestion = {
      wordId,
      word: wordText,
      meaning: meaningText,
    };

    if (currentType === 'ja4') {
      promptLabel.textContent = '和訳4択：この英単語の意味を選んでください';
      questionEl.textContent = wordText || '---';
      spellArea.classList.add('hidden');
      choicesArea.classList.remove('hidden');

      const choices = buildChoices(picked, allWords, 'ja4');
      choices.forEach((choiceText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = choiceText;
        btn.addEventListener('click', () => {
          recordAnswer(choiceText === meaningText, meaningText);
        });
        choicesArea.appendChild(btn);
      });
    } else if (currentType === 'en4') {
      promptLabel.textContent = '英訳4択：この和訳に合う英単語を選んでください';
      questionEl.textContent = meaningText || '---';
      spellArea.classList.add('hidden');
      choicesArea.classList.remove('hidden');

      const choices = buildChoices(picked, allWords, 'en4');
      choices.forEach((choiceText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = choiceText;
        btn.addEventListener('click', () => {
          recordAnswer(choiceText.toLowerCase() === wordText.toLowerCase(), wordText);
        });
        choicesArea.appendChild(btn);
      });
    } else {
      promptLabel.textContent = 'スペルチェック：この和訳に対応する英単語を入力してください';
      questionEl.textContent = meaningText || '---';
      choicesArea.classList.add('hidden');
      spellArea.classList.remove('hidden');

      if (spellInput) {
        spellInput.disabled = false;
        spellInput.value = '';
        spellInput.focus();
      }
      const spellSubmit = document.getElementById('spell-submit-btn');
      if (spellSubmit) spellSubmit.disabled = false;
    }
  }

  function startCheckSession() {
    const sectionSelect = document.getElementById('check-section-select');
    const typeSelect = document.getElementById('check-type-select');
    const app = window.LeApp;
    const words = app ? app.getWords() : [];

    const secValue = sectionSelect ? sectionSelect.value : 'all';
    currentType = typeSelect ? typeSelect.value : 'ja4';
    currentPool = getPoolWords(words, secValue);

    renderQuestion();
  }

  function submitSpellAnswer() {
    if (answeredCurrent || !currentQuestion) return;
    const spellInput = document.getElementById('spell-input');
    if (!spellInput) return;

    const userAnswer = spellInput.value.trim().toLowerCase();
    const expected = currentQuestion.word.trim().toLowerCase();
    recordAnswer(userAnswer !== '' && userAnswer === expected, currentQuestion.word);
  }

  function applyFlukePenalty() {
    if (!lastResult || !lastResult.isCorrect || lastResult.appliedDelta !== 1) return;

    const app = window.LeApp;
    const feedbackText = document.getElementById('feedback-text');
    const flukeBtn = document.getElementById('fluke-penalty-btn');

    // +1 を取り消して -1 にするため、差分は -2
    if (app) {
      app.updateWordScore(lastResult.wordId, lastResult.direction, -2);
    }

    lastResult.appliedDelta = -1;
    lastResult.isCorrect = false;

    if (flukeBtn) {
      flukeBtn.disabled = true;
      flukeBtn.textContent = 'マイナス補正済み（-1）';
    }
    if (feedbackText) {
      feedbackText.textContent = `まぐれ補正適用（合計 -1スコア） 正解: ${currentQuestion?.word || currentQuestion?.meaning || ''}`;
      feedbackText.style.color = 'var(--danger)';
    }
  }

  function setupEvents() {
    const startBtn = document.getElementById('start-check-btn');
    const nextBtn = document.getElementById('next-question-btn');
    const flukeBtn = document.getElementById('fluke-penalty-btn');
    const spellSubmitBtn = document.getElementById('spell-submit-btn');
    const spellInput = document.getElementById('spell-input');

    if (startBtn) {
      startBtn.addEventListener('click', startCheckSession);
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', renderQuestion);
    }

    if (flukeBtn) {
      flukeBtn.addEventListener('click', applyFlukePenalty);
    }

    if (spellSubmitBtn) {
      spellSubmitBtn.addEventListener('click', submitSpellAnswer);
    }

    if (spellInput) {
      spellInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitSpellAnswer();
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupEvents();
  });

  document.addEventListener('leapp:ready', () => {
    const app = window.LeApp;
    if (app && app.getWords().length > 0 && currentPool.length === 0) {
      currentPool = app.getWords();
    }
  });
})();