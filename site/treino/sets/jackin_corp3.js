// =====================================================================
// Jack In — Treino: cartas do deck AU Co.: The Gold Standard in Clones
// (as demais cartas do deck estão em jackin_corp2.js / systemgateway.js)
// Regras + dicas para a IA de Corp. Códigos = códigos do NetrunnerDB.
// Licença: GPL-3.0 (derivado do Chiriboga). Requer sets/jackin_corp.js e jackin_corp2.js.
// =====================================================================

// Corp humana jogando com cartas físicas: identifica as N cartas do topo do R&D antes de olhá-las
function JKCPhysicalTopOfRnD(n, why) {
  if (typeof Physical == "undefined" || !Physical.enabled || typeof PhysicalHuman != "function" || PhysicalHuman() != corp) return false;
  n = Math.min(n, corp.RnD.cards.length);
  var added = false;
  for (var k = Physical.rndKnown; k < n; k++) { Physical.pending.push({ rnd: k, why: why }); added = true; }
  return added;
}
function JKCTopOfRnD(n) {
  var d = corp.RnD.cards;
  var ret = [];
  for (var i = d.length - 1; i >= 0 && ret.length < n; i--) ret.push(d[i]);
  return ret; // [topo, 2ª, 3ª]
}

// ============================================================ IDENTIDADE
cardSet[35046] = {
  title: "AU Co.: The Gold Standard in Clones",
  imageFile: "35046.png",
  cardText: "Whenever you do damage or trash 1 or more cards from HQ, place 1 power counter on this identity. When your turn begins, you may remove 2 hosted power counters to look at the top 3 cards of R&D. Trash 1 of those cards and add the rest to HQ.",
  player: corp,
  faction: "Jinteki",
  cardType: "identity",
  subTypes: ["Division"],
  deckSize: 45,
  influenceLimit: 15,
  power: 0,
  JKCAddPower: function (why) {
    AddCounters(this, "power", 1);
  },
  // dano causado pela Corp (o motor só dispara isto quando o dano acontece de fato)
  automaticOnTakeDamage: {
    Resolve: function (num) {
      if (num > 0) this.JKCAddPower("dano");
    },
    automatic: true,
  },
  // trash de 1 ou mais cartas do HQ pela Corp (não conta o Runner lixando carta acessada, nem o descarte de fim de turno)
  automaticOnWouldTrash: {
    Resolve: function (cards) {
      var fromHQ = cards.some(function (c) {
        return c.player == corp && c.cardLocation === corp.HQ.cards && c !== accessingCard;
      });
      if (!fromHQ) return;
      if (currentPhase && String(currentPhase.title || "").indexOf("Discard") > -1) return;
      this.JKCAddPower("trash do HQ");
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Enumerate: function () {
      return CheckCounters(this, "power", 2) && corp.RnD.cards.length > 0 ? [{}] : [];
    },
    Resolve: function () {
      var self = this;
      RemoveCounters(this, "power", 2);
      Log("AU Co.: removeu 2 marcadores de poder para olhar o topo do R&D");
      var n = Math.min(3, corp.RnD.cards.length);
      var choose = function () {
        var top = JKCTopOfRnD(n);
        var choices = ChoicesArrayCards(top).map(function (c) { c.label = "Trash: " + c.card.title; c.button = c.card.title; return c; });
        DecisionPhase(corp, choices, function (p) {
          var rest = top.filter(function (c) { return c !== p.card; });
          JKC.corpTrashing = true;
          Trash(p.card, false, function () {
            JKC.corpTrashing = false;
            rest.forEach(function (c) { MoveCard(c, corp.HQ.cards); });
            Log("AU Co.: " + rest.length + " carta(s) do R&D para o HQ");
            if (typeof PhysicalNotice == "function" && PhysicalHuman && PhysicalHuman() == corp) {
              PhysicalNotice("AU Co.: " + p.card.title + " vai para Archives; " + rest.map(function (c) { return c.title; }).join(" e ") + (rest.length > 1 ? " vão" : " vai") + " para a sua mão.");
            }
          });
        }, "AU Co.", "AU Co.: escolha a carta do topo do R&D para dar trash", self, "trash");
        if (corp.AI != null) {
          // IA: guarda agendas e o que for mais caro; dá trash na carta menos valiosa
          var worst = top.slice().sort(function (a, b) { return JKCAUValue(a) - JKCAUValue(b); })[0];
          corp.AI.preferred = { title: "AU Co.", option: choices.find(function (c) { return c.card == worst; }) || choices[0] };
        }
      };
      if (JKCPhysicalTopOfRnD(n, "AU Co.")) {
        // primeiro a Corp humana vira as cartas físicas e diz quais são; depois escolhe
        DecisionPhase(corp, [{ id: 0, label: "Olhar as " + n + " cartas do topo do R&D", button: "Olhar o topo do R&D" }], function () { choose(); }, "AU Co.", "AU Co.", self);
      } else choose();
    },
    text: "AU Co.: remover 2 de poder, olhar 3 do R&D",
  },
  AIWouldTrigger: function () { return true; },
};
function JKCAUValue(c) {
  if (c.cardType == "agenda") return 100 + (c.agendaPoints || 0);
  if (c.cardType == "ice") return 20 + (c.rezCost || 0);
  if (c.cardType == "upgrade" || c.cardType == "asset") return 10 + (c.rezCost || 0);
  return c.playCost || 0;
}

// ============================================================ AGENDAS
cardSet[33039] = {
  title: "Blood in the Water",
  imageFile: "33039.png",
  cardText: "X is equal to the number of cards in the Runner's grip. (Advancement requirement X, 2 agenda points.)",
  player: corp,
  faction: "Jinteki",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 0,
  // requisito de avanço = cartas na mão do Runner
  modifyAdvancementRequirement: {
    Resolve: function (card) { return card == this ? runner.grip.length : 0; },
    availableWhenInactive: true,
  },
};

cardSet[34040] = {
  title: "Fujii Asset Retrieval",
  imageFile: "34040.png",
  cardText: "When this agenda is scored or stolen, do 2 net damage.",
  player: corp,
  faction: "Jinteki",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Ambush", "Security"],
  agendaPoints: 3,
  advancementRequirement: 5,
  responseOnScored: {
    Enumerate: function () { return intended.score == this ? [{}] : []; },
    Resolve: function () { Log("Fujii Asset Retrieval: 2 de net damage"); JKCNet(2); },
    text: "Fujii Asset Retrieval: 2 de net damage",
  },
  responseOnStolen: {
    Enumerate: function () { return intended.steal == this ? [{}] : []; },
    Resolve: function () { Log("Fujii Asset Retrieval: 2 de net damage"); JKCNet(2); },
    text: "Fujii Asset Retrieval: 2 de net damage",
    availableWhenInactive: true,
  },
};

// ================================================================= ICE
cardSet[32005] = {
  title: "Anemone",
  imageFile: "32005.png",
  cardText: "When you rez this ice during a run against this server, you may trash 1 card from HQ to do 2 net damage. [subroutine] Do 1 net damage.",
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "ice",
  subTypes: ["Sentry", "AP"],
  rezCost: 3,
  strength: 2,
  responseOnRez: {
    Enumerate: function (card) {
      if (card != this || !CheckRunning() || !attackedServer || GetServer(this) != attackedServer) return [];
      return corp.HQ.cards.length ? [{}] : [];
    },
    Resolve: function () {
      JKCMayTrashFromHQ("Anemone", function () { Log("Anemone: 2 de net damage"); JKCNet(2); }, this);
    },
    text: "Anemone: trash 1 do HQ para 2 de net damage",
  },
  subroutines: [
    { text: "Do 1 net damage.", Resolve: function () { JKCNet(1); } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["netDamage"]]]; return result; },
};
cardSet[33043] = jQuery.extend({}, cardSet[32005], { imageFile: "33043.png" }); // reimpressão (Midnight Sun)

