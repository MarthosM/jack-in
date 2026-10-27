// =====================================================================
// Jack In — Treino: cartas do deck LEO Construction: Labor Solutions (HB)
// Regras + dicas para a IA de Corp e para a IA de Runner. Códigos = NetrunnerDB.
// Licença: GPL-3.0 (derivado do Chiriboga). Requer sets/jackin_corp.js .. jackin_corp4.js.
// =====================================================================

JKC.tyrExtraClicks = 0;   // Týr: cliques extras da Corp no próximo turno
JKC.merciaAsked = false;  // Mercia B4LL4RD: já perguntou neste turno

// ------------------------------------------------------------ utilidades
function JKCIsBioroid(c) { return !!c && CheckSubType(c, "Bioroid"); }
function JKCCardsOfServer(server) {
  if (!server) return [];
  return (server.ice || []).concat(server.root || []);
}
// custo de instalação sem erro para gelo em servidor novo
function JKCInstallCost(card, server) {
  if (card.cardType == "ice" && !server) return 0;
  return InstallCost(card, server);
}
function JKCRunnerCostly(a, b) { return (b.installCost || 0) - (a.installCost || 0); }
// o servidor atacado tem algo que vale proteger (IA)
function JKCServerWorthProtecting(server) {
  if (!server) return false;
  if (server === corp.HQ) return corp.HQ.cards.some(function (c) { return c.cardType == "agenda"; });
  if (server === corp.RnD) { var t = corp.RnD.cards[corp.RnD.cards.length - 1]; return !!t && t.cardType == "agenda"; }
  if (server === corp.archives) return corp.archives.cards.some(function (c) { return c.cardType == "agenda"; });
  return server.root.some(function (c) { return c.cardType == "agenda" || (c.cardType == "asset" && !c.rezzed) || (c.rezzed && (c.rezCost || 0) >= 2); });
}
// quantas cartas o Runner teria "à mão" depois da subrotina (IA de Runner, Ansel/Bumi/Týr)
function JKCRunnerProgramsInstalled() {
  return ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]); }).length;
}
// "Você pode instalar 1 carta de HQ ou Archives" (Ansel 2.0: pagando; Drafter: ignorando custos)
function JKCMayInstallFromHQorArchives(title, ignoreCosts, ctx) {
  var handOptions = ChoicesArrayInstall(corp.HQ.cards, true);
  var archOptions = ChoicesArrayInstall(corp.archives.cards, true);
  if (!ignoreCosts) {
    var afford = function (o) { return CheckCredits(corp, JKCInstallCost(o.card, o.server), "installing", o.card); };
    handOptions = handOptions.filter(afford);
    archOptions = archOptions.filter(afford);
  }
  var choicesA = [];
  var hc = { id: 0, label: "Instalar do HQ", button: "Instalar do HQ" };
  var ac = { id: 1, label: "Instalar de Archives", button: "Instalar de Archives" };
  if (handOptions.length) choicesA.push(hc);
  if (archOptions.length) choicesA.push(ac);
  var skip = { id: 2, label: "Não instalar", button: "Não instalar" };
  choicesA.push(skip);
  if (choicesA.length == 1) return;
  DecisionPhase(corp, choicesA, function (p) {
    if (p.id > 1) return;
    var opts = p.id == 1 ? archOptions : handOptions;
    if (corp.AI != null) {
      var pick = JKCAIInstallPick(opts.map(function (o) { return o.card; }).filter(function (c, i, a) { return a.indexOf(c) == i; }));
      var opt = pick ? (opts.find(function (o) { return o.card == pick.card && o.server === pick.server; }) || opts.find(function (o) { return o.card == pick.card; })) : null;
      if (!opt) return;
      Install(opt.card, opt.server, ignoreCosts, null, true);
      return;
    }
    DecisionPhase(corp, opts, function (q) { if (q.card) Install(q.card, q.server, ignoreCosts, null, true); }, title, "Install", ctx, "install");
  }, title, title, ctx);
  if (corp.AI != null) {
    var choice = skip;
    var cands = archOptions.length ? archOptions : handOptions;
    var hasIce = cands.some(function (o) { return o.card.cardType == "ice"; });
    var hasAsset = cands.some(function (o) { return o.card.cardType == "asset" || o.card.cardType == "upgrade"; });
    if (ignoreCosts || hasIce || hasAsset) choice = archOptions.length ? ac : (handOptions.length ? hc : skip);
    // de HQ, pagando: só se sobrar dinheiro
    if (choice === hc && !ignoreCosts && Credits(corp) < 6) choice = skip;
    corp.AI.preferred = { title: title, option: choice };
  }
}
// Executa passos em sequência numa fase própria: cada passo pode chamar Install/Draw/Rez
// (que voltam para esta fase ao terminar) ou abrir uma DecisionPhase; quando acabam, volta à fase anterior.
function JKCRunSteps(title, steps, ctx) {
  var back = currentPhase;
  var i = 0;
  var P = {
    identifier: back.identifier, title: title, player: corp, requireHumanInput: false, next: back, context: ctx,
    Enumerate: { n: function () { return [{}]; } },
    Resolve: { n: function () {
      // Corp humana com cartas físicas: espera identificar as cartas compradas antes do próximo passo
      if (typeof Physical != "undefined" && Physical.enabled && (Physical.pending.length || $("#physical-modal").is(":visible"))) {
        setTimeout(function () { if (currentPhase === P) Main(); }, 400);
        return;
      }
      if (i >= steps.length) { ChangePhase(back, true); return; }
      var step = steps[i++];
      try { step.call(ctx); } catch (e) { LogError(e); }
    } },
  };
  ChangePhase(P, true);
}
// cliques extras no começo do turno da Corp (Týr)
(function () {
  var _RC = ResetClicks;
  ResetClicks = function (player) {
    var r = _RC.apply(this, arguments);
    if (player == corp && JKC.tyrExtraClicks > 0) {
      corp.clickTracker += JKC.tyrExtraClicks;
      Log("Týr: a Corp tem " + JKC.tyrExtraClicks + " clique(s) a mais neste turno");
      JKC.tyrExtraClicks = 0;
    }
    return r;
  };
  // custo adicional para roubar (Méliès City Luxury Line)
  var _Steal = Steal;
  Steal = function () {
    var c = accessingCard;
    if (c && typeof c.JackInStealCost == "function" && !c.JKCStealPaid) {
      var args = arguments, self = this;
      c.JackInStealCost(function () {
        c.JKCStealPaid = true;
        _Steal.apply(self, args);
        c.JKCStealPaid = false;
      });
      return;
    }
    return _Steal.apply(this, arguments);
  };
  // "Remote server only": tira os servidores centrais das opções de instalação
  var _CCI = ChoicesCardInstall;
  ChoicesCardInstall = function (card) {
    var ret = _CCI.apply(this, arguments);
    if (card && card.jkRemoteOnly) ret = ret.filter(function (o) { return o.server !== corp.HQ && o.server !== corp.RnD && o.server !== corp.archives; });
    return ret;
  };
  // Mercia B4LL4RD: "quando a sua fase de ação termina"
  var _CP = ChangePhase;
  ChangePhase = function (phase) {
    if (phase && (phase.identifier == "Corp 1.1" || phase.identifier == "Runner 1.1")) JKC.merciaAsked = false;
    if (phase === phases.corpDiscardStart && !JKC.merciaAsked && playerTurn == corp) {
      JKC.merciaAsked = true;
      var mercias = InstalledCards(corp).filter(function (c) { return c.title == "Mercia B4LL4RD" && c.rezzed; });
      var ice = corp.HQ.cards.filter(function (c) { return c.cardType == "ice"; });
      if (mercias.length && ice.length) {
        var r = _CP.apply(this, arguments);
        JKCMerciaInstall(mercias[0], ice);
        return r;
      }
    }
    return _CP.apply(this, arguments);
  };
})();

