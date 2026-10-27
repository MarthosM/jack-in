// =====================================================================
// Jack In — Treino: cartas do deck Earth Station: SEA Headquarters (Weyland)
// Regras + dicas para a IA de Corp. Códigos = códigos do NetrunnerDB.
// Licença: GPL-3.0 (derivado do Chiriboga). Requer sets/jackin_corp.js .. jackin_corp3.js.
// =====================================================================

JKC.runnerHQSuccess = false; // o Runner teve run com sucesso no HQ no último turno dele
JKC.noScoreThisTurn = false; // Digital Rights Management

// ------------------------------------------------------------ utilidades
function JKCHumanCorpPhysical() {
  return typeof Physical != "undefined" && Physical.enabled && typeof PhysicalHuman == "function" && PhysicalHuman() == corp;
}
// move carta sem perguntar identificação (busca: o jogador já disse qual carta é)
function JKCMoveKnown(card, dest, bottom) {
  var was = typeof Physical != "undefined" ? Physical.resolving : false;
  if (typeof Physical != "undefined") Physical.resolving = true;
  try {
    MoveCard(card, dest);
    if (bottom) {
      var i = dest.indexOf(card);
      if (i > 0) { dest.splice(i, 1); dest.unshift(card); }
    }
  } finally {
    if (typeof Physical != "undefined") Physical.resolving = was;
  }
}
// Corp humana com cartas físicas: se ainda há carta a identificar, primeiro identifica, depois mostra a escolha
function JKCAfterIdentify(title, label, fn, ctx) {
  if (JKCHumanCorpPhysical() && Physical.pending.length) {
    DecisionPhase(corp, [{ id: 0, label: label, button: label }], function () { fn.call(ctx); }, title, title, ctx);
  } else fn.call(ctx);
}
function JKCAdvanceTargets() {
  return ChoicesInstalledCards(corp, function (c) { return CheckAdvance(c); });
}
// IA: melhor alvo para 1 avanço (agenda mais perto de pontuar; senão ice avançável)
function JKCAIBestAdvanceTarget(choices) {
  var best = null, score = -1;
  choices.forEach(function (o) {
    var c = o.card, s = 0;
    if (c.cardType == "agenda") s = 100 - (AdvancementRequirement(c) - (c.advancement || 0)) * 10;
    else if (c.title == "Pharos" && (c.advancement || 0) < 3) s = 40 + (c.advancement || 0) * 10;
    else if (c.cardType == "ice") s = 20;
    else s = 10;
    if (s > score) { score = s; best = o; }
  });
  return best;
}
function JKCPlaceOneAdvancement(title, optional, after, ctx) {
  var targets = JKCAdvanceTargets();
  if (!targets.length) { if (after) after.call(ctx); return; }
  var choices = targets.slice();
  if (optional) choices.push({ skip: true, label: "Não colocar", button: "Não colocar" });
  DecisionPhase(corp, choices, function (p) {
    if (!p.skip) PlaceAdvancement(p.card, 1);
    if (after) after.call(ctx);
  }, title, title, ctx);
  if (corp.AI != null) corp.AI.preferred = { title: title, option: JKCAIBestAdvanceTarget(targets) || choices[0] };
}

