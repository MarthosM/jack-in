// =====================================================================
// Jack In — Treino: cartas de Runner (lote 2)
// Magdalene Keino-Chemutai e cartas de Shaper/Criminal/Anarch pedidas para o treino.
// Só o humano joga estas cartas (a IA de Runner não tem lógica para elas).
// Códigos = códigos do NetrunnerDB. Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

// ------------------------------------------------------------ apoio
// Registro do turno: runs com sucesso por servidor, programa lixado, cliques ganhos durante run
var JKR2 = { turn: 0, succ: [], progTrashedTurn: -1, runClickGains: 0, discardMark: -1 };
(function () {
  var _AT = AutomaticTriggers;
  AutomaticTriggers = function (callbackName, params) {
    try {
      if (callbackName == "automaticOnRunSuccessful" && attackedServer && JKR2.succ.indexOf(attackedServer) < 0) JKR2.succ.push(attackedServer);
    } catch (e) {}
    return _AT.apply(this, arguments);
  };
  var _CP = ChangePhase;
  ChangePhase = function (phase) {
    try {
      if (phase === phases.runnerTurnBegin || phase === phases.corpTurnBegin) { JKR2.turn++; JKR2.succ = []; JKR2.runClickGains = 0; }
      if (phase === phases.runnerDiscardStart) JKR2.discardMark = runner.heap.length;
    } catch (e) {}
    return _CP.apply(this, arguments);
  };
  var _Trash = Trash;
  Trash = function (cards) {
    try {
      (Array.isArray(cards) ? cards : [cards]).forEach(function (c) {
        if (c && c.player == runner && CheckCardType(c, ["program"]) && CheckInstalled(c)) JKR2.progTrashedTurn = JKR2.turn;
      });
    } catch (e) {}
    return _Trash.apply(this, arguments);
  };
})();
function JKR2Programs(arr, extra) {
  return arr.filter(function (c) { return CheckCardType(c, ["program"]) && (!extra || extra(c)); });
}
function JKR2Skip(label) { return { skip: true, label: label, button: label }; }
// nome de uma ice para o Runner (ice não rezzada aparece só pela posição)
function JKR2IceName(ice) {
  var where = "";
  try { where = " em " + ServerName(GetServer(ice)); } catch (e) {}
  return (ice.rezzed || ice.knownToRunner ? ice.title : "ice não rezzada") + where;
}
// passos em sequência dentro de uma fase própria (uma instalação por vez, voltando ao passo seguinte)
function JKR2Loop(title, fn, ctx, player) {
  var back = currentPhase, state = { done: false, k: 0 };
  var P = {
    identifier: back.identifier, title: title, player: player || runner, requireHumanInput: false, next: back, context: ctx,
    Enumerate: { n: function () { return [{}]; } },
    Resolve: { n: function () {
      if (state.done) { ChangePhase(back, true); return; }
      try { fn.call(ctx, state); } catch (e) { LogError(e); state.done = true; }
    } },
  };
  ChangePhase(P, true);
}
// tira opções repetidas (cópias iguais da mesma carta)
function JKR2Dedupe(list) {
  var seen = {};
  return list.filter(function (o) { if (seen[o.label]) return false; seen[o.label] = 1; return true; });
}
// mostra a carta para o humano que é o Runner (nesta tela)
function JKR2ShowToRunner(card) {
  try {
    var me = typeof X1 != "undefined" && X1.role == "host" && X1.started ? X1.mySide() : (typeof PhysicalHuman == "function" ? PhysicalHuman() : null);
    if (me === runner && typeof RevealShowCard == "function") setTimeout(function () { RevealShowCard(card.title, "", "revealed", "Corp"); }, 80);
  } catch (e) {}
}
// roubar uma agenda fora do acesso normal de uma run
function JKR2Steal(card, done) {
  intended.steal = card;
  MoveCard(card, runner.scoreArea);
  card.faceUp = true;
  Log(GetTitle(card, true) + " stolen");
  TriggeredResponsePhase(playerTurn, "responseOnStolen", [], function () {
    card.advancement = 0;
    intended.steal = null;
    if (typeof done == "function") done();
  }, "Stolen");
}
// acesso simples a uma carta (Deep Dive, Pinhole Threading): roubar agenda ou pagar para lixar
function JKR2Access(card, opts, done) {
  opts = opts || {};
  var prev = accessingCard;
  accessingCard = card;
  try { if (typeof RevealAdd == "function") RevealAdd("access", card); } catch (e) {}
  try { AutomaticTriggers("automaticOnAccess", [card]); } catch (e) {}
  Log("Runner accessed " + card.title);
  var choices = [];
  if (CheckCardType(card, ["agenda"])) {
    if (opts.noStealTrash) choices.push({ id: "n", label: card.title + ": agenda (não pode roubar nem lixar neste acesso)" });
    else choices.push({ id: "steal", label: "Roubar " + card.title });
  } else {
    var tc = typeof card.trashCost != "undefined" ? TrashCost(card) : null;
    if (tc !== null && !opts.noStealTrash && CheckCredits(runner, tc, "paying trash costs", card))
      choices.push({ id: "trash", label: "Pagar " + tc + "¢ e lixar " + card.title });
    choices.push({ id: "n", label: "Deixar " + card.title });
  }
  DecisionPhase(runner, choices, function (p) {
    accessingCard = prev;
    if (p.id == "steal") { JKR2Steal(card, done); return; }
    if (p.id == "trash") {
      SpendCredits(runner, TrashCost(card), "paying trash costs", card, function () {
        Trash(card, true, function () { if (typeof done == "function") done(); });
      });
      return;
    }
    if (typeof done == "function") done();
  }, "Acessando: " + card.title, "Acessando " + card.title);
}