function JKCMerciaInstall(mercia, ice) {
  var opts = ChoicesArrayInstall(ice, true).filter(function (o) {
    return CheckCredits(corp, Math.max(0, JKCInstallCost(o.card, o.server) - 1), "installing", o.card);
  });
  if (!opts.length) return;
  var choices = opts.slice();
  choices.push({ skip: true, label: "Não instalar", button: "Não instalar" });
  DecisionPhase(corp, choices, function (p) {
    if (p.skip) return;
    var cost = Math.max(0, JKCInstallCost(p.card, p.server) - 1);
    var doInstall = function () {
      JKCRunSteps("Mercia B4LL4RD", [
        function () { Install(p.card, p.server, true, null, true); },
        function () {
          var s = GetServer(p.card);
          if (s && s.root && CheckInstalled(mercia) && mercia.cardLocation !== s.root) {
            MoveCard(mercia, s.root);
            Log("Mercia B4LL4RD foi para a raiz de " + s.serverName);
          }
        },
      ], mercia);
    };
    if (cost > 0) SpendCredits(corp, cost, "installing", p.card, doInstall, mercia);
    else doInstall();
  }, "Mercia B4LL4RD", "Mercia: instalar 1 gelo do HQ pagando 1 a menos", mercia, "install");
  if (corp.AI != null) {
    var protect = null;
    try { protect = corp.AI._serverToProtect(); } catch (e) {}
    var pick = null;
    if (protect) {
      var forServer = opts.filter(function (o) { return o.server === protect; });
      pick = forServer.slice().sort(function (a, b) { return (b.card.rezCost || 0) - (a.card.rezCost || 0); })[0] || null;
    }
    if (!pick && Credits(corp) >= 6) {
      // nenhum servidor pedindo: protege HQ ou R&D que estiver mais fraco
      var weak = corp.HQ.ice.length <= corp.RnD.ice.length ? corp.HQ : corp.RnD;
      pick = opts.find(function (o) { return o.server === weak; }) || null;
    }
    corp.AI.preferred = { title: "Mercia B4LL4RD", option: pick || choices[choices.length - 1] };
  }
}

