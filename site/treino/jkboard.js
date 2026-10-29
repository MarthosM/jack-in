// =====================================================================
// Jack In — Treino: mesa visual (substitui a mesa em texto do Chiriboga)
// Imagens: rota local img/<código>.jpg (o executável baixa do NetrunnerDB
// e guarda em cache). Sem a rota, a carta aparece como placa de texto.
// Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

var JK = { log: [], scheduled: false, imgOk: {}, imgBad: {} };
var JackInConfirmSingle = true; // mesmo com uma única opção, espera o clique do jogador

// ----------------------------------------------------------- traduções
var JK_PT = {
  "Draw": "Comprar", "Gain": "Ganhar 1¢", "Install": "Instalar", "Play": "Jogar", "Run": "Run",
  "Trigger": "Usar habilidade", "Remove": "Remover tag", "Continue": "Continuar", "Keep": "Manter mão",
  "Mulligan": "Mulligan", "Jack out": "Jack out", "Access": "Acessar", "Steal": "Roubar", "End": "Encerrar acesso",
  "Next": "Próxima carta", "Trash": "Trash", "Approach": "Aproximar do servidor",
  "Resolve unbroken subroutines": "Deixar subrotinas dispararem",
  "Continue to Movement Phase": "Seguir em frente", "Continue to Encounter Phase": "Encontrar o ice",
  "Continue without rezzing ice": "Continuar", "Finish install (trash no more cards)": "Concluir instalação",
  "End turn": "Encerrar turno", "Continue to Discard Phase": "Ir para descarte", "Continue to next action": "Próxima ação",
  "Play again": "Jogar de novo", "Cancel": "Cancelar", "Auto": "Auto",
  "Continue without trashing": "Não dar trash", "End the run": "Encerrar a run", "Take 1 tag": "Receber 1 tag",
  "Advance": "Avançar", "Purge": "Purgar vírus", "Rez": "Rez", "Score": "Pontuar", "Use": "Usar",
};
var JK_PHASE_R = {
  "Runner's Turn Begins": "Seu turno começa", "Runner's Action Phase": "Seu turno · ações", "Corporation's Action Phase": "Turno da Corp",
  "Corporation's Turn Begins": "Turno da Corp", "Corporation's Draw Phase": "Turno da Corp · compra",
  "Runner's Mulligan": "Sua mão inicial", "Corporation's Mulligan": "Mão inicial da Corp",
  "Runner's Discard Phase": "Descarte", "Corporation's Discard Phase": "Descarte da Corp",
  "Corp wins": "A Corp venceu", "Runner wins": "Você venceu",
};
var JK_PHASE_C = {
  "Corporation's Turn Begins": "Seu turno começa", "Corporation's Draw Phase": "Seu turno · compra", "Corporation's Action Phase": "Seu turno · ações",
  "Runner's Turn Begins": "Turno do Runner", "Runner's Action Phase": "Turno do Runner",
  "Runner's Mulligan": "Mão inicial do Runner", "Corporation's Mulligan": "Sua mão inicial",
  "Runner's Discard Phase": "Descarte do Runner", "Corporation's Discard Phase": "Descarte",
  "Corp wins": "Você venceu", "Runner wins": "O Runner venceu",
};
var JK_PHASE_RUN = {
  "Run: Encounter Ice": "Run · encontro com ice", "Run: Movement": "Run · movimento", "Run: Ice": "Run · ice", "Run: Server": "Run · servidor",
  "Run: Approach Ice": "Run · aproximação", "Run: Access": "Run · acesso", "Run: Breach": "Run · breach", "Run: Subroutines": "Run · subrotinas",
  "Run: Unsuccessful": "Run sem sucesso", "Run: Successful": "Run com sucesso", "Run Ends": "Fim da run", "Run: End": "Fim da run",
};
var JK_PHASE_SUFFIX = { "Response": "resposta", "Paid Ability Window": "janela de habilidades", "Begins": "início" };
function JKPhasePT(t) {
  var meCorp = false;
  try { meCorp = typeof PhysicalHuman == "function" && PhysicalHuman() == corp; } catch (e) {}
  var map = meCorp ? JK_PHASE_C : JK_PHASE_R;
  var low = t.toLowerCase();
  function look(x) {
    for (var k in map) if (k.toLowerCase() == x) return map[k];
    for (var k2 in JK_PHASE_RUN) if (k2.toLowerCase() == x) return JK_PHASE_RUN[k2];
    return null;
  }
  var r = look(low);
  if (r) return r;
  var m = t.match(/^(.*):\s*([^:]+)$/);
  if (m) {
    var base = look(m[1].toLowerCase());
    var suf = null;
    for (var k3 in JK_PHASE_SUFFIX) if (k3.toLowerCase() == m[2].trim().toLowerCase()) suf = JK_PHASE_SUFFIX[k3];
    if (base) return base + (suf ? " · " + suf : "");
  }
  return null;
}
function JKTranslateUI() {
  $("#footer button").each(function () {
    var t = $(this).text().trim();
    if (JK_PT[t] && JK_PT[t] !== t) $(this).text(JK_PT[t]);
  });
  // início de turno com habilidades opcionais: deixa claro que dá para seguir sem usar
  try {
    if (currentPhase && (currentPhase.identifier == "Corp 1.2" || currentPhase.identifier == "Runner 1.2") &&
        phaseOptions && phaseOptions.trigger && phaseOptions.trigger.length) {
      var $n = $("#footerbutton-n");
      if ($n.length && $n.text() != "Começar o turno sem usar") $n.text("Começar o turno sem usar");
      var $t = $("#footerbutton-trigger");
      if ($t.length && $t.text() != "Usar habilidade de início de turno") $t.text("Usar habilidade de início de turno");
    }
  } catch (e) {}
  $("#footer h2").each(function () {
    var t = $(this).text().trim();
    var m = { "Drag to Archives": "Escolha uma carta para descartar (vai para Archives)", "Drag to Heap": "Escolha uma carta para descartar (vai para o Heap)" };
    if (m[t]) $(this).text(m[t]);
  });
  var h = $("#header h2").first();
  var ht = h.text().trim();
  var pt = JKPhasePT(ht);
  if (!pt && typeof JKRunPT == "function" && /\bBreak\b|strength|subroutine/i.test(ht)) pt = JKRunPT(ht);
  if (pt && pt !== ht) h.text(pt);
}

