// =====================================================================
// Jack In — Treino: cartas de Corp adicionadas ao Chiriboga (deck do Ob)
// Regras + dicas para a IA de Corp. Códigos = códigos do NetrunnerDB.
// Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

// ------------------------------------------------------------- utilidades
var JKC = { runnerSuccessThisTurn: false };

(function () {
  // registra se o Runner teve corrida com sucesso no turno dele (Measured Response)
  var _AutomaticTriggers = AutomaticTriggers;
  AutomaticTriggers = function (callbackName, parameters) {
    if (callbackName == "automaticOnRunSuccessful" && playerTurn == runner) JKC.runnerSuccessThisTurn = true;
    return _AutomaticTriggers.apply(this, arguments);
  };
  var _ChangePhase = ChangePhase;
  ChangePhase = function (phase) {
    if (phase && phase.identifier == "Runner 1.1") JKC.runnerSuccessThisTurn = false;
    return _ChangePhase.apply(this, arguments);
  };
  // cartas com habilidades usáveis a partir da mão (Slash and Burn, Descent)
  var _CTA = ChoicesTriggerableAbilities;
  ChoicesTriggerableAbilities = function (player, limitTo) {
    var ret = _CTA.apply(this, arguments);
    var hand = player == corp ? corp.HQ.cards : runner.grip;
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      if (!c.abilitiesFromHand) continue;
      var abilities = ChoicesAbility(c, limitTo || "");
      for (var j = 0; j < abilities.length; j++) {
        ret.push({ card: c, ability: abilities[j].ability, label: "(" + c.title + ", da mão) " + abilities[j].ability.text });
      }
    }
    return ret;
  };
})();

function JKCProtecting(card) { try { return GetServer(card); } catch (e) { return null; } }
function JKCOtherInstalledCorp(except) {
  return InstalledCards(corp).filter(function (c) { return c !== except && c.cardType != "identity"; });
}
// escolha da IA de qual carta própria lixar (a menos valiosa)
function JKCLeastValuable(cards) {
  var best = null, bestScore = Infinity;
  cards.forEach(function (c) {
    var s = 5;
    if (c.cardType == "agenda") s = 100;
    else if (c.cardType == "ice") s = c.rezzed ? 20 + (c.rezCost || 0) : 8;
    else if (c.cardType == "asset") s = c.rezzed ? (c.credits ? 6 + c.credits : 4) : 3;
    else if (c.cardType == "upgrade") s = c.rezzed ? 12 : 6;
    if (c.advancement) s += 10 * c.advancement;
    if (c.title == "Svyatogor Excavator") s += 30;
    if (s < bestScore) { bestScore = s; best = c; }
  });
  return best;
}
function JKCTrashProgramSub(title) {
  var choices = ChoicesInstalledCards(runner, function (card) { return CheckCardType(card, ["program"]) && CheckTrash(card); });
  if (choices.length > 0) {
    DecisionPhase(corp, choices, function (params) { Trash(params.card, true); }, title, "Trash", this, "trash");
  }
}
// "faça X a menos que o Runner pague N"
function JKCPayOr(title, amount, payLabel, sufferLabel, suffer, aiPays) {
  var choices = [];
  if (CheckCredits(runner, amount)) choices.push({ id: 0, label: payLabel, button: payLabel });
  choices.push({ id: 1, label: sufferLabel, button: sufferLabel });
  DecisionPhase(runner, choices, function (p) {
    if (p.id == 0) SpendCredits(runner, amount);
    else suffer();
  }, title, title, this);
  if (runner.AI != null) {
    var pay = choices.length > 1 && (typeof aiPays != "function" || aiPays());
    runner.AI.preferred = { title: title, option: pay ? choices[0] : choices[choices.length - 1] };
  }
}

// instala 1 das cartas (ignorando custos). Humano escolhe; a IA escolhe direto (carta + servidor).
function JKCAIInstallPick(cards) {
  var pick = null;
  var protect = null;
  try { protect = corp.AI._serverToProtect(); } catch (e) {}
  var ice = cards.filter(function (c) { return c.cardType == "ice"; });
  if (ice.length && protect) pick = { card: ice[0], server: protect };
  if (!pick) {
    var asset = cards.filter(function (c) { return c.cardType == "asset"; })[0];
    if (asset) pick = { card: asset, server: null };
  }
  if (!pick && ice.length) pick = { card: ice[0], server: corp.HQ };
  if (!pick) {
    var up = cards.filter(function (c) { return c.cardType == "upgrade"; })[0];
    if (up) pick = { card: up, server: corp.remoteServers.length ? corp.remoteServers[corp.remoteServers.length - 1] : corp.HQ };
  }
  if (!pick && cards.length) pick = { card: cards[0], server: null };
  return pick;
}
function JKCInstallOne(title, cards, after, context, allowSkip) {
  cards = cards.filter(function (c) { return CheckInstall(c); });
  if (!cards.length) { if (after) after.call(context, null); return; }
  if (corp.AI != null) {
    var pick = JKCAIInstallPick(cards);
    if (!pick) { if (after) after.call(context, null); return; }
    Log(title + ": Corp instala 1 carta");
    Install(pick.card, pick.server, true, null, true, function () { if (after) after.call(context, pick.card); }, context);
    return;
  }
  var choices = ChoicesArrayInstall(cards, true);
  if (allowSkip !== false) choices.push({ skip: true, label: "Não instalar", button: "Não instalar" });
  DecisionPhase(corp, choices, function (p) {
    if (p.skip) { if (after) after.call(context, null); return; }
    Install(p.card, p.server, true, null, true, function () { if (after) after.call(context, p.card); }, context);
  }, title, "Install", context, "install");
}

