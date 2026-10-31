// =====================================================================
// Jack In — Treino: cartas de Runner (lote 3)
// Boomerang, Gachapon, Keiko, Solidarity Badge, The Tungsten Tailor, Fencer Fueno, Paladin Poemu,
// The Twinning, Trickster Taka, Audrey v2, Rising Tide.
// Só o humano joga estas cartas (a IA de Runner não tem lógica para elas). Depende de jackin_runner2.js (JKR2).
// Códigos = códigos do NetrunnerDB. Licença: GPL-3.0 (derivado do Chiriboga).
// =====================================================================

// ------------------------------------------------------------ apoio
var JKR3 = { corpTrashTurn: -1 };
(function () {
  // créditos gastos de cartas instaladas (Keiko, The Twinning): compara o que cada carta tinha antes e depois
  var _SC = SpendCredits;
  SpendCredits = function (player, num, doing, card, afterSpend, context) {
    if (player != runner) return _SC.apply(this, arguments);
    var before = InstalledCards(runner).map(function (c) { return { c: c, n: c.credits || 0 }; });
    var self = this, args = arguments;
    var wrapped = function () {
      try {
        var from = before.filter(function (b) { return (b.c.credits || 0) < b.n; }).map(function (b) { return b.c; });
        if (from.length) JKR3SpentFromCards(from);
      } catch (e) {}
      if (typeof afterSpend === "function") afterSpend.call(context);
    };
    return _SC.call(self, player, num, doing, card, wrapped, context);
  };
  // carta da Corp lixada pelo Runner (Solidarity Badge) e carta acessada lixada (Audrey v2)
  var _Trash = Trash;
  Trash = function (cards) {
    try {
      var list = Array.isArray(cards) ? cards : [cards];
      var runnerDoing = typeof activePlayer != "undefined" && activePlayer == runner;
      list.forEach(function (c) {
        if (!c || c.player != corp) return;
        if (runnerDoing || c === accessingCard) JKR3CorpCardTrashed();
        // o motor pode chamar Trash mais de uma vez para a mesma carta (prevenção): conta uma vez só
        if (c === accessingCard && !c.jkAudreyCounted) {
          c.jkAudreyCounted = true;
          runner.rig.programs.forEach(function (p) { if (p.title == "Audrey v2") { AddCounters(p, "virus", 1); } });
        }
      });
    } catch (e) {}
    return _Trash.apply(this, arguments);
  };
  // subrotina quebrada numa ice com força 0 ou menos (The Tungsten Tailor)
  var _Break = Break;
  Break = function (sub) {
    try {
      var ice = GetApproachEncounterIce();
      if (ice && Strength(ice) <= 0) {
        InstalledCards(runner).forEach(function (c) {
          if (c.title == "The Tungsten Tailor" && c.tailorTurn != JKR2.turn) {
            c.tailorTurn = JKR2.turn;
            Log("The Tungsten Tailor: subrotina quebrada numa ice de força 0, Runner ganha 1¢");
            GainCredits(runner, 1);
          }
        });
      }
    } catch (e) {}
    return _Break.apply(this, arguments);
  };
})();
function JKR3SpentFromCards(cards) {
  InstalledCards(runner).forEach(function (k) {
    // Keiko: créditos gastos de uma companion instalada
    if (k.title == "Keiko" && cards.some(function (c) { return CheckSubType(c, "Companion"); })) JKR3KeikoGain(k);
    // The Twinning: créditos gastos de qualquer carta instalada
    if (k.title == "The Twinning" && k.twinTurn != JKR2.turn) {
      k.twinTurn = JKR2.turn;
      AddCounters(k, "power", 1);
    }
  });
}
function JKR3KeikoGain(k) {
  if (k.keikoTurn == JKR2.turn) return;
  k.keikoTurn = JKR2.turn;
  Log("Keiko: Runner ganha 1¢");
  GainCredits(runner, 1);
}
function JKR3CorpCardTrashed() {
  if (JKR3.corpTrashTurn == JKR2.turn) return;
  JKR3.corpTrashTurn = JKR2.turn;
  InstalledCards(runner).forEach(function (c) { if (c.title == "Solidarity Badge") AddCounters(c, "power", 1); });
}
// quebrar até N subrotinas da ice encontrada, uma escolha por vez
function JKR3BreakUpTo(n, title) {
  JKR2Loop(title, function (st) {
    var subs = CheckEncounter() ? ChoicesEncounteredSubroutines() : [];
    if (st.k >= n || !subs.length) { st.done = true; return; }
    subs = subs.map(function (o) { o.label = "Quebrar: " + JKRunPTSafe(o.label || (o.subroutine && o.subroutine.text) || "subrotina"); return o; });
    if (st.k > 0) subs.push(JKR2Skip("Não quebrar mais"));
    DecisionPhase(runner, subs, function (p) {
      if (p.skip) { st.done = true; return; }
      st.k++;
      Break(p.subroutine);
    }, title, "Escolha a subrotina para quebrar (" + (st.k + 1) + " de até " + n + ")");
  });
}
function JKRunPTSafe(s) { return typeof JKRunPT == "function" ? JKRunPT(s) : s; }
// companions: crédito no começo do turno e ao roubar agenda; regra de fim de turno com 3 ou mais
function JKR3Companion(def) {
  var card = {
    player: runner,
    cardType: "resource",
    faction: "Anarch",
    unique: true,
    responseOnRunnerTurnBegins: {
      Resolve: function () { PlaceCredits(this, 1); },
      automatic: true,
    },
    responseOnStolen: {
      Resolve: function () { PlaceCredits(this, 1); },
      automatic: true,
    },
  };
  for (var k in def) card[k] = def[k];
  return card;
}