// --------------------------------------------------------- registro (log)
(function () {
  if (typeof Log != "function") return;
  var _Log = Log;
  Log = function (src) {
    var r = _Log.apply(this, arguments);
    if (typeof src == "string" && src.indexOf("SPOILER") < 0) {
      JK.log.push(src.replace(/<[^>]+>/g, ""));
      if (JK.log.length > 200) JK.log.shift();
      JKSchedule();
    }
    return r;
  };
})();

// --------------------------------------------------------------- render
(function () {
  if (typeof Render != "function") return;
  var _Render = Render;
  Render = function () {
    var r = _Render.apply(this, arguments);
    JKSchedule();
    return r;
  };
})();
function JKSchedule() {
  if (JK.scheduled) return;
  JK.scheduled = true;
  requestAnimationFrame(function () {
    JK.scheduled = false;
    try { JKRender(); } catch (e) { console.error(e); }
  });
}

function JKDb(title) { return (typeof RV != "undefined" && RV.db[title]) || null; }
function JKEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

// imagem: tenta o cache local do executável; se falhar, mostra placa de texto
// imagens: primeiro o cache local do executável, depois os endereços que o site Jack In usa
var JK_IMG_TPLS = [
  "img/{code}.jpg",
  "https://card-images.netrunnerdb.com/v2/large/{code}.jpg",
  "https://card-images.netrunnerdb.com/v1/large/{code}.jpg",
  "https://card-images.netrunnerdb.com/v2/large/{code}.webp",
  "https://card-images.netrunnerdb.com/v2/xlarge/{code}.webp",
  "https://card-images.netrunnerdb.com/v2/medium/{code}.jpg",
  "https://netrunnerdb.com/card_image/large/{code}.jpg",
  "https://netrunnerdb.com/card_image/{code}.png",
  "https://jinteki.net/img/cards/en/default/stock/{code}.png",
];
JK.imgGood = {}; JK.imgTried = {};
JK.imgPref = 1;
try { var _p = parseInt(localStorage.getItem("jackin-imgPref"), 10); if (_p > 0 && _p < JK_IMG_TPLS.length) JK.imgPref = _p; } catch (e) {}
function JKImgUrls(code) {
  var all = JK_IMG_TPLS.map(function (t) { return t.replace("{code}", code); });
  var order = [0, JK.imgPref].concat(all.map(function (_, i) { return i; }).filter(function (i) { return i != 0 && i != JK.imgPref; }));
  return order.map(function (i) { return all[i]; });
}
function JKImgFirst(code) {
  if (JK.imgGood[code]) return JK.imgGood[code];
  var tried = JK.imgTried[code] || [];
  var urls = JKImgUrls(code).filter(function (u) { return tried.indexOf(u) < 0; });
  return urls[0] || null;
}
function JKImgNext(el) {
  var code = el.getAttribute("data-code");
  var tried = JK.imgTried[code] = JK.imgTried[code] || [];
  var src = el.getAttribute("src");
  if (tried.indexOf(src) < 0) tried.push(src);
  var nx = JKImgFirst(code);
  if (nx) el.src = nx;
  else { JK.imgBad[code] = 1; el.remove(); }
}
function JKImgOk(el) {
  var code = el.getAttribute("data-code");
  var src = el.getAttribute("src");
  JK.imgGood[code] = src;
  if (el.parentNode && el.parentNode.classList) el.parentNode.classList.add("has-img");
  for (var i = 1; i < JK_IMG_TPLS.length; i++) {
    var parts = JK_IMG_TPLS[i].split("{code}");
    if (src.indexOf(parts[0]) == 0 && src.slice(-parts[1].length) == parts[1]) {
      if (i != JK.imgPref) { JK.imgPref = i; try { localStorage.setItem("jackin-imgPref", i); } catch (e) {} }
      break;
    }
  }
}
function JKImgTag(code, cls) {
  if (!code || JK.imgBad[code]) return "";
  var src = JKImgFirst(code);
  if (!src) return "";
  var good = JK.imgGood[code] ? " data-ok='1'" : "";
  return "<img" + (cls ? " class='" + cls + "'" : "") + " src='" + src + "' data-code='" + code + "'" + good + " alt='' referrerpolicy='no-referrer' onload='JKImgOk(this)' onerror='JKImgNext(this)'>";
}
function JKImg(code) { return JKImgTag(code, ""); }

