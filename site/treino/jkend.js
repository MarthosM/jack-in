// =====================================================================
// Jack In Treino — tela de fim de partida
// Quando alguém vence, uma tela com a arte do lado vencedor diz se você ganhou ou perdeu, por quê
// e o placar. Vale contra a IA, nas cartas físicas e no X1 (o convidado recebe o fim junto com a visão).
// Licença: GPL-3.0.
// =====================================================================
var JKEnd = { data: null, shown: false };

function JKEndEN() { return typeof JKLang != "undefined" && JKLang == "en"; }

// lado da pessoa nesta tela ("r" ou "c"); null se as duas pontas forem IA
function JKEndMe() {
  try {
    if (typeof X1 != "undefined" && X1.side && (X1.role == "host" || X1.role == "guest")) return X1.side == "c" ? "c" : "r";
    if (typeof PhysicalHuman == "function" && PhysicalHuman()) return PhysicalHuman() == corp ? "c" : "r";
    if (typeof runner != "undefined" && typeof corp != "undefined") {
      if (runner.AI == null && corp.AI != null) return "r";
      if (corp.AI == null && runner.AI != null) return "c";
      if (corp.AI == null && runner.AI == null) return viewingPlayer == corp ? "c" : "r";
    }
  } catch (e) {}
  return null;
}

// motivo do fim a partir da mensagem do motor
function JKEndKind(msg) {
  msg = String(msg || "");
  if (/flatline/i.test(msg)) return "flatline";
  if (/empty R&D/i.test(msg)) return "deckout";
  if (/agenda points/i.test(msg)) return "points";
  return "other";
}

function JKEndTexts(d, me) {
  var en = JKEndEN(), win = d.winner == me, w = d.winner, pts = w == "r" ? d.pr : d.pc;
  var t = {};
  t.title = win ? (en ? "VICTORY" : "VITÓRIA") : (en ? "DEFEAT" : "DERROTA");
  t.kicker = w == "r" ? (en ? "The Runner wins" : "O Runner venceu") : (en ? "The Corp wins" : "A Corp venceu");
  var k = d.kind, s = "";
  if (k == "points") {
    if (w == "r") s = win ? (en ? "You stole " + pts + " agenda points. The Corp's secrets are yours now." : "Você roubou " + pts + " pontos de agenda. Os segredos da Corp agora são seus.")
                          : (en ? "The Runner stole " + pts + " agenda points from your servers." : "O Runner roubou " + pts + " pontos de agenda dos seus servidores.");
    else s = win ? (en ? "You scored " + pts + " agenda points. The Corp's plan is complete." : "Você pontuou " + pts + " pontos de agenda. O plano da Corp está completo.")
                 : (en ? "The Corp scored " + pts + " agenda points before you could stop it." : "A Corp pontuou " + pts + " pontos de agenda antes que você a impedisse.");
  } else if (k == "flatline") {
    s = win ? (en ? "Flatline: the Runner took more damage than their hand could hold." : "Flatline: o Runner levou mais dano do que a mão aguentava.")
            : (en ? "Flatline: you took more damage than your hand could hold." : "Flatline: você levou mais dano do que a sua mão aguentava.");
  } else if (k == "deckout") {
    s = win ? (en ? "The Corp's R&D ran out: it had to draw and had no cards left." : "O R&D da Corp acabou: ela precisou comprar e não tinha mais cartas.")
            : (en ? "Your R&D ran out: the Corp loses when it must draw and has no cards left." : "O seu R&D acabou: a Corp perde quando precisa comprar e não tem mais cartas.");
  } else s = d.msg || "";
  t.reason = s;
  t.score = (en ? "Agenda points" : "Pontos de agenda") + " · Corp " + d.pc + " · Runner " + d.pr + (d.ap ? " · " + (en ? "goal " : "meta ") + d.ap : "");
  return t;
}