// ======================================================== IDENTIDADE
cardSet[33057] = {
  title: "Ob Superheavy Logistics: Extract. Export. Excel.",
  imageFile: "33057.png",
  cardText: "Once per turn → When you trash a rezzed card, except during installation, you may search R&D for 1 card with a printed rez cost exactly 1[c] less than the trashed card's printed rez cost. Install and rez the card you found, ignoring credit costs.",
  player: corp,
  faction: "Weyland Consortium",
  cardType: "identity",
  subTypes: ["Corp"],
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  pendingCost: null,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  // antes de lixar, guarda se era carta da Corp ativada e lixada pela própria Corp
  automaticOnWouldTrash: {
    Resolve: function (cards) {
      if (this.usedThisTurn) return;
      if (activePlayer != corp && !JKC.corpTrashing) return;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        if (c.player == corp && c.rezzed && CheckInstalled(c) && typeof c.rezCost == "number") {
          this.pendingCost = c.rezCost - 1;
          return;
        }
      }
    },
    automatic: true,
  },
  responseOnTrash: {
    Enumerate: function () {
      if (this.usedThisTurn || this.pendingCost === null) return [];
      var target = this.pendingCost;
      var found = corp.RnD.cards.some(function (c) { return c.rezCost === target; });
      if (!found) { this.pendingCost = null; return []; }
      return [{}];
    },
    Resolve: function () {
      var target = this.pendingCost;
      this.pendingCost = null;
      this.usedThisTurn = true;
      var cards = corp.RnD.cards.filter(function (c) { return c.rezCost === target; });
      Log("Ob: busca no R&D por carta com custo de rez " + target);
      JKCInstallOne("Ob Superheavy Logistics", cards, function (card) {
        Shuffle(corp.RnD.cards);
        Log("R&D embaralhado");
        if (card) Rez(card, true);
      }, this);
    },
    text: "Ob: buscar carta no R&D",
  },
};

// ============================================================ AGENDAS
cardSet[33058] = {
  title: "Azef Protocol",
  imageFile: "33058.png",
  cardText: "As an additional cost to score this agenda, trash 1 of your other installed cards. When you score this agenda, do 2 meat damage.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 2,
  advancementRequirement: 3,
  // não pode pontuar sem outra carta instalada para lixar
  modifyCannot: {
    Resolve: function (str, card) {
      if (str == "score" && card == this && JKCOtherInstalledCorp(this).length == 0) return true;
      return false;
    },
    availableWhenInactive: true,
  },
  JackInScoreCost: function (scoreNow) {
    var self = this;
    var choices = ChoicesArrayCards(JKCOtherInstalledCorp(this));
    DecisionPhase(corp, choices, function (p) {
      JKC.corpTrashing = true;
      Trash(p.card, false, function () { JKC.corpTrashing = false; scoreNow(); });
    }, "Azef Protocol", "Trash em 1 carta instalada para pontuar", this, "trash");
    if (corp.AI != null) {
      var least = JKCLeastValuable(JKCOtherInstalledCorp(this));
      var pick = choices.find(function (c) { return c.card == least; }) || choices[0];
      corp.AI.preferred = { title: "Azef Protocol", option: pick };
    }
  },
  responseOnScored: {
    Enumerate: function () { return intended.score == this ? [{}] : []; },
    Resolve: function () { Damage("meat", 2, true); },
    text: "Azef Protocol: 2 de dano de carne",
  },
};

cardSet[35070] = {
  title: "Greenmail",
  imageFile: "35070.png",
  cardText: "When you score this agenda, gain 2[c]. When you forfeit this agenda, gain 4[c].",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 2,
  responseOnScored: {
    Enumerate: function () { return intended.score == this ? [{}] : []; },
    Resolve: function () { GainCredits(corp, 2); },
    text: "Greenmail: ganhar 2 créditos",
  },
};