function JKCard(card, opts) {
  opts = opts || {};
  var visible = opts.forceVisible || (typeof PlayerCanLook == "function" ? PlayerCanLook(viewingPlayer, card) : true);
  var isIce = card.cardType == "ice";
  if (!visible) {
    var back = card.player == corp ? "corp" : "runner";
    var lbl = isIce ? "Ice" : (CheckInstalled(card) ? "Carta" : "");
    return "<div class='jk-card jk-back jk-back-" + back + (opts.cls ? " " + opts.cls : "") + "'><span class='jk-back-mark'>" + lbl + "</span>" + JKBadges(card) + "</div>";
  }
  var db = JKDb(card.title) || {};
  var cls = "jk-card jk-type-" + (card.cardType || "x");
  if (card.player == corp && CheckInstalled(card) && !card.rezzed && (card.cardType == "ice" || card.cardType == "asset" || card.cardType == "upgrade")) cls += " jk-unrezzed";
  if (opts.cls) cls += " " + opts.cls;
  var hosted = "";
  if (card.hostedCards && card.hostedCards.length) {
    hosted = "<div class='jk-hosted'>" + card.hostedCards.map(function (h) { return JKCard(h, { cls: "jk-mini" }); }).join("") + "</div>";
  }
  if (db.code && JK.imgGood[db.code]) cls += " has-img";
  return "<div class='" + cls + "' data-title=\"" + JKEsc(card.title) + "\">" + JKImg(db.code) +
    "<div class='jk-name'>" + JKEsc(card.title) + "</div>" + JKBadges(card) + hosted + "</div>";
}

function JKBadges(card) {
  var b = [];
  if (card.advancement) b.push("<span class='bd bd-adv' title='Avanço'>" + card.advancement + "</span>");
  if (card.credits) b.push("<span class='bd bd-cr' title='Créditos'>" + card.credits + "¢</span>");
  if (card.power) b.push("<span class='bd bd-pw' title='Marcadores de poder'>" + card.power + "</span>");
  if (card.virus) b.push("<span class='bd bd-vi' title='Marcadores de vírus'>" + card.virus + "</span>");
  if (card.agenda) b.push("<span class='bd bd-ag' title='Marcadores de agenda'>" + card.agenda + "</span>");
  if (card.cardType == "ice" && (card.rezzed || card.knownToRunner)) {
    try { b.push("<span class='bd bd-str' title='Força'>" + Strength(card) + "</span>"); } catch (e) {}
  }
  if (card.cardType == "program" && typeof card.strength != "undefined") {
    try { b.push("<span class='bd bd-str' title='Força'>" + Strength(card) + "</span>"); } catch (e) {}
  }
  return b.length ? "<div class='jk-badges'>" + b.join("") + "</div>" : "";
}

function JKPile(label, cards, opts) {
  opts = opts || {};
  var top = cards.length ? cards[cards.length - 1] : null;
  var inner = "";
  if (!top) inner = "<div class='jk-card jk-empty'><span>vazio</span></div>";
  else if (opts.facedown) inner = "<div class='jk-card jk-back jk-back-" + opts.side + "'><span class='jk-back-mark'></span></div>";
  else inner = JKCard(top, { forceVisible: opts.forceVisible });
  return "<div class='jk-pile" + (opts.cls ? " " + opts.cls : "") + "'>" + inner +
    "<div class='jk-pile-lbl'><span>" + label + "</span><b>" + cards.length + "</b></div></div>";
}