// ------------------------------------------------------------ HARDWARE
cardSet[26075] = {
  title: "Boomerang",
  imageFile: "26075.png",
  cardText: "When you install this hardware, choose 1 installed piece of ice. Use this hardware only during encounters with that ice. [trash]: Break up to 2 subroutines. When this run ends, if it was successful, you may shuffle 1 copy of Boomerang from your heap into your stack.",
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "hardware",
  installCost: 2,
  unique: true,
  boomIce: null,
  boomRun: false,
  boomOk: false,
  responseOnInstall: {
    Enumerate: function (card) {
      if (card !== this) return [];
      return ChoicesInstalledCards(corp, function (c) { return CheckCardType(c, ["ice"]); }).map(function (o) {
        o.label = "Boomerang mira: " + JKR2IceName(o.card);
        return o;
      });
    },
    Resolve: function (params) {
      this.boomIce = params.card;
      Log("Boomerang escolheu uma ice");
    },
    text: "Boomerang: escolher a ice",
  },
  abilities: [
    {
      text: "Lixar o Boomerang: quebrar até 2 subrotinas desta ice.",
      Enumerate: function () {
        if (!CheckEncounter() || !this.boomIce) return [];
        if (attackedServer.ice[approachIce] !== this.boomIce) return [];
        if (!CheckUnbrokenSubroutines()) return [];
        return [{}];
      },
      Resolve: function () {
        this.boomRun = true;
        this.boomOk = false;
        var self = this;
        Trash(this, false, function () { JKR3BreakUpTo(2, "Boomerang"); });
      },
    },
  ],
  responseOnRunSuccessful: {
    Resolve: function () { if (this.boomRun) this.boomOk = true; },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnRunEnds: {
    Enumerate: function () {
      if (!this.boomRun) return [];
      if (!this.boomOk || !runner.heap.some(function (c) { return c.title == "Boomerang"; })) { this.boomRun = false; return []; }
      return [{ back: true, label: "Embaralhar 1 Boomerang do heap no baralho", button: "Embaralhar de volta" }, JKR2Skip("Deixar no heap")];
    },
    Resolve: function (params) {
      this.boomRun = false; this.boomOk = false;
      if (!params.back) return;
      var b = runner.heap.find(function (c) { return c.title == "Boomerang"; });
      if (b) { MoveCard(b, runner.stack); Shuffle(runner.stack); Log("Boomerang voltou para o baralho (embaralhado)"); }
    },
    text: "Boomerang: voltar para o baralho?",
    availableWhenInactive: true,
  },
};

cardSet[26069] = {
  title: "Gachapon",
  imageFile: "26069.png",
  cardText: "[trash]: Set aside the top 6 cards of your stack faceup. You may install 1 program or virtual resource from among those cards, paying 2[c] less. Shuffle 3 of the remaining cards into your stack, then remove the rest from the game.",
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 0,
  setAside: [],
  abilities: [
    {
      text: "Lixar o Gachapon: separar as 6 do topo, instalar 1 programa ou recurso virtual com 2¢ a menos.",
      Enumerate: function () { return runner.stack.length ? [{}] : []; },
      Resolve: function () {
        var self = this;
        Trash(this, false, function () {
          self.setAside = [];
          var n = Math.min(6, runner.stack.length);
          for (var i = 0; i < n; i++) { var c = runner.stack[runner.stack.length - 1]; MoveCard(c, self.setAside); c.faceUp = true; }
          Log("Gachapon separou: " + self.setAside.map(function (c) { return c.title; }).join(", "));
          JKR2Loop("Gachapon", function (st) {
            if (st.k == 0) {
              // 1) instalar 1 programa ou recurso virtual com 2¢ a menos
              st.k = 1;
              var opts = [];
              self.setAside.forEach(function (c) {
                var ok = CheckCardType(c, ["program"]) || (CheckCardType(c, ["resource"]) && CheckSubType(c, "Virtual"));
                if (!ok) return;
                var cost = Math.max(0, InstallCost(c) - 2);
                if (!CheckCredits(runner, cost, "installing", c)) return;
                ChoicesCardInstall(c, true).forEach(function (o) {
                  o.cost = cost;
                  o.label = "Instalar " + c.title + (o.host ? " em " + o.host.title : "") + " (" + cost + "¢)";
                  opts.push(o);
                });
              });
              opts = JKR2Dedupe(opts);
              if (!opts.length) return;
              opts.push(JKR2Skip("Não instalar"));
              DecisionPhase(runner, opts, function (p) {
                if (p.skip) return;
                SpendCredits(runner, p.cost, "installing", p.card, function () { Install(p.card, p.host, true, null, true); });
              }, "Gachapon", "Instalar 1 das cartas separadas?");
              return;
            }
            // 2) escolher 3 para embaralhar de volta; o resto sai do jogo
            var left = self.setAside.slice();
            if (st.k - 1 >= 3 || !left.length || left.length <= 3 - (st.k - 1)) {
              while (left.length && st.k - 1 < 3) { var c0 = left.shift(); c0.faceUp = false; MoveCard(c0, runner.stack); st.k++; }
              Shuffle(runner.stack);
              self.setAside.slice().forEach(function (c) { RemoveFromGame(c); });
              Log("Gachapon: cartas embaralhadas no baralho; as demais saíram do jogo");
              st.done = true;
              return;
            }
            DecisionPhase(runner, left.map(function (c) { return { c: c, label: "Devolver " + c.title + " ao baralho" }; }), function (p) {
              p.c.faceUp = false;
              MoveCard(p.c, runner.stack);
              st.k++;
            }, "Gachapon", "Escolha a carta que volta ao baralho (" + st.k + " de 3); as outras saem do jogo");
          }, self);
        });
      },
    },
  ],
};

cardSet[26070] = {
  title: "Keiko",
  imageFile: "26070.png",
  cardText: "+2[mu] The first time each turn you install a companion card or spend credits from an installed companion card, gain 1[c]. Limit 1 console per player.",
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console", "Companion"],
  installCost: 3,
  unique: true,
  memoryUnits: 2,
  keikoTurn: -1,
  automaticOnInstall: {
    Resolve: function (card) {
      if (!card || card === this || !CheckInstalled(this)) return;
      if (card.player == runner && CheckSubType(card, "Companion")) JKR3KeikoGain(this);
    },
  },
};

cardSet[34003] = {
  title: "Solidarity Badge",
  imageFile: "34003.png",
  cardText: "The first time each turn you trash a Corp card, place 1 power counter on this hardware. When your turn begins, you may remove 1 hosted power counter to draw 1 card or remove 1 tag.",
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 1,
  unique: true,
  responseOnRunnerTurnBegins: {
    Enumerate: function () {
      if (!CheckCounters(this, "power", 1)) return [];
      var o = [{ act: "draw", label: "Gastar 1 marcador: comprar 1 carta", button: "Comprar 1 carta" }];
      if (runner.tags > 0) o.push({ act: "tag", label: "Gastar 1 marcador: remover 1 tag", button: "Remover 1 tag" });
      o.push(JKR2Skip("Não usar"));
      return o;
    },
    Resolve: function (params) {
      if (!params.act) return;
      RemoveCounters(this, "power", 1);
      if (params.act == "draw") Draw(runner, 1);
      else RemoveTags(1);
    },
    text: "Solidarity Badge: usar 1 marcador?",
  },
};

cardSet[36003] = {
  title: "The Tungsten Tailor",
  imageFile: "36003.png",
  cardText: "Each piece of ice gets −1 strength. The first time each turn you break a subroutine on a piece of ice with 0 or less strength, gain 1[c].",
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "hardware",
  installCost: 3,
  unique: true,
  tailorTurn: -1,
  modifyStrength: {
    Resolve: function (card) { return card && CheckCardType(card, ["ice"]) ? -1 : 0; },
  },
};

// ------------------------------------------------------------ RECURSOS
cardSet[26007] = JKR3Companion({
  title: "Fencer Fueno",
  imageFile: "26007.png",
  cardText: "When your turn begins and whenever you steal an agenda, place 1[c] on this resource. Whenever you make a successful run, you can spend hosted credits for the remainder of that run. When your turn ends, if there are 3 or more hosted credits, you must pay 1[c] or trash this resource.",
  influence: 1,
  subTypes: ["Companion", "Virtual"],
  installCost: 0,
  ffRunOk: false,
  canUseCredits: function (doing, card) { return this.ffRunOk && !!attackedServer; },
  responseOnRunSuccessful: { Resolve: function () { this.ffRunOk = true; }, automatic: true },
  responseOnRunEnds: { Resolve: function () { this.ffRunOk = false; }, automatic: true },
  responseOnRunnerDiscardEnds: {
    Enumerate: function () {
      if ((this.credits || 0) < 3) return [];
      var o = [];
      if (Credits(runner) >= 1) o.push({ pay: true, label: "Pagar 1¢ para manter o Fencer Fueno", button: "Pagar 1¢" });
      o.push({ trash: true, label: "Lixar o Fencer Fueno", button: "Lixar" });
      return o;
    },
    Resolve: function (params) {
      if (params.pay) SpendCredits(runner, 1, "", this);
      else Trash(this, false);
    },
    text: "Fencer Fueno: 3 ou mais créditos no fim do turno",
  },
});

cardSet[26073] = JKR3Companion({
  title: "Paladin Poemu",
  imageFile: "26073.png",
  cardText: "When your turn begins and whenever you steal an agenda, place 1[c] on this resource. You can spend hosted credits to install non-connection cards. When your turn ends, if there are 3 or more hosted credits, trash 1 of your installed cards.",
  influence: 3,
  subTypes: ["Companion", "Virtual"],
  installCost: 1,
  canUseCredits: function (doing, card) { return doing == "installing" && !!card && !CheckSubType(card, "Connection"); },
  responseOnRunnerDiscardEnds: {
    Enumerate: function () {
      if ((this.credits || 0) < 3) return [];
      return ChoicesInstalledCards(runner).map(function (o) { o.label = "Lixar " + o.card.title + " (Paladin Poemu)"; return o; });
    },
    Resolve: function (params) { if (params.card) Trash(params.card, false); },
    text: "Paladin Poemu: 3 ou mais créditos, lixar 1 carta instalada",
  },
});

cardSet[26009] = JKR3Companion({
  title: "Trickster Taka",
  imageFile: "26009.png",
  cardText: "When your turn begins and whenever you steal an agenda, place 1[c] on this resource. You can spend hosted credits to use programs during runs. When your turn ends, if there are 3 or more hosted credits, you must take 1 tag or trash this resource.",
  influence: 3,
  subTypes: ["Companion", "Stealth", "Virtual"],
  installCost: 1,
  canUseCredits: function (doing, card) { return doing == "using" && !!attackedServer && !!card && CheckCardType(card, ["program"]); },
  responseOnRunnerDiscardEnds: {
    Enumerate: function () {
      if ((this.credits || 0) < 3) return [];
      return [{ tag: true, label: "Receber 1 tag para manter o Trickster Taka", button: "Receber 1 tag" }, { trash: true, label: "Lixar o Trickster Taka", button: "Lixar" }];
    },
    Resolve: function (params) {
      if (params.tag) AddTags(1);
      else Trash(this, false);
    },
    text: "Trickster Taka: 3 ou mais créditos no fim do turno",
  },
});

cardSet[33010] = {
  title: "The Twinning",
  imageFile: "33010.png",
  cardText: "The first time each turn you spend credits from an installed card, place 1 power counter on this resource. Whenever you breach HQ or R&D, you may remove up to 2 hosted power counters to access that many additional cards.",
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost: 3,
  unique: true,
  twinTurn: -1,
  twExtra: 0,
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (attackedServer != corp.HQ && attackedServer != corp.RnD) return [];
      var n = Counters(this, "power");
      if (n < 1) return [];
      var o = [{ x: 1, label: "Gastar 1 marcador: acessar +1 carta", button: "+1 acesso" }];
      if (n >= 2) o.push({ x: 2, label: "Gastar 2 marcadores: acessar +2 cartas", button: "+2 acessos" });
      o.push(JKR2Skip("Não usar"));
      return o;
    },
    Resolve: function (params) {
      if (!params.x) return;
      RemoveCounters(this, "power", params.x);
      this.twExtra = params.x;
    },
    text: "The Twinning: acessar cartas a mais?",
  },
  modifyBreachAccess: {
    Resolve: function () { return attackedServer == corp.HQ || attackedServer == corp.RnD ? this.twExtra : 0; },
  },
  responseOnRunEnds: { Resolve: function () { this.twExtra = 0; }, automatic: true },
};

