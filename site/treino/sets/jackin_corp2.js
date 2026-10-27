// =====================================================================
// Jack In — Treino: cartas de Corp do deck Jinteki: Restoring Humanity
// Regras + dicas para a IA de Corp. Códigos = códigos do NetrunnerDB.
// Licença: GPL-3.0 (derivado do Chiriboga). Requer sets/jackin_corp.js.
// =====================================================================

(function () {
  // cartas da Corp adicionadas a Archives neste turno (Regenesis)
  JKC.archivesTouched = false;
  JKC.placeholderPhase = { identifier: "JK forced encounter return", title: "", player: runner };
  var _MCT = MoveCardTriggers;
  MoveCardTriggers = function (card, from, to) {
    if (to === corp.archives.cards && card && card.player == corp) JKC.archivesTouched = true;
    return _MCT.apply(this, arguments);
  };
  // começo de turno: zera marcadores de "neste turno"; volta de encontro forçado
  var _ChangePhase = ChangePhase;
  ChangePhase = function (phase) {
    if (phase && (phase.identifier == "Corp 1.1" || phase.identifier == "Runner 1.1")) JKC.archivesTouched = false;
    // encontro forçado durante o acesso (Ganked!): ao fim do encontro volta ao acesso, sem "passar" o gelo
    if (JKC.returnPhase) {
      if (phase === phases.runEnds || phase === phases.runUnsuccessful) {
        JKC.returnPhase = null;
      } else if (phase === phases.runPassesIce) {
        currentPhase = JKC.placeholderPhase; // o fim do encontro aponta para cá
        return;
      } else if (phase === JKC.placeholderPhase) {
        var back = JKC.returnPhase;
        JKC.returnPhase = null;
        phases.runEncounterEnd.next = phases.runPassesIce;
        return _ChangePhase.call(this, back, true);
      }
    }
    return _ChangePhase.apply(this, arguments);
  };
  // qual carta está enumerando habilidades (Semak-samun: só fracter quebra)
  var _ChoicesAbility = ChoicesAbility;
  ChoicesAbility = function (card) {
    var prev = JKC.enumeratingCard;
    JKC.enumeratingCard = card;
    try { return _ChoicesAbility.apply(this, arguments); }
    finally { JKC.enumeratingCard = prev; }
  };
  var _CES = ChoicesEncounteredSubroutines;
  ChoicesEncounteredSubroutines = function () {
    var ice = GetApproachEncounterIce();
    if (ice && ice.onlyFracterBreaks && JKC.enumeratingCard && JKC.enumeratingCard.player == runner &&
        !CheckSubType(JKC.enumeratingCard, "Fracter")) return [];
    return _CES.apply(this, arguments);
  };
  // habilidades usáveis a partir de Archives (Petty Cash)
  var _CTA = ChoicesTriggerableAbilities;
  ChoicesTriggerableAbilities = function (player, limitTo) {
    var ret = _CTA.apply(this, arguments);
    if (player == corp) {
      corp.archives.cards.forEach(function (c) {
        if (!c.abilitiesFromArchives) return;
        ChoicesAbility(c, limitTo || "").forEach(function (a) {
          ret.push({ card: c, ability: a.ability, label: "(" + c.title + ", de Archives) " + a.ability.text });
        });
      });
    }
    return ret;
  };
})();

// contador de corridas (para efeitos "uma vez por acesso")
JKC.runCount = 0;
(function () {
  var _AT2 = AutomaticTriggers;
  AutomaticTriggers = function (callbackName) {
    if (callbackName == "automaticOnRunBegins") JKC.runCount++;
    return _AT2.apply(this, arguments);
  };
})();

// faz o Runner encontrar um gelo agora (usado por Ganked! e Sisyphus Protocol)
function JKCForceEncounter(ice, returnTo) {
  var server = GetServer(ice);
  if (!server || !ice.rezzed) return;
  attackedServer = server;
  approachIce = server.ice.indexOf(ice);
  UnbreakAll(ice);
  if (returnTo) {
    JKC.returnPhase = returnTo;
    phases.runEncounterEnd.next = returnTo;
  }
  ChangePhase(phases.runEncounterIce);
}

