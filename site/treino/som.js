// =====================================================================
// Jack In — Treino: trilha sonora e efeitos
// Música: abertura (tela inicial), partida (fundo) e run (tensão), com troca suave.
// Efeitos: ligados às ações do motor (créditos, compras, runs, ice, agendas...).
// O navegador só deixa tocar som depois do primeiro clique na página.
// Trilha e efeitos: composições originais, sintetizadas para o Jack In Treino.
// Licença: GPL-3.0.
// =====================================================================
var SOM = {
  cfg: { music: true, fx: true, vol: 0.6 },
  unlocked: false,
  want: null,        // trilha pedida
  cur: null,         // { name, el }
  last: {},          // último disparo de cada efeito (evita repetição em rajada)
  cache: {},
  ready: false,      // a partida começou (efeitos só depois do início)
  TRACKS: { abertura: "som/abertura.mp3", partida: "som/partida.mp3", run: "som/run.mp3" },
  MUSIC_GAIN: 0.55,
};
try { var _sc = JSON.parse(localStorage.getItem("jackin-som") || "null"); if (_sc) for (var _k in _sc) SOM.cfg[_k] = _sc[_k]; } catch (e) {}
function SomSave() { try { localStorage.setItem("jackin-som", JSON.stringify(SOM.cfg)); } catch (e) {} }

// ------------------------------------------------------------ música
function SomMusic(name) {
  SOM.want = name;
  if (!SOM.unlocked || !SOM.cfg.music) return;
  if (SOM.cur && SOM.cur.name == name) return;
  var old = SOM.cur;
  var el = new Audio(SOM.TRACKS[name]);
  el.loop = true; el.volume = 0; el.preload = "auto";
  SOM.cur = { name: name, el: el };
  el.play().catch(function () {});
  SomFade(el, SOM.cfg.vol * SOM.MUSIC_GAIN, 1800);
  if (old) { SomFade(old.el, 0, 1800, function () { old.el.pause(); old.el.src = ""; }); }
}
function SomMusicStop() {
  if (!SOM.cur) return;
  var old = SOM.cur; SOM.cur = null;
  SomFade(old.el, 0, 800, function () { old.el.pause(); old.el.src = ""; });
}
function SomFade(el, to, ms, done) {
  var from = el.volume, t0 = performance.now();
  clearInterval(el._fade);
  el._fade = setInterval(function () {
    var k = Math.min(1, (performance.now() - t0) / ms);
    try { el.volume = Math.max(0, Math.min(1, from + (to - from) * k)); } catch (e) {}
    if (k >= 1) { clearInterval(el._fade); if (done) done(); }
  }, 50);
}
function SomApplyVolume() {
  if (SOM.cur) { clearInterval(SOM.cur.el._fade); SOM.cur.el.volume = SOM.cfg.vol * SOM.MUSIC_GAIN; }
}

// ------------------------------------------------------------ efeitos
var SOM_GAP = { clique: 120, credito: 150, comprar: 120, subrotina: 250, quebrar: 120, acessar: 150, tag: 300, lixar: 150 };
function SomFx(name) {
  if (!SOM.noRelay && typeof X1 != "undefined" && X1.role == "host" && X1.started) { (X1.fx = X1.fx || []).push(name); }
  if (!SOM.unlocked || !SOM.cfg.fx || !SOM.ready) return;
  var now = Date.now();
  if (SOM.last[name] && now - SOM.last[name] < (SOM_GAP[name] || 90)) return;
  SOM.last[name] = now;
  try {
    var el = new Audio("som/fx/" + name + ".mp3");
    el.volume = Math.min(1, SOM.cfg.vol);
    el.play().catch(function () {});
  } catch (e) {}
}

// ------------------------------------------------------------ botão de som
function SomUI() {
  if (document.getElementById("som-btn")) return;
  var css = "#som-wrap{position:fixed;z-index:962;top:7px;right:14px;font:13px 'IBM Plex Sans',system-ui,sans-serif;color:#dbe6f2}" +
    "body.x1 #som-wrap{right:auto;left:62px}" +
    "#som-btn{width:38px;height:38px;border-radius:8px;border:1px solid #1b3043;background:#132435;color:#8da0b6;cursor:pointer;font-size:18px;line-height:1}" +
    "#som-btn.on{color:#5fd3ff;border-color:#28465f}" +
    "#som-pop{position:absolute;top:44px;right:0;min-width:220px;background:#0f1d2b;border:1px solid #28465f;border-radius:8px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none}" +
    "body.x1 #som-pop{right:auto;left:0}" +
    "#som-pop.open{display:block}" +
    "#som-pop label{display:flex;align-items:center;gap:8px;margin:4px 0;cursor:pointer}" +
    "#som-pop input[type=range]{width:100%;margin-top:6px;accent-color:#5fd3ff}" +
    "#som-pop .som-t{font:600 12px 'Chakra Petch',system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#8da0b6;margin-bottom:6px}" +
    "#som-pop small{display:block;color:#5a6c80;margin-top:8px;line-height:1.4}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var w = document.createElement("div"); w.id = "som-wrap";
  w.innerHTML = "<button id='som-btn' type='button' title='Som' aria-label='Som' aria-expanded='false'>♪</button>" +
    "<div id='som-pop' role='dialog' aria-label='Som'><div class='som-t'>Som</div>" +
    "<label><input type='checkbox' id='som-music'> Trilha sonora</label>" +
    "<label><input type='checkbox' id='som-fx'> Efeitos</label>" +
    "<input type='range' id='som-vol' min='0' max='100' aria-label='Volume'>" +
    "<small>Trilha e efeitos originais do Jack In Treino.</small></div>";
  document.body.appendChild(w);
  var btn = document.getElementById("som-btn"), pop = document.getElementById("som-pop");
  var m = document.getElementById("som-music"), f = document.getElementById("som-fx"), v = document.getElementById("som-vol");
  function paint() {
    m.checked = !!SOM.cfg.music; f.checked = !!SOM.cfg.fx; v.value = Math.round(SOM.cfg.vol * 100);
    btn.classList.toggle("on", SOM.cfg.music || SOM.cfg.fx);
    btn.textContent = SOM.cfg.music || SOM.cfg.fx ? "♪" : "🔇";
  }
  paint();
  btn.addEventListener("click", function (e) { e.stopPropagation(); pop.classList.toggle("open"); btn.setAttribute("aria-expanded", pop.classList.contains("open")); });
  document.addEventListener("click", function (e) { if (!w.contains(e.target)) pop.classList.remove("open"); });
  m.addEventListener("change", function () { SOM.cfg.music = m.checked; SomSave(); paint(); if (m.checked) { var n = SOM.want; SOM.want = null; if (n) SomMusic(n); } else SomMusicStop(); });
  f.addEventListener("change", function () { SOM.cfg.fx = f.checked; SomSave(); paint(); });
  v.addEventListener("input", function () { SOM.cfg.vol = v.value / 100; SomSave(); SomApplyVolume(); });
}

