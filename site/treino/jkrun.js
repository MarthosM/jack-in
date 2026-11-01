// =====================================================================
// Jack In — Treino: caixa da run
// Durante uma run, uma caixa no meio da tela mostra a sequência da run, a ice da vez com as subrotinas,
// o rig do Runner com as habilidades que dá para usar agora, e os botões de ação (copiados do rodapé).
// A caixa é só uma camada de visual: toda ação passa pelos mesmos caminhos do motor (rodapé e escolhas).
// Licença: GPL-3.0.
// =====================================================================
var JKRun = { peek: false };

function JKRunActive() {
  try {
    return typeof attackedServer != "undefined" && attackedServer && currentPhase &&
      typeof currentPhase.identifier == "string" && /^Run/.test(currentPhase.identifier) &&
      !/^Run (6|ends|successful)/.test(currentPhase.identifier);
  } catch (e) { return false; }
}

// textos das habilidades em português (o que der para traduzir com segurança)
function JKRunPT(s) {
  if (typeof JKLang != "undefined" && JKLang == "en") {
    // em inglês: só os ícones viram símbolos
    return String(s || "").replace(/(\d)\[c\]/g, "$1¢").replace(/\[c\]/g, "1¢").replace(/\[click\]/g, "click").replace(/\[mu\]/g, "MU").replace(/\[trash\]/g, "trash");
  }
  return String(s || "")
    .replace(/(\d)\[c\]/g, "$1¢").replace(/\[c\]/g, "1¢").replace(/\[click\]/g, "clique").replace(/\[mu\]/g, "MU").replace(/\[trash\]/g, "lixar")
    .replace(/\bBreak up to (\d+)\b/g, "Quebrar até $1").replace(/\bBreak all\b/g, "Quebrar todas as").replace(/\bBreak\b/g, "Quebrar")
    .replace(/\bsubroutines\b/g, "subrotinas").replace(/\bsubroutine\b/g, "subrotina")
    .replace(/\bQuebrar (\d+|até \d+) (barrier|code gate|sentry) subrotinas?\b/g, function (m, n, t) { return "Quebrar " + n + (n == "1" ? " subrotina" : " subrotinas") + " de " + t; })
    .replace(/\+(\d+) strength\b/g, "+$1 de força").replace(/\bstrength\b/g, "força")
    .replace(/\bfor the remainder of this run\b/g, "até o fim da run").replace(/\bfor the remainder of this encounter\b/g, "até o fim do encontro")
    // habilidades de agendas pontuadas
    .replace(/^Search R&D for 1 card and reveal it\. Add it to HQ\.?$/i, "Gastar 1 marcador de agenda: procurar 1 carta no R&D, revelar e pôr no HQ")
    // escolhas de busca (Mutual Favor e parecidas)
    .replace(/^Add (.+) to grip$/i, "Pôr $1 na mão").replace(/^Add (.+) to HQ$/i, "Pôr $1 no HQ").replace(/^Install (.+)$/i, "Instalar $1")
    // subrotinas mais comuns
    .replace(/^End the run\.?$/i, "Termina a run.").replace(/\bEnd the run\b/g, "termina a run")
    .replace(/^The Runner loses clique, if able\.?$/i, "O Runner perde 1 clique, se puder.")
    .replace(/^Do (\d+) net damage\.?$/i, "Causa $1 de dano de rede.").replace(/^Do (\d+) meat damage\.?$/i, "Causa $1 de dano físico.")
    .replace(/^Do (\d+) core damage\.?$/i, "Causa $1 de dano cerebral.")
    .replace(/^Give the Runner (\d+) tags?\.?$/i, "O Runner recebe $1 tag.").replace(/^Gain (\d+)¢\.?$/i, "A Corp ganha $1¢.")
    .replace(/^Trash (\d+) installed program\.?$/i, "Lixa $1 programa instalado.").replace(/^The Runner loses (\d+)¢\.?$/i, "O Runner perde $1¢.");
}

