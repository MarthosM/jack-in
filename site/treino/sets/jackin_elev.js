// =====================================================================
// Jack In — Treino: cartas mais usadas no Standard atual (Elevation, Vantage Point e outras)
// Corp (com dicas para a IA): Flyswatter, Doomscroll, Lionsmane, Bigger Picture, Oppo Research,
//   Next Big Thing, Embedded Reporting, Nihilo Agent, Nebula Talent Management, Moon Pool,
//   Cohort Guidance Program, Byte!
// Runner (só o humano joga): Principia, Sang Kancil, Scrounge, Side Hustle, GAMEDRAGON™ Pro
// Códigos = NetrunnerDB. Licença: GPL-3.0 (derivado do Chiriboga). Requer sets/jackin_corp*.js.
// =====================================================================

// ------------------------------------------------------------ apoio
// JKE.opsThisTurn: operações jogadas pela Corp no turno; JKE.runnerHit: o Runner roubou ou deu trash
// em carta da Corp no último turno dele (Oppo Research)
var JKE = { opsThisTurn: 0, runnerHit: false, runnerHitNow: false, actionEndAsked: false };
(function () {
  var _AT = AutomaticTriggers;
  AutomaticTriggers = function (callbackName, params) {
    try {
      var c = params && params[0];
      if (callbackName == "automaticOnPlay" && c && c.player == corp && c.cardType == "operation") JKE.opsThisTurn++;
    } catch (e) {}
    return _AT.apply(this, arguments);
  };
  var _CP = ChangePhase;
  ChangePhase = function (phase) {
    try {
      if (phase && phase.identifier == "Corp 1.1") { JKE.opsThisTurn = 0; JKE.actionEndAsked = false; }
      if (phase && phase.identifier == "Runner 1.1") { JKE.runnerHitNow = false; JKE.runnerHit = false; }
      // a fase de ação da Corp terminou (Nebula Talent Management)
      if (phase === phases.corpDiscardStart && playerTurn == corp && !JKE.actionEndAsked) {
        JKE.actionEndAsked = true;
        var id = corp.identityCard;
        if (id && typeof id.JKEActionPhaseEnds == "function") id.JKEActionPhaseEnds();
      }
    } catch (e) {}
    return _CP.apply(this, arguments);
  };
  var _Trash = Trash;
  Trash = function (cards) {
    try {
      if (playerTurn == runner && typeof accessingCard != "undefined") {
        (Array.isArray(cards) ? cards : [cards]).forEach(function (c) {
          if (c && c.player == corp && c === accessingCard) { JKE.runnerHit = true; }
        });
      }
    } catch (e) {}
    return _Trash.apply(this, arguments);
  };
  if (typeof Steal == "function") {
    var _Steal = Steal;
    Steal = function () {
      try { if (playerTurn == runner) JKE.runnerHit = true; } catch (e) {}
      return _Steal.apply(this, arguments);
    };
  }
  // habilidades que a Corp usa em agenda da área de pontos do Runner (Next Big Thing)
  var _CTA = ChoicesTriggerableAbilities;
  ChoicesTriggerableAbilities = function (player, limitTo) {
    var ret = _CTA.apply(this, arguments);
    if (player == corp && limitTo == "click") {
      // habilidade paga sem clique (Moon Pool) também aparece na fase de ações
      InstalledCards(corp).forEach(function (c) {
        if (!c.jkPaidAnytime || !c.rezzed) return;
        ChoicesAbility(c, "").forEach(function (a) {
          if (!ret.some(function (r) { return r.card === c && r.ability === a.ability; })) ret.push({ card: c, ability: a.ability, label: "(" + c.title + ") " + a.ability.text });
        });
      });
    }
    if (player == corp) {
      runner.scoreArea.forEach(function (c) {
        if (!c.jkCorpUsesFromRunnerScore) return;
        ChoicesAbility(c, limitTo || "").forEach(function (a) {
          if (!ret.some(function (r) { return r.card === c && r.ability === a.ability; })) ret.push({ card: c, ability: a.ability, label: "(" + c.title + ", área do Runner) " + a.ability.text });
        });
      });
    }
    return ret;
  };
})();

function JKEThreat(n) { return AgendaPoints(corp) >= n || AgendaPoints(runner) >= n; }
function JKESkip(label) { return { skip: true, label: label, button: label }; }
// cartas instaladas da Corp que podem receber marcador de avanço (a IA prefere agenda no remoto)
function JKEAdvanceTargets() {
  return InstalledCards(corp).filter(function (c) { return c.cardType != "identity"; });
}
function JKEAIAdvancePick(cards) {
  var ag = cards.filter(function (c) { return c.cardType == "agenda" && corp.remoteServers.indexOf(GetServer(c)) > -1; });
  if (ag.length) return ag.sort(function (a, b) { return (AdvancementRequirement(a) - (a.advancement || 0)) - (AdvancementRequirement(b) - (b.advancement || 0)); })[0];
  var adv = cards.filter(function (c) { return typeof CheckAdvance == "function" && CheckAdvance(c); });
  return adv[0] || cards[0] || null;
}
// "você pode pôr 1 marcador de avanço numa carta instalada"
function JKEPlaceAdvancement(title, after, ctx) {
  var targets = JKEAdvanceTargets();
  if (!targets.length) { if (after) after.call(ctx); return; }
  var choices = ChoicesArrayCards(targets);
  choices.forEach(function (o) { o.label = "Marcador de avanço em " + GetTitle(o.card, true); o.button = o.label; });
  choices.push(JKESkip("Não colocar"));
  DecisionPhase(corp, choices, function (p) {
    if (!p.skip) { PlaceAdvancement(p.card, 1); Log(title + ": 1 marcador de avanço em " + GetTitle(p.card, true)); }
    if (after) after.call(ctx);
  }, title, "Marcador de avanço", ctx);
  if (corp.AI != null) {
    var pick = JKEAIAdvancePick(targets);
    corp.AI.preferred = { title: title, option: choices.filter(function (o) { return o.card === pick; })[0] || choices[choices.length - 1] };
  }
}
// cartas viradas para baixo em Archives
function JKEFacedownArchives() { return corp.archives.cards.filter(function (c) { return !c.faceUp; }); }