// ============================================================ IDENTIDADE
cardSet[35035] = {
  title: "LEO Construction: Labor Solutions",
  imageFile: "35035.png",
  cardText: "Once per turn → Trash 1 rezzed bioroid card in the root of or protecting the attacked server: End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  cardType: "identity",
  subTypes: ["Division"],
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  JKCTargets: function () {
    if (!CheckRunning() || !attackedServer) return [];
    return JKCCardsOfServer(attackedServer).filter(function (c) { return c.rezzed && JKCIsBioroid(c) && CheckTrash(c); });
  },
  abilities: [
    {
      text: "Trash 1 bioroide ativado deste servidor: encerrar a run",
      Enumerate: function () {
        if (this.usedThisTurn) return [];
        var targets = this.JKCTargets();
        if (!targets.length) return [];
        if (corp.AI != null) {
          // IA: só quando o Runner já passou por todo o gelo e vai acessar algo que vale proteger
          if (approachIce >= 0 || encountering) return [];
          if (!JKCServerWorthProtecting(attackedServer)) return [];
          var cheapest = targets.slice().sort(function (a, b) { return (a.rezCost || 0) - (b.rezCost || 0); })[0];
          // não lixa gelo caro por pouca coisa
          if ((cheapest.rezCost || 0) > 6 && attackedServer !== corp.HQ && attackedServer !== corp.RnD &&
              !attackedServer.root.some(function (c) { return c.cardType == "agenda"; })) return [];
          return [{ card: cheapest, label: "LEO: trash " + cheapest.title }];
        }
        return ChoicesArrayCards(targets).map(function (o) { o.label = "LEO: trash " + o.card.title + " para encerrar a run"; return o; });
      },
      Resolve: function (params) {
        this.usedThisTurn = true;
        Log("LEO Construction: trash em " + GetTitle(params.card, true) + " para encerrar a run");
        JKC.corpTrashing = true;
        Trash(params.card, false, function () { JKC.corpTrashing = false; EndTheRun(); }, this);
      },
    },
  ],
};

// ============================================================ AGENDAS
cardSet[26032] = {
  title: "Architect Deployment Test",
  imageFile: "26032.png",
  cardText: "When you score this agenda, look at the top 5 cards of R&D. You may install and rez 1 of those cards, ignoring all costs.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 4,
  responseOnScored: {
    Enumerate: function () { return intended.score == this && corp.RnD.cards.length > 0 ? [{}] : []; },
    Resolve: function () {
      var self = this;
      var n = Math.min(5, corp.RnD.cards.length);
      var choose = function () {
        var top = JKCTopOfRnD(n);
        Log("Architect Deployment Test: olhou " + n + " carta(s) do topo do R&D");
        var installable = top.filter(function (c) { return CheckInstall(c) && c.cardType != "agenda"; });
        var choices = ChoicesArrayInstall(installable, true);
        choices.push({ skip: true, label: "Não instalar", button: "Não instalar" });
        DecisionPhase(corp, choices, function (p) {
          if (p.skip) return;
          JKCRunSteps("Architect Deployment Test", [
            function () { Install(p.card, p.server, true, null, true); },
            function () { if (CheckInstalled(p.card) && !p.card.rezzed) Rez(p.card, true, null, null, false); },
          ], self);
        }, "Architect Deployment Test", "ADT: instalar e ativar 1 carta ignorando custos", self, "install");
        if (corp.AI != null) {
          var pick = null;
          var ice = installable.filter(function (c) { return c.cardType == "ice"; }).sort(function (a, b) { return (b.rezCost || 0) - (a.rezCost || 0); });
          var protect = null;
          try { protect = corp.AI._serverToProtect(); } catch (e) {}
          if (ice.length) {
            var server = protect || (corp.HQ.ice.length <= corp.RnD.ice.length ? corp.HQ : corp.RnD);
            pick = choices.find(function (o) { return o.card == ice[0] && o.server === server; });
          }
          if (!pick) {
            var other = installable.filter(function (c) { return c.cardType == "asset" || c.cardType == "upgrade"; }).sort(function (a, b) { return (b.rezCost || 0) - (a.rezCost || 0); })[0];
            if (other) {
              var p2 = JKCAIInstallPick([other]);
              if (p2) pick = choices.find(function (o) { return o.card == other && o.server === p2.server; }) || choices.find(function (o) { return o.card == other; });
            }
          }
          corp.AI.preferred = { title: "Architect Deployment Test", option: pick || choices[choices.length - 1] };
        }
      };
      if (JKCPhysicalTopOfRnD(n, "Architect Deployment Test")) {
        DecisionPhase(corp, [{ id: 0, label: "Olhar as " + n + " cartas do topo do R&D", button: "Olhar o topo do R&D" }], function () { choose(); }, "Architect Deployment Test", "Architect Deployment Test", self);
      } else choose();
    },
    text: "Architect Deployment Test: olhar 5 do R&D",
  },
};

cardSet[36026] = {
  title: "Méliès City Luxury Line",
  imageFile: "36026.png",
  cardText: "As an additional cost to steal this agenda, the Runner must spend [click]. When you score this agenda, gain [click].",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 3,
  advancementRequirement: 5,
  modifyCannot: {
    Resolve: function (str, card) {
      if (str == "steal" && card == this && runner.clickTracker < 1) return true;
      return false;
    },
    availableWhenInactive: true,
  },
  JackInStealCost: function (stealNow) {
    SpendClicks(runner, 1);
    Log("Méliès City Luxury Line: o Runner gastou 1 clique para roubar");
    stealNow();
  },
  responseOnScored: {
    Enumerate: function () { return intended.score == this ? [{}] : []; },
    Resolve: function () { GainClicks(corp, 1); Log("Méliès City Luxury Line: a Corp ganha 1 clique"); },
    text: "Méliès: ganhar 1 clique",
  },
};

