/* ==========================================================================
   PARASITE PRACTICAL EXAM SIMULATOR - CORE LOGIC (app.js)
   ========================================================================== */

// --- 1. WEB AUDIO API SYNTHESIZER (免外部載入音效，動態物理合成) ---
const SoundEffects = {
    ctx: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    // 跑台計時「滴答」聲
    playTick() {
        this.init();
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    },

    // 答對「叮咚」清脆聲
    playCorrect() {
        this.init();
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        
        // 第一個音
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.1, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(now + 0.3);

        // 第二個音 (延遲 0.08s 響起，音高更高)
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
            gain2.gain.setValueAtTime(0.1, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.4);
        }, 80);
    },

    // 答錯「登登」低沉聲
    playIncorrect() {
        this.init();
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(220, now); // A3
        gain1.gain.setValueAtTime(0.15, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(now + 0.4);

        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(174.61, ctx.currentTime); // F3
            gain2.gain.setValueAtTime(0.15, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.5);
        }, 120);
    },

    // 時間到「嗶嗶」警報聲
    playAlarm() {
        this.init();
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.setValueAtTime(0.08, now + 0.15);
        gain.gain.setValueAtTime(0, now + 0.16);
        gain.gain.setValueAtTime(0.08, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(now + 0.4);
    },

    // 得分優異「凱旋」和弦
    playTrophy() {
        this.init();
        const ctx = this.ctx;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.8);
            }, idx * 100);
        });
    }
};

// --- 2. STATE MANAGEMENT (測驗與學習狀態) ---
const AppState = {
    // 測驗設定
    selectedSuits: ['spade', 'heart', 'diamond', 'club'],
    questionCount: 20,
    timeLimit: 30, // 秒
    
    // 測驗進行中狀態
    quizPool: [],        // 篩選後的所有可能題目
    quizQuestions: [],   // 本次測驗抽選出的題目
    currentQuestionIdx: 0,
    answersRecord: [],   // 紀錄每題是否答對：{ question: obj, isCorrect: bool }
    
    // 錯題本 (Weakness list)
    wrongQuestions: [],
    
    // 計時器物件
    timerInterval: null,
    secondsLeft: 30,
    isRevealed: false,
    
    // 圖鑑搜尋狀態
    gallerySearchQuery: '',
    gallerySelectedSuit: 'all',
    galleryShowLifecycle: true
};

// --- 3. INITIALIZATION & VIEW CONTROLLERS ---
document.addEventListener('DOMContentLoaded', () => {
    // 檢查資料庫是否已載入
    if (typeof QUIZ_QUESTIONS === 'undefined' || typeof LIFECYCLE_GALLERY === 'undefined') {
        alert('警告：quiz_db.js 資料庫載入失敗，請確認該檔案存在於同目錄中！');
        return;
    }

    initEventHandlers();
    renderGallery();
});