function JKServer(server, name, iceBelow) {
  // iceBelow: a Corp está em cima da tela (você é o Runner), então os ices ficam embaixo dos servidores,
  // virados para o Runner, com o mais externo mais perto dele. Quando você é a Corp, o contrário.
  var attacked = attackedServer === server;
  var html = "<section class='jk-server" + (attacked ? " jk-attacked" : "") + (iceBelow ? " jk-ice-below" : "") + "'>";
  var head = "<header><h3>" + JKEsc(name) + "</h3>" + (attacked ? "<span class='jk-run-tag'>run</span>" : "") + "</header>";
  var ice = "<div class='jk-ice'>";
  var order = [];
  for (var i = 0; i < server.ice.length; i++) order.push(i);
  if (!iceBelow) order.reverse(); // Corp embaixo: o mais externo fica em cima (perto do Runner)
  order.forEach(function (i) {
    var cls = "jk-ice-card jk-landscape";
    if (attacked && i == approachIce) cls += " jk-approached";
    ice += JKCard(server.ice[i], { cls: cls });
  });
  if (!server.ice.length) ice += "<div class='jk-noice'>sem ice</div>";
  ice += "</div>";
  var root = "<div class='jk-root'>";
  if (server === corp.HQ) root += JKPile("Mão", corp.HQ.cards, { facedown: true, side: "corp", cls: "jk-mini-pile" });
  if (server === corp.RnD) root += JKPile("Baralho", corp.RnD.cards, { facedown: true, side: "corp", cls: "jk-mini-pile" });
  if (server === corp.archives) {
    var meCorpA = typeof PhysicalHuman == "function" && PhysicalHuman() == corp;
    var up = corp.archives.cards.filter(function (c) { return IsFaceUp(c); });
    var down = corp.archives.cards.length - up.length;
    // Corp humana vê as próprias cartas viradas em Archives (e pode usar habilidades delas, ex.: Petty Cash)
    var shown = meCorpA ? corp.archives.cards.slice(-12) : up.slice(-6);
    root += "<div class='jk-archives'>" + (shown.length ? shown.map(function (c) { return JKCard(c, { cls: "jk-mini" + (IsFaceUp(c) ? "" : " jk-arch-down"), forceVisible: true }); }).join("") : "") +
      "<div class='jk-pile-lbl'><span>Archives</span><b>" + corp.archives.cards.length + "</b>" + (down ? "<small>" + down + " virada(s)</small>" : "") + "</div></div>";
  }
  server.root.forEach(function (c) { root += JKCard(c); });
  root += "</div>";
  html += iceBelow ? head + root + ice : head + ice + root;
  html += "</section>";
  return html;
}

function JKStat(label, value, cls, title) {
  return "<div class='jk-stat " + (cls || "") + "'" + (title ? " title='" + title + "'" : "") + "><span>" + label + "</span><b>" + value + "</b></div>";
}

