// =====================================================================
// Jack In — Treino: X1 (duas pessoas, cartas digitais, com microfone)
// O anfitrião roda o motor (Chiriboga) no navegador dele; o convidado
// recebe só a visão dele (mesa, botões, escolhas) e devolve os cliques.
// Rede: PeerJS (WebRTC). Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================
var X1 = {
  role: null,            // "host" | "guest" | null
  code: null,
  peer: null, conn: null,
  seq: 0,                // número da última visão enviada (o convidado devolve nos cliques)
  started: false,
  names: { host: "", guest: "" },
  side: null,            // lado deste navegador: "c" | "r"
  pend: null,            // snapshot pendente (debounce)
  voice: { stream: null, call: null, muted: false },
  guestOpts: null,       // (convidado) última visão recebida
  PREFIX: "jack-in-treino-x1-",
  PEER_SRC: "deck/peerjs.min.js",
};

function X1Param(name) {
  var m = new RegExp("[?&#]" + name + "=([^&#]*)").exec(location.href);
  return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
}
function X1Esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function X1PeerOpts() {
  // para testes locais: ?peerlocal=PORTA usa um PeerServer em 127.0.0.1
  var local = X1Param("peerlocal");
  if (local) return { host: "127.0.0.1", port: parseInt(local, 10), path: "/", secure: false, debug: 1 };
  return { debug: 1, config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }] } };
}
function X1LoadPeer(cb) {
  if (window.Peer) return cb();
  var s = document.createElement("script");
  s.src = X1.PEER_SRC;
  s.onload = cb;
  s.onerror = function () { X1Status("Não consegui carregar a biblioteca de rede (PeerJS). Verifique a internet e recarregue.", true); };
  document.head.appendChild(s);
}
X1.guestSide = function () { return X1.side == "c" ? runner : corp; };
X1.mySide = function () { return X1.side == "c" ? corp : runner; };
X1.sideName = function (s) { return s == "c" ? "Corp" : "Runner"; };

// ------------------------------------------------------------ barra de status
function X1Status(msg, err) {
  var $b = $("#x1-bar");
  if (!$b.length) $b = $("<div id='x1-bar'></div>").appendTo("body");
  $b.toggleClass("err", !!err).html(msg);
}
function X1Toast(msg) {
  var $t = $("<div class='x1-toast'></div>").text(msg).appendTo("body");
  setTimeout(function () { $t.addClass("show"); }, 10);
  setTimeout(function () { $t.remove(); }, 4500);
}

// ------------------------------------------------------------ voz
function X1VoiceStart(cb) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { X1VoiceUI("sem-mic"); if (cb) cb(); return; }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }).then(function (st) {
    X1.voice.stream = st;
    X1VoiceUI("on");
    if (cb) cb();
  }).catch(function () { X1VoiceUI("sem-mic"); if (cb) cb(); });
}
function X1VoiceUI(state) {
  var $v = $("#x1-voice");
  if (!$v.length) {
    $v = $("<div id='x1-voice'><button id='x1-mic' type='button' title='Ligar ou desligar o seu microfone'></button><span id='x1-voice-st'></span><audio id='x1-remote' autoplay playsinline></audio></div>").appendTo("body");
    $("#x1-mic").on("click", function () {
      if (!X1.voice.stream) { X1VoiceStart(function () { X1VoiceCall(); }); return; }
      X1.voice.muted = !X1.voice.muted;
      X1.voice.stream.getAudioTracks().forEach(function (t) { t.enabled = !X1.voice.muted; });
      X1VoiceUI(X1.voice.muted ? "mudo" : "on");
    });
  }
  var txt = { on: "Microfone ligado", mudo: "Microfone desligado", "sem-mic": "Sem microfone (clique para tentar de novo)", ouvindo: "Voz conectada" }[state] || "";
  $("#x1-mic").attr("class", "st-" + state).text(state == "on" || state == "ouvindo" ? "🎙" : "🔇");
  $("#x1-voice-st").text(txt);
}
function X1VoiceCall() {
  // o anfitrião liga para o convidado; o convidado atende com o próprio microfone
  if (X1.role != "host" || !X1.peer || !X1.conn || !X1.voice.stream) return;
  try {
    var call = X1.peer.call(X1.conn.peer, X1.voice.stream);
    X1VoiceBind(call);
  } catch (e) { console.warn("voz:", e); }
}
function X1VoiceBind(call) {
  X1.voice.call = call;
  call.on("stream", function (remote) {
    var a = document.getElementById("x1-remote");
    if (a) { a.srcObject = remote; a.play().catch(function () {}); }
    X1Toast("Voz conectada com " + (X1.role == "host" ? X1.names.guest : X1.names.host));
  });
  call.on("close", function () { X1.voice.call = null; });
  call.on("error", function (e) { console.warn("voz:", e); });
}

