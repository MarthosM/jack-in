// =====================================================================
// Jack In — Treino: cartas adicionadas ao Chiriboga
// Cartas de Runner (o humano decide quando usar; por isso sem lógica de IA).
// Códigos = códigos do NetrunnerDB. Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================
setIdentifiers.push("jackin");

// Threat N: ativo se algum jogador tem N ou mais pontos de agenda
function ThreatLevel(n) {
  return AgendaPoints(corp) >= n || AgendaPoints(runner) >= n;
}
function JackInIceProtectedServers() {
  return ChoicesExistingServers().filter(function (c) {
    return c.server && c.server.ice.length > 0;
  });
}
// reseta uma flag nos dois inícios de turno
function JackInTurnReset(prop) {
  return {
    Resolve: function () { this[prop] = false; },
    automatic: true,
    availableWhenInactive: true,
  };
}
// "Quando estiver vazio, descarte": checado após qualquer mudança
function JackInTrashWhenEmpty(counter) {
  return {
    Resolve: function () {
      if (this.jackinLoaded && CheckInstalled(this) && !CheckCounters(this, counter, 1)) {
        this.jackinLoaded = false;
        Trash(this, false);
      }
    },
    automatic: true,
  };
}

// ------------------------------------------------------------------ ID
cardSet[36009] = {
  title: "Virtual Intelligence, P.I.: “You Can Call Me Vic”",
  imageFile: "36009.png",
  cardText: "Once per turn → [click], 1[c]: Draw 1 card and remove 1 tag.",
  player: runner,
  faction: "Criminal",
  subTypes: ["Digital"],
  link: 0,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  responseOnRunnerTurnBegins: JackInTurnReset("usedThisTurn"),
  responseOnCorpTurnBegins: JackInTurnReset("usedThisTurn"),
  abilities: [
    {
      text: "Draw 1 card and remove 1 tag.",
      Enumerate: function () {
        if (this.usedThisTurn) return [];
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        this.usedThisTurn = true;
        SpendCredits(runner, 1, "using", this, function () {
          if (runner.tags > 0) RemoveTags(1);
          Draw(runner, 1);
        }, this);
      },
    },
  ],
};

// ------------------------------------------------------------ EVENTOS
cardSet[26074] = {
  title: "Bravado",
  imageFile: "26074.png",
  cardText: "Run a server protected by ice. When that run ends, gain 6[c] plus 1[c] for each piece of ice you passed during that run.",
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 3,
  passedIce: [],
  bravadoRun: false,
  Enumerate: function () { return JackInIceProtectedServers(); },
  Resolve: function (params) {
    this.passedIce = [];
    this.bravadoRun = true;
    MakeRun(params.server);
  },
  responseOnPassesIce: {
    Resolve: function () {
      // o motor pode chamar este gatilho mais de uma vez por gelo: conta gelos distintos
      var ice = GetApproachEncounterIce();
      if (this.bravadoRun && ice && !this.passedIce.includes(ice)) this.passedIce.push(ice);
    },
    automatic: true,
  },
  responseOnRunEnds: {
    Enumerate: function () { return this.bravadoRun ? [{}] : []; },
    Resolve: function () {
      this.bravadoRun = false;
      GainCredits(runner, 6 + this.passedIce.length);
    },
    text: "Bravado: ganhar créditos",
  },
};

cardSet[35014] = {
  title: "Clean Getaway",
  imageFile: "35014.png",
  cardText: "Run any server. If successful, gain 6[c].",
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 3,
  Enumerate: function () { return ChoicesExistingServers(); },
  Resolve: function (params) { MakeRun(params.server); },
  responseOnRunSuccessful: {
    Resolve: function () { GainCredits(runner, 6); },
    text: "Clean Getaway: ganhar 6 créditos",
  },
};