// ============================================================== ATIVOS
cardSet[35039] = {
  title: "Humanoid Resources",
  imageFile: "35039.png",
  cardText: "[click][click][click], [trash]: Gain 4[c] and draw 3 cards. Install up to 2 cards from HQ (one at a time). You may play 1 operation from HQ.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "asset",
  rezCost: 1,
  trashCost: 1,
  JKCInstallStep: function () {
    var self = this;
    var opts = ChoicesHandInstall(corp).filter(function (o) {
      return CheckCredits(corp, JKCInstallCost(o.card, o.server), "installing", o.card);
    });
    if (!opts.length) return;
    if (corp.AI != null) {
      var pick = null;
      try {
        var ranked = corp.AI._rankedInstallOptions(corp.HQ.cards, false);
        for (var k = 0; k < ranked.length && !pick; k++) {
          var r = ranked[k];
          pick = opts.find(function (o) { return o.card == r.cardToInstall && o.server === r.serverToInstallTo; }) || null;
        }
      } catch (e) {}
      if (pick) Install(pick.card, pick.server, false, null, true);
      return;
    }
    var choices = opts.slice();
    choices.push({ skip: true, label: "Não instalar", button: "Não instalar" });
    DecisionPhase(corp, choices, function (p) {
      if (!p.skip) Install(p.card, p.server, false, null, true);
    }, "Humanoid Resources", "Humanoid Resources: instalar 1 carta do HQ", self, "install");
  },
  abilities: [
    {
      text: "[click][click][click], [trash]: ganhar 4, comprar 3, instalar até 2, jogar 1 operação",
      Enumerate: function () {
        if (!this.rezzed || !CheckActionClicks(corp, 3)) return [];
        return [{}];
      },
      Resolve: function () {
        var self = this;
        SpendClicks(corp, 3);
        JKC.corpTrashing = true;
        Trash(this, false, function () {
          JKC.corpTrashing = false;
          JKCRunSteps("Humanoid Resources", [
            function () { GainCredits(corp, 4); Draw(corp, 3); },
            function () { self.JKCInstallStep(); },
            function () { self.JKCInstallStep(); },
            function () { self.JKCPlayOp(); },
          ], self);
        }, this);
      },
    },
  ],
  AITriggerWhenCan: true,
  RezUsability: function () {
    return currentPhase.identifier.substring(0, 6) == "Corp 2" && CheckClicks(corp, 3) && corp.HQ.cards.length > 0;
  },
  AIWorthInstalling: function (emptyProtectedRemotes) {
    if (corp.AI._copyAlreadyInstalled(this)) return -1;
    for (var j = 0; j < emptyProtectedRemotes.length; j++) {
      if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
    }
    return emptyProtectedRemotes.length;
  },
};

// ============================================================ OPERAÇÕES
cardSet[36062] = {
  title: "Reanimation Protocol",
  imageFile: "36062.png",
  cardText: "Install and rez 1 piece of ice from Archives, paying a total of 10[c] less. If you rezzed a piece of non-liability ice this way, take 1 bad publicity.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "operation",
  subTypes: ["Liability"],
  playCost: 2,
  JKCOptions: function () {
    var ice = corp.archives.cards.filter(function (c) { return c.cardType == "ice"; });
    return ChoicesArrayInstall(ice, true).filter(function (o) {
      return CheckCredits(corp, Math.max(0, JKCInstallCost(o.card, o.server) + RezCost(o.card) - 10), "rezzing", o.card);
    });
  },
  Enumerate: function () {
    var opts = this.JKCOptions();
    if (!opts.length) return [];
    if (corp.AI != null && !corp.resolvingCards.includes(this)) {
      // IA: só vale a pena com gelo de rez alto (>= 5) em Archives
      var best = opts.filter(function (o) { return (o.card.rezCost || 0) >= 5; });
      if (!best.length) return [];
      var protect = null;
      try { protect = corp.AI._serverToProtect(); } catch (e) {}
      var pick = null;
      if (protect) pick = best.filter(function (o) { return o.server === protect; }).sort(function (a, b) { return (b.card.rezCost || 0) - (a.card.rezCost || 0); })[0];
      if (!pick) {
        var weak = corp.HQ.ice.length <= corp.RnD.ice.length ? corp.HQ : corp.RnD;
        pick = best.filter(function (o) { return o.server === weak; }).sort(function (a, b) { return (b.card.rezCost || 0) - (a.card.rezCost || 0); })[0];
      }
      return pick ? [pick] : [];
    }
    return opts;
  },
  Resolve: function (params) {
    var card = params.card, server = params.server;
    var cost = Math.max(0, JKCInstallCost(card, server) + RezCost(card) - 10);
    var liability = CheckSubType(card, "Liability");
    var self = this;
    var doIt = function () {
      JKCRunSteps("Reanimation Protocol", [
        function () { Install(card, server, true, null, true); },
        function () {
          if (!CheckInstalled(card) || card.rezzed) return;
          Rez(card, true, function () {
            Log("Reanimation Protocol: " + GetTitle(card, true) + " instalado e ativado");
            if (!liability) BadPublicity(1);
          }, self, false);
        },
      ], self);
    };
    if (cost > 0) SpendCredits(corp, cost, "rezzing", card, doIt, this);
    else doIt();
  },
  command: "install",
  AIWouldPlay: function () { return this.Enumerate().length > 0; },
};