// ------------------------------------------------- limite de 1 servidor remoto
function JKCOneRemoteLimit() {
  return !!(corp.identityCard && corp.identityCard.jkLimitOneRemote && corp.remoteServers.length >= 1);
}
// pode instalar esta carta no servidor remoto que já existe sem perder nada?
function JKCSEACanUseRemote(card) {
  if (!corp.remoteServers.length) return true;
  if (card.cardType == "ice" || card.cardType == "upgrade") return true;
  return !corp.remoteServers[0].root.some(function (c) { return c.cardType == "agenda" || c.cardType == "asset"; });
}
(function () {
  var _CCI = ChoicesCardInstall;
  ChoicesCardInstall = function (card) {
    var ret = _CCI.apply(this, arguments);
    if (card && card.player == corp && JKCOneRemoteLimit()) ret = ret.filter(function (o) { return o.server !== null; });
    return ret;
  };
  var _pick = JKCAIInstallPick;
  JKCAIInstallPick = function (cards) {
    var pick = _pick.apply(this, arguments);
    if (pick && pick.server === null && JKCOneRemoteLimit()) {
      if (JKCSEACanUseRemote(pick.card)) pick.server = corp.remoteServers[0];
      else if (pick.card.cardType == "ice") pick.server = corp.HQ;
      else pick = null;
    }
    return pick;
  };
  if (typeof CorpAI != "undefined") {
    var _rio = CorpAI.prototype._rankedInstallOptions;
    CorpAI.prototype._rankedInstallOptions = function () {
      var ret = _rio.apply(this, arguments);
      if (!JKCOneRemoteLimit() || !Array.isArray(ret)) return ret;
      var out = [];
      ret.forEach(function (o) {
        if (o && o.serverToInstallTo === null && o.cardToInstall) {
          if (JKCSEACanUseRemote(o.cardToInstall)) { o.serverToInstallTo = corp.remoteServers[0]; out.push(o); }
        } else out.push(o);
      });
      return out;
    };
    var _rp = CorpAI.prototype._returnPreference;
    CorpAI.prototype._returnPreference = function (optionList, cmd, prefs) {
      if (cmd == "install" && prefs && prefs.cardToInstall && prefs.serverToInstallTo === null && JKCOneRemoteLimit()) {
        if (JKCSEACanUseRemote(prefs.cardToInstall)) prefs.serverToInstallTo = corp.remoteServers[0];
        else {
          // não cria o 2º servidor: faz economia no lugar
          this.preferred = null;
          var k = optionList.indexOf("gain");
          if (k < 0) k = optionList.indexOf("draw");
          if (k < 0) k = optionList.indexOf("n");
          return k < 0 ? 0 : k;
        }
      }
      return _rp.apply(this, arguments);
    };
  }
})();

// --------------------------------------------- custo adicional de run (Earth Station)
function JKCExtraRunCost(server) {
  var id = corp.identityCard;
  if (!id || typeof id.JKCRunCost != "function") return 0;
  return id.JKCRunCost(server);
}
(function () {
  var _CES = ChoicesExistingServers;
  ChoicesExistingServers = function () {
    var ret = _CES.apply(this, arguments);
    // o Runner só pode iniciar run onde consegue pagar o custo adicional
    return ret.filter(function (o) { return !o.server || runner.creditPool >= JKCExtraRunCost(o.server); });
  };
  var _MakeRun = MakeRun;
  MakeRun = function (server) {
    var cost = JKCExtraRunCost(server);
    if (cost > 0) {
      var paid = Math.min(cost, runner.creditPool);
      runner.creditPool -= paid;
      Log("Runner pagou " + paid + "¢ de custo adicional (Earth Station) para correr em " + server.serverName);
    }
    return _MakeRun.apply(this, arguments);
  };
  var _AT = AutomaticTriggers;
  AutomaticTriggers = function (callbackName) {
    if (callbackName == "automaticOnRunSuccessful" && playerTurn == runner && attackedServer === corp.HQ) JKC.runnerHQSuccess = true;
    return _AT.apply(this, arguments);
  };
  var _CP = ChangePhase;
  ChangePhase = function (phase) {
    if (phase && phase.identifier == "Runner 1.1") JKC.runnerHQSuccess = false;
    if (phase && phase.identifier == "Corp 1.1") JKC.noScoreThisTurn = false;
    return _CP.apply(this, arguments);
  };
  var _CS = CheckScore;
  CheckScore = function (card) {
    if (JKC.noScoreThisTurn && playerTurn == corp) return false;
    return _CS.apply(this, arguments);
  };
  // Let Them Dream vale 1 ponto a menos na área do Runner
  var _AP = AgendaPoints;
  AgendaPoints = function (player) {
    var r = _AP.apply(this, arguments);
    if (player == runner) runner.scoreArea.forEach(function (c) { if (c.jkWorthLessForRunner) r -= c.jkWorthLessForRunner; });
    return r;
  };
})();