cardSet[36010] = {
  title: "Kompromat",
  imageFile: "36010.png",
  cardText: "Run a server protected by ice. When that run ends, if it was successful, give the Corp 1 bad publicity unless they derez 1 piece of ice protecting the attacked server. Remove this event from the game.",
  player: runner,
  faction: "Criminal",
  influence: 4,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 2,
  runServer: null,
  runWasSuccessful: false,
  Enumerate: function () { return JackInIceProtectedServers(); },
  Resolve: function (params) {
    this.runServer = params.server;
    this.runWasSuccessful = false;
    MakeRun(params.server);
  },
  automaticOnRunSuccessful: {
    Resolve: function () { this.runWasSuccessful = true; },
    automatic: true,
  },
  responseOnRunUnsuccessful: {
    Resolve: function () { RemoveFromGame(this); },
    automatic: true,
  },
  responseOnRunEnds: {
    Enumerate: function () { return this.runWasSuccessful ? [{}] : []; },
    Resolve: function () {
      this.runWasSuccessful = false;
      var server = this.runServer;
      var card = this;
      var choices = [];
      if (server) {
        server.ice.forEach(function (ice) {
          if (ice.rezzed) choices.push({ card: ice, label: "Desvirar " + GetTitle(ice, true), button: "Desvirar " + GetTitle(ice, true) });
        });
      }
      choices.push({ badpub: true, label: "Receber 1 bad publicity", button: "Receber 1 bad publicity" });
      var title = "Kompromat: escolha da Corp";
      DecisionPhase(corp, choices, function (p) {
        if (p.badpub) BadPublicity(1);
        else Derez(p.card);
        RemoveFromGame(card);
      }, title, title, this);
      if (corp.AI != null) {
        // IA: desvira o gelo mais barato se custar até 3; senão aceita a bad publicity
        var best = choices[choices.length - 1];
        var bestCost = 4;
        choices.forEach(function (c) {
          if (c.card && RezCost(c.card) < bestCost) { best = c; bestCost = RezCost(c.card); }
        });
        corp.AI.preferred = { title: title, option: best };
      }
    },
    text: "Kompromat",
  },
};