// ================================================================ GELOS
cardSet[35079] = {
  title: "Flyswatter",
  imageFile: "35079.png",
  cardText: "When you rez this ice during a run against this server, purge virus counters. [subroutine] End the run.",
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 2,
  strength: 0,
  responseOnRez: {
    Enumerate: function (card) {
      if (card == this && attackedServer !== null && attackedServer == GetServer(this)) return [{}];
      return [];
    },
    Resolve: function () { Log("Flyswatter: marcadores de vírus removidos (purge)"); Purge(); },
    text: "Flyswatter: purge de vírus",
  },
  subroutines: [
    { text: "End the run.", Resolve: function () { EndTheRun(); }, visual: { y: 102, h: 16 } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["endTheRun"]]]; return result; },
  AIRezForFree: function () { return attackedServer == GetServer(this); },
};

cardSet[35063] = {
  title: "Doomscroll",
  imageFile: "35063.png",
  cardText: "[subroutine] Give the Runner 1 tag. [subroutine] Do 1 net damage. [subroutine] Do 2 net damage if the Runner has at least 2 tags.",
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "ice",
  subTypes: ["Sentry", "AP", "Observer"],
  rezCost: 3,
  strength: 3,
  subroutines: [
    { text: "Give the Runner 1 tag.", Resolve: function () { AddTags(1); }, visual: { y: 80, h: 16 } },
    { text: "Do 1 net damage.", Resolve: function () { Damage("net", 1, true); }, visual: { y: 96, h: 16 } },
    {
      text: "Do 2 net damage if the Runner has at least 2 tags.",
      Resolve: function () {
        if (CheckTags(2)) Damage("net", 2, true);
        else Log("Doomscroll: o Runner tem menos de 2 tags, sem dano");
      },
      visual: { y: 112, h: 16 },
    },
  ],
  AIImplementIce: function (rc, result) {
    result.sr = [[["tag"]], [["netDamage"]]];
    if (runner.tags >= 1) result.sr.push([["netDamage", "netDamage"]]);
    return result;
  },
};

cardSet[36041] = {
  title: "Lionsmane",
  imageFile: "36041.png",
  cardText: "[subroutine] Do 2 net damage. [subroutine] Do 2 net damage unless the Runner pays 3[c]. [subroutine] Do 2 net damage unless the Runner jacks out.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "ice",
  subTypes: ["Sentry", "AP"],
  rezCost: 6,
  strength: 4,
  subroutines: [
    { text: "Do 2 net damage.", Resolve: function () { Damage("net", 2, true); }, visual: { y: 80, h: 16 } },
    {
      text: "Do 2 net damage unless the Runner pays 3[c].",
      Resolve: function () {
        JKCPayOr.call(this, "Lionsmane", 3, "Pagar 3¢", "Sofrer 2 de dano neural", function () { Damage("net", 2, true); },
          function () { return runner.grip.length <= 3; });
      },
      visual: { y: 96, h: 16 },
    },
    {
      text: "Do 2 net damage unless the Runner jacks out.",
      Resolve: function () {
        var choices = [
          { id: 0, label: "Desconectar (jack out)", button: "Desconectar" },
          { id: 1, label: "Sofrer 2 de dano neural", button: "Sofrer 2 de dano" },
        ];
        DecisionPhase(runner, choices, function (p) {
          if (p.id == 0) JackOut(); else Damage("net", 2, true);
        }, "Lionsmane", "Lionsmane", this);
        if (runner.AI != null) runner.AI.preferred = { title: "Lionsmane", option: runner.grip.length <= 2 ? choices[0] : choices[1] };
      },
      visual: { y: 112, h: 16 },
    },
  ],
  AIImplementIce: function (rc, result) {
    result.sr = [
      [["netDamage", "netDamage"]],
      [["payCredits", "payCredits", "payCredits"], ["netDamage", "netDamage"]],
      [["endTheRun"], ["netDamage", "netDamage"]],
    ];
    return result;
  },
};

