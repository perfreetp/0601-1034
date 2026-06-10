(function () {
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  const PANELS = ['space', 'seats', 'agenda', 'interact', 'booth', 'guide', 'review'];
  const BOOTH_COLORS = ['#6c5ce7', '#00cec9', '#e74c3c', '#f39c12', '#2ecc71', '#e84393'];
  const HOTSPOT_ICONS = ['📍', '🎯', '⭐', '🚪', '🎁', '☕', '📚', '🎤', '🎨', '🔗'];
  const DEFAULT_AGENDA = [
    { time: '14:00', name: '开场致辞' },
    { time: '14:30', name: '主题演讲' }
  ];
  const DEFAULT_BOOTHS = [
    { title: '产品展示', url: '', color: '#6c5ce7' },
    { title: '技术白皮书', url: '', color: '#00cec9' }
  ];
  const DEFAULT_HOTSPOTS = [
    { name: '主舞台', url: '', desc: '活动主会场，精彩节目在此上演', icon: '🎤', x: 20, y: 35 },
    { name: '休息区', url: '', desc: '茶歇、交流、自由互动', icon: '☕', x: 75, y: 60 }
  ];
  const DEFAULT_NARRATIONS = [
    { time: '14:00', text: '欢迎各位来到今天的元宇宙会场，让我们开始精彩的活动！' }
  ];

  let state = {
    activated: false,
    _listInitialized: false,
    space: { theme: 'conference', posterUrl: '', bgmUrl: '', bgmVolume: 50 },
    seats: { avatarStyle: 'pixel', layout: 'theater', count: 50, perRow: 10, vipEnabled: true, vipCount: 5, vipLabel: '嘉宾席' },
    agenda: {
      liveUrl: '', liveBound: false, countdownStart: '', countdownTitle: '活动开始',
      countdownVisible: true, items: [], notifyEnabled: true, notifyAdvance: 5
    },
    interact: { applauseDuration: '5', handraiseEnabled: true, danmakuEnabled: true, danmakuSpeed: 'normal', danmakuOpacity: 80 },
    booth: { layout: 'grid', cards: [], radius: 12, gap: 16 },
    guide: { hotspots: [], narrations: [], narrationAutoplay: true, ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsRate: 100 },
    review: { participants: 0, avgDuration: 0, interactions: 0, questions: 0, logs: [], questionList: [] }
  };

  let currentAnalytics = {
    participants: 0, avgDuration: 0, interactions: 0, questions: 0,
    logs: [], questionList: []
  };

  let filterState = {
    type: 'all',
    timeRange: 'all',
    startHHMM: '',
    endHHMM: ''
  };

  function loadState() {
    return new Promise(resolve => {
      chrome.storage.local.get(['metavenue_state', 'metavenue_analytics'], data => {
        if (data.metavenue_state) {
          state = deepMerge(state, data.metavenue_state);
        }
        if (data.metavenue_analytics) {
          currentAnalytics = { ...currentAnalytics, ...data.metavenue_analytics };
        }
        resolve();
      });
    });
  }

  function deepMerge(target, source) {
    const result = {};
    for (const key of Object.keys(target)) {
      if (source[key] === undefined) {
        result[key] = target[key];
      } else if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    for (const key of Object.keys(source)) {
      if (target[key] === undefined) {
        result[key] = source[key];
      }
    }
    return result;
  }

  function saveState() {
    state._listInitialized = true;
    chrome.storage.local.set({ metavenue_state: state });
  }

  function collectCurrentState() {
    try {
      const themeCard = $('.theme-card.selected');
      if (themeCard) state.space.theme = themeCard.dataset.theme;

      state.space.posterUrl = $('#poster-url').value.trim();
      state.space.bgmUrl = $('#bgm-url').value.trim();
      state.space.bgmVolume = parseInt($('#bgm-volume').value) || 50;

      const avatarCard = $('.avatar-style-card.selected');
      if (avatarCard) state.seats.avatarStyle = avatarCard.dataset.style;
      const layoutCard = $('.layout-card[data-layout].selected');
      if (layoutCard) state.seats.layout = layoutCard.dataset.layout;
      state.seats.count = parseInt($('#seat-count').value) || 50;
      state.seats.perRow = parseInt($('#seats-per-row').value) || 10;
      state.seats.vipEnabled = $('#vip-enabled').checked;
      state.seats.vipCount = parseInt($('#vip-count').value) || 5;
      state.seats.vipLabel = $('#vip-label').value.trim();

      state.agenda.liveUrl = $('#live-url').value.trim();
      state.agenda.liveBound = !$('#live-status').classList.contains('hidden');
      state.agenda.countdownStart = $('#countdown-start').value;
      state.agenda.countdownTitle = $('#countdown-title').value.trim() || '活动开始';
      state.agenda.countdownVisible = $('#countdown-visible').checked;

      state.agenda.items = [];
      $$('.agenda-item').forEach(item => {
        const timeInput = $('.agenda-time input', item);
        const nameInput = $('.agenda-name input', item);
        const time = timeInput ? timeInput.value.trim() : '';
        const name = nameInput ? nameInput.value.trim() : '';
        if (time || name) {
          state.agenda.items.push({ time, name });
        }
      });

      state.agenda.notifyEnabled = $('#session-notify').checked;
      state.agenda.notifyAdvance = parseInt($('#notify-advance').value) || 5;

      state.interact.applauseDuration = $('#applause-duration').value;
      state.interact.handraiseEnabled = $('#handraise-enabled').checked;
      state.interact.danmakuEnabled = $('#danmaku-enabled').checked;
      state.interact.danmakuSpeed = $('#danmaku-speed').value;
      state.interact.danmakuOpacity = parseInt($('#danmaku-opacity').value) || 80;

      const boothLayout = $('.layout-card[data-booth-layout].selected');
      if (boothLayout) state.booth.layout = boothLayout.dataset.boothLayout;

      state.booth.cards = [];
      $$('.booth-card-item').forEach(item => {
        const titleInput = $('.booth-title', item);
        const urlInput = $('.booth-url', item);
        const colorEl = $('.booth-card-color', item);
        const title = titleInput ? titleInput.value.trim() : '';
        const url = urlInput ? urlInput.value.trim() : '';
        const color = colorEl ? colorEl.style.background : '';
        if (title || url) {
          state.booth.cards.push({ title, url, color });
        }
      });

      state.booth.radius = parseInt($('#booth-radius').value) || 12;
      state.booth.gap = parseInt($('#booth-gap').value) || 16;

      state.guide.hotspots = [];
      $$('.hotspot-item').forEach(item => {
        const nameInput = $('.hotspot-name', item);
        const urlInput = $('.hotspot-url', item);
        const descInput = $('.hotspot-desc', item);
        const iconSel = $('.hotspot-icon', item);
        const xInput = $('.hotspot-x', item);
        const yInput = $('.hotspot-y', item);
        const name = nameInput ? nameInput.value.trim() : '';
        const url = urlInput ? urlInput.value.trim() : '';
        const desc = descInput ? descInput.value.trim() : '';
        const icon = iconSel ? iconSel.value : '📍';
        const x = xInput ? (parseFloat(xInput.value) || 0) : 50;
        const y = yInput ? (parseFloat(yInput.value) || 0) : 50;
        if (name || url || desc) {
          state.guide.hotspots.push({ name, url, desc, icon, x, y });
        }
      });

      state.guide.narrations = [];
      $$('.narration-item').forEach((item, idx) => {
        const timeInput = $('.narration-time input', item);
        const textarea = $('.form-textarea', item);
        const time = timeInput ? timeInput.value.trim() : '';
        const text = textarea ? textarea.value.trim() : '';
        if (time || text) {
          state.guide.narrations.push({ time, text, order: idx + 1 });
        }
      });

      const autoplayEl = $('#narration-autoplay');
      state.guide.narrationAutoplay = autoplayEl ? autoplayEl.checked : true;
      state.guide.ttsVoice = $('#tts-voice').value;
      state.guide.ttsRate = parseInt($('#tts-rate').value) || 100;

      saveState();
    } catch (e) {
      console.error('[MetaVenue] collectCurrentState error:', e);
    }
  }

  function initNavigation() {
    $$('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.panel').forEach(p => p.classList.remove('active'));
        $(`#panel-${btn.dataset.panel}`).classList.add('active');
        if (btn.dataset.panel === 'review') refreshReviewPanel();
      });
    });
  }

  function initSpacePanel() {
    $$('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('.theme-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        collectCurrentState();
        sendToContent('updateTheme', { theme: card.dataset.theme });
      });
    });

    $('#btn-poster-preview').addEventListener('click', () => {
      const url = $('#poster-url').value.trim();
      const box = $('#poster-preview-box');
      if (url) {
        box.innerHTML = `<img src="${url}" alt="海报预览">`;
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
      }
      collectCurrentState();
    });

    $('#btn-bgm-play').addEventListener('click', () => {
      const url = $('#bgm-url').value.trim();
      if (url) {
        sendToContent('playBgm', { url, volume: state.space.bgmVolume / 100 });
      }
      collectCurrentState();
    });

    $('#bgm-volume').addEventListener('input', e => {
      $('#bgm-volume-val').textContent = e.target.value + '%';
      collectCurrentState();
    });
  }

  function initSeatsPanel() {
    $$('.avatar-style-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('.avatar-style-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        collectCurrentState();
        sendToContent('updateSeats', state.seats);
      });
    });

    $$('.layout-card[data-layout]').forEach(card => {
      card.addEventListener('click', () => {
        $$('.layout-card[data-layout]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        collectCurrentState();
        sendToContent('updateSeats', state.seats);
      });
    });

    $$('input, select', $('#panel-seats')).forEach(el => {
      el.addEventListener('change', () => {
        collectCurrentState();
        sendToContent('updateSeats', state.seats);
      });
      el.addEventListener('input', () => {
        if (el.id === 'seat-count' || el.id === 'seats-per-row') {
          collectCurrentState();
          sendToContent('updateSeats', state.seats);
        }
      });
    });

    $('#vip-enabled').addEventListener('change', e => {
      $('#vip-settings').style.display = e.target.checked ? 'flex' : 'none';
      collectCurrentState();
      sendToContent('updateSeats', state.seats);
    });
  }

  function initAgendaPanel() {
    $('#btn-live-bind').addEventListener('click', () => {
      const url = $('#live-url').value.trim();
      if (url) {
        state.agenda.liveBound = true;
        $('#live-status').classList.remove('hidden');
        sendToContent('bindLive', { url });
      }
      collectCurrentState();
    });

    $('#btn-add-agenda').addEventListener('click', () => {
      addAgendaItem('', '');
      collectCurrentState();
    });

    $$('input, select, textarea', $('#panel-agenda')).forEach(el => {
      el.addEventListener('change', () => collectCurrentState());
      el.addEventListener('input', () => {
        if (el.closest('.agenda-item')) collectCurrentState();
      });
    });
  }

  function addAgendaItem(time, name) {
    const list = $('#agenda-items');
    const item = document.createElement('div');
    item.className = 'agenda-item';
    item.innerHTML = `
      <div class="agenda-time"><input type="text" class="form-input agenda-input" placeholder="时间" value="${escapeHtml(time)}"></div>
      <div class="agenda-name"><input type="text" class="form-input agenda-input" placeholder="环节名称" value="${escapeHtml(name)}"></div>
      <button class="btn-icon btn-remove" title="删除">✕</button>
    `;
    list.appendChild(item);
    bindAgendaItem(item);
  }

  function bindAgendaItem(item) {
    const btn = $('.btn-remove', item);
    if (btn) {
      btn.addEventListener('click', () => {
        item.remove();
        collectCurrentState();
      });
    }
    $$('input', item).forEach(inp => {
      inp.addEventListener('change', () => collectCurrentState());
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function initInteractPanel() {
    $('#btn-applause').addEventListener('click', () => {
      collectCurrentState();
      sendToContent('applause', { duration: parseInt(state.interact.applauseDuration) });
      addLog('applause', '主持人发起鼓掌');
    });

    $('#handraise-enabled').addEventListener('change', e => {
      const queue = $('#handraise-queue');
      if (e.target.checked) {
        queue.classList.remove('hidden');
      } else {
        queue.classList.add('hidden');
      }
      collectCurrentState();
      sendToContent('toggleHandraise', { enabled: e.target.checked });
    });

    $('#btn-add-vote-option').addEventListener('click', () => {
      const container = $('#vote-options');
      const idx = container.children.length + 1;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-input vote-option';
      input.placeholder = `选项 ${idx}`;
      container.appendChild(input);
    });

    $('#btn-start-vote').addEventListener('click', () => {
      const question = $('#vote-question').value.trim();
      const options = $$('.vote-option').map(i => i.value.trim()).filter(Boolean);
      if (question && options.length >= 2) {
        collectCurrentState();
        sendToContent('startVote', { question, options });
        addLog('vote', `投票: ${question}`);
      }
    });

    $('#danmaku-opacity').addEventListener('input', e => {
      $('#danmaku-opacity-val').textContent = e.target.value + '%';
      collectCurrentState();
      sendToContent('updateDanmaku', {
        enabled: state.interact.danmakuEnabled,
        speed: state.interact.danmakuSpeed,
        opacity: parseInt(e.target.value) / 100
      });
    });

    $('#danmaku-speed').addEventListener('change', () => {
      collectCurrentState();
      sendToContent('updateDanmaku', {
        enabled: state.interact.danmakuEnabled,
        speed: state.interact.danmakuSpeed,
        opacity: state.interact.danmakuOpacity / 100
      });
    });

    $('#danmaku-enabled').addEventListener('change', () => {
      collectCurrentState();
      sendToContent('updateDanmaku', {
        enabled: state.interact.danmakuEnabled,
        speed: state.interact.danmakuSpeed,
        opacity: state.interact.danmakuOpacity / 100
      });
    });
  }

  function initBoothPanel() {
    $$('input', $('#panel-booth')).forEach(el => {
      el.addEventListener('change', () => collectCurrentState());
      el.addEventListener('input', () => {
        if (el.id === 'booth-radius') $('#booth-radius-val').textContent = el.value + 'px';
        if (el.id === 'booth-gap') $('#booth-gap-val').textContent = el.value + 'px';
        if (el.closest('.booth-card-item')) collectCurrentState();
      });
    });

    $$('.layout-card[data-booth-layout]').forEach(card => {
      card.addEventListener('click', () => {
        $$('.layout-card[data-booth-layout]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        collectCurrentState();
        sendToContent('updateBooth', state.booth);
      });
    });

    $('#btn-add-booth').addEventListener('click', () => {
      const list = $('#booth-cards');
      const color = BOOTH_COLORS[list.children.length % BOOTH_COLORS.length];
      addBoothCard('', '', color);
      collectCurrentState();
    });
  }

  function addBoothCard(title, url, color) {
    const list = $('#booth-cards');
    const item = document.createElement('div');
    item.className = 'booth-card-item';
    item.innerHTML = `
      <div class="booth-card-color" style="background:${color}"></div>
      <input type="text" class="form-input booth-title" placeholder="展台名称" value="${escapeHtml(title)}">
      <input type="text" class="form-input booth-url" placeholder="链接 URL" value="${escapeHtml(url)}">
      <button class="btn-icon btn-remove" title="删除">✕</button>
    `;
    list.appendChild(item);
    bindBoothCard(item);
  }

  function bindBoothCard(item) {
    const btn = $('.btn-remove', item);
    if (btn) {
      btn.addEventListener('click', () => {
        item.remove();
        collectCurrentState();
        sendToContent('updateBooth', state.booth);
      });
    }
    $$('input', item).forEach(inp => {
      inp.addEventListener('change', () => {
        collectCurrentState();
        sendToContent('updateBooth', state.booth);
      });
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function initGuidePanel() {
    $('#btn-add-hotspot').addEventListener('click', () => {
      const list = $('#hotspot-list');
      const icon = HOTSPOT_ICONS[list.children.length % HOTSPOT_ICONS.length];
      addHotspot('', '', '', icon, 50, 50);
      collectCurrentState();
    });

    $('#btn-add-narration').addEventListener('click', () => {
      addNarration('', '');
      collectCurrentState();
    });

    $('#btn-play-all-narration').addEventListener('click', () => {
      collectCurrentState();
      sendToContent('narrateAll', {
        narrations: state.guide.narrations.filter(n => n.text),
        voice: state.guide.ttsVoice,
        rate: state.guide.ttsRate / 100
      });
    });

    $('#tts-rate').addEventListener('input', e => {
      const rate = (parseInt(e.target.value) / 100).toFixed(1);
      $('#tts-rate-val').textContent = rate + 'x';
      collectCurrentState();
    });

    $$('input, select, textarea', $('#panel-guide')).forEach(el => {
      el.addEventListener('change', () => collectCurrentState());
      el.addEventListener('input', () => {
        if (el.closest('.hotspot-item') || el.closest('.narration-item')) {
          collectCurrentState();
        }
      });
    });
  }

  function addHotspot(name, url, desc, icon, x, y) {
    const list = $('#hotspot-list');
    const item = document.createElement('div');
    const iconOptions = HOTSPOT_ICONS.map(ic => `<option value="${ic}"${ic === icon ? ' selected' : ''}>${ic}</option>`).join('');
    item.className = 'hotspot-item';
    item.innerHTML = `
      <select class="hotspot-icon">${iconOptions}</select>
      <input type="text" class="form-input hotspot-name" placeholder="热点名称" value="${escapeHtml(name)}">
      <input type="text" class="form-input hotspot-url" placeholder="跳转 URL" value="${escapeHtml(url)}">
      <div class="hotspot-position">
        <label>X</label><input type="number" class="form-input sm hotspot-x" min="0" max="100" value="${x}">
        <label>Y</label><input type="number" class="form-input sm hotspot-y" min="0" max="100" value="${y}">
      </div>
      <input type="text" class="form-input hotspot-desc" placeholder="说明 / 介绍文字（弹出显示）" value="${escapeHtml(desc)}">
      <button class="btn-icon btn-remove" title="删除">✕</button>
    `;
    list.appendChild(item);
    bindHotspotItem(item);
  }

  function bindHotspotItem(item) {
    const btn = $('.btn-remove', item);
    if (btn) {
      btn.addEventListener('click', () => {
        item.remove();
        collectCurrentState();
      });
    }
    $$('input, select', item).forEach(inp => {
      inp.addEventListener('change', () => collectCurrentState());
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function addNarration(time, text) {
    const list = $('#narration-list');
    const order = list.children.length + 1;
    const item = document.createElement('div');
    item.className = 'narration-item';
    item.innerHTML = `
      <div class="narration-header">
        <span class="narration-order">#${order}</span>
        <span class="narration-time"><input type="text" class="form-input sm" placeholder="时间" value="${escapeHtml(time)}"></span>
        <button class="btn-icon btn-play-narration" title="播放">▶</button>
      </div>
      <textarea class="form-textarea" placeholder="口播内容">${escapeHtml(text)}</textarea>
    `;
    list.appendChild(item);
    bindNarrationItem(item);
  }

  function bindNarrationItem(item) {
    const btn = $('.btn-play-narration', item);
    if (btn) {
      btn.addEventListener('click', () => {
        const textarea = $('.form-textarea', item);
        const text = textarea ? textarea.value.trim() : '';
        if (text) {
          sendToContent('narrate', {
            text,
            voice: state.guide.ttsVoice,
            rate: state.guide.ttsRate / 100
          });
        }
      });
    }
    const removeBtn = $('.btn-remove', item);
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        item.remove();
        reorderNarrations();
        collectCurrentState();
      });
    }
    $$('input, textarea', item).forEach(inp => {
      inp.addEventListener('change', () => collectCurrentState());
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function reorderNarrations() {
    $$('.narration-item').forEach((item, idx) => {
      const badge = $('.narration-order', item);
      if (badge) badge.textContent = `#${idx + 1}`;
    });
  }

  function initReviewPanel() {
    $('#filter-time').addEventListener('change', e => {
      filterState.timeRange = e.target.value;
      const custom = $('#filter-custom-group');
      custom.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
      refreshReviewPanel();
    });
    $('#filter-start').addEventListener('change', e => {
      filterState.startHHMM = e.target.value;
      refreshReviewPanel();
    });
    $('#filter-end').addEventListener('change', e => {
      filterState.endHHMM = e.target.value;
      refreshReviewPanel();
    });
    $$('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        filterState.type = chip.dataset.type;
        refreshReviewPanel();
      });
    });

    $('#btn-refresh-data').addEventListener('click', () => {
      refreshReviewPanel();
    });

    $('#btn-export-csv').addEventListener('click', () => {
      collectCurrentState();
      const filtered = applyFilter(currentAnalytics);
      const csv = generateCSV(filtered);
      downloadFile(csv, 'metavenue-review.csv', 'text/csv;charset=utf-8');
    });

    $('#btn-export-json').addEventListener('click', () => {
      collectCurrentState();
      const filtered = applyFilter(currentAnalytics);
      const data = {
        participants: filtered.participants,
        avgDuration: filtered.avgDuration,
        interactions: filtered.logs.length,
        questions: filtered.questionList.length,
        filter: { ...filterState, appliedAt: new Date().toISOString() },
        logs: filtered.logs,
        questionList: filtered.questionList,
        exportedAt: new Date().toISOString()
      };
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, 'metavenue-review.json', 'application/json');
    });
  }

  function applyFilter(analytics) {
    let logs = (analytics.logs || []).slice();
    let questions = (analytics.questionList || []).slice();

    if (filterState.type !== 'all') {
      logs = logs.filter(l => l.type === filterState.type);
      if (filterState.type === 'question') {
        questions = questions.filter(q => q.type === filterState.type || true);
      } else {
        questions = [];
      }
    }

    const now = new Date();
    if (filterState.timeRange !== 'all') {
      if (filterState.timeRange === 'custom') {
        const [sh, sm] = (filterState.startHHMM || '00:00').split(':').map(Number);
        const [eh, em] = (filterState.endHHMM || '23:59').split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        const inRange = t => {
          const [h, m] = (t || '').split(':').slice(0, 2).map(Number);
          const tm = h * 60 + m;
          if (startMin <= endMin) return tm >= startMin && tm <= endMin;
          return tm >= startMin || tm <= endMin;
        };
        logs = logs.filter(l => inRange(l.time));
        questions = questions.filter(q => inRange(q.time));
      } else {
        const minsAgo = parseInt(filterState.timeRange);
        const threshold = new Date(now.getTime() - minsAgo * 60 * 1000);
        const afterThreshold = t => {
          const [h, m, s] = (t || '00:00:00').split(':').map(Number);
          const d = new Date();
          d.setHours(h, m, s, 0);
          return d >= threshold;
        };
        logs = logs.filter(l => afterThreshold(l.time));
        questions = questions.filter(q => afterThreshold(q.time));
      }
    }

    return {
      participants: analytics.participants || 0,
      avgDuration: analytics.avgDuration || 0,
      interactions: logs.length,
      questions: questions.length,
      logs,
      questionList: questions
    };
  }

  function refreshReviewPanel() {
    chrome.storage.local.get('metavenue_analytics', data => {
      const analytics = data.metavenue_analytics || {
        participants: 0, avgDuration: 0, interactions: 0, questions: 0,
        logs: [], questionList: []
      };
      currentAnalytics = analytics;

      const filtered = applyFilter(analytics);

      $('#stat-participants').textContent = filtered.participants;
      $('#stat-duration').textContent = filtered.avgDuration + 'm';
      $('#stat-interactions').textContent = filtered.interactions;
      $('#stat-questions').textContent = filtered.questions;

      const logContainer = $('#interaction-log');
      $('#log-count').textContent = `共 ${filtered.logs.length} 条`;
      if (filtered.logs && filtered.logs.length > 0) {
        logContainer.innerHTML = filtered.logs.map(l => `
          <div class="log-item">
            <span class="log-time">${l.time}</span>
            <span class="log-type ${l.type}">${l.typeLabel}</span>
            <span class="log-content">${escapeHtml(l.content)}</span>
          </div>
        `).join('');
      } else {
        logContainer.innerHTML = '<p class="log-empty">暂无符合条件的互动记录</p>';
      }

      const questionContainer = $('#question-list');
      $('#question-count').textContent = `共 ${filtered.questionList.length} 条`;
      if (filtered.questionList && filtered.questionList.length > 0) {
        questionContainer.innerHTML = filtered.questionList.map(q => `
          <div class="log-item">
            <span class="log-time">${q.time}</span>
            <span class="log-type question">提问</span>
            <span class="log-content">${escapeHtml(q.content)}</span>
          </div>
        `).join('');
      } else {
        questionContainer.innerHTML = '<p class="log-empty">暂无符合条件的提问记录</p>';
      }
    });
  }

  function addLog(type, content) {
    const typeLabels = { applause: '鼓掌', handraise: '举手', vote: '投票', question: '提问' };
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0') + ':' +
      now.getSeconds().toString().padStart(2, '0');
    const entry = { type, typeLabel: typeLabels[type] || type, content, time: timeStr };

    chrome.storage.local.get('metavenue_analytics', data => {
      const analytics = data.metavenue_analytics || {
        participants: 0, avgDuration: 0, interactions: 0, questions: 0,
        logs: [], questionList: []
      };
      analytics.logs.push(entry);
      analytics.interactions++;
      if (type === 'question') {
        analytics.questions++;
        analytics.questionList.push(entry);
      }
      currentAnalytics = analytics;
      chrome.storage.local.set({ metavenue_analytics: analytics });
    });
  }

  function generateCSV(filtered) {
    let csv = '\ufeff类型,时间,内容\n';
    if (filtered.logs && filtered.logs.length > 0) {
      filtered.logs.forEach(l => {
        const content = String(l.content).replace(/"/g, '""');
        csv += `${l.typeLabel},${l.time},"${content}"\n`;
      });
    }
    csv += '\n';
    csv += '指标,数值\n';
    csv += `参与人数,${filtered.participants}\n`;
    csv += `平均停留(分钟),${filtered.avgDuration}\n`;
    csv += `互动次数,${filtered.logs.length}\n`;
    csv += `提问数量,${filtered.questionList.length}\n`;
    csv += `筛选条件,类型=${filterState.type};时间范围=${filterState.timeRange}\n`;

    if (filtered.questionList && filtered.questionList.length > 0) {
      csv += '\n问题列表\n';
      csv += '时间,内容\n';
      filtered.questionList.forEach(q => {
        const content = String(q.content).replace(/"/g, '""');
        csv += `${q.time},"${content}"\n`;
      });
    }

    return csv;
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function sendToContent(action, data) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          source: 'metavenue-popup', action, data
        }).catch(() => {});
      }
    });
  }

  function initActivateButton() {
    const btn = $('#btn-activate');
    btn.addEventListener('click', () => {
      collectCurrentState();
      state.activated = !state.activated;
      saveState();
      if (state.activated) {
        btn.textContent = '✅ 会场运行中';
        btn.classList.add('active');
        sendToContent('activate', state);
      } else {
        btn.textContent = '🚀 启动会场';
        btn.classList.remove('active');
        sendToContent('deactivate', {});
      }
    });
  }

  function ensureDefaultListsIfNeeded() {
    if (state._listInitialized) return;
    if (!state.agenda.items || state.agenda.items.length === 0) {
      state.agenda.items = DEFAULT_AGENDA.slice();
    }
    if (!state.booth.cards || state.booth.cards.length === 0) {
      state.booth.cards = DEFAULT_BOOTHS.slice();
    }
    if (!state.guide.hotspots || state.guide.hotspots.length === 0) {
      state.guide.hotspots = DEFAULT_HOTSPOTS.slice();
    }
    if (!state.guide.narrations || state.guide.narrations.length === 0) {
      state.guide.narrations = DEFAULT_NARRATIONS.slice();
    }
  }

  function restoreUI() {
    ensureDefaultListsIfNeeded();

    if (state.space.theme) {
      $$('.theme-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.theme === state.space.theme);
      });
    }
    if (state.space.posterUrl) $('#poster-url').value = state.space.posterUrl;
    if (state.space.bgmUrl) $('#bgm-url').value = state.space.bgmUrl;
    if (state.space.bgmVolume) {
      $('#bgm-volume').value = state.space.bgmVolume;
      $('#bgm-volume-val').textContent = state.space.bgmVolume + '%';
    }

    if (state.seats.avatarStyle) {
      $$('.avatar-style-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.style === state.seats.avatarStyle);
      });
    }
    if (state.seats.layout) {
      $$('.layout-card[data-layout]').forEach(c => {
        c.classList.toggle('selected', c.dataset.layout === state.seats.layout);
      });
    }
    if (state.seats.count != null) $('#seat-count').value = state.seats.count;
    if (state.seats.perRow != null) $('#seats-per-row').value = state.seats.perRow;
    $('#vip-enabled').checked = !!state.seats.vipEnabled;
    $('#vip-settings').style.display = state.seats.vipEnabled ? 'flex' : 'none';
    if (state.seats.vipCount != null) $('#vip-count').value = state.seats.vipCount;
    if (state.seats.vipLabel) $('#vip-label').value = state.seats.vipLabel;

    if (state.agenda.liveUrl) $('#live-url').value = state.agenda.liveUrl;
    if (state.agenda.liveBound) $('#live-status').classList.remove('hidden');
    if (state.agenda.countdownStart) $('#countdown-start').value = state.agenda.countdownStart;
    if (state.agenda.countdownTitle) $('#countdown-title').value = state.agenda.countdownTitle;
    $('#countdown-visible').checked = !!state.agenda.countdownVisible;
    $('#session-notify').checked = !!state.agenda.notifyEnabled;
    if (state.agenda.notifyAdvance != null) $('#notify-advance').value = state.agenda.notifyAdvance;

    $('#agenda-items').innerHTML = '';
    (state.agenda.items || []).forEach(item => {
      addAgendaItem(item.time || '', item.name || '');
    });

    if (state.interact.applauseDuration) $('#applause-duration').value = state.interact.applauseDuration;
    $('#handraise-enabled').checked = !!state.interact.handraiseEnabled;
    $('#danmaku-enabled').checked = !!state.interact.danmakuEnabled;
    if (state.interact.danmakuSpeed) $('#danmaku-speed').value = state.interact.danmakuSpeed;
    if (state.interact.danmakuOpacity != null) {
      $('#danmaku-opacity').value = state.interact.danmakuOpacity;
      $('#danmaku-opacity-val').textContent = state.interact.danmakuOpacity + '%';
    }

    if (state.booth.layout) {
      $$('.layout-card[data-booth-layout]').forEach(c => {
        c.classList.toggle('selected', c.dataset.boothLayout === state.booth.layout);
      });
    }
    if (state.booth.radius != null) {
      $('#booth-radius').value = state.booth.radius;
      $('#booth-radius-val').textContent = state.booth.radius + 'px';
    }
    if (state.booth.gap != null) {
      $('#booth-gap').value = state.booth.gap;
      $('#booth-gap-val').textContent = state.booth.gap + 'px';
    }
    $('#booth-cards').innerHTML = '';
    (state.booth.cards || []).forEach((card, i) => {
      addBoothCard(card.title || '', card.url || '', card.color || BOOTH_COLORS[i % BOOTH_COLORS.length]);
    });

    $('#hotspot-list').innerHTML = '';
    (state.guide.hotspots || []).forEach(h => {
      addHotspot(h.name || '', h.url || '', h.desc || '', h.icon || '📍', h.x != null ? h.x : 50, h.y != null ? h.y : 50);
    });

    $('#narration-list').innerHTML = '';
    (state.guide.narrations || []).forEach(n => {
      addNarration(n.time || '', n.text || '');
    });
    if (state.guide.narrationAutoplay != null && $('#narration-autoplay')) {
      $('#narration-autoplay').checked = !!state.guide.narrationAutoplay;
    }
    if (state.guide.ttsVoice) $('#tts-voice').value = state.guide.ttsVoice;
    if (state.guide.ttsRate != null) {
      $('#tts-rate').value = state.guide.ttsRate;
      $('#tts-rate-val').textContent = (state.guide.ttsRate / 100).toFixed(1) + 'x';
    }

    if (state.activated) {
      const btn = $('#btn-activate');
      btn.textContent = '✅ 会场运行中';
      btn.classList.add('active');
    }
  }

  function listenForContentMessages() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.source !== 'metavenue-content') return;

      if (msg.action === 'handraise') {
        const queueItems = $('.queue-items');
        if (queueItems) {
          const item = document.createElement('div');
          item.className = 'queue-item';
          item.innerHTML = `<span>${escapeHtml(msg.data.name || '观众')}</span><button class="btn-icon" title="通过">✓</button>`;
          queueItems.appendChild(item);
          const okBtn = item.querySelector('.btn-icon');
          if (okBtn) okBtn.addEventListener('click', () => item.remove());
        }
        addLog('handraise', `${msg.data.name || '观众'} 举手`);
      }
      if (msg.action === 'question') {
        addLog('question', msg.data.content);
      }
      if (msg.action === 'analytics') {
        currentAnalytics = msg.data;
        chrome.storage.local.set({ metavenue_analytics: msg.data });
      }
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function init() {
    await loadState();
    initNavigation();
    initSpacePanel();
    initSeatsPanel();
    initAgendaPanel();
    initInteractPanel();
    initBoothPanel();
    initGuidePanel();
    initReviewPanel();
    initActivateButton();
    listenForContentMessages();
    restoreUI();
    saveState();
  }

  init();
})();
