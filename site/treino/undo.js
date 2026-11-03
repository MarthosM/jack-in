// =====================================================================
// Jack In — Treino: desfazer a última instalação
// Logo depois de instalar uma carta (com clique, na fase de ações), o jogador
// humano pode clicar na carta e escolher "Desfazer instalação": a carta volta
// para a mão e o clique e os créditos voltam. Qualquer outra ação depois da
// instalação (ou qualquer efeito que mude a mesa) cancela essa possibilidade.
// Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

var JKUndo = { snap: null, busy: false };

function JKUndoMainPhase() {
  return typeof currentPhase != "undefined" && currentPhase &&
    (currentPhase.identifier == "Corp 2.2" || currentPhase.identifier == "Runner 1.3");
}
function JKUndoHuman(p) {
  if (!p || p.AI != null) return false;
  // dois humanos: o convidado não desfaz (o motor roda no anfitrião)
  if (typeof X1 != "undefined" && X1.role == "guest") return false;
  if (typeof X1 != "undefined" && X1.role == "host" && X1.started && typeof X1.mySide == "function" && p !== X1.mySide()) return false;
  return true;
}
// números da mesa que uma instalação simples não muda (fora a mão, os cliques e os créditos de quem instala)
function JKUndoFingerprint(p) {
  var o = p == corp ? runner : corp;
  return [
    runner.stack.length, runner.heap.length, corp.RnD.cards.length, corp.archives.cards.length,
    corp.scoreArea.length, runner.scoreArea.length, runner.tags, runner.coreDamage, corp.badPublicity,
    o.creditPool, o.clickTracker, PlayerHand(o).length,
  ].join("|");
}
// créditos guardados em cartas (ex.: créditos recorrentes) que podem ter pago a instalação
function JKUndoCardCredits(p) {
  var out = [];
  InstalledCards(p).forEach(function (c) { out.push({ c: c, credits: c.credits }); });
  return out;
}
function JKUndoPrimitives(card) {
  var out = {};
  for (var k in card) {
    var v = card[k];
    if (v === null || typeof v == "number" || typeof v == "boolean" || typeof v == "string" || typeof v == "undefined") out[k] = v;
  }
  return out;
}

(function () {
  if (typeof Install != "function") return;
  var _Install = Install;
  Install = function (card, destination) {
    try {
      if (!JKUndo.busy && card && JKUndoMainPhase() && typeof executingCommand != "undefined" && executingCommand == "install" &&
          JKUndoHuman(card.player) && activePlayer === card.player && PlayerHand(card.player).indexOf(card) > -1) {
        var p = card.player;
        JKUndo.snap = {
          card: card, player: p, phaseId: currentPhase.identifier,
          from: card.cardLocation, fromIndex: card.cardLocation.indexOf(card),
          clicks: p.clickTracker, credits: p.creditPool,
          cardCredits: JKUndoCardCredits(p),
          fields: JKUndoPrimitives(card),
          remotes: corp.remoteServers.slice(), serverIncrementer: corp.serverIncrementer,
          hand: PlayerHand(p).length, fp: JKUndoFingerprint(p),
          done: false,
        };
      } else if (!JKUndo.busy) JKUndo.snap = null;
    } catch (e) { JKUndo.snap = null; }
    return _Install.apply(this, arguments);
  };
})();

// a instalação terminou quando a fase de ações volta com a carta já instalada
function JKUndoCheckDone() {
  var s = JKUndo.snap;
  if (!s || s.done) return;
  if (JKUndoMainPhase() && currentPhase.identifier == s.phaseId && activePlayer === s.player && CheckInstalled(s.card)) s.done = true;
}

// qualquer comando ou escolha depois da instalação concluída cancela o desfazer
(function () {
  ["Execute", "ExecuteChosen", "ResolveChoice"].forEach(function (fn) {
    if (typeof window[fn] != "function") return;
    var _f = window[fn];
    window[fn] = function () {
      if (!JKUndo.busy) {
        JKUndoCheckDone();
        if (JKUndo.snap && JKUndo.snap.done) JKUndo.snap = null;
      }
      return _f.apply(this, arguments);
    };
  });
})();