cardSet[34068] = {
  title: "Privileged Access",
  imageFile: "34068.png",
  cardText: "Play only if you are not tagged. Run Archives. If successful, instead of breaching Archives, take 1 tag. When you take a tag with this event, you may install 1 resource from your heap, paying 2[c] less. Threat 3 → When you take a tag with this event, you may install 1 program from your heap.",
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 0,
  runWasSuccessful: false,
  discountActive: false,
  Enumerate: function () {
    if (runner.tags > 0) return [];
    return [{ server: corp.archives, label: "Archives" }];
  },
  Resolve: function () {
    this.runWasSuccessful = false;
    MakeRun(corp.archives);
  },
  automaticOnRunSuccessful: {
    Resolve: function () { this.runWasSuccessful = true; },
    automatic: true,
  },
  modifyInstallCost: {
    Resolve: function (card) {
      if (this.discountActive && (card == this.discountCard || (card.cardLocation == runner.heap && CheckCardType(card, ["resource"])))) return -2;
      return 0;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  specialOnInsteadOfBreaching: {
    Enumerate: function () {
      if (this.runWasSuccessful) return [{ required: true }];
      return [];
    },
    Resolve: function () {
      this.runWasSuccessful = false;
      AddTags(1, function () { this.JackInInstallResource(); }, this);
    },
  },
  JackInLabel: function (c, extra) {
    var cost = 0;
    try { cost = InstallCost(c.card, c.host); } catch (e) {}
    c.label = "Instalar " + c.card.title + " (" + cost + "¢" + (extra || "") + ")";
    c.button = undefined;
    return c;
  },
  JackInInstallResource: function () {
    var pa = this;
    // o programa (Threat 3) é oferecido quando a corrida termina, para não atropelar a instalação do recurso
    this.pendingProgram = ThreatLevel(3);
    this.discountActive = true;
    var choices = ChoicesArrayInstall(runner.heap).filter(function (c) {
      return CheckCardType(c.card, ["resource"]);
    }).map(function (c) { return pa.JackInLabel(c, ", 2¢ a menos"); });
    if (choices.length == 0) { this.discountActive = false; return; }
    choices.push({ skip: true, label: "Não instalar recurso", button: "Não instalar recurso" });
    DecisionPhase(runner, choices, function (p) {
      if (p.skip) { pa.discountActive = false; return; }
      pa.discountCard = p.card;
      var done = function () {
        pa.discountActive = false;
        pa.discountCard = null;
      };
      // o desconto precisa continuar ativo até o pagamento terminar
      Install(p.card, p.host, false, null, true, null, pa, done, done);
    }, "Privileged Access", "Instalar 1 recurso do heap (2 créditos a menos)", this);
  },
  responseOnRunEnds: {
    Enumerate: function () {
      if (!this.pendingProgram) return [];
      return [{}];
    },
    Resolve: function () {
      this.pendingProgram = false;
      this.JackInInstallProgram();
    },
    text: "Privileged Access: instalar programa do heap (Threat 3)",
  },
  JackInInstallProgram: function () {
    var pa = this;
    var choices = ChoicesArrayInstall(runner.heap).filter(function (c) {
      return CheckCardType(c.card, ["program"]);
    }).map(function (c) { return pa.JackInLabel(c); });
    if (choices.length == 0) { Log("Privileged Access: nenhum programa no heap que dê para instalar"); return; }
    choices.push({ skip: true, label: "Não instalar programa", button: "Não instalar programa" });
    DecisionPhase(runner, choices, function (p) {
      if (p.skip) return;
      Install(p.card, p.host, false, null, true);
    }, "Privileged Access", "Threat 3: instalar 1 programa do heap", this);
  },
};

cardSet[35017] = {
  title: "Transfer of Wealth",
  imageFile: "35017.png",
  cardText: "Run HQ. If successful, take 1 tag and the Corp loses 3[c]. Gain 2[c] for each credit lost this way.",
  player: runner,
  faction: "Criminal",
  influence: 4,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 0,
  Enumerate: function () { return [{ server: corp.HQ, label: "HQ" }]; },
  Resolve: function () { MakeRun(corp.HQ); },
  responseOnRunSuccessful: {
    Resolve: function () {
      AddTags(1, function () {
        var lost = LoseCredits(corp, Math.min(3, Credits(corp)));
        GainCredits(runner, 2 * lost);
      }, this);
    },
    text: "Transfer of Wealth",
  },
};

// ----------------------------------------------------------- HARDWARE
cardSet[34014] = {
  title: "Hermes",
  imageFile: "34014.png",
  cardText: "+1[mu]. Whenever an agenda is scored or stolen, add 1 unrezzed card to HQ. Limit 1 console per player.",
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 2,
  unique: true,
  memoryUnits: 1,
  JackInChoices: function () {
    return ChoicesInstalledCards(corp, function (c) { return !c.rezzed && c.cardType != "identity"; });
  },
  JackInResolve: function (params) {
    if (!params.card) return;
    MoveCard(params.card, corp.HQ.cards);
    Log("Hermes: carta não rezzada devolvida ao HQ");
  },
  responseOnScored: {
    Enumerate: function () { return this.JackInChoices(); },
    Resolve: function (params) { this.JackInResolve(params); },
    text: "Hermes: devolver 1 carta não rezzada ao HQ",
  },
  responseOnStolen: {
    Enumerate: function () { return this.JackInChoices(); },
    Resolve: function (params) { this.JackInResolve(params); },
    text: "Hermes: devolver 1 carta não rezzada ao HQ",
  },
};

cardSet[33078] = {
  title: "WAKE Implant v2A-JRJ",
  imageFile: "33078.png",
  cardText: "When you install this hardware, suffer 1 meat damage. Whenever you make a successful run on HQ, place 1 power counter on this hardware. Whenever you breach R&D, you may remove up to 3 hosted power counters to access that many additional cards.",
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Cybernetic"],
  installCost: 1,
  unique: true,
  extraAccess: 0,
  responseOnInstall: {
    Enumerate: function (card) { return card == this ? [{}] : []; },
    Resolve: function () { Damage("meat", 1, true); },
    text: "WAKE Implant: sofrer 1 dano de carne",
  },
  automaticOnRunSuccessful: {
    Resolve: function (server) {
      if (attackedServer == corp.HQ) AddCounters(this, "power", 1);
    },
    automatic: true,
  },
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (attackedServer != corp.RnD) return [];
      var n = Math.min(3, Counters(this, "power"));
      if (n < 1) return [];
      var ret = [];
      for (var i = n; i >= 1; i--) ret.push({ num: i, label: "Remover " + i + " (+" + i + " acesso" + (i > 1 ? "s" : "") + ")", button: "Remover " + i });
      ret.push({ num: 0, label: "Não usar", button: "Não usar" });
      return ret;
    },
    Resolve: function (params) {
      if (params.num > 0) {
        RemoveCounters(this, "power", params.num);
        this.extraAccess = params.num;
      }
    },
    text: "WAKE Implant: acessos extras em R&D",
  },
  modifyBreachAccess: {
    Resolve: function () {
      if (attackedServer == corp.RnD) return this.extraAccess;
      return 0;
    },
  },
  responseOnRunEnds: {
    Resolve: function () { this.extraAccess = 0; },
    automatic: true,
    availableWhenInactive: true,
  },
};

