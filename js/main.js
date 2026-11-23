const STORAGE_KEY = 'leapp_user_state_v1';

const DEFAULT_STATE = {
  username: 'ゲスト',
  totalScore: 0,
  playCount: 0,
  wordScores: {}, // { [wordId]: { enToJa: number, jaToEn: number } }
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STATE),
      ...parsed,
      wordScores: parsed.wordScores && typeof parsed.wordScores === 'object' ? parsed.wordScores : {},
    };
  } catch (err) {
    console.warn('保存データの読み込みに失敗したため初期値を使用します:', err);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('保存データへの書き込みに失敗しました:', err);
  }
}

function getRankByScore(score) {
  if (score >= 2000) return 'MASTER';
  if (score >= 1200) return 'DIAMOND';
  if (score >= 700) return 'GOLD';
  if (score >= 300) return 'SILVER';
  if (score >= 100) return 'BRONZE';
  return 'BEGINNER';
}

function ensureWordScoreEntry(state, wordId) {
  const key = String(wordId);
  if (!state.wordScores[key]) {
    state.wordScores[key] = { enToJa: 0, jaToEn: 0 };
  }
  return state.wordScores[key];
}

async function loadWordsData() {
  try {
    const response = await fetch('./data/words.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('data/words.json の読み込みにまだ成功していません:', err);
    return [];
  }
}

function populateSectionSelects(sectionCount = 23) {
  const studySelect = document.getElementById('study-section-select');
  const checkSelect = document.getElementById('check-section-select');
  const listSelect = document.getElementById('list-section-select');

  if (studySelect) {
    studySelect.innerHTML = '';
    for (let i = 1; i <= sectionCount; i += 1) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `セクション ${i}（${(i - 1) * 100 + 1}〜${i * 100}）`;
      studySelect.appendChild(opt);
    }
  }

  for (let i = 1; i <= sectionCount; i += 1) {
    if (checkSelect) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `セクション ${i}`;
      checkSelect.appendChild(opt);
    }
    if (listSelect) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `セクション ${i}`;
      listSelect.appendChild(opt);
    }
  }
}

function setupTabs(onTabChange) {
  const navButtons = document.querySelectorAll('.nav-btn[data-tab]');
  const panels = document.querySelectorAll('.tab-panel[id^="tab-"]');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      navButtons.forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === targetTab);
      });

      panels.forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${targetTab}`);
      });

      if (typeof onTabChange === 'function') {
        onTabChange(targetTab);
      }
    });
  });
}

function createAppController() {
  const state = loadState();
  let words = [];
  const listeners = new Set();

  function renderHeader() {
    const rankEl = document.getElementById('user-rank');
    const scoreEl = document.getElementById('total-score');
    const playEl = document.getElementById('play-count');
    const nameEl = document.getElementById('user-name-display');

    if (rankEl) rankEl.textContent = `RANK: ${getRankByScore(state.totalScore)}`;
    if (scoreEl) scoreEl.textContent = String(state.totalScore);
    if (playEl) playEl.textContent = String(state.playCount);
    if (nameEl) nameEl.textContent = state.username || 'ゲスト';
  }

  function notifyListeners() {
    renderHeader();
    saveState(state);
    listeners.forEach((fn) => {
      try {
        fn({ words, state });
      } catch (err) {
        console.error('リスナー実行エラー:', err);
      }
    });
  }

  function updateWordScore(wordId, direction, delta) {
    const entry = ensureWordScoreEntry(state, wordId);
    if (direction === 'enToJa') {
      entry.enToJa += delta;
    } else if (direction === 'jaToEn') {
      entry.jaToEn += delta;
    }
    state.totalScore += delta;
    notifyListeners();
  }

  function incrementPlayCount(amount = 1) {
    state.playCount += amount;
    notifyListeners();
  }

  function getWordScores(wordId) {
    const key = String(wordId);
    return state.wordScores[key] || { enToJa: 0, jaToEn: 0 };
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function init() {
    populateSectionSelects(23);
    renderHeader();

    setupTabs((tabName) => {
      document.dispatchEvent(new CustomEvent('leapp:tabchange', { detail: { tab: tabName } }));
    });

    words = await loadWordsData();
    document.dispatchEvent(new CustomEvent('leapp:ready', { detail: { words, state } }));
    notifyListeners();
  }

  return {
    init,
    getWords: () => words,
    getState: () => state,
    getWordScores,
    getRankByScore,
    updateWordScore,
    incrementPlayCount,
    subscribe,
  };
}

const app = createAppController();
window.LeApp = app;

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});