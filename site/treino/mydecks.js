// =====================================================================
// Jack In Treino — Meus decks: decks salvos no navegador e, com login, na conta (Supabase),
// para usar em qualquer aparelho. Também abrir/exportar .txt e link do deck.
// Mesmo Supabase do MESA e do Elysium 2P (projeto "mesa"), tabela jk_decks.
// Licença: GPL-3.0.
// =====================================================================
var JKDecks = (function () {
  var SUPA_URL = "https://ghdhrxopeuozrvoicfds.supabase.co";
  var SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZGhyeG9wZXVvenJ2b2ljZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzM4NTEsImV4cCI6MjEwOTIwOTg1MX0.eHFSmfIGuvt0-MY20R0_e_bzo9-oaQqxzlprDqaBy4I";
  var SUPA_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  var TABLE = "jk_decks";
  var GOOGLE_ON = false; // ligar depois de configurar o Google no Supabase
  var CLOUD_ON = true;

  var EN = function () { return typeof JKLang != "undefined" && JKLang == "en"; };
  var tx = function (pt, en) { return EN() ? en : pt; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var lsGet = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  var MY = lsGet("jackin-mydecks", []); if (!Array.isArray(MY)) MY = [];
  var DEL = lsGet("jackin-mydecks-del", []); if (!Array.isArray(DEL)) DEL = [];
  var CL = { sb: null, user: null, state: "", busy: false };
  var BARS = [];

  function saveLocal() { lsSet("jackin-mydecks", MY); lsSet("jackin-mydecks-del", DEL); }
  function newKey() { var a = "abcdefghijklmnopqrstuvwxyz0123456789", k = "my_"; for (var i = 0; i < 8; i++) k += a[Math.floor(Math.random() * a.length)]; return k; }
  function sideOf(d) { return d.side == "c" ? "c" : "r"; }
  // nome sugerido: a identidade da lista (ou a primeira linha)
  function guessName(text, side) {
    try {
      if (typeof DeckList != "undefined" && DeckList.ready) {
        var r = DeckList.parse(text, side);
        if (r.identity) return DeckList.cards[r.identity].t.split(":")[0].trim();
      }
    } catch (e) {}
    var l = (text || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || "";
    return l.replace(/^\d+\s*x?\s+/i, "").slice(0, 40) || tx("Meu deck", "My deck");
  }
  function norm(t) { return String(t || "").replace(/\r/g, "").replace(/[ \t]+$/gm, "").trim(); }

  // ------------------------------------------------------------------ link do deck
  function deckLink(name, side, text) {
    var z = LZString.compressToEncodedURIComponent(JSON.stringify({ n: name, s: side, t: norm(text) }));
    var base = location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html";
    return base + "#deck=" + z;
  }
  function fromHash() {
    var m = /deck=([A-Za-z0-9+\-$_]+)/.exec(location.hash || "");
    if (!m) return null;
    try {
      var o = JSON.parse(LZString.decompressFromEncodedURIComponent(m[1]));
      if (!o || typeof o.t != "string") return null;
      return { name: String(o.n || "").slice(0, 60), side: o.s == "c" ? "c" : "r", text: o.t.slice(0, 20000) };
    } catch (e) { return null; }
  }
  // guarda o deck recebido por link (sem duplicar uma lista igual) e devolve o registro
  function addReceived(k) {
    var same = MY.filter(function (d) { return sideOf(d) == k.side && norm(d.text) == norm(k.text); })[0];
    if (same) return same;
    var rec = { key: newKey(), name: k.name || guessName(k.text, k.side), side: k.side, text: norm(k.text), upd: Date.now() };
    MY.push(rec); saveLocal(); cloudPut(rowOf(rec)); renderAll();
    return rec;
  }

  function download(name, text) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = (name || "deck").replace(/[^\p{L}\p{N} _.-]+/gu, "").trim().replace(/\s+/g, "_") + ".txt";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function flash(btn, t) { var o = btn.textContent; btn.textContent = t; btn.disabled = true; setTimeout(function () { btn.textContent = o; btn.disabled = false; }, 1600); }

  // ------------------------------------------------------------------ barra "Meus decks" acima de uma lista
  // opts: { textarea, side: () => "r"|"c", onChange: () => void }
  function attach(opts) {
    var ta = opts.textarea; if (!ta || ta._jkd) return; ta._jkd = true;
    var bar = document.createElement("div"); bar.className = "jkd-bar";
    var holder = ta.previousElementSibling && ta.previousElementSibling.tagName == "LABEL" ? ta.previousElementSibling : ta;
    holder.parentNode.insertBefore(bar, holder);
    var B = { el: bar, ta: ta, side: opts.side, onChange: opts.onChange || function () {}, cur: "" };
    BARS.push(B);
    ta.addEventListener("input", function () { touched(B); });
    bar.addEventListener("change", function (e) {
      if (e.target.classList.contains("jkd-pick")) {
        var d = MY.filter(function (x) { return x.key == e.target.value; })[0];
        B.cur = d ? d.key : "";
        if (d) { ta.value = d.text; B.onChange(); }
        renderBar(B);
      }
      if (e.target.classList.contains("jkd-file")) {
        var f = e.target.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function () { ta.value = String(rd.result).slice(0, 20000); B.cur = ""; B.onChange(); renderBar(B); };
        rd.readAsText(f); e.target.value = "";
      }
    });
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-jkd]"); if (!b) return;
      e.preventDefault();
      var act = b.getAttribute("data-jkd"), side = B.side(), text = norm(ta.value);
      var cur = MY.filter(function (x) { return x.key == B.cur; })[0];
      if (act == "save") {
        if (!text) { flash(b, tx("Lista vazia", "Empty list")); return; }
        var nm = window.prompt(tx("Nome do deck:", "Deck name:"), cur && sideOf(cur) == side ? cur.name : guessName(text, side));
        if (nm == null) return;
        nm = nm.trim().slice(0, 60) || guessName(text, side);
        var rec;
        if (cur && sideOf(cur) == side && cur.name == nm) { cur.text = text; cur.upd = Date.now(); rec = cur; }
        else {
          rec = MY.filter(function (x) { return sideOf(x) == side && x.name == nm; })[0];
          if (rec) { rec.text = text; rec.upd = Date.now(); }
          else { rec = { key: newKey(), name: nm, side: side, text: text, upd: Date.now() }; MY.push(rec); }
        }
        B.cur = rec.key; saveLocal(); cloudPut(rowOf(rec)); renderAll(); flash(bar.querySelector("[data-jkd=save]"), tx("Salvo", "Saved"));
      } else if (act == "del") {
        if (!cur) return;
        if (!window.confirm(tx("Apagar o deck \"" + cur.name + "\" de Meus decks?", "Delete \"" + cur.name + "\" from My decks?"))) return;
        var upd = Date.now();
        MY = MY.filter(function (x) { return x.key != cur.key; });
        DEL.push({ key: cur.key, upd: upd }); saveLocal(); B.cur = "";
        if (CL.user) cloudPut({ key: cur.key, name: "", side: sideOf(cur), text: "", upd: upd, deleted: true }).then(function (ok) { if (ok) { DEL = DEL.filter(function (x) { return x.key != cur.key; }); saveLocal(); } });
        renderAll();
      } else if (act == "open") {
        bar.querySelector(".jkd-file").click();
      } else if (act == "exp") {
        if (!text) { flash(b, tx("Lista vazia", "Empty list")); return; }
        download(cur ? cur.name : guessName(text, side), text + "\n");
      } else if (act == "link") {
        if (!text) { flash(b, tx("Lista vazia", "Empty list")); return; }
        var u = deckLink(cur ? cur.name : guessName(text, side), side, text);
        var done = function () { flash(b, tx("Link copiado", "Link copied")); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { window.prompt(tx("Copie o link:", "Copy the link:"), u); });
        else window.prompt(tx("Copie o link:", "Copy the link:"), u);
      } else if (act == "in") openLogin();
      else if (act == "pw") openSetPassword(false);
      else if (act == "out") {
        (CL.sb ? CL.sb.auth.signOut() : Promise.resolve()).catch(function () {}).then(function () {
          CL.user = null; CL.state = tx("você saiu; os decks continuam neste navegador", "signed out; your decks stay in this browser"); renderAll();
        });
      }
    });
    renderBar(B);
    return B;
  }
  function renderBar(B) {
    var side = B.side();
    var list = MY.filter(function (d) { return sideOf(d) == side; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (B.cur && !list.some(function (d) { return d.key == B.cur; })) B.cur = "";
    if (!B.cur && norm(B.ta.value)) { var hit = list.filter(function (d) { return norm(d.text) == norm(B.ta.value); })[0]; if (hit) B.cur = hit.key; }
    var lbl = side == "c" ? tx("Meus decks de Corp", "My Corp decks") : tx("Meus decks de Runner", "My Runner decks");
    var h = "<div class='jkd-row'>" +
      "<select class='input jkd-pick' aria-label='" + esc(lbl) + "'><option value=''>" + esc(lbl) + " (" + list.length + ")" + (list.length ? " — " + tx("escolher…", "choose…") : "") + "</option>" +
      list.map(function (d) { return "<option value='" + esc(d.key) + "'" + (d.key == B.cur ? " selected" : "") + ">" + esc(d.name) + "</option>"; }).join("") + "</select>" +
      "<button type='button' class='btn sm' data-jkd='save' title='" + esc(tx("Guardar a lista abaixo em Meus decks", "Keep the list below in My decks")) + "'>" + tx("Salvar", "Save") + "</button>" +
      (B.cur ? "<button type='button' class='btn sm' data-jkd='del'>" + tx("Apagar", "Delete") + "</button>" : "") +
      "</div><div class='jkd-row jkd-io'>" +
      "<button type='button' class='lnk' data-jkd='open'>" + tx("Abrir .txt", "Open .txt") + "</button>" +
      "<button type='button' class='lnk' data-jkd='exp'>" + tx("Exportar .txt", "Export .txt") + "</button>" +
      "<button type='button' class='lnk' data-jkd='link'>" + tx("Copiar link do deck", "Copy deck link") + "</button>" +
      "<input type='file' class='jkd-file' accept='.txt,.text,text/plain' hidden></div>";
    if (CLOUD_ON) {
      if (CL.user) h += "<div class='jkd-acct'>☁ " + tx("Conectado como ", "Signed in as ") + "<b>" + esc(CL.user.email || "") + "</b>" + (CL.state ? " · <span>" + esc(CL.state) + "</span>" : "") + " · <a href='#' data-jkd='pw'>" + (lsGet("jackin-haspw", false) ? tx("Trocar senha", "Change password") : tx("Criar senha", "Set password")) + "</a> · <a href='#' data-jkd='out'>" + tx("Sair", "Sign out") + "</a></div>";
      else h += "<div class='jkd-acct'>☁ <a href='#' data-jkd='in'>" + tx("Entrar para guardar seus decks em qualquer aparelho", "Sign in to keep your decks on any device") + "</a>" + (CL.state ? " · <span>" + esc(CL.state) + "</span>" : "") + "</div>";
    }
    B.el.innerHTML = h;
  }
  function renderAll() { BARS.forEach(renderBar); }
  // a lista mudou à mão: a escolha deixa de valer se o texto não bate mais
  function touched(B) { var d = MY.filter(function (x) { return x.key == B.cur; })[0]; if (d && norm(d.text) != norm(B.ta.value)) { B.cur = ""; renderBar(B); } }

  // ------------------------------------------------------------------ nuvem (Supabase)
  function loadSupa() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = SUPA_JS; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  }
  var rowOf = function (d) { return { key: d.key, name: d.name, side: sideOf(d), text: d.text || "", upd: d.upd || Date.now(), deleted: false }; };
  var initP = null;
  // só carrega a biblioteca do Supabase se já houver login guardado, se voltou do link do e-mail ou se pediu para entrar
  function cloudInit(force) {
    if (!CLOUD_ON) return Promise.resolve();
    if (initP) return initP;
    var hasTok = /access_token=|error_description=|[?&]code=/.test(location.hash + location.search);
    var hasSes = false; try { hasSes = !!localStorage.getItem("jackin-auth"); } catch (e) {}
    var isRecovery = /type=recovery/.test(location.hash), linkErr = /error_description=/.test(location.hash);
    if (!force && !hasTok && !hasSes) return Promise.resolve();
    initP = loadSupa().then(function () {
      CL.sb = window.supabase.createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "jackin-auth" } });
      return CL.sb.auth.getSession();
    }).then(function (res) {
      var ses = res && res.data && res.data.session;
      CL.user = ses ? ses.user : null;
      CL.sb.auth.onAuthStateChange(function (ev, s) {
        if (ev == "PASSWORD_RECOVERY" && !isRecovery) setTimeout(function () { openSetPassword(true); }, 50);
        var u = s ? s.user : null, changed = (u && u.id) !== (CL.user && CL.user.id);
        CL.user = u;
        if (changed && u) { cloudSync(); var ld = document.getElementById("jkdLogin"); if (ld) ld.hidden = true; }
        renderAll();
      });
      if (/access_token=|error_description=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
      // voltou do link do e-mail: retorna à página de onde pediu (ex.: a sala)
      if (linkErr) setTimeout(function () { toast(tx("O link do e-mail expirou ou já foi usado. Peça outro, ou entre com e-mail e senha.", "The email link expired or was already used. Ask for a new one, or sign in with email and password.")); }, 300);
      // voltou do link "Esqueci a senha": pede a senha nova aqui mesmo
      if (isRecovery && CL.user) { renderAll(); cloudSync(); setTimeout(function () { openSetPassword(true); }, 300); return; }
      if (hasTok && CL.user) {
        var ret = lsGet("jackin-auth-return", null); lsSet("jackin-auth-return", null);
        if (ret && ret.u && Date.now() - ret.t < 3 * 3600e3 && ret.u.indexOf(location.origin) == 0 && ret.u != location.href) { location.replace(ret.u); return; }
      }
      renderAll();
      if (CL.user) cloudSync();
    }).catch(function (e) { CL.state = tx("nuvem indisponível agora", "cloud unavailable right now"); renderAll(); });
    return initP;
  }
  function cloudSync() {
    if (!CL.sb || !CL.user || CL.busy) return Promise.resolve();
    CL.busy = true; CL.state = tx("sincronizando…", "syncing…"); renderAll();
    return CL.sb.from(TABLE).select("key,name,side,text,upd,deleted").then(function (res) {
      if (res.error) throw res.error;
      var remote = {}; (res.data || []).forEach(function (r) { remote[r.key] = r; });
      var push = [];
      Object.keys(remote).forEach(function (k) {
        var r = remote[k];
        var loc = MY.filter(function (x) { return x.key == k; })[0], del = DEL.filter(function (x) { return x.key == k; })[0];
        if (r.deleted) { if (loc && (loc.upd || 0) <= r.upd) MY = MY.filter(function (x) { return x.key != k; }); return; }
        if (del && del.upd >= r.upd) { push.push({ key: k, name: r.name, side: r.side, text: "", upd: del.upd, deleted: true }); return; }
        if (!loc || (loc.upd || 0) < r.upd) {
          var rec = { key: k, name: r.name, side: r.side == "c" ? "c" : "r", text: r.text || "", upd: r.upd };
          if (loc) MY[MY.indexOf(loc)] = rec; else MY.push(rec);
        } else if ((loc.upd || 0) > r.upd) push.push(rowOf(loc));
      });
      MY.filter(function (d) { return !remote[d.key]; }).forEach(function (d) { if (!d.upd) d.upd = Date.now(); push.push(rowOf(d)); });
      DEL.filter(function (x) { return !remote[x.key]; }).forEach(function (x) { push.push({ key: x.key, name: "", side: "r", text: "", upd: x.upd, deleted: true }); });
      if (!push.length) return;
      return CL.sb.from(TABLE).upsert(push, { onConflict: "user_id,key" }).then(function (r2) { if (r2.error) throw r2.error; });
    }).then(function () {
      DEL = []; saveLocal();
      CL.state = tx("decks guardados na nuvem", "decks saved to the cloud");
    }).catch(function (e) {
      CL.state = tx("não deu para sincronizar agora (os decks continuam neste navegador)", "couldn't sync right now (your decks are still in this browser)");
      try { console.warn(e); } catch (er) {}
    }).then(function () { CL.busy = false; renderAll(); });
  }
  function cloudPut(row) {
    if (!CL.sb || !CL.user) return Promise.resolve(false);
    return CL.sb.from(TABLE).upsert([row], { onConflict: "user_id,key" }).then(function (r) {
      if (r.error) throw r.error;
      CL.state = tx("decks guardados na nuvem", "decks saved to the cloud"); renderAll(); return true;
    }).catch(function () {
      CL.state = tx("sem conexão: o deck ficou neste navegador e sobe na próxima vez", "offline: the deck stayed in this browser and will upload next time"); renderAll(); return false;
    });
  }
  var MAILRE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  // o link do e-mail sempre volta para a abertura do treino; de lá, retorna à página de origem
  function backURL() { return location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html"; }
  function rememberReturn() { if (!/\/(index\.html)?$/.test(location.pathname)) lsSet("jackin-auth-return", { u: location.href.split("#")[0], t: Date.now() }); }
  function authErr(er) {
    var m = (er && er.message) || String(er || "");
    if (/rate|limit|seconds/i.test(m)) return tx("Muitos pedidos agora; tente de novo em alguns minutos.", "Too many requests right now; try again in a few minutes.");
    if (/invalid login credentials/i.test(m)) return tx("E-mail ou senha incorretos. Se você sempre entrou pelo link do e-mail, entre pelo link uma vez e crie a sua senha.", "Wrong email or password. If you always signed in with the email link, use the link once and create your password.");
    if (/email not confirmed/i.test(m)) return tx("Falta confirmar o e-mail: abra o link que enviamos quando você criou a conta.", "Your email isn't confirmed yet: open the link we sent when you created the account.");
    if (/password should be|at least 6/i.test(m)) return tx("A senha precisa ter pelo menos 6 caracteres.", "The password needs at least 6 characters.");
    if (/already registered|already exists/i.test(m)) return tx("Esse e-mail já tem conta. Use \"Entrar\" ou \"Esqueci a senha\".", "This email already has an account. Use \"Sign in\" or \"Forgot password\".");
    return m;
  }
  function openLogin() {
    var d = document.getElementById("jkdLogin");
    if (!d) {
      d = document.createElement("div"); d.id = "jkdLogin"; d.className = "jkd-dlg";
      d.innerHTML = "<div class='jkd-box' role='dialog' aria-modal='true' aria-labelledby='jkdLogT'><h2 id='jkdLogT'>" + tx("Guardar meus decks", "Keep my decks") + "</h2>" +
        "<p class='jkd-note'>" + tx("Entre para seus decks ficarem guardados na sua conta e aparecerem em qualquer aparelho. Os decks que já estão neste navegador vão junto. A conta é a mesma do Elysium 2P.", "Sign in to keep your decks in your account and see them on any device. The decks already in this browser come along. It's the same account as Elysium 2P.") + "</p>" +
        (GOOGLE_ON ? "<button type='button' class='btn pri' id='jkdG'>" + tx("Entrar com Google", "Sign in with Google") + "</button><div class='jkd-or'>" + tx("ou com e-mail e senha", "or with email and password") + "</div>" : "") +
        "<label class='lbl' for='jkdMail'>E-mail</label><input id='jkdMail' class='input' type='email' autocomplete='email' placeholder='" + tx("seu@email.com", "you@email.com") + "'>" +
        "<label class='lbl' for='jkdPass'>" + tx("Senha", "Password") + "</label><input id='jkdPass' class='input' type='password' autocomplete='current-password' minlength='6' placeholder='" + tx("pelo menos 6 caracteres", "at least 6 characters") + "'>" +
        "<div class='jkd-row' style='margin-top:10px'><button type='button' class='btn pri' id='jkdIn'>" + tx("Entrar", "Sign in") + "</button><button type='button' class='btn' id='jkdNew'>" + tx("Criar conta", "Create account") + "</button><button type='button' class='btn' id='jkdClose'>" + tx("Fechar", "Close") + "</button></div>" +
        "<div class='jkd-row jkd-links'><button type='button' class='jkd-lnk' id='jkdForgot'>" + tx("Esqueci a senha", "Forgot password") + "</button><button type='button' class='jkd-lnk' id='jkdSend'>" + tx("Entrar sem senha, por link no e-mail", "Sign in without a password, by email link") + "</button></div>" +
        "<p id='jkdMsg' class='jkd-note' aria-live='polite'></p>" +
        "<p class='jkd-note jkd-small'>" + tx("Depois de entrar, este aparelho fica conectado; não é preciso entrar de novo a cada visita.", "Once signed in, this device stays connected; you don't need to sign in on every visit.") + "</p></div>";
      document.body.appendChild(d);
      var $q = function (s) { return d.querySelector(s); };
      var msg = function (t) { $q("#jkdMsg").textContent = t; };
      var busy = function (on) { ["#jkdIn", "#jkdNew", "#jkdSend", "#jkdForgot"].forEach(function (id) { $q(id).disabled = on; }); };
      var mail = function () { var em = $q("#jkdMail").value.trim(); if (!MAILRE.test(em)) { msg(tx("Confira o e-mail.", "Check the email address.")); return null; } return em; };
      var pass = function () { var p = $q("#jkdPass").value; if (p.length < 6) { msg(tx("A senha precisa ter pelo menos 6 caracteres.", "The password needs at least 6 characters.")); return null; } return p; };
      var run = function (wait, fn, ok) {
        busy(true); msg(wait);
        cloudInit(true).then(function () {
          if (!CL.sb) throw new Error(tx("nuvem indisponível agora", "cloud unavailable right now"));
          return fn();
        }).then(function (r) {
          if (r && r.error) msg(authErr(r.error)); else ok(r || {});
        }).catch(function (e) { msg(authErr(e)); }).then(function () { busy(false); });
      };
      $q("#jkdClose").addEventListener("click", function () { d.hidden = true; });
      d.addEventListener("click", function (e) { if (e.target === d) d.hidden = true; });
      d.addEventListener("keydown", function (e) { if (e.key == "Escape") d.hidden = true; });
      if ($q("#jkdG")) $q("#jkdG").addEventListener("click", function () {
        cloudInit(true).then(function () { return CL.sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: backURL() } }); }).then(function (r) { if (r && r.error) msg(r.error.message); });
      });
      var signIn = function () {
        var em = mail(); if (!em) return; var pw = pass(); if (!pw) return;
        run(tx("Entrando…", "Signing in…"), function () { return CL.sb.auth.signInWithPassword({ email: em, password: pw }); },
          function () { lsSet("jackin-haspw", true); renderAll(); msg(tx("Pronto! Conectado.", "Done! Signed in.")); setTimeout(function () { d.hidden = true; }, 700); });
      };
      $q("#jkdIn").addEventListener("click", signIn);
      $q("#jkdPass").addEventListener("keydown", function (e) { if (e.key == "Enter") signIn(); });
      $q("#jkdMail").addEventListener("keydown", function (e) { if (e.key == "Enter") $q("#jkdPass").focus(); });
      $q("#jkdNew").addEventListener("click", function () {
        var em = mail(); if (!em) return; var pw = pass(); if (!pw) return;
        rememberReturn(); lsSet("jackin-haspw", true);
        run(tx("Criando a conta…", "Creating the account…"), function () { return CL.sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: backURL() } }); },
          function (r) {
            var data = r.data || {};
            if (data.session) { msg(tx("Conta criada e conectada.", "Account created and signed in.")); setTimeout(function () { d.hidden = true; }, 700); return; }
            // o Supabase não diz se o e-mail já existia (por segurança): a mensagem cobre os dois casos
            msg(tx("Enviamos um e-mail para confirmar a conta (só desta vez; pode estar no spam). Depois de confirmar, é só entrar com e-mail e senha. Se esse e-mail já tinha conta pelo link, entre pelo link e use \"Criar senha\".",
                   "We sent an email to confirm the account (only this once; check spam). After confirming, just sign in with email and password. If this email already had an account through the link, sign in with the link and use \"Set password\"."));
          });
      });
      $q("#jkdForgot").addEventListener("click", function () {
        var em = mail(); if (!em) return;
        rememberReturn();
        run(tx("Enviando…", "Sending…"), function () { return CL.sb.auth.resetPasswordForEmail(em, { redirectTo: backURL() }); },
          function () { msg(tx("Enviamos um link para criar uma nova senha (pode estar no spam). Ele abre o treino e pede a senha nova.", "We sent a link to create a new password (check spam). It opens the trainer and asks for the new password.")); });
      });
      $q("#jkdSend").addEventListener("click", function () {
        var em = mail(); if (!em) return;
        rememberReturn();
        run(tx("Enviando…", "Sending…"), function () { return CL.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: backURL() } }); },
          function () { msg(tx("Pronto! Abra o link que chegou no seu e-mail (pode estar no spam). Ele abre o treino já conectado. Lá você pode criar uma senha para não precisar mais do link.", "Done! Open the link sent to your email (check spam). It opens the trainer already signed in. There you can set a password so you won't need the link again.")); });
      });
    }
    d.hidden = false; d.querySelector("#jkdMsg").textContent = "";
    setTimeout(function () { (d.querySelector("#jkdG") || d.querySelector("#jkdMail")).focus(); }, 30);
  }
  // criar/trocar a senha de quem já está conectado (também abre ao voltar do link "Esqueci a senha")
  function openSetPassword(recovery) {
    var d = document.getElementById("jkdPw");
    if (!d) {
      d = document.createElement("div"); d.id = "jkdPw"; d.className = "jkd-dlg";
      d.innerHTML = "<div class='jkd-box' role='dialog' aria-modal='true' aria-labelledby='jkdPwT'><h2 id='jkdPwT'></h2>" +
        "<p class='jkd-note' id='jkdPwNote'></p>" +
        "<label class='lbl' for='jkdPw1'>" + tx("Nova senha", "New password") + "</label><input id='jkdPw1' class='input' type='password' autocomplete='new-password' placeholder='" + tx("pelo menos 6 caracteres", "at least 6 characters") + "'>" +
        "<label class='lbl' for='jkdPw2'>" + tx("Repita a senha", "Repeat the password") + "</label><input id='jkdPw2' class='input' type='password' autocomplete='new-password'>" +
        "<div class='jkd-row' style='margin-top:10px'><button type='button' class='btn pri' id='jkdPwSave'>" + tx("Salvar senha", "Save password") + "</button><button type='button' class='btn' id='jkdPwClose'>" + tx("Fechar", "Close") + "</button></div>" +
        "<p id='jkdPwMsg' class='jkd-note' aria-live='polite'></p></div>";
      document.body.appendChild(d);
      var $q = function (s) { return d.querySelector(s); };
      $q("#jkdPwClose").addEventListener("click", function () { d.hidden = true; });
      d.addEventListener("keydown", function (e) { if (e.key == "Escape") d.hidden = true; });
      var save = function () {
        var p1 = $q("#jkdPw1").value, p2 = $q("#jkdPw2").value, m = $q("#jkdPwMsg");
        if (p1.length < 6) { m.textContent = tx("A senha precisa ter pelo menos 6 caracteres.", "The password needs at least 6 characters."); return; }
        if (p1 != p2) { m.textContent = tx("As duas senhas estão diferentes.", "The two passwords don't match."); return; }
        $q("#jkdPwSave").disabled = true; m.textContent = tx("Salvando…", "Saving…");
        CL.sb.auth.updateUser({ password: p1 }).then(function (r) {
          if (r && r.error) { m.textContent = authErr(r.error); return; }
          m.textContent = tx("Senha salva. Da próxima vez, entre com e-mail e senha.", "Password saved. Next time, sign in with email and password.");
          lsSet("jackin-haspw", true); renderAll();
          setTimeout(function () { d.hidden = true; }, 1200);
        }).catch(function (e) { m.textContent = authErr(e); }).then(function () { $q("#jkdPwSave").disabled = false; });
      };
      $q("#jkdPwSave").addEventListener("click", save);
      $q("#jkdPw2").addEventListener("keydown", function (e) { if (e.key == "Enter") save(); });
    }
    d.querySelector("#jkdPwT").textContent = recovery ? tx("Criar uma nova senha", "Create a new password") : tx("Criar senha", "Set password");
    d.querySelector("#jkdPwNote").textContent = tx("Conta: ", "Account: ") + ((CL.user && CL.user.email) || "") + ". " +
      tx("Com a senha, você entra em qualquer aparelho sem precisar do link no e-mail.", "With a password you can sign in on any device without the email link.");
    d.querySelector("#jkdPwMsg").textContent = "";
    d.querySelector("#jkdPw1").value = ""; d.querySelector("#jkdPw2").value = "";
    d.hidden = false; setTimeout(function () { d.querySelector("#jkdPw1").focus(); }, 30);
  }

  // estilos (a página do treino e a sala usam variáveis diferentes; tudo com valores próprios)
  (function css() {
    var s = document.createElement("style");
    s.textContent =
      ".jkd-bar{margin:4px 0 8px;font-size:13px;font-family:'IBM Plex Sans',system-ui,sans-serif}" +
      ".jkd-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}" +
      ".jkd-row .jkd-pick{flex:1 1 200px;min-width:0;width:auto;margin:0}" +
      ".jkd-bar .btn.sm{padding:6px 12px;font-size:13px}" +
      ".jkd-io{margin-top:4px;gap:2px 14px}" +
      ".jkd-bar .lnk{background:none;border:0;padding:2px 0;color:#5fd3ff;cursor:pointer;font:inherit;font-size:12.5px;text-decoration:underline;text-underline-offset:2px}" +
      ".jkd-bar .lnk:hover{color:#b4ecff}" +
      ".jkd-acct{margin-top:4px;font-size:12.5px;color:#8da0b6}.jkd-acct a{color:#ffb347}.jkd-acct b{color:#dbe6f2;font-weight:600}" +
      ".jkd-dlg{position:fixed;inset:0;z-index:2000;background:rgba(3,8,14,.72);display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".jkd-dlg[hidden]{display:none}" +
      ".jkd-box{width:min(440px,100%);background:#0f1d2b;border:1px solid #28465f;border-radius:8px;padding:18px 20px;color:#dbe6f2;font-family:'IBM Plex Sans',system-ui,sans-serif}" +
      ".jkd-box h2{margin:0 0 8px;font-family:'Chakra Petch',system-ui,sans-serif;font-size:20px;color:#5fd3ff}" +
      ".jkd-box .input{width:100%;box-sizing:border-box}" +
      ".jkd-box .btn{background:#10202f;border:1px solid #28465f;color:#dbe6f2;padding:8px 16px;border-radius:4px;font:600 14px 'Chakra Petch',system-ui,sans-serif;cursor:pointer}" +
      ".jkd-box .btn.pri{background:#5fd3ff;color:#04121c;border-color:#5fd3ff}.jkd-box .btn[disabled]{opacity:.4;cursor:default}" +
      ".jkd-box .input{background:#07101a;border:1px solid #28465f;border-radius:4px;padding:8px 10px;color:#dbe6f2;font:14px system-ui,sans-serif}" +
      ".jkd-box .lbl{display:block;font-size:13px;color:#8da0b6;margin:8px 0 4px}" +
      ".jkd-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2100;background:#0f1d2b;border:1px solid #5fd3ff;color:#dbe6f2;padding:10px 16px;border-radius:6px;font:14px 'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5);max-width:calc(100% - 32px)}" +
      ".jkd-links{margin-top:8px;gap:4px 16px}" +
      ".jkd-lnk{background:none;border:0;padding:2px 0;color:#5fd3ff;cursor:pointer;font:13px 'IBM Plex Sans',system-ui,sans-serif;text-decoration:underline;text-underline-offset:2px}.jkd-lnk[disabled]{opacity:.4}" +
      ".jkd-small{font-size:12px;margin-top:10px}" +
      ".jkd-note{font-size:13px;color:#8da0b6;margin:6px 0}.jkd-or{margin:10px 0 4px;font-size:13px;color:#8da0b6}";
    document.head.appendChild(s);
  })();

  function toast(msg) {
    var t = document.createElement("div"); t.className = "jkd-toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 5000);
  }
  return {
    attach: attach, refresh: renderAll, toast: toast, touched: touched, fromHash: fromHash, addReceived: addReceived,
    cloudInit: cloudInit, list: function () { return MY.slice(); }, _cl: CL
  };
})();