// IA de Runner diante do Semak-samun: aceita os 3 de net damage se não morre e não perde carta importante
// (mesmo critério do cálculo de run da IA, para ela não ficar repetindo runs que termina sozinha)
function JKCSemakTakeDamage() {
  var keep = 0;
  try { if (runner.AI && runner.AI.cardsWorthKeeping) keep = runner.AI.cardsWorthKeeping.length; } catch (e) {}
  return runner.grip.length - keep >= 3;
}
function JKCThreat(n) { return AgendaPoints(corp) >= n || AgendaPoints(runner) >= n; }
function JKCNet(n, after, ctx) { Damage("net", n, true, after, ctx); }
function JKCAIHasHQCardToSpare() {
  return corp.HQ.cards.some(function (c) { return c.cardType != "agenda"; }) || corp.HQ.cards.length > 2;
}
function JKCAIWorstHQCard() {
  var nonAg = corp.HQ.cards.filter(function (c) { return c.cardType != "agenda"; });
  var pool = nonAg.length ? nonAg : corp.HQ.cards;
  return pool.slice().sort(function (a, b) { return (a.rezCost || a.playCost || 0) - (b.rezCost || b.playCost || 0); })[0];
}
// Corp: "você pode dar trash em 1 carta do HQ para X"
function JKCMayTrashFromHQ(title, effect, ctx) {
  if (!corp.HQ.cards.length) return;
  var choices = ChoicesArrayCards(corp.HQ.cards);
  choices.push({ skip: true, label: "Não dar trash", button: "Não dar trash" });
  DecisionPhase(corp, choices, function (p) {
    if (p.skip) return;
    Trash(p.card, false, function () { effect.call(ctx); });
  }, title, title, ctx);
  if (corp.AI != null) {
    var pick = JKCAIHasHQCardToSpare() ? choices.find(function (c) { return c.card == JKCAIWorstHQCard(); }) : null;
    corp.AI.preferred = { title: title, option: pick || choices[choices.length - 1] };
  }
}
// Corp escolhe: lixar 1 carta instalada do tipo, ou encerrar a corrida
function JKCTrashOrETR(title, type) {
  var targets = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, [type]) && CheckTrash(c); });
  var choices = targets.slice();
  choices.push({ etr: true, label: "Encerrar a run", button: "Encerrar a run" });
  DecisionPhase(corp, choices, function (p) {
    if (p.etr) EndTheRun();
    else Trash(p.card, true);
  }, title, title, this);
  if (corp.AI != null) {
    // IA: lixa programa (mais valioso); recurso só se não houver nada protegendo agenda
    var pick = targets.length ? targets.slice().sort(function (a, b) { return (b.card.installCost || 0) - (a.card.installCost || 0); })[0] : null;
    if (type == "resource" && attackedServer && attackedServer.root.some(function (c) { return c.cardType == "agenda"; })) pick = null;
    corp.AI.preferred = { title: title, option: pick || choices[choices.length - 1] };
  }
}