cardSet[35071] = {
  title: "Off the Books",
  imageFile: "35071.png",
  cardText: "Dividends 1. When your discard phase ends, you may remove 1 hosted agenda counter to search R&D for 1 card and reveal it. You may install that card, ignoring all costs. If you do not, add it to HQ.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 2,
  advancementRequirement: 3,
  AIOverAdvance: true,
  responseOnScored: {
    Enumerate: function () {
      if (intended.score != this) return [];
      var excess = (this.advancement || 0) - AdvancementRequirement(this);
      return excess > 0 ? [{}] : [];
    },
    Resolve: function () {
      var excess = (this.advancement || 0) - AdvancementRequirement(this);
      AddCounters(this, "agenda", excess);
    },
    text: "Off the Books: dividendos",
  },
  responseOnCorpDiscardEnds: {
    Enumerate: function () {
      if (corp.scoreArea.indexOf(this) < 0 || !CheckCounters(this, "agenda", 1) || corp.RnD.cards.length == 0) return [];
      return [{}];
    },
    Resolve: function () {
      var self = this;
      var choices = ChoicesArrayCards(corp.RnD.cards);
      choices.push({ skip: true, label: "Não usar", button: "Não usar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        RemoveCounters(self, "agenda", 1);
        var card = p.card;
        Log("Off the Books revelou " + card.title);
        if (typeof RevealAdd == "function") RevealAdd("reveal", card);
        if (corp.AI != null && (card.cardType == "operation" || card.cardType == "agenda")) {
          MoveCard(card, corp.HQ.cards); Shuffle(corp.RnD.cards); return;
        }
        if (card.cardType == "operation") { MoveCard(card, corp.HQ.cards); Shuffle(corp.RnD.cards); return; }
        if (corp.AI != null) {
          JKCInstallOne("Off the Books", [card], function () { Shuffle(corp.RnD.cards); }, self);
          return;
        }
        var installs = ChoicesArrayInstall([card], true);
        installs.push({ toHQ: true, label: "Pôr no HQ", button: "Pôr no HQ" });
        DecisionPhase(corp, installs, function (q) {
          Shuffle(corp.RnD.cards);
          if (q.toHQ) MoveCard(card, corp.HQ.cards);
          else Install(card, q.server, true);
        }, "Off the Books", "Install", self, "install");
      }, "Off the Books", "Buscar no R&D", this);
      if (corp.AI != null) {
        // IA: busca gelo se algum servidor central estiver desprotegido; senão um ativo de economia
        var pick = null;
        var unprotected = [corp.HQ, corp.RnD].some(function (s) { return s.ice.length == 0; });
        for (var i = 0; i < choices.length && !pick; i++) {
          var c = choices[i].card;
          if (!c) continue;
          if (unprotected && c.cardType == "ice") pick = choices[i];
        }
        for (var i = 0; i < choices.length && !pick; i++) {
          var c = choices[i].card;
          if (c && (c.title == "Anthill Excavation Contract" || c.title == "Regolith Mining License")) pick = choices[i];
        }
        corp.AI.preferred = { title: "Off the Books", option: pick || choices[choices.length - 1] };
      }
    },
    text: "Off the Books: buscar no R&D",
  },
};

cardSet[34057] = {
  title: "Slash and Burn Agriculture",
  imageFile: "34057.png",
  cardText: "[click], 1[c], reveal and trash this agenda from HQ: Place 2 advancement counters on 1 installed card that you can advance.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Expansion", "Expendable"],
  agendaPoints: 2,
  advancementRequirement: 4,
  abilitiesFromHand: true,
  abilities: [
    {
      text: "Revelar e dar trash da mão: 2 avanços em 1 carta instalada",
      Enumerate: function () {
        if (this.cardLocation != corp.HQ.cards) return [];
        if (!CheckActionClicks(corp, 1) || !CheckCredits(corp, 1)) return [];
        var targets = ChoicesInstalledCards(corp, function (c) { return CheckAdvance(c); });
        if (!targets.length) return [];
        if (corp.AI != null) {
          // IA: só quando há agenda instalada que fica pontuável (ou quase) com +2
          var good = targets.filter(function (t) {
            return t.card.cardType == "agenda" && AdvancementRequirement(t.card) - (t.card.advancement || 0) <= 2;
          });
          if (!good.length) return [];
          return [good[0]];
        }
        return targets;
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
        SpendCredits(corp, 1);
        Log("Corp revelou e lixou Slash and Burn Agriculture da mão");
        if (typeof RevealAdd == "function") RevealAdd("reveal", this);
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        PlaceAdvancement(params.card, 2);
      },
    },
  ],
  AITriggerWhenCan: true,
};