// 註冊所有事件監聽器
function initEventHandlers() {
    // 1. SPA 視圖切換
    document.querySelectorAll('.header-nav .nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            switchView(targetId);
            
            // 同步啟用樣式
            document.querySelectorAll('.header-nav .nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // 點選 LOGO 回首頁
    document.getElementById('brand-home').addEventListener('click', () => {
        switchView('view-setup');
        document.querySelectorAll('.header-nav .nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-quiz').classList.add('active');
    });

    // 2. 測驗設定選項
    document.querySelectorAll('.category-selector-grid .suit-selector-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            
            // 讀取當前所有選取的分類
            const activeButtons = document.querySelectorAll('.category-selector-grid .suit-selector-btn.active');
            AppState.selectedSuits = Array.from(activeButtons).map(b => b.getAttribute('data-suit'));
            
            // 點擊音效
            SoundEffects.playTick();
        });
    });

    // 開始考試按鈕
    document.getElementById('btn-start-quiz').addEventListener('click', () => {
        // 初始化音效Context（需點擊觸發以配合瀏覽器安全策略）
        SoundEffects.init();
        
        // 讀取設定
        const qCountSelect = document.getElementById('select-q-count').value;
        AppState.questionCount = qCountSelect === 'all' ? 'all' : parseInt(qCountSelect);
        AppState.timeLimit = parseInt(document.getElementById('select-time-limit').value);
        
        startNewQuiz();
    });

    // 快捷連結前往圖鑑
    document.getElementById('btn-goto-gallery').addEventListener('click', () => {
        switchView('view-gallery');
        document.querySelectorAll('.header-nav .nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-gallery').classList.add('active');
    });

    // 3. 考場內按鈕
    document.getElementById('btn-show-answer').addEventListener('click', () => {
        revealAnswer();
    });

    document.getElementById('btn-correct').addEventListener('click', () => {
        recordFeedback(true);
    });

    document.getElementById('btn-incorrect').addEventListener('click', () => {
        recordFeedback(false);
    });

    document.getElementById('btn-next-q').addEventListener('click', () => {
        goToNextQuestion();
    });

    // 4. 結果報告按鈕
    document.getElementById('btn-restart-exam').addEventListener('click', () => {
        switchView('view-setup');
    });

    document.getElementById('btn-retry-wrong').addEventListener('click', () => {
        startRetryWrongQuiz();
    });

    document.getElementById('btn-result-goto-gallery').addEventListener('click', () => {
        switchView('view-gallery');
        document.querySelectorAll('.header-nav .nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('nav-gallery').classList.add('active');
    });

    // 5. 圖鑑搜尋與篩選
    document.getElementById('gallery-search').addEventListener('input', (e) => {
        AppState.gallerySearchQuery = e.target.value;
        renderGallery();
    });

    document.querySelectorAll('#gallery-suit-filters .suit-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#gallery-suit-filters .suit-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            AppState.gallerySelectedSuit = chip.getAttribute('data-suit');
            renderGallery();
            SoundEffects.playTick();
        });
    });

    // 圖鑑生活史開關
    document.getElementById('toggle-lifecycle').addEventListener('change', (e) => {
        AppState.galleryShowLifecycle = e.target.checked;
        renderGallery();
        SoundEffects.playTick();
    });

    // 6. 點擊圖片燈箱放大
    document.getElementById('exam-img-container').addEventListener('click', () => {
        const currentQ = AppState.quizQuestions[AppState.currentQuestionIdx];
        if (currentQ) {
            openLightbox(currentQ);
        }
    });

    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', (e) => {
        if (e.target.id === 'lightbox') closeLightbox();
    });
}

// 視圖切換引擎
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(view => {
        view.classList.remove('active');
    });
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        // 每次切換畫面，捲動回頂端
        window.scrollTo(0, 0);
    }
}

// --- 4. EXAM CORE ENGINE (跑台測驗核心邏輯) ---

// 開始全新的測驗
function startNewQuiz() {
    if (AppState.selectedSuits.length === 0) {
        alert('請至少選擇一個考試範圍（線蟲、吸蟲、絛蟲或原蟲）！');
        return;
    }

    // 1. 建立考題池：篩選符合花色的考題 (過濾 life cycle)
    AppState.quizPool = QUIZ_QUESTIONS.filter(q => {
        return AppState.selectedSuits.includes(q.parasite.suit) && !q.isLifecycle;
    });

    if (AppState.quizPool.length === 0) {
        alert('此篩選範圍內目前沒有照片考題！');
        return;
    }

    // 2. 隨機打亂 (Shuffle)
    const shuffled = [...AppState.quizPool].sort(() => Math.random() - 0.5);

    // 3. 抽選規定題數
    const finalCount = AppState.questionCount === 'all' 
        ? shuffled.length 
        : Math.min(AppState.questionCount, shuffled.length);

    AppState.quizQuestions = shuffled.slice(0, finalCount);
    AppState.currentQuestionIdx = 0;
    AppState.answersRecord = [];
    
    // 切換至考場並載入第一題
    switchView('view-exam');
    loadQuestion(0);
}