// ------------------------------------------------------------ IDENTIDADE
cardSet[35024] = {
  title: "Magdalene Keino-Chemutai: Cryptarchitect",
  imageFile: "35024.png",
  cardText: "Whenever you discard cards to reach your maximum hand size, you may install 1 program or piece of hardware from among those cards.",
  player: runner,
  faction: "Shaper",
  subTypes: ["Cyborg"],
  link: 0,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  responseOnRunnerDiscardEnds: {
    Enumerate: function () {
      if (JKR2.discardMark < 0) return [];
      var discarded = runner.heap.slice(JKR2.discardMark);
      var choices = [];
      discarded.forEach(function (c) {
        if (!CheckCardType(c, ["program", "hardware"])) return;
        ChoicesCardInstall(c).forEach(function (o) {
          o.label = "Instalar " + c.title + (o.host ? " em " + o.host.title : "") + " (descartada)";
          choices.push(o);
        });
      });
      if (!choices.length) return [];
      choices.push(JKR2Skip("Não instalar"));
      return choices;
    },
    Resolve: function (params) {
      JKR2.discardMark = -1;
      if (params.skip || !params.card) return;
      Install(params.card, params.host, false, null, true);
    },
    text: "Magdalene: instalar 1 programa ou hardware descartado",
  },
};

// ------------------------------------------------------------ EVENTOS
cardSet[34085] = {
  title: "Burner",
  imageFile: "34085.png",
  cardText: "Run HQ. If successful, instead of breaching HQ, reveal 3 cards in HQ at random. Add 2 of the revealed cards to the top and/or bottom of R&D.",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 1,
  burnerOk: false,
  Enumerate: function () { return [{}]; },
  Resolve: function () { this.burnerOk = false; MakeRun(corp.HQ); },
  responseOnRunSuccessful: {
    Resolve: function () { if (attackedServer == corp.HQ) this.burnerOk = true; },
    automatic: true,
  },
  specialOnInsteadOfBreaching: {
    Enumerate: function () {
      if (!this.burnerOk || attackedServer != corp.HQ || corp.HQ.cards.length < 1) return [];
      return [{ required: true, label: "Burner: revelar 3 cartas do HQ" }];
    },
    Resolve: function () {
      this.burnerOk = false;
      var pool = corp.HQ.cards.slice();
      Shuffle(pool);
      var revealed = pool.slice(0, 3);
      revealed.forEach(function (c) { try { if (typeof RevealAdd == "function") RevealAdd("reveal", c); } catch (e) {} });
      Log("Burner revelou do HQ: " + revealed.map(function (c) { return c.title; }).join(", "));
      var toPlace = Math.min(2, revealed.length);
      var placeOne = function (left) {
        if (left <= 0) return;
        var opts = [];
        revealed.forEach(function (c) {
          if (c.cardLocation !== corp.HQ.cards) return;
          opts.push({ c: c, top: true, label: c.title + " no topo do R&D" });
          opts.push({ c: c, top: false, label: c.title + " no fundo do R&D" });
        });
        if (!opts.length) return;
        DecisionPhase(runner, opts, function (p) {
          if (p.top) MoveCard(p.c, corp.RnD.cards);
          else MoveCard(p.c, corp.RnD.cards, 0);
          Log("Burner: " + p.c.title + (p.top ? " foi para o topo do R&D" : " foi para o fundo do R&D"));
          placeOne(left - 1);
        }, "Burner", "Escolha a carta e onde ela vai no R&D (faltam " + left + ")");
      };
      placeOne(toPlace);
    },
  },
};