// ============================================================= ATIVOS
cardSet[35072] = {
  title: "Anthill Excavation Contract",
  imageFile: "35072.png",
  cardText: "When you rez this asset, load 8[c] onto it. When it is empty, trash it. When your turn begins, take 4[c] from this asset and draw 1 card.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "asset",
  subTypes: ["Industrial"],
  rezCost: 3,
  trashCost: 1,
  automaticOnRez: { Resolve: function (card) { if (card == this) LoadCredits(this, 8); } },
  responseOnCorpTurnBegins: {
    Enumerate: function () { return CheckCounters(this, "credits", 1) ? [{}] : []; },
    Resolve: function () {
      TakeCredits(corp, this, 4);
      Draw(corp, 1);
      if (!CheckCounters(this, "credits", 1)) { JKC.corpTrashing = true; Trash(this, false, function () { JKC.corpTrashing = false; }); }
    },
    text: "Anthill: pegar 4 créditos e comprar 1",
  },
  RezUsability: function () {
    // ativa no fim do turno do Runner, para render no começo do turno da Corp
    if (currentPhase.identifier == "Runner 2.2") return true;
    return false;
  },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._sufficientEconomy(false)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) {
      if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    }
    return emptyProtectedRemotes.length;
  },
};

cardSet[33122] = {
  title: "Hostile Architecture",
  imageFile: "33122.png",
  cardText: "The first time each turn the Runner trashes any of your installed cards (including this asset), do 2 meat damage.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "asset",
  subTypes: ["Hostile"],
  rezCost: 5,
  trashCost: 4,
  usedThisTurn: false,
  armed: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  automaticOnWouldTrash: {
    Resolve: function (cards) {
      if (this.usedThisTurn || !this.rezzed || !CheckInstalled(this)) return;
      if (activePlayer != runner) return;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].player == corp && CheckInstalled(cards[i])) { this.armed = true; return; }
      }
    },
    automatic: true,
  },
  responseOnTrash: {
    Enumerate: function () { return this.armed ? [{}] : []; },
    Resolve: function () {
      this.armed = false;
      this.usedThisTurn = true;
      Damage("meat", 2, true);
    },
    text: "Hostile Architecture: 2 de dano de carne",
    availableWhenInactive: true,
  },
  RezUsability: function () { return currentPhase.identifier == "Runner 2.2" || currentPhase.identifier == "Run 4.5"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._HVTsInHand() > 0) return -1; // prefere guardar o remoto para agenda
    return emptyProtectedRemotes.length;
  },
};

cardSet[35051] = {
  title: "Phật Gioan Baotixita",
  imageFile: "35051.png",
  cardText: "When your discard phase ends, place 1 power counter on this asset. The first time each turn an agenda is scored or stolen, you may remove up to 2 hosted power counters. Do 1 net damage plus 1 net damage for each power counter removed this way.",
  player: corp,
  faction: "Jinteki",
  influence: 4,
  cardType: "asset",
  subTypes: ["Executive"],
  rezCost: 1,
  trashCost: 3,
  unique: true,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnCorpDiscardEnds: {
    Resolve: function () { AddCounters(this, "power", 1); },
    text: "Phật Gioan: 1 marcador de poder",
  },
  JKCTrigger: function () {
    var self = this;
    this.usedThisTurn = true;
    var max = Math.min(2, Counters(this, "power"));
    var choices = [];
    for (var n = max; n >= 0; n--) choices.push({ num: n, label: (1 + n) + " de dano neural (remove " + n + ")", button: (1 + n) + " de dano" });
    choices.push({ skip: true, label: "Não usar", button: "Não usar" });
    DecisionPhase(corp, choices, function (p) {
      if (p.skip) return;
      if (p.num > 0) RemoveCounters(self, "power", p.num);
      Damage("net", 1 + p.num, true);
    }, "Phật Gioan Baotixita", "Phật Gioan Baotixita", this);
    if (corp.AI != null) corp.AI.preferred = { title: "Phật Gioan Baotixita", option: choices[0] };
  },
  responseOnScored: { Enumerate: function () { return this.usedThisTurn ? [] : [{}]; }, Resolve: function () { this.JKCTrigger(); }, text: "Phật Gioan: dano neural" },
  responseOnStolen: { Enumerate: function () { return this.usedThisTurn ? [] : [{}]; }, Resolve: function () { this.JKCTrigger(); }, text: "Phật Gioan: dano neural" },
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) {
      if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    }
    return emptyProtectedRemotes.length;
  },
};