// 針對本次答錯的題目進行重新挑戰
function startRetryWrongQuiz() {
    if (AppState.wrongQuestions.length === 0) return;

    AppState.quizQuestions = [...AppState.wrongQuestions].sort(() => Math.random() - 0.5);
    AppState.currentQuestionIdx = 0;
    AppState.answersRecord = [];
    
    switchView('view-exam');
    loadQuestion(0);
}

// 載入單一考題
function loadQuestion(idx) {
    if (idx < 0 || idx >= AppState.quizQuestions.length) return;
    
    AppState.currentQuestionIdx = idx;
    AppState.isRevealed = false;
    
    const q = AppState.quizQuestions[idx];
    
    // 更新題數進度
    document.getElementById('exam-current-idx').textContent = idx + 1;
    document.getElementById('exam-total-idx').textContent = AppState.quizQuestions.length;

    // 更新圖片
    const imgEl = document.getElementById('exam-parasite-img');
    imgEl.src = q.filepath;
    imgEl.alt = `${q.parasite.nameEn} - ${q.stage}`;

    // 更新型態標籤 (讓學生一邊看圖一邊知道考的型態是卵或成蟲)
    const stageTag = document.getElementById('exam-stage-tag');
    stageTag.textContent = q.stage;

    // 重設反饋按鈕的選取樣式
    document.getElementById('btn-correct').classList.remove('selected');
    document.getElementById('btn-incorrect').classList.remove('selected');

    // 隱藏/顯示作答控制面板
    document.getElementById('action-unrevealed-panel').classList.remove('hidden');
    document.getElementById('action-revealed-panel').classList.add('hidden');

    // 處理計時器
    resetAndStartTimer();
}

// 倒數計時器邏輯
function resetAndStartTimer() {
    // 清除舊計時
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    
    const displayNum = document.getElementById('exam-timer-num');
    const timerCircle = document.getElementById('timer-circle');
    const countdownContainer = document.querySelector('.countdown-container');
    
    countdownContainer.classList.remove('warning');

    if (AppState.timeLimit === 0) {
        // 無限制時間模式
        displayNum.textContent = "∞";
        timerCircle.setAttribute('stroke-dasharray', '100, 100');
        return;
    }

    AppState.secondsLeft = AppState.timeLimit;
    displayNum.textContent = AppState.secondsLeft;
    
    // 圓形進度條重設
    timerCircle.setAttribute('stroke-dasharray', '100, 100');

    // 每 100 毫秒跑一次，讓進度條動畫極致流暢
    let startTimestamp = null;
    const duration = AppState.timeLimit * 1000;
    
    const updateTimer = () => {
        if (AppState.isRevealed) return; // 若已被手動揭曉則停止

        const now = Date.now();
        if (!startTimestamp) startTimestamp = now;
        const elapsed = now - startTimestamp;
        const remainingMs = Math.max(0, duration - elapsed);
        const remainingSecs = Math.ceil(remainingMs / 1000);
        
        // 更新秒數數字
        displayNum.textContent = remainingSecs;
        
        // 更新圓圈進度條 (百分比)
        const pct = (remainingMs / duration) * 100;
        timerCircle.setAttribute('stroke-dasharray', `${pct}, 100`);

        // 最後 5 秒警告 (發光變紅 + 滴答聲)
        if (remainingSecs <= 5) {
            countdownContainer.classList.add('warning');
            
            // 剛好跨入新的秒數時播放滴答聲
            if (AppState.secondsLeft !== remainingSecs && remainingSecs > 0) {
                SoundEffects.playTick();
            }
        }
        
        AppState.secondsLeft = remainingSecs;

        if (remainingMs <= 0) {
            // 時間到！
            clearInterval(AppState.timerInterval);
            revealAnswer();
            SoundEffects.playAlarm();
            // 標記為未作答/答錯
            AppState.answersRecord.push({
                question: AppState.quizQuestions[AppState.currentQuestionIdx],
                isCorrect: false
            });
            // 自動為答錯按鈕加亮提示
            document.getElementById('btn-incorrect').classList.add('selected');
        } else {
            // 繼續下一幀
            AppState.timerInterval = requestAnimationFrame(updateTimer);
        }
    };

    AppState.timerInterval = requestAnimationFrame(updateTimer);
}