// ============================================================ AGENDAS
cardSet[33040] = {
  title: "Regenesis",
  imageFile: "33040.png",
  cardText: "When you score this agenda, if no Corp cards have been added to Archives this turn, you may reveal 1 facedown agenda in Archives and add it to your score area.",
  player: corp,
  faction: "Jinteki",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 1,
  advancementRequirement: 3,
  responseOnScored: {
    Enumerate: function () {
      if (intended.score != this || JKC.archivesTouched) return [];
      var ags = corp.archives.cards.filter(function (c) { return c.cardType == "agenda" && !c.faceUp; });
      return ags.length ? [{}] : [];
    },
    Resolve: function () {
      var ags = corp.archives.cards.filter(function (c) { return c.cardType == "agenda" && !c.faceUp; });
      var choices = ChoicesArrayCards(ags).map(function (c) { c.label = c.card.title; return c; });
      choices.push({ skip: true, label: "Não usar", button: "Não usar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        if (typeof RevealAdd == "function") RevealAdd("reveal", p.card);
        MoveCard(p.card, corp.scoreArea);
        p.card.faceUp = true;
        Log("Regenesis: " + p.card.title + " vai para a área de pontos da Corp");
      }, "Regenesis", "Regenesis", this);
      if (corp.AI != null) {
        var best = choices.slice(0, -1).sort(function (a, b) { return b.card.agendaPoints - a.card.agendaPoints; })[0];
        corp.AI.preferred = { title: "Regenesis", option: best || choices[0] };
      }
    },
    text: "Regenesis: pontuar agenda virada de Archives",
  },
};

cardSet[34106] = {
  title: "Sisyphus Protocol",
  imageFile: "34106.png",
  cardText: "The first time each turn the Runner passes a rezzed code gate or sentry, you may pay 1[c] or trash 1 card from HQ. If you do, the Runner encounters that ice again.",
  player: corp,
  faction: "Jinteki",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 2,
  advancementRequirement: 5,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnPassesIce: {
    Enumerate: function () {
      if (this.usedThisTurn || corp.scoreArea.indexOf(this) < 0) return [];
      var ice = GetApproachEncounterIce();
      if (!ice || !ice.rezzed || !(CheckSubType(ice, "Code Gate") || CheckSubType(ice, "Sentry"))) return [];
      return [{}];
    },
    Resolve: function () {
      var self = this;
      var ice = GetApproachEncounterIce();
      this.usedThisTurn = true;
      var choices = [];
      if (CheckCredits(corp, 1)) choices.push({ id: 0, label: "Pagar 1¢: encontrar de novo", button: "Pagar 1¢" });
      if (corp.HQ.cards.length) choices.push({ id: 1, label: "Trash em 1 carta do HQ: encontrar de novo", button: "Trash 1 do HQ" });
      choices.push({ id: 2, label: "Não usar", button: "Não usar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.id == 2) return;
        if (p.id == 0) SpendCredits(corp, 1);
        else {
          var c = corp.AI != null ? JKCAIWorstHQCard() : corp.HQ.cards[0];
          Trash(c, false);
        }
        Log("Sisyphus Protocol: o Runner encontra " + GetTitle(ice, true) + " de novo");
        JKCForceEncounter(ice, null);
      }, "Sisyphus Protocol", "Sisyphus Protocol", this);
      if (corp.AI != null) corp.AI.preferred = { title: "Sisyphus Protocol", option: choices[0] };
    },
    text: "Sisyphus Protocol: encontrar o ice de novo",
    availableWhenInactive: true,
  },
};

// ============================================================= ATIVOS
cardSet[34107] = {
  title: "Charlotte Caçador",
  imageFile: "34107.png",
  cardText: "You can advance this asset. When your turn begins, you may remove 1 hosted advancement counter to gain 4[c] and draw 1 card. [trash], hosted advancement counter: Gain 3[c].",
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "asset",
  subTypes: ["Clone"],
  rezCost: 0,
  trashCost: 2,
  canBeAdvanced: true,
  AIOverAdvance: true,
  AIAdvancementLimit: function () { return 3; },
  responseOnCorpTurnBegins: {
    Enumerate: function () { return this.rezzed && CheckCounters(this, "advancement", 1) ? [{}] : []; },
    Resolve: function () {
      this.advancement--;
      GainCredits(corp, 4);
      Draw(corp, 1);
    },
    text: "Charlotte: remover 1 avanço, ganhar 4 e comprar 1",
  },
  abilities: [
    {
      text: "[trash], 1 avanço: ganhar 3",
      Enumerate: function () {
        if (!this.rezzed || !CheckCounters(this, "advancement", 1)) return [];
        if (corp.AI != null) {
          // IA: só se o Runner estiver acessando esta carta (antes que ele a lixe)
          if (accessingCard != this) return [];
        }
        return [{}];
      },
      Resolve: function () {
        this.advancement--;
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        GainCredits(corp, 3);
      },
    },
  ],
  RezUsability: function () { return currentPhase.identifier == "Runner 2.2" || currentPhase.identifier.substring(0, 6) == "Corp 2"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._sufficientEconomy(false)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) {
      if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    }
    return emptyProtectedRemotes.length;
  },
};