cardSet[33059] = {
  title: "Svyatogor Excavator",
  imageFile: "33059.png",
  cardText: "When your turn begins, you may trash 1 of your other installed cards. If you do, gain 3[c].",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "asset",
  subTypes: ["Industrial"],
  rezCost: 0,
  trashCost: 4,
  AIWouldTrigger: function () {
    var least = JKCLeastValuable(JKCOtherInstalledCorp(this));
    if (!least) return false;
    // vale lixar ativo vazio/ice não ativada, ou qualquer coisa com o Ob pronto para buscar
    return least.cardType == "asset" || (least.cardType == "ice" && !least.rezzed) || (least.rezzed && corp.identityCard.title.indexOf("Ob Superheavy") == 0 && !corp.identityCard.usedThisTurn);
  },
  responseOnCorpTurnBegins: {
    Enumerate: function () { return JKCOtherInstalledCorp(this).length ? [{}] : []; },
    Resolve: function () {
      var self = this;
      var choices = ChoicesArrayCards(JKCOtherInstalledCorp(this));
      choices.push({ skip: true, label: "Não dar trash", button: "Não dar trash" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        JKC.corpTrashing = true;
        Trash(p.card, false, function () { JKC.corpTrashing = false; GainCredits(corp, 3); });
      }, "Svyatogor Excavator", "Trash em 1 carta para ganhar 3", this, "trash");
      if (corp.AI != null) {
        var pick = choices[choices.length - 1];
        if (this.AIWouldTrigger()) {
          var least = JKCLeastValuable(JKCOtherInstalledCorp(this));
          pick = choices.find(function (c) { return c.card == least; }) || pick;
        }
        corp.AI.preferred = { title: "Svyatogor Excavator", option: pick };
      }
    },
    text: "Svyatogor: trash em 1 carta e ganhar 3",
  },
  RezUsability: function () { return true; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    return emptyProtectedRemotes.length;
  },
};

cardSet[34130] = {
  title: "The Powers That Be",
  imageFile: "34130.png",
  cardText: "Whenever you score an agenda, you may install 1 card from HQ or Archives, ignoring all costs.",
  player: corp,
  faction: "Neutral",
  influence: 2,
  cardType: "asset",
  subTypes: ["Ritzy"],
  rezCost: 1,
  trashCost: 3,
  responseOnScored: {
    Enumerate: function () {
      var choices = ChoicesArrayInstall(corp.HQ.cards.concat(corp.archives.cards), true);
      return choices.length ? [{}] : [];
    },
    Resolve: function () {
      JKCInstallOne("The Powers That Be", corp.HQ.cards.concat(corp.archives.cards).filter(function (c) { return c.cardType != "operation"; }), null, this);
    },
    text: "The Powers That Be: instalar 1 carta",
  },
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) {
      if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    }
    return emptyProtectedRemotes.length;
  },
};

// ============================================================ OPERAÇÃO
cardSet[35078] = {
  title: "Measured Response",
  imageFile: "35078.png",
  cardText: "Play only if the threat level is 4 or greater, and only if the Runner made a successful run during their last turn. Do 4 meat damage unless the Runner pays 8[c].",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "operation",
  subTypes: ["Black Ops"],
  playCost: 5,
  Enumerate: function () {
    var threat = AgendaPoints(corp) >= 4 || AgendaPoints(runner) >= 4;
    if (!threat || !JKC.runnerSuccessThisTurn) return [];
    return [{}];
  },
  AIWouldPlay: function () {
    // vale quando o Runner não consegue pagar 8 ou quando 4 de dano mata
    return Credits(runner) < 8 || runner.grip.length < 4;
  },
  Resolve: function () {
    JKCPayOr.call(this, "Measured Response", 8, "Pagar 8¢", "Sofrer 4 de dano de carne", function () { Damage("meat", 4, true); },
      function () { return runner.grip.length < 5; });
  },
};

// ============================================================ MELHORIAS
cardSet[35082] = {
  title: "Mahkota Langit Grid",
  imageFile: "35082.png",
  cardText: "2[recurring-credit]. You can spend hosted credits to rez assets in the root of this server and ice protecting this server. Persistent → The trash cost of each asset in the root of this server is increased by 2[c]. Limit 1 region per server.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 2,
  trashCost: 2,
  recurringCredits: 2,
  automaticOnRez: { Resolve: function (card) { if (card == this) this.credits = 2; } },
  canUseCredits: function (doing, card) {
    if (doing != "rezzing" || !card) return false;
    var s = GetServer(this);
    if (!s || GetServer(card) != s) return false;
    return (card.cardType == "asset" && s.root.indexOf(card) > -1) || (card.cardType == "ice" && s.ice.indexOf(card) > -1);
  },
  modifyTrashCost: {
    Resolve: function (card) {
      var s = GetServer(this);
      if (s && card.cardType == "asset" && s.root.indexOf(card) > -1) return 2;
      return 0;
    },
  },
  AIDefensiveValue: function () { return 1; },
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2"; },
};

cardSet[33047] = {
  title: "Mavirus",
  imageFile: "33047.png",
  cardText: "While the Runner is accessing this upgrade in R&D, they must reveal it. When the Runner accesses this upgrade, you may purge virus counters. If this upgrade is rezzed, do 1 net damage. [trash]: Purge virus counters.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "upgrade",
  subTypes: ["Ambush"],
  rezCost: 3,
  trashCost: 0,
  responseOnAccess: {
    Enumerate: function () { return accessingCard == this ? [{}] : []; },
    Resolve: function () {
      Purge();
      if (this.rezzed || this.cardLocation == corp.RnD.cards) {
        if (this.cardLocation == corp.RnD.cards && typeof RevealAdd == "function") RevealAdd("reveal", this);
      }
      if (this.rezzed) Damage("net", 1, true);
    },
    text: "Mavirus: purgar vírus",
  },
  abilities: [
    {
      text: "[trash]: Purge virus counters.",
      Enumerate: function () {
        if (!this.rezzed || !CheckInstalled(this)) return [];
        if (corp.AI != null) {
          var virus = InstalledCards(runner).some(function (c) { return c.virus > 1; });
          if (!virus) return [];
        }
        return [{}];
      },
      Resolve: function () {
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        Purge();
      },
    },
  ],
  AIDefensiveValue: function () { return 1; },
  RezUsability: function () { return currentPhase.identifier == "Run 4.5" && attackedServer == GetServer(this); },
};