// ============================================================ IDENTIDADE
cardSet[26120] = {
  title: "Earth Station: SEA Headquarters",
  imageFile: "26120.png",
  cardText: "Limit 1 remote server. As an additional cost to run HQ, the Runner must pay 1[c]. [click]: Flip this identity. // Flip side: Limit 1 remote server. As an additional cost to run a remote server, the Runner must pay 6[c]. When the Runner makes a successful run on HQ, flip this identity.",
  player: corp,
  faction: "Weyland Consortium",
  cardType: "identity",
  subTypes: ["Division"],
  deckSize: 45,
  influenceLimit: 15,
  jkLimitOneRemote: true,
  flipped: false,
  JKCSideLabel: function () {
    return this.flipped ? "Verso: run em remoto custa +6¢" : "Frente: run no HQ custa +1¢";
  },
  JKCRunCost: function (server) {
    if (!this.flipped) return server === corp.HQ ? 1 : 0;
    return corp.remoteServers.indexOf(server) > -1 ? 6 : 0;
  },
  JKCFlip: function (why) {
    this.flipped = !this.flipped;
    Log("Earth Station virou: " + this.JKCSideLabel() + (why ? " (" + why + ")" : ""));
    if (typeof RevealAdd == "function") RevealAdd("reveal", this);
    if (typeof PhysicalNotice == "function" && typeof PhysicalHuman == "function" && PhysicalHuman() == corp) {
      PhysicalNotice("Vire a sua identidade Earth Station: " + this.JKCSideLabel());
    }
    Render();
  },
  abilities: [
    {
      text: "[click]: Virar a identidade (run em remoto passa a custar +6¢)",
      Enumerate: function () {
        if (this.flipped) return [];
        if (!CheckActionClicks(corp, 1)) return [];
        if (corp.AI != null) {
          // IA: vira quando tem agenda no remoto
          var r = corp.remoteServers[0];
          if (!r || !r.root.some(function (c) { return c.cardType == "agenda"; })) return [];
        }
        return [{}];
      },
      Resolve: function () {
        SpendClicks(corp, 1);
        this.JKCFlip("1 clique da Corp");
      },
    },
  ],
  AITriggerWhenCan: true,
  automaticOnRunSuccessful: {
    Resolve: function () {
      if (this.flipped && attackedServer === corp.HQ) this.JKCFlip("run com sucesso no HQ");
    },
    automatic: true,
  },
};

// ============================================================ AGENDAS
cardSet[36066] = {
  title: "Let Them Dream",
  imageFile: "36066.png",
  cardText: "When you score this agenda, you may search HQ, R&D, or Archives for 1 agenda and reveal it. (Shuffle R&D after searching it.) Add that agenda to HQ or the bottom of R&D. While this agenda is in the Runner's score area, it is worth 1 less agenda point.",
  player: corp,
  faction: "Neutral",
  influence: 1,
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 2,
  advancementRequirement: 4,
  jkWorthLessForRunner: 1,
  responseOnScored: {
    Enumerate: function () {
      if (intended.score != this) return [];
      var any = corp.HQ.cards.concat(corp.RnD.cards, corp.archives.cards).some(function (c) { return c.cardType == "agenda"; });
      return any ? [{}] : [];
    },
    Resolve: function () {
      var self = this;
      var where = function (c) { return c.cardLocation === corp.HQ.cards ? "HQ" : c.cardLocation === corp.RnD.cards ? "R&D" : "Archives"; };
      var seen = {};
      var choices = [];
      corp.HQ.cards.concat(corp.RnD.cards, corp.archives.cards).forEach(function (c) {
        if (c.cardType != "agenda") return;
        var key = c.title + "|" + where(c);
        if (seen[key]) return;
        seen[key] = true;
        choices.push({ card: c, label: c.title + " (" + where(c) + ")", button: c.title });
      });
      choices.push({ skip: true, label: "Não procurar", button: "Não procurar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        var fromRnD = p.card.cardLocation === corp.RnD.cards;
        Log("Let Them Dream: Corp revela " + p.card.title);
        if (typeof RevealAdd == "function") RevealAdd("reveal", p.card);
        var finish = function (toHQ) {
          if (toHQ) JKCMoveKnown(p.card, corp.HQ.cards);
          if (fromRnD) { Shuffle(corp.RnD.cards); Log("R&D embaralhado"); }
          if (!toHQ) { JKCMoveKnown(p.card, corp.RnD.cards, true); Log(p.card.title + " vai para o fundo do R&D"); }
          if (typeof PhysicalNotice == "function" && JKCHumanCorpPhysical()) {
            PhysicalNotice("Let Them Dream: " + p.card.title + (toHQ ? " vai para a sua mão" : " vai para o fundo do R&D") + (fromRnD ? " (embaralhe o R&D antes)" : ""));
          }
        };
        var dest = [
          { id: 1, label: "Colocar no HQ", button: "HQ" },
          { id: 0, label: "Colocar no fundo do R&D", button: "Fundo do R&D" },
        ];
        DecisionPhase(corp, dest, function (q) { finish(q.id == 1); }, "Let Them Dream", "Let Them Dream", self);
        if (corp.AI != null) corp.AI.preferred = { title: "Let Them Dream", option: dest[0] };
      }, "Let Them Dream", "Let Them Dream", this);
      if (corp.AI != null) {
        // IA: traz a agenda de mais pontos que não esteja já no HQ
        var best = choices.filter(function (c) { return c.card && c.card.cardLocation !== corp.HQ.cards; })
          .sort(function (a, b) { return b.card.agendaPoints - a.card.agendaPoints; })[0];
        corp.AI.preferred = { title: "Let Them Dream", option: best || choices[choices.length - 1] };
      }
    },
    text: "Let Them Dream: procurar 1 agenda",
    optional: true,
  },
};

