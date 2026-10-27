// =====================================================================
// Jack In — Treino: modo "cartas físicas"
// O jogador humano usa o próprio baralho físico. O motor (Chiriboga)
// mantém o baralho dele como cartas ocultas: toda vez que uma carta sai
// do baralho do humano (compra, mulligan, efeito), o motor pergunta qual
// carta física saiu e troca a identidade da carta "sorteada" pela real.
// Como a ordem do baralho digital é fictícia, a troca é legítima.
// Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

// parâmetros também podem vir do sessionStorage (quando a query string não chega)
(function () {
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem("jackin-params") || "null"); } catch (e) {}
  var _URIParameter = URIParameter;
  URIParameter = function (name) {
    var v = _URIParameter(name);
    if (v === "" && !location.search && saved && saved[name] != null) return String(saved[name]);
    return v;
  };
})();

var Physical = {
  enabled: URIParameter("physical") !== "0",
  pending: [],      // cartas que saíram do baralho e ainda não foram identificadas
  drawnArrays: [],  // arrays repassados a gatilhos "ao comprar" (para corrigir referências)
  resolving: false,
  rndKnown: 0,      // Corp humana: quantas cartas do topo do R&D já foram identificadas
};

function PhysicalHuman() {
  if (runner.AI == null) return runner;
  if (corp.AI == null) return corp;
  return null;
}
function PhysicalDeck(p) { return p == runner ? runner.stack : corp.RnD.cards; }
function PhysicalHand(p) { return p == runner ? runner.grip : corp.HQ.cards; }

// 1) Detecta qualquer carta saindo do baralho do humano
(function () {
  var _MoveCardTriggers = MoveCardTriggers;
  MoveCardTriggers = function (card, locationfrom, locationto) {
    _MoveCardTriggers(card, locationfrom, locationto);
    if (!Physical.enabled || Physical.resolving) return;
    var human = PhysicalHuman();
    if (!human) return;
    // carta saiu da sua mão por efeito do jogo (dano, descarte): avisa qual mover na mesa física
    if (human == runner && locationfrom === runner.grip && locationto !== runner.grip &&
        !(currentPhase && String(currentPhase.title || "").indexOf("Discard") > -1) &&
        locationto !== runner.resolvingCards && locationto !== runner.installingCards) {
      PhysicalQueueNotice("Tire da sua mão: " + card.title + (locationto === runner.heap ? " (vai para o heap)" : ""));
    }
    if (human == corp && locationfrom === corp.HQ.cards && locationto !== corp.HQ.cards &&
        !(currentPhase && String(currentPhase.title || "").indexOf("Discard") > -1) &&
        locationto !== corp.resolvingCards && locationto !== corp.installingCards &&
        locationto !== corp.RnD.cards && playerTurn == runner) {
      PhysicalQueueNotice("Tire do seu HQ: " + card.title + (locationto === runner.scoreArea ? " (roubada pelo Runner)" : locationto === corp.archives.cards ? " (vai para Archives)" : ""));
    }
    if (human == corp && locationfrom === corp.RnD.cards && playerTurn == runner &&
        (locationto === runner.scoreArea || locationto === corp.archives.cards)) {
      PhysicalQueueNotice("Tire do topo do seu R&D: " + card.title + (locationto === runner.scoreArea ? " (roubada pelo Runner)" : " (vai para Archives)"));
    }
    if (locationfrom === PhysicalDeck(human) && locationto !== PhysicalDeck(human)) {
      // Corp: carta do topo já identificada (ex.: acessada antes) sai sem perguntar
      if (human == corp && Physical.rndKnown > 0) Physical.rndKnown--;
      else Physical.pending.push(card);
    }
    if (human == corp && locationto === corp.RnD.cards && locationfrom !== corp.RnD.cards) Physical.rndKnown++;
    // carta voltou ao baralho antes de ser identificada (ex.: mulligan): não pergunta mais
    if (locationto === PhysicalDeck(human)) {
      var i = Physical.pending.indexOf(card);
      if (i > -1) Physical.pending.splice(i, 1);
    }
  };

  var _Shuffle = Shuffle;
  Shuffle = function (arr) {
    if (typeof corp != "undefined" && corp.RnD && arr === corp.RnD.cards) Physical.rndKnown = 0;
    return _Shuffle.apply(this, arguments);
  };
  var _AT = AutomaticTriggers;
  AutomaticTriggers = function (callbackName, parameters) {
    try {
      if (Physical.enabled && PhysicalHuman() == corp) {
        if (callbackName == "automaticOnBreach" && parameters && parameters[0] === corp.RnD) {
          var n = 1 + ModifyingTriggers("modifyBreachAccess", null, 0);
          n = Math.min(n, corp.RnD.cards.length);
          for (var k = Physical.rndKnown; k < n; k++) Physical.pending.push({ rnd: k });
        }
        if (callbackName == "automaticOnAccess" && parameters && parameters[0] && parameters[0].cardLocation === corp.HQ.cards) {
          PhysicalQueueNotice("O Runner acessou do seu HQ: " + parameters[0].title + " (mostre essa carta)");
        }
      }
    } catch (e) {}
    return _AT.apply(this, arguments);
  };

  // a mão inicial é anunciada antes da identificação; suprime e reanuncia depois
  var _Log = Log;
  Log = function (src) {
    if (Physical.enabled && typeof src == "string" && src.indexOf("Your hand is") == 0) return;
    return _Log.apply(this, arguments);
  };

  // guarda os arrays de cartas compradas que vão para gatilhos
  var _TriggeredResponsePhase = TriggeredResponsePhase;
  TriggeredResponsePhase = function (player, callbackName, enumerateParams) {
    if (callbackName == "responseOnCardsDrawn" && enumerateParams && enumerateParams[0])
      Physical.drawnArrays.push(enumerateParams[0]);
    return _TriggeredResponsePhase.apply(this, arguments);
  };

  // 2) Antes de cada passo do loop, resolve as identificações pendentes
  var _Main = Main;
  Main = async function () {
    if (Physical.enabled && Physical.pending.length > 0) {
      await PhysicalResolveAll();
      Render();
    }
    return _Main.apply(this, arguments);
  };
})();