// ============================================================ OPERAÇÃO
cardSet[35081] = {
  title: "Petty Cash",
  imageFile: "35081.png",
  cardText: "Play only if you have not finished an action yet this turn. Gain 5[c]. If you played this operation from anywhere except HQ, gain [click]. [click]: Play this operation from Archives. After it resolves, remove it from the game.",
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 3,
  abilitiesFromArchives: true,
  JKCFirstAction: function () { return playerTurn == corp && corp.clickTracker >= 3; },
  Enumerate: function () { return this.JKCFirstAction() ? [{}] : []; },
  Resolve: function () { GainCredits(corp, 5); },
  AIWouldPlay: function () { return Credits(corp) < 8; },
  abilities: [
    {
      text: "Jogar de Archives (ganha 5¢ e 1 clique, depois sai do jogo)",
      Enumerate: function () {
        if (this.cardLocation != corp.archives.cards) return [];
        if (!this.JKCFirstAction() || !CheckActionClicks(corp, 1) || !CheckCredits(corp, 3)) return [];
        return [{}];
      },
      Resolve: function () {
        SpendClicks(corp, 1);
        SpendCredits(corp, 3);
        Log("Corp jogou Petty Cash de Archives");
        if (typeof RevealAdd == "function") RevealAdd("play", this);
        GainCredits(corp, 5);
        GainClicks(corp, 1);
        RemoveFromGame(this);
      },
    },
  ],
  AITriggerWhenCan: true,
};

// ============================================================ MELHORIAS
cardSet[26119] = {
  title: "Ganked!",
  imageFile: "26119.png",
  cardText: "While the Runner is accessing this upgrade in R&D, they must reveal it. When the Runner accesses this upgrade, you may trash it to choose a rezzed piece of ice protecting this server. The Runner encounters that ice.",
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "upgrade",
  subTypes: ["Ambush"],
  rezCost: 0,
  trashCost: 3,
  responseOnAccess: {
    Enumerate: function () {
      if (accessingCard != this || !attackedServer) return [];
      // em Archives já está lixada: não dá para pagar o custo (lixá-la), então não tem efeito
      if (this.cardLocation == corp.archives.cards) return [];
      // só uma vez por acesso (inclusive quando a Corp escolhe "Não usar")
      if (this.jkGankedRun === JKC.runCount) return [];
      return attackedServer.ice.some(function (i) { return i.rezzed; }) ? [{}] : [];
    },
    Resolve: function () {
      var self = this;
      this.jkGankedRun = JKC.runCount;
      var server = attackedServer;
      if (this.cardLocation == corp.RnD.cards && typeof RevealAdd == "function") RevealAdd("reveal", this);
      var choices = ChoicesArrayCards(server.ice.filter(function (i) { return i.rezzed; }));
      choices.push({ skip: true, label: "Não usar", button: "Não usar" });
      var returnTo = currentPhase;
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        var back = currentPhase;
        JKC.corpTrashing = true;
        Trash(self, false, function () { JKC.corpTrashing = false; });
        Log("Ganked!: o Runner encontra " + GetTitle(p.card, true));
        JKCForceEncounter(p.card, back);
      }, "Ganked!", "Ganked!", this);
      if (corp.AI != null) {
        var best = choices.slice(0, -1).sort(function (a, b) { return (b.card.rezCost || 0) - (a.card.rezCost || 0); })[0];
        corp.AI.preferred = { title: "Ganked!", option: best || choices[choices.length - 1] };
      }
    },
    text: "Ganked!: forçar encontro com ice",
  },
  AIDefensiveValue: function () { return 1; },
};