cardSet[33022] = {
  title: "Deep Dive",
  imageFile: "33022.png",
  cardText: "Play only if you made a successful run on HQ, R&D, and Archives this turn. The Corp must set aside the top 8 cards of R&D faceup. Access 1 of those cards. You may spend [click] to access another 1 of those cards. Then, the Corp shuffles the set-aside cards into R&D.",
  player: runner,
  faction: "Shaper",
  influence: 5,
  cardType: "event",
  playCost: 2,
  setAside: [],
  Enumerate: function () {
    if (playerTurn != runner) return [];
    if (JKR2.succ.indexOf(corp.HQ) < 0 || JKR2.succ.indexOf(corp.RnD) < 0 || JKR2.succ.indexOf(corp.archives) < 0) return [];
    if (!corp.RnD.cards.length) return [];
    return [{}];
  },
  Resolve: function () {
    var self = this;
    var n = Math.min(8, corp.RnD.cards.length);
    this.setAside = [];
    for (var i = 0; i < n; i++) {
      var c = corp.RnD.cards[corp.RnD.cards.length - 1];
      MoveCard(c, this.setAside);
      c.faceUp = true;
    }
    Log("Deep Dive: a Corp separou " + n + " cartas do topo do R&D: " + this.setAside.map(function (c) { return c.title; }).join(", "));
    var finish = function () {
      while (self.setAside.length) { var c = self.setAside[0]; c.faceUp = false; MoveCard(c, corp.RnD.cards); }
      Shuffle(corp.RnD.cards);
      Log("Deep Dive: a Corp embaralhou as cartas separadas no R&D");
    };
    var accessed = [];
    var pick = function (first) {
      var opts = [];
      self.setAside.forEach(function (c, i) {
        if (accessed.indexOf(c) > -1) return;
        opts.push({ c: c, label: "Acessar " + c.title + " (" + (i + 1) + "ª separada)" });
      });
      if (!opts.length) { finish(); return; }
      if (!first) opts.push(JKR2Skip("Terminar"));
      DecisionPhase(runner, opts, function (p) {
        if (p.skip) { finish(); return; }
        accessed.push(p.c);
        JKR2Access(p.c, {}, function () {
          var left = self.setAside.filter(function (c) { return accessed.indexOf(c) < 0; }).length;
          if (left && CheckClicks(runner, 1)) {
            DecisionPhase(runner, [{ more: true, label: "Gastar 1 clique e acessar outra", button: "Gastar 1 clique e acessar outra" }, JKR2Skip("Terminar")], function (q) {
              if (q.more) { SpendClicks(runner, 1); pick(false); } else finish();
            }, "Deep Dive", "Acessar mais uma carta?");
          } else finish();
        });
      }, "Deep Dive", "Escolha 1 das cartas separadas para acessar");
    };
    pick(true);
  },
};

cardSet[35025] = {
  title: "Illumination",
  imageFile: "35025.png",
  cardText: "Run R&D. If successful, install up to 3 cards from your grip (one at a time), paying 1[c] less for each.",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 0,
  illumRun: false,
  illumDiscount: false,
  Enumerate: function () { return [{}]; },
  Resolve: function () { this.illumRun = true; MakeRun(corp.RnD); },
  modifyInstallCost: {
    Resolve: function (card) { return this.illumDiscount && card && card.player == runner ? -1 : 0; },
    availableWhenInactive: true,
  },
  responseOnRunSuccessful: {
    Enumerate: function () { return this.illumRun && attackedServer == corp.RnD ? [{}] : []; },
    Resolve: function () {
      var self = this;
      this.illumRun = false;
      this.illumDiscount = true;
      JKR2Loop("Illumination", function (st) {
        var opts = st.k < 3 ? ChoicesHandInstall(runner) : [];
        if (!opts.length) { st.done = true; self.illumDiscount = false; return; }
        opts.forEach(function (o) { o.label = "Instalar " + o.card.title + (o.host ? " em " + o.host.title : "") + " (1¢ a menos)"; });
        opts = JKR2Dedupe(opts);
        opts.push(JKR2Skip("Parar de instalar"));
        DecisionPhase(runner, opts, function (p) {
          if (p.skip) { st.done = true; self.illumDiscount = false; return; }
          st.k++;
          if (st.k >= 3) st.done = true;
          Install(p.card, p.host, false, null, true, function () { if (st.done) self.illumDiscount = false; }, self, function () { st.done = true; self.illumDiscount = false; });
        }, "Illumination", "Instale até " + (3 - st.k) + " carta(s) da mão, pagando 1¢ a menos");
      }, this);
    },
    text: "Illumination: instalar até 3 cartas da mão",
  },
  responseOnRunEnds: {
    Resolve: function () { this.illumRun = false; this.illumDiscount = false; },
    automatic: true,
    availableWhenInactive: true,
  },
};