function PhysicalZoneName(loc) {
  if (loc === runner.grip) return "mão";
  if (loc === runner.heap) return "heap (descarte)";
  if (loc === corp.HQ.cards) return "HQ";
  if (loc === corp.archives.cards) return "Archives";
  if (loc === null) return "fora de jogo";
  return "mesa";
}

// troca a carta "sorteada" pela carta real escolhida
function PhysicalSwap(drawn, title) {
  var human = PhysicalHuman();
  var deck = PhysicalDeck(human);
  if (drawn.title == title) return true;
  var j = -1;
  for (var k = deck.length - 1; k > -1; k--) if (deck[k].title == title) { j = k; break; }
  if (j < 0) return false;
  var real = deck[j];
  var loc = drawn.cardLocation;
  var i = loc ? loc.indexOf(drawn) : -1;
  if (i > -1) loc[i] = real;
  deck[j] = drawn;
  real.cardLocation = loc;
  drawn.cardLocation = deck;
  real.faceUp = drawn.faceUp;
  drawn.faceUp = false;
  if (real.renderer && real.renderer.sprite) real.renderer.sprite.visible = true;
  Physical.drawnArrays.forEach(function (arr) {
    var x = arr.indexOf(drawn);
    if (x > -1) arr[x] = real;
  });
  return true;
}

function PhysicalOptions(drawn) {
  // títulos possíveis = o que ainda está no baralho + a própria carta sorteada
  var deck = PhysicalDeck(PhysicalHuman());
  var counts = {};
  deck.concat([drawn]).forEach(function (c) { counts[c.title] = (counts[c.title] || 0) + 1; });
  return Object.keys(counts).sort().map(function (t) { return { title: t, n: counts[t] }; });
}

function PhysicalResolveAll() {
  return new Promise(function (resolve) {
    var total = Physical.pending.length;
    var done = 0;
    function next() {
      if (Physical.pending.length == 0) {
        $("#physical-modal").hide();
        var h = PhysicalHand(PhysicalHuman());
        Log("Sua mão: " + h.map(function (c) { return c.title; }).join(", "));
        Physical.drawnArrays = Physical.drawnArrays.slice(-5);
        resolve();
        return;
      }
      var drawn = Physical.pending[0];
      done++;
      if (drawn && drawn.rnd !== undefined) {
        Physical.rndWhy = drawn.why || null;
        PhysicalAskRnD(drawn.rnd, done, total, function (title) {
          var ok = PhysicalSwapRnD(drawn.rnd, title);
          if (!ok) { alertInline("Essa carta não está no seu R&D."); done--; next(); return; }
          Physical.rndKnown = Math.max(Physical.rndKnown, drawn.rnd + 1);
          Physical.pending.shift();
          PhysicalLog(title + " (topo do R&D)");
          next();
        });
        return;
      }
      PhysicalAsk(drawn, done, total, function (title) {
        Physical.resolving = true;
        var ok = PhysicalSwap(drawn, title);
        Physical.resolving = false;
        if (!ok) { alertInline("Essa carta não está mais no seu baralho."); done--; next(); return; }
        Physical.pending.shift();
        PhysicalLog(title);
        next();
      });
    }
    next();
  });
}

function PhysicalLog(title) {
  try { Log("Você informou: " + title); } catch (e) {}
}
function alertInline(msg) { $("#physical-msg").text(msg); }

