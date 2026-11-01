// =====================================================================
// Jack In — idioma do site (português / inglês)
// As páginas são escritas em português. Em inglês, esta camada troca os textos que aparecem na tela
// (inclusive os que o jogo escreve depois) usando o dicionário JKI18N_DATA, gerado a partir das páginas.
// A escolha fica salva no navegador ("jackin-lang") e vale para a mesa da câmera e para o treino.
// Licença: GPL-3.0.
// =====================================================================
var JKLang = (function () {
  var l = "pt";
  try {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "pt" || q === "en") localStorage.setItem("jackin-lang", q);
    l = localStorage.getItem("jackin-lang") || "pt";
  } catch (e) {}
  return l === "en" ? "en" : "pt";
})();

var JKI18N = { exact: {}, tpl: [], frag: [], ready: false };

function JKI18NInit() {
  if (JKI18N.ready || typeof JKI18N_DATA == "undefined") return;
  JKI18N.ready = true;
  var esc = function (s) { return s.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&"); };
  JKI18N_DATA.forEach(function (e) {
    var pt = e[0], en = e[1], kind = e[2];
    if (kind == "tpl") {
      // padrões genéricos demais (ex.: "{0} de {1}") pegariam qualquer frase: ficam de fora
      if (pt.replace(/\{\d+\}/g, "").replace(/[^A-Za-zÀ-ú]/g, "").length < 4) return;
      // {0} {1}... viram grupos de captura
      var parts = pt.split(/\{(\d+)\}/), re = "^", order = [];
      for (var i = 0; i < parts.length; i++) {
        if (i % 2 == 0) re += esc(parts[i]);
        else { re += "(.+?)"; order.push(+parts[i]); }
      }
      re += "$";
      try { JKI18N.tpl.push({ re: new RegExp(re), order: order, en: en }); } catch (err) {}
    } else if (kind == "frag") {
      // só pedaços com texto suficiente (pedaços curtos como " de " estragariam outras frases)
      if (pt.trim().length >= 6 && /\s/.test(pt.trim())) JKI18N.frag.push([pt, en]);
      JKI18N.exact[pt] = en;
    } else JKI18N.exact[pt] = en;
  });
  JKI18N.frag.sort(function (a, b) { return b[0].length - a[0].length; });
}

// tradução de um texto (mantém os espaços em volta)
function JKT(s) {
  if (JKLang != "en" || s == null) return s;
  JKI18NInit();
  var str = String(s);
  var key = str.replace(/\s+/g, " ").trim();
  if (!key) return str;
  var lead = str.match(/^\s*/)[0], trail = str.match(/\s*$/)[0];
  var hit = JKI18N.exact[key];
  if (hit != null) return lead + hit + trail;
  for (var i = 0; i < JKI18N.tpl.length; i++) {
    var t = JKI18N.tpl[i], m = t.re.exec(key);
    if (m) {
      var out = t.en.replace(/\{(\d+)\}/g, function (_, n) {
        var k = t.order.indexOf(+n);
        if (k < 0) return "";
        var cap = m[k + 1], tr = JKI18N.exact[cap];
        return tr != null ? tr : cap; // o pedaço variável também é traduzido, se for um texto conhecido
      });
      return lead + out + trail;
    }
  }
  // pedaços de frases montadas com nomes de cartas ou números
  if (/[À-ú]|\b(de|da|do|para|não|mão|ou|em|no|na)\b/i.test(key)) {
    var changed = key;
    for (var j = 0; j < JKI18N.frag.length; j++) {
      var f = JKI18N.frag[j];
      if (changed.indexOf(f[0]) > -1) changed = changed.split(f[0]).join(f[1]);
    }
    if (changed !== key) return lead + changed + trail;
  }
  return str;
}

(function () {
  if (JKLang != "en") return;
  try { document.documentElement.lang = "en"; } catch (e) {}
  var ATTRS = ["title", "placeholder", "aria-label", "alt"];
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  function doText(n) {
    if (!n.nodeValue || n.__jkEN === n.nodeValue) return;
    var p = n.parentNode;
    if (!p || SKIP[p.nodeName] || (p.isContentEditable)) return;
    var t = JKT(n.nodeValue);
    if (t !== n.nodeValue) n.nodeValue = t;
    n.__jkEN = n.nodeValue;
  }
  function doEl(el) {
    if (el.nodeType != 1 || SKIP[el.nodeName]) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a) { var t = JKT(a); if (t !== a) el.setAttribute(ATTRS[i], t); }
    }
    if (el.nodeName == "INPUT" && /^(button|submit)$/i.test(el.type) && el.value) { var v = JKT(el.value); if (v !== el.value) el.value = v; }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType == 3) { doText(root); return; }
    if (root.nodeType != 1 && root.nodeType != 9 && root.nodeType != 11) return;
    if (root.nodeType == 1) { if (SKIP[root.nodeName]) return; doEl(root); }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) { if (n.nodeType == 3) doText(n); else doEl(n); }
  }
  var queue = [], sched = false;
  function flush() {
    sched = false;
    var q = queue; queue = [];
    for (var i = 0; i < q.length; i++) walk(q[i]);
  }
  function push(n) { queue.push(n); if (!sched) { sched = true; (window.requestAnimationFrame || setTimeout)(flush); } }
  function start() {
    JKI18NInit();
    document.title = JKT(document.title);
    walk(document.body);
    // traduz já na mesma rodada da mudança (antes de a tela ser pintada), sem piscar em português
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type == "characterData" || m.type == "attributes") walk(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // flush imediato também depois de cada tarefa (toasts e janelas aparecem já traduzidos)
    setInterval(function () { if (queue.length) flush(); }, 120);
  }
  if (document.readyState == "loading") document.addEventListener("DOMContentLoaded", start); else start();
  // diálogos do navegador
  var _alert = window.alert, _confirm = window.confirm, _prompt = window.prompt;
  window.alert = function (m) { return _alert.call(window, JKT(m)); };
  window.confirm = function (m) { return _confirm.call(window, JKT(m)); };
  window.prompt = function (m, d) { return _prompt.call(window, JKT(m), d); };
})();

// botão PT | EN (páginas iniciais)
function JKLangToggle(opts) {
  opts = opts || {};
  if (document.getElementById("jk-lang")) return;
  var css = "#jk-lang{position:fixed;z-index:963;top:7px;right:" + (opts.right || 60) + "px;display:flex;border:1px solid #28465f;border-radius:8px;overflow:hidden;font:600 12px 'Chakra Petch','IBM Plex Sans',system-ui,sans-serif;letter-spacing:.06em}" +
    "#jk-lang button{all:unset;cursor:pointer;padding:0 11px;height:36px;line-height:36px;color:#8da0b6;background:#132435}" +
    "#jk-lang button[aria-pressed=true]{background:#5fd3ff;color:#04121c}" +
    "#jk-lang button:focus-visible{outline:2px solid #fff;outline-offset:-2px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  var w = document.createElement("div");
  w.id = "jk-lang"; w.setAttribute("role", "group"); w.setAttribute("aria-label", "Idioma / Language");
  ["pt", "en"].forEach(function (l) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = l.toUpperCase();
    b.setAttribute("aria-pressed", JKLang == l ? "true" : "false");
    b.setAttribute("lang", l);
    b.title = l == "pt" ? "Português" : "English";
    b.addEventListener("click", function () {
      if (JKLang == l) return;
      try { localStorage.setItem("jackin-lang", l); } catch (e) {}
      var u = new URL(location.href); u.searchParams.delete("lang"); location.href = u.toString();
    });
    w.appendChild(b);
  });
  document.body.appendChild(w);
}