cardSet[33013] = {
  title: "Pinhole Threading",
  imageFile: "33013.png",
  cardText: "Run any server. If successful, instead of breaching the attacked server, access 1 card in the root of another server. If that card is an agenda, you cannot steal or trash it during this access.",
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 1,
  pinOk: false,
  pinRun: false,
  Enumerate: function () { return ChoicesExistingServers(); },
  Resolve: function (params) { this.pinOk = false; this.pinRun = true; MakeRun(params.server); },
  responseOnRunSuccessful: {
    Resolve: function () { if (this.pinRun) this.pinOk = true; },
    automatic: true,
  },
  specialOnInsteadOfBreaching: {
    Enumerate: function () {
      if (!this.pinOk) return [];
      var choices = [];
      var servers = [corp.HQ, corp.RnD, corp.archives].concat(corp.remoteServers);
      servers.forEach(function (s) {
        if (s === attackedServer) return;
        // (sem a propriedade "card": com ela o motor esperaria um clique na carta da mesa original)
        s.root.forEach(function (c) { choices.push({ pinCard: c, required: true, label: "Acessar carta na raiz de " + ServerName(s) }); });
      });
      return choices;
    },
    Resolve: function (params) {
      this.pinOk = false; this.pinRun = false;
      JKR2Access(params.pinCard, { noStealTrash: CheckCardType(params.pinCard, ["agenda"]) });
    },
  },
  // (sem limpar no fim da run: o motor só pede a troca do breach depois de entrar na fase de fim da run)
};

cardSet[35026] = {
  title: "Ritual",
  imageFile: "35026.png",
  cardText: "Draw 1 card for each [click] you have remaining.",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "event",
  playCost: 0,
  Resolve: function () { if (runner.clickTracker > 0) Draw(runner, runner.clickTracker); },
};

cardSet[26022] = {
  title: "Spec Work",
  imageFile: "26022.png",
  cardText: "As an additional cost to play this event, trash 1 installed program. Gain 4[c] and draw 2 cards.",
  player: runner,
  faction: "Shaper",
  influence: 1,
  cardType: "event",
  subTypes: ["Job"],
  playCost: 1,
  Enumerate: function () {
    return ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]); }).map(function (o) {
      o.label = "Lixar " + o.card.title + " (custo adicional)";
      return o;
    });
  },
  Resolve: function (params) {
    Trash(params.card, false, function () { GainCredits(runner, 4); Draw(runner, 2); });
  },
};

// ------------------------------------------------------------ HARDWARE
cardSet[34023] = {
  title: "LilyPAD",
  imageFile: "34023.png",
  cardText: "+2[mu] The first time each turn you install a program, you may draw 1 card. Limit 1 console per player.",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 4,
  memoryUnits: 2,
  lilyUsedTurn: -1,
  responseOnInstall: {
    Enumerate: function (card) {
      if (!card || card === this || card.player != runner || !CheckCardType(card, ["program"])) return [];
      if (this.lilyUsedTurn == JKR2.turn) return [];
      return [{ draw: true, label: "Comprar 1 carta", button: "Comprar 1 carta" }, JKR2Skip("Não comprar")];
    },
    Resolve: function (params) {
      this.lilyUsedTurn = JKR2.turn;
      if (params.draw) Draw(runner, 1);
    },
    text: "LilyPAD: comprar 1 carta?",
  },
};

cardSet[26085] = {
  title: "Simulchip",
  imageFile: "26085.png",
  cardText: "As an additional cost to use this hardware, trash 1 installed program. Ignore this cost if an installed program has already been trashed this turn. [trash]: Install 1 program from your heap, paying 3[c] less.",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 1,
  abilities: [
    {
      text: "Instalar 1 programa do heap pagando 3¢ a menos (lixa o Simulchip).",
      Enumerate: function () {
        var free = JKR2.progTrashedTurn == JKR2.turn;
        if (!free && !runner.rig.programs.length) return [];
        var choices = [];
        JKR2Programs(runner.heap).forEach(function (p) {
          var cost = Math.max(0, InstallCost(p) - 3);
          if (!CheckCredits(runner, cost, "installing", p)) return;
          ChoicesCardInstall(p, true).forEach(function (o) {
            o.cost = cost;
            o.label = "Instalar " + p.title + " do heap" + (o.host ? " em " + o.host.title : "") + " (" + cost + "¢)";
            choices.push(o);
          });
        });
        return choices;
      },
      Resolve: function (params) {
        var self = this;
        var go = function () {
          Trash(self, false, function () {
            SpendCredits(runner, params.cost, "installing", params.card, function () {
              Install(params.card, params.host, true, null, true);
            });
          });
        };
        if (JKR2.progTrashedTurn == JKR2.turn) { go(); return; }
        var progs = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]); }).map(function (o) {
          o.label = "Lixar " + o.card.title + " (custo adicional do Simulchip)";
          return o;
        });
        DecisionPhase(runner, progs, function (p) { Trash(p.card, false, go); }, "Simulchip", "Escolha o programa instalado para lixar");
      },
    },
  ],
};