// ============================================================ OPERAÇÕES
cardSet[35065] = {
  title: "Bigger Picture",
  imageFile: "35065.png",
  cardText: "Play only if the Runner is tagged. Resolve 1 of the following: Give the Runner 1 tag. / Remove any number of tags. The Runner loses 5[c] for each tag removed this way. Gain credits equal to the number of credits the Runner lost.",
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "operation",
  subTypes: ["Gray Ops"],
  playCost: 0,
  Enumerate: function () { return CheckTags(1) ? [{}] : []; },
  AIWouldPlay: function () { return CheckTags(1); },
  Resolve: function () {
    var choices = [{ id: -1, label: "Dar 1 tag ao Runner", button: "Dar 1 tag" }];
    for (var n = 1; n <= runner.tags; n++) {
      var loss = Math.min(Credits(runner), 5 * n);
      choices.push({ id: n, label: "Remover " + n + " tag(s): o Runner perde " + loss + "¢ e você ganha " + loss + "¢", button: "Remover " + n + " tag(s)" });
    }
    DecisionPhase(corp, choices, function (p) {
      if (p.id < 0) { AddTags(1); return; }
      var lost = Math.min(Credits(runner), 5 * p.id);
      RemoveTags(p.id);
      if (lost > 0) { LoseCredits(runner, lost); GainCredits(corp, lost); }
      Log("Bigger Picture: o Runner perdeu " + lost + "¢ e a Corp ganhou " + lost + "¢");
    }, "Bigger Picture", "Bigger Picture", this);
    if (corp.AI != null) {
      // IA: remove só as tags que o Runner consegue pagar inteiras; se ele está sem dinheiro, dá mais 1 tag
      var n = Math.min(runner.tags, Math.floor(Credits(runner) / 5));
      corp.AI.preferred = { title: "Bigger Picture", option: n > 0 ? choices[n] : choices[0] };
    }
  },
};

cardSet[34055] = {
  title: "Oppo Research",
  imageFile: "34055.png",
  cardText: "Play only if the Runner stole or trashed a Corp card during their last turn. After you resolve this operation, your action phase ends. Give the Runner 2 tags. Threat 3 → You may pay 5[c] to give the Runner 2 tags.",
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "operation",
  subTypes: ["Terminal", "Gray Ops"],
  playCost: 2,
  Enumerate: function () { return JKE.runnerHit ? [{}] : []; },
  AIWouldPlay: function () { return JKE.runnerHit && corp.clickTracker <= 2; },
  Resolve: function () {
    var self = this;
    var end = function () {
      // "depois de resolver esta operação, a sua fase de ação termina"
      if (corp.clickTracker > 0) { Log("Oppo Research: a fase de ação da Corp termina"); corp.clickTracker = 0; }
    };
    AddTags(2, function () {
      if (JKEThreat(3) && CheckCredits(corp, 5)) {
        var choices = [{ id: 0, label: "Pagar 5¢: mais 2 tags", button: "Pagar 5¢" }, JKESkip("Não pagar")];
        DecisionPhase(corp, choices, function (p) {
          if (p.skip) { end(); return; }
          SpendCredits(corp, 5, "using", self, function () { AddTags(2, end); }, self);
        }, "Oppo Research", "Oppo Research (Threat 3)", self);
        if (corp.AI != null) corp.AI.preferred = { title: "Oppo Research", option: Credits(corp) >= 9 ? choices[0] : choices[1] };
      } else end();
    }, this);
  },
};

// ============================================================== AGENDAS
cardSet[35060] = {
  title: "Next Big Thing",
  imageFile: "35060.png",
  cardText: "When this agenda is scored or stolen, place 1 agenda counter on it. [click], hosted agenda counter: Draw 4 cards. Shuffle any number of cards from HQ into R&D. The Corp can use this ability even if this agenda is in the Runner's score area.",
  player: corp,
  faction: "NBN",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 3,
  advancementRequirement: 5,
  jkCorpUsesFromRunnerScore: true,
  responseOnScored: {
    Resolve: function () { if (intended.score == this) AddCounters(this, "agenda", 1); },
    text: "Next Big Thing: 1 marcador de agenda",
    automatic: true,
  },
  responseOnStolen: {
    Resolve: function () { if (intended.steal == this) AddCounters(this, "agenda", 1); },
    text: "Next Big Thing: 1 marcador de agenda",
    automatic: true,
    availableWhenInactive: true,
  },
  abilities: [
    {
      text: "[click], marcador de agenda: comprar 4 cartas e embaralhar cartas do HQ no R&D",
      Enumerate: function () {
        if (playerTurn != corp) return [];
        if (corp.scoreArea.indexOf(this) < 0 && runner.scoreArea.indexOf(this) < 0) return [];
        if (!CheckCounters(this, "agenda", 1) || !corp.RnD.cards.length) return [];
        if (!CheckActionClicks(corp, 1)) return [];
        if (corp.AI != null && (corp.HQ.cards.length > 2 || corp.clickTracker < 2)) return [];
        return [{}];
      },
      Resolve: function () {
        var self = this;
        SpendClicks(corp, 1);
        RemoveCounters(this, "agenda", 1);
        Draw(corp, 4, function () { self.JKEShuffleBack(); }, this);
      },
    },
  ],
  AITriggerWhenCan: true,
  // embaralha no R&D quantas cartas quiser do HQ (uma de cada vez)
  JKEShuffleBack: function () {
    var back = [];
    var self = this;
    var done = function () {
      if (back.length) {
        back.forEach(function (c) { MoveCard(c, corp.RnD.cards); });
        Shuffle(corp.RnD.cards);
        Log("Next Big Thing: " + back.length + " carta(s) do HQ embaralhada(s) no R&D");
      }
    };
    if (corp.AI != null) {
      // IA: devolve o que passa do tamanho máximo da mão (as cartas mais fracas)
      var extra = corp.HQ.cards.length - MaxHandSize(corp);
      var pool = corp.HQ.cards.slice().sort(function (a, b) {
        var va = a.cardType == "agenda" ? 100 : (a.rezCost || a.playCost || 0), vb = b.cardType == "agenda" ? 100 : (b.rezCost || b.playCost || 0);
        return va - vb;
      });
      back = pool.slice(0, Math.max(0, extra));
      done();
      return;
    }
    var ask = function () {
      var choices = ChoicesArrayCards(corp.HQ.cards.filter(function (c) { return back.indexOf(c) < 0; }));
      choices.forEach(function (o) { o.label = "Embaralhar " + o.card.title + " no R&D"; o.button = o.label; });
      choices.push(JKESkip(back.length ? "Pronto" : "Não embaralhar nenhuma"));
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) { done(); return; }
        back.push(p.card);
        ask();
      }, "Next Big Thing", "Escolha cartas do HQ para embaralhar no R&D (" + back.length + " escolhida(s))", self);
    };
    ask();
  },
};