function JKRunStepInfo() {
  var id = currentPhase.identifier;
  var where = "ice"; // ice | server | access
  if (/^Run (4\.6|5\.1)/.test(id)) where = "server";
  else if (/^Run (5\.2|Accessing)/.test(id)) where = "access";
  var sub = "";
  if (id == "Run 2.1") sub = "aproximação";
  else if (id == "Run 3.1") sub = "encontro";
  else if (id == "Run Subroutines") sub = "subrotinas disparando";
  else if (/^Run (EncounterEnd|4\.1|4\.3|4\.5)/.test(id)) sub = "passou";
  return { id: id, where: where, sub: sub };
}

function JKRunSequence(info) {
  var s = attackedServer, n = s.ice.length, steps = [];
  var meRunner = viewingPlayer == runner;
  steps.push({ k: "Início", v: "Run iniciada", st: "done" });
  for (var i = n - 1; i >= 0; i--) {
    var ice = s.ice[i];
    var known = ice.rezzed || (typeof PlayerCanLook == "function" && PlayerCanLook(viewingPlayer, ice));
    var name = known ? ice.title : "Ice não rezzada";
    var st = "next", v = name;
    if (info.where != "ice") st = "done";
    else if (i > approachIce) st = "done";
    else if (i == approachIce) {
      if (info.sub == "passou") { st = "done"; v = name + " · passou"; }
      else { st = "cur"; v = name + (info.sub ? " · " + info.sub : ""); }
    }
    steps.push({ k: (i == n - 1 ? "Ice de fora" : (i == 0 ? "Ice de dentro" : "Ice " + (n - i))), v: v, st: st });
  }
  steps.push({ k: "Servidor", v: info.where == "server" ? "Chegou ao servidor" : "Desconectar ou seguir", st: info.where == "server" ? "cur" : (info.where == "access" ? "done" : "next") });
  steps.push({ k: "Acesso", v: info.where == "access" ? "Acessando cartas" : "Ver as cartas", st: info.where == "access" ? "cur" : "next" });
  var liveIdx = steps.findIndex(function (x) { return x.st == "cur"; });
  if (liveIdx < 0) { // entre duas ices: a próxima é a "atual"
    var nx = steps.findIndex(function (x) { return x.st == "next"; });
    if (nx > -1) steps[nx].st = "cur";
  }
  return "<ol class='jkr-seq' aria-label='Sequência da run' style='grid-template-columns:repeat(" + steps.length + ",minmax(0,1fr))'>" +
    steps.map(function (x, k) {
      return "<li class='jkr-step jkr-" + x.st + "'" + (x.st == "cur" ? " aria-current='step'" : "") + "><span>" + (k + 1) + " · " + JKEsc(x.k) + "</span><b>" + (x.st == "done" ? "✓ " : "") + JKEsc(x.v) + "</b></li>";
    }).join("") + "</ol>";
}

function JKRunIcePanel(info) {
  var ice = GetApproachEncounterIce();
  if (info.where == "access" && typeof accessingCard != "undefined" && accessingCard) {
    return "<div class='jkr-main'><div class='jkr-card-col'>" + JKCard(accessingCard, { cls: "jkr-access", forceVisible: true }) + "</div>" +
      "<div class='jkr-subs'><h3>Acessando</h3><p class='jkr-note'>" + JKEsc(accessingCard.title) + ". Escolha o que fazer com a carta nos botões abaixo.</p></div></div>";
  }
  if (info.where != "ice" || !ice) {
    return "<div class='jkr-main jkr-main-empty'><p class='jkr-note'>" +
      (info.where == "server" ? "Você chegou ao servidor. Agora vem o acesso." : "Nenhuma ice pela frente.") + "</p></div>";
  }
  var visible = ice.rezzed || (typeof PlayerCanLook == "function" && PlayerCanLook(viewingPlayer, ice));
  var subs = "";
  if (visible && ice.subroutines && ice.subroutines.length) {
    var firing = info.id == "Run Subroutines" ? subroutine : -1;
    subs = ice.subroutines.map(function (s, k) {
      var cls = s.broken ? "jkr-sub-broken" : (k == firing ? "jkr-sub-firing" : "jkr-sub-live");
      var tag = s.broken ? "Quebrada" : (k == firing ? "Disparando" : "Ativa");
      return "<li class='jkr-sub " + cls + "'><span class='jkr-tag'>" + tag + "</span><span class='jkr-sub-t'>" + JKEsc(JKRunPT(s.text || "")) + "</span></li>";
    }).join("");
    subs = "<ul class='jkr-sublist'>" + subs + "</ul>";
  } else if (!visible) {
    subs = "<p class='jkr-note'>A ice ainda não foi rezzada: a Corp decide se rezza quando você encontrar com ela.</p>";
  } else subs = "<p class='jkr-note'>Esta ice não tem subrotinas.</p>";
  var str = "";
  if (visible) { try { str = (typeof JKLang != "undefined" && JKLang == "en" ? "Ice strength " : "Força da ice ") + Strength(ice); } catch (e) {} }
  return "<div class='jkr-main'><div class='jkr-card-col'>" + JKCard(ice, { cls: "jkr-ice jk-landscape" }) + "<small>Toque na carta para ver grande</small></div>" +
    "<div class='jkr-subs'><h3>Subrotinas <em>" + JKEsc(str) + "</em></h3>" + subs + "</div></div>";
}

