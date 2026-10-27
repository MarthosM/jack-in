// =====================================================================
// Jack In — Treino: painel "Corp revelou" + visualizador de cartas
// Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================
var RV = {
  db: {},        // título -> dados da carta (cards.json)
  entries: [],   // {kind, title, where, n}
  count: 0,
};

fetch("cards.json").then(function (r) { return r.json(); }).then(function (d) {
  for (var id in d) RV.db[d[id].t] = d[id];
  RevealRender();
}).catch(function () {});

var TYPES = { ice: "Ice", agenda: "Agenda", asset: "Asset", upgrade: "Upgrade", operation: "Operation", event: "Event", hardware: "Hardware", resource: "Resource", program: "Program", identity: "Identity" };
var REVEAL_KIND = {
  rez: "Rezzou",
  play: "Jogou",
  access: "Você acessou",
  score: "Pontuou",
  expose: "Exposta",
  reveal: "Revelou",
  install: "Instalou",
  steal: "Roubou",
};

function RevealWhere(card) {
  try {
    var s = GetServer(card);
    if (s) return ServerName(s);
  } catch (e) {}
  return "";
}

function RevealOpp() {
  try { if (typeof PhysicalHuman == "function" && PhysicalHuman() == corp) return runner; } catch (e) {}
  return corp;
}
function RevealOppName() { return RevealOpp() == runner ? "Runner" : "Corp"; }

function RevealAdd(kind, card) {
  if (!card || !card.player) return;
  // com uma IA, só guarda o lado dela; com dois humanos (X1) guarda os dois lados e filtra ao mostrar
  var x1 = typeof runner != "undefined" && runner.AI == null && corp.AI == null;
  if (!x1 && card.player != RevealOpp()) return;
  // o Runner não "revela" ao acessar suas próprias cartas — isso só vale para a Corp
  if (card.player == runner && (kind == "access" || kind == "score" || kind == "expose")) return;
  var title = card.title;
  if (!title) return;
  // evita duplicar o mesmo evento em sequência (gatilhos podem disparar mais de uma vez)
  var last = RV.entries[RV.entries.length - 1];
  if (last && last.kind == kind && last.card === card) return;
  RV.count++;
  var where = RevealWhere(card);
  if (!where && kind == "access" && typeof attackedServer != "undefined" && attackedServer) {
    try { where = ServerName(attackedServer); } catch (e) {}
  }
  RV.entries.push({ kind: kind, title: title, where: where, n: RV.count, card: card, player: card.player });
  RevealRender(true);
}

(function () {
  if (typeof AutomaticTriggers != "function") return;
  var _AutomaticTriggers = AutomaticTriggers;
  AutomaticTriggers = function (callbackName, parameters) {
    try {
      var card = parameters && parameters[0];
      if (callbackName == "automaticOnRez") RevealAdd("rez", card);
      else if (callbackName == "automaticOnPlay") RevealAdd("play", card);
      else if (callbackName == "automaticOnAccess") RevealAdd("access", card);
      else if (callbackName == "automaticOnInstall" && card && card.player == runner) RevealAdd("install", card);
    } catch (e) {}
    return _AutomaticTriggers.apply(this, arguments);
  };
  var _Score = Score;
  Score = function (card) {
    try { RevealAdd("score", card); } catch (e) {}
    return _Score.apply(this, arguments);
  };
  var _Expose = Expose;
  Expose = function (card) {
    try { RevealAdd("expose", card); } catch (e) {}
    return _Expose.apply(this, arguments);
  };
})();

// ---------------------------------------------------------------- painel
function RevealRender(flash) {
  var $p = $("#reveal-panel");
  if (!$p.length) return;
  if (typeof runner == "undefined" || !runner) return;
  var opp = RevealOpp();
  var idt = opp && opp.identityCard ? opp.identityCard.title : "";
  $("#reveal-who").text(RevealOppName());
  var html = "";
  if (idt) html += "<div class='rv-id'><span class='rv-k'>Identidade</span><a class='rv-card' data-title=\"" + RevealEsc(idt) + "\">" + RevealEsc(idt) + "</a></div>";
  var entries = RV.entries.filter(function (e) { return !e.player || e.player == opp; });
  if (!entries.length) html += "<p class='rv-empty'>" + (RevealOpp() == runner ? "Nada ainda. Eventos jogados e cartas instaladas pelo Runner aparecem aqui." : "Nada revelado ainda. Operações jogadas, ices rezzados e cartas acessadas aparecem aqui.") + "</p>";
  html += "<ol class='rv-list'>";
  for (var i = entries.length - 1; i >= 0; i--) {
    var e = entries[i];
    var db = RV.db[e.title] || {};
    var type = db.ty ? (TYPES[db.ty] || db.ty) : "";
    html += "<li class='rv-" + e.kind + "'><span class='rv-k'>" + REVEAL_KIND[e.kind] + (type ? " · " + type : "") + (e.where ? " · " + RevealEsc(e.where) : "") + "</span>" +
      "<a class='rv-card' data-title=\"" + RevealEsc(e.title) + "\">" + RevealEsc(e.title) + "</a></li>";
  }
  html += "</ol>";
  $("#reveal-body").html(html);
  $("#reveal-count").text(entries.length);
  if (flash) {
    $p.removeClass("rv-flash");
    void $p[0].offsetWidth;
    $p.addClass("rv-flash");
  }
}
function RevealEsc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------- visualizador de carta
function RevealFindTitle(text) {
  if (!text) return null;
  var t = String(text).trim();
  if (RV.db[t]) return t;
  t = t.replace(/^\d+\s+/, "").replace(/\s*\(.*\)\s*$/, "").trim();
  if (RV.db[t]) return t;
  // prefixo mais longo que bata
  var best = null;
  for (var k in RV.db) if (t.indexOf(k) == 0 && (!best || k.length > best.length)) best = k;
  return best;
}