cardSet[27005] = {
  title: "La Costa Grid",
  imageFile: "27005.png",
  cardText: "Remote server only. When your turn begins, place 1 advancement counter on a card in the root of this server. Limit 1 region per server.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "upgrade",
  subTypes: ["Region", "Seedy"],
  rezCost: 3,
  trashCost: 4,
  AIIsScoringUpgrade: true,
  modifyCannot: {
    Resolve: function (str, card) {
      // só em servidor remoto (o motor pergunta "install" para o destino)
      return false;
    },
  },
  responseOnCorpTurnBegins: {
    Enumerate: function () {
      if (!this.rezzed) return [];
      var s = GetServer(this);
      if (!s) return [];
      var self = this;
      var targets = ChoicesArrayCards(s.root.filter(function (c) { return c != self; }));
      if (corp.AI != null) {
        var ag = targets.filter(function (t) { return t.card.cardType == "agenda"; });
        if (ag.length) return [ag[0]];
        var adv = targets.filter(function (t) { return t.card.canBeAdvanced; });
        return adv.length ? [adv[0]] : [];
      }
      return targets;
    },
    Resolve: function (params) { PlaceAdvancement(params.card, 1); },
    text: "La Costa Grid: 1 avanço",
  },
  RezUsability: function () { return currentPhase.identifier == "Runner 2.2" || currentPhase.identifier == "Run 4.5"; },
};

// =============================================================== GELOS
cardSet[34109] = {
  title: "Boto",
  imageFile: "34109.png",
  cardText: "Threat 4 → This ice gets +2 strength. [subroutine] Do 2 net damage. [subroutine] You may trash 1 card from HQ to end the run. [subroutine] You may trash 1 card from HQ to end the run.",
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "ice",
  subTypes: ["Barrier", "AP"],
  rezCost: 6,
  strength: 4,
  modifyStrength: { Resolve: function (card) { return card == this && JKCThreat(4) ? 2 : 0; } },
  subroutines: [
    { text: "Do 2 net damage.", Resolve: function () { JKCNet(2); }, visual: { y: 60, h: 16 } },
    { text: "You may trash 1 card from HQ to end the run.", Resolve: function () { JKCMayTrashFromHQ("Boto", function () { EndTheRun(); }, this); }, visual: { y: 76, h: 16 } },
    { text: "You may trash 1 card from HQ to end the run.", Resolve: function () { JKCMayTrashFromHQ("Boto", function () { EndTheRun(); }, this); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["netDamage", "netDamage"]], [["endTheRun"]], [["endTheRun"]]]; return result; },
};

cardSet[35054] = {
  title: "Semak-samun",
  imageFile: "35054.png",
  cardText: "The Runner cannot break the printed subroutine on this ice except using a fracter. [subroutine] End the run unless the Runner suffers 3 net damage.",
  player: corp,
  faction: "Jinteki",
  influence: 1,
  cardType: "ice",
  subTypes: ["Barrier", "AP"],
  rezCost: 3,
  strength: 3,
  onlyFracterBreaks: true,
  subroutines: [
    {
      text: "End the run unless the Runner suffers 3 net damage.",
      Resolve: function () {
        var choices = [
          { id: 0, label: "Sofrer 3 de dano neural", button: "Sofrer 3 de dano" },
          { id: 1, label: "Encerrar a run", button: "Encerrar a run" },
        ];
        DecisionPhase(runner, choices, function (p) {
          if (p.id == 0) JKCNet(3); else EndTheRun();
        }, "Semak-samun", "Semak-samun", this);
        if (runner.AI != null) runner.AI.preferred = { title: "Semak-samun", option: JKCSemakTakeDamage() ? choices[0] : choices[1] };
      },
      visual: { y: 90, h: 16 },
    },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["netDamage", "netDamage", "netDamage"], ["endTheRun"]]]; return result; },
};

