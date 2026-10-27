// =====================================================================
// Jack In — Treino: registro da sessão para análise de erros
// Grava erros, o registro da partida, mudanças de fase e um "batimento" a cada 30 s.
// No executável, envia tudo para a pasta "logs" ao lado do programa (POST /log).
// Em qualquer versão, o menu tem "Salvar log da sessão" (baixa um .txt).
// Licença: GPL-3.0.
// =====================================================================
var JKLOG = {
  id: (function () {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  })(),
  all: [],      // tudo desde o início da página (para o botão de salvar)
  queue: [],    // ainda não enviado ao executável
  server: true, // vira false se o /log não existir (versão web)
  lastPhase: "",
};

function JKLogTime() {
  var d = new Date();
  function p(n) { return (n < 10 ? "0" : "") + n; }
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}
function JKLogAdd(kind, text) {
  var line = JKLogTime() + " [" + kind + "] " + String(text).replace(/\s+/g, " ").slice(0, 2000);
  JKLOG.all.push(line);
  if (JKLOG.all.length > 20000) JKLOG.all.splice(0, 5000);
  if (JKLOG.server) JKLOG.queue.push(line);
}
function JKLogState() {
  try {
    var s = "fase=" + (currentPhase ? currentPhase.identifier + " (" + currentPhase.title + ")" : "?") +
      " vez=" + (activePlayer == corp ? "Corp" : "Runner") + (activePlayer && activePlayer.AI ? "(IA)" : "(humano)") +
      " turno=" + (playerTurn == corp ? "Corp" : "Runner") +
      " | Corp " + corp.creditPool + "¢ " + corp.clickTracker + "cl " + AgendaPoints(corp) + "pts HQ" + corp.HQ.cards.length + " R&D" + corp.RnD.cards.length +
      " | Runner " + runner.creditPool + "¢ " + runner.clickTracker + "cl " + AgendaPoints(runner) + "pts mão" + runner.grip.length + " tags" + runner.tags;
    if (typeof Physical != "undefined") s += " | pendentes=" + Physical.pending.length;
    if (typeof JKWatch != "undefined") s += " ia_em_calculo=" + JKWatch.inflight + " vigia=" + JKWatch.kicks;
    return s;
  } catch (e) { return "estado indisponível: " + e; }
}
function JKLogFlush(final) {
  if (!JKLOG.server || !JKLOG.queue.length) return;
  var body = JKLOG.queue.join("\n") + "\n";
  JKLOG.queue = [];
  var url = "log?s=" + JKLOG.id;
  try {
    if (final && navigator.sendBeacon) { navigator.sendBeacon(url, body); return; }
    fetch(url, { method: "POST", body: body, keepalive: true }).then(function (r) {
      if (!r.ok) JKLOG.server = false;
    }).catch(function () {});
  } catch (e) {}
}
function JKLogDownload() {
  JKLogAdd("estado", JKLogState());
  var blob = new Blob([JKLOG.all.join("\r\n") + "\r\n"], { type: "text/plain;charset=utf-8" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "jackin-treino-log-" + JKLOG.id + ".txt";
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---- captura
window.addEventListener("error", function (e) {
  JKLogAdd("ERRO", (e.message || "erro") + " @ " + (e.filename || "").split("/").pop() + ":" + (e.lineno || "") + (e.error && e.error.stack ? " | " + e.error.stack : ""));
  JKLogAdd("estado", JKLogState());
  JKLogFlush();
});
window.addEventListener("unhandledrejection", function (e) {
  var r = e.reason;
  JKLogAdd("ERRO", "promessa rejeitada: " + (r && r.stack ? r.stack : r));
  JKLogAdd("estado", JKLogState());
  JKLogFlush();
});
(function () {
  var _err = console.error, _warn = console.warn;
  console.error = function () {
    try { JKLogAdd("console.error", Array.prototype.map.call(arguments, function (a) { return a && a.stack ? a.stack : (typeof a == "object" ? JSON.stringify(a) : a); }).join(" ")); } catch (e) {}
    return _err.apply(this, arguments);
  };
  console.warn = function () {
    try { JKLogAdd("aviso", Array.prototype.join.call(arguments, " ")); } catch (e) {}
    return _warn.apply(this, arguments);
  };
  if (typeof Log == "function") {
    var _Log = Log;
    Log = function (src) {
      try { if (typeof src == "string" && src.indexOf("SPOILER") < 0) JKLogAdd("jogo", src.replace(/<[^>]+>/g, "")); } catch (e) {}
      return _Log.apply(this, arguments);
    };
  }
  if (typeof LogError == "function") {
    var _LogError = LogError;
    LogError = function (src) {
      try { JKLogAdd("ERRO", "LogError: " + (src && src.stack ? src.stack : src)); } catch (e) {}
      return _LogError.apply(this, arguments);
    };
  }
  if (typeof ChangePhase == "function") {
    var _CP = ChangePhase;
    ChangePhase = function (phase) {
      var r = _CP.apply(this, arguments);
      try {
        var id = currentPhase ? currentPhase.identifier + " (" + currentPhase.title + ")" : "";
        if (id && id != JKLOG.lastPhase) { JKLOG.lastPhase = id; JKLogAdd("fase", id); }
      } catch (e) {}
      return r;
    };
  }
  if (typeof PlayerWin == "function") {
    var _PW = PlayerWin;
    PlayerWin = function (player, msg) {
      JKLogAdd("FIM", (player == corp ? "Corp venceu" : "Runner venceu") + " — " + msg);
      JKLogAdd("estado", JKLogState());
      JKLogFlush();
      return _PW.apply(this, arguments);
    };
  }
})();

JKLogAdd("início", "Jack In Treino — página " + location.pathname.split("/").pop() + " | " + navigator.userAgent);
try {
  var jp = sessionStorage.getItem("jackin-params");
  if (jp) JKLogAdd("início", "lado=" + (JSON.parse(jp).p == "c" ? "Corp" : "Runner"));
} catch (e) {}
setInterval(function () { JKLogAdd("batimento", JKLogState()); }, 30000);
setInterval(function () { JKLogFlush(); }, 5000);
window.addEventListener("pagehide", function () { JKLogAdd("fim", "página fechada ou recarregada"); JKLogAdd("estado", JKLogState()); JKLogFlush(true); });
document.addEventListener("visibilitychange", function () { JKLogAdd("janela", document.hidden ? "aba escondida/minimizada" : "aba visível"); });

$(function () {
  var $b = $("<button class='button' type='button'>Salvar log da sessão</button>").on("click", JKLogDownload);
  $("#editdeck").after($b);
});