// ---------------------------------------------------------- RECURSOS
cardSet[26017] = {
  title: "“Baklan” Bochkin",
  imageFile: "26017.png",
  cardText: "The first time you encounter a piece of ice during each run, place 1 power counter on this resource. [trash], X hosted power counters: Derez the ice you are encountering if its strength is X or less. Take 1 tag.",
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 2,
  unique: true,
  encounteredThisRun: false,
  automaticOnRunBegins: {
    Resolve: function () { this.encounteredThisRun = false; },
    automatic: true,
  },
  automaticOnEncounter: {
    Resolve: function () {
      if (!this.encounteredThisRun) {
        this.encounteredThisRun = true;
        AddCounters(this, "power", 1);
      }
    },
    automatic: true,
  },
  abilities: [
    {
      text: "[trash], X power counters: Derez the ice you are encountering (strength X or less). Take 1 tag.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        var ice = GetApproachEncounterIce();
        if (!ice || !ice.rezzed) return [];
        var x = Math.max(0, Strength(ice));
        if (Counters(this, "power") < x) return [];
        return [{ num: x, label: "Gastar " + x + " marcador(es)" }];
      },
      Resolve: function (params) {
        var ice = GetApproachEncounterIce();
        if (params.num > 0) RemoveCounters(this, "power", params.num);
        Trash(this, false);
        Derez(ice);
        Bypass();
        AddTags(1);
      },
    },
  ],
};