cardSet[36056] = {
  title: "Sacrifice Zone Expansion",
  imageFile: "36056.png",
  cardText: "Install only faceup. (This agenda is neither rezzed nor unrezzed.) The first time each turn you advance this agenda, gain 3[c]. Once per turn → When the Runner makes a successful run on another server, you may remove 1 hosted advancement counter to do 1 meat damage.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Public", "Expansion"],
  agendaPoints: 2,
  advancementRequirement: 4,
  advancedThisTurn: false,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.advancedThisTurn = false; this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.advancedThisTurn = false; this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  automaticOnInstall: {
    Resolve: function (card) {
      if (card != this) return;
      this.faceUp = true;
      this.knownToRunner = true;
      Log("Sacrifice Zone Expansion instalada com a face para cima");
      if (typeof RevealAdd == "function") RevealAdd("reveal", this);
    },
    availableWhenInactive: true,
  },
  automaticOnAdvance: {
    Resolve: function (card) {
      if (card != this || this.advancedThisTurn) return;
      this.advancedThisTurn = true;
      GainCredits(corp, 3);
      Log("Sacrifice Zone Expansion: Corp ganha 3¢ (primeiro avanço do turno)");
    },
    availableWhenInactive: true,
  },
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (this.usedThisTurn || !CheckInstalled(this) || !attackedServer) return [];
      if (GetServer(this) === attackedServer) return [];
      if (!CheckCounters(this, "advancement", 1)) return [];
      if (corp.AI != null) {
        // IA: só se mata o Runner, ou se sobra avanço além do necessário para pontuar
        var kill = runner.grip.length < 1;
        var spare = (this.advancement || 0) > AdvancementRequirement(this);
        if (!kill && !spare) return [];
      }
      return [{}];
    },
    Resolve: function () {
      this.usedThisTurn = true;
      this.advancement--;
      Log("Sacrifice Zone Expansion: remove 1 avanço, 1 de meat damage");
      Damage("meat", 1, true);
    },
    text: "Sacrifice Zone: remover 1 avanço para 1 de meat damage",
    availableWhenInactive: true,
    optional: true,
  },
};