// habilidades que o motor oferece agora (só para quem está jogando a vez)
function JKRunTriggers() {
  if (typeof activePlayer == "undefined" || activePlayer !== viewingPlayer) return [];
  if (!phaseOptions || !phaseOptions.trigger || !phaseOptions.trigger.length) return [];
  return phaseOptions.trigger.map(function (o, k) { return { o: o, k: k }; });
}
function JKRunTrigBtn(t) {
  var lbl = t.o.label || (t.o.ability && t.o.ability.text) || (t.o.card ? t.o.card.title : "Usar");
  lbl = String(lbl).replace(/^\([^)]*\)\s*/, ""); // o nome da carta já aparece no card
  return "<button type='button' class='jkr-btn jkr-trig' data-jk-trig='" + t.k + "'>" + JKEsc(JKRunPT(lbl)) + "</button>";
}

function JKRunRig() {
  var trig = JKRunTriggers();
  var used = {};
  var progs = runner.rig.programs || [];
  var ice = GetApproachEncounterIce();
  var cards = progs.map(function (c) {
    var mine = trig.filter(function (t) { return t.o.card === c; });
    mine.forEach(function (t) { used[t.k] = 1; });
    var hint = "";
    if (!mine.length && ice && ice.rezzed && c.subTypes && c.subTypes.indexOf("Icebreaker") > -1) hint = "<small>Nada a fazer agora</small>";
    // força aumentada vale só até o fim do encontro com esta ice (regra padrão dos quebra-gelos)
    var boost = c.strengthBoost > 0 ? "<small class='jkr-boost'>+" + c.strengthBoost + " de força só neste encontro</small>" : "";
    return { c: c, html: "<div class='jkr-prog" + (mine.length ? " jkr-on" : " jkr-off") + "'>" + JKCard(c, { forceVisible: true }) + boost +
      (mine.length ? "<div class='jkr-acts'>" + mine.map(JKRunTrigBtn).join("") + "</div>" : hint) + "</div>", on: mine.length };
  });
  cards.sort(function (a, b) { return b.on - a.on; }); // primeiro o que serve agora
  var others = trig.filter(function (t) { return !used[t.k]; });
  var chips = [].concat(runner.rig.hardware || [], runner.rig.resources || []).map(function (c) {
    return "<button type='button' class='jkr-chip' data-jk-show=\"" + JKEsc(c.title) + "\">" + JKEsc(c.title) + (c.credits ? " · " + c.credits + "¢" : "") + "</button>";
  }).join("");
  return "<div class='jkr-rig'><div class='jkr-rig-h'><h3>Rig do Runner</h3><span>" +
    (trig.length ? "O que dá para usar agora vem primeiro e fica aceso" : (viewingPlayer == runner ? "Nada para usar neste momento" : "")) + "</span></div>" +
    "<div class='jkr-rig-row'>" + (cards.length ? cards.map(function (x) { return x.html; }).join("") : "<p class='jkr-note'>Nenhum programa instalado.</p>") +
    "<div class='jkr-side'>" + (others.length ? "<h4>Outras habilidades</h4><div class='jkr-acts'>" + others.map(JKRunTrigBtn).join("") + "</div>" : "") +
    (chips ? "<h4>Hardware e recursos</h4><div class='jkr-chips'>" + chips + "</div>" : "") + "</div></div></div>";
}