function JKRender() {
  if (!$("#jk-board").length || typeof runner == "undefined" || !runner || !corp || !corp.HQ) return;
  // X1 (anfitrião): a mesa é sempre desenhada pelo ponto de vista de quem está nesta tela
  var me = typeof X1 != "undefined" && X1.role == "host" && X1.started ? X1.mySide() : null;
  var saveV = viewingPlayer;
  if (me) viewingPlayer = me;
  try {
    $("#jk-board").html(JKBoardHTML());
    // registro
    var lines = typeof JK.logOverride == "function" ? JK.logOverride() : JK.log;
    var log = lines.slice(-60).map(function (l) { return "<li>" + JKEsc(l) + "</li>"; }).reverse().join("");
    $("#jk-log").html(log);
    JKTranslateUI();
  } finally { if (me) viewingPlayer = saveV; }
}
// HTML da mesa para quem está olhando (viewingPlayer)
function JKBoardHTML() {
  // ---- Corp
  var cAP = AgendaPoints(corp), rAP = AgendaPoints(runner), win = AgendaPointsToWin();
  var corpSide = corp.identityCard && typeof corp.identityCard.JKCSideLabel == "function" ? JKStat("Identidade", corp.identityCard.JKCSideLabel(), "jk-side") : "";
  var corpPower = corp.identityCard && typeof corp.identityCard.power == "number" && corp.identityCard.cardDefinition && typeof corp.identityCard.cardDefinition.power == "number" ? JKStat("Poder (ID)", corp.identityCard.power) : "";
  var corpStats = corpSide + corpPower + JKStat("Créditos", corp.creditPool, "jk-big") + JKStat("Cliques", corp.clickTracker) +
    JKStat("Pontos", cAP + "/" + win) + JKStat("HQ", corp.HQ.cards.length) + JKStat("R&D", corp.RnD.cards.length) +
    (corp.badPublicity ? JKStat("Bad pub.", corp.badPublicity, "jk-warn") : "");
  var iceBelow = !(typeof viewingPlayer != "undefined" && viewingPlayer == corp);
  var servers = JKServer(corp.archives, "Archives", iceBelow) + JKServer(corp.RnD, "R&D", iceBelow) + JKServer(corp.HQ, "HQ", iceBelow);
  corp.remoteServers.forEach(function (s) { servers += JKServer(s, ServerName(s), iceBelow); });
  var corpScore = corp.scoreArea.map(function (c) { return JKCard(c, { cls: "jk-mini", forceVisible: true }); }).join("");

  // ---- Runner
  var mu = MemoryUnits(), muUsed = InstalledMemoryCost();
  var clicks = "";
  var maxC = Math.max(4, runner.clickTracker);
  for (var i = 0; i < maxC; i++) clicks += "<i class='" + (i < runner.clickTracker ? "on" : "") + "'></i>";
  var runnerStats = JKStat("Créditos", runner.creditPool, "jk-big") +
    "<div class='jk-stat jk-clicks'><span>Cliques</span><b>" + clicks + "</b></div>" +
    JKStat("Tags", runner.tags, runner.tags ? "jk-tagged" : "", "Tags recebidas") +
    JKStat("MU", muUsed + "/" + mu) + JKStat("Mão máx.", MaxHandSize(runner)) +
    JKStat("Pontos", rAP + "/" + win) + (runner.coreDamage ? JKStat("Dano núcleo", runner.coreDamage, "jk-warn") : "");
  var row = function (label, arr) {
    return "<div class='jk-row'><h4>" + label + " <b>" + arr.length + "</b></h4><div class='jk-cards'>" +
      (arr.length ? arr.map(function (c) { return JKCard(c, { forceVisible: true }); }).join("") : "<span class='jk-none'>—</span>") + "</div></div>";
  };
  var grip = runner.grip.map(function (c) { return JKCard(c, { forceVisible: true, cls: "jk-hand" }); }).join("") || "<span class='jk-none'>mão vazia</span>";
  var runnerScore = runner.scoreArea.map(function (c) { return JKCard(c, { cls: "jk-mini", forceVisible: true }); }).join("");

  var meCorp = (typeof viewingPlayer != "undefined" && viewingPlayer == corp);
  if (meCorp) {
    var cclicks = "";
    for (var k = 0; k < Math.max(3, corp.clickTracker); k++) cclicks += "<i class='" + (k < corp.clickTracker ? "on" : "") + "'></i>";
    corpStats = corpSide + corpPower + JKStat("Créditos", corp.creditPool, "jk-big") + "<div class='jk-stat jk-clicks'><span>Cliques</span><b>" + cclicks + "</b></div>" +
      JKStat("Pontos", cAP + "/" + win) + JKStat("Mão máx.", MaxHandSize(corp)) + JKStat("R&D", corp.RnD.cards.length) +
      (corp.badPublicity ? JKStat("Bad pub.", corp.badPublicity, "jk-warn") : "") +
      JKStat("Tags do Runner", runner.tags, runner.tags ? "jk-tagged" : "");
  }
  var corpHand = meCorp ? "<div class='jk-grip'><h4>Sua mão (HQ) <b>" + corp.HQ.cards.length + "</b></h4><div class='jk-cards'>" +
      (corp.HQ.cards.map(function (c) { return JKCard(c, { forceVisible: true, cls: "jk-hand" }); }).join("") || "<span class='jk-none'>mão vazia</span>") + "</div></div>" : "";
  var runnerHand = meCorp
    ? "<div class='jk-grip'><h4>Mão do Runner <b>" + runner.grip.length + "</b></h4></div>"
    : "<div class='jk-grip'><h4>Sua mão <b>" + runner.grip.length + "</b></h4><div class='jk-cards'>" + grip + "</div></div>";
  var corpHalf =
    "<div class='jk-half jk-corp'>" +
      "<div class='jk-side-head'><div class='jk-who'>" + (corp.identityCard ? JKCard(corp.identityCard, { forceVisible: true, cls: "jk-mini jk-idcard" }) : "") + "<span class='jk-dot corp'></span>" + (meCorp ? "Você · Corp" : (corp.AI ? "Corp (IA)" : "Corp")) + "<em class='jk-idname' data-title=\"" + JKEsc(corp.identityCard ? corp.identityCard.title : "") + "\">" + JKEsc(corp.identityCard ? corp.identityCard.title : "") + "</em></div><div class='jk-stats'>" + corpStats + "</div></div>" +
      "<div class='jk-servers'>" + servers + "</div>" +
      (corpScore ? "<div class='jk-score'><h4>Agendas pontuadas</h4><div class='jk-cards'>" + corpScore + "</div></div>" : "") +
      corpHand +
    "</div>";
  var runnerHalf =
    "<div class='jk-half jk-runner" + (runner.tags ? " is-tagged" : "") + "'>" +
      "<div class='jk-side-head'><div class='jk-who'><span class='jk-dot runner'></span>" + (meCorp ? (runner.AI ? "Runner (IA)" : "Runner") : "Runner") + "<em class='jk-idname' data-title=\"" + JKEsc(runner.identityCard ? runner.identityCard.title : "") + "\">" + JKEsc(runner.identityCard ? runner.identityCard.title : "") + "</em></div><div class='jk-stats'>" + runnerStats + "</div></div>" +
      "<div class='jk-rig'>" +
        "<div class='jk-id'>" + (runner.identityCard ? JKCard(runner.identityCard, { forceVisible: true }) : "") + "</div>" +
        "<div class='jk-rows'>" + row("Programas", runner.rig.programs) + row("Hardware", runner.rig.hardware) + row("Recursos", runner.rig.resources) + "</div>" +
        "<div class='jk-piles'>" + JKPile("Stack", runner.stack, { facedown: true, side: "runner" }) + JKPile("Heap", runner.heap, { forceVisible: true }) +
          (runnerScore ? "<div class='jk-score'><h4>Roubadas</h4><div class='jk-cards'>" + runnerScore + "</div></div>" : "") + "</div>" +
      "</div>" +
      runnerHand +
    "</div>";
  // o seu lado fica embaixo
  return meCorp ? runnerHalf + corpHalf : corpHalf + runnerHalf;
}