cardSet[34044] = {
  title: "Tatu-Bola",
  imageFile: "34044.png",
  cardText: "When the Runner passes this ice, you may swap it with a piece of ice from HQ. If you do, gain 4[c]. (The new ice is installed unrezzed. You do not pay an install cost.) [subroutine] End the run.",
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 2,
  strength: 1,
  responseOnPassesIce: {
    Enumerate: function () {
      if (GetApproachEncounterIce() != this || !this.rezzed) return [];
      return corp.HQ.cards.some(function (c) { return c.cardType == "ice"; }) ? [{}] : [];
    },
    Resolve: function () {
      var self = this;
      var server = GetServer(this);
      var ices = corp.HQ.cards.filter(function (c) { return c.cardType == "ice"; });
      var choices = ChoicesArrayCards(ices);
      choices.push({ skip: true, label: "Não trocar", button: "Não trocar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        var idx = server.ice.indexOf(self);
        var savedApproach = approachIce;
        MoveCard(self, corp.HQ.cards);
        MoveCard(p.card, server.ice, idx);
        approachIce = savedApproach; // o Runner já passou desta posição
        p.card.rezzed = false;
        GainCredits(corp, 4);
        Log("Tatu-Bola trocado por um ice do HQ");
      }, "Tatu-Bola", "Tatu-Bola", this);
      if (corp.AI != null) {
        var best = choices.slice(0, -1).sort(function (a, b) { return (b.card.rezCost || 0) - (a.card.rezCost || 0); })[0];
        corp.AI.preferred = { title: "Tatu-Bola", option: best || choices[choices.length - 1] };
      }
    },
    text: "Tatu-Bola: trocar por ice do HQ e ganhar 4",
  },
  subroutines: [{ text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 90, h: 16 } }],
  AIImplementIce: function (rc, result) { result.sr = [[["endTheRun"]]]; return result; },
};

function JKCNetUnlessPay(title, n, amount) {
  var noCredits = JKCThreat(3) && title == "Attini";
  var choices = [];
  if (!noCredits && CheckCredits(runner, amount)) choices.push({ id: 0, label: "Pagar " + amount + "¢", button: "Pagar " + amount + "¢" });
  choices.push({ id: 1, label: "Sofrer " + n + " de dano neural", button: "Sofrer " + n + " de dano" });
  DecisionPhase(runner, choices, function (p) {
    if (p.id == 0) SpendCredits(runner, amount); else JKCNet(n);
  }, title, title, this);
  if (runner.AI != null) runner.AI.preferred = { title: title, option: choices[0] };
}

cardSet[34042] = {
  title: "Attini",
  imageFile: "34042.png",
  cardText: "Threat 3 → The Runner cannot spend credits while subroutines on this ice are resolving. [subroutine] Do 1 net damage unless the Runner pays 2[c]. (x3)",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Code Gate", "AP"],
  rezCost: 6,
  strength: 5,
  subroutines: [
    { text: "Do 1 net damage unless the Runner pays 2[c].", Resolve: function () { JKCNetUnlessPay("Attini", 1, 2); }, visual: { y: 60, h: 16 } },
    { text: "Do 1 net damage unless the Runner pays 2[c].", Resolve: function () { JKCNetUnlessPay("Attini", 1, 2); }, visual: { y: 76, h: 16 } },
    { text: "Do 1 net damage unless the Runner pays 2[c].", Resolve: function () { JKCNetUnlessPay("Attini", 1, 2); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["payCredits"], ["netDamage"]], [["payCredits"], ["netDamage"]], [["payCredits"], ["netDamage"]]]; return result; },
};