// resumo que fica alguns segundos na tela quando a run termina (runs rápidas não somem sem explicação)
// fim da run: com sucesso, um resumo pequeno que some sozinho; sem sucesso, a caixa fica aberta mostrando
// a última situação (a ice e a subrotina que encerrou a run) até o jogador clicar em Fechar
// linhas do log desde a posição "start" (contada pelo JK.logTotal, que não é afetado pelo corte em 200 linhas)
function JKLogSince(start) {
  var n = (JK.logTotal || 0) - start;
  if (n <= 0) return [];
  return JK.log.slice(Math.max(0, JK.log.length - n));
}
function JKRunEndReason(lines) {
  for (var i = lines.length - 1; i >= 0; i--) {
    var m = /^Firing "(.+)" on (.+?) protecting /.exec(lines[i]);
    if (m) return "A run foi encerrada pela ice " + m[2] + ": " + JKRunPT(m[1].replace(/\[click\]/g, "[click]"));
    if (/jacked out/i.test(lines[i])) return "Você desconectou (jack out).";
  }
  return "A run terminou sem sucesso.";
}
// a última ice encontrada, com as subrotinas que dispararam marcadas
function JKRunEndView(lines) {
  var ice = JKRun.lastEncIce;
  if (!ice) return "";
  var fired = [];
  lines.forEach(function (l) {
    var m = /^Firing "(.+)" on (.+?) protecting /.exec(l);
    if (m && m[2] == ice.title) fired.push(m[1]);
  });
  var subs = (ice.subroutines || []).map(function (sb) {
    var didFire = fired.indexOf(sb.text) > -1;
    var cls = sb.broken ? "jkr-sub-broken" : (didFire ? "jkr-sub-live" : "jkr-sub-idle");
    var tag = sb.broken ? "Quebrada" : (didFire ? "Disparou" : "Não disparou");
    return "<li class='jkr-sub " + cls + "'><span class='jkr-tag'>" + tag + "</span><span class='jkr-sub-t'>" + JKEsc(JKRunPT(sb.text || "")) + "</span></li>";
  }).join("");
  return (JKRun.lastEncSeq || "") + "<div class='jkr-main'><div class='jkr-card-col'>" + JKCard(ice, { cls: "jkr-ice jk-landscape", forceVisible: true }) + "</div>" +
    "<div class='jkr-subs'><h3>Subrotinas de " + JKEsc(ice.title) + "</h3><ul class='jkr-sublist'>" + subs + "</ul></div></div>";
}
function JKRunSummaryHTML() {
  var e = JKRun.ended;
  if (!e || e.closed) return "";
  if (e.ok && Date.now() - e.at > 6000) return "";
  var log = e.lines.length ? "<ol class='jkr-sum'>" + e.lines.map(function (l) { return "<li>" + JKEsc(l) + "</li>"; }).join("") + "</ol>" : "";
  var head = "<div class='jkr-head'><span class='jkr-badge'>RUN</span><h2>" + JKEsc(e.name) + "</h2><span class='jkr-result'>" + (e.ok ? "Run com sucesso" : "Run sem sucesso") + "</span><span class='jkr-grow'></span>" +
    "<button type='button' class='jkr-btn jkr-primary' data-jk-close='1'>Fechar</button></div>";
  if (e.ok) return "<section id='jk-runbox' class='jkr-summary jkr-ok' aria-label='Fim da run'>" + head + log + "</section>";
  return "<section id='jk-runbox' class='jkr-summary jkr-fail jkr-ended' aria-label='Fim da run'>" + head +
    "<p class='jkr-reason'>" + JKEsc(e.reason) + "</p>" + (e.view || "") + log + "</section>";
}
function JKRunHTML() {
  if (!JKRunActive()) {
    if (JKRun.cur) {
      var lines = JKLogSince(JKRun.cur.logStart);
      var ok = lines.some(function (l) { return /Run successful/i.test(l); });
      JKRun.ended = { name: JKRun.cur.name, at: Date.now(), ok: ok, lines: lines.slice(-6), view: ok ? "" : JKRunEndView(lines), reason: ok ? "" : JKRunEndReason(lines) };
      JKRun.lastEncSeq = null; JKRun.lastEncIce = null;
      JKRun.cur = null;
      if (ok) setTimeout(function () { if (typeof JKSchedule == "function") JKSchedule(); }, 6100);
    }
    return JKRunSummaryHTML();
  }
  var info = JKRunStepInfo();
  var name = ServerName(attackedServer);
  if (!JKRun.cur || JKRun.cur.server !== attackedServer) JKRun.cur = { server: attackedServer, name: name, logStart: JKRun.logStart != null ? JKRun.logStart : Math.max(0, (JK.logTotal || 0) - 3) };
  JKRun.ended = null;
  var head = "<div class='jkr-head'><span class='jkr-badge'>RUN</span><h2>" + JKEsc(name) + "</h2><span class='jkr-dim'>" +
    attackedServer.ice.length + (attackedServer.ice.length == 1 ? " ice protegendo" : " ices protegendo") + "</span><span class='jkr-grow'></span>" +
    JKStat("Créditos", runner.creditPool + (runner.temporaryCredits > 0 ? " <small class='jk-temp' title='Créditos da bad publicity: só valem nesta run'>+" + runner.temporaryCredits + " BP</small>" : ""), "jk-big jkr-cr") + JKStat("Cliques", runner.clickTracker) +
    "<button type='button' class='jkr-peek-btn' data-jk-peek='1'>Ver a mesa</button></div>";
  var view = JKRunSequence(info) + JKRunIcePanel(info);
  // guarda a sequência do último encontro com ice, para mostrar no fim se a run terminar sem sucesso
  if (info.where == "ice" && (info.sub == "encontro" || info.sub == "subrotinas disparando")) {
    JKRun.lastEncSeq = JKRunSequence(info);
    JKRun.lastEncIce = GetApproachEncounterIce();
  }
  var body = head + view + JKRunRig() +
    "<div class='jkr-foot'><span class='jkr-hint'></span><div class='jkr-proxy'></div></div>";
  return "<section id='jk-runbox' class='" + (JKRun.peek ? "jkr-peek" : "") + "' aria-label='Caixa da run'>" + body + "</section>" +
    "<button type='button' id='jk-runpill' data-jk-peek='0'>Voltar à run em " + JKEsc(name) + "</button>";
}