// --------------------------------------------------------------- montagem
// tela cheia e, no celular, tenta travar em paisagem (Android; no iPhone o navegador não deixa)
function JKFullscreenLandscape() {
  var de = document.documentElement;
  var req = de.requestFullscreen || de.webkitRequestFullscreen;
  if (!req) return;
  try {
    var pr = req.call(de);
    var lock = function () { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {}); } catch (e) {} };
    if (pr && pr.then) pr.then(lock).catch(function () {}); else lock();
  } catch (e) {}
}
$(function () {
  $("body").addClass("jk-ui");
  $("#contentcontainer").before("<main id='jk-board' aria-label='Mesa'></main>");
  // aba de registro junto ao painel "Corp revelou"
  var waitPanel = setInterval(function () {
    if (!$("#reveal-panel").length) return;
    clearInterval(waitPanel);
    $("#reveal-panel").append("<button id='jk-log-toggle' type='button'>Registro da partida</button><ol id='jk-log'></ol>");
    try { if (localStorage.getItem("jackin-log-open") == "1") $("#reveal-panel").addClass("log-open"); } catch (e) {}
    $("#jk-log-toggle").on("click", function () {
      $("#reveal-panel").toggleClass("log-open");
      try { localStorage.setItem("jackin-log-open", $("#reveal-panel").hasClass("log-open") ? "1" : "0"); } catch (e) {}
    });
  }, 100);
  var de0 = document.documentElement;
  // celular em pé: pede para girar (a mesa é só em paisagem)
  $("body").append("<div id='jk-rotate' role='alert'><div class='rot-ico' aria-hidden='true'>📱</div><p>Gire o celular para jogar</p>" +
    "<small>No celular, a mesa funciona deitada. Dica: trave a rotação depois de girar.</small>" +
    ((de0.requestFullscreen || de0.webkitRequestFullscreen) ? "<button type='button' id='jk-rotate-fs'>Tela cheia e paisagem</button>" : "") + "</div>");
  $(document).on("click", "#jk-rotate-fs", function () { JKFullscreenLandscape(); });
  // celular deitado: tocar na mesa fecha o painel de reveladas
  $(document).on("click", "#jk-board", function () {
    if (window.matchMedia && matchMedia("(orientation:landscape) and (max-height:500px)").matches) $("#reveal-panel").addClass("rv-collapsed");
  });
  // tela cheia
  var de = document.documentElement;
  if (de.requestFullscreen || de.webkitRequestFullscreen) {
    $("body").append("<button id='jk-fs' type='button' title='Tela cheia' aria-label='Tela cheia'>⛶</button>");
    var isFs = function () { return !!(document.fullscreenElement || document.webkitFullscreenElement); };
    $("#jk-fs").on("click", function () {
      try {
        if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else JKFullscreenLandscape();
      } catch (e) {}
    });
    $(document).on("fullscreenchange webkitfullscreenchange", function () {
      var on = isFs();
      $("#jk-fs").toggleClass("on", on).attr({ title: on ? "Sair da tela cheia" : "Tela cheia", "aria-label": on ? "Sair da tela cheia" : "Tela cheia" });
    });
  }
  $("#menucontent h1").text("Jack In · Treino");
  $("#menucontent .close-cross").attr({ role: "button", "aria-label": "Fechar menu", tabindex: 0 }).html("&times;");
  $("#menu").on("click", function (e) { if (e.target === this) $("#menu").hide(); });
  $(document).on("keydown", function (e) { if (e.key == "Escape") $("#menu").hide(); });
  $("body").append("<div id='jk-version'>Jack In Treino · v" + (typeof JK_VERSION != "undefined" ? JK_VERSION : "") + "</div>");
  $(document).on("click", "#jk-board .jk-card[data-title], #jk-board .jk-idname", function (e) {
    e.stopPropagation();
    JKZoomHide();
    var $b = $(this).find(".jk-badges");
    if (typeof RevealShowCard == "function") RevealShowCard($(this).attr("data-title"), $b.length ? $b.html() : "", $(this).hasClass("jk-hand") ? "hand" : "table");
  });
  // traduz botões assim que o rodapé muda
  var obs = new MutationObserver(function () { JKTranslateUI(); });
  ["footer", "header"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el, { childList: true, subtree: true });
  });
  JKSchedule();
});