cardSet[26104] = {
  title: "Scapenet",
  imageFile: "26104.png",
  cardText: "Play only if the Runner made a successful run during their last turn. Trace[7]. If successful, remove 1 installed chip or virtual card from the game.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "operation",
  subTypes: ["Gray Ops"],
  playCost: 1,
  JKCTargets: function () {
    return ChoicesInstalledCards(runner, function (c) { return CheckSubType(c, "Chip") || CheckSubType(c, "Virtual"); });
  },
  Enumerate: function () {
    if (!JKC.runnerSuccessThisTurn) return [];
    if (!this.JKCTargets().length) return [];
    if (corp.AI != null && !corp.resolvingCards.includes(this)) {
      // IA: só se houver alvo que valha a pena e dinheiro para vencer o trace
      var best = this.JKCTargets().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0];
      if ((best.card.installCost || 0) < 2) return [];
      var need = Link() + AvailableCredits(runner, "trace") - 7 + 1;
      if (need > 0 && Credits(corp) < need + 3) return [];
    }
    return [{}];
  },
  Resolve: function () {
    var self = this;
    Trace(7, function (successful) {
      if (!successful) return;
      var targets = self.JKCTargets();
      if (!targets.length) return;
      DecisionPhase(corp, targets, function (p) {
        RemoveFromGame(p.card);
      }, "Scapenet", "Scapenet: remover do jogo 1 chip ou carta virtual instalada", self, "trash");
      if (corp.AI != null) {
        var best = targets.slice().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0];
        corp.AI.preferred = { title: "Scapenet", option: best || targets[0] };
      }
    }, this);
    if (corp.AI != null) {
      var availableRunnerCred = AvailableCredits(runner, "trace");
      var availableCorpCred = AvailableCredits(corp, "trace");
      var maxIncrease = Link() + availableRunnerCred - traceStrength + 1;
      if (maxIncrease > availableCorpCred) maxIncrease = availableCorpCred;
      if (maxIncrease < 0) maxIncrease = 0;
      corp.AI.preferred = { strengthToIncrease: maxIncrease, command: "trace" };
    }
    if (runner.AI != null) {
      runner.AI.preferred = { IncreaseStrengthChoice: function (choices) {
        var availableRunnerCred = AvailableCredits(runner, "trace");
        var costForFullLink = traceStrength - Link();
        if (costForFullLink < 0) costForFullLink = 0;
        if (availableRunnerCred < costForFullLink) return 0;
        // protege a carta se ela for cara
        var best = self.JKCTargets().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0];
        if (best && (best.card.installCost || 0) >= 3 && costForFullLink < choices.length) return costForFullLink;
        return 0;
      }, command: "trace" };
    }
  },
  AIWouldPlay: function () { return this.Enumerate().length > 0; },
};

// ============================================================ MELHORIAS
cardSet[35045] = {
  title: "Mercia B4LL4RD",
  imageFile: "35045.png",
  cardText: "When your action phase ends, you may install 1 piece of ice from HQ, paying 1[c] less. If you do, move this upgrade to the root of the server that piece of ice is protecting.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "upgrade",
  subTypes: ["Academic", "Bioroid"],
  rezCost: 2,
  trashCost: 2,
  AIDefensiveValue: function () { return 1; },
  RezUsability: function () {
    return currentPhase.identifier.substring(0, 6) == "Corp 2" && corp.HQ.cards.some(function (c) { return c.cardType == "ice"; }) && Credits(corp) >= 4;
  },
};

cardSet[26105] = {
  title: "Tranquility Home Grid",
  imageFile: "26105.png",
  cardText: "Remote server only. The first time each turn you install a card in the root of this server, gain 2[c] or draw 1 card. Limit 1 region per server.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 1,
  trashCost: 4,
  jkRemoteOnly: true,
  AIIsScoringUpgrade: true,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true },
  responseOnInstall: {
    Enumerate: function (card) {
      if (!this.rezzed || this.usedThisTurn || !card || card == this || card.player != corp) return [];
      var s = GetServer(this);
      if (!s || !s.root || s.root.indexOf(card) < 0) return [];
      var gain = { id: 0, label: "Ganhar 2 créditos", button: "Ganhar 2 créditos" };
      var draw = { id: 1, label: "Comprar 1 carta", button: "Comprar 1 carta" };
      if (corp.AI != null) return [corp.HQ.cards.length < 3 && corp.RnD.cards.length > 0 ? draw : gain];
      return corp.RnD.cards.length > 0 ? [gain, draw] : [gain];
    },
    Resolve: function (params) {
      this.usedThisTurn = true;
      if (params.id == 1) Draw(corp, 1);
      else GainCredits(corp, 2);
    },
    text: "Tranquility Home Grid: 2 créditos ou 1 carta",
  },
  RezUsability: function () {
    return currentPhase.identifier.substring(0, 6) == "Corp 2" && CheckClicks(corp, 1) &&
      corp.HQ.cards.some(function (c) { return c.cardType == "agenda" || c.cardType == "asset"; });
  },
};

