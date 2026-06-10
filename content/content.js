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

  const DEFAULT_STATE = {
    activated: false,
    space: { theme: 'conference', posterUrl: '', bgmUrl: '', bgmVolume: 50 },
    seats: { avatarStyle: 'pixel', layout: 'theater', count: 50, perRow: 10, vipEnabled: true, vipCount: 5, vipLabel: '嘉宾席' },
    agenda: {
      liveUrl: '', liveBound: false, countdownStart: '', countdownTitle: '活动开始',
      countdownVisible: true, items: [], notifyEnabled: true, notifyAdvance: 5
    },
    interact: { applauseDuration: '5', handraiseEnabled: true, danmakuEnabled: true, danmakuSpeed: 'normal', danmakuOpacity: 80 },
    booth: { layout: 'grid', cards: [], radius: 12, gap: 16 },
    guide: { hotspots: [], narrations: [], ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsRate: 100 },
    review: { participants: 0, avgDuration: 0, interactions: 0, questions: 0, logs: [], questionList: [] }
  };

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const result = {};
    const allKeys = new Set([...Object.keys(target || {}), ...Object.keys(source || {})]);
    for (const key of allKeys) {
      const tVal = target ? target[key] : undefined;
      const sVal = source ? source[key] : undefined;
      if (sVal === undefined) {
        result[key] = tVal;
      } else if (typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)) {
        result[key] = deepMerge(tVal || {}, sVal);
      } else {
        result[key] = sVal;
      }
    }
    return result;
  }

  function activate(s) {
    state = deepMerge(DEFAULT_STATE, s);
    isActive = true;
    joinTime = Date.now();
    try {
      injectDynamicStyle(state.space.theme);
      render();
      startAnalyticsPing();
      syncAnalyticsToStorage();
    } catch (e) {
      console.error('[MetaVenue] activate error:', e);
    }
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
    const total = Math.min(state.seats.count || 50, 500);
    const perRow = state.seats.perRow || 10;
    const names = ['观众', '参会者', '来宾', '会员', '用户', '访客', '同学', '同仁'];
    const layout = state.seats.layout || 'theater';

    function makeSeat(idx, extraClass, extraStyle) {
      const icon = icons[idx % icons.length];
      const name = names[idx % names.length] + (idx + 1);
      const cls = 'mv-seat ' + (extraClass || '');
      const style = extraStyle ? ' style="' + extraStyle + '"' : '';
      return `<div class="${cls}"${style}><span class="mv-avatar mv-audience">${icon}</span><span class="mv-name">${name}</span></div>`;
    }

    let html = '';
    switch (layout) {
      case 'theater': {
        const rows = Math.ceil(total / perRow);
        html += '<div class="mv-seating-theater">';
        for (let r = 0; r < rows; r++) {
          const rowCount = Math.min(perRow, total - r * perRow);
          const offset = (perRow - rowCount) / 2;
          html += `<div class="mv-seat-row" style="padding-left:${offset * 34}px">`;
          for (let c = 0; c < rowCount; c++) {
            const idx = r * perRow + c;
            html += makeSeat(idx);
          }
          html += '</div>';
        }
        html += '</div>';
        break;
      }
      case 'roundtable': {
        const radius = 120 + Math.min(total, 80) * 2.5;
        const seatCount = Math.min(total, 60);
        html += `<div class="mv-seating-round" style="width:${radius * 2}px;height:${radius * 2}px">`;
        html += `<div class="mv-round-center">圆桌会场</div>`;
        for (let i = 0; i < seatCount; i++) {
          const angle = (i / seatCount) * 2 * Math.PI - Math.PI / 2;
          const x = radius + Math.cos(angle) * (radius - 30) - 25;
          const y = radius + Math.sin(angle) * (radius - 30) - 25;
          const rot = (angle * 180 / Math.PI) + 90;
          html += makeSeat(i, 'mv-round-seat',
            `left:${x}px;top:${y}px;transform:rotate(${rot}deg)`
          );
        }
        html += '</div>';
        if (total > 60) {
          html += `<div class="mv-seating-more">另有 ${total - 60} 位观众在其他区域...</div>`;
        }
        break;
      }
      case 'ushape': {
        const seatCount = Math.min(total, 80);
        const sideCount = Math.floor(seatCount / 4);
        const bottomCount = seatCount - sideCount * 2;
        const seatW = 44;
        const seatH = 48;
        const gap = 4;
        const width = bottomCount * (seatW + gap) + 2 * sideCount * (seatW + gap);
        const height = sideCount * (seatH + gap) + 60;
        html += `<div class="mv-seating-ushape" style="width:${width}px;height:${height}px">`;
        let idx = 0;
        for (let i = 0; i < sideCount && idx < seatCount; i++, idx++) {
          const y = i * (seatH + gap);
          html += makeSeat(idx, 'mv-ushape-seat mv-ushape-left',
            `left:0;top:${y}px;transform:rotate(20deg)`
          );
        }
        for (let i = 0; i < bottomCount && idx < seatCount; i++, idx++) {
          const x = sideCount * (seatW + gap) + i * (seatW + gap);
          html += makeSeat(idx, 'mv-ushape-seat mv-ushape-bottom',
            `left:${x}px;bottom:0`
          );
        }
        for (let i = sideCount - 1; i >= 0 && idx < seatCount; i--, idx++) {
          const y = i * (seatH + gap);
          html += makeSeat(idx, 'mv-ushape-seat mv-ushape-right',
            `right:0;top:${y}px;transform:rotate(-20deg)`
          );
        }
        html += '<div class="mv-ushape-stage">🎤 舞台</div>';
        html += '</div>';
        if (total > 80) {
          html += `<div class="mv-seating-more">另有 ${total - 80} 位观众在其他区域...</div>`;
        }
        break;
      }
      case 'classroom': {
        const rows = Math.ceil(total / perRow);
        const tableCount = Math.ceil(perRow / 3);
        html += '<div class="mv-seating-classroom">';
        for (let r = 0; r < rows; r++) {
          html += '<div class="mv-classroom-row">';
          for (let t = 0; t < tableCount; t++) {
            const startIdx = r * perRow + t * 3;
            const endIdx = Math.min(startIdx + 3, total);
            const tableSeats = [];
            for (let i = startIdx; i < endIdx; i++) {
              tableSeats.push(makeSeat(i, 'mv-classroom-seat'));
            }
            if (tableSeats.length > 0) {
              html += `<div class="mv-classroom-desk">${tableSeats.join('')}</div>`;
            }
          }
          html += '</div>';
        }
        html += '</div>';
        break;
      }
      default: {
        const rows = Math.ceil(total / perRow);
        html += '<div class="mv-seating-theater">';
        for (let r = 0; r < rows; r++) {
          html += '<div class="mv-seat-row">';
          for (let c = 0; c < perRow && (r * perRow + c) < total; c++) {
            const idx = r * perRow + c;
            html += makeSeat(idx);
          }
          html += '</div>';
        }
        html += '</div>';
      }
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
        try {
          const name = '观众' + Math.floor(Math.random() * 50 + 1);
          chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'handraise', data: { name } })
            .catch(() => {});
          addLog('handraise', name + ' 举手');
          showToast('✋ 已举手');
        } catch (e) {
          console.warn('[MetaVenue] handraise error:', e);
        }
      });
    }

    const applauseBtn = document.getElementById('mv-applause-btn');
    if (applauseBtn) {
      applauseBtn.addEventListener('click', () => {
        try {
          triggerApplause(3);
        } catch (e) {
          console.warn('[MetaVenue] applause error:', e);
        }
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
        try {
          const input = document.getElementById('mv-question-input');
          if (input && input.value.trim()) {
            const content = input.value.trim();
            chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'question', data: { content } })
              .catch(() => {});
            addLog('question', content);
            showToast('✅ 问题已提交');
            document.getElementById('mv-question-modal').classList.add('hidden');
            input.value = '';
          }
        } catch (e) {
          console.warn('[MetaVenue] question submit error:', e);
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

  function syncAnalyticsToStorage() {
    try {
      chrome.storage.local.set({ metavenue_analytics: analytics });
    } catch (e) {
      console.warn('[MetaVenue] sync analytics failed:', e);
    }
  }

  function addLog(type, content) {
    const typeLabels = { applause: '鼓掌', handraise: '举手', vote: '投票', question: '提问', enter: '入场', danmaku: '弹幕' };
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0') + ':' +
      now.getSeconds().toString().padStart(2, '0');
    const entry = { type, typeLabel: typeLabels[type] || type, content, time: timeStr };
    analytics.logs.push(entry);
    analytics.interactions++;
    if (type === 'question') {
      analytics.questions++;
      analytics.questionList.push(entry);
    }
    if (analytics.logs.length > 500) {
      analytics.logs = analytics.logs.slice(-300);
    }
    syncAnalyticsToStorage();
  }

  function startAnalyticsPing() {
    setInterval(() => {
      if (!isActive) return;
      try {
        const elapsed = Math.floor((Date.now() - joinTime) / 60000);
        analytics.avgDuration = Math.max(analytics.avgDuration, elapsed);
        analytics.participants = Math.max(analytics.participants, Math.floor(Math.random() * 30) + 20);
        syncAnalyticsToStorage();
        chrome.runtime.sendMessage({ source: 'metavenue-content', action: 'analytics', data: analytics })
          .catch(() => {});
      } catch (e) {
        console.warn('[MetaVenue] analytics ping error:', e);
      }
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

    try {
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
          addLog('applause', '主持人发起鼓掌');
          break;
        case 'startVote':
          showVote(msg.data);
          addLog('vote', '投票: ' + (msg.data.question || ''));
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
            state.booth = deepMerge(state.booth, msg.data);
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
    } catch (e) {
      console.error('[MetaVenue] message handler error:', e, msg);
    }
  });
})();