cardSet[34073] = {
  title: "Arruaceiras Crew",
  imageFile: "34073.png",
  cardText: "Once per turn → Take 1 tag: The ice you are encountering gets –2 strength for the remainder of this encounter. [trash], 2[c]: Trash the ice you are encountering if its strength is 0 or less.",
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "resource",
  subTypes: ["Connection", "Seedy"],
  installCost: 2,
  usedThisTurn: false,
  strengthReduce: 0,
  responseOnRunnerTurnBegins: JackInTurnReset("usedThisTurn"),
  responseOnCorpTurnBegins: JackInTurnReset("usedThisTurn"),
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (card == attackedServer.ice[approachIce]) return this.strengthReduce;
      return 0;
    },
  },
  responseOnEncounterEnds: {
    Resolve: function () { this.strengthReduce = 0; },
    automatic: true,
  },
  abilities: [
    {
      text: "Take 1 tag: encountered ice gets -2 strength for the remainder of this encounter.",
      Enumerate: function () {
        if (this.usedThisTurn) return [];
        if (!CheckEncounter()) return [];
        var ice = GetApproachEncounterIce();
        if (!ice || ice.strengthCannotBeLowered) return [];
        return [{}];
      },
      Resolve: function () {
        this.usedThisTurn = true;
        AddTags(1, function () { this.strengthReduce -= 2; }, this);
      },
    },
    {
      text: "[trash], 2[c]: Trash the ice you are encountering if its strength is 0 or less.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        var ice = GetApproachEncounterIce();
        if (!ice || Strength(ice) > 0) return [];
        if (!CheckTrash(ice)) return [];
        if (!CheckCredits(runner, 2, "using", this)) return [];
        return [{}];
      },
      Resolve: function () {
        var ice = GetApproachEncounterIce();
        SpendCredits(runner, 2, "using", this, function () {
          Trash(this, false);
          Bypass();
          Trash(ice, true);
        }, this);
      },
    },
  ],
};

cardSet[26094] = {
  title: "Daily Casts",
  imageFile: "26094.png",
  cardText: "When you install this resource, load 8[c] onto it. When it is empty, trash it. When your turn begins, take 2[c] from this resource.",
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  installCost: 3,
  jackinLoaded: false,
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) { LoadCredits(this, 8); this.jackinLoaded = true; }
    },
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () { TakeCredits(runner, this, 2); },
    automatic: true,
  },
  automaticOnAnyChange: JackInTrashWhenEmpty("credits"),
};

cardSet[33092] = {
  title: "Dr. Nuka Vrolyck",
  imageFile: "33092.png",
  cardText: "When you install this resource, load 2 power counters onto it. When it is empty, trash it. [click], hosted power counter: Draw 3 cards.",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 1,
  unique: true,
  jackinLoaded: false,
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) { AddCounters(this, "power", 2); this.jackinLoaded = true; }
    },
  },
  abilities: [
    {
      text: "Draw 3 cards.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCounters(this, "power", 1)) return [];
        return [{}];
      },
      Resolve: function () {
        SpendClicks(runner, 1);
        RemoveCounters(this, "power", 1);
        Draw(runner, 3);
      },
    },
  ],
  automaticOnAnyChange: JackInTrashWhenEmpty("power"),
};

cardSet[26095] = {
  title: "DreamNet",
  imageFile: "26095.png",
  cardText: "The first time each turn you make a successful run, draw 1 card. If your identity is digital or you have at least 2[link], also gain 1[c].",
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost: 3,
  unique: true,
  usedThisTurnDN: false,
  responseOnRunnerTurnBegins: JackInTurnReset("usedThisTurnDN"),
  responseOnCorpTurnBegins: JackInTurnReset("usedThisTurnDN"),
  responseOnRunSuccessful: {
    Enumerate: function () { return this.usedThisTurnDN ? [] : [{}]; },
    Resolve: function () {
      this.usedThisTurnDN = true;
      var digital = runner.identityCard && (runner.identityCard.subTypes || []).includes("Digital");
      if (digital || Link() >= 2) GainCredits(runner, 1);
      Draw(runner, 1);
    },
    text: "DreamNet: comprar 1 carta",
  },
};

cardSet[35022] = {
  title: "Open Market",
  imageFile: "35022.png",
  cardText: "When you install this resource, load 6[c] onto it. When it is empty, trash it. You can spend hosted credits to install connection and job resources. When your turn begins, take 1[c] from this resource.",
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "resource",
  subTypes: ["Job", "Location"],
  installCost: 2,
  jackinLoaded: false,
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) { LoadCredits(this, 6); this.jackinLoaded = true; }
    },
  },
  canUseCredits: function (doing, card) {
    if (doing != "installing" || !card) return false;
    if (!CheckCardType(card, ["resource"])) return false;
    return CheckSubType(card, "Connection") || CheckSubType(card, "Job");
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () { TakeCredits(runner, this, 1); },
    automatic: true,
  },
  automaticOnAnyChange: JackInTrashWhenEmpty("credits"),
};