cardSet[34123] = {
  title: "The Basalt Spire",
  imageFile: "34123.png",
  cardText: "When the Runner steals this agenda, you may add 1 card from Archives to HQ. When you score this agenda, place 2 agenda counters on it. Once per turn → Hosted agenda counter, trash the top card of R&D: Add 1 card from Archives to HQ.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 0,
  cardType: "agenda",
  subTypes: [],
  agendaPoints: 3,
  advancementRequirement: 5,
  usedThisTurn: false,
  responseOnCorpTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  responseOnRunnerTurnBegins: { Resolve: function () { this.usedThisTurn = false; }, automatic: true, availableWhenInactive: true },
  JKCArchivesToHQ: function (optional) {
    var self = this;
    JKCAfterIdentify("The Basalt Spire", "Escolher carta de Archives", function () {
      if (!corp.archives.cards.length) return;
      var choices = ChoicesArrayCards(corp.archives.cards).map(function (c) { c.label = c.card.title; c.button = c.card.title; return c; });
      if (optional) choices.push({ skip: true, label: "Não pegar", button: "Não pegar" });
      DecisionPhase(corp, choices, function (p) {
        if (p.skip) return;
        JKCMoveKnown(p.card, corp.HQ.cards);
        Log("The Basalt Spire: " + p.card.title + " volta de Archives para o HQ");
        if (typeof PhysicalNotice == "function" && JKCHumanCorpPhysical()) PhysicalNotice("The Basalt Spire: pegue " + p.card.title + " de Archives para a mão");
      }, "The Basalt Spire", "The Basalt Spire", self);
      if (corp.AI != null) {
        var best = choices.filter(function (c) { return c.card; }).sort(function (a, b) { return JKCAUValue(b.card) - JKCAUValue(a.card); })[0];
        corp.AI.preferred = { title: "The Basalt Spire", option: best || choices[0] };
      }
    }, this);
  },
  responseOnScored: {
    Resolve: function () { if (intended.score == this) AddCounters(this, "agenda", 2); },
    text: "The Basalt Spire: 2 marcadores de agenda",
    automatic: true,
  },
  responseOnStolen: {
    Enumerate: function () { return intended.steal == this && corp.archives.cards.length ? [{}] : []; },
    Resolve: function () { this.JKCArchivesToHQ(true); },
    text: "The Basalt Spire: 1 carta de Archives para o HQ",
    availableWhenInactive: true,
    optional: true,
  },
  abilities: [
    {
      text: "Marcador de agenda + trash no topo do R&D: 1 carta de Archives para o HQ",
      Enumerate: function () {
        if (this.usedThisTurn || corp.scoreArea.indexOf(this) < 0) return [];
        if (!CheckCounters(this, "agenda", 1) || !corp.RnD.cards.length || !corp.archives.cards.length) return [];
        if (corp.AI != null) {
          if (!corp.archives.cards.some(function (c) { return c.cardType == "agenda"; })) return [];
          if (corp.RnD.cards.length < 6) return [];
        }
        return [{}];
      },
      Resolve: function () {
        this.usedThisTurn = true;
        RemoveCounters(this, "agenda", 1);
        var top = corp.RnD.cards[corp.RnD.cards.length - 1];
        Log("The Basalt Spire: trash na carta do topo do R&D");
        Trash(top, false);
        this.JKCArchivesToHQ(false);
      },
    },
  ],
  AITriggerWhenCan: true,
  jkPaidAnytime: true,
};

// habilidade paga (sem clique) de carta na área de pontos também aparece na fase de ações
(function () {
  var _CTA = ChoicesTriggerableAbilities;
  ChoicesTriggerableAbilities = function (player, limitTo) {
    var ret = _CTA.apply(this, arguments);
    if (player == corp && limitTo == "click") {
      corp.scoreArea.forEach(function (c) {
        if (!c.jkPaidAnytime) return;
        ChoicesAbility(c, "").forEach(function (a) {
          if (!ret.some(function (r) { return r.card === c && r.ability === a.ability; })) ret.push({ card: c, ability: a.ability, label: "(" + c.title + ") " + a.ability.text });
        });
      });
    }
    return ret;
  };
})();

