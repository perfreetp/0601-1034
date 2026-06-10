(function () {
  const NAMESPACE = 'metavenue';
  let isActive = false;
  let state = null;
  let audioEl = null;
  let danmakuInterval = null;
  let countdownInterval = null;
  let analytics = {
    participants: Math.floor(Math.random() * 20) + 10,
    avgDuration: Math.floor(Math.random() * 15) + 5,
    interactions: 0,
    questions: 0,
    logs: [],
    questionList: []
  };
  let joinTime = Date.now();

  const THEMES = {
    conference: { bg: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', accent: '#4fc3f7', glow: 'rgba(79,195,247,0.3)' },
    cyberpunk: { bg: 'linear-gradient(135deg,#0d0221,#0a0a23,#150050)', accent: '#ff00ff', glow: 'rgba(255,0,255,0.3)' },
    garden: { bg: 'linear-gradient(135deg,#1b4332,#2d6a4f,#40916c)', accent: '#81c784', glow: 'rgba(129,199,132,0.3)' },
    galaxy: { bg: 'linear-gradient(135deg,#0b0c10,#1f2833,#45a29e)', accent: '#66fcf1', glow: 'rgba(102,252,241,0.3)' },
    theater: { bg: 'linear-gradient(135deg,#2c003e,#512b58,#8e3b46)', accent: '#f48fb1', glow: 'rgba(244,143,177,0.3)' },
    ocean: { bg: 'linear-gradient(135deg,#023e8a,#0077b6,#0096c7)', accent: '#90e0ef', glow: 'rgba(144,224,239,0.3)' }
  };

  const AVATAR_ICONS = {
    pixel: ['🧑‍💻', '👩‍💻', '👨‍💻', '🧑‍🔬', '👩‍🔬', '👨‍🔬', '🧑‍🎨', '👩‍🎨'],
    cartoon: ['🧑‍🎤', '👩‍🎤', '🧑‍🏫', '👩‍🏫', '🧑‍🚀', '👩‍🚀', '🧑‍🍳', '👩‍🍳'],
    '3d': ['🤖', '👾', '🎮', '🎯', '🎪', '🎭', '🎨', '🎬'],
    abstract: ['🔷', '🔶', '🟣', '🟢', '⬛', '⬜', '🔴', '🔵']
  };

  function ensureContainer() {
    let el = document.getElementById(`${NAMESPACE}-overlay`);
    if (!el) {
      el = document.createElement('div');
      el.id = `${NAMESPACE}-overlay`;
      document.body.appendChild(el);
    }
    return el;
  }

  function removeContainer() {
    const el = document.getElementById(`${NAMESPACE}-overlay`);
    if (el) el.remove();
    const style = document.getElementById(`${NAMESPACE}-dynamic-style`);
    if (style) style.remove();
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
    if (danmakuInterval) {
      clearInterval(danmakuInterval);
      danmakuInterval = null;
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function injectDynamicStyle(theme) {
    let style = document.getElementById(`${NAMESPACE}-dynamic-style`);
    if (!style) {
      style = document.createElement('style');
      style.id = `${NAMESPACE}-dynamic-style`;
      document.head.appendChild(style);
    }
    const t = THEMES[theme] || THEMES.conference;
    style.textContent = `
      #${NAMESPACE}-overlay {
        --mv-accent: ${t.accent};
        --mv-glow: ${t.glow};
        --mv-bg: ${t.bg};
      }
    `;
  }

  function activate(s) {
    state = s;
    isActive = true;
    joinTime = Date.now();
    injectDynamicStyle(state.space.theme);
    render();
    startAnalyticsPing();
  }

  function deactivate() {
    isActive = false;
    removeContainer();
  }

  function render() {
    if (!isActive || !state) return;
    const overlay = ensureContainer();
    const theme = THEMES[state.space.theme] || THEMES.conference;

    overlay.innerHTML = `
      <div class="mv-frame" style="background:${theme.bg}">
        <div class="mv-header">
          <div class="mv-logo">🌐 MetaVenue</div>
          <div class="mv-countdown" id="mv-countdown"></div>
          <div class="mv-header-actions">
            <button class="mv-btn mv-btn-hand" id="mv-hand-btn">✋ 举手</button>
            <button class="mv-btn mv-btn-applause" id="mv-applause-btn">👏 鼓掌</button>
            <button class="mv-btn mv-btn-question" id="mv-question-btn">❓ 提问</button>
          </div>
        </div>

        ${state.space.posterUrl ? `
        <div class="mv-poster">
          <img src="${state.space.posterUrl}" alt="入口海报">
        </div>` : ''}

        <div class="mv-stage">
          <div class="mv-vip-area" id="mv-vip-area">
            ${renderVipArea()}
          </div>
          <div class="mv-live-area" id="mv-live-area">
            ${state.agenda.liveBound ? `
              <div class="mv-live-badge">🔴 LIVE</div>
              <div class="mv-live-frame">
                <iframe src="${state.agenda.liveUrl}" allowfullscreen></iframe>
              </div>
            ` : `
              <div class="mv-stage-placeholder">
                <span>🎯 主舞台</span>
              </div>
            `}
          </div>
        </div>

        <div class="mv-seating" id="mv-seating">
          ${renderSeating()}
        </div>

        <div class="mv-booths" id="mv-booths">
          ${renderBooths()}
        </div>

        <div class="mv-hotspots" id="mv-hotspots">
          ${renderHotspots()}
        </div>

        <div class="mv-danmaku-layer" id="mv-danmaku-layer"></div>

        <div class="mv-agenda-bar" id="mv-agenda-bar">
          ${renderAgendaBar()}
        </div>

        <div class="mv-vote-modal hidden" id="mv-vote-modal">
          <div class="mv-vote-content">
            <h3 class="mv-vote-question" id="mv-vote-question"></h3>
            <div class="mv-vote-options" id="mv-vote-options"></div>
            <div class="mv-vote-results hidden" id="mv-vote-results"></div>
          </div>
        </div>

        <div class="mv-question-modal hidden" id="mv-question-modal">
          <div class="mv-question-content">
            <textarea id="mv-question-input" placeholder="请输入您的问题…"></textarea>
            <div class="mv-question-actions">
              <button class="mv-btn" id="mv-question-cancel">取消</button>
              <button class="mv-btn mv-btn-primary" id="mv-question-submit">提交</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindOverlayEvents();
    startCountdown();
    if (state.interact.danmakuEnabled) startDanmaku();
    if (state.space.bgmUrl) playBgm(state.space.bgmUrl, state.space.bgmVolume / 100);
  }

  function renderVipArea() {
    if (!state.seats.vipEnabled) return '';
    const icons = AVATAR_ICONS[state.seats.avatarStyle] || AVATAR_ICONS.pixel;
    const vips = [];
    const vipNames = ['主讲嘉宾', '特邀嘉宾', '行业专家', '知名学者', '技术顾问', '产品总监'];
    for (let i = 0; i < state.seats.vipCount; i++) {
      const icon = icons[i % icons.length];
      const name = vipNames[i % vipNames.length];
      vips.push(`<div class="mv-vip-seat"><span class="mv-avatar">${icon}</span><span class="mv-name">${name}</span></div>`);
    }
    return `<div class="mv-vip-label">${state.seats.vipLabel}</div><div class="mv-vip-seats">${vips.join('')}</div>`;
  }

  function renderSeating() {
    const icons = AVATAR_ICONS[state.seats.avatarStyle] || AVATAR_ICONS.pixel;
    const total = Math.min(state.seats.count, 50);
    const perRow = state.seats.perRow;
    const rows = Math.ceil(total / perRow);
    const names = ['观众', '参会者', '来宾', '会员', '用户'];
    let html = '';
    for (let r = 0; r < rows; r++) {
      html += '<div class="mv-seat-row">';
      for (let c = 0; c < perRow && (r * perRow + c) < total; c++) {
        const idx = r * perRow + c;
        const icon = icons[idx % icons.length];
        const name = names[idx % names.length] + (idx + 1);
        html += `<div class="mv-seat"><span class="mv-avatar mv-audience">${icon}</span><span class="mv-name">${name}</span></div>`;
      }
      html += '</div>';
    }
    return html;
  }

  function renderBooths() {
    if (!state.booth.cards || state.booth.cards.length === 0) return '';
    const layout = state.booth.layout;
    const gap = state.booth.gap;
    const radius = state.booth.radius;
    let html = `<div class="mv-booth-grid" style="gap:${gap}px">`;
    state.booth.cards.forEach((card, i) => {
      const colors = ['#6c5ce7', '#00cec9', '#e74c3c', '#f39c12', '#2ecc71', '#e84393'];
      const color = card.color || colors[i % colors.length];
      html += `
        <a class="mv-booth-card" href="${card.url || '#'}" target="_blank" style="border-radius:${radius}px;border-left:4px solid ${color}">
          <div class="mv-booth-title">${card.title || '展台'}</div>
          <div class="mv-booth-link">${card.url ? '🔗 访问链接' : '暂无链接'}</div>
        </a>
      `;
    });
    html += '</div>';
    return html;
  }

  function renderHotspots() {
    if (!state.guide.hotspots || state.guide.hotspots.length === 0) return '';
    let html = '<div class="mv-hotspot-list">';
    state.guide.hotspots.forEach(h => {
      if (h.name) {
        html += `<a class="mv-hotspot-chip" href="${h.url || '#'}" ${h.url ? 'target="_blank"' : ''}>📍 ${h.name}</a>`;
      }
    });
    html += '</div>';
    return html;
  }

  function renderAgendaBar() {
    if (!state.agenda.items || state.agenda.items.length === 0) return '';
    let html = '<div class="mv-agenda-scroll">';
    state.agenda.items.forEach(item => {
      if (item.name) {
        html += `<span class="mv-agenda-chip"><strong>${item.time}</strong> ${item.name}</span>`;
      }
    });
    html += '</div>';
    return html;
  }

  function bindOverlayEvents() {
    const handBtn = document.getElementById('mv-hand-btn');
    if (handBtn) {
      handBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'handraise', data: { name: '观众' + Math.floor(Math.random() * 50 + 1) } });
        showToast('✋ 已举手');
      });
    }

    const applauseBtn = document.getElementById('mv-applause-btn');
    if (applauseBtn) {
      applauseBtn.addEventListener('click', () => {
        triggerApplause(3);
      });
    }

    const questionBtn = document.getElementById('mv-question-btn');
    if (questionBtn) {
      questionBtn.addEventListener('click', () => {
        const modal = document.getElementById('mv-question-modal');
        if (modal) modal.classList.remove('hidden');
      });
    }

    const questionCancel = document.getElementById('mv-question-cancel');
    if (questionCancel) {
      questionCancel.addEventListener('click', () => {
        document.getElementById('mv-question-modal').classList.add('hidden');
      });
    }

    const questionSubmit = document.getElementById('mv-question-submit');
    if (questionSubmit) {
      questionSubmit.addEventListener('click', () => {
        const input = document.getElementById('mv-question-input');
        if (input && input.value.trim()) {
          chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'question', data: { content: input.value.trim() } });
          analytics.questions++;
          showToast('✅ 问题已提交');
          document.getElementById('mv-question-modal').classList.add('hidden');
          input.value = '';
        }
      });
    }
  }

  function triggerApplause(duration) {
    const container = document.getElementById(`${NAMESPACE}-overlay`);
    if (!container) return;
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'mv-applause-particle';
      particle.textContent = ['👏', '🎉', '✨', '🌟'][Math.floor(Math.random() * 4)];
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDuration = (1 + Math.random() * duration) + 's';
      particle.style.animationDelay = Math.random() * 0.5 + 's';
      particle.style.fontSize = (14 + Math.random() * 18) + 'px';
      container.appendChild(particle);
      setTimeout(() => particle.remove(), (duration + 1) * 1000);
    }
  }

  function startCountdown() {
    const el = document.getElementById('mv-countdown');
    if (!el || !state.agenda.countdownStart || !state.agenda.countdownVisible) {
      if (el) el.style.display = 'none';
      return;
    }

    const target = new Date(state.agenda.countdownStart).getTime();
    if (isNaN(target)) return;

    function update() {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        el.textContent = '🎉 进行中';
        if (countdownInterval) clearInterval(countdownInterval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${state.agenda.countdownTitle} ⏱ ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    update();
    countdownInterval = setInterval(update, 1000);
  }

  function startDanmaku() {
    const layer = document.getElementById('mv-danmaku-layer');
    if (!layer) return;

    const messages = [
      '太棒了！', '说得对！', '学到了', '👍', '非常有启发',
      '感谢分享！', '这个观点很好', '支持！', '期待更多', '👏👏👏',
      '干货满满', '收货很大', '厉害了', '继续加油！', '讲得好！'
    ];

    const speedMap = { slow: 12, normal: 8, fast: 5 };
    const duration = speedMap[state.interact.danmakuSpeed] || 8;

    danmakuInterval = setInterval(() => {
      if (!isActive) return;
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const danmaku = document.createElement('div');
      danmaku.className = 'mv-danmaku-item';
      danmaku.textContent = msg;
      danmaku.style.top = (5 + Math.random() * 80) + '%';
      danmaku.style.animationDuration = duration + 's';
      danmaku.style.opacity = state.interact.danmakuOpacity / 100;
      layer.appendChild(danmaku);
      setTimeout(() => danmaku.remove(), duration * 1000);
    }, 1500);
  }

  function playBgm(url, volume) {
    if (audioEl) {
      audioEl.pause();
    }
    audioEl = new Audio(url);
    audioEl.volume = volume;
    audioEl.loop = true;
    audioEl.play().catch(() => {});
  }

  function showToast(text) {
    const container = document.getElementById(`${NAMESPACE}-overlay`);
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'mv-toast';
    toast.textContent = text;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function showVote(data) {
    const modal = document.getElementById('mv-vote-modal');
    const questionEl = document.getElementById('mv-vote-question');
    const optionsEl = document.getElementById('mv-vote-options');
    const resultsEl = document.getElementById('mv-vote-results');
    if (!modal || !questionEl || !optionsEl) return;

    questionEl.textContent = data.question;
    optionsEl.innerHTML = '';
    resultsEl.classList.add('hidden');

    data.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'mv-vote-option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        optionsEl.querySelectorAll('.mv-vote-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        setTimeout(() => {
          showVoteResults(data, i);
        }, 1000);
      });
      optionsEl.appendChild(btn);
    });

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('hidden'), 30000);
  }

  function showVoteResults(data, votedIndex) {
    const optionsEl = document.getElementById('mv-vote-options');
    const resultsEl = document.getElementById('mv-vote-results');
    if (!resultsEl) return;

    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '';
    data.options.forEach((opt, i) => {
      const pct = Math.floor(Math.random() * 60 + 10);
      const bar = document.createElement('div');
      bar.className = 'mv-vote-result-bar';
      bar.innerHTML = `<span class="mv-vote-result-label">${opt}</span><div class="mv-vote-result-track"><div class="mv-vote-result-fill" style="width:${pct}%;${i === votedIndex ? 'background:var(--mv-accent)' : ''}"></div></div><span class="mv-vote-result-pct">${pct}%</span>`;
      resultsEl.appendChild(bar);
    });
  }

  function startAnalyticsPing() {
    setInterval(() => {
      const elapsed = Math.floor((Date.now() - joinTime) / 60000);
      analytics.avgDuration = Math.max(analytics.avgDuration, elapsed);
      analytics.interactions += Math.random() > 0.7 ? 1 : 0;
      chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'analytics', data: analytics });
    }, 10000);
  }

  function handleNarrate(data) {
    if ('speechSynthesis' in window && data.text) {
      const utterance = new SpeechSynthesisUtterance(data.text);
      utterance.lang = 'zh-CN';
      utterance.rate = data.rate || 1;
      const voices = speechSynthesis.getVoices();
      const match = voices.find(v => v.name === data.voice);
      if (match) utterance.voice = match;
      speechSynthesis.speak(utterance);
      showToast('🎙️ 口播中…');
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.source !== 'metavenue-popup') return;

    switch (msg.action) {
      case 'activate':
        activate(msg.data);
        break;
      case 'deactivate':
        deactivate();
        break;
      case 'updateTheme':
        if (state) {
          state.space.theme = msg.data.theme;
          injectDynamicStyle(msg.data.theme);
        }
        break;
      case 'updateSeats':
        if (state) {
          state.seats = { ...state.seats, ...msg.data };
          render();
        }
        break;
      case 'bindLive':
        if (state) {
          state.agenda.liveUrl = msg.data.url;
          state.agenda.liveBound = true;
          render();
        }
        break;
      case 'applause':
        triggerApplause(msg.data.duration || 5);
        analytics.interactions++;
        break;
      case 'startVote':
        showVote(msg.data);
        analytics.interactions++;
        break;
      case 'toggleHandraise':
        if (state) state.interact.handraiseEnabled = msg.data.enabled;
        break;
      case 'updateDanmaku':
        if (state) {
          state.interact.danmakuEnabled = msg.data.enabled;
          state.interact.danmakuSpeed = msg.data.speed;
          state.interact.danmakuOpacity = msg.data.opacity;
          if (danmakuInterval) clearInterval(danmakuInterval);
          if (msg.data.enabled) startDanmaku();
        }
        break;
      case 'updateBooth':
        if (state) {
          state.booth = { ...state.booth, ...msg.data };
          render();
        }
        break;
      case 'narrate':
        handleNarrate(msg.data);
        break;
      case 'playBgm':
        playBgm(msg.data.url, msg.data.volume || 0.5);
        break;
    }
  });
})();
