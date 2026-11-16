/* Platform adapter: Yandex Games SDK when available, local fallback otherwise.
   Every platform call in the game goes through window.Platform. */
(function () {
  'use strict';
  var LS_KEY = 'roy_save_v2';
  var ysdk = null, player = null, readyDone = false, gpOn = false;

  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var done = false;
      var tm = setTimeout(function () { if (!done) { done = true; rej(new Error('timeout')); } }, ms);
      Promise.resolve(p).then(function (v) { if (!done) { done = true; clearTimeout(tm); res(v); } },
        function (e) { if (!done) { done = true; clearTimeout(tm); rej(e); } });
    });
  }
  function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
  function lsSet(o) { try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {} }
  function progressOf(o) { return o && typeof o === 'object' ? (Number(o.unlocked) || 0) : -1; }

  var P = {
    lang: 'en',
    isYandex: false,
    // hooks assigned by the game
    onAdOpen: null, onAdClose: null, onApiPause: null, onApiResume: null,

    init: function () {
      try { P.lang = String((navigator.languages && navigator.languages[0]) || navigator.language || 'en').slice(0, 2).toLowerCase(); } catch (e) {}
      var wait = window.__sdkPromise ? withTimeout(window.__sdkPromise, 8000).catch(function () { return false; }) : Promise.resolve(false);
      return wait.then(function () {
        if (!window.YaGames || typeof window.YaGames.init !== 'function') return P;
        return withTimeout(window.YaGames.init(), 8000).then(function (sdk) {
          ysdk = sdk; P.isYandex = true;
          try { if (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) P.lang = ysdk.environment.i18n.lang; } catch (e) {}
          try {
            if (typeof ysdk.on === 'function') {
              ysdk.on('game_api_pause', function () { if (P.onApiPause) P.onApiPause(); });
              ysdk.on('game_api_resume', function () { if (P.onApiResume) P.onApiResume(); });
            }
          } catch (e) {}
          return withTimeout(ysdk.getPlayer({ scopes: false }), 5000).then(function (pl) { player = pl; }, function () { player = null; });
        }, function () { ysdk = null; }).then(function () { return P; });
      });
    },

    ready: function () {
      if (readyDone) return; readyDone = true;
      try { if (ysdk && ysdk.features && ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready(); } catch (e) {}
    },
    gameplayStart: function () {
      if (gpOn) return; gpOn = true;
      try { if (ysdk && ysdk.features && ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.start(); } catch (e) {}
    },
    gameplayStop: function () {
      if (!gpOn) return; gpOn = false;
      try { if (ysdk && ysdk.features && ysdk.features.GameplayAPI) ysdk.features.GameplayAPI.stop(); } catch (e) {}
    },

    showInterstitial: function () {
      return new Promise(function (res) {
        if (!ysdk || !ysdk.adv) { res(false); return; }
        var finished = false, opened = false;
        function fin(v) { if (finished) return; finished = true; if (opened && P.onAdClose) P.onAdClose(); res(v); }
        try {
          ysdk.adv.showFullscreenAdv({ callbacks: {
            onOpen: function () { opened = true; if (P.onAdOpen) P.onAdOpen(); },
            onClose: function (wasShown) { fin(!!wasShown); },
            onError: function () { fin(false); },
            onOffline: function () { fin(false); }
          } });
        } catch (e) { fin(false); }
      });
    },
    showRewarded: function () {
      return new Promise(function (res) {
        if (!ysdk || !ysdk.adv) { res(true); return; } // local fallback: reward immediately
        var finished = false, opened = false, rewarded = false;
        function fin() { if (finished) return; finished = true; if (opened && P.onAdClose) P.onAdClose(); res(rewarded); }
        try {
          ysdk.adv.showRewardedVideo({ callbacks: {
            onOpen: function () { opened = true; if (P.onAdOpen) P.onAdOpen(); },
            onRewarded: function () { rewarded = true; },
            onClose: function () { fin(); },
            onError: function () { fin(); }
          } });
        } catch (e) { fin(); }
      });
    },

    load: function () {
      var local = lsGet();
      if (!player) return Promise.resolve(local || {});
      return withTimeout(player.getData(), 2000).then(function (remote) {
        return progressOf(remote) >= progressOf(local) ? (remote || {}) : (local || {});
      }, function () { return local || {}; });
    },
    save: function (obj) {
      lsSet(obj);
      if (player) {
        try { var p = player.setData(obj, true); if (p && p.catch) p.catch(function () {}); } catch (e) {}
      }
    }
  };
  window.Platform = P;
})();