cardSet[34120] = {
  title: "The Holo Man",
  imageFile: "34120.png",
  cardText: "When your turn begins, you may move this upgrade to the root of another server. Once per turn → [click], 4[c]: Place 2 advancement counters on 1 card in the root of or protecting this server. If you have not installed any cards from HQ this turn, instead place 3 advancement counters on that card.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 3,
  cardType: "upgrade",
  subTypes: ["Academic", "Executive", "Sysop"],
  rezCost: 2,
  trashCost: 2,
  unique: true,
  usedThisTurn: false,
  installedFromHQThisTurn: false,
  responseOnCorpTurnBegins: {
    Resolve: function () { this.usedThisTurn = false; this.installedFromHQThisTurn = false; },
    automatic: true,
    availableWhenInactive: true,
  },
  automaticOnInstall: {
    Resolve: function (card) { if (card != this && card.player == corp && playerTurn == corp) this.installedFromHQThisTurn = true; },
    availableWhenInactive: true,
  },
  abilities: [
    {
      text: "[click], 4[c]: avançar carta deste servidor",
      Enumerate: function () {
        if (this.usedThisTurn || !this.rezzed) return [];
        if (!CheckActionClicks(corp, 1) || !CheckCredits(corp, 4)) return [];
        var s = GetServer(this);
        if (!s) return [];
        var targets = ChoicesArrayCards(s.root.concat(s.ice).filter(function (c) { return CheckAdvance(c) || c.cardType == "agenda"; }));
        if (corp.AI != null) {
          targets = targets.filter(function (t) { return t.card.cardType == "agenda"; });
        }
        return targets;
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
        SpendCredits(corp, 4);
        this.usedThisTurn = true;
        PlaceAdvancement(params.card, this.installedFromHQThisTurn ? 2 : 3);
      },
    },
  ],
  AITriggerWhenCan: true,
  AIIsScoringUpgrade: true,
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2"; },
};

// =============================================================== GELOS
cardSet[33060] = {
  title: "Envelopment",
  imageFile: "33060.png",
  cardText: "When you rez this ice, place 4 power counters on it. When your turn begins, remove 1 hosted power counter. This ice gains \"[subroutine] End the run.\" before its other subroutines for each hosted power counter. [subroutine] Trash this ice.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 5,
  strength: 5,
  JKCRebuild: function () {
    var subs = [];
    var n = Counters(this, "power") || 0;
    for (var i = 0; i < n; i++) subs.push({ text: "End the run.", Resolve: function () { EndTheRun(); } });
    var self = this;
    subs.push({ text: "Trash this ice.", Resolve: function () { JKC.corpTrashing = true; Trash(self, false, function () { JKC.corpTrashing = false; }); } });
    this.subroutines = subs;
  },
  subroutines: [{ text: "Trash this ice.", Resolve: function () {}, visual: { y: 90, h: 16 } }],
  automaticOnRez: { Resolve: function (card) { if (card == this) { AddCounters(this, "power", 4); this.JKCRebuild(); } } },
  automaticOnEncounter: { Resolve: function (card) { if (card == this) this.JKCRebuild(); } },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      if (!this.rezzed || !CheckCounters(this, "power", 1)) return;
      RemoveCounters(this, "power", 1); this.JKCRebuild();
    },
    automatic: true,
  },
  AIImplementIce: function (rc, result) {
    var n = Counters(this, "power") || 4;
    result.sr = [];
    for (var i = 0; i < n; i++) result.sr.push([["endTheRun"]]);
    result.sr.push([["misc_minor"]]);
    return result;
  },
};

cardSet[35075] = {
  title: "Kessleroid",
  imageFile: "35075.png",
  cardText: "The Runner cannot trash this ice (while it is rezzed). [subroutine] End the run. [subroutine] End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 2,
  strength: 1,
  modifyCannot: {
    Resolve: function (str, card) { return str == "trash" && card == this && this.rezzed && activePlayer == runner; },
  },
  subroutines: [
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 70, h: 16 } },
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 90, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["endTheRun"]], [["endTheRun"]]]; return result; },
};

