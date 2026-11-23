(() => {
  const SECTION_SIZE = 100;

  let hideMode = 'ja'; // 'ja' | 'en' | 'none'
  let currentSection = 1;
  let countedSectionsInSession = new Set();

  function getSectionWords(words, sectionNum) {
    const targetSec = Number(sectionNum) || 1;
    const matchedByProp = words.filter((w) => Number(w.section) === targetSec);
    if (matchedByProp.length > 0) {
      return matchedByProp.slice(0, SECTION_SIZE);
    }

    const startIdx = (targetSec - 1) * SECTION_SIZE;
    return words.slice(startIdx, startIdx + SECTION_SIZE);
  }

  function getTargetDirection() {
    if (hideMode === 'ja') return 'enToJa';
    return 'jaToEn';
  }

  function formatDeltaText(delta) {
    if (delta > 0) return `+${delta}`;
    return `${delta}`;
  }

  function renderList() {
    const listEl = document.getElementById('study100-list');
    if (!listEl) return;

    const app = window.LeApp;
    const words = app ? app.getWords() : [];
    const sectionWords = getSectionWords(words, currentSection);

    listEl.innerHTML = '';

    if (sectionWords.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'quiz-card';
      emptyBox.innerHTML = `
        <p class="quiz-label">セクション ${currentSection} の単語データが見つかりません</p>
        <p class="panel-desc"><code>data/words.json</code> を配置すると、ここに100単語が表示されます。</p>
      `;
      listEl.appendChild(emptyBox);
      return;
    }

    const fragment = document.createDocumentFragment();

    sectionWords.forEach((item, index) => {
      const wordId = item.id ?? (currentSection - 1) * SECTION_SIZE + index + 1;
      const wordText = item.word ?? '';
      const meaningText = item.meaning ?? '';
      const scores = app ? app.getWordScores(wordId) : { enToJa: 0, jaToEn: 0 };

      const card = document.createElement('article');
      card.className = 'study-item';

      const metaRow = document.createElement('div');
      metaRow.style.display = 'flex';
      metaRow.style.justifyContent = 'space-between';
      metaRow.style.alignItems = 'center';
      metaRow.style.fontSize = '0.78rem';
      metaRow.style.color = 'var(--text-muted)';

      const numSpan = document.createElement('span');
      numSpan.textContent = `#${wordId}`;

      const scoreSpan = document.createElement('span');
      scoreSpan.textContent = `和訳: ${scores.enToJa} / 英訳: ${scores.jaToEn}`;
      scoreSpan.dataset.role = 'score-label';

      metaRow.appendChild(numSpan);
      metaRow.appendChild(scoreSpan);

      const wordsRow = document.createElement('div');
      wordsRow.className = 'study-words';

      const enSpan = document.createElement('strong');
      enSpan.textContent = wordText;
      enSpan.style.fontSize = '1.05rem';
      if (hideMode === 'en') {
        enSpan.classList.add('masked');
        enSpan.title = 'タップで英単語を表示';
      }

      const jaSpan = document.createElement('span');
      jaSpan.textContent = meaningText;
      jaSpan.style.fontSize = '0.95rem';
      if (hideMode === 'ja') {
        jaSpan.classList.add('masked');
        jaSpan.title = 'タップで和訳を表示';
      }

      [enSpan, jaSpan].forEach((el) => {
        el.addEventListener('click', () => {
          if (el.classList.contains('masked')) {
            el.classList.toggle('revealed');
          }
        });
      });

      wordsRow.appendChild(enSpan);
      wordsRow.appendChild(jaSpan);

      const ratingGroup = document.createElement('div');
      ratingGroup.className = 'rating-group';

      const choices = [
        { label: '覚えられた (+1)', delta: 1, className: 'good' },
        { label: '微妙 (±0)', delta: 0, className: 'mid' },
        { label: '覚えられていない (-1)', delta: -1, className: 'bad' },
      ];

      choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `rate-btn ${choice.className}`;
        btn.textContent = choice.label;

        btn.addEventListener('click', () => {
          if (!app) return;
          const direction = getTargetDirection();
          app.updateWordScore(wordId, direction, choice.delta);

          if (!countedSectionsInSession.has(currentSection)) {
            countedSectionsInSession.add(currentSection);
            app.incrementPlayCount(1);
          }

          const updated = app.getWordScores(wordId);
          scoreSpan.textContent = `和訳: ${updated.enToJa} / 英訳: ${updated.jaToEn}`;

          btn.textContent = `${choice.label} (${formatDeltaText(choice.delta)})`;
          setTimeout(() => {
            btn.textContent = choice.label;
          }, 500);
        });

        ratingGroup.appendChild(btn);
      });

      card.appendChild(metaRow);
      card.appendChild(wordsRow);
      card.appendChild(ratingGroup);
      fragment.appendChild(card);
    });

    listEl.appendChild(fragment);
  }

  function setupControls() {
    const sectionSelect = document.getElementById('study-section-select');
    if (sectionSelect) {
      currentSection = Number(sectionSelect.value) || 1;
      sectionSelect.addEventListener('change', () => {
        currentSection = Number(sectionSelect.value) || 1;
        renderList();
      });
    }

    const segButtons = document.querySelectorAll('#tab-study100 .seg-btn[data-hide]');
    segButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        hideMode = btn.dataset.hide || 'ja';
        segButtons.forEach((b) => b.classList.toggle('active', b === btn));
        renderList();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupControls();
    renderList();
  });

  document.addEventListener('leapp:ready', () => {
    renderList();
  });
})();