function RevealShowCard(title) {
  var c = RV.db[title];
  if (!c) return;
  var stats = [];
  if (c.co != null) stats.push((c.ty == "ice" || c.ty == "asset" || c.ty == "upgrade" ? "Custo de rez " : c.ty == "operation" || c.ty == "event" ? "Custo " : "Custo de instalar ") + c.co);
  if (c.str != null) stats.push("Força " + c.str);
  if (c.adv != null) stats.push("Avanço " + c.adv);
  if (c.ap != null) stats.push(c.ap + " ponto" + (c.ap > 1 ? "s" : ""));
  if (c.tc != null) stats.push("Trash " + c.tc);
  if (c.mu != null) stats.push(c.mu + " MU");
  var img = c.code && typeof JKImgTag == "function" ? JKImgTag(c.code, "rv-img") : "";
  var html =
    "<div class='rv-view'>" + img +
    "<div class='rv-text'><h2>" + RevealEsc(c.t) + "</h2>" +
    "<p class='rv-type'>" + (TYPES[c.ty] || c.ty || "") + (c.kw ? ": " + RevealEsc(c.kw) : "") + "</p>" +
    (stats.length ? "<p class='rv-stats'>" + stats.join(" · ") + "</p>" : "") +
    "<p class='rv-body'>" + RevealEsc(c.tx || "").replace(/\n/g, "<br>") + "</p>" +
    (c.fl ? "<p class='rv-flavor'>" + RevealEsc(c.fl) + "</p>" : "") +
    RevealActionButtons(title) +
    "</div></div>";
  $("#card-view-content").html(html);
  $("#card-view").css("display", "flex");
}

// carta em Archives com habilidade (Petty Cash) que agora não pode ser usada: diz por quê
function RevealWhyNot(title) {
  try {
    if (typeof PhysicalHuman != "function" || typeof corp == "undefined" || PhysicalHuman() != corp) return "";
    var c = corp.archives.cards.find(function (x) { return x.title == title && x.abilitiesFromArchives; });
    if (!c) return "";
    var why = "";
    if (playerTurn != corp || !currentPhase || currentPhase.identifier != "Corp 2.2") why = "Só pode ser usada na sua fase de ações.";
    else if (typeof c.JKCFirstAction == "function" && !c.JKCFirstAction.call(c)) why = "Só pode ser jogada antes de terminar a primeira ação do turno.";
    else if (!CheckCredits(corp, 3)) why = "Precisa de 3¢ para jogar.";
    return why ? "<p class='rv-why'>Em Archives · " + why + "</p>" : "";
  } catch (e) { return ""; }
}

// se o jogador humano pode usar uma habilidade desta carta agora, oferece o botão no visualizador
function RevealActionButtons(title) {
  try {
    if (typeof X1 != "undefined" && X1.role == "guest") return X1.canTrigger(title) ? "<div class='rv-actions'><button type='button' class='rv-act' data-cmd='trigger'>Usar habilidade desta carta</button></div>" : "";
    if (typeof activePlayer == "undefined" || !activePlayer || activePlayer.AI != null) return "";
    if (typeof X1 != "undefined" && X1.role == "host" && activePlayer == X1.guestSide()) return "";
    var opts = (phaseOptions && phaseOptions.trigger) || [];
    var mine = opts.filter(function (o) { return o.card && o.card.title == title; });
    if (!mine.length) return RevealWhyNot(title);
    return "<div class='rv-actions'><button type='button' class='rv-act' data-cmd='trigger'>Usar habilidade desta carta</button></div>";
  } catch (e) { return ""; }
}

$(function () {
  $(document).on("click", ".rv-act", function () {
    $("#card-view").hide();
    try { ExecuteChosen($(this).attr("data-cmd")); } catch (e) { console.error(e); }
  });
  var panel =
    "<aside id='reveal-panel' aria-label='Cartas reveladas pela Corp'>" +
    "<button id='reveal-toggle' type='button'><span id='reveal-who'>Corp</span> revelou <span id='reveal-count'>0</span></button>" +
    "<div id='reveal-body'></div></aside>" +
    "<div id='card-view' class='phys-modal'><div class='phys-box rv-box'>" +
    "<button id='card-view-close' type='button' aria-label='Fechar'>×</button><div id='card-view-content'></div></div></div>";
  $("body").append(panel);
  var stored = null;
  try { stored = localStorage.getItem("jackin-reveal-collapsed"); } catch (e) {}
  if (stored == "1" || (stored === null && window.innerWidth < 900)) $("#reveal-panel").addClass("rv-collapsed");
  $("#reveal-toggle").on("click", function () {
    $("#reveal-panel").toggleClass("rv-collapsed");
    try { localStorage.setItem("jackin-reveal-collapsed", $("#reveal-panel").hasClass("rv-collapsed") ? "1" : "0"); } catch (e) {}
  });
  $(document).on("click", ".rv-card", function () { RevealShowCard($(this).attr("data-title")); });
  // clique em qualquer carta visível no tabuleiro
  $(document).on("click", "#output .text-card, #output h4", function () {
    var t = RevealFindTitle($(this).text());
    if (t) RevealShowCard(t);
  });
  $("#card-view, #card-view-close").on("click", function (e) {
    if (e.target === this) $("#card-view").hide();
  });
  $(document).on("keydown", function (e) { if (e.key == "Escape") $("#card-view").hide(); });
  RevealRender();
});