// ------------------------------------------------------------ RECURSOS
cardSet[35033] = {
  title: "“Knickknack” O’Brian",
  imageFile: "35033.png",
  cardText: "The first time each turn a run begins, you may trash 1 of your other installed cards. If you do, gain credits equal to its printed install cost and draw 1 card.",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 2,
  unique: true,
  kkTurn: -1,
  kkReady: false,
  // a janela abre quando a run começa e fecha no primeiro encontro (ou no fim da run)
  automaticOnRunBegins: {
    Resolve: function () {
      if (this.kkTurn == JKR2.turn) return;
      this.kkTurn = JKR2.turn;
      this.kkReady = true;
    },
  },
  automaticOnEncounter: { Resolve: function () { this.kkReady = false; } },
  responseOnRunEnds: { Resolve: function () { this.kkReady = false; }, automatic: true },
  abilities: [
    {
      text: "Lixar outra carta instalada sua: ganhar o custo impresso dela e comprar 1.",
      Enumerate: function () {
        if (!this.kkReady) return [];
        var self = this;
        return ChoicesInstalledCards(runner, function (c) { return c !== self; }).map(function (o) {
          var cost = (o.card.cardDefinition && o.card.cardDefinition.installCost) || 0;
          o.label = "Lixar " + o.card.title + ": ganhar " + cost + "¢ e comprar 1";
          return o;
        });
      },
      Resolve: function (params) {
        this.kkReady = false;
        var cost = (params.card.cardDefinition && params.card.cardDefinition.installCost) || 0;
        Trash(params.card, false, function () { GainCredits(runner, cost); Draw(runner, 1); });
      },
    },
  ],
};

cardSet[33029] = {
  title: "Environmental Testing",
  imageFile: "33029.png",
  cardText: "Whenever you install a program or piece of hardware, place 1 power counter on this resource. When there are 4 or more hosted power counters, trash this resource and gain 9[c].",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "resource",
  installCost: 3,
  automaticOnInstall: {
    Resolve: function (card) {
      if (!card || card === this || !CheckInstalled(this)) return;
      if (card.player != runner || !CheckCardType(card, ["program", "hardware"])) return;
      AddCounters(this, "power", 1);
      if (Counters(this, "power") >= 4) {
        Log("Environmental Testing chegou a 4 marcadores: lixada, Runner ganha 9¢");
        Trash(this, false, function () { GainCredits(runner, 9); });
      }
    },
  },
};

cardSet[34008] = {
  title: "Hannah \"Wheels\" Pilintra",
  imageFile: "34008.png",
  cardText: "Once per turn → [click]: Gain [click]. Run a remote server. When that run ends, if it was unsuccessful, take 1 tag. [click], [trash]: Gain [click][click]. Remove 1 tag.",
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 2,
  unique: true,
  hannahTurn: -1,
  hannahRun: false,
  hannahOk: false,
  abilities: [
    {
      text: "Ganhar 1 clique e fazer run num servidor remoto.",
      Enumerate: function () {
        if (this.hannahTurn == JKR2.turn) return [];
        if (!CheckActionClicks(runner, 1)) return [];
        return corp.remoteServers.map(function (s) { return { server: s, label: "Ganhar 1 clique e fazer run em " + ServerName(s) }; });
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        this.hannahTurn = JKR2.turn;
        GainClicks(runner, 1);
        this.hannahRun = true;
        this.hannahOk = false;
        MakeRun(params.server);
      },
    },
    {
      text: "Lixar Hannah: ganhar 2 cliques e remover 1 tag.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function () {
        SpendClicks(runner, 1);
        Trash(this, false, function () {
          GainClicks(runner, 2);
          if (runner.tags > 0) RemoveTags(1);
        });
      },
    },
  ],
  responseOnRunSuccessful: {
    Resolve: function () { if (this.hannahRun) this.hannahOk = true; },
    automatic: true,
  },
  responseOnRunEnds: {
    Enumerate: function () { return this.hannahRun && !this.hannahOk ? [{}] : []; },
    Resolve: function () { this.hannahRun = false; AddTags(1); },
    text: "Hannah: a run não teve sucesso, receber 1 tag",
  },
};