// ================================================================ GELOS
// Sleipnir (Code Gate 4/4)
cardSet[36030] = {
  title: "Sleipnir",
  imageFile: "36030.png",
  cardText: "[subroutine] You may draw 1 card. [subroutine] You may shuffle 1 card from HQ or Archives into R&D. [subroutine] End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 4,
  strength: 4,
  subroutines: [
    {
      text: "You may draw 1 card.",
      Resolve: function () {
        if (!corp.RnD.cards.length) return;
        var choices = [{ id: 0, label: "Comprar 1 carta", button: "Comprar 1 carta" }, { id: 1, label: "Não comprar", button: "Não comprar" }];
        DecisionPhase(corp, choices, function (p) { if (p.id == 0) Draw(corp, 1); }, "Sleipnir", "Sleipnir", this);
        if (corp.AI != null) corp.AI.preferred = { title: "Sleipnir", option: corp.HQ.cards.length < MaxHandSize(corp) ? choices[0] : choices[1] };
      },
    },
    {
      text: "You may shuffle 1 card from HQ or Archives into R&D.",
      Resolve: function () {
        var cards = corp.HQ.cards.concat(corp.archives.cards);
        if (!cards.length) return;
        var choices = ChoicesArrayCards(cards).map(function (o) {
          o.label = (o.card.cardLocation === corp.HQ.cards ? "HQ: " : "Archives: ") + o.card.title; return o;
        });
        choices.push({ skip: true, label: "Não embaralhar", button: "Não embaralhar" });
        DecisionPhase(corp, choices, function (p) {
          if (p.skip) return;
          Log("Sleipnir: " + (p.card.cardLocation === corp.HQ.cards ? "1 carta do HQ" : GetTitle(p.card, true) + " de Archives") + " embaralhada no R&D");
          ShuffleInto([p.card], corp.RnD.cards);
        }, "Sleipnir", "Sleipnir: embaralhar 1 carta no R&D", this);
        if (corp.AI != null) {
          // agenda em Archives primeiro; agenda do HQ se o Runner está indo ao HQ; senão nada
          var pick = choices.find(function (o) { return o.card && o.card.cardType == "agenda" && o.card.cardLocation === corp.archives.cards; });
          if (!pick && attackedServer === corp.HQ) pick = choices.find(function (o) { return o.card && o.card.cardType == "agenda" && o.card.cardLocation === corp.HQ.cards; });
          if (!pick) pick = choices.find(function (o) { return o.card && o.card.cardLocation === corp.archives.cards && (o.card.title == "Hedge Fund" || o.card.title == "Seamless Launch"); });
          corp.AI.preferred = { title: "Sleipnir", option: pick || choices[choices.length - 1] };
        }
      },
    },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
  ],
  AIImplementIce: function (rc, result) {
    result.sr = [[[]], [[]], [["endTheRun"]]];
    return result;
  },
};

// M.I.C. (Code Gate 6/4)
cardSet[34036] = {
  title: "M.I.C.",
  imageFile: "34036.png",
  cardText: "[trash]: End the run unless the Runner spends [click]. Use this ability only during a run on this server. [subroutine] The Runner loses [click]. [subroutine] The Runner loses [click]. [subroutine] End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 6,
  strength: 4,
  abilities: [
    {
      text: "[trash]: encerrar a run, a menos que o Runner gaste 1 clique",
      Enumerate: function () {
        if (!this.rezzed || !CheckRunning() || !attackedServer || GetServer(this) !== attackedServer) return [];
        if (corp.AI != null) {
          // IA: só quando o Runner não tem clique para pagar e vai acessar algo que vale proteger
          if (runner.clickTracker > 0) return [];
          if (approachIce >= 0 || encountering) return [];
          if (!JKCServerWorthProtecting(attackedServer)) return [];
        }
        return [{}];
      },
      Resolve: function () {
        var self = this;
        JKC.corpTrashing = true;
        Trash(this, false, function () {
          JKC.corpTrashing = false;
          var choices = [];
          if (CheckClicks(runner, 1)) choices.push({ id: 0, label: "Gastar 1 clique", button: "Gastar 1 clique" });
          choices.push({ id: 1, label: "A run termina", button: "A run termina" });
          DecisionPhase(runner, choices, function (p) {
            if (p.id == 0) { SpendClicks(runner, 1); Log("M.I.C.: o Runner gastou 1 clique"); }
            else EndTheRun();
          }, "M.I.C.", "M.I.C.: gastar 1 clique ou a run termina", self);
          if (runner.AI != null) runner.AI.preferred = { title: "M.I.C.", option: choices[0] };
        }, this);
      },
    },
  ],
  subroutines: [
    { text: "The Runner loses [click].", Resolve: function () { LoseClicks(runner, 1); } },
    { text: "The Runner loses [click].", Resolve: function () { LoseClicks(runner, 1); } },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
  ],
  AIImplementIce: function (rc, result) {
    result.sr = [[["loseClicks"]], [["loseClicks"]], [["endTheRun"]]];
    return result;
  },
};

// --- quebra de bioroide: "Perder [click]: quebrar 1 subrotina" (Bumi, Týr)
function JKCBioroidBreakAbility(extra) {
  return {
    text: "Break 1 subroutine on this ice",
    Enumerate: function () {
      if (!CheckClicks(runner, 1)) return [];
      if (activePlayer !== runner) return [];
      if (!encountering) return [];
      if (GetApproachEncounterIce() != this) return [];
      var choices = [];
      for (var i = 0; i < this.subroutines.length; i++) {
        var subroutine = this.subroutines[i];
        if (!subroutine.broken) choices.push({ subroutine: subroutine, label: 'Lose [click]: Break "' + subroutine.text + '"' });
      }
      return choices;
    },
    Resolve: function (params) {
      SpendClicks(runner, 1);
      Break(params.subroutine);
      if (typeof extra == "function") extra.call(this);
    },
    opponentOnly: true,
  };
}
function JKCBioroidBreakerAI(rc, result, point, server, cardStrength, iceAI, iceStrength, clicksLeft, creditsLeft) {
  if (this == iceAI.ice && clicksLeft > 0) {
    var breakresult = rc.SrBreak(this, iceAI, point, 1);
    for (var j = 0; j < breakresult.length; j++) breakresult[j].runner_clicks_spent += 1;
    result = result.concat(breakresult);
  }
  return result;
}

