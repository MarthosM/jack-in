// Jack In — Treino: leitura da lista exportada do NetrunnerDB (texto) → ids do motor.
// Usado pela abertura (index.html) e pela sala do convidado (sala.html). Licença: GPL-3.0.
var DeckList = { ready: false, cards: null, byName: {} };
(function () {
  var norm = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[“”"']/g, "").replace(/\s+/g, " ").trim().toLowerCase(); };
  DeckList.norm = norm;
  fetch("cards.json").then(function (r) { return r.json(); }).then(function (d) {
    DeckList.cards = d;
    for (var id in d) {
      var c = d[id], n = norm(c.t);
      if (!DeckList.byName[n]) DeckList.byName[n] = id;
      if (c.ty === "identity") { var short = norm(c.t.split(":")[0]); if (!DeckList.byName[short]) DeckList.byName[short] = id; }
    }
    DeckList.ready = true;
    if (typeof DeckList.onReady == "function") DeckList.onReady();
  });

  DeckList.parse = function (text, side) {
    var CARDS = DeckList.cards, byName = DeckList.byName;
    var ids = [], identity = null, unknown = [], wrongSide = [], first = true;
    text.split(/\r?\n/).forEach(function (raw) {
      var wasFirst = first && raw.trim() !== "";
      if (raw.trim() !== "") first = false;
      var line = raw.replace(/\(.*?\)/g, "").replace(/[•●★☆]+/g, "").trim();
      if (!line || /^#|^(event|hardware|resource|program|agenda|asset|upgrade|operation|ice|barrier|code gate|sentry|icebreaker|cards?|deck|total|influence|identity)\b.*\(?\d*\)?\s*:?$/i.test(line)) return;
      var qty = 1, m;
      if ((m = line.match(/^(\d+)\s*x?\s+(.+)$/i))) { qty = +m[1]; line = m[2]; }
      else if ((m = line.match(/^(.+?)\s+x\s*(\d+)$/i))) { qty = +m[2]; line = m[1]; }
      if (/influence|spent|agenda points|^cards\b|decklist|netrunnerdb/i.test(line)) return;
      var id = byName[norm(line)];
      if (!id && wasFirst) return;
      if (!id) { if (line.length > 2 && !/^\d+ (cards|influence)/i.test(line)) unknown.push(line); return; }
      var c = CARDS[id];
      if (c.s !== side) { wrongSide.push(c.t); return; }
      if (c.ty === "identity") { identity = +id; return; }
      for (var i = 0; i < qty; i++) ids.push(+id);
    });
    return { identity: identity, ids: ids, unknown: unknown, wrongSide: wrongSide };
  };

  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  DeckList.report = function (el, r, side) {
    var CARDS = DeckList.cards;
    var idName = r.identity ? CARDS[r.identity].t : null;
    var min = idName ? CARDS[r.identity].ds : (side === "r" ? 40 : 45);
    var h = idName ? "<div class='ok'>Identidade: " + esc(idName) + "</div>" : "<div class='err'>Identidade não encontrada</div>";
    h += "<div class='" + (r.ids.length >= min ? "ok" : "warn") + "'>" + r.ids.length + " cartas reconhecidas (mínimo " + min + ")</div>";
    if (r.unknown.length) h += "<div class='err'>Fora do pool ou não reconhecidas:<ul>" + r.unknown.map(function (u) { return "<li>" + esc(u) + "</li>"; }).join("") + "</ul></div>";
    if (r.wrongSide.length) h += "<div class='warn'>Cartas do outro lado ignoradas: " + esc(r.wrongSide.join(", ")) + "</div>";
    el.innerHTML = h;
    return !!r.identity && r.ids.length > 0;
  };
  // cartas que a IA de Runner não sabe jogar (só importa quando a IA usa a lista)
  DeckList.noAI = function (r) { return r.ids.filter(function (id) { return DeckList.cards[id] && DeckList.cards[id].na; }).map(function (id) { return DeckList.cards[id].t; }); };
  DeckList.pack = function (r) { return LZString.compressToEncodedURIComponent(JSON.stringify({ identity: r.identity, cards: r.ids })); };
})();