cardSet[33061] = {
  title: "Maskirovka",
  imageFile: "33061.png",
  cardText: "[subroutine] Gain 2[c]. [subroutine] End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 3,
  strength: 3,
  subroutines: [
    { text: "Gain 2[c].", Resolve: function () { GainCredits(corp, 2); }, visual: { y: 70, h: 16 } },
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 90, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_minor"]], [["endTheRun"]]]; return result; },
};

cardSet[26058] = {
  title: "Afshar",
  imageFile: "26058.png",
  cardText: "While this ice is protecting HQ, the Runner cannot break more than 1 of its printed subroutines during each encounter. [subroutine] The Runner loses 2[c]. [subroutine] End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 3,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 3,
  strength: 1,
  // bloqueia a quebra da 2ª subrotina quando protege o HQ (o motor checa "break" ao listar opções)
  modifyCannot: {
    Resolve: function (str, card) {
      if (str != "break") return false;
      if (GetApproachEncounterIce() != this || JKCProtecting(this) != corp.HQ) return false;
      var broken = this.subroutines.filter(function (s) { return s.broken; }).length;
      return broken >= 1;
    },
  },
  subroutines: [
    { text: "The Runner loses 2[c].", Resolve: function () { LoseCredits(runner, 2); }, visual: { y: 70, h: 16 } },
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 90, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_moderate"]], [["endTheRun"]]]; return result; },
};

cardSet[34125] = {
  title: "Descent",
  imageFile: "34125.png",
  cardText: "[click], 1[c], reveal and trash this ice from HQ: Draw 1 card. Reveal up to 2 agendas in HQ and/or Archives and shuffle them into R&D. When your turn begins, you may add this ice to HQ. [subroutine] End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Code Gate", "Expendable"],
  rezCost: 2,
  strength: 1,
  abilitiesFromHand: true,
  abilities: [
    {
      text: "Revelar e dar trash da mão: comprar 1 e devolver agendas ao R&D",
      Enumerate: function () {
        if (this.cardLocation != corp.HQ.cards) return [];
        if (!CheckActionClicks(corp, 1) || !CheckCredits(corp, 1)) return [];
        if (corp.AI != null) return []; // a IA prefere instalar como gelo
        return [{}];
      },
      Resolve: function () {
        SpendClicks(corp, 1);
        SpendCredits(corp, 1);
        if (typeof RevealAdd == "function") RevealAdd("reveal", this);
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        Draw(corp, 1);
        var agendas = corp.HQ.cards.concat(corp.archives.cards).filter(function (c) { return c.cardType == "agenda"; }).slice(0, 2);
        if (agendas.length) {
          agendas.forEach(function (a) { if (typeof RevealAdd == "function") RevealAdd("reveal", a); });
          ShuffleInto(agendas, corp.RnD.cards);
        }
      },
    },
  ],
  subroutines: [{ text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 90, h: 16 } }],
  AIImplementIce: function (rc, result) { result.sr = [[["endTheRun"]]]; return result; },
};

cardSet[36058] = {
  title: "Event Horizon",
  imageFile: "36058.png",
  cardText: "[trash]: End the run. Use this ability only during a run against this server. [subroutine] Trash 1 installed program unless the Runner pays 3[c]. [subroutine] End the run unless the Runner pays 3[c].",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Sentry", "Destroyer"],
  rezCost: 4,
  strength: 0,
  abilities: [
    {
      text: "[trash]: End the run.",
      Enumerate: function () {
        if (!this.rezzed || !CheckRunning() || attackedServer != JKCProtecting(this)) return [];
        if (corp.AI != null) {
          // IA: só quando o Runner está para acessar um servidor com agenda ou o HQ/R&D já passou de todo o gelo
          if (approachIce > 0) return [];
          var hasAgenda = attackedServer.root.some(function (c) { return c.cardType == "agenda"; });
          if (!hasAgenda) return [];
        }
        return [{}];
      },
      Resolve: function () {
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        EndTheRun();
      },
    },
  ],
  subroutines: [
    {
      text: "Trash 1 installed program unless the Runner pays 3[c].",
      Resolve: function () {
        var progs = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]) && CheckTrash(c); });
        if (!progs.length) return;
        JKCPayOr.call(this, "Event Horizon", 3, "Pagar 3¢", "Trash em 1 programa", function () { JKCTrashProgramSub.call(this, "Event Horizon"); });
      },
      visual: { y: 70, h: 16 },
    },
    {
      text: "End the run unless the Runner pays 3[c].",
      Resolve: function () {
        JKCPayOr.call(this, "Event Horizon", 3, "Pagar 3¢", "Encerrar a run", function () { EndTheRun(); });
      },
      visual: { y: 90, h: 16 },
    },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["payCredits"], ["misc_serious"]], [["payCredits"], ["endTheRun"]]]; return result; },
};