// Bumi 1.0 (Sentry 3/3)
cardSet[35041] = {
  title: "Bumi 1.0",
  imageFile: "35041.png",
  cardText: "When you rez this ice during a run against this server, you may trash 1 installed trojan program. Lose [click]: Break 1 subroutine on this ice. Only the Runner can use this ability. [subroutine] Trash 1 installed program. [subroutine] Do 1 core damage.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "ice",
  subTypes: ["Sentry", "Bioroid", "Destroyer", "AP"],
  rezCost: 3,
  strength: 3,
  responseOnRez: {
    Enumerate: function (card) {
      if (card != this || !CheckRunning() || !attackedServer || GetServer(this) != attackedServer) return [];
      var trojans = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]) && CheckSubType(c, "Trojan") && CheckTrash(c); });
      return trojans.length ? [{}] : [];
    },
    Resolve: function () {
      var trojans = ChoicesInstalledCards(runner, function (c) { return CheckCardType(c, ["program"]) && CheckSubType(c, "Trojan") && CheckTrash(c); });
      var choices = trojans.slice();
      choices.push({ skip: true, label: "Não dar trash", button: "Não dar trash" });
      DecisionPhase(corp, choices, function (p) { if (!p.skip) Trash(p.card, true); }, "Bumi 1.0", "Bumi 1.0: trash em 1 programa trojan", this, "trash");
      if (corp.AI != null) corp.AI.preferred = { title: "Bumi 1.0", option: trojans.slice().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0] || choices[choices.length - 1] };
    },
    text: "Bumi 1.0: trash em 1 trojan",
  },
  subroutines: [
    { text: "Trash 1 installed program.", Resolve: function () { JKCTrashProgramSub("Bumi 1.0"); } },
    { text: "Do 1 core damage.", Resolve: function () { Damage("core", 1, true); } },
  ],
  abilities: [JKCBioroidBreakAbility()],
  activeForOpponent: true,
  AIImplementIce: function (rc, result) {
    result.sr = [[JKCRunnerProgramsInstalled() > 0 ? ["misc_serious"] : []], [["coreDamage"]]];
    return result;
  },
  AIImplementBreaker: JKCBioroidBreakerAI,
};

// Týr (Sentry 10/7)
cardSet[26102] = {
  title: "Týr",
  imageFile: "26102.png",
  cardText: "Lose [click]: Break 1 subroutine on this ice. The Corp gets +1 allotted click for their next turn. Only the Runner can use this ability. [subroutine] Do 2 core damage. [subroutine] Trash 1 installed Runner card. Gain 3[c]. [subroutine] End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 5,
  cardType: "ice",
  subTypes: ["Sentry", "Bioroid", "Destroyer", "AP"],
  rezCost: 10,
  strength: 7,
  subroutines: [
    { text: "Do 2 core damage.", Resolve: function () { Damage("core", 2, true); } },
    {
      text: "Trash 1 installed Runner card. Gain 3[c].",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, CheckTrash);
        if (choices.length > 0) {
          DecisionPhase(corp, choices, function (p) { Trash(p.card, true); GainCredits(corp, 3); }, "Týr", "Trash", this, "trash");
          if (corp.AI != null) corp.AI.preferred = { title: "Týr", option: choices.slice().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0] };
        } else GainCredits(corp, 3);
      },
    },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
  ],
  abilities: [JKCBioroidBreakAbility(function () { JKC.tyrExtraClicks++; Log("Týr: a Corp ganha +1 clique no próximo turno"); })],
  activeForOpponent: true,
  AIImplementIce: function (rc, result) {
    result.sr = [[["coreDamage", "coreDamage"]], [["misc_serious"]], [["endTheRun"]]];
    return result;
  },
  AIImplementBreaker: JKCBioroidBreakerAI,
};