// copia os botões do rodapé para dentro da caixa (no anfitrião e no convidado; o rodapé continua sendo a fonte)
function JKRunTrigCount() {
  // mesma visão que a mesa usa ao desenhar (no anfitrião do X1, o lado de quem está nesta tela)
  var me = typeof X1 != "undefined" && X1.role == "host" && X1.started ? X1.mySide() : null;
  var save = viewingPlayer;
  if (me) viewingPlayer = me;
  try { return JKRunTriggers().length; } finally { if (me) viewingPlayer = save; }
}
// escolhas abertas (qual subrotina quebrar, Mutual Favor...): traduz os textos simples, dentro ou fora da run
function JKModalPT() {
  $("#modalcontent p, #modalcontent span, #modalcontent button").each(function () {
    if (this.children.length) return;
    var t = this.textContent, pt = JKRunPT(t);
    if (pt !== t) this.textContent = pt;
  });
}
function JKRunSync() {
  JKModalPT();
  var $box = $("#jk-runbox");
  var guest = typeof X1 != "undefined" && X1.role == "guest";
  if (!guest && typeof JKRender == "function") {
    // o motor mudou as opções depois do último desenho da mesa: redesenha (caixa aparece, some ou ganha botões)
    var want = JKRunActive(), has = $box.length > 0 && !$box.hasClass("jkr-summary");
    if (want != has || (has && JKRunTrigCount() != $box.find("[data-jk-trig]").length)) {
      if ((JKRun.redraws = (JKRun.redraws || 0) + 1) < 5) { JKRender(); return; }
    } else JKRun.redraws = 0;
  }
  if (!$box.length) { JKRun.peek = false; return; }
  var $proxy = $box.find(".jkr-proxy"), $hint = $box.find(".jkr-hint");
  var hasTrigBtns = $box.find("[data-jk-trig]").length > 0;
  var html = "";
  $("#footer button").each(function () {
    var id = this.id;
    if (!id || this.style.display == "none") return;
    if (id == "footerbutton-trigger" && hasTrigBtns) return; // as habilidades já estão nos cards do rig
    if (id == "autocontinue") return;
    var primary = /footerbutton-(n|continue)$|resolvechoice-/.test(id);
    html += "<button type='button' class='jkr-btn" + (primary ? " jkr-primary" : "") + "' data-jk-proxy='" + id + "'>" + JKEsc($(this).text().trim()) + "</button>";
  });
  var h = $("#footer h2").first().text().trim();
  var HPT = { "Access cards": "Escolha a carta para acessar", "Drag to your heap": "Escolha a carta para o heap", "Drag to your stack": "Escolha a carta para o baralho" };
  if (HPT[h] && !(typeof JKLang != "undefined" && JKLang == "en")) h = HPT[h];
  if (!html && !hasTrigBtns) h = h || (typeof activePlayer != "undefined" && activePlayer && activePlayer.AI ? (activePlayer == corp ? "A Corp está decidindo…" : "O Runner está decidindo…") : "Aguardando…");
  // compara com o último conteúdo escrito (a caixa fica dentro da mesa observada: reescrever à toa vira um laço)
  if ($proxy.attr("data-sig") !== html) $proxy.attr("data-sig", html).html(html);
  if (typeof JKT == "function") h = JKT(h); // compara já no idioma da tela (evita reescrever sem parar)
  if ($hint.text() !== h) $hint.text(h);

}