cardSet[33109] = {
  title: "Vampyronassa",
  imageFile: "33109.png",
  cardText: "[subroutine] The Runner loses 2[c]. [subroutine] Gain 2[c]. [subroutine] Do 2 net damage. [subroutine] You may draw 1 or 2 cards.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Code Gate", "AP"],
  rezCost: 7,
  strength: 4,
  subroutines: [
    { text: "The Runner loses 2[c].", Resolve: function () { LoseCredits(runner, 2); }, visual: { y: 56, h: 14 } },
    { text: "Gain 2[c].", Resolve: function () { GainCredits(corp, 2); }, visual: { y: 70, h: 14 } },
    { text: "Do 2 net damage.", Resolve: function () { JKCNet(2); }, visual: { y: 84, h: 14 } },
    { text: "You may draw 1 or 2 cards.", Resolve: function () {
        var choices = [{ n: 2, label: "Comprar 2", button: "Comprar 2" }, { n: 1, label: "Comprar 1", button: "Comprar 1" }, { n: 0, label: "Não comprar", button: "Não comprar" }];
        DecisionPhase(corp, choices, function (p) { if (p.n) Draw(corp, p.n); }, "Vampyronassa", "Vampyronassa", this);
        if (corp.AI != null) corp.AI.preferred = { title: "Vampyronassa", option: corp.RnD.cards.length > 4 ? choices[0] : choices[2] };
      }, visual: { y: 98, h: 14 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_moderate"]], [["misc_minor"]], [["netDamage", "netDamage"]], [["misc_minor"]]]; return result; },
};

cardSet[35074] = {
  title: "Biawak",
  imageFile: "35074.png",
  cardText: "You can forfeit 1 agenda as you rez this ice to pay for 10[c] of its rez cost. [subroutine] Trash 1 installed program or end the run. [subroutine] Trash 1 installed resource or end the run. [subroutine] End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "ice",
  subTypes: ["Sentry", "Destroyer"],
  rezCost: 14,
  strength: 6,
  subroutines: [
    { text: "Trash 1 installed program or end the run.", Resolve: function () { JKCTrashOrETR.call(this, "Biawak", "program"); }, visual: { y: 60, h: 16 } },
    { text: "Trash 1 installed resource or end the run.", Resolve: function () { JKCTrashOrETR.call(this, "Biawak", "resource"); }, visual: { y: 76, h: 16 } },
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["endTheRun"]], [["endTheRun"]], [["endTheRun"]]]; return result; },
};