function JKEndShow(d, me) {
  if (!d || JKEnd.shown) return;
  if (me == null) return;
  JKEnd.shown = true; JKEnd.data = d;
  var en = JKEndEN(), win = d.winner == me, t = JKEndTexts(d, me);
  var art = "images/fim-" + (d.winner == "r" ? "runner" : "corp") + ".svg";
  var guest = typeof X1 != "undefined" && X1.role == "guest";
  var x1 = typeof X1 != "undefined" && (X1.role == "host" || X1.role == "guest");
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  $("#jk-end").remove();
  var html =
    "<div id='jk-end' class='" + (win ? "jke-win" : "jke-lose") + " jke-" + (d.winner == "r" ? "runner" : "corp") + "' role='dialog' aria-modal='true' aria-labelledby='jke-title'>" +
    "<div class='jke-box'>" +
    "<div class='jke-art' style=\"background-image:url('" + art + "')\"><div class='jke-shade'></div>" +
    "<p class='jke-kicker'>" + esc(t.kicker) + "</p>" +
    "<h1 id='jke-title' class='jke-title' data-text='" + esc(t.title) + "'>" + esc(t.title) + "</h1></div>" +
    "<div class='jke-body'><p class='jke-reason'>" + esc(t.reason) + "</p><p class='jke-score'>" + esc(t.score) + "</p>" +
    "<div class='jke-acts'>" +
    "<button type='button' class='jke-btn' data-jke='board'>" + (en ? "See the table" : "Ver a mesa") + "</button>" +
    (x1 ? "" : "<button type='button' class='jke-btn jke-pri' data-jke='again'>" + (en ? "Play again" : "Jogar de novo") + "</button>") +
    "<button type='button' class='jke-btn" + (x1 ? " jke-pri" : "") + "' data-jke='home'>" + (en ? "Back to start" : "Voltar ao início") + "</button>" +
    "</div></div></div></div>";
  $("body").append(html);
  setTimeout(function () { $("#jk-end").addClass("on"); $("#jk-end [data-jke]").last().trigger("focus"); }, 30);
  // na mesa fica um botão para reabrir a tela
  if (!$("#jk-end-reopen").length) $("body").append("<button type='button' id='jk-end-reopen' hidden>" + esc(t.title) + " · " + (en ? "result" : "resultado") + "</button>");
}

(function () {
  $(document).on("click", "[data-jke]", function () {
    var a = $(this).attr("data-jke");
    if (a == "board") { $("#jk-end").removeClass("on").hide(); $("#jk-end-reopen").prop("hidden", false); }
    else if (a == "again") location.reload();
    else if (a == "home") location.href = "index.html";
  });
  $(document).on("click", "#jk-end-reopen", function () { $(this).prop("hidden", true); $("#jk-end").show().addClass("on"); });
  $(document).on("keydown", function (e) { if (e.key == "Escape" && $("#jk-end").hasClass("on")) $("#jk-end [data-jke=board]").click(); });

  if (typeof PlayerWin != "function") return; // sala do convidado: o fim chega pela visão do anfitrião
  var _PW = PlayerWin;
  PlayerWin = function (player, msgstr) {
    var r = _PW.apply(this, arguments);
    try {
      var d = { winner: player == corp ? "c" : "r", msg: msgstr, kind: JKEndKind(msgstr), pc: AgendaPoints(corp), pr: AgendaPoints(runner), ap: typeof AgendaPointsToWin == "function" ? AgendaPointsToWin() : 0 };
      var m = /reached (\d+) agenda/.exec(msgstr || "");
      if (m) { if (d.winner == "c") d.pc = Math.max(d.pc, +m[1]); else d.pr = Math.max(d.pr, +m[1]); }
      JKEnd.data = d;
      var me = JKEndMe();
      // um instante para a última jogada aparecer na mesa antes da tela
      setTimeout(function () { JKEndShow(d, me); }, 1400);
    } catch (e) {}
    return r;
  };
})();