cardSet[35059] = {
  title: "Embedded Reporting",
  imageFile: "35059.png",
  cardText: "Dividends 2. When your discard phase ends, you may remove 1 hosted agenda counter to search R&D for 1 operation and reveal it. (Shuffle R&D after searching it.) Add that operation to the top of R&D.",
  player: corp,
  faction: "NBN",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 2,
  advancementRequirement: 3,
  AIOverAdvance: true,
  responseOnScored: {
    Resolve: function () {
      if (intended.score != this) return;
      var excess = (this.advancement || 0) - AdvancementRequirement(this);
      if (excess <= 0) return;
      AddCounters(this, "agenda", 2 * excess);
      Log("Embedded Reporting: dividendos, " + (2 * excess) + " marcador(es) de agenda");
    },
    text: "Embedded Reporting: dividendos",
    automatic: true,
  },
  responseOnCorpDiscardEnds: {
    Enumerate: function () {
      if (corp.scoreArea.indexOf(this) < 0 || !CheckCounters(this, "agenda", 1)) return [];
      if (!corp.RnD.cards.some(function (c) { return c.cardType == "operation"; })) return [];
      return [{}];
    },
    Resolve: function () {
      var self = this;
      var ops = corp.RnD.cards.filter(function (c) { return c.cardType == "operation"; });
      var choices = ChoicesArrayCards(ops);
      choices.forEach(function (o) { o.label = "Pôr " + o.card.title + " no topo do R&D"; o.button = o.label; });
      choices.push(JKESkip("Não usar"));
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        RemoveCounters(self, "agenda", 1);
        Log("Embedded Reporting revelou " + p.card.title + " e a pôs no topo do R&D");
        if (typeof RevealAdd == "function") RevealAdd("reveal", p.card);
        Shuffle(corp.RnD.cards);
        MoveCard(p.card, corp.RnD.cards); // o topo do R&D é o fim da lista
      }, "Embedded Reporting", "Buscar operação no R&D", this);
      if (corp.AI != null) {
        var pref = ["Hedge Fund", "Bigger Picture", "Predictive Planogram", "Oppo Research", "Public Trail"];
        var pick = null;
        pref.forEach(function (t) { if (!pick) pick = choices.filter(function (o) { return o.card && o.card.title == t; })[0]; });
        corp.AI.preferred = { title: "Embedded Reporting", option: pick || choices[0] };
      }
    },
    text: "Embedded Reporting: buscar operação",
  },
};

// =============================================================== ATIVOS
cardSet[36049] = {
  title: "Nihilo Agent",
  imageFile: "36049.png",
  cardText: "When you rez this asset, load 3 power counters onto it. When it is empty, trash it. When your turn begins, remove 1 tag and 1 bad publicity. When your discard phase ends, give the Runner 1 tag, take 1 bad publicity, and remove 1 hosted power counter.",
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "asset",
  subTypes: ["Enforcer", "Liability"],
  rezCost: 1,
  trashCost: 3,
  automaticOnRez: { Resolve: function (card) { if (card == this) AddCounters(this, "power", 3); } },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      if (!this.rezzed) return;
      if (runner.tags > 0) RemoveTags(1);
      if (corp.badPublicity > 0) { corp.badPublicity--; Log("Nihilo Agent: 1 publicidade negativa removida"); UpdateCounters(); }
    },
    text: "Nihilo Agent: remover 1 tag e 1 publicidade negativa",
    automatic: true,
  },
  responseOnCorpDiscardEnds: {
    Enumerate: function () { return this.rezzed && CheckCounters(this, "power", 1) ? [{}] : []; },
    Resolve: function () {
      var self = this;
      AddTags(1, function () {
        BadPublicity(1);
        RemoveCounters(self, "power", 1);
        if (!CheckCounters(self, "power", 1)) { Log("Nihilo Agent ficou vazio"); Trash(self, false); }
      }, this);
    },
    text: "Nihilo Agent: 1 tag no Runner e 1 publicidade negativa",
  },
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    return emptyProtectedRemotes.length;
  },
};