// 揭曉答案
function revealAnswer() {
    if (AppState.isRevealed) return;
    
    AppState.isRevealed = true;
    if (AppState.timerInterval) cancelAnimationFrame(AppState.timerInterval);

    const q = AppState.quizQuestions[AppState.currentQuestionIdx];
    
    // 1. 填入答案卡內容
    const cardEl = document.querySelector('.answer-card');
    cardEl.className = 'answer-card'; // 清除舊的花色 class
    cardEl.classList.add(`suit-${q.parasite.suit}`);

    document.getElementById('ans-suit-badge').textContent = getSuitSymbol(q.parasite.suit);
    document.getElementById('ans-name-zh').textContent = q.parasite.nameZh;
    document.getElementById('ans-name-en').textContent = q.parasite.nameEn;
    document.getElementById('ans-stage-label').textContent = `型態：${q.stage}`;
    document.getElementById('ans-organ').textContent = q.parasite.organText;
    document.getElementById('ans-host').textContent = `${q.parasite.hostIcon} ${q.parasite.hostText}`;
    document.getElementById('ans-exam-key-text').textContent = q.parasite.examKey;

    // 2. 切換控制按鈕
    document.getElementById('action-unrevealed-panel').classList.add('hidden');
    document.getElementById('action-revealed-panel').classList.remove('hidden');

    // 3. 設定下一題按鈕文字 (如果是最後一題則顯示產出報告)
    const nextBtn = document.getElementById('btn-next-q');
    if (AppState.currentQuestionIdx === AppState.quizQuestions.length - 1) {
        nextBtn.textContent = '🏁 產出跑台成績單';
    } else {
        nextBtn.textContent = '下一題 ➡️';
    }

    // 預設將「下一題」按鈕設為停用，直到學生點選了「記住了」或「答錯了」回饋
    nextBtn.disabled = true;
    nextBtn.style.opacity = '0.5';
}

// 記錄答題回饋 (Got It 或 Need Review)
function recordFeedback(isCorrect) {
    const nextBtn = document.getElementById('btn-next-q');
    
    // 1. 播放對應音效
    if (isCorrect) {
        SoundEffects.playCorrect();
        document.getElementById('btn-correct').classList.add('selected');
        document.getElementById('btn-incorrect').classList.remove('selected');
    } else {
        SoundEffects.playIncorrect();
        document.getElementById('btn-incorrect').classList.add('selected');
        document.getElementById('btn-correct').classList.remove('selected');
    }

    // 2. 紀錄或更新本次作答
    const currentQ = AppState.quizQuestions[AppState.currentQuestionIdx];
    
    // 檢查是否因為「時間到」已經被塞入過紀錄
    const existingIdx = AppState.answersRecord.findIndex(r => r.question.id === currentQ.id);
    if (existingIdx !== -1) {
        AppState.answersRecord[existingIdx].isCorrect = isCorrect;
    } else {
        AppState.answersRecord.push({
            question: currentQ,
            isCorrect: isCorrect
        });
    }

    // 3. 啟用下一題按鈕
    nextBtn.disabled = false;
    nextBtn.style.opacity = '1';
}

// 進入下一題或結算
function goToNextQuestion() {
    const nextIdx = AppState.currentQuestionIdx + 1;
    if (nextIdx < AppState.quizQuestions.length) {
        loadQuestion(nextIdx);
    } else {
        showQuizResults();
    }
}

// --- 5. RESULT & ANALYSIS CONTROLLERS (測驗結算與分析) ---