// ------------------------------------------------------------ PROGRAMAS
cardSet[34004] = JackInBreaker({
  title: "Audrey v2",
  imageFile: "34004.png",
  cardText: "Whenever you trash a card you are accessing, place 1 virus counter on this program. Interface → Hosted virus counter: Break up to 2 subroutines. Trash 1 card from your grip: +3 strength.",
  faction: "Anarch",
  influence: 3,
  subTypes: ["Icebreaker", "AI", "Virus"],
  memoryCost: 2,
  installCost: 3,
  strength: 0,
});
cardSet[34004].abilities = [
  {
    text: "Gastar 1 marcador de vírus: quebrar até 2 subrotinas.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (!CheckStrength(this)) return [];
      if (!CheckUnbrokenSubroutines()) return [];
      if (!CheckCounters(this, "virus", 1)) return [];
      return [{}];
    },
    Resolve: function () {
      RemoveCounters(this, "virus", 1);
      JKR3BreakUpTo(2, "Audrey v2");
    },
  },
  {
    text: "Descartar 1 carta da mão: +3 de força.",
    Enumerate: function () {
      if (!CheckEncounter()) return [];
      if (CheckStrength(this)) return [];
      if (!CheckUnbrokenSubroutines()) return [];
      return JKR2Dedupe(runner.grip.map(function (c) { return { c: c, label: "Descartar " + c.title + ": +3 de força" }; }));
    },
    Resolve: function (params) {
      var self = this;
      Trash(params.c, false, function () { BoostStrength(self, 3); });
    },
  },
];

cardSet[35009] = JackInBreaker({
  title: "Rising Tide",
  imageFile: "35009.png",
  cardText: "This program gets +1 strength for each fracter in your heap. Interface → 1[c]: Break 1 barrier subroutine. 1[c]: +1 strength.",
  faction: "Anarch",
  influence: 2,
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 1,
  strength: 1,
  JackInStrengthMod: function () { return runner.heap.filter(function (c) { return CheckSubType(c, "Fracter"); }).length; },
});
cardSet[35009].abilities = [
  JackInBreakAbility("Barrier", 1),
  JackInBoostAbility("Barrier", 1, 1),
];

// a IA de Runner não sabe jogar estas cartas
[26075, 26069, 26070, 34003, 36003, 26007, 26073, 33010, 26009, 34004, 35009].forEach(function (id) {
  if (cardSet[id]) cardSet[id].jkNoAI = true;
});