cardSet[33042] = {
  title: "Moon Pool",
  imageFile: "33042.png",
  cardText: "Remove this asset from the game: Trash up to 2 cards from HQ. Reveal up to 2 facedown cards in Archives and shuffle them into R&D. For each agenda revealed this way, you may place 1 advancement counter on an installed card.",
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "asset",
  subTypes: ["Facility"],
  rezCost: 3,
  trashCost: 3,
  abilities: [
    {
      text: "Remover do jogo: trash em até 2 cartas do HQ e devolver até 2 cartas viradas de Archives ao R&D",
      Enumerate: function () {
        if (!this.rezzed) return [];
        if (corp.AI != null) {
          // IA: usa quando há agenda virada em Archives ou carta sobrando no HQ para reciclar
          if (!JKEFacedownArchives().some(function (c) { return c.cardType == "agenda"; })) return [];
        } else if (!corp.HQ.cards.length && !JKEFacedownArchives().length) return [];
        return [{}];
      },
      Resolve: function () {
        var self = this;
        RemoveFromGame(this);
        Log("Moon Pool foi removido do jogo");
        var trashed = 0, back = [], agendas = 0;
        JKCRunSteps("Moon Pool", [
          function () { self.JKEPickHQ(trashed, function (c) { if (c) { trashed++; Trash(c, false); } }); },
          function () { if (trashed == 1) self.JKEPickHQ(trashed, function (c) { if (c) { trashed++; Trash(c, false); } }); },
          function () { self.JKEPickArchives(back, function (c) { if (c) back.push(c); }); },
          function () { if (back.length == 1) self.JKEPickArchives(back, function (c) { if (c) back.push(c); }); },
          function () {
            back.forEach(function (c) {
              c.faceUp = true;
              if (typeof RevealAdd == "function") RevealAdd("reveal", c);
              if (c.cardType == "agenda") agendas++;
              MoveCard(c, corp.RnD.cards);
            });
            if (back.length) { Shuffle(corp.RnD.cards); Log("Moon Pool: " + back.map(function (c) { return c.title; }).join(", ") + " revelada(s) e embaralhada(s) no R&D"); }
          },
          function () { if (agendas >= 1) JKEPlaceAdvancement("Moon Pool"); },
          function () { if (agendas >= 2) JKEPlaceAdvancement("Moon Pool"); },
        ], this);
      },
    },
  ],
  AITriggerWhenCan: true,
  jkPaidAnytime: true,
  JKEPickHQ: function (n, cb) {
    if (!corp.HQ.cards.length) { cb(null); return; }
    var choices = ChoicesArrayCards(corp.HQ.cards);
    choices.forEach(function (o) { o.label = "Trash em " + o.card.title; o.button = o.label; });
    choices.push(JKESkip("Parar"));
    DecisionPhase(corp, choices, function (p) { cb(p.skip ? null : p.card); }, "Moon Pool", "Trash em até 2 cartas do HQ (" + n + "/2)", this);
    if (corp.AI != null) {
      var spare = corp.HQ.cards.length > 3 ? JKCAIWorstHQCard() : null;
      corp.AI.preferred = { title: "Moon Pool", option: choices.filter(function (o) { return o.card === spare; })[0] || choices[choices.length - 1] };
    }
  },
  JKEPickArchives: function (already, cb) {
    var down = JKEFacedownArchives().filter(function (c) { return already.indexOf(c) < 0; });
    if (!down.length) { cb(null); return; }
    var choices = ChoicesArrayCards(down);
    choices.forEach(function (o) { o.label = "Devolver " + o.card.title + " ao R&D"; o.button = o.label; });
    choices.push(JKESkip("Parar"));
    DecisionPhase(corp, choices, function (p) { cb(p.skip ? null : p.card); }, "Moon Pool", "Revele até 2 cartas viradas de Archives (" + already.length + "/2)", this);
    if (corp.AI != null) {
      var ag = choices.filter(function (o) { return o.card && o.card.cardType == "agenda"; })[0];
      corp.AI.preferred = { title: "Moon Pool", option: ag || choices[choices.length - 1] };
    }
  },
  RezUsability: function () { return JKEFacedownArchives().length > 0 || corp.HQ.cards.length > 4; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    return emptyProtectedRemotes.length;
  },
};