// ------------------------------------------------ vigia da IA
// Se a vez é da IA e nada muda por muito tempo (decisão perdida), retoma o laço do jogo.
var JKWatch = { sig: "", since: Date.now(), inflight: 0, inflightAt: 0, kicks: 0 };
function JKWrapAI(p) {
  if (!p || !p.AI || p.AI.__jkWrapped) return;
  var ai = p.AI;
  ["CommandChoice", "SelectChoice"].forEach(function (fn) {
    if (typeof ai[fn] != "function") return;
    var orig = ai[fn];
    ai[fn] = function () {
      JKWatch.inflight++; JKWatch.inflightAt = Date.now();
      var pr = orig.apply(this, arguments);
      if (pr && typeof pr.then == "function") {
        pr.then(function () { JKWatch.inflight = Math.max(0, JKWatch.inflight - 1); },
                function () { JKWatch.inflight = Math.max(0, JKWatch.inflight - 1); });
      } else JKWatch.inflight = Math.max(0, JKWatch.inflight - 1);
      return pr;
    };
  });
  ai.__jkWrapped = true;
}
setInterval(function () {
  try {
    if (typeof activePlayer == "undefined" || !activePlayer) return;
    JKWrapAI(corp); JKWrapAI(runner);
    var sigH = (currentPhase ? currentPhase.identifier : "") + "|" + JK.log.length + "|" + (activePlayer == corp ? "C" : "R");
    if (sigH != JKWatch.sigH) { JKWatch.sigH = sigH; JKWatch.humanSince = 0; }
    if (activePlayer.AI == null) {
      if ($("body").hasClass("x1-waiting")) { JKWatch.humanSince = 0; JKWatch.since = Date.now(); return; }
      // vez do humano sem nenhum botão nem janela na tela: o laço do jogo não foi retomado
      var nothing = !$("#footer button:visible").length && !$("#modal").is(":visible") &&
        !$("#physical-modal").is(":visible") && !$("#card-view").is(":visible") &&
        !(currentPhase && /wins/.test(currentPhase.title || ""));
      if (!nothing) { JKWatch.humanSince = 0; JKWatch.since = Date.now(); return; }
      if (!JKWatch.humanSince) { JKWatch.humanSince = Date.now(); return; }
      if (Date.now() - JKWatch.humanSince > 6000) {
        JKWatch.humanSince = 0;
        JKWatch.kicks++;
        console.warn("Jack In: tela sem opções na vez do jogador em " + (currentPhase ? currentPhase.identifier : "?") + " — retomando");
        Main();
      }
      return;
    }
    JKWatch.humanSince = 0;
    if ($("#physical-modal").is(":visible")) { JKWatch.since = Date.now(); return; }
    var sig = (currentPhase ? currentPhase.identifier : "") + "|" + (typeof executingCommand != "undefined" ? executingCommand : "") + "|" +
      JK.log.length + "|" + corp.creditPool + "|" + runner.creditPool + "|" + runner.clickTracker + "|" + corp.clickTracker;
    if (sig != JKWatch.sig) { JKWatch.sig = sig; JKWatch.since = Date.now(); return; }
    var idle = Date.now() - JKWatch.since;
    var stale = JKWatch.inflight == 0 ? idle > 12000 : (Date.now() - JKWatch.inflightAt > 60000 && idle > 60000);
    if (stale) {
      JKWatch.kicks++;
      JKWatch.inflight = 0;
      JKWatch.since = Date.now();
      console.warn("Jack In: IA parada em " + sig + " — retomando");
      Main();
    }
  } catch (e) {}
}, 3000);