// ------------------------------------------------------------ PROGRAMAS
cardSet[26024] = JackInBreaker({
  title: "Gauss",
  imageFile: "26024.png",
  cardText: "When you install this program, it gets +3 strength for the remainder of the turn. Interface → 1[c]: Break 1 barrier subroutine. 2[c]: +2 strength.",
  faction: "Shaper",
  influence: 2,
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 2,
  strength: 1,
  gaussTurn: -1,
  JackInStrengthMod: function () { return this.gaussTurn == JKR2.turn ? 3 : 0; },
  automaticOnInstall: {
    Resolve: function (card) { if (card === this) this.gaussTurn = JKR2.turn; },
  },
});
cardSet[26024].abilities = [
  JackInBreakAbility("Barrier", 1),
  JackInBoostAbility("Barrier", 2, 2),
];

cardSet[33027] = JackInBreaker({
  title: "Propeller",
  imageFile: "33027.png",
  cardText: "When you install this program, place 4 power counters on it. Interface → 1[c]: Break 1 barrier subroutine. Hosted power counter: +2 strength.",
  faction: "Shaper",
  influence: 2,
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 1,
  strength: 0,
  automaticOnInstall: {
    Resolve: function (card) { if (card === this) AddCounters(this, "power", 4); },
  },
});
cardSet[33027].abilities = [
  JackInBreakAbility("Barrier", 1),
  {
    text: "Gastar 1 marcador de poder: +2 de força.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (CheckStrength(this)) return [];
      if (!CheckUnbrokenSubroutines()) return [];
      if (!CheckSubType(attackedServer.ice[approachIce], "Barrier")) return [];
      if (!CheckCounters(this, "power", 1)) return [];
      return [{}];
    },
    Resolve: function () {
      RemoveCounters(this, "power", 1);
      BoostStrength(this, 2);
    },
  },
];

cardSet[35029] = {
  title: "Azimat",
  imageFile: "35029.png",
  cardText: "2[recurring-credit] You can spend hosted credits to pay trash costs.",
  player: runner,
  faction: "Shaper",
  influence: 1,
  cardType: "program",
  installCost: 1,
  memoryCost: 2,
  recurringCredits: 2,
  canUseCredits: function (doing, card) { return doing == "trashing" || doing == "paying trash costs"; },
};

cardSet[34089] = {
  title: "Coalescence",
  imageFile: "34089.png",
  cardText: "When you install this program, place 2 power counters on it. Hosted power counter: Gain 2[c]. Use this ability only during your turn.",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "program",
  installCost: 2,
  memoryCost: 1,
  automaticOnInstall: {
    Resolve: function (card) { if (card === this) AddCounters(this, "power", 2); },
  },
  abilities: [
    {
      text: "Gastar 1 marcador de poder: ganhar 2¢.",
      Enumerate: function () {
        if (playerTurn != runner) return [];
        if (!CheckCounters(this, "power", 1)) return [];
        return [{}];
      },
      Resolve: function () {
        RemoveCounters(this, "power", 1);
        GainCredits(runner, 2);
      },
    },
  ],
};

cardSet[34080] = {
  title: "Cupellation",
  imageFile: "34080.png",
  cardText: "Limit 1 hosted card. Access → 1[c]: Host the non-agenda card you are accessing faceup on this program. (If it was installed, it becomes uninstalled.) Whenever you breach HQ, if this program has a hosted Corp card, you may pay 1[c] and trash this program to access 2 additional cards.",
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "program",
  installCost: 1,
  memoryCost: 1,
  hostedCards: [],
  cupExtra: false,
  abilities: [
    {
      text: "Pagar 1¢: hospedar a carta acessada no Cupellation.",
      Enumerate: function () {
        if (!CheckAccessing()) return [];
        if (!accessingCard || accessingCard.player != corp || CheckCardType(accessingCard, ["agenda"])) return [];
        if (this.hostedCards && this.hostedCards.length) return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        return [{}];
      },
      Resolve: function () {
        var c = accessingCard;
        SpendCredits(runner, 1, "using", this, function () {
          if (!this.hostedCards) this.hostedCards = [];
          MoveCard(c, this.hostedCards);
          // fica hospedada virada para cima, mas fora do jogo da Corp (não instalada nem ativa)
          c.host = null;
          c.rezzed = false;
          c.faceUp = true;
          Log(c.title + " hospedada em Cupellation");
          ResolveAccess();
        }, this);
      },
    },
  ],
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (attackedServer != corp.HQ || !CheckInstalled(this)) return [];
      if (!this.hostedCards || !this.hostedCards.some(function (c) { return c.player == corp; })) return [];
      if (!CheckCredits(runner, 1, "using", this)) return [];
      return [{ use: true, label: "Pagar 1¢ e lixar Cupellation: acessar +2 cartas", button: "Pagar 1¢ e lixar: +2 acessos" }, JKR2Skip("Não usar")];
    },
    Resolve: function (params) {
      if (!params.use) return;
      var self = this;
      SpendCredits(runner, 1, "using", this, function () {
        self.cupExtra = true;
        Trash(self, false);
      });
    },
    text: "Cupellation: acessar 2 cartas a mais no HQ?",
  },
  modifyBreachAccess: {
    Resolve: function () { return this.cupExtra && attackedServer == corp.HQ ? 2 : 0; },
    availableWhenInactive: true,
  },
  responseOnRunEnds: {
    Resolve: function () { this.cupExtra = false; },
    automatic: true,
    availableWhenInactive: true,
  },
};