// ========================================================== OPERAÇÕES
function JKCDRMInstallFromHQ(ctx) {
  var cards = corp.HQ.cards.filter(function (c) { return c.cardType != "ice" && c.cardType != "operation" && CheckInstall(c); });
  if (!cards.length) return;
  var remoteOnly = function (o) { return o.server === null || corp.remoteServers.indexOf(o.server) > -1; };
  if (corp.AI != null) {
    var ag = cards.filter(function (c) { return c.cardType == "agenda"; })[0] || cards.filter(function (c) { return c.cardType == "asset"; })[0];
    if (!ag) return;
    var srv = null;
    if (corp.remoteServers.length && (JKCOneRemoteLimit() || !corp.remoteServers[0].root.length)) {
      if (!JKCSEACanUseRemote(ag)) return;
      srv = corp.remoteServers[0];
    }
    Log("Digital Rights Management: Corp instala 1 carta num remoto");
    Install(ag, srv, false, null, true, null, ctx);
    return;
  }
  var choices = ChoicesArrayInstall(cards, false).filter(remoteOnly);
  choices.push({ skip: true, label: "Não instalar", button: "Não instalar" });
  DecisionPhase(corp, choices, function (p) {
    if (p.skip) return;
    Install(p.card, p.server, false, null, true, null, ctx);
  }, "Digital Rights Management", "Instalar 1 carta do HQ num remoto", ctx, "install");
}
cardSet[26117] = {
  title: "Digital Rights Management",
  imageFile: "26117.png",
  cardText: "Play only if the Runner did not make a successful run on HQ during their last turn. Search R&D for 1 agenda and reveal it. (Shuffle R&D after searching it.) Add that agenda to HQ. You may install 1 card from HQ in the root of a remote server. You cannot score agendas for the remainder of the turn.",
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "operation",
  subTypes: [],
  playCost: 1,
  Enumerate: function () { return JKC.runnerHQSuccess ? [] : [{}]; },
  Resolve: function () {
    var self = this;
    JKC.noScoreThisTurn = true;
    var ags = corp.RnD.cards.filter(function (c) { return c.cardType == "agenda"; });
    var after = function () {
      Shuffle(corp.RnD.cards);
      Log("R&D embaralhado");
      JKCDRMInstallFromHQ(self);
    };
    if (!ags.length) { Log("Digital Rights Management: nenhuma agenda no R&D"); after(); return; }
    var seen = {};
    var choices = [];
    ags.forEach(function (c) { if (!seen[c.title]) { seen[c.title] = 1; choices.push({ card: c, label: c.title, button: c.title }); } });
    DecisionPhase(corp, choices, function (p) {
      Log("Digital Rights Management: Corp revela " + p.card.title + " e põe no HQ");
      if (typeof RevealAdd == "function") RevealAdd("reveal", p.card);
      JKCMoveKnown(p.card, corp.HQ.cards);
      if (typeof PhysicalNotice == "function" && JKCHumanCorpPhysical()) PhysicalNotice("Digital Rights Management: pegue " + p.card.title + " do R&D e embaralhe o R&D");
      after();
    }, "Digital Rights Management", "Digital Rights Management", this);
    if (corp.AI != null) {
      var best = choices.slice().sort(function (a, b) { return b.card.agendaPoints - a.card.agendaPoints; })[0];
      corp.AI.preferred = { title: "Digital Rights Management", option: best };
    }
  },
  AIWouldPlay: function () {
    if (JKC.runnerHQSuccess) return false;
    if (corp.HQ.cards.some(function (c) { return c.cardType == "agenda"; })) return false;
    if (!corp.RnD.cards.some(function (c) { return c.cardType == "agenda"; })) return false;
    if (corp.clickTracker < 2) return false;
    return !corp.remoteServers.length || JKCSEACanUseRemote({ cardType: "agenda" });
  },
};
cardSet[27006] = jQuery.extend({}, cardSet[26117], { imageFile: "27006.png" });