cardSet[34108] = {
  title: "Cohort Guidance Program",
  imageFile: "34108.png",
  cardText: "When your turn begins, you may resolve 1 of the following: Trash 1 card from HQ. If you do, gain 2[c] and draw 1 card. / Turn 1 facedown card in Archives faceup. If you do, place 1 advancement counter on an installed card.",
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "asset",
  subTypes: ["Clone"],
  rezCost: 1,
  trashCost: 2,
  responseOnCorpTurnBegins: {
    Enumerate: function () { return this.rezzed && (corp.HQ.cards.length || JKEFacedownArchives().length) ? [{}] : []; },
    Resolve: function () {
      var self = this;
      var choices = [];
      if (corp.HQ.cards.length) choices.push({ id: 0, label: "Trash em 1 carta do HQ: ganhar 2¢ e comprar 1 carta", button: "Trash 1 do HQ" });
      if (JKEFacedownArchives().length) choices.push({ id: 1, label: "Virar 1 carta de Archives: 1 marcador de avanço", button: "Virar em Archives" });
      choices.push(JKESkip("Não usar"));
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        if (p.id == 0) {
          var pickHQ = ChoicesArrayCards(corp.HQ.cards);
          pickHQ.forEach(function (o) { o.label = "Trash em " + o.card.title; o.button = o.label; });
          DecisionPhase(corp, pickHQ, function (q) {
            Trash(q.card, false, function () { GainCredits(corp, 2); Draw(corp, 1); }, self);
          }, "Cohort Guidance Program", "Trash em 1 carta do HQ", self);
          if (corp.AI != null) {
            var w = JKCAIWorstHQCard();
            corp.AI.preferred = { title: "Cohort Guidance Program", option: pickHQ.filter(function (o) { return o.card === w; })[0] || pickHQ[0] };
          }
        } else {
          var down = JKEFacedownArchives();
          var pickA = ChoicesArrayCards(down);
          pickA.forEach(function (o) { o.label = "Virar " + o.card.title; o.button = o.label; });
          DecisionPhase(corp, pickA, function (q) {
            q.card.faceUp = true;
            Log("Cohort Guidance Program: " + q.card.title + " virada para cima em Archives");
            if (typeof RevealAdd == "function") RevealAdd("reveal", q.card);
            JKEPlaceAdvancement("Cohort Guidance Program");
          }, "Cohort Guidance Program", "Vire 1 carta de Archives", self);
          if (corp.AI != null) corp.AI.preferred = { title: "Cohort Guidance Program", option: pickA[0] };
        }
      }, "Cohort Guidance Program", "Cohort Guidance Program", this);
      if (corp.AI != null) {
        var hasAgendaRemote = InstalledCards(corp).some(function (c) { return c.cardType == "agenda"; });
        var pref = null;
        if (hasAgendaRemote && JKEFacedownArchives().length) pref = choices.filter(function (o) { return o.id == 1; })[0];
        if (!pref && corp.HQ.cards.length >= 3) pref = choices.filter(function (o) { return o.id == 0; })[0];
        corp.AI.preferred = { title: "Cohort Guidance Program", option: pref || choices[choices.length - 1] };
      }
    },
    text: "Cohort Guidance Program",
  },
  RezUsability: function () { return currentPhase.identifier.substring(0, 6) == "Corp 2" || currentPhase.identifier == "Runner 2.2"; },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    return emptyProtectedRemotes.length;
  },
};

// Byte! tem o mesmo texto do Snare!
if (cardSet[31054]) {
  cardSet[35050] = jQuery.extend({}, cardSet[31054], { title: "Byte!", imageFile: "35050.png" });
}

// =========================================================== IDENTIDADE
cardSet[35057] = {
  title: "Nebula Talent Management: Making Stars",
  imageFile: "35057.png",
  cardText: "When your action phase ends, if you played an operation this turn, gain 1[c] and flip this identity. // Flip side: The first time each turn you play an operation, gain [click]. When the Runner makes a successful run on HQ or R&D, flip this identity.",
  player: corp,
  faction: "NBN",
  cardType: "identity",
  subTypes: ["Division"],
  deckSize: 45,
  influenceLimit: 15,
  flipped: false,
  clickGainedTurn: -1,
  JKESideLabel: function () {
    return this.flipped ? "Verso: a 1ª operação de cada turno dá 1 clique" : "Frente: se jogar operação no turno, +1¢ e vira no fim da fase de ação";
  },
  JKEFlip: function (why) {
    this.flipped = !this.flipped;
    Log("Nebula Talent Management virou: " + this.JKESideLabel() + (why ? " (" + why + ")" : ""));
    if (typeof RevealAdd == "function") RevealAdd("reveal", this);
    if (typeof PhysicalNotice == "function" && typeof PhysicalHuman == "function" && PhysicalHuman() == corp) PhysicalNotice("Vire a sua identidade Nebula: " + this.JKESideLabel());
    Render();
  },
  JKEActionPhaseEnds: function () {
    if (!this.flipped && JKE.opsThisTurn > 0) {
      GainCredits(corp, 1);
      this.JKEFlip("a Corp jogou operação neste turno");
    }
  },
  automaticOnPlay: {
    Resolve: function (card) {
      if (!this.flipped || !card || card.player != corp || card.cardType != "operation") return;
      // a contagem já inclui esta operação
      if (JKE.opsThisTurn == 1 && playerTurn == corp) {
        corp.clickTracker++;
        Log("Nebula Talent Management: +1 clique (primeira operação do turno)");
      }
    },
    automatic: true,
  },
  automaticOnRunSuccessful: {
    Resolve: function () {
      if (this.flipped && (attackedServer === corp.HQ || attackedServer === corp.RnD)) this.JKEFlip("run com sucesso em " + (attackedServer === corp.HQ ? "HQ" : "R&D"));
    },
    automatic: true,
  },
};