// ------------------------------------------- habilidades de cartas em Archives (Petty Cash)
// botão próprio no rodapé, para não ficar escondido dentro de "Usar habilidade"
function JKArchivesButtons() {
  try {
    var $f = $("#footer");
    if (!activePlayer || activePlayer.AI != null || !$("#footerbutton-trigger").length) { $f.find(".jk-arch-btn").remove(); return; }
    var opts = (phaseOptions && phaseOptions.trigger) || [];
    var want = [];
    opts.forEach(function (o) { if (o.card && o.card.cardLocation === corp.archives.cards && want.indexOf(o) < 0) want.push(o); });
    var key = want.map(function (o) { return o.card.title; }).join("|");
    if ($f.attr("data-jk-arch") === key && $f.find(".jk-arch-btn").length === want.length) return;
    $f.find(".jk-arch-btn").remove();
    $f.attr("data-jk-arch", key);
    want.forEach(function (o) {
      $("<button class='button jk-arch-btn' type='button'>").text(o.card.title + " (de Archives)").on("click", function () {
        ExecuteChosen("trigger");
        var k = validOptions.indexOf(o);
        if (k > -1) ResolveChoice(k);
      }).prependTo($f);
    });
  } catch (e) {}
}
(function () {
  var mo = new MutationObserver(function () { JKArchivesButtons(); });
  $(function () { var f = document.getElementById("footer"); if (f) mo.observe(f, { childList: true }); });
})();

// ------------------------------------------------ ampliação ao passar o mouse
// Mostra a carta grande ao lado do cursor (imagem; sem imagem, uma placa com os dados).
var JKZoom = { el: null, cur: null };
function JKZoomHTML(title, $src) {
  var c = (typeof RV != "undefined" && RV.db[title]) || null;
  if (!c) return "";
  var code = c.code, img = "";
  if (code && !JK.imgBad[code]) {
    var src = JK.imgGood[code] || JKImgFirst(code);
    if (src) img = "<img src='" + src + "' data-code='" + code + "' alt='' referrerpolicy='no-referrer' onload='JKImgOk(this);this.parentNode.classList.add(\"has-img\")' onerror='JKImgNext(this)'>";
  }
  var stats = [];
  if (c.co != null) stats.push((c.ty == "ice" || c.ty == "asset" || c.ty == "upgrade" ? "Rez " : c.ty == "operation" || c.ty == "event" ? "Custo " : "Instalar ") + c.co);
  if (c.str != null) stats.push("Força " + c.str);
  if (c.adv != null) stats.push("Avanço " + c.adv + " · " + c.ap + " pt");
  if (c.tc != null) stats.push("Trash " + c.tc);
  if (c.mu != null) stats.push(c.mu + " MU");
  var badges = $src && $src.find(".jk-badges").length ? "<div class='jkz-state'>" + $src.find(".jk-badges").html() + "</div>" : "";
  return "<div class='jkz-card" + (JK.imgGood[code] ? " has-img" : "") + "'>" + img +
    "<div class='jkz-plate'><b>" + JKEsc(c.t) + "</b><span class='jkz-type'>" + JKEsc((typeof TYPES != "undefined" && TYPES[c.ty]) || c.ty || "") + (c.kw ? " · " + JKEsc(c.kw) : "") + "</span>" +
    (stats.length ? "<span class='jkz-stats'>" + stats.join(" · ") + "</span>" : "") +
    "<p>" + JKEsc(c.tx || "").replace(/\n/g, "<br>") + "</p></div></div>" + badges;
}
function JKZoomShow(card) {
  var $c = $(card), title = $c.attr("data-title");
  if (!title) return;
  if (!JKZoom.el) JKZoom.el = $("<div id='jk-zoom' aria-hidden='true'></div>").appendTo("body");
  if (JKZoom.cur !== card) { JKZoom.el.html(JKZoomHTML(title, $c)); JKZoom.cur = card; }
  if (!JKZoom.el.html()) return;
  var r = card.getBoundingClientRect(), W = 270, H = 380, gap = 14;
  var x = r.right + gap;
  if (x + W > window.innerWidth - 8) x = r.left - gap - W;
  if (x < 8) x = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
  var y = Math.max(60, Math.min(window.innerHeight - H - 12, r.top + r.height / 2 - H / 2));
  JKZoom.el.css({ left: x + "px", top: y + "px" }).addClass("on");
}
function JKZoomHide() { if (JKZoom.el) JKZoom.el.removeClass("on"); JKZoom.cur = null; }
$(function () {
  if (!window.matchMedia || !window.matchMedia("(hover: hover)").matches) return; // telas de toque: só o clique
  $(document).on("mouseenter", ".jk-card[data-title]", function () { JKZoomShow(this); });
  $(document).on("mouseleave", ".jk-card[data-title]", JKZoomHide);
  $(document).on("mousedown scroll", JKZoomHide);
  // a mesa é redesenhada o tempo todo: some a ampliação se a carta sair da tela
  setInterval(function () { if (JKZoom.cur && !document.body.contains(JKZoom.cur)) JKZoomHide(); }, 400);
});