// Drafter (Sentry 3/3)
cardSet[26101] = {
  title: "Drafter",
  imageFile: "26101.png",
  cardText: "[subroutine] You may add 1 card from Archives to HQ. [subroutine] You may install 1 card from Archives or HQ, ignoring all costs.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "ice",
  subTypes: ["Sentry"],
  rezCost: 3,
  strength: 3,
  subroutines: [
    {
      text: "You may add 1 card from Archives to HQ.",
      Resolve: function () {
        if (!corp.archives.cards.length) return;
        var choices = ChoicesArrayCards(corp.archives.cards);
        choices.push({ skip: true, label: "Não adicionar", button: "Não adicionar" });
        DecisionPhase(corp, choices, function (p) {
          if (p.skip) return;
          MoveCard(p.card, corp.HQ.cards);
          Log("Drafter: " + GetTitle(p.card, true) + " de Archives para o HQ");
        }, "Drafter", "Drafter: adicionar 1 carta de Archives ao HQ", this);
        if (corp.AI != null) {
          var order = ["agenda", "operation", "ice", "asset", "upgrade"];
          var pick = null;
          for (var k = 0; k < order.length && !pick; k++) {
            var t = order[k];
            var cand = choices.filter(function (o) { return o.card && o.card.cardType == t; });
            if (t == "operation") cand = cand.filter(function (o) { return o.card.title != "Petty Cash"; });
            if (cand.length) pick = cand.sort(function (a, b) { return (b.card.rezCost || b.card.playCost || 0) - (a.card.rezCost || a.card.playCost || 0); })[0];
          }
          corp.AI.preferred = { title: "Drafter", option: pick || choices[choices.length - 1] };
        }
      },
    },
    {
      text: "You may install 1 card from Archives or HQ, ignoring all costs.",
      Resolve: function () { JKCMayInstallFromHQorArchives("Drafter", true, this); },
    },
  ],
  AIImplementIce: function (rc, result) {
    result.sr = [[["misc_moderate"]], [["misc_moderate"]]];
    return result;
  },
};

// Ansel 2.0 (Sentry 8/5)
cardSet[36028] = {
  title: "Ansel 2.0",
  imageFile: "36028.png",
  cardText: "Lose [click][click]: Break up to 2 subroutines on this ice. Only the Runner can use this ability. [subroutine] Trash 1 installed Runner card. [subroutine] Remove 1 card in the heap from the game. [subroutine] You may install 1 card from HQ or Archives. [subroutine] End the run.",
  player: corp,
  faction: "Haas-Bioroid",
  influence: 4,
  cardType: "ice",
  subTypes: ["Sentry", "Bioroid", "Destroyer"],
  rezCost: 8,
  strength: 5,
  subroutines: [
    {
      text: "Trash 1 installed Runner card.",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, CheckTrash);
        if (choices.length > 0) {
          DecisionPhase(corp, choices, function (p) { Trash(p.card, true); }, "Ansel 2.0", "Trash", this, "trash");
          if (corp.AI != null) corp.AI.preferred = { title: "Ansel 2.0", option: choices.slice().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0] };
        }
      },
    },
    {
      text: "Remove 1 card in the heap from the game.",
      Resolve: function () {
        if (!runner.heap.length) return;
        var choices = ChoicesArrayCards(runner.heap);
        DecisionPhase(corp, choices, function (p) { RemoveFromGame(p.card); }, "Ansel 2.0", "Ansel 2.0: remover do jogo 1 carta do heap", this, "trash");
        if (corp.AI != null) {
          var pick = choices.filter(function (o) { return o.card.cardType == "program"; }).sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0];
          if (!pick) pick = choices.slice().sort(function (a, b) { return JKCRunnerCostly(a.card, b.card); })[0];
          corp.AI.preferred = { title: "Ansel 2.0", option: pick || choices[0] };
        }
      },
    },
    {
      text: "You may install 1 card from HQ or Archives.",
      Resolve: function () { JKCMayInstallFromHQorArchives("Ansel 2.0", false, this); },
    },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
  ],
  abilities: [
    {
      text: "Break up to 2 subroutines on this ice",
      Enumerate: function () {
        if (!CheckClicks(runner, 2)) return [];
        if (activePlayer !== runner) return [];
        if (!encountering) return [];
        if (GetApproachEncounterIce() != this) return [];
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken) choices.push({ subroutine: subroutine, label: 'Lose [click][click]: Break "' + subroutine.text + '" (e até mais 1)' });
        }
        return choices;
      },
      Resolve: function (params) {
        SpendClicks(runner, 2);
        Break(params.subroutine);
        // segunda subrotina, sem custo adicional
        var rest = this.subroutines.filter(function (s) { return !s.broken; });
        if (!rest.length) return;
        var choices = rest.map(function (s) { return { subroutine: s, label: 'Break "' + s.text + '"' }; });
        choices.push({ alt: "continue", label: "Não quebrar outra", button: "Não quebrar outra" });
        DecisionPhase(runner, choices, function (q) { if (q.subroutine) Break(q.subroutine); }, "Ansel 2.0", "Ansel 2.0: quebrar mais 1 subrotina", this);
      },
      opponentOnly: true,
    },
  ],
  activeForOpponent: true,
  AIImplementIce: function (rc, result, maxCorpCred, incomplete) {
    result.sr = [];
    if (rc.precalculated.runnerInstalledCardsLength > 0) result.sr.push([JKCRunnerProgramsInstalled() > 0 ? ["misc_serious"] : ["misc_moderate"]]);
    else result.sr.push([[]]);
    result.sr.push([runner.heap.length > 0 ? ["misc_moderate"] : []]);
    result.sr.push([(corp.HQ.cards.length || corp.archives.cards.length) ? ["misc_moderate"] : []]);
    result.sr.push([["endTheRun"]]);
    return result;
  },
  AIImplementBreaker: function (rc, result, point, server, cardStrength, iceAI, iceStrength, clicksLeft, creditsLeft) {
    if (this == iceAI.ice && clicksLeft > 1) {
      var r2 = rc.SrBreak(this, iceAI, point, 2);
      var r1 = rc.SrBreak(this, iceAI, point, 1);
      var all = r2.concat(r1);
      for (var j = 0; j < all.length; j++) all[j].runner_clicks_spent += 2;
      result = result.concat(all);
    }
    return result;
  },
};