cardSet[35007] = {
  title: "Gourmand",
  imageFile: "35007.png",
  cardText: "Access → [trash]: Trash the non-agenda card you are accessing. If you do, draw 1 card.",
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "program",
  installCost: 0,
  memoryCost: 1,
  abilities: [
    {
      text: "Lixar o Gourmand: lixar a carta acessada e comprar 1.",
      Enumerate: function () {
        if (!CheckAccessing()) return [];
        if (!accessingCard || CheckCardType(accessingCard, ["agenda"])) return [];
        if (!CheckTrash(accessingCard)) return [];
        return [{}];
      },
      Resolve: function () {
        Trash(this, false, function () {
          TrashAccessedCard(true);
          Draw(runner, 1);
        });
      },
    },
  ],
};

cardSet[33071] = {
  title: "Hush",
  imageFile: "33071.png",
  cardText: "Install only on a piece of ice. Host ice cannot gain abilities and loses all abilities except its printed subroutines. [click]: Host this program on another installed piece of ice.",
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "program",
  subTypes: ["Trojan"],
  installCost: 1,
  memoryCost: 1,
  installOnlyOn: function (card) { return CheckCardType(card, ["ice"]); },
  modifyHasAbilities: {
    Resolve: function (card) { return !(this.host && card === this.host); },
  },
  abilities: [
    {
      text: "Mover o Hush para outra ice.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        var self = this;
        return ChoicesInstalledCards(corp, function (c) { return CheckCardType(c, ["ice"]) && c !== self.host; }).map(function (o) {
          o.label = "Mover Hush para " + JKR2IceName(o.card);
          return o;
        });
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        if (!params.card.hostedCards) params.card.hostedCards = [];
        MoveCard(this, params.card.hostedCards);
        this.host = params.card;
        Log("Hush agora está hospedado em outra ice");
      },
    },
  ],
};

cardSet[34091] = {
  title: "Muse",
  imageFile: "34091.png",
  cardText: "When you install this program, search your stack, heap, or grip for 1 non-daemon program. (Shuffle your stack after searching it.) If that program is a trojan, install it on a piece of ice. Otherwise, install it on this program.",
  player: runner,
  faction: "Shaper",
  influence: 4,
  cardType: "program",
  subTypes: ["Daemon"],
  installCost: 2,
  memoryCost: 1,
  hostedCards: [],
  museTarget: null,
  canHost: function (card) { return card === this.museTarget; },
  responseOnInstall: {
    Enumerate: function (card) {
      if (card !== this) return [];
      var self = this, choices = [];
      var places = [["stack", runner.stack, "do baralho"], ["heap", runner.heap, "do heap"], ["grip", runner.grip, "da mão"]];
      places.forEach(function (pl) {
        JKR2Programs(pl[1], function (c) { return !CheckSubType(c, "Daemon"); }).forEach(function (p) {
          if (CheckSubType(p, "Trojan")) {
            ChoicesCardInstall(p).forEach(function (o) {
              if (!o.host) return;
              o.from = pl[0];
              o.label = "Instalar " + p.title + " " + pl[2] + " em " + JKR2IceName(o.host);
              choices.push(o);
            });
          } else if (CheckCredits(runner, InstallCost(p), "installing", p)) {
            choices.push({ card: p, host: self, from: pl[0], label: "Instalar " + p.title + " " + pl[2] + " no Muse" });
          }
        });
      });
      choices = JKR2Dedupe(choices);
      choices.push(JKR2Skip("Não instalar nada"));
      return choices;
    },
    Resolve: function (params) {
      Shuffle(runner.stack);
      Log("Runner embaralhou o baralho (Muse)");
      if (params.skip || !params.card) return;
      if (params.host === this) this.museTarget = params.card;
      var self = this;
      Install(params.card, params.host, false, null, true, function () { self.museTarget = null; }, this, function () { self.museTarget = null; });
    },
    text: "Muse: procurar 1 programa para instalar",
  },
};