// ============================================================ ANFITRIÃO
function X1HostInit() {
  X1.role = "host";
  X1.code = X1Param("sala") || X1GenCode();
  X1.side = X1Param("p") == "c" ? "c" : "r";
  X1.names.host = X1Param("nome") || "Anfitrião";
  $("body").addClass("x1 x1-host x1-lobby");
  var link = location.origin + location.pathname.replace(/[^\/]*$/, "") + "sala.html?sala=" + X1.code + (X1Param("peerlocal") ? "&peerlocal=" + X1Param("peerlocal") : "");
  X1Status("<b>Sala " + X1.code + "</b> · mande este link para o seu oponente: <input id='x1-link' readonly value='" + X1Esc(link) + "'> <button type='button' id='x1-copy'>Copiar</button><span id='x1-wait'> · Aguardando o oponente entrar…</span>");
  $("#x1-copy").on("click", function () {
    var i = document.getElementById("x1-link"); i.select();
    try { navigator.clipboard.writeText(i.value); } catch (e) { document.execCommand("copy"); }
    $(this).text("Copiado"); setTimeout(function () { $("#x1-copy").text("Copiar"); }, 1500);
  });
  X1VoiceUI("sem-mic");
  X1VoiceStart();
  X1LoadPeer(function () {
    X1.peer = new Peer(X1.PREFIX + X1.code, X1PeerOpts());
    X1.peer.on("open", function () { X1Log("sala aberta: " + X1.code); });
    X1.peer.on("error", function (e) {
      if (e.type == "unavailable-id") X1Status("Já existe uma sala com este código. Volte ao início e crie outra.", true);
      else if (e.type == "peer-unavailable") {} else X1Status("Erro de rede: " + e.type, true);
    });
    X1.peer.on("connection", function (c) {
      if (X1.conn && X1.conn.open) { c.on("open", function () { c.send({ t: "full" }); setTimeout(function () { c.close(); }, 500); }); return; }
      X1.conn = c;
      c.on("data", X1HostOnData);
      c.on("open", function () {
        c.send({ t: "room", code: X1.code, hostSide: X1.side, hostName: X1.names.host, ap: parseInt(X1Param("ap")) || 7, started: X1.started });
        if (X1.started) { X1Toast("O oponente voltou"); X1SendView(true); X1VoiceCall(); }
      });
      c.on("close", function () { X1Status("<b>Sala " + X1.code + "</b> · o oponente saiu. Se ele abrir o mesmo link, volta para a partida.", true); });
    });
    X1.peer.on("call", function (call) { if (X1.voice.stream) call.answer(X1.voice.stream); else call.answer(); X1VoiceBind(call); });
  });
}
function X1GenCode() {
  var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
  for (var i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function X1Log(m) { try { console.log("[X1] " + m); } catch (e) {} }

function X1HostOnData(d) {
  if (!d || !d.t) return;
  if (d.t == "hello") {
    X1.names.guest = d.name || "Oponente";
    if (!X1.started) {
      // o deck do convidado entra como parâmetro do motor e a partida começa
      X1.params = X1.params || {};
      if (d.deck) X1.params[X1.side == "c" ? "r" : "c"] = d.deck;
      X1.started = true;
      $("body").removeClass("x1-lobby");
      X1Status("<b>Sala " + X1.code + "</b> · " + X1Esc(X1.names.host) + " (" + X1.sideName(X1.side) + ") × " + X1Esc(X1.names.guest) + " (" + X1.sideName(X1.side == "c" ? "r" : "c") + ")");
      X1.conn.send({ t: "start", hostName: X1.names.host });
      try { X1.startGame(); } catch (e) { console.error(e); X1Status("Erro ao iniciar: " + e, true); }
      X1VoiceCall();
      X1SendView(true);
    } else { X1SendView(true); X1VoiceCall(); }
    return;
  }
  if (d.t == "act") { X1HostAct(d); return; }
  if (d.t == "chat") { X1Toast((X1.names.guest || "Oponente") + ": " + String(d.text).slice(0, 200)); return; }
}

// ação do convidado: só vale na vez dele e para a visão mais recente
function X1HostAct(d) {
  // depois de uma escolha o motor ainda vai rodar o próximo passo (mainLoopDelay): espera ele terminar
  var wait = (X1.lastResolve || 0) + (typeof mainLoopDelay == "number" ? mainLoopDelay : 350) + 120 - Date.now();
  if (wait > 0) { setTimeout(function () { X1HostAct(d); }, wait); return; }
  if (!X1.started || typeof activePlayer == "undefined" || activePlayer !== X1.guestSide()) { X1SendView(true); return; }
  if (d.seq !== X1.seq) { X1SendView(true); return; }
  try {
    if (d.kind == "cmd") {
      if (!$("#footerbutton-" + d.id).length && d.id != "trigger") { X1SendView(true); return; }
      ExecuteChosen(d.id);
    } else if (d.kind == "choice") {
      var i = parseInt(d.i, 10);
      if ($("#modal")[0] && $("#modal")[0].style.display != "none" && !validOptions.length) {
        // janela de escolha órfã (a lista foi refeita): fecha e mostra as opções de novo
        $("#modal").hide(); Main(); X1SendView(true); return;
      }
      if (!$("#modal")[0] || $("#modal")[0].style.display == "none" || !(i >= 0 && i < validOptions.length)) { X1SendView(true); return; }
      ResolveChoice(i);
    } else if (d.kind == "cancel") {
      $("#modal").hide(); Cancel();
    } else if (d.kind == "phasecancel") {
      $("#modal").hide();
      if (currentPhase && currentPhase.Cancel && typeof currentPhase.Cancel[executingCommand] == "function") currentPhase.Cancel[executingCommand]();
      else Cancel();
    } else if (d.kind == "opt") {
      // ação escolhida na janela da carta do convidado (jogar, instalar, usar, rezzar...)
      if (typeof JKOptRun == "function" && /^(play|install|trigger|rez|advance|score|trash)$/.test(d.cmd)) JKOptRun(d.cmd, parseInt(d.k, 10));
    } else if (d.kind == "trig") {
      // habilidade escolhida na caixa da run do convidado
      if (typeof JKRunTrigger == "function") JKRunTrigger(parseInt(d.k, 10));
    } else if (d.kind == "arch") {
      var opts = (phaseOptions && phaseOptions.trigger) || [];
      var o = opts.find(function (x) { return x.card && x.card.title == d.title && x.card.cardLocation === corp.archives.cards; });
      if (o) { ExecuteChosen("trigger"); var k = validOptions.indexOf(o); if (k > -1) ResolveChoice(k); }
    }
  } catch (e) { console.error(e); }
  X1SendView();
}

// a visão do convidado: mesa pelo ponto de vista dele + botões/escolhas quando a vez é dele
function X1GuestView() {
  var guest = X1.guestSide();
  var saveV = viewingPlayer;
  viewingPlayer = guest;
  X1.renderingFor = guest;
  var v = { t: "view", seq: X1.seq, phase: "", board: "", footer: "", modal: "", modalOn: false, reveal: "", who: "", count: 0, log: [], mine: false, over: null, turn: "" };
  try {
    v.board = JKBoardHTML();
    var title = currentPhase ? currentPhase.title : "";
    v.phase = (typeof JKPhasePT == "function" && JKPhasePT(title)) || title;
    v.mine = activePlayer === guest;
    v.turn = typeof playerTurn != "undefined" && playerTurn === guest ? "mine" : "theirs";
    if (/wins/.test(title)) v.over = title;
    if (v.mine) {
      var $f = $("<div>").html($("#footer").html() || "");
      $f.find("#autocontinue, #timerbar").remove();
      v.footer = $f.html();
      v.modalOn = !!($("#modal")[0] && $("#modal")[0].style.display && $("#modal")[0].style.display != "none");
      v.modal = v.modalOn ? ($("#modalcontent").html() || "") : "";
    }
    RevealRender();
    v.reveal = $("#reveal-body").html() || "";
    v.who = $("#reveal-who").text();
    v.count = $("#reveal-count").text();
    v.log = X1.log.slice(-60).map(function (e) { return X1Sanitize(e, guest); });
    // o número da visão só muda quando muda o que o convidado pode clicar
    var sig = (v.mine ? 1 : 0) + "|" + (currentPhase ? currentPhase.identifier : "") + "|" + v.footer + "|" + (v.modalOn ? v.modal : "");
    if (sig !== X1.lastSig) { X1.lastSig = sig; X1.seq++; }
    v.seq = X1.seq;
    v.run = typeof attackedServer != "undefined" && !!attackedServer;
    v.fx = (X1.fx || []).splice(0);
    v.triggerable = [];
    try { if (v.mine && phaseOptions && phaseOptions.trigger) phaseOptions.trigger.forEach(function (o) { if (o.card && v.triggerable.indexOf(o.card.title) < 0) v.triggerable.push(o.card.title); }); } catch (e) {}
    v.cardopts = [];
    try { if (v.mine && typeof JKAllCardOpts == "function") v.cardopts = JKAllCardOpts(); } catch (e) {}
  } finally {
    viewingPlayer = saveV;
    X1.renderingFor = null;
    RevealRender();
  }
  return v;
}

// registro compartilhado: cada linha guarda para quem foi escrita; para o outro lado,
// nomes de cartas que ele não pode ver viram "carta oculta"
X1.log = [];
function X1Sanitize(e, viewer) {
  if (e.v === viewer) return e.t;
  if (/^Your hand is/.test(e.t)) return "O oponente comprou a mão inicial";
  var t = e.t;
  try {
    var all = AllCards(null), visible = {}, hidden = {};
    all.forEach(function (c) { if (!c || !c.title) return; if (PlayerCanLook(viewer, c)) visible[c.title] = 1; else hidden[c.title] = 1; });
    Object.keys(hidden).forEach(function (title) {
      if (visible[title] || t.indexOf(title) < 0) return;
      t = t.split(title).join("carta oculta");
    });
  } catch (err) {}
  return t;
}
function X1SendView(now) {
  if (X1.role != "host" || !X1.started || !X1.conn || !X1.conn.open) return;
  if (now) X1.force = true;
  // um envio agendado por vez (não reinicia o relógio: com a aba em segundo plano o navegador atrasa os relógios)
  if (X1.pend) return;
  X1.pend = setTimeout(function () {
    X1.pend = null;
    var force = X1.force; X1.force = false;
    try {
      var v = X1GuestView(), js = JSON.stringify(v);
      if (force || js !== X1.lastSent) { X1.lastSent = js; X1.conn.send(v); }
    } catch (e) { console.error(e); }
    X1HostWaitUI();
  }, now ? 0 : 50);
}
// garantia: confere a cada 400 ms se a visão do convidado mudou (algumas mudanças não disparam eventos)
setInterval(function () { if (X1.role == "host" && X1.started) X1SendView(); }, 400);
// na vez do convidado, o anfitrião não clica: esconde os botões dele e mostra o aviso
function X1HostWaitUI() {
  var waiting = X1.started && typeof activePlayer != "undefined" && activePlayer === X1.guestSide() && !(currentPhase && /wins/.test(currentPhase.title || ""));
  $("body").toggleClass("x1-waiting", !!waiting);
  var $w = $("#x1-waiting");
  if (!$w.length) $w = $("<div id='x1-waiting'></div>").appendTo("body");
  $w.text(waiting ? "Vez de " + (X1.names.guest || "oponente") + " · aguardando…" : "").toggle(!!waiting);
}

// liga os ganchos do anfitrião: começo adiado até o deck do convidado chegar; dois humanos; visão a cada mudança
X1.startGame = function () {};
(function () {
  if (X1Param("x1") != "host") return;
  // parâmetros do motor podem vir da sala (deck do convidado)
  var _URIParameter = URIParameter;
  URIParameter = function (name) {
    if (X1.params && X1.params[name] != null) return String(X1.params[name]);
    if (name == "physical") return "0";
    return _URIParameter(name);
  };
  var _Init = Init;
  Init = function () {
    X1HostInit();
    X1.startGame = function () {
      _Init();
      X1HookAfterInit();
    };
  };
  var _StartGame = StartGame;
  StartGame = function () {
    // os dois lados são humanos
    corp.AI = null; runner.AI = null;
    corp.testAI = null; runner.testAI = null;
    return _StartGame.apply(this, arguments);
  };
})();
function X1HookAfterInit() {
  var _RC = ResolveChoice;
  ResolveChoice = function () { X1.lastResolve = Date.now(); return _RC.apply(this, arguments); };
  JK.logOverride = function () { return X1.log.map(function (e) { return X1Sanitize(e, X1.mySide()); }); };
  // quem decide vê os próprios nomes de carta nas opções
  var _Main = Main;
  Main = function () { if (typeof activePlayer != "undefined" && activePlayer) viewingPlayer = activePlayer; return _Main.apply(this, arguments); };
  var obs = new MutationObserver(function () { X1SendView(); });
  ["footer", "modal", "header", "jk-board"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
  });
  $(document).on("x1:log", function () { X1SendView(); });
  var _Log = Log;
  Log = function (src) {
    var r = _Log.apply(this, arguments);
    if (typeof src == "string" && src.indexOf("SPOILER") < 0) { X1.log.push({ t: src.replace(/<[^>]+>/g, ""), v: viewingPlayer }); if (X1.log.length > 300) X1.log.shift(); }
    X1SendView(); return r;
  };
  X1HostWaitUI();
}

// ============================================================ CONVIDADO
function X1GuestInit() {
  X1.role = "guest";
  X1.code = (X1Param("sala") || "").toUpperCase();
  $("body").addClass("jk-ui x1 x1-guest");
  if (!X1.code) { X1Status("Link sem código de sala. Peça ao anfitrião o link completo.", true); return; }
  X1.names.guest = X1Param("nome") || "";
  X1Status("Conectando à sala " + X1.code + "…");
  X1VoiceUI("sem-mic");
  X1LoadPeer(function () {
    X1.peer = new Peer(undefined, X1PeerOpts());
    X1.tries = 0;
    var connect = function () {
      X1.tries++;
      var c = X1.peer.connect(X1.PREFIX + X1.code, { reliable: true });
      X1.conn = c;
      c.on("open", function () { X1Status("Conectado. Aguardando a sala…"); });
      c.on("data", X1GuestOnData);
      c.on("close", function () { X1Status("A conexão com o anfitrião caiu. Recarregue a página para tentar voltar.", true); });
      c.on("error", function (e) { X1Status("Erro de conexão: " + e, true); });
    };
    X1.peer.on("open", connect);
    X1.peer.on("error", function (e) {
      if (e.type == "peer-unavailable") {
        // a sala pode estar abrindo ainda: tenta de novo algumas vezes
        if (X1.tries < 6) { X1Status("Procurando a sala " + X1.code + "… (tentativa " + (X1.tries + 1) + ")"); setTimeout(connect, 2500); }
        else X1Status("Sala " + X1.code + " não encontrada. Confira o link ou peça ao anfitrião para abrir a sala de novo.", true);
      }
      else X1Status("Erro de rede: " + e.type, true);
    });
    X1.peer.on("call", function (call) {
      var answer = function () { call.answer(X1.voice.stream || undefined); X1VoiceBind(call); };
      if (X1.voice.stream) answer(); else X1VoiceStart(answer);
    });
  });
}
function X1GuestOnData(d) {
  if (!d || !d.t) return;
  if (d.t == "full") { X1Status("Esta sala já tem dois jogadores.", true); return; }
  if (d.t == "room") {
    X1.room = d;
    X1.side = d.hostSide == "c" ? "r" : "c";
    X1.names.host = d.hostName;
    if (d.started) { X1Status("Voltando para a partida…"); X1Send({ t: "hello", name: X1.names.guest || "Oponente", deck: null }); return; }
    X1GuestLobby(d);
    return;
  }
  if (d.t == "start") { $("#x1-lobby").remove(); $("body").removeClass("x1-lobby"); X1Status("<b>Sala " + X1.code + "</b> · " + X1Esc(X1.names.host) + " (" + X1.sideName(X1.side == "c" ? "r" : "c") + ") × " + X1Esc(X1.names.guest) + " (" + X1.sideName(X1.side) + ")"); return; }
  if (d.t == "view") { X1GuestRender(d); return; }
  if (d.t == "toast") { X1Toast(d.text); return; }
}
function X1Send(m) { try { if (X1.conn && X1.conn.open) X1.conn.send(m); } catch (e) { console.error(e); } }

// lobby do convidado: nome + lista do deck (o lado é o oposto do anfitrião)
function X1GuestLobby(room) {
  $("body").addClass("x1-lobby");
  if (typeof SomMusic == "function") SomMusic("abertura");
  var side = X1.side;
  var html =
    "<div id='x1-lobby'><div class='x1-lobby-box'>" +
    "<h1>Sala " + X1Esc(room.code) + "</h1>" +
    "<p>" + X1Esc(room.hostName) + " joga de <b>" + X1.sideName(room.hostSide) + "</b>. Você joga de <b>" + X1.sideName(side) + "</b>. Partida até " + room.ap + " pontos de agenda, com cartas digitais: o programa compra por você e mostra a sua mão na tela.</p>" +
    "<label class='lbl' for='x1-name'>Seu nome</label><input class='input' id='x1-name' maxlength='24' value='" + X1Esc(X1.names.guest) + "' placeholder='Como o oponente vai te ver'>" +
    "<label class='lbl'>Seu deck de " + X1.sideName(side) + "</label>" +
    "<div class='x1-seg' id='x1-deckmode'><button type='button' data-d='paste' aria-checked='true'>Colar a minha lista</button><button type='button' data-d='ai' aria-checked='false'>Deck montado pela IA</button></div>" +
    "<div id='x1-pastebox'><label class='lbl' for='x1-deck'>Lista exportada do NetrunnerDB (texto)</label>" +
    "<textarea class='input' id='x1-deck' spellcheck='false' placeholder='Identidade\n3x Carta\n...'></textarea>" +
    "<div class='report' id='x1-report'></div></div>" +
    "<p class='muted' id='x1-aihint' style='display:none'>A IA monta um deck de " + X1.sideName(side) + " com as cartas do treino.</p>" +
    "<div class='x1-actions'><button class='btn pri big' id='x1-join' disabled>Entrar na partida</button><span class='muted' id='x1-hint'>Cole a lista para liberar o botão.</span></div>" +
    "<p class='pool'>Só cartas programadas no treino: System Gateway, System Update 2021, Midnight Sun (parcial), o deck Vic e os decks de Corp Ob Superheavy, Jinteki: Restoring Humanity, AU Co., Earth Station e LEO Construction.</p>" +
    "</div></div>";
  $("body").append(html);
  try { var saved = JSON.parse(localStorage.getItem("jackin-treino") || "null"); if (saved) { $("#x1-deck").val(side == "c" ? (saved.c || "") : (saved.r || "")); if (!X1.names.guest && saved.name) $("#x1-name").val(saved.name); } } catch (e) {}
  var parsed = null, mode = "paste";
  try { var sv = JSON.parse(localStorage.getItem("jackin-treino") || "null"); if (sv && sv.guestdeck) mode = sv.guestdeck; } catch (e) {}
  function setMode(m) {
    mode = m;
    $("#x1-deckmode button").each(function () { $(this).attr("aria-checked", $(this).attr("data-d") == m ? "true" : "false"); });
    $("#x1-pastebox").toggle(m == "paste"); $("#x1-aihint").toggle(m == "ai");
    check();
  }
  $(document).on("click", "#x1-deckmode button", function () { setMode($(this).attr("data-d")); });
  function check() {
    if (typeof DeckList == "undefined" || !DeckList.ready) { setTimeout(check, 200); return; }
    var txt = $("#x1-deck").val().trim();
    parsed = txt ? DeckList.parse(txt, side) : null;
    var ok = mode == "ai" || !!(parsed && DeckList.report($("#x1-report")[0], parsed, side));
    if (!txt) $("#x1-report").html("");
    $("#x1-join").prop("disabled", !ok);
    $("#x1-hint").toggle(!ok);
  }
  $("#x1-deck").on("input", check);
  setMode(mode);
  $("#x1-join").on("click", function () {
    X1.names.guest = $("#x1-name").val().trim() || "Oponente";
    try { var s = JSON.parse(localStorage.getItem("jackin-treino") || "{}"); s.name = X1.names.guest; s.guestdeck = mode; if (side == "c") s.c = $("#x1-deck").val(); else s.r = $("#x1-deck").val(); localStorage.setItem("jackin-treino", JSON.stringify(s)); } catch (e) {}
    X1Status("Entrando…");
    var go = function () { X1Send({ t: "hello", name: X1.names.guest, deck: mode == "ai" ? null : DeckList.pack(parsed), aiDeck: mode == "ai" }); };
    if (!X1.voice.stream) X1VoiceStart(go); else go();
  });
}

// o convidado desenha a visão recebida; os botões vêm com os mesmos onclick, que aqui mandam a ação ao anfitrião
function X1GuestRender(v) {
  X1.seq = v.seq;
  X1.view = v;
  if (typeof SOM != "undefined") {
    SOM.ready = true;
    (v.fx || []).forEach(function (n) { SomFx(n); });
    if (v.over) SomMusicStop();
    else if (v.run) { clearTimeout(SOM.backT); SomMusic("run"); }
    else if (SOM.cur && SOM.cur.name == "run") { clearTimeout(SOM.backT); SOM.backT = setTimeout(function () { if (!X1.view || !X1.view.run) SomMusic("partida"); }, 2500); }
    else SomMusic("partida");
  }
  $("#header").html("<h2>" + X1Esc(v.phase) + "</h2>");
  if (!$("#jk-board").length) $("#contentcontainer").before("<main id='jk-board' aria-label='Mesa'></main>");
  $("#jk-board").html(v.board);
  JK.log = v.log || [];
  $("#jk-log").html(JK.log.slice(-60).map(function (l) { return "<li>" + X1Esc(l) + "</li>"; }).reverse().join(""));
  $("#reveal-body").html(v.reveal); $("#reveal-who").text(v.who); $("#reveal-count").text(v.count);
  if (v.over) {
    $("#footer").html("<h2 class='x1-over'>" + X1Esc(v.phase) + "</h2><button class='button' type='button' onclick=\"location.href='index.html'\">Voltar ao início</button>").show();
    $("#modal").hide();
    $("body").removeClass("x1-waiting");
    return;
  }
  if (v.mine) {
    $("body").removeClass("x1-waiting");
    $("#footer").html(v.footer).show();
    if (v.modalOn) { $("#modalcontent").html(v.modal); $("#modal").css("display", "flex"); } else $("#modal").hide();
    if (typeof JKTranslateUI == "function") JKTranslateUI();
  } else {
    $("body").addClass("x1-waiting");
    $("#footer").html("<h2 id='x1-their-turn'>Vez de " + X1Esc(X1.names.host || "oponente") + " · aguardando…</h2>").show();
    $("#modal").hide();
  }
}
X1.canTrigger = function (title) { return !!(X1.view && X1.view.mine && X1.view.triggerable && X1.view.triggerable.indexOf(title) > -1); };

(function () {
  if (!/sala\.html/.test(location.pathname)) return;
  // funções globais que os botões espelhados chamam
  window.ExecuteChosen = function (id) { X1Send({ t: "act", kind: "cmd", id: id, seq: X1.seq }); };
  window.ResolveChoice = function (i) { $("#modal").hide(); X1Send({ t: "act", kind: "choice", i: i, seq: X1.seq }); };
  window.Cancel = function () { X1Send({ t: "act", kind: "cancel", seq: X1.seq }); };
  window.executingCommand = "x";
  window.currentPhase = { Cancel: { x: function () { X1Send({ t: "act", kind: "phasecancel", seq: X1.seq }); } } };
  $(function () {
    X1GuestInit();
    $(document).on("click", ".jk-arch-btn", function () { X1Send({ t: "act", kind: "arch", title: $(this).text().replace(/ \(de Archives\)$/, ""), seq: X1.seq }); });
  });
})();