(function () {
  if (typeof JKBoardHTML != "function") return;
  var _B = JKBoardHTML;
  JKBoardHTML = function () { return _B.apply(this, arguments) + JKRunHTML(); };

  $(function () {
    var t = null;
    var later = function () { clearTimeout(t); t = setTimeout(JKRunSync, 30); };
    var obs = new MutationObserver(later);
    ["footer", "jk-board", "modalcontent"].forEach(function (id) {
      var wait = setInterval(function () {
        var el = document.getElementById(id);
        if (!el) return;
        clearInterval(wait);
        obs.observe(el, { childList: true, subtree: true, characterData: true });
      }, 200);
    });
    $(document).on("click", "[data-jk-proxy]", function (e) {
      e.stopPropagation();
      var b = document.getElementById($(this).attr("data-jk-proxy"));
      if (b) b.click();
    });
    $(document).on("click", "[data-jk-peek]", function (e) {
      e.stopPropagation();
      JKRun.peek = $(this).attr("data-jk-peek") == "1";
      $("#jk-runbox").toggleClass("jkr-peek", JKRun.peek);
    });
    $(document).on("click", "[data-jk-close]", function (e) {
      e.stopPropagation();
      if (JKRun.ended) JKRun.ended.closed = true;
      $("#jk-runbox.jkr-summary").remove();
    });
    $(document).on("click", "[data-jk-show]", function (e) {
      e.stopPropagation();
      if (typeof RevealShowCard == "function") RevealShowCard($(this).attr("data-jk-show"));
    });
    $(document).on("click", "[data-jk-trig]", function (e) {
      e.stopPropagation();
      var k = parseInt($(this).attr("data-jk-trig"), 10);
      if (typeof X1 != "undefined" && X1.role == "guest") {
        if (typeof X1Send == "function") X1Send({ t: "act", kind: "trig", k: k, seq: X1.seq });
        return;
      }
      JKRunTrigger(k);
    });
  });
})();