// =================================================================== RUNNER
// Principia (Fracter): 1¢ mais barato para cada outro quebra-gelo instalado
cardSet[35032] = JackInBreaker({
  title: "Principia",
  imageFile: "35032.png",
  cardText: "This program costs 1[c] less to install for each other installed icebreaker. Interface → 1[c]: Break 1 barrier subroutine. 2[c]: +2 strength.",
  faction: "Shaper",
  influence: 1,
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 4,
  strength: 2,
  modifyInstallCost: {
    Resolve: function (card) {
      if (card != this) return 0;
      var n = InstalledCards(runner).filter(function (c) { return c !== card && CheckSubType(c, "Icebreaker"); }).length;
      return -n;
    },
    availableWhenInactive: true,
  },
});
cardSet[35032].abilities = [
  JackInBreakAbility("Barrier", 1),
  JackInBoostAbility("Barrier", 2, 2),
];

// Sang Kancil (Decoder): +2 de força por 3¢, ou 1¢ com evento de run ativo
function JKERunEventActive() {
  try {
    return !!attackedServer && runner.resolvingCards.some(function (c) { return c.cardType == "event" && CheckSubType(c, "Run"); });
  } catch (e) { return false; }
}
cardSet[35020] = JackInBreaker({
  title: "Sang Kancil",
  imageFile: "35020.png",
  cardText: "Interface → 1[c]: Break 1 code gate subroutine. 3[c]: +2 strength. If a run event is active, this ability costs 2[c] less to use.",
  faction: "Criminal",
  influence: 2,
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 3,
  strength: 2,
});
cardSet[35020].abilities = [
  JackInBreakAbility("Code Gate", 1),
  {
    text: "+2 strength (3¢; 1¢ com evento de run ativo).",
    Enumerate: function () {
      if (!CheckEncounter() || CheckStrength(this) || !CheckUnbrokenSubroutines()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return [];
      if (!CheckCredits(runner, JKERunEventActive() ? 1 : 3, "using", this)) return [];
      return [{}];
    },
    Resolve: function () {
      var cost = JKERunEventActive() ? 1 : 3;
      SpendCredits(runner, cost, "using", this, function () { BoostStrength(this, 2); }, this);
    },
  },
];

// Scrounge (evento Double): instalar 1 programa do heap; pode pôr outro programa do heap no fundo do stack
cardSet[35004] = {
  title: "Scrounge",
  imageFile: "35004.png",
  cardText: "As an additional cost to play this event, spend [click]. Install 1 program from your heap. You may add 1 program from your heap to the bottom of your stack.",
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "event",
  subTypes: ["Double"],
  playCost: 1,
  JKEHeapPrograms: function () { return runner.heap.filter(function (c) { return CheckCardType(c, ["program"]); }); },
  Enumerate: function () {
    var self = this;
    // o custo do evento (1¢) sai antes da instalação
    var opts = ChoicesArrayInstall(this.JKEHeapPrograms(), false).filter(function (o) {
      return CheckCredits(runner, 1 + InstallCost(o.card, o.host), "installing", o.card);
    });
    return opts.length ? [{}] : [];
  },
  Resolve: function () {
    var self = this;
    // passos numa fase própria: 1) instalar do heap; 2) programa do heap para o fundo do stack
    JKR2Loop("Scrounge", function (st) {
      if (st.k == 0) {
        st.k = 1;
        var opts = ChoicesArrayInstall(self.JKEHeapPrograms(), false);
        opts.forEach(function (o) { o.label = "Instalar " + o.card.title + (o.host ? " em " + o.host.title : "") + " (" + InstallCost(o.card, o.host) + "¢)"; o.button = undefined; });
        if (typeof JKR2Dedupe == "function") opts = JKR2Dedupe(opts);
        if (!opts.length) return;
        DecisionPhase(runner, opts, function (p) {
          Install(p.card, p.host, false, null, true);
        }, "Scrounge", "Instale 1 programa do heap", self, "install");
        return;
      }
      st.done = true;
      var rest = self.JKEHeapPrograms();
      if (!rest.length) return;
      var ch = ChoicesArrayCards(rest);
      ch.forEach(function (o) { o.label = "Pôr " + o.card.title + " no fundo do stack"; o.button = o.label; });
      if (typeof JKR2Dedupe == "function") ch = JKR2Dedupe(ch);
      ch.push(JKESkip("Não pôr"));
      DecisionPhase(runner, ch, function (p) {
        if (p.skip) return;
        MoveCard(p.card, runner.stack, 0); // o fundo do stack é o começo da lista
        Log("Scrounge: " + p.card.title + " foi para o fundo do stack");
      }, "Scrounge", "Scrounge: programa do heap para o fundo do stack?", self);
    }, this);
  },
};

// Side Hustle: 1¢ ao instalar e a cada run; com 6¢, pega tudo, vai para o heap e compra 1
cardSet[35034] = {
  title: "Side Hustle",
  imageFile: "35034.png",
  cardText: "When you install this resource and whenever a run begins, place 1[c] on this resource. When there are 6 or more hosted credits, take all credits from this resource, trash it, and draw 1 card.",
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  subTypes: ["Job"],
  installCost: 2,
  JKEAdd: function () {
    LoadCredits(this, 1);
    Log("Side Hustle: 1¢ no recurso (" + (this.credits || 0) + "¢)");
    if ((this.credits || 0) >= 6) {
      // acontece dentro de um gatilho automático (início da run): move as cartas direto, sem abrir janelas
      var n = this.credits;
      TakeCredits(runner, this, n);
      MoveCard(this, runner.heap);
      this.credits = 0;
      var top = runner.stack[runner.stack.length - 1];
      if (top) MoveCard(top, runner.grip);
      Log("Side Hustle: o Runner pegou " + n + "¢, o recurso foi para o heap e o Runner comprou 1 carta");
      UpdateCounters();
    }
  },
  automaticOnInstall: { Resolve: function (card) { if (card == this) this.JKEAdd(); } },
  automaticOnRunBegins: { Resolve: function () { this.JKEAdd(); }, automatic: true },
};

// GAMEDRAGON™ Pro: hospedado num quebra-gelo (não-AI); +1 de força e os aumentos de força valem até o fim da run
cardSet[35027] = {
  title: "GAMEDRAGON™ Pro",
  imageFile: "35027.png",
  cardText: "When you install this hardware and when your turn begins, you may host this hardware on an installed non-AI icebreaker. Host icebreaker gets +1 strength. Abilities that increase its strength last for the remainder of the run (instead of any shorter duration).",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "hardware",
  subTypes: ["Mod"],
  installCost: 2,
  unique: true,
  jkeHost: null,
  jkeRunBoost: 0,
  JKEBreakers: function () {
    return InstalledCards(runner).filter(function (c) { return CheckSubType(c, "Icebreaker") && !CheckSubType(c, "AI"); });
  },
  JKEAskHost: function () {
    var self = this;
    var list = this.JKEBreakers().filter(function (c) { return c !== self.jkeHost; });
    if (!list.length) return;
    var ch = ChoicesArrayCards(list);
    ch.forEach(function (o) { o.label = "Hospedar em " + o.card.title; o.button = o.label; });
    ch.push(JKESkip(this.jkeHost ? "Manter em " + this.jkeHost.title : "Não hospedar"));
    DecisionPhase(runner, ch, function (p) {
      if (p.skip) return;
      self.jkeHost = p.card; self.jkeRunBoost = 0;
      Log("GAMEDRAGON™ Pro agora está em " + p.card.title + " (+1 de força)");
      Render();
    }, "GAMEDRAGON™ Pro", "Hospedar o GAMEDRAGON™ Pro num quebra-gelo", this);
  },
  JKEHostOk: function () {
    var h = this.jkeHost;
    if (!h || !CheckInstalled(h)) { this.jkeHost = null; return false; }
    return CheckInstalled(this);
  },
  responseOnInstall: {
    Enumerate: function (card) { return card == this && this.JKEBreakers().length ? [{}] : []; },
    Resolve: function () { this.JKEAskHost(); },
    text: "GAMEDRAGON™ Pro: hospedar num quebra-gelo",
  },
  responseOnRunnerTurnBegins: {
    Enumerate: function () { return CheckInstalled(this) && this.JKEBreakers().length ? [{}] : []; },
    Resolve: function () { this.JKEAskHost(); },
    text: "GAMEDRAGON™ Pro: hospedar num quebra-gelo",
  },
  // o quebra-gelo hospedeiro saiu da mesa: o GAMEDRAGON vai junto
  automaticOnTrash: {
    Resolve: function (cards) {
      var self = this;
      if (!this.jkeHost) return;
      var list = Array.isArray(cards) ? cards : [cards];
      if (list.indexOf(this.jkeHost) > -1 && CheckInstalled(this)) {
        this.jkeHost = null;
        Log("GAMEDRAGON™ Pro foi para o heap junto com o quebra-gelo que o hospedava");
        MoveCard(self, runner.heap); // dentro de gatilho automático: sem abrir janela de trash
      }
    },
    automatic: true,
  },
  modifyStrength: {
    Resolve: function (card) {
      if (!this.jkeHost || card !== this.jkeHost || !this.JKEHostOk()) return 0;
      if (!attackedServer) this.jkeRunBoost = 0;
      // aumentos desta run que já saíram do strengthBoost do quebra-gelo (fim do encontro) continuam valendo
      return 1 + Math.max(0, this.jkeRunBoost - (card.strengthBoost || 0));
    },
  },
  responseOnRunEnds: { Resolve: function () { this.jkeRunBoost = 0; }, automatic: true },
};
// soma os aumentos de força do hospedeiro durante a run (GAMEDRAGON™ Pro)
(function () {
  var _BS = BoostStrength;
  BoostStrength = function (card, modifier) {
    try {
      if (attackedServer && modifier > 0) {
        InstalledCards(runner).forEach(function (g) {
          if (g.title == "GAMEDRAGON™ Pro" && g.jkeHost === card) g.jkeRunBoost = (g.jkeRunBoost || 0) + modifier;
        });
      }
    } catch (e) {}
    return _BS.apply(this, arguments);
  };
})();

// Cartas de Runner deste lote: só o humano sabe jogá-las
[35032, 35020, 35004, 35034, 35027].forEach(function (id) { if (cardSet[id]) cardSet[id].jkNoAI = true; });