cardSet[34110] = {
  title: "Cloud Eater",
  imageFile: "34110.png",
  cardText: "Whenever an encounter with this ice ends, if it was rezzed this turn, trash 1 installed Runner card unless the Runner takes 2 tags or suffers 3 net damage. [subroutine] Trash 1 installed Runner card. [subroutine] Give the Runner 2 tags. [subroutine] Do 3 net damage.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Sentry", "AP", "Destroyer", "Observer"],
  rezCost: 10,
  strength: 6,
  rezzedThisTurn: false,
  automaticOnRez: { Resolve: function (card) { if (card == this) this.rezzedThisTurn = true; } },
  responseOnCorpTurnBegins: { Resolve: function () { this.rezzedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.rezzedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  JKCTrashRunnerCard: function () {
    var targets = ChoicesInstalledCards(runner, function (c) { return CheckTrash(c); });
    if (!targets.length) return;
    DecisionPhase(corp, targets, function (p) { Trash(p.card, true); }, "Cloud Eater", "Trash", this, "trash");
  },
  responseOnEncounterEnds: {
    Enumerate: function () {
      return GetApproachEncounterIce() == this && this.rezzedThisTurn ? [{}] : [];
    },
    Resolve: function () {
      var self = this;
      var choices = [
        { id: 0, label: "Receber 2 tags", button: "Receber 2 tags" },
        { id: 1, label: "Sofrer 3 de dano neural", button: "Sofrer 3 de dano" },
        { id: 2, label: "Deixar a Corp dar trash em 1 carta instalada", button: "Perder 1 carta" },
      ];
      DecisionPhase(runner, choices, function (p) {
        if (p.id == 0) AddTags(2);
        else if (p.id == 1) JKCNet(3);
        else self.JKCTrashRunnerCard();
      }, "Cloud Eater", "Cloud Eater", this);
      if (runner.AI != null) runner.AI.preferred = { title: "Cloud Eater", option: choices[0] };
    },
    text: "Cloud Eater: fim do encontro",
  },
  subroutines: [
    { text: "Trash 1 installed Runner card.", Resolve: function () { this.JKCTrashRunnerCard ? this.JKCTrashRunnerCard() : null; }, visual: { y: 60, h: 16 } },
    { text: "Give the Runner 2 tags.", Resolve: function () { AddTags(2); }, visual: { y: 76, h: 16 } },
    { text: "Do 3 net damage.", Resolve: function () { JKCNet(3); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_serious"]], [["tag", "tag"]], [["netDamage", "netDamage", "netDamage"]]]; return result; },
};

cardSet[35052] = {
  title: "Empiricist",
  imageFile: "35052.png",
  cardText: "[subroutine] Draw 1 card. You may add 1 card from HQ to the top of R&D. [subroutine] Do 1 net damage. Give the Runner 1 tag. [subroutine] Do 2 net damage.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Sentry", "AP", "Observer"],
  rezCost: 7,
  strength: 5,
  subroutines: [
    { text: "Draw 1 card. You may add 1 card from HQ to the top of R&D.", Resolve: function () {
        Draw(corp, 1);
        if (corp.AI == null && corp.HQ.cards.length) {
          var choices = ChoicesArrayCards(corp.HQ.cards);
          choices.push({ skip: true, label: "Não devolver", button: "Não devolver" });
          DecisionPhase(corp, choices, function (p) { if (!p.skip) MoveCard(p.card, corp.RnD.cards); }, "Empiricist", "Empiricist", this);
        }
      }, visual: { y: 60, h: 16 } },
    { text: "Do 1 net damage. Give the Runner 1 tag.", Resolve: function () { JKCNet(1, function () { AddTags(1); }); }, visual: { y: 76, h: 16 } },
    { text: "Do 2 net damage.", Resolve: function () { JKCNet(2); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_minor"]], [["netDamage", "tag"]], [["netDamage", "netDamage"]]]; return result; },
};

cardSet[26044] = {
  title: "Saisentan",
  imageFile: "26044.png",
  cardText: "When the Runner encounters this ice, choose a card type. For the remainder of the encounter, whenever you trash a card of the chosen type with net damage from a subroutine on this ice, do 1 net damage. [subroutine] Do 1 net damage. (x3)",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Sentry", "AP", "Observer"],
  rezCost: 5,
  strength: 2,
  chosenType: null,
  automaticOnEncounter: {
    Resolve: function (card) {
      if (card != this) return;
      // a Corp escolhe o tipo; a IA escolhe o tipo mais comum no heap do Runner (informação pública)
      var counts = { event: 0, program: 0, hardware: 0, resource: 0 };
      runner.heap.forEach(function (c) { if (counts[c.cardType] !== undefined) counts[c.cardType]++; });
      var best = "event";
      for (var k in counts) if (counts[k] > counts[best]) best = k;
      this.chosenType = best;
      Log("Saisentan: Corp escolheu o tipo " + best);
    },
  },
  JKCSub: function () {
    var self = this;
    JKCNet(1, function (trashed) {
      if (trashed && trashed.some && trashed.some(function (c) { return c.cardType == self.chosenType; })) {
        Log("Saisentan: carta do tipo escolhido descartada, +1 dano");
        JKCNet(1);
      }
    });
  },
  subroutines: [
    { text: "Do 1 net damage.", Resolve: function () { this.JKCSub(); }, visual: { y: 60, h: 16 } },
    { text: "Do 1 net damage.", Resolve: function () { this.JKCSub(); }, visual: { y: 76, h: 16 } },
    { text: "Do 1 net damage.", Resolve: function () { this.JKCSub(); }, visual: { y: 92, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["netDamage"]], [["netDamage"]], [["netDamage"]]]; return result; },
};