cardSet[26018] = {
  title: "The Class Act",
  imageFile: "26018.png",
  cardText: "When a discard phase ends, if you installed this resource this turn, draw 4 cards. [interrupt] → The first time each turn you would draw any number of cards, look at the top X cards of your stack. Add 1 of those cards to the bottom of your stack. X is equal to the number of cards you would draw plus 1.",
  player: runner,
  faction: "Criminal",
  influence: 5,
  cardType: "resource",
  subTypes: ["Connection", "Ritzy"],
  installCost: 4,
  unique: true,
  installedThisTurn: false,
  drewThisTurn: false,
  automaticOnInstall: {
    Resolve: function (card) { if (card == this) this.installedThisTurn = true; },
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () { this.installedThisTurn = false; this.drewThisTurn = false; },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () { this.installedThisTurn = false; this.drewThisTurn = false; },
    automatic: true,
  },
  responseOnRunnerDiscardEnds: {
    Enumerate: function () { return this.installedThisTurn ? [{}] : []; },
    Resolve: function () { this.installedThisTurn = false; Draw(runner, 4); },
    text: "The Class Act: comprar 4 cartas",
  },
  responseOnCorpDiscardEnds: {
    Enumerate: function () { return this.installedThisTurn ? [{}] : []; },
    Resolve: function () { this.installedThisTurn = false; Draw(runner, 4); },
    text: "The Class Act: comprar 4 cartas",
  },
  // A segunda habilidade mexe só na ordem do baralho físico: o sistema apenas lembra o jogador.
  modifyDraw: {
    Resolve: function (player) {
      if (player == runner && !this.drewThisTurn && CheckInstalled(this)) {
        this.drewThisTurn = true;
        Log("The Class Act: antes de comprar, olhe o topo do seu baralho (cartas a comprar + 1) e coloque 1 no fundo.");
        if (typeof PhysicalNotice === "function") PhysicalNotice("The Class Act: antes de comprar, olhe as cartas do topo (quantidade a comprar + 1) e coloque 1 delas no fundo do baralho.");
      }
      return 0;
    },
    automatic: true,
  },
};

// ----------------------------------------------------------- PROGRAMAS
function JackInBreaker(def) {
  // monta um quebra-gelo padrão (quebrar 1 sub por N créditos, +X de força por M créditos)
  var card = {
    player: runner,
    cardType: "program",
    strengthBoost: 0,
    modifyStrength: {
      Resolve: function (c) {
        if (c != this) return 0;
        return this.strengthBoost + (typeof this.JackInStrengthMod == "function" ? this.JackInStrengthMod() : 0);
      },
    },
    responseOnEncounterEnds: {
      Resolve: function () { this.strengthBoost = 0; },
      automatic: true,
    },
    abilities: [],
  };
  for (var k in def) card[k] = def[k];
  return card;
}
function JackInBreakAbility(iceType, cost, extraResolve) {
  return {
    text: "Break 1 " + iceType.toLowerCase() + " subroutine.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], iceType)) return [];
      if (!CheckCredits(runner, cost, "using", this)) return [];
      if (!CheckStrength(this)) return [];
      return ChoicesEncounteredSubroutines();
    },
    Resolve: function (params) {
      SpendCredits(runner, cost, "using", this, function () {
        Break(params.subroutine);
        if (typeof extraResolve == "function") extraResolve.call(this, params);
      }, this);
    },
  };
}
function JackInBoostAbility(iceType, cost, amount) {
  return {
    text: "+" + amount + " strength.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (CheckStrength(this)) return [];
      if (!CheckUnbrokenSubroutines()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], iceType)) return [];
      if (!CheckCredits(runner, cost, "using", this)) return [];
      return [{}];
    },
    Resolve: function () {
      SpendCredits(runner, cost, "using", this, function () { BoostStrength(this, amount); }, this);
    },
  };
}