function PhysicalAsk(drawn, idx, total, cb) {
  var opts = PhysicalOptions(drawn);
  var where = PhysicalZoneName(drawn.cardLocation);
  var $m = $("#physical-modal");
  $("#physical-title").text(
    "Qual carta saiu do seu baralho?" + (total > 1 ? "  (" + idx + " de " + total + ")" : "")
  );
  $("#physical-sub").text("Destino: " + where + ". Clique na carta física que você pegou.");
  $("#physical-msg").text("");
  var $list = $("#physical-list").empty();
  opts.forEach(function (o) {
    var def = FindCardDefWithMostSimilarTitle ? FindCardDefWithMostSimilarTitle(o.title) : null;
    var type = def && def.cardType ? def.cardType : "";
    $("<button class='phys-card'>")
      .attr("data-title", o.title.toLowerCase())
      .html("<span class='pc-t'>" + o.title + "</span><span class='pc-n'>" + (type ? type.charAt(0).toUpperCase() + type.slice(1) : "") + " · " + o.n + " no baralho</span>")
      .on("click", function () { cb(o.title); })
      .appendTo($list);
  });
  var $f = $("#physical-filter").val("");
  $f.off("input").on("input", function () {
    var q = $f.val().toLowerCase();
    $list.children().each(function () {
      $(this).toggle($(this).attr("data-title").indexOf(q) > -1);
    });
  });
  $m.css("display", "flex");
  setTimeout(function () { $f.trigger("focus"); }, 50);
}

// aviso rápido na tela (some sozinho)
function PhysicalNotice(msg) {
  var $n = $("#physical-notice");
  if (!$n.length) $n = $("<div id='physical-notice'></div>").appendTo("body");
  $n.text(msg).stop(true, true).fadeIn(150);
  clearTimeout(PhysicalNotice._t);
  PhysicalNotice._t = setTimeout(function () { $n.fadeOut(400); }, 9000);
}

var PhysicalNoticeQueue = [];
function PhysicalQueueNotice(msg) {
  PhysicalNoticeQueue.push(msg);
  clearTimeout(PhysicalQueueNotice._t);
  PhysicalQueueNotice._t = setTimeout(function () {
    PhysicalNotice(PhysicalNoticeQueue.join(" · "));
    PhysicalNoticeQueue = [];
  }, 50);
}

// ---- Corp humana: identificar as cartas do topo do R&D quando o Runner invade
function PhysicalSwapRnD(k, title) {
  var deck = corp.RnD.cards;
  var target = deck.length - 1 - k;
  if (target < 0) return false;
  if (deck[target].title == title) return true;
  var limit = deck.length - 1 - Physical.rndKnown; // não mexe nas posições já identificadas
  for (var j = 0; j <= limit; j++) {
    if (j != target && deck[j].title == title) {
      var tmp = deck[target]; deck[target] = deck[j]; deck[j] = tmp;
      return true;
    }
  }
  return false;
}
function PhysicalAskRnD(k, idx, total, cb) {
  var deck = corp.RnD.cards;
  var counts = {};
  var limit = deck.length - 1 - Physical.rndKnown;
  for (var j = 0; j <= limit; j++) counts[deck[j].title] = (counts[deck[j].title] || 0) + 1;
  var opts = Object.keys(counts).sort().map(function (t) { return { title: t, n: counts[t] }; });
  var head = Physical.rndWhy ? Physical.rndWhy + ": qual é a " + (k + 1) + "ª carta do topo do seu R&D?" : "O Runner vai acessar o seu R&D: qual é a " + (k + 1) + "ª carta do topo?";
  $("#physical-title").text(head + (total > 1 ? "  (" + idx + " de " + total + ")" : ""));
  $("#physical-sub").text("Vire a carta do topo do seu R&D físico (sem embaralhar) e clique nela.");
  $("#physical-msg").text("");
  var $list = $("#physical-list").empty();
  opts.forEach(function (o) {
    var def = FindCardDefWithMostSimilarTitle ? FindCardDefWithMostSimilarTitle(o.title) : null;
    var type = def && def.cardType ? def.cardType : "";
    $("<button class='phys-card'>")
      .attr("data-title", o.title.toLowerCase())
      .html("<span class='pc-t'>" + o.title + "</span><span class='pc-n'>" + (type ? type.charAt(0).toUpperCase() + type.slice(1) : "") + " · " + o.n + " no R&D</span>")
      .on("click", function () { cb(o.title); })
      .appendTo($list);
  });
  var $f = $("#physical-filter").val("");
  $f.off("input").on("input", function () {
    var q = $f.val().toLowerCase();
    $list.children().each(function () { $(this).toggle($(this).attr("data-title").indexOf(q) > -1); });
  });
  $("#physical-modal").css("display", "flex");
  setTimeout(function () { $f.trigger("focus"); }, 50);
}