cardSet[35077] = {
  title: "Key Performance Indicators",
  imageFile: "35077.png",
  cardText: "Resolve 2 of the following in any order: Draw 1 card. Shuffle 1 card from HQ into R&D. / Install 1 piece of ice from HQ, ignoring all costs. / Place 1 advancement counter on an installed card you can advance. / Gain 2[c].",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 1,
  JKCOptions: function (used) {
    var o = [];
    if (!used[0]) o.push({ id: 0, label: "Comprar 1 e embaralhar 1 carta do HQ no R&D", button: "Comprar e embaralhar" });
    if (!used[1] && corp.HQ.cards.some(function (c) { return c.cardType == "ice" && c !== this; }, this)) o.push({ id: 1, label: "Instalar 1 ice do HQ sem custos", button: "Instalar ice" });
    if (!used[2] && JKCAdvanceTargets().length) o.push({ id: 2, label: "Colocar 1 avanço numa carta instalada", button: "1 avanço" });
    if (!used[3]) o.push({ id: 3, label: "Ganhar 2¢", button: "Ganhar 2¢" });
    return o;
  },
  JKCDo: function (id, next) {
    var self = this;
    if (id == 3) { GainCredits(corp, 2); next(); return; }
    if (id == 2) { JKCPlaceOneAdvancement("Key Performance Indicators", false, next, self); return; }
    if (id == 1) {
      var ice = corp.HQ.cards.filter(function (c) { return c.cardType == "ice"; });
      JKCInstallOne("Key Performance Indicators", ice, function () { next(); }, self, false);
      return;
    }
    // comprar 1, depois embaralhar 1 do HQ no R&D
    Draw(corp, 1);
    JKCAfterIdentify("Key Performance Indicators", "Escolher carta para embaralhar no R&D", function () {
      if (!corp.HQ.cards.length) { next(); return; }
      var choices = ChoicesArrayCards(corp.HQ.cards).map(function (c) { c.label = c.card.title; c.button = c.card.title; return c; });
      DecisionPhase(corp, choices, function (p) {
        JKCMoveKnown(p.card, corp.RnD.cards);
        Shuffle(corp.RnD.cards);
        Log("Key Performance Indicators: 1 carta do HQ embaralhada no R&D");
        if (typeof PhysicalNotice == "function" && JKCHumanCorpPhysical()) PhysicalNotice("KPI: embaralhe " + p.card.title + " no seu R&D");
        next();
      }, "Key Performance Indicators", "Embaralhar 1 carta do HQ no R&D", self);
      if (corp.AI != null) {
        var worst = corp.HQ.cards.slice().sort(function (a, b) { return JKCAUValue(a) - JKCAUValue(b); })[0];
        corp.AI.preferred = { title: "Key Performance Indicators", option: choices.find(function (c) { return c.card == worst; }) || choices[0] };
      }
    }, self);
  },
  Resolve: function () {
    var self = this;
    var used = {};
    var step = function (n) {
      if (n >= 2) return;
      var opts = self.JKCOptions(used);
      if (!opts.length) return;
      DecisionPhase(corp, opts, function (p) {
        used[p.id] = true;
        self.JKCDo(p.id, function () { step(n + 1); });
      }, "Key Performance Indicators", "Key Performance Indicators (" + (n + 1) + " de 2)", self);
      if (corp.AI != null) {
        var pref = [2, 3, 1, 0];
        var adv = JKCAdvanceTargets().some(function (o) { return o.card.cardType == "agenda"; });
        if (!adv) pref = [3, 1, 0, 2];
        var pick = null;
        pref.some(function (id) { pick = opts.find(function (o) { return o.id == id; }); return !!pick; });
        corp.AI.preferred = { title: "Key Performance Indicators", option: pick || opts[0] };
      }
    };
    step(0);
  },
  AIWouldPlay: function () { return Credits(corp) < 12; },
};

// ================================================================= ICE
function JKCAdvStrength(card) { return function (c) { return c == card ? (card.advancement || 0) : 0; }; }