cardSet[26025] = {
  title: "Pelangi",
  imageFile: "26025.png",
  cardText: "When you install this program, place 2 virus counters on it. Once per turn → Hosted virus counter: Choose an ice subtype. The ice you are encountering gains that subtype for the remainder of this encounter.",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 1,
  memoryCost: 1,
  pelTurn: -1,
  pelIce: null,
  pelType: "",
  automaticOnInstall: {
    Resolve: function (card) { if (card === this) AddCounters(this, "virus", 2); },
  },
  modifySubTypes: {
    Resolve: function (card) { return this.pelIce && card === this.pelIce ? { add: [this.pelType] } : {}; },
  },
  responseOnEncounterEnds: {
    Resolve: function () { this.pelIce = null; this.pelType = ""; },
    automatic: true,
  },
  abilities: [
    {
      text: "Gastar 1 marcador de vírus: a ice ganha um subtipo neste encontro.",
      Enumerate: function () {
        if (this.pelTurn == JKR2.turn) return [];
        if (!CheckEncounter()) return [];
        if (!CheckCounters(this, "virus", 1)) return [];
        return ["Barrier", "Code Gate", "Sentry"].map(function (t) { return { st: t, label: "A ice ganha o subtipo " + t }; });
      },
      Resolve: function (params) {
        RemoveCounters(this, "virus", 1);
        this.pelTurn = JKR2.turn;
        this.pelIce = attackedServer.ice[approachIce];
        this.pelType = params.st;
        Log("Pelangi: a ice ganhou o subtipo " + params.st + " até o fim do encontro");
      },
    },
  ],
};

cardSet[34025] = {
  title: "Pichação",
  imageFile: "34025.png",
  cardText: "Install only on a piece of ice. Whenever you pass host ice, you may gain [click]. If this is not the first time you gained [click] during a run this turn, add this program to your grip.",
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "program",
  subTypes: ["Trojan"],
  installCost: 1,
  memoryCost: 1,
  picPassed: null,
  installOnlyOn: function (card) { return CheckCardType(card, ["ice"]); },
  responseOnPassesIce: {
    Enumerate: function () {
      var ice = GetApproachEncounterIce();
      if (!ice || ice !== this.host) return [];
      // o motor pode avisar mais de uma vez a mesma passagem
      var key = JKR2.turn + "|" + approachIce;
      if (this.picPassed === key) return [];
      return [{ gain: true, label: "Ganhar 1 clique", button: "Ganhar 1 clique" }, JKR2Skip("Não ganhar")];
    },
    Resolve: function (params) {
      this.picPassed = JKR2.turn + "|" + approachIce;
      if (!params.gain) return;
      GainClicks(runner, 1);
      JKR2.runClickGains++;
      if (JKR2.runClickGains > 1) {
        Log("Pichação volta para a mão (não foi o primeiro clique ganho numa run neste turno)");
        MoveCard(this, runner.grip);
      }
    },
    text: "Pichação: ganhar 1 clique?",
  },
};

cardSet[26090] = {
  title: "Self-modifying Code",
  imageFile: "26090.png",
  cardText: "2[c], [trash]: Search your stack for 1 program. Install it. (Shuffle your stack after searching it.)",
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "program",
  installCost: 0,
  memoryCost: 2,
  abilities: [
    {
      text: "Pagar 2¢ e lixar: procurar 1 programa no baralho e instalar.",
      Enumerate: function () {
        if (!CheckCredits(runner, 2, "using", this)) return [];
        return [{}];
      },
      Resolve: function () {
        var self = this;
        SpendCredits(runner, 2, "using", this, function () {
          Trash(self, false, function () {
            var opts = [];
            JKR2Programs(runner.stack).forEach(function (p) {
              ChoicesCardInstall(p).forEach(function (o) {
                o.label = "Instalar " + p.title + (o.host ? " em " + (CheckCardType(o.host, ["ice"]) ? JKR2IceName(o.host) : o.host.title) : "");
                opts.push(o);
              });
            });
            opts = JKR2Dedupe(opts);
            opts.push(JKR2Skip("Não instalar nada"));
            DecisionPhase(runner, opts, function (p) {
              Shuffle(runner.stack);
              Log("Runner embaralhou o baralho (Self-modifying Code)");
              if (!p.skip && p.card) Install(p.card, p.host, false, null, true);
            }, "Self-modifying Code", "Escolha o programa do baralho para instalar");
          });
        }, this);
      },
    },
  ],
};

// a IA de Runner não sabe jogar estas cartas
[35024, 34085, 33022, 35025, 33013, 35026, 26022, 34023, 26085, 35033, 33029, 34008, 26024, 33027, 35029, 34089, 34080, 35007, 33071, 34091, 26025, 34025, 26090].forEach(function (id) {
  if (cardSet[id]) cardSet[id].jkNoAI = true;
});
