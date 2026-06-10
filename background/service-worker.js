chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.source === 'metavenue-content') {
    if (msg.action === 'analytics') {
      chrome.storage.local.set({ metavenue_analytics: msg.data });
    }
    if (msg.action === 'handraise' || msg.action === 'question') {
      chrome.runtime.sendMessage({
        source: 'metavenue-content',
        action: msg.action,
        data: msg.data
      }).catch(() => {});
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    metavenue_state: {
      activated: false,
      space: { theme: 'conference', posterUrl: '', bgmUrl: '', bgmVolume: 50 },
      seats: { avatarStyle: 'pixel', layout: 'theater', count: 50, perRow: 10, vipEnabled: true, vipCount: 5, vipLabel: '嘉宾席' },
      agenda: { liveUrl: '', liveBound: false, countdownStart: '', countdownTitle: '活动开始', countdownVisible: true, items: [], notifyEnabled: true, notifyAdvance: 5 },
      interact: { applauseDuration: '5', handraiseEnabled: true, danmakuEnabled: true, danmakuSpeed: 'normal', danmakuOpacity: 80 },
      booth: { layout: 'grid', cards: [], radius: 12, gap: 16 },
      guide: { hotspots: [], narrations: [], ttsVoice: 'zh-CN-XiaoxiaoNeural', ttsRate: 100 },
      review: { participants: 0, avgDuration: 0, interactions: 0, questions: 0, logs: [], questionList: [] }
    },
    metavenue_analytics: {
      participants: 0,
      avgDuration: 0,
      interactions: 0,
      questions: 0,
      logs: [],
      questionList: []
    }
  });
});
