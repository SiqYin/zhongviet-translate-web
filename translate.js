(function () {
  "use strict";

  var ZV = window.ZV || [];
  var HV = window.HV || { ZV: ZV };
  var NOMDATA = window.NOMDATA || [];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ================= 設定 =================
  var CFG_KEY = "hanviet.ai.cfg";
  var DEF = {
    base: "https://index-translate.bilibili.com/v1",
    model: "Index-Translate-35B-A3B",
    key: "EMPTY"
  };

  function loadCfg() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(CFG_KEY) || "{}") || {}; } catch (e) { c = {}; }
    return {
      base: c.base || DEF.base,
      model: c.model || DEF.model,
      key: c.key || DEF.key
    };
  }
  function saveCfg(c) {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
  }

  // ================= 方向 =================
  var st = { view: "dict", dir: "zh2vi", script: "hans", busy: false, out: "", lang: "" };
  try {
    var _d = localStorage.getItem("hanviet.ai.dir");
    var _sc = localStorage.getItem("hanviet.ai.script");
    if (_d === "zh2vi" || _d === "vi2zh") st.dir = _d;
    if (_sc === "hans" || _sc === "hant") st.script = _sc;
  } catch (e) {}
  function saveOpts() {
    try {
      localStorage.setItem("hanviet.ai.dir", st.dir);
      localStorage.setItem("hanviet.ai.script", st.script);
    } catch (e) {}
  }

  function dirLabel() {
    return t("ai.dirHint." + st.dir + "." + st.script);
  }
  function placeholder() {
    return t(st.dir === "zh2vi" ? "ai.src.ph.zh2vi" : "ai.src.ph.vi2zh");
  }
  function sampleText() {
    if (st.dir === "vi2zh") return "Hôm qua anh ấy không đi làm vì bị sốt.";
    return st.script === "hant"
      ? "他昨天沒來上班，因為發燒了。"
      : "他昨天没来上班，因为发烧了。";
  }

  function promptFor(text) {
    if (st.dir === "zh2vi") {
      return "请将以下中文文本翻译为越南语，输出地道自然的越南语表达，直接输出翻译结果，不要进行任何解释。\n\n" + text;
    }
    var tgt = st.script === "hant"
      ? "繁體中文（必须全部使用繁體字，不要出现简体字）"
      : "简体中文（全部使用简体字）";
    return "请将以下越南语文本翻译为" + tgt + "，直接输出翻译结果，不要进行任何解释。\n\n" + text;
  }

  // ================= 中文分詞：最大匹配 =================
  var CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
  var MAXW = 7;

  function zhIndex(w) {
    if (HV.bySimp && HV.bySimp.has(w)) return HV.bySimp.get(w);
    if (HV.byTrad && HV.byTrad.has(w)) return HV.byTrad.get(w);
    return -1;
  }

  function segZh(text) {
    var out = [], i = 0, n = text.length;
    while (i < n) {
      var ch = text.charAt(i);
      if (!CJK.test(ch)) {
        var j = i;
        while (j < n && !CJK.test(text.charAt(j))) j++;
        out.push({ t: text.slice(i, j), w: false });
        i = j;
        continue;
      }
      var hit = "", len = 1;
      var maxL = Math.min(MAXW, n - i);
      for (var L = maxL; L >= 2; L--) {
        var cand = text.substr(i, L);
        if (zhIndex(cand) > -1) { hit = cand; len = L; break; }
      }
      if (!hit) { hit = ch; len = 1; }
      out.push({ t: hit, w: true });
      i += len;
    }
    return out;
  }

  // ================= 越南語分詞：詞典加權 DP =================
  var SEP = /[^0-9a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+/;
  var _vlex = null;

  // 詞庫：NOMDATA 詞頭權重 3，詞典義項短語權重 1，常用單音節虛詞權重 2
  function viLexicon() {
    if (_vlex) return _vlex;
    var m = new Map();
    function add(key, w) {
      var cur = m.get(key);
      if (cur === undefined || w > cur) m.set(key, w);
    }
    for (var k = 0; k < NOMDATA.length; k++) {
      var key = String(NOMDATA[k][0] || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (!key) continue;
      var sy = key.split(" ");
      if (sy.length >= 1 && sy.length <= 6) add(sy.join(" "), 3);
    }
    for (var i = 0; i < ZV.length; i++) {
      var sd = ZV[i][3];
      if (!sd) continue;
      var parts = sd.split(/[；;，,、\/]/);
      for (var j = 0; j < parts.length; j++) {
        var seg = parts[j].replace(/[（(][^）)]*[）)]/g, " ").trim().toLowerCase();
        if (!seg) continue;
        var sy2 = seg.split(SEP).filter(Boolean);
        if (sy2.length < 2 || sy2.length > 5) continue;
        add(sy2.join(" "), 1);
      }
    }
    var singles = ("và của cho với là có không những được người một hai ba bốn năm sáu bảy tám chín mười " +
      "đi ăn nói làm rất đã sẽ đang này đó kia nào gì ai sao khi nếu thì mà để bị bởi tại từ về đến ở " +
      "ra vào lên xuống rồi cũng chỉ còn nữa vẫn đều luôn thật quá hơi lắm nhé ạ các một nhiều ít").split(" ");
    for (var q = 0; q < singles.length; q++) add(singles[q], 2);
    _vlex = m;
    return m;
  }
  function viPhrases() { return viLexicon(); }

  // 以音節為單位做 DP：最大化「詞權重 × 詞長」，未成詞音節記 -1
  function segVi(text) {
    var lex = viLexicon();
    var re = /[\p{L}\p{N}]+/gu, toks = [], last = 0, mm;
    while ((mm = re.exec(text))) {
      toks.push({ gap: text.slice(last, mm.index), word: mm[0], low: mm[0].toLowerCase() });
      last = mm.index + mm[0].length;
    }
    var tail = text.slice(last), n = toks.length;
    if (!n) return [{ lead: "", t: text, w: false }];

    var best = new Array(n + 1);
    best[n] = { score: 0, len: 0 };
    for (var i = n - 1; i >= 0; i--) {
      var cand = { score: -1 + best[i + 1].score, len: 1 };
      var maxL = Math.min(6, n - i);
      for (var L = 2; L <= maxL; L++) {
        var key = toks[i].low;
        for (var x = 1; x < L; x++) key += " " + toks[i + x].low;
        var wgt = lex.get(key);
        if (wgt) {
          var sc = wgt * L + best[i + L].score;
          if (sc > cand.score + 1e-9 || (Math.abs(sc - cand.score) <= 1e-9 && L > cand.len)) {
            cand = { score: sc, len: L };
          }
        }
      }
      best[i] = cand;
    }

    var out = [], i2 = 0;
    while (i2 < n) {
      var L2 = best[i2].len;
      var surface = toks[i2].word;
      var lookup = toks[i2].word;
      for (var y = 1; y < L2; y++) {
        surface += toks[i2 + y].gap + toks[i2 + y].word;
        lookup += " " + toks[i2 + y].word;
      }
      out.push({ lead: toks[i2].gap, t: surface, lookup: lookup, w: true });
      i2 += L2;
    }
    if (tail) out.push({ lead: "", t: tail, w: false });
    return out;
  }
  HV.segVi = segVi;

  // ================= 越南語 → 中文 反查索引 =================
  var viIdx = new Map(), viPos = 0, viBuilding = false, viBuilt = false;

  function idxAdd(key, i) {
    if (key.length < 2) return;
    var arr = viIdx.get(key);
    if (!arr) viIdx.set(key, [i]);
    else if (arr[arr.length - 1] !== i && arr.length < 30) arr.push(i);
  }

  function stepViIndex(budget) {
    var t0 = Date.now();
    while (viPos < ZV.length && Date.now() - t0 < budget) {
      var i = viPos++;
      var e = ZV[i];
      if (e[1].length > 5) continue;
      var ss = HV.senses(e);
      for (var j = 0; j < ss.length; j++) {
        var raw = ss[j].toLowerCase().replace(/[（(][^）)]*[）)]/g, " ").trim();
        if (!raw) continue;
        var tk = raw.match(/[\p{L}\p{N}]+/gu);
        if (!tk || !tk.length) continue;
        // 同時索引單詞與 2/3 詞的組合，長釋義（如「Hà Nội, thủ đô…」）才查得到
        for (var k = 0; k < tk.length; k++) {
          idxAdd(tk[k], i);
          if (k + 1 < tk.length) idxAdd(tk[k] + " " + tk[k + 1], i);
          if (k + 2 < tk.length) idxAdd(tk[k] + " " + tk[k + 1] + " " + tk[k + 2], i);
        }
      }
    }
    if (viPos >= ZV.length) { viBuilt = true; viBuilding = false; return; }
    setTimeout(function () { stepViIndex(budget); }, 0);
  }

  function warmVi() {
    if (viBuilt || viBuilding) return;
    viBuilding = true;
    setTimeout(function () { stepViIndex(10); }, 0);
  }

  // 回傳 分數*100 + 詞數，分數越小越貼合；詞數用來把冗長的釋義排後面
  function senseScore(i, key) {
    var ss = HV.senses(ZV[i]), best = 9, bestLen = 99;
    for (var j = 0; j < ss.length; j++) {
      var sv = ss[j].toLowerCase().replace(/[（(][^）)]*[）)]/g, " ")
        .replace(/[.,;:!?"'”’\]]+$/, "").trim();
      if (!sv) continue;
      var sc = 9;
      if (sv === key) sc = 0;
      else if (sv.indexOf(key) === 0) sc = 1;
      else if (sv.split(SEP).indexOf(key) > -1) sc = 3;
      else if (sv.indexOf(key) > -1) sc = 4;
      var wc = sv.split(/\s+/).length;
      if (sc < 9 && (sc < best || (sc === best && wc < bestLen))) { best = sc; bestLen = wc; }
    }
    return best === 9 ? -1 : best * 100 + Math.min(bestLen, 30);
  }

  function linearVi(key) {
    var out = [];
    for (var i = 0; i < ZV.length && out.length < 12; i++) {
      if (ZV[i][1].length > 5) continue;
      if (senseScore(i, key) > -1) out.push(i);
    }
    return out;
  }

  var viCache = new Map();

  function lookupVi(word) {
    var key = word.toLowerCase().trim();
    if (viCache.has(key)) return viCache.get(key);
    var cand = viIdx.get(key);
    if (!cand) cand = linearVi(key);      // 索引還沒建好，或鍵不在索引裡：直接掃一遍
    var scored = [];
    for (var k = 0; k < cand.length; k++) {
      var s = senseScore(cand[k], key);
      if (s > -1) scored.push([s, cand[k]]);
    }
    scored.sort(function (a, b) {
      return a[0] - b[0] || ZV[a[1]][1].length - ZV[b[1]][1].length;
    });
    // 只保留和最佳結果同一檔次（含下一檔）的，避免「包含該詞」的長釋義混進來
    if (scored.length) {
      var lim = (Math.floor(scored[0][0] / 100) + 2) * 100;
      scored = scored.filter(function (x) { return x[0] < lim; });
    }
    var out = scored.slice(0, 5).map(function (x) { return x[1]; });
    viCache.set(key, out);
    return out;
  }

  // ================= 彈窗 =================
  var pop = $("pop"), curTok = null, hoverTimer = null, hideTimer = null;

  function nonePop(w) {
    return '<div class="ptop"><span class="pvi-big" style="color:#2b2118">' + esc(w) + "</span></div>" +
      '<div class="plabel">' + t("pop.lib") + '</div><div class="pop-none">' + t("pop.miss", { w: esc(w) }) + "</div>";
  }

  function popZh(w) {
    var i = zhIndex(w);
    if (i < 0) return nonePop(w);
    var e = ZV[i], ss = HV.senses(e);
    var tr = e[0] !== e[1] ? e[0] : "";
    var h = '<div class="ptop"><span class="phz">' + esc(e[1]) + "</span>" +
      '<span class="pmeta"><span class="ppy">' + esc(e[2]) + "</span>" +
      (HV.zhuyin ? '<span class="pzy">' + esc(HV.zhuyin(e[2])) + "</span>" : "") +
      "</span></div>";
    if (tr) h += '<div class="prow"><b>' + t("detail.trad") + '</b><span>' + esc(tr) + "</span></div>";
    if (e[4]) h += '<div class="prow"><b>' + t("detail.hv") + '</b><span>' + esc(e[4]) + "</span></div>";
    if (ss[0]) {
      h += '<div class="pvi">' + esc(ss[0]) +
        (e[5] ? '<span class="pnom">' + esc(e[5]) + "</span>" : "") + "</div>";
    }
    if (ss.length > 1) h += '<div class="poth">' + ss.slice(1, 3).map(esc).join("；") + "</div>";
    h += '<div class="pfoot" data-open="' + i + '">' + t("detail.more") + "</div>";
    return h;
  }

  function popVi(w) {
    var hits = lookupVi(w);
    var nom = (HV.NOM && HV.NOM.get(w.toLowerCase().trim())) || "";
    var h = '<div class="ptop"><span class="pvi-big">' + esc(w) + "</span>" +
      (nom ? '<span class="pnom">' + esc(nom) + "</span>" : "") + "</div>";
    if (!hits.length) {
      return h + '<div class="plabel">' + t("pop.lib") + '</div><div class="pop-none">' + t("pop.noZh") + "</div>";
    }
    h += '<div class="plabel">' + t("vi.hero.label") + "</div>";
    hits.slice(0, 4).forEach(function (i) {
      var e = ZV[i];
      h += '<div class="pitem"><span class="pw">' + esc(e[1]) + "</span>" +
        '<span class="pp">' + esc(e[2]) + "</span></div>";
    });
    h += '<div class="pfoot" data-open="' + hits[0] + '">' + t("detail.more") + "</div>";
    return h;
  }

  function placePop(el) {
    if (window.matchMedia("(max-width:520px) and (hover:none)").matches) return;
    var r = el.getBoundingClientRect();
    var pr = pop.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var left = r.left + r.width / 2 - pr.width / 2;
    left = Math.max(8, Math.min(left, vw - pr.width - 8));
    var below = r.bottom + 9;
    var top;
    if (below + pr.height <= vh - 10) top = below;              // 優先放詞下方
    else top = Math.max(56, r.top - pr.height - 9);             // 下方不夠才放上方
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
  }

  function showPop(el) {
    var w = el.getAttribute("data-t");
    if (!w) return;
    pop.innerHTML = st.lang === "zh" ? popZh(w) : popVi(w);
    pop.hidden = false;
    if (curTok && curTok !== el) curTok.classList.remove("on");
    curTok = el;
    el.classList.add("on");
    placePop(el);
  }

  function hidePop() {
    if (curTok) curTok.classList.remove("on");
    curTok = null;
    pop.hidden = true;
  }

  // ================= 渲染譯文 =================
  var tokensEl = $("tokens"), outLabel = $("outLabel"), outMeta = $("outMeta");

  function renderOut(text, lang, meta) {
    st.out = text;
    st.lang = lang;
    outLabel.textContent = lang === "vi" ? t("ai.out.vi") : (st.script === "hant" ? t("ai.out.zhhant") : t("ai.out.zh"));
    outMeta.textContent = meta || "";
    tokensEl.className = "tokline " + (lang === "vi" ? "vi" : "zh");
    var toks = lang === "vi" ? segVi(text) : segZh(text);
    var html = [];
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      var lead = tk.lead ? esc(tk.lead) : "";
      if (tk.w) html.push(lead + '<span class="tok" data-t="' + esc(tk.lookup || tk.t) + '">' + esc(tk.t) + "</span>");
      else html.push(lead + '<span class="glue">' + esc(tk.t) + "</span>");
    }
    tokensEl.innerHTML = html.join("");
    $("out").hidden = false;
  }

  // ================= 呼叫 API =================
  function callApi(text) {
    var cfg = loadCfg();
    var url = cfg.base.replace(/\/+$/, "") + "/chat/completions";
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, 120000);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (cfg.key || "EMPTY")
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: promptFor(text) }],
        temperature: 0.15,
        max_tokens: 2048,
        stream: false
      }),
      signal: ctrl.signal
    }).then(function (res) {
      clearTimeout(to);
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("HTTP " + res.status + " — " + String(t).slice(0, 160));
        });
      }
      return res.json();
    }).then(function (j) {
      var c = j && j.choices && j.choices[0];
      var s = c && (c.message ? c.message.content : c.text);
      if (!s || !String(s).trim()) throw new Error("服務回應為空");
      return String(s).trim();
    });
  }

  // ================= 離線：詞庫逐詞直譯 =================
  function glossOf(i) {
    var s = HV.senses(ZV[i])[0] || "";
    return s.split(/[，,；;：:]/)[0].replace(/[（(][^）)]*[）)]/g, "").trim();
  }

  function offlineTranslate(text) {
    var parts = [];
    if (st.dir === "zh2vi") {
      segZh(text).forEach(function (t) {
        if (!t.w) { parts.push({ s: t.t, w: false }); return; }
        var i = zhIndex(t.t);
        parts.push({ s: i > -1 ? (glossOf(i) || t.t) : t.t, w: true });
      });
      var res = "";
      parts.forEach(function (p, k) {
        if (k > 0) {
          var prev = parts[k - 1].s;
          var a = /[A-Za-zÀ-ỹ]$/.test(prev);
          var b = /^[A-Za-zÀ-ỹ]/.test(p.s);
          if (a && b) res += " ";
        }
        res += p.s;
      });
      return res;
    }
    segVi(text).forEach(function (t) {
      if (!t.w) { parts.push({ s: t.t, w: false }); return; }
      var hits = lookupVi(t.t);
      parts.push({ s: hits.length ? ZV[hits[0]][1] : t.t, w: true });
    });
    return parts.map(function (p) { return p.s; }).join("").replace(/\s+/g, " ").trim();
  }

  // ================= 視圖 =================
  var tabs = $("tabs"), dictView = $("dictView"), aiView = $("aiView");
  var dictBar = $("dictBar"), aiBar = $("aiBar"), countEl = $("count");

  function footer() {
    countEl.textContent = st.view === "ai"
      ? t("foot.ai", { n: ZV.length.toLocaleString() })
      : t("foot.count", { n: ZV.length.toLocaleString() });
  }

  var VIEW_KEY = "hanviet.ui.view";

  function setView(v) {
    st.view = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    dictView.hidden = v !== "dict";
    aiView.hidden = v !== "ai";
    dictBar.hidden = v !== "dict";
    aiBar.hidden = v !== "ai";
    Array.prototype.forEach.call(tabs.querySelectorAll(".tab"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === v);
    });
    hidePop();
    if (v === "ai") { warmVi(); viPhrases(); }
    footer();
  }

  Array.prototype.forEach.call(tabs.querySelectorAll(".tab"), function (b) {
    b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
  });

  // ================= 方向控制 =================
  var dirSeg = $("dirSeg"), scriptSeg = $("scriptSeg"), dirHint = $("dirHint"), src = $("src");

  function refreshDir() {
    dirHint.textContent = dirLabel();
    src.placeholder = placeholder();
    src.classList.toggle("vi", st.dir === "vi2zh");
    scriptSeg.hidden = st.dir !== "vi2zh";
    lastSample = "";
  }

  Array.prototype.forEach.call(dirSeg.querySelectorAll("button"), function (b) {
    b.addEventListener("click", function () {
      st.dir = b.getAttribute("data-dir");
      Array.prototype.forEach.call(dirSeg.querySelectorAll("button"), function (x) {
        x.classList.toggle("on", x === b);
      });
      saveOpts();
      clearOut();
      refreshDir();
    });
  });
  Array.prototype.forEach.call(scriptSeg.querySelectorAll("button"), function (b) {
    b.addEventListener("click", function () {
      st.script = b.getAttribute("data-script");
      Array.prototype.forEach.call(scriptSeg.querySelectorAll("button"), function (x) {
        x.classList.toggle("on", x === b);
      });
      saveOpts();
      clearOut();
      refreshDir();
    });
  });

  // 還原上次的選項狀態（方向／簡繁）
  Array.prototype.forEach.call(dirSeg.querySelectorAll("button"), function (x) {
    x.classList.toggle("on", x.getAttribute("data-dir") === st.dir);
  });
  Array.prototype.forEach.call(scriptSeg.querySelectorAll("button"), function (x) {
    x.classList.toggle("on", x.getAttribute("data-script") === st.script);
  });
  refreshDir();

  // ================= 翻譯流程 =================
  var goBtn = $("go"), errBox = $("err"), errMsg = $("errMsg");
  var lastSample = "";

  function clearOut() {
    $("out").hidden = true;
    errBox.hidden = true;
    st.out = "";
  }
  function showErr(msg, raw) {
    errMsg.innerHTML = esc(msg) + (raw ? '<div style="opacity:.6;font-size:10.5px;margin-top:6px">' + esc(raw) + "</div>" : "");
    errBox.hidden = false;
  }

  function run() {
    var text = src.value.trim();
    if (!text || st.busy) return;
    st.busy = true;
    goBtn.disabled = true;
    goBtn.textContent = t("ai.busy");
    errBox.hidden = true;
    warmVi();
    viPhrases();
    var t0 = Date.now();
    callApi(text).then(function (out) {
      var ms = Date.now() - t0;
      renderOut(out, st.dir === "zh2vi" ? "vi" : "zh",
        out.split("\n").length > 1 ? "Index-Translate · " + (ms / 1000).toFixed(1) + "s"
          : "Index-Translate · " + (ms / 1000).toFixed(1) + "s");
    }).catch(function (e) {
      var m = String(e && e.message || e);
      if (e && e.name === "AbortError") m = t("ai.err.timeout");
      showErr(t("ai.err.title", { msg: m }), t("ai.err.hint"));
      $("out").hidden = true;
    }).then(function () {
      st.busy = false;
      goBtn.disabled = false;
      goBtn.textContent = t("ai.go");
    });
  }

  goBtn.addEventListener("click", run);
  src.addEventListener("input", function () {
    var n = src.value.length;
    $("srcCount").textContent = n ? n : "0";
    $("clearSrc").hidden = !n;
    if (src.value.length > 3000) $("srcCount").textContent = t("ai.lenWarn", { n: n });
  });
  src.addEventListener("keydown", function (ev) {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); run(); }
  });
  $("clearSrc").addEventListener("click", function () {
    src.value = "";
    $("srcCount").textContent = "0";
    $("clearSrc").hidden = true;
    clearOut();
    src.focus();
  });
  $("sample").addEventListener("click", function () {
    src.value = sampleText();
    $("srcCount").textContent = src.value.length;
    $("clearSrc").hidden = false;
    src.focus();
  });
  $("again").addEventListener("click", run);

  $("copy").addEventListener("click", function () {
    var out = st.out;
    var done = function () {
      var b = $("copy");
      b.textContent = t("ai.copied");
      setTimeout(function () { b.textContent = t("ai.copy"); }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out).then(done, fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = out;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  });

  $("offline").addEventListener("click", function () {
    var text = src.value.trim();
    if (!text) return;
    warmVi();
    renderOut(offlineTranslate(text), st.dir === "zh2vi" ? "vi" : "zh", t("ai.out.offline"));
    var tip = document.querySelector("#out .tip");
    if (tip) tip.textContent = t("ai.tip.offline");
    errBox.hidden = true;
  });

  $("toCfg").addEventListener("click", function () {
    $("cfg").open = true;
    $("cfg").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // ================= 設定面板 =================
  function fillCfg() {
    var c = loadCfg();
    $("cfgBase").value = c.base;
    $("cfgModel").value = c.model;
    $("cfgKey").value = c.key;
  }
  fillCfg();
  $("cfgSave").addEventListener("click", function () {
    saveCfg({
      base: $("cfgBase").value.trim() || DEF.base,
      model: $("cfgModel").value.trim() || DEF.model,
      key: $("cfgKey").value.trim() || DEF.key
    });
    $("cfgSave").textContent = t("ai.cfg.saved");
    setTimeout(function () { $("cfgSave").textContent = t("ai.cfg.save"); }, 1200);
  });
  $("cfgReset").addEventListener("click", function () {
    saveCfg(DEF);
    fillCfg();
  });

  // ================= 彈窗事件 =================
  tokensEl.addEventListener("pointerover", function (ev) {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    var el = ev.target.closest(".tok");
    if (!el) return;
    clearTimeout(hideTimer);
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { showPop(el); }, 110);
  });
  tokensEl.addEventListener("pointerout", function (ev) {
    if (ev.pointerType && ev.pointerType !== "mouse") return;
    if (!ev.target.closest(".tok")) return;
    clearTimeout(hoverTimer);
    hideTimer = setTimeout(hidePop, 150);
  });
  tokensEl.addEventListener("click", function (ev) {
    var el = ev.target.closest(".tok");
    if (!el) return;
    if (curTok === el && !pop.hidden) { hidePop(); return; }
    showPop(el);
  });
  pop.addEventListener("click", function (ev) {
    var f = ev.target.closest("[data-open]");
    if (!f) return;
    var i = +f.getAttribute("data-open");
    hidePop();
    if (HV.detail) HV.detail(i);
  });
  document.addEventListener("click", function (ev) {
    if (pop.hidden) return;
    if (ev.target.closest("#pop") || ev.target.closest(".tok")) return;
    hidePop();
  });
  window.addEventListener("scroll", hidePop, { passive: true });
  window.addEventListener("resize", hidePop);
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") hidePop();
  });

  // ================= 初始化 =================
  document.addEventListener("langchange", function () {
    refreshDir();
    footer();
  });

  var qs = new URLSearchParams(location.search);
  var wantView = qs.get("view");
  if (wantView !== "ai" && wantView !== "dict") {
    try { wantView = localStorage.getItem(VIEW_KEY) || ""; } catch (e) { wantView = ""; }
  }
  if (wantView === "ai") {
    setView("ai");
    if (qs.get("q")) {
      src.value = qs.get("q");
      $("srcCount").textContent = src.value.length;
      $("clearSrc").hidden = false;
    }
    if (qs.get("go") === "1") setTimeout(run, 60);
  } else {
    setView("dict");
    footer();
  }
})();