cardSet[33062] = {
  title: "Stavka",
  imageFile: "33062.png",
  cardText: "When you rez this ice, you may trash 1 of your other installed cards. If you do, this ice gets +5 strength for the remainder of the run. [subroutine] Trash 1 installed program. [subroutine] Trash 1 installed program.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Sentry", "Destroyer"],
  rezCost: 4,
  strength: 2,
  boost: 0,
  modifyStrength: { Resolve: function (card) { return card == this ? this.boost : 0; } },
  responseOnRunEnds: { Resolve: function () { this.boost = 0; }, automatic: true, availableWhenInactive: true },
  responseOnRez: {
    Enumerate: function (card) { return card == this && JKCOtherInstalledCorp(this).length ? [{}] : []; },
    Resolve: function () {
      var self = this;
      var choices = ChoicesArrayCards(JKCOtherInstalledCorp(this));
      choices.push({ skip: true, label: "Não dar trash", button: "Não dar trash" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        JKC.corpTrashing = true;
        Trash(p.card, false, function () { JKC.corpTrashing = false; if (CheckRunning()) self.boost = 5; });
      }, "Stavka", "Trash em 1 carta: +5 de força", this, "trash");
      if (corp.AI != null) {
        var least = JKCLeastValuable(JKCOtherInstalledCorp(this));
        var useIt = least && least.cardType == "asset" && !least.rezzed;
        var pick = useIt ? choices.find(function (c) { return c.card == least; }) : null;
        corp.AI.preferred = { title: "Stavka", option: pick || choices[choices.length - 1] };
      }
    },
    text: "Stavka: trash em 1 carta para +5 de força",
  },
  subroutines: [
    { text: "Trash 1 installed program.", Resolve: function () { JKCTrashProgramSub.call(this, "Stavka"); }, visual: { y: 70, h: 16 } },
    { text: "Trash 1 installed program.", Resolve: function () { JKCTrashProgramSub.call(this, "Stavka"); }, visual: { y: 90, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_serious"]], [["misc_serious"]]]; return result; },
};

cardSet[26125] = {
  title: "Winchester",
  imageFile: "26125.png",
  cardText: "[subroutine] Trace[4]. If successful, trash 1 installed program. [subroutine] Trace[3]. If successful, trash 1 installed piece of hardware. While this ice is protecting HQ, it gains \"[subroutine] Trace[3]. If successful, end the run.\" after its other subroutines.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "ice",
  subTypes: ["Sentry", "Destroyer", "Tracer"],
  rezCost: 4,
  strength: 4,
  JKCBase: function () {
    var self = this;
    return [
      { text: "Trace[4]. If successful, trash 1 installed program.", Resolve: function () {
          Trace(4, function (ok) { if (ok) JKCTrashProgramSub.call(self, "Winchester"); }, self);
        } },
      { text: "Trace[3]. If successful, trash 1 installed piece of hardware.", Resolve: function () {
          Trace(3, function (ok) {
            if (!ok) return;
            var choices = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["hardware"]) && CheckTrash(c); });
            if (choices.length) DecisionPhase(corp, choices, function (p) { Trash(p.card, true); }, "Winchester", "Trash", self, "trash");
          }, self);
        } },
    ];
  },
  JKCRebuild: function () {
    var subs = this.JKCBase();
    if (JKCProtecting(this) == corp.HQ) {
      subs.push({ text: "Trace[3]. If successful, end the run.", Resolve: function () {
          Trace(3, function (ok) { if (ok) EndTheRun(); });
        } });
    }
    this.subroutines = subs;
  },
  subroutines: [
    { text: "Trace[4]. If successful, trash 1 installed program.", Resolve: function () {}, visual: { y: 60, h: 16 } },
    { text: "Trace[3]. If successful, trash 1 installed piece of hardware.", Resolve: function () {}, visual: { y: 76, h: 16 } },
  ],
  automaticOnEncounter: { Resolve: function (card) { if (card == this) this.JKCRebuild(); } },
  automaticOnRez: { Resolve: function (card) { if (card == this) this.JKCRebuild(); } },
  AIImplementIce: function (rc, result) {
    result.sr = [[["misc_serious"]], [["misc_moderate"]]];
    if (JKCProtecting(this) == corp.HQ) result.sr.push([["endTheRun"]]);
    return result;
  },
};

// ------------------------------------------------- custo extra para pontuar
(function () {
  var _Score = Score;
  Score = function (card, afterScore, context) {
    if (card && typeof card.JackInScoreCost == "function" && !card.JKCCostPaid) {
      var args = arguments, self = this;
      card.JackInScoreCost(function () {
        card.JKCCostPaid = true;
        _Score.apply(self, args);
        card.JKCCostPaid = false;
      });
      return;
    }
    return _Score.apply(this, arguments);
  };
})();

// Afshar: quando a quebra está proibida, não oferece mais subrotinas para quebrar
(function () {
  var _CES = ChoicesEncounteredSubroutines;
  ChoicesEncounteredSubroutines = function () {
    var ice = GetApproachEncounterIce();
    if (ice && CardEffectsForbid("break", ice)) return [];
    return _CES.apply(this, arguments);
  };
})();