// ============================================ habilidades opcionais ("you may")
// O motor trata todo gatilho como obrigatório. Para o jogador humano, quando só sobram
// gatilhos marcados como opcionais, o botão "Continuar" aparece e ele pode seguir sem usá-los.
[35046, 34107, 33059].forEach(function (id) {
  if (cardSet[id] && cardSet[id].responseOnCorpTurnBegins) cardSet[id].responseOnCorpTurnBegins.optional = true;
});
(function () {
  if (typeof phaseTemplates == "undefined" || !phaseTemplates.globalTriggers) return;
  var origN = phaseTemplates.globalTriggers.Enumerate.n;
  function isOptional(o) {
    if (!o || !o.card) return false;
    var a = o.card[currentPhase.triggerCallbackName];
    var b = currentPhase.triggerSecondCallbackName ? o.card[currentPhase.triggerSecondCallbackName] : null;
    return !!((a && a.optional) || (b && b.optional));
  }
  var newN = function () {
    var r = origN.apply(this, arguments);
    if (r && r.length) return r;
    try {
      if (!activePlayer || activePlayer.AI != null) return r;
      var left = ValidateTriggerList(currentPhase.triggerList, currentPhase.triggerCallbackName, currentPhase.triggerEnumerateParams,
        currentPhase.triggerSecondCallbackName, currentPhase.triggerSecondEnumerateParams);
      if (left.length && left.every(isOptional)) return [{}];
    } catch (e) {}
    return r;
  };
  phaseTemplates.globalTriggers.Enumerate.n = newN;
  if (typeof phases != "undefined") {
    for (var k in phases) {
      var p = phases[k];
      if (p && p.Enumerate && p.Enumerate.n === origN) p.Enumerate.n = newN;
    }
  }
})();