// depois de uma escolha o motor só recalcula as opções no próximo passo (mainLoopDelay):
// um clique nesse intervalo usaria opções velhas, então é ignorado e a caixa é redesenhada
(function () {
  if (typeof ResolveChoice != "function") return;
  var _RC = ResolveChoice;
  ResolveChoice = function () { JKRun.lastResolve = Date.now(); return _RC.apply(this, arguments); };
})();
// ---------------------------------------------------------------- ações pela janela da carta
// Opções que o motor oferece agora para uma carta (pelo título; "hand" = na mão, "table" = na mesa).
// Cópias iguais na mão são equivalentes: fica uma opção por ação.
function JKCardOpts(title, loc) {
  var out = [];
  try {
    if (typeof activePlayer == "undefined" || !activePlayer || activePlayer.AI != null || activePlayer !== viewingPlayer) return out;
    if (!phaseOptions) return out;
    var cmds = loc == "hand" ? ["play", "install"] : ["trigger", "rez", "advance", "score", "trash"];
    var seen = {};
    cmds.forEach(function (cmd) {
      (phaseOptions[cmd] || []).forEach(function (o, k) {
        if (!o || !o.card || o.card.title !== title) return;
        var inHand = PlayerHand(o.card.player || activePlayer).indexOf(o.card) > -1;
        if ((loc == "hand") !== inHand) return;
        var c = o.card, lbl = "";
        if (cmd == "play") lbl = "Jogar" + (c.playCost ? " · " + c.playCost + "¢" : "");
        else if (cmd == "install") {
          if (c.player == corp) lbl = o.server ? "Instalar em " + ServerName(o.server) : "Instalar num servidor novo";
          else lbl = (o.host ? "Instalar em " + o.host.title : "Instalar") + (c.installCost ? " · " + c.installCost + "¢" : "");
        }
        else if (cmd == "trigger") lbl = "Usar: " + JKRunPT(String(o.label || (o.ability && o.ability.text) || "habilidade").replace(/^\([^)]*\)\s*/, ""));
        else if (cmd == "rez") lbl = "Rezzar" + (c.rezCost ? " · " + c.rezCost + "¢" : "");
        else if (cmd == "advance") lbl = "Avançar · 1¢";
        else if (cmd == "score") lbl = "Pontuar";
        else if (cmd == "trash") lbl = "Lixar";
        var key = cmd + "|" + lbl;
        if (seen[key]) return;
        seen[key] = 1;
        out.push({ title: title, loc: loc, cmd: cmd, k: k, label: lbl });
      });
    });
  } catch (e) {}
  return out;
}
// todas as opções por carta (vai na visão do convidado do X1)
function JKAllCardOpts() {
  var all = [], done = {};
  ["play", "install", "trigger", "rez", "advance", "score", "trash"].forEach(function (cmd) {
    ((typeof phaseOptions != "undefined" && phaseOptions && phaseOptions[cmd]) || []).forEach(function (o) {
      if (!o || !o.card) return;
      var inHand = PlayerHand(o.card.player || activePlayer).indexOf(o.card) > -1;
      var key = o.card.title + "|" + inHand;
      if (done[key]) return;
      done[key] = 1;
      all = all.concat(JKCardOpts(o.card.title, inHand ? "hand" : "table"));
    });
  });
  return all;
}
function JKOptRun(cmd, k) {
  var gap = (typeof mainLoopDelay == "number" ? mainLoopDelay : 350) + 80;
  if (JKRun.lastResolve && Date.now() - JKRun.lastResolve < gap) { JKSchedule(); return false; }
  var o = ((typeof phaseOptions != "undefined" && phaseOptions && phaseOptions[cmd]) || [])[k];
  if (!o) { JKSchedule(); return false; }
  ExecuteChosen(cmd);
  var i = validOptions.indexOf(o);
  if (i > -1) ResolveChoice(i);
  return true;
}

function JKRunTrigger(k) {
  var gap = (typeof mainLoopDelay == "number" ? mainLoopDelay : 350) + 80;
  if (JKRun.lastResolve && Date.now() - JKRun.lastResolve < gap) { JKSchedule(); return false; }
  var opts = (typeof phaseOptions != "undefined" && phaseOptions && phaseOptions.trigger) || [];
  var o = opts[k];
  if (!o) { JKSchedule(); return false; }
  ExecuteChosen("trigger");
  var i = validOptions.indexOf(o);
  if (i > -1) ResolveChoice(i);
  return true;
}

// nova run: a caixa abre de novo, mesmo que a anterior tenha sido minimizada
(function () {
  if (typeof MakeRun != "function") return;
  var _MR = MakeRun;
  MakeRun = function () { JKRun.peek = false; JKRun.cur = null; JKRun.ended = null; JKRun.logStart = JK.logTotal || 0; return _MR.apply(this, arguments); };
})();