// o primeiro clique/tecla libera o áudio
(function () {
  function unlock() {
    if (SOM.unlocked) return;
    SOM.unlocked = true;
    if (SOM.want) { var n = SOM.want; SOM.want = null; SomMusic(n); }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, unlock, { capture: true }); });
  if (document.readyState == "loading") document.addEventListener("DOMContentLoaded", SomUI); else SomUI();
})();

// ------------------------------------------------------------ ganchos no motor (mesa)
(function () {
  if (typeof GainCredits != "function") return; // página sem motor (abertura ou sala do convidado)
  function wrap(name, fx, test) {
    var orig = window[name];
    if (typeof orig != "function") return;
    window[name] = function () {
      try { if (!test || test.apply(this, arguments)) SomFx(typeof fx == "function" ? fx.apply(this, arguments) : fx); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }
  wrap("SpendClicks", "clique", function (p, n) { return n > 0; });
  wrap("GainCredits", "credito", function (p, n) { return n > 0; });
  wrap("Draw", "comprar");
  wrap("Install", "instalar");
  wrap("Rez", "rez");
  wrap("PlaceAdvancement", "avancar");
  wrap("Play", "jogar");
  wrap("MakeRun", "jack-in");
  wrap("Break", "quebrar");
  wrap("EndTheRun", "fim-run");
  wrap("Steal", "roubar");
  wrap("Score", "pontuar");
  wrap("Trash", "lixar");
  wrap("Damage", "dano", function (t, n) { return n > 0; });
  wrap("AddTags", "tag", function (n) { return n > 0; });
  wrap("Trigger", "subrotina", function (c, t, p, verb) { return verb == "Firing"; });
  var _AT = AutomaticTriggers;
  AutomaticTriggers = function (cb, params) {
    try {
      if (cb == "automaticOnRunSuccessful") SomFx("sucesso");
      else if (cb == "automaticOnAccess") SomFx("acessar");
    } catch (e) {}
    return _AT.apply(this, arguments);
  };
  var _CP = ChangePhase;
  ChangePhase = function (phase) {
    var r = _CP.apply(this, arguments);
    try {
      var id = currentPhase ? currentPhase.identifier : "";
      if (id == "Corp 1.1" || id == "Runner 1.1") { SOM.ready = true; SomFx("turno"); }
      if (phase === phases.runEncounterIce) {
        var ice = typeof GetApproachEncounterIce == "function" ? GetApproachEncounterIce() : null;
        if (ice && ice.rezzed) SomFx("ice");
      }
      var inRun = typeof attackedServer != "undefined" && !!attackedServer;
      if (inRun) { clearTimeout(SOM.backT); SomMusic("run"); }
      else if (SOM.want == "run" || (SOM.cur && SOM.cur.name == "run")) {
        // depois da run, espera um pouco antes de voltar à trilha da partida (runs curtas não ficam trocando)
        clearTimeout(SOM.backT);
        SOM.backT = setTimeout(function () { if (!attackedServer) SomMusic("partida"); }, 2500);
      } else SomMusic("partida");
    } catch (e) {}
    return r;
  };
  var _PW = PlayerWin;
  PlayerWin = function (player) {
    try {
      SOM.ready = true;
      var me = typeof PhysicalHuman == "function" && PhysicalHuman() ? PhysicalHuman() : viewingPlayer;
      SomMusicStop();
      SOM.noRelay = true; SomFx(player === me ? "vitoria" : "derrota"); SOM.noRelay = false;
      if (typeof X1 != "undefined" && X1.role == "host") (X1.fx = X1.fx || []).push(player === me ? "derrota" : "vitoria");
    } catch (e) {}
    return _PW.apply(this, arguments);
  };
  SomMusic("partida");
})();