cardSet[34127] = {
  title: "Logjam",
  imageFile: "34127.png",
  cardText: "You can advance this ice. It gets +1 strength for each hosted advancement counter. When you rez this ice, place 1 advancement counter on it plus 1 advancement counter for each card type among faceup cards in Archives. [subroutine] Gain 2[c]. End the run. [subroutine] End the run. [subroutine] End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 6,
  strength: 0,
  canBeAdvanced: true,
  modifyStrength: { Resolve: function (card) { return card == this ? (this.advancement || 0) : 0; } },
  automaticOnRez: {
    Resolve: function (card) {
      if (card != this) return;
      var types = {};
      corp.archives.cards.forEach(function (c) { if (IsFaceUp(c)) types[c.cardType] = true; });
      PlaceAdvancement(this, 1 + Object.keys(types).length);
    },
  },
  subroutines: [
    { text: "Gain 2[c]. End the run.", Resolve: function () { GainCredits(corp, 2); EndTheRun(); } },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
    { text: "End the run.", Resolve: function () { EndTheRun(); } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_minor", "endTheRun"]], [["endTheRun"]], [["endTheRun"]]]; return result; },
};

cardSet[34059] = {
  title: "Tree Line",
  imageFile: "34059.png",
  cardText: "[click], 1[c], reveal and trash this ice from HQ: Place 3 advancement counters on 1 installed piece of ice. You can advance this ice. It gets +1 strength for each hosted advancement counter. [subroutine] Gain 1[c]. End the run.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 1,
  cardType: "ice",
  subTypes: ["Barrier", "Expendable"],
  rezCost: 4,
  strength: 4,
  canBeAdvanced: true,
  modifyStrength: { Resolve: function (card) { return card == this ? (this.advancement || 0) : 0; } },
  abilitiesFromHand: true,
  abilities: [
    {
      text: "Revelar e dar trash da mão: 3 avanços em 1 ice instalado",
      Enumerate: function () {
        if (this.cardLocation != corp.HQ.cards) return [];
        if (!CheckActionClicks(corp, 1) || !CheckCredits(corp, 1)) return [];
        var targets = ChoicesInstalledCards(corp, function (c) { return c.cardType == "ice"; });
        if (!targets.length) return [];
        if (corp.AI != null) {
          // IA: só em Pharos sem os 3 avanços (ganha +5 de força)
          var good = targets.filter(function (t) { return t.card.title == "Pharos" && (t.card.advancement || 0) < 3; });
          return good.length ? [good[0]] : [];
        }
        return targets;
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
        SpendCredits(corp, 1);
        Log("Corp revelou e deu trash em Tree Line da mão");
        if (typeof RevealAdd == "function") RevealAdd("reveal", this);
        JKC.corpTrashing = true;
        Trash(this, false, function () { JKC.corpTrashing = false; });
        PlaceAdvancement(params.card, 3);
      },
    },
  ],
  AITriggerWhenCan: true,
  subroutines: [
    { text: "Gain 1[c]. End the run.", Resolve: function () { GainCredits(corp, 1); EndTheRun(); } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_minor", "endTheRun"]]]; return result; },
};

cardSet[35076] = {
  title: "Syailendra",
  imageFile: "35076.png",
  cardText: "You can advance this ice. When the Runner encounters this ice, if it has 3 or more hosted advancement counters, you may place 1 advancement counter on an installed card you can advance. [subroutine] You may place 1 advancement counter on an installed card you can advance. [subroutine] The Runner loses 2[c]. [subroutine] Do 1 net damage.",
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "ice",
  subTypes: ["Code Gate", "AP"],
  rezCost: 4,
  strength: 5,
  canBeAdvanced: true,
  responseOnEncounter: {
    Enumerate: function () {
      if (GetApproachEncounterIce() != this || (this.advancement || 0) < 3) return [];
      return JKCAdvanceTargets().length ? [{}] : [];
    },
    Resolve: function () { JKCPlaceOneAdvancement("Syailendra", true, null, this); },
    text: "Syailendra: colocar 1 avanço",
    optional: true,
  },
  subroutines: [
    { text: "You may place 1 advancement counter on an installed card you can advance.", Resolve: function () { JKCPlaceOneAdvancement("Syailendra", true, null, this); } },
    { text: "The Runner loses 2[c].", Resolve: function () { LoseCredits(runner, 2); } },
    { text: "Do 1 net damage.", Resolve: function () { JKCNet(1); } },
  ],
  AIImplementIce: function (rc, result) { result.sr = [[["misc_minor"]], [["loseCredits", "loseCredits"]], [["netDamage"]]]; return result; },
};