// pode desfazer a instalação desta carta agora?
function JKUndoAvailable(title) {
  var s = JKUndo.snap;
  if (!s) return false;
  JKUndoCheckDone();
  if (!s.done) return false;
  if (title && s.card.title !== title) return false;
  if (!JKUndoMainPhase() || currentPhase.identifier != s.phaseId || activePlayer !== s.player) return false;
  if (!CheckInstalled(s.card)) return false;
  if (s.card.rezzed && s.player == corp) return false; // já foi rezzada
  // nada mais mudou: só a carta saiu da mão
  if (PlayerHand(s.player).length != s.hand - 1) return false;
  if (JKUndoFingerprint(s.player) != s.fp) return false;
  if (s.card.hostedCards && s.card.hostedCards.length) return false;
  return true;
}

function JKUndoInstall() {
  if (!JKUndoAvailable()) { JKUndo.snap = null; return false; }
  var s = JKUndo.snap, c = s.card, p = s.player;
  JKUndo.busy = true;
  var wasPhys = typeof Physical != "undefined" ? Physical.resolving : false;
  try {
    if (typeof Physical != "undefined") Physical.resolving = true;
    MoveCard(c, s.from);
    // volta para a mesma posição da mão
    var i = s.from.indexOf(c);
    if (i > -1 && s.fromIndex < s.from.length) { s.from.splice(i, 1); s.from.splice(s.fromIndex, 0, c); }
    c.cardLocation = s.from;
    c.host = null;
    for (var k in s.fields) c[k] = s.fields[k];
    p.clickTracker = s.clicks;
    p.creditPool = s.credits;
    s.cardCredits.forEach(function (x) { if (x.c) x.c.credits = x.credits; });
    // servidor remoto criado só para esta carta: some de novo
    if (p == corp) {
      for (var r = corp.remoteServers.length - 1; r > -1; r--) {
        var sv = corp.remoteServers[r];
        if (s.remotes.indexOf(sv) < 0 && sv.root.length == 0 && sv.ice.length == 0) corp.remoteServers.splice(r, 1);
      }
      corp.serverIncrementer = s.serverIncrementer;
    }
    Log((typeof JKIsEN == "function" && JKIsEN() ? "Install undone: " : "Instalação desfeita: ") + GetTitle(c, true));
    if (typeof PhysicalNotice == "function" && typeof Physical != "undefined" && Physical.enabled && typeof PhysicalHuman == "function" && PhysicalHuman() == p) {
      PhysicalNotice((typeof JKIsEN == "function" && JKIsEN() ? "Take " + c.title + " back into your hand." : "Volte " + c.title + " para a sua mão."));
    }
  } finally {
    if (typeof Physical != "undefined") Physical.resolving = wasPhys;
    JKUndo.snap = null;
  }
  JKUndo.busy = false;
  Render();
  try { Main(); } catch (e) {}
  if (typeof JKSchedule == "function") JKSchedule();
  return true;
}

// botão na janela da carta
function JKUndoButtonHTML(title, loc) {
  if (loc == "hand" || !JKUndoAvailable(title)) return "";
  var en = typeof JKIsEN == "function" && JKIsEN();
  var s = JKUndo.snap;
  var back = [];
  back.push(en ? "1 click" : "1 clique");
  var spent = s.credits - s.player.creditPool;
  s.cardCredits.forEach(function (x) { if (x.c && x.c.credits != x.credits) spent += (x.credits || 0) - (x.c.credits || 0); });
  if (spent > 0) back.push(spent + "¢");
  return "<div class='rv-actions'><button type='button' class='rv-act rv-undo' data-jk-undo='1'>" +
    (en ? "Undo install" : "Desfazer instalação") + " · " + (en ? "back to hand, " : "volta para a mão, ") + back.join(" + ") + "</button></div>";
}
// a janela da carta ganha o botão de desfazer
(function () {
  if (typeof RevealActionButtons != "function") return;
  var _RAB = RevealActionButtons;
  RevealActionButtons = function (title, loc) {
    var u = "";
    try { u = JKUndoButtonHTML(title, loc || "table"); } catch (e) {}
    return u + _RAB.apply(this, arguments);
  };
})();
$(function () {
  $(document).on("click", "[data-jk-undo]", function (e) {
    e.stopImmediatePropagation();
    $("#card-view").hide();
    try { JKUndoInstall(); } catch (err) { console.error(err); JKUndo.busy = false; }
  });
});
