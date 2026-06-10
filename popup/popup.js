(function () {
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

  const PANELS = ['space', 'seats', 'agenda', 'interact', 'booth', 'guide', 'review'];

  let state = {
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

  let currentAnalytics = {
    participants: 0, avgDuration: 0, interactions: 0, questions: 0,
    logs: [], questionList: []
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
        const name = nameInput ? nameInput.value.trim() : '';
        const url = urlInput ? urlInput.value.trim() : '';
        if (name || url) {
          state.guide.hotspots.push({ name, url });
        }
      });

      state.guide.narrations = [];
      $$('.narration-item').forEach(item => {
        const timeInput = $('.narration-time input', item);
        const textarea = $('.form-textarea', item);
        const time = timeInput ? timeInput.value.trim() : '';
        const text = textarea ? textarea.value.trim() : '';
        if (time || text) {
          state.guide.narrations.push({ time, text });
        }
      });

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

    $$('.agenda-item').forEach(bindAgendaItem);

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
      <div class="agenda-time"><input type="text" class="form-input agenda-input" placeholder="时间" value="${time}"></div>
      <div class="agenda-name"><input type="text" class="form-input agenda-input" placeholder="环节名称" value="${name}"></div>
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
      const colors = ['#6c5ce7', '#00cec9', '#e74c3c', '#f39c12', '#2ecc71', '#e84393'];
      const list = $('#booth-cards');
      const color = colors[list.children.length % colors.length];
      addBoothCard('', '', color);
      collectCurrentState();
    });

    $$('.booth-card-item').forEach(bindBoothCard);
  }

  function addBoothCard(title, url, color) {
    const list = $('#booth-cards');
    const item = document.createElement('div');
    item.className = 'booth-card-item';
    item.innerHTML = `
      <div class="booth-card-color" style="background:${color}"></div>
      <input type="text" class="form-input booth-title" placeholder="展台名称" value="${title}">
      <input type="text" class="form-input booth-url" placeholder="链接 URL" value="${url}">
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
      addHotspot('', '');
      collectCurrentState();
    });

    $$('.hotspot-item').forEach(bindHotspotItem);

    $('#btn-add-narration').addEventListener('click', () => {
      addNarration('', '');
      collectCurrentState();
    });

    $$('.narration-item').forEach(bindNarrationItem);

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

  function addHotspot(name, url) {
    const list = $('#hotspot-list');
    const item = document.createElement('div');
    item.className = 'hotspot-item';
    item.innerHTML = `
      <span class="hotspot-marker">📍</span>
      <input type="text" class="form-input hotspot-name" placeholder="热点名称" value="${name}">
      <input type="text" class="form-input hotspot-url" placeholder="跳转 URL" value="${url}">
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
    $$('input', item).forEach(inp => {
      inp.addEventListener('change', () => collectCurrentState());
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function addNarration(time, text) {
    const list = $('#narration-list');
    const item = document.createElement('div');
    item.className = 'narration-item';
    item.innerHTML = `
      <div class="narration-header">
        <span class="narration-time"><input type="text" class="form-input sm" placeholder="时间" value="${time}"></span>
        <button class="btn-icon btn-play-narration" title="播放">▶</button>
      </div>
      <textarea class="form-textarea" placeholder="口播内容">${text}</textarea>
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
        collectCurrentState();
      });
    }
    $$('input, textarea', item).forEach(inp => {
      inp.addEventListener('change', () => collectCurrentState());
      inp.addEventListener('input', () => collectCurrentState());
    });
  }

  function initReviewPanel() {
    $('#btn-export-csv').addEventListener('click', () => {
      collectCurrentState();
      const csv = generateCSV();
      downloadFile(csv, 'metavenue-review.csv', 'text/csv;charset=utf-8');
    });

    $('#btn-export-json').addEventListener('click', () => {
      collectCurrentState();
      const data = {
        participants: currentAnalytics.participants,
        avgDuration: currentAnalytics.avgDuration,
        interactions: currentAnalytics.interactions,
        questions: currentAnalytics.questions,
        logs: currentAnalytics.logs,
        questionList: currentAnalytics.questionList,
        exportedAt: new Date().toISOString()
      };
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, 'metavenue-review.json', 'application/json');
    });
  }

  function refreshReviewPanel() {
    chrome.storage.local.get('metavenue_analytics', data => {
      const analytics = data.metavenue_analytics || {
        participants: 0, avgDuration: 0, interactions: 0, questions: 0,
        logs: [], questionList: []
      };
      currentAnalytics = analytics;

      $('#stat-participants').textContent = analytics.participants;
      $('#stat-duration').textContent = analytics.avgDuration + 'm';
      $('#stat-interactions').textContent = analytics.interactions;
      $('#stat-questions').textContent = analytics.questions;

      const logContainer = $('#interaction-log');
      if (analytics.logs && analytics.logs.length > 0) {
        logContainer.innerHTML = analytics.logs.map(l => `
          <div class="log-item">
            <span class="log-time">${l.time}</span>
            <span class="log-type ${l.type}">${l.typeLabel}</span>
            <span class="log-content">${l.content}</span>
          </div>
        `).join('');
      } else {
        logContainer.innerHTML = '<p class="log-empty">暂无互动记录，启动会场后自动记录</p>';
      }

      const questionContainer = $('#question-list');
      if (analytics.questionList && analytics.questionList.length > 0) {
        questionContainer.innerHTML = analytics.questionList.map(q => `
          <div class="log-item">
            <span class="log-time">${q.time}</span>
            <span class="log-type question">提问</span>
            <span class="log-content">${q.content}</span>
          </div>
        `).join('');
      } else {
        questionContainer.innerHTML = '<p class="log-empty">暂无提问记录</p>';
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

  function generateCSV() {
    let csv = '\ufeff类型,时间,内容\n';
    if (currentAnalytics.logs && currentAnalytics.logs.length > 0) {
      currentAnalytics.logs.forEach(l => {
        const content = String(l.content).replace(/"/g, '""');
        csv += `${l.typeLabel},${l.time},"${content}"\n`;
      });
    }
    csv += '\n';
    csv += '指标,数值\n';
    csv += `参与人数,${currentAnalytics.participants}\n`;
    csv += `平均停留(分钟),${currentAnalytics.avgDuration}\n`;
    csv += `互动次数,${currentAnalytics.interactions}\n`;
    csv += `提问数量,${currentAnalytics.questions}\n`;

    if (currentAnalytics.questionList && currentAnalytics.questionList.length > 0) {
      csv += '\n问题列表\n';
      csv += '时间,内容\n';
      currentAnalytics.questionList.forEach(q => {
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

  function restoreUI() {
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
    $('#vip-enabled').checked = state.seats.vipEnabled;
    $('#vip-settings').style.display = state.seats.vipEnabled ? 'flex' : 'none';
    if (state.seats.vipCount != null) $('#vip-count').value = state.seats.vipCount;
    if (state.seats.vipLabel) $('#vip-label').value = state.seats.vipLabel;

    if (state.agenda.liveUrl) $('#live-url').value = state.agenda.liveUrl;
    if (state.agenda.liveBound) $('#live-status').classList.remove('hidden');
    if (state.agenda.countdownStart) $('#countdown-start').value = state.agenda.countdownStart;
    if (state.agenda.countdownTitle) $('#countdown-title').value = state.agenda.countdownTitle;
    $('#countdown-visible').checked = state.agenda.countdownVisible;
    $('#session-notify').checked = state.agenda.notifyEnabled;
    if (state.agenda.notifyAdvance != null) $('#notify-advance').value = state.agenda.notifyAdvance;

    if (state.agenda.items && state.agenda.items.length > 0) {
      $('#agenda-items').innerHTML = '';
      state.agenda.items.forEach(item => {
        addAgendaItem(item.time || '', item.name || '');
      });
    }

    if (state.interact.applauseDuration) $('#applause-duration').value = state.interact.applauseDuration;
    $('#handraise-enabled').checked = state.interact.handraiseEnabled;
    $('#danmaku-enabled').checked = state.interact.danmakuEnabled;
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
    if (state.booth.cards && state.booth.cards.length > 0) {
      $('#booth-cards').innerHTML = '';
      const colors = ['#6c5ce7', '#00cec9', '#e74c3c', '#f39c12', '#2ecc71', '#e84393'];
      state.booth.cards.forEach((card, i) => {
        addBoothCard(card.title || '', card.url || '', card.color || colors[i % colors.length]);
      });
    }

    if (state.guide.hotspots && state.guide.hotspots.length > 0) {
      $('#hotspot-list').innerHTML = '';
      state.guide.hotspots.forEach(h => {
        addHotspot(h.name || '', h.url || '');
      });
    }

    if (state.guide.narrations && state.guide.narrations.length > 0) {
      $('#narration-list').innerHTML = '';
      state.guide.narrations.forEach(n => {
        addNarration(n.time || '', n.text || '');
      });
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
          item.innerHTML = `<span>${msg.data.name || '观众'}</span><button class="btn-icon" title="通过">✓</button>`;
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
  }

  init();
})();