cardSet[34015] = JackInBreaker({
  title: "Curupira",
  imageFile: "34015.png",
  cardText: "Whenever you encounter a barrier, you may spend 3 hosted power counters to bypass it. Whenever this program fully breaks a piece of ice, place 1 power counter on this program. Interface → 1[c]: Break 1 barrier subroutine. 1[c]: +1 strength.",
  faction: "Criminal",
  influence: 3,
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 3,
  strength: 1,
  brokenThisEncounter: 0,
  automaticOnEncounter: {
    Resolve: function () { this.brokenThisEncounter = 0; },
    automatic: true,
  },
  responseOnEncounter: {
    Enumerate: function () {
      var ice = GetApproachEncounterIce();
      if (!ice || !CheckSubType(ice, "Barrier")) return [];
      if (!CheckCounters(this, "power", 3)) return [];
      return [{}];
    },
    Resolve: function () {
      BinaryDecision(runner, "Contornar (3 marcadores)", "Não contornar", "Curupira", this, function () {
        RemoveCounters(this, "power", 3);
        Bypass();
      });
    },
    text: "Curupira: contornar barreira?",
  },
});
cardSet[34015].abilities = [
  JackInBreakAbility("Barrier", 1, function () {
    this.brokenThisEncounter++;
    var ice = GetApproachEncounterIce();
    if (ice && ice.subroutines.length > 0 && this.brokenThisEncounter == ice.subroutines.length &&
        ice.subroutines.every(function (s) { return s.broken; })) {
      AddCounters(this, "power", 1);
    }
  }),
  JackInBoostAbility("Barrier", 1, 1),
];

cardSet[33018] = JackInBreaker({
  title: "Revolver",
  imageFile: "33018.png",
  cardText: "When you install this program, place 6 power counters on it. Interface → [trash] or hosted power counter: Break 1 sentry subroutine. 2[c]: +3 strength.",
  faction: "Criminal",
  influence: 3,
  subTypes: ["Icebreaker", "Killer", "Weapon"],
  memoryCost: 1,
  installCost: 2,
  strength: 1,
  automaticOnInstall: {
    Resolve: function (card) { if (card == this) AddCounters(this, "power", 6); },
  },
});
cardSet[33018].abilities = [
  {
    text: "Hosted power counter: Break 1 sentry subroutine.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
      if (!CheckCounters(this, "power", 1)) return [];
      if (!CheckStrength(this)) return [];
      return ChoicesEncounteredSubroutines();
    },
    Resolve: function (params) {
      RemoveCounters(this, "power", 1);
      Break(params.subroutine);
    },
  },
  {
    text: "[trash]: Break 1 sentry subroutine.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
      if (!CheckStrength(this)) return [];
      return ChoicesEncounteredSubroutines();
    },
    Resolve: function (params) {
      Trash(this, false);
      Break(params.subroutine);
    },
  },
  JackInBoostAbility("Sentry", 2, 3),
];

cardSet[34018] = JackInBreaker({
  title: "Shibboleth",
  imageFile: "34018.png",
  cardText: "Threat 4 → This program gets −2 strength. Interface → 1[c]: Break 1 code gate subroutine. 2[c]: +2 strength.",
  faction: "Criminal",
  influence: 2,
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 1,
  strength: 3,
  JackInStrengthMod: function () { return ThreatLevel(4) ? -2 : 0; },
});
cardSet[34018].abilities = [
  JackInBreakAbility("Code Gate", 1),
  JackInBoostAbility("Code Gate", 2, 2),
];

// Cartas do deck Vic: só o humano sabe jogá-las (a IA de Runner não tem lógica para elas)
[36009,26074,35014,36010,34068,35017,34014,33078,26017,34073,26094,33092,26095,35022,26018,34015,33018,34018].forEach(function (id) {
  if (cardSet[id]) cardSet[id].jkNoAI = true;
});