function showQuizResults() {
    // 1. 統計結果
    const total = AppState.answersRecord.length;
    const correctCount = AppState.answersRecord.filter(r => r.isCorrect).length;
    const wrongCount = total - correctCount;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // 2. 填入數據
    document.getElementById('res-stat-total').textContent = total;
    document.getElementById('res-stat-correct').textContent = correctCount;
    document.getElementById('res-stat-wrong').textContent = wrongCount;
    document.getElementById('result-score-text').textContent = score;

    // 3. 分數圓圈動畫
    const scoreCircle = document.getElementById('result-score-circle');
    scoreCircle.setAttribute('stroke-dasharray', `${score}, 100`);

    // 4. 動態產生趣味評語
    const commentEl = document.getElementById('result-comment-text');
    if (score === 100) {
        commentEl.textContent = '👑 醫神降臨！無懈可擊的 100 分！台大期末跑台考絕對難不倒你！';
        SoundEffects.playTrophy();
    } else if (score >= 90) {
        commentEl.textContent = '🌟 太強了！答對率破九成！您對這些顯微特徵非常熟稔，醫學系之星！';
        SoundEffects.playTrophy();
    } else if (score >= 70) {
        commentEl.textContent = '👍 表現優良！多數核心考點皆已掌握。將錯題本複習一下即可衝刺滿分！';
        SoundEffects.playTrophy();
    } else if (score >= 50) {
        commentEl.textContent = '💪 再接再厲！有一些容易混淆的蟲卵或幼蟲需要多加辨識。加油！';
    } else {
        commentEl.textContent = '📚 需要加把勁囉！建議開啟「3D閃卡圖鑑」進行全身心背卡，多看幾次圖片！';
    }

    // 5. 整理並更新「錯題本」
    AppState.wrongQuestions = AppState.answersRecord
        .filter(r => !r.isCorrect)
        .map(r => r.question);

    const wrongContainer = document.getElementById('wrong-list-container');
    const wrongListEl = document.getElementById('wrong-items-list');
    const retryWrongBtn = document.getElementById('btn-retry-wrong');
    
    wrongListEl.innerHTML = '';

    if (AppState.wrongQuestions.length > 0) {
        wrongContainer.classList.remove('hidden');
        retryWrongBtn.classList.remove('hidden');
        document.getElementById('wrong-count-badge').textContent = AppState.wrongQuestions.length;

        // 渲染錯題卡
        AppState.wrongQuestions.forEach(q => {
            const item = document.createElement('div');
            item.className = 'wrong-item-box';
            item.innerHTML = `
                <img class="wrong-item-thumb" src="${q.filepath}" alt="${q.parasite.nameEn}">
                <div class="wrong-item-name">${q.parasite.nameZh}</div>
                <div class="wrong-item-stage">${q.stage}</div>
            `;
            // 點擊錯題可直接開燈箱放大
            item.addEventListener('click', () => openLightbox(q));
            wrongListEl.appendChild(item);
        });
    } else {
        wrongContainer.classList.add('hidden');
        retryWrongBtn.classList.add('hidden');
    }

    // 切換至結果視圖
    switchView('view-result');
}

// --- 6. 3D FLASHCARD GALLERY CONTROLLER (閃卡圖鑑控制) ---

function renderGallery() {
    const grid = document.getElementById('gallery-cards-grid');
    grid.innerHTML = '';

    // 合併診斷照片與生活史照片
    let pool = [...QUIZ_QUESTIONS];
    if (AppState.galleryShowLifecycle) {
        pool = [...pool, ...LIFECYCLE_GALLERY];
    }

    // 1. 搜尋過濾 (搜尋中文名、英文名、常考點、器官)
    const query = AppState.gallerySearchQuery.toLowerCase().trim();
    if (query !== '') {
        pool = pool.filter(q => {
            return q.parasite.nameZh.includes(query) ||
                   q.parasite.nameEn.toLowerCase().includes(query) ||
                   q.parasite.examKey.toLowerCase().includes(query) ||
                   q.parasite.organText.toLowerCase().includes(query) ||
                   q.stage.toLowerCase().includes(query);
        });
    }

    // 2. 花色分類過濾
    if (AppState.gallerySelectedSuit !== 'all') {
        pool = pool.filter(q => q.parasite.suit === AppState.gallerySelectedSuit);
    }

    // 3. 排序 (依照學名排序，方便系統性記憶)
    pool.sort((a, b) => a.parasite.nameEn.localeCompare(b.parasite.nameEn));

    if (pool.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 40px 0;">🔍 找不到符合篩選條件的卡牌。</div>`;
        return;
    }

    // 4. 生成 3D 閃卡卡牌 DOM
    pool.forEach(q => {
        const card = document.createElement('div');
        // 加入對應花色 Class 以渲染特有霓虹上邊框
        card.className = `gallery-card ${q.parasite.suit}`;
        if (q.isLifecycle) {
            card.classList.add('lifecycle');
        }

        // 判斷型態標籤與樣式 Class
        const stageLabel = q.isLifecycle ? 'Life Cycle (生活史)' : q.stage;
        const stageClass = q.isLifecycle ? 'card-front-stage lifecycle' : 'card-front-stage';

        card.innerHTML = `
            <div class="card-inner">
                <!-- 正面：只顯示圖片與型態，猜學名 -->
                <div class="card-front">
                    <div class="card-img-wrapper">
                        <img src="${q.filepath}" alt="${q.parasite.nameEn}">
                    </div>
                    <div class="card-front-info">
                        <span class="${stageClass}">${stageLabel}</span>
                        <span class="card-hint-lbl">点击翻转 🔄</span>
                    </div>
                </div>
                <!-- 反面：顯示完整解析 -->
                <div class="card-back">
                    <div>
                        <div class="card-back-title">${q.parasite.nameZh}</div>
                        <div class="card-back-en">${q.parasite.nameEn}</div>
                        <div class="card-back-meta">
                            <span>構造：<strong>${q.stage}</strong></span>
                            <span>器官：<strong>${q.parasite.organText}</strong></span>
                            <span>宿主：<strong>${q.parasite.hostIcon} ${q.parasite.hostText.split('，')[0]}</strong></span>
                        </div>
                    </div>
                    <div class="card-back-key">
                        ${q.parasite.examKey}
                    </div>
                </div>
            </div>
        `;

        // 點擊觸發 3D 翻轉動畫
        card.addEventListener('click', (e) => {
            // 如果是在手機上雙擊或需要放大，可在未來做處理；此處標準點擊切換翻轉
            card.classList.toggle('flipped');
            SoundEffects.playTick();
        });

        grid.appendChild(card);
    });
}

// --- 7. LIGHTBOX MODAL CONTROLLER (高解析度燈箱放大) ---

function openLightbox(q) {
    const lightbox = document.getElementById('lightbox');
    
    document.getElementById('lightbox-img').src = q.filepath;
    document.getElementById('lightbox-title-zh').textContent = q.parasite.nameZh;
    document.getElementById('lightbox-title-en').textContent = q.parasite.nameEn;
    
    const stageEl = document.getElementById('lightbox-stage');
    stageEl.textContent = q.isLifecycle ? 'Life Cycle (生活史)' : q.stage;
    if (q.isLifecycle) {
        stageEl.style.background = 'rgba(168, 85, 247, 0.15)';
        stageEl.style.color = '#c084fc';
    } else {
        stageEl.style.background = 'rgba(56, 189, 248, 0.15)';
        stageEl.style.color = '#38bdf8';
    }

    document.getElementById('lightbox-exam-key').textContent = `🎯 跑台常考重點：${q.parasite.examKey}`;

    lightbox.classList.remove('hidden');
    SoundEffects.playTick();
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    SoundEffects.playTick();
}

// --- 8. UTILITIES (輔助函式) ---

// 獲取分類象徵符號
function getSuitSymbol(suit) {
    switch (suit) {
        case 'spade': return '♠';
        case 'heart': return '♥';
        case 'diamond': return '♦';
        case 'club': return '♣';
        default: return '🃏';
    }
}
