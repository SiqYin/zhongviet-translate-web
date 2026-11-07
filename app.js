(function () {
  "use strict";

  var ZV = window.ZV || [];          // [trad, simp, pinyin, senses, hanviet, nom]
  var NOMDATA = window.NOMDATA || [];

  var MAX = 60;
  var bySimp = new Map(), byTrad = new Map();
  ZV.forEach(function (e, i) {
    if (!bySimp.has(e[1])) bySimp.set(e[1], i);
    if (!byTrad.has(e[0])) byTrad.set(e[0], i);
  });

  // 越南語詞 -> 字喃（來自 Chunom 詞庫）
  var NOM = new Map();
  NOMDATA.forEach(function (p) {
    var k = (p[0] || "").toLowerCase();
    if (k && !NOM.has(k)) NOM.set(k, p[1]);
  });

  var SPLIT = /[^0-9a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+/;

  function tokens(s) {
    return (s || "").toLowerCase().split(SPLIT).filter(Boolean);
  }

  // ---------- 越南語去聲調（1:1 字符映射，便於對齊原串） ----------
  var DEACC = (function () {
    var pairs = {
      a: "àáảãạăằắẳẵặâầấẩẫậ",
      e: "èéẻẽẹêềếểễệ",
      i: "ìíỉĩị",
      o: "òóỏõọôồốổỗộơờớởỡợ",
      u: "ùúủũụưừứửữự",
      y: "ỳýỷỹỵ",
      d: "đ"
    };
    var m = {};
    for (var base in pairs) {
      var str = pairs[base];
      for (var i = 0; i < str.length; i++) m[str.charAt(i)] = base;
    }
    return m;
  })();

  function deacc(s) {
    var str = String(s || "");
    if (str.normalize) str = str.normalize("NFC");
    var out = "";
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      out += DEACC[c] || c;
    }
    return out;
  }


  // ---------- 拼音 -> 注音 ----------
  var ZY_INIT = [["zh","ㄓ"],["ch","ㄔ"],["sh","ㄕ"],["b","ㄅ"],["p","ㄆ"],["m","ㄇ"],["f","ㄈ"],
    ["d","ㄉ"],["t","ㄊ"],["n","ㄋ"],["l","ㄌ"],["g","ㄍ"],["k","ㄎ"],["h","ㄏ"],
    ["j","ㄐ"],["q","ㄑ"],["x","ㄒ"],["r","ㄖ"],["z","ㄗ"],["c","ㄘ"],["s","ㄙ"]];
  var ZY_FIN = {"a":"ㄚ","o":"ㄛ","e":"ㄜ","ai":"ㄞ","ei":"ㄟ","ao":"ㄠ","ou":"ㄡ","an":"ㄢ","en":"ㄣ",
    "ang":"ㄤ","eng":"ㄥ","er":"ㄦ","i":"ㄧ","ia":"ㄧㄚ","ie":"ㄧㄝ","iao":"ㄧㄠ","iu":"ㄧㄡ",
    "ian":"ㄧㄢ","in":"ㄧㄣ","iang":"ㄧㄤ","ing":"ㄧㄥ","iong":"ㄩㄥ","u":"ㄨ","ua":"ㄨㄚ","uo":"ㄨㄛ",
    "uai":"ㄨㄞ","ui":"ㄨㄟ","uan":"ㄨㄢ","un":"ㄨㄣ","uang":"ㄨㄤ","ong":"ㄨㄥ","ü":"ㄩ","üe":"ㄩㄝ",
    "ue":"ㄩㄝ","üan":"ㄩㄢ","ün":"ㄩㄣ"};
  var ZY_TONE = {1:"",2:"ˊ",3:"ˇ",4:"ˋ",5:"˙"};
  var ZY_MARK = {"ā":"a","á":"a","ǎ":"a","à":"a","ē":"e","é":"e","ě":"e","è":"e","ī":"i","í":"i",
    "ǐ":"i","ì":"i","ō":"o","ó":"o","ǒ":"o","ò":"o","ū":"u","ú":"u","ǔ":"u","ù":"u","ǖ":"ü",
    "ǘ":"ü","ǚ":"ü","ǜ":"ü"};

  function zhuyinSyl(tok) {
    var m = /^([A-Za-zü:āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+)([0-5])?$/.exec(tok);
    if (!m) return "";
    var body = m[1], tone = parseInt(m[2] || "1", 10), mark = 0, erhua = false;
    if (body.length > 1 && body.slice(-1) === "r") { erhua = true; body = body.slice(0, -1); }
    body = body.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, function (c) {
      var t = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ".indexOf(c) % 4 + 1;
      mark = t;
      return ZY_MARK[c];
    });
    if (mark) tone = mark;
    body = body.toLowerCase().replace(/u:/g, "ü");
    if (body.charAt(0) === "y") {
      var r = body.slice(1);
      body = r === "" ? "i" : (r.charAt(0) === "u" ? "ü" + r.slice(1) : (r === "ong" ? "iong" : "i" + r));
    } else if (body.charAt(0) === "w") {
      var r2 = body.slice(1);
      body = r2 ? "u" + r2 : "u";
    }
    var ini = "";
    for (var i = 0; i < ZY_INIT.length; i++) {
      if (body.indexOf(ZY_INIT[i][0]) === 0) { ini = ZY_INIT[i][1]; body = body.slice(ZY_INIT[i][0].length); break; }
    }
    var fin = "";
    if (body && !(/^[iuü]$/.test(body) && /[ㄓㄔㄕㄖㄗㄘㄙ]/.test(ini))) fin = ZY_FIN[body] || "";
    if (tone === 5) return "˙" + ini + fin + (erhua ? "ㄦ" : "");
    return ini + fin + (ZY_TONE[tone] || "") + (erhua ? "ㄦ" : "");
  }

  function zhuyin(py) {
    return (py || "").split(" ").map(zhuyinSyl).filter(Boolean).join(" ");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function senses(e) {
    return (e[3] || "").split("；").filter(Boolean);
  }

  function firstSense(e) {
    return senses(e)[0] || "";
  }

  // ---------- 中 -> 越 ----------
  function searchZh(q) {
    var exact = [], rest = [];
    var i = bySimp.has(q) ? bySimp.get(q) : byTrad.has(q) ? byTrad.get(q) : -1;
    if (i > -1) exact.push(i);
    for (var k = 0; k < ZV.length; k++) {
      if (k === i) continue;
      var s = ZV[k][1], t = ZV[k][0];
      if (s.indexOf(q) === 0 || t.indexOf(q) === 0) rest.push(k);
      else if (s.length <= 6 && (s.indexOf(q) > -1 || t.indexOf(q) > -1)) rest.push(k);
      if (rest.length > 400) break;
    }
    rest.sort(function (a, b) { return ZV[a][1].length - ZV[b][1].length; });
    return { exact: exact, rest: rest.slice(0, MAX) };
  }

  // ---------- 越南語免聲調查詢：按可能對應的音節分組 ----------
  var SNORM = null;

  function buildNormIndex() {
    if (SNORM) return;
    var arr = new Array(ZV.length);
    for (var i = 0; i < ZV.length; i++) {
      var e = ZV[i];
      var ss = (e[3] || "").split("；");
      var norms = new Array(ss.length);
      for (var j = 0; j < ss.length; j++) {
        norms[j] = deacc(ss[j].toLowerCase().replace(/[（(][^）)]*[）)]/g, " ")
          .replace(/[.,;:!?"'”’\]]+$/, "").trim());
      }
      arr[i] = norms;
    }
    SNORM = arr;
  }

  function senseRaw(i, j) {
    var ss = ZV[i][3].split("；");
    return (ss[j] || "").toLowerCase().replace(/[（(][^）)]*[）)]/g, " ")
      .replace(/[.,;:!?"'”’\]]+$/, "").trim();
  }

  function searchViVariants(key) {
    buildNormIndex();
    var groups = new Map();
    for (var i = 0; i < ZV.length; i++) {
      var e = ZV[i];
      var norms = SNORM[i];
      if (!norms) continue;
      var single = e[1].length === 1;
      for (var j = 0; j < norms.length; j++) {
        var ns = norms[j];
        if (!ns) continue;
        var idx = ns.indexOf(key);
        while (idx > -1) {
          // 必須落在音節邊界（「ngà」裡的「ga」不算），結尾也不能切在音節中間
          var headOk = idx === 0 || ns.charAt(idx - 1) === " ";
          var endC = ns.charAt(idx + key.length);
          var tailOk = idx + key.length >= ns.length || !/[a-z]/.test(endC);
          if (headOk && tailOk) break;
          idx = ns.indexOf(key, idx + 1);
        }
        if (idx < 0) continue;
        // 單字條目只在整個義項等於查詢時才出場，否則都是「拿漢字硬湊」
        if (single && ns !== key) continue;
        var raw = senseRaw(i, j);
        var surface = raw.substr(idx, key.length);
        if (!surface) continue;
        var g = groups.get(surface);
        if (!g) { g = { surface: surface, rows: [], seen: {}, best: 9 }; groups.set(surface, g); }
        if (g.seen[i]) continue;
        g.seen[i] = 1;
        var sc = idx === 0 ? (ns.length === key.length ? 0 : 1) : 2;
        if (sc < g.best) g.best = sc;
        g.rows.push([sc, i, raw]);
      }
    }
    function rowScore(x, surface) {
      var e = ZV[x[1]];
      var f = (senses(e)[0] || "").toLowerCase().replace(/[（(][^）)]*[）)]/g, " ").trim();
      var startPen = f.indexOf(surface) === 0 ? 0 : 10;
      var L = zhLen(e[1]);
      var lw = L === 2 ? 0 : L === 3 ? 1 : L === 1 ? 8 : 2;
      return startPen + lw;
    }

    var out = [];
    groups.forEach(function (g) {
      var order = (window.VI2ZH && window.VI2ZH[g.surface]) || null;
      g.rows.sort(function (a, b) {
        return a[0] - b[0] || viRank(a[1], order) - viRank(b[1], order) ||
          rowScore(a, g.surface) - rowScore(b, g.surface) ||
          ZV[a[1]][1].length - ZV[b[1]][1].length;
      });
      out.push({
        surface: g.surface,
        rows: g.rows,
        total: g.rows.length,
        best: g.best
      });
    });
    out.sort(function (a, b) {
      return a.best - b.best || b.total - a.total ||
        a.surface.length - b.surface.length ||
        (a.surface < b.surface ? -1 : a.surface > b.surface ? 1 : 0);
    });
    return out.slice(0, 8);
  }

  // ---------- 越 -> 中 ----------
  // VI2ZH（build_vi2zh.py 產出）：越南語詞 -> 精排後的中文對應詞
  // 字符長度按碼點算（CJK 擴展區的生僻字是代理對，length 會翻倍）
  function zhLen(s) {
    return s.length - (s.match(/[\uD800-\uDBFF]/g) || []).length;
  }

  function viRank(i, order) {
    if (!order || !order.length) return 99;
    var k = order.indexOf(ZV[i][1]);
    return k < 0 ? 99 : k;
  }

  // 候選中文詞的啟發式分（越小越好）：義項位置 > 二字詞 > 有字喃/漢越音
  function zhCandScore(i, j) {
    var e = ZV[i], L = zhLen(e[1]);
    var s = (j || 0) * 4;
    s += L === 2 ? 0 : L === 3 ? 4 : 6;
    if (e[5]) s -= 1;
    if (!e[4]) s += 1;
    return s;
  }

  // 家族行排序：首義項命中 > 二字詞 > 義項短
  function viRowScore(i, raw) {
    var e = ZV[i], L = zhLen(e[1]);
    var s = L === 2 ? 0 : L === 3 ? 2 : L >= 4 ? 4 : 8;
    if ((senses(e)[0] || "") === raw) s -= 2;
    s += Math.min(raw.split(/\s+/).length, 8) * 0.3;
    return s;
  }

  function searchVi(q) {
    var key = q.toLowerCase().trim().replace(/\s+/g, " ");
    if (!key) return { key: "", hero: [], starts: [], contains: [] };
    var normKey = deacc(key);
    if (normKey === key && /[a-z]/.test(key)) {
      var vg = searchViVariants(normKey);
      if (vg.length) return { variants: vg, key: key, hero: [], starts: [], contains: [] };
    }
    var isPhrase = tokens(key).length > 1;
    var hero = [], starts = [], contains = [];
    var heroSeen = {}, startSeen = {};
    var exactC = [];
    for (var i = 0; i < ZV.length; i++) {
      var e = ZV[i], L = zhLen(e[1]);
      var ss = senses(e), bestJ = -1;
      for (var j = 0; j < ss.length; j++) {
        var raw = senseRaw(i, j);
        if (!raw) continue;
        if (raw === key && (bestJ < 0 || j < bestJ)) bestJ = j;
        if (L < 2) continue;                    // 單字只進精確對應，不進短語族
        if (raw.indexOf(key) === 0 && raw.length > key.length) {
          if (!startSeen[i]) { startSeen[i] = 1; starts.push([i, raw]); }
        } else if (tokens(raw).indexOf(key) > -1 && !startSeen[i]) {
          contains.push([i, raw]);
        }
      }
      if (bestJ > -1) exactC.push([i, bestJ]);
    }
    // 主對應：VI2ZH 精排在前（回校驗該條確有此義項），其餘按啟發式
    var order = (window.VI2ZH && window.VI2ZH[key]) || [];
    var exactSet = {};
    exactC.forEach(function (x) { exactSet[x[0]] = 1; });
    order.forEach(function (zh) {
      var i2 = bySimp.get(zh);
      if (i2 == null || heroSeen[i2] || !exactSet[i2]) return;
      heroSeen[i2] = 1; hero.push(i2);
    });
    exactC.sort(function (a, b) { return zhCandScore(a[0], a[1]) - zhCandScore(b[0], b[1]); });
    exactC.sort(function (a, b) {           // 兜底時單字放多字詞後面（AI 精排過的不受影響）
      var sa = zhLen(ZV[a[0]][1]) === 1 ? 1 : 0, sb = zhLen(ZV[b[0]][1]) === 1 ? 1 : 0;
      return sa - sb;
    });
    exactC.forEach(function (x) {
      if (!heroSeen[x[0]]) { heroSeen[x[0]] = 1; hero.push(x[0]); }
    });
    hero = hero.slice(0, 6);
    starts.sort(function (a, b) { return viRowScore(a[0], a[1]) - viRowScore(b[0], b[1]); });
    contains.sort(function (a, b) { return viRowScore(a[0], a[1]) - viRowScore(b[0], b[1]); });
    return {
      key: key,
      hero: hero,
      starts: starts.slice(0, 12),
      contains: contains.filter(function (x) { return !startSeen[x[0]]; }).slice(0, 12)
    };
  }

  var resultsEl = document.getElementById("results");
  var emptyEl = document.getElementById("empty");
  var countEl = document.getElementById("count");
  var input = document.getElementById("q");
  var clearBtn = document.getElementById("clear");

  // 字喃一律用字喃字體（漢喃詞如「暫時」「机関」同屬字喃寫法）
  function nomTag(nom, cls) {
    return nom ? '<span class="' + (cls || "nom-sm") + '">' + esc(nom) + "</span>" : "";
  }

  // 中文詞條（主卡）
  function heroCard(i, q) {
    var e = ZV[i];
    var primary = firstSense(e);
    var fam = familyZh(primary, i, q);
    fam.key = primary;
    var tr = e[0] !== e[1] ? e[0] : "";

    var html = '<article class="hero" data-i="' + i + '" data-kind="zv">' +
      '<div class="hero-head">' +
        '<div class="hz">' + esc(e[1]) + "</div>" +
        '<div class="hz-side">' +
          '<div class="py">' + esc(e[2]) + "</div>" +
          '<div class="zy">' + esc(zhuyin(e[2])) + "</div>" +
          (tr ? '<div class="trad">' + esc(tr) + "</div>" : "") +
          (e[4] ? '<div class="hv">' + t("detail.hv") + " " + esc(e[4]) + "</div>" : "") +
        "</div>" +
      "</div>" +
      '<div class="answer"><span class="vi-big">' + esc(primary) + nomTag(e[5]) + "</span></div>";

    var others = senses(e).slice(1);
    if (others.length) html += '<div class="senses">' + others.map(esc).join("；") + "</div>";

    html += famBlock(fam);
    return html + "</article>";
  }

  function famBlock(fam) {
    var html = "";
    if (fam.starts.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.starts", { w: fam.key || "" })) + "</div>";
      fam.starts.forEach(function (k) { html += famRow(k); });
      html += "</div>";
    }
    if (fam.contains.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.contains", { w: fam.key || "" })) + "</div>";
      fam.contains.forEach(function (k) { html += famRow(k); });
      html += "</div>";
    }
    return html;
  }

  function famRow(k) {
    var f = ZV[k];
    return '<div class="fam-row" data-i="' + k + '" data-kind="zv">' +
      '<span class="fz">' + esc(f[1]) + "</span>" +
      '<span class="fv">' + esc(firstSense(f)) + "</span>" +
      nomTag(f[5]) + "</div>";
  }

  function famScore(i, key) {
    var e = ZV[i], zh = e[1], ss = senses(e);
    var lenScore = zh.length === 2 ? 0 : zh.length === 3 ? 1 : zh.length === 1 ? 4 : 2;
    var first = (ss[0] || "").toLowerCase();
    var start = first.indexOf(key) === 0 ? 0 : 5;
    return lenScore * 100 + start * 10 + ss.length + Math.min((ss[0] || "").length, 40) / 1000;
  }

  // 回傳兩組：以該詞開頭、以及包含該詞
  function familyZh(primary, skip, q) {
    var key = primary.toLowerCase();
    var starts = [], contains = [];
    if (!key) return { starts: starts, contains: contains };
    for (var i = 0; i < ZV.length; i++) {
      if (i === skip) continue;
      var e = ZV[i];
      if (e[1].length > 6) continue;
      if (q && e[1].indexOf(q) === -1 && e[0].indexOf(q) === -1) continue;
      if (tokens(e[3] || "").indexOf(key) === -1) continue;
      var first = (senses(e)[0] || "").toLowerCase();
      (first.indexOf(key) === 0 ? starts : contains).push(i);
    }
    starts.sort(function (a, b) { return famScore(a, key) - famScore(b, key); });
    contains.sort(function (a, b) { return famScore(a, key) - famScore(b, key); });
    return { starts: starts.slice(0, 12), contains: contains.slice(0, 10) };
  }

  function compactCard(i) {
    var e = ZV[i];
    return '<article class="card" data-i="' + i + '" data-kind="zv">' +
      '<div class="row1">' +
        '<div class="hz-sm">' + esc(e[1]) + "</div>" +
        '<div class="word">' +
          '<div class="vi">' + esc(firstSense(e)) + "</div>" +
          '<div class="zh">' + esc(e[2]) + (e[4] ? " · " + t("detail.hv") + " " + esc(e[4]) : "") + "</div>" +
        "</div>" +
        (e[5] ? '<div class="nom-r">' + esc(e[5]) + "</div>" : "") +
      "</div></article>";
  }

  // 越南語查詢：以越南語詞為入口，給出對應中文翻譯與短語族
  function viHeroRow(i, raw, surface) {
    var e = ZV[i];
    var ctx = raw && surface && raw !== surface ? raw : "";
    return '<div class="fam-row viz" data-i="' + i + '" data-kind="zv">' +
      (ctx ? '<span class="fv">' + esc(ctx) + "</span>" : "") +
      '<span class="fz">' + esc(e[1]) + "</span>" +
      '<span class="fpy">' + esc(e[2]) + "</span>" +
      "</div>";
  }

  function viHero(q) {
    var r = searchVi(q);
    if (r.variants && r.variants.length) {
      var vh = '<article class="hero vihero">' +
        '<div class="hero-head"><div class="hz vi-big">' + esc(q.trim()) + "</div></div>";
      r.variants.forEach(function (g) {
        vh += '<div class="fam"><div class="fam-title var-title">' +
          '<span class="vt">' + esc(g.surface) + "</span>" +
          '<span class="vn">' + esc(t("vi.hero.label")) + " · " + g.total + "</span></div>";
        g.rows.slice(0, 8).forEach(function (x) {
          vh += viHeroRow(x[1], x[2], g.surface);
        });
        vh += "</div>";
      });
      var vtotal = r.variants.reduce(function (a, g) { return a + g.total; }, 0);
      return { html: vh + "</article>", count: vtotal, top: r.variants[0].rows[0][1] };
    }
    if (!r.hero.length && !r.starts.length && !r.contains.length) return null;
    var nom = NOM.get(r.key) || "";
    var html = '<article class="hero vihero">' +
      '<div class="hero-head">' +
        '<div class="hz vi-big">' + esc(q.trim()) + "</div>" +
        '<div class="hz-side">' + nomTag(nom, "nom-sm") + "</div>" +
      "</div>";
    if (r.hero.length) {
      var top = ZV[r.hero[0]];
      html += '<div class="answer"><span class="hz-big">' + esc(top[1]) + "</span>" +
        '<span class="hz-meta"><span class="py">' + esc(top[2]) + "</span>" +
        '<span class="zy">' + esc(zhuyin(top[2])) + "</span>" +
        (top[0] !== top[1] ? '<span class="trad">' + esc(top[0]) + "</span>" : "") +
        (top[4] ? '<span class="hv">' + t("detail.hv") + " " + esc(top[4]) + "</span>" : "") +
        "</span></div>";
    }
    if (r.hero.length > 1) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("vi.hero.label")) + "</div>";
      r.hero.slice(1, 6).forEach(function (i) { html += viHeroRow(i, "", ""); });
      html += "</div>";
    }
    if (r.starts.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.starts", { w: r.key })) + "</div>";
      r.starts.forEach(function (x) { html += viHeroRow(x[0], x[1], r.key); });
      html += "</div>";
    }
    if (r.contains.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.contains", { w: r.key })) + "</div>";
      r.contains.forEach(function (x) { html += viHeroRow(x[0], x[1], r.key); });
      html += "</div>";
    }
    return { html: html + "</article>", count: r.hero.length + r.starts.length + r.contains.length, top: r.hero[0] };
  }

  // 越南語詞的完整詞條（彈窗「查看完整詞條」用）：主卡 + 該詞條的雙語例句
  function viDetail(q) {
    var h = viHero(q);
    if (!h) {
      openSheet('<div class="det-hz vi-big">' + esc(String(q).trim()) + "</div>" +
        '<div class="pop-none">' + t("pop.noZh") + "</div>");
      return;
    }
    var ex = h.top != null ? ZV[h.top][6] : null;
    openSheet(h.html + exampleBlock(ex));
  }

  function render(q) {
    q = (q || "").trim();
    var histBox = document.getElementById("histDict");
    if (!q) {
      resultsEl.innerHTML = "";
      emptyEl.hidden = true;
      if (histBox) histRender(histBox);
      return;
    }
    if (histBox) histBox.hidden = true;
    var isCJK = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(q);
    input.classList.toggle("zh", isCJK);
    input.classList.toggle("vi", !isCJK);
    var html = "", n = 0;

    if (isCJK) {
      var r = searchZh(q);
      if (r.exact.length) { html += heroCard(r.exact[0], q); n++; }
      r.rest.forEach(function (i) { html += compactCard(i); n++; });
    } else {
      var h = viHero(q);
      if (h && h.html) { html += h.html; n = h.count || 1; }
    }

    resultsEl.innerHTML = html;
    emptyEl.hidden = n > 0;
    countEl.textContent = n ? t("foot.count1", { n: n }) : t("foot.none");
  }

  // ---------- 查詞記錄 ----------
  var HIST_KEY = "hanviet.hist.dict";

  function histLoad() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]") || []; } catch (e) { return []; }
  }
  function histSave(list) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 40))); } catch (e) {}
  }
  function histRecord(q) {
    q = (q || "").trim();
    if (!q || q.length > 60) return;
    var list = histLoad().filter(function (x) { return x !== q; });
    list.unshift(q);
    histSave(list);
  }
  function histRender(box) {
    var list = histLoad();
    if (!list.length) { box.hidden = true; return; }
    var h = '<div class="hist-head"><span>' + esc(t("hist.dict")) + "</span>" +
      '<button type="button" class="linky" data-hclear>' + esc(t("hist.clear")) + "</button></div>" +
      '<div class="hist-chips">';
    list.slice(0, 24).forEach(function (w) {
      h += '<button type="button" class="chip" data-hw="' + esc(w) + '">' + esc(w) + "</button>";
    });
    box.innerHTML = h + "</div>";
    box.hidden = false;
  }

  var histBoxEl = document.getElementById("histDict");
  if (histBoxEl) {
    histBoxEl.addEventListener("click", function (ev) {
      var c = ev.target.closest("[data-hclear]");
      if (c) { histSave([]); histRender(histBoxEl); return; }
      var chip = ev.target.closest("[data-hw]");
      if (!chip) return;
      input.value = chip.getAttribute("data-hw");
      clearBtn.hidden = false;
      render(input.value);
    });
  }

  // 例句：中/越雙語都拆詞，每個詞可點擊查詞（彈窗能力由 translate.js 提供）
  function tokHtml(text, lang) {
    text = String(text || "");
    var seg = lang === "zh" ? HV.segZh : HV.segVi;
    if (!seg) return esc(text);
    var toks = seg(text), html = [];
    for (var i = 0; i < toks.length; i++) {
      var tk = toks[i];
      var lead = tk.lead ? esc(tk.lead) : "";
      if (tk.w) html.push(lead + '<span class="tok" data-t="' + esc(tk.lookup || tk.t) + '">' + esc(tk.t) + "</span>");
      else html.push(lead + '<span class="glue">' + esc(tk.t) + "</span>");
    }
    return html.join("");
  }

  function exampleBlock(ex) {
    if (!ex || !ex[0]) return "";
    return '<div class="det-ex"><div class="det-ex-h">' + t("detail.example") + "</div>" +
      '<div class="det-ex-zh tokline zh exline">' + tokHtml(ex[0], "zh") + "</div>" +
      '<div class="det-ex-vi tokline vi exline">' + tokHtml(ex[1], "vi") + "</div></div>";
  }

  function detailZv(i) {
    var e = ZV[i];
    var fam = familyZh(firstSense(e), i);
    fam.key = firstSense(e);
    var html = '<div class="det-hz">' + esc(e[1]) + "</div>" +
      '<div class="det-vi">' + esc(firstSense(e)) + nomTag(e[5], "nom-md") + "</div>" +
      '<div class="det-senses">' + esc(e[3]) + "</div>" +
      exampleBlock(e[6]) +
      '<dl class="defs">' +
      '<div class="def"><dt>' + t("detail.pinyin") + '</dt><dd>' + esc(e[2]) + "</dd></div>" +
      (e[0] !== e[1] ? '<div class="def"><dt>' + t("detail.trad") + '</dt><dd>' + esc(e[0]) + "</dd></div>" : "") +
      (e[4] ? '<div class="def"><dt>' + t("detail.hv") + '</dt><dd>' + esc(e[4]) + "</dd></div>" : "") +
      (e[5] ? '<div class="def"><dt>' + t("detail.nom") + '</dt><dd><span class="nomword">' + esc(e[5]) + "</span></dd></div>" : "") +
      "</dl>";
    html += famBlock(fam);
    openSheet(html);
  }

  var sheet = document.getElementById("sheet");
  var sheetBody = document.getElementById("sheet-body");

  function openSheet(html) {
    sheetBody.innerHTML = html;
    sheet.hidden = false;
    sheet.scrollTop = 0;
  }

  var timer = null, histTimer = null;
  input.addEventListener("input", function () {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(function () { render(input.value); }, 80);
    clearTimeout(histTimer);
    histTimer = setTimeout(function () { histRecord(input.value); }, 700);
  });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      clearTimeout(histTimer);
      histRecord(input.value);
    }
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    clearBtn.hidden = true;
    input.focus();
    render("");
  });

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-kind]");
    if (!el) return;
    detailZv(+el.getAttribute("data-i"));
  });

  document.getElementById("close").addEventListener("click", function () { sheet.hidden = true; });
  sheet.addEventListener("click", function (ev) { if (ev.target === sheet) sheet.hidden = true; });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") sheet.hidden = true;
    if (ev.key === "/" && document.activeElement !== input) { ev.preventDefault(); input.focus(); }
  });

  // 供翻譯頁共用同一份詞庫與詳情面板
  window.HV = {
    ZV: ZV, NOM: NOM, bySimp: bySimp, byTrad: byTrad,
    zhuyin: zhuyin, senses: senses, esc: esc,
    detail: detailZv, viDetail: viDetail, openSheet: openSheet
  };

  // ---------- 界面語言 ----------
  I18N.apply();
  document.title = t("app.name");
  var langBtn = document.getElementById("langBtn");
  var langDlg = document.getElementById("lang-dialog");
  function syncLangUI() {
    if (langBtn) langBtn.textContent = (I18N.names && I18N.names[I18N.lang()]) || "English";
    var list = document.getElementById("langlist");
    if (list) {
      Array.prototype.forEach.call(list.children, function (b) {
        var on = b.getAttribute("data-lang") === I18N.lang();
        b.classList.toggle("on", on);
        b.setAttribute("aria-current", on ? "true" : "false");
      });
    }
  }
  if (langBtn && langDlg) {
    langBtn.addEventListener("click", function () {
      syncLangUI();
      langDlg.hidden = false;
    });
    langDlg.addEventListener("click", function (ev) {
      if (ev.target === langDlg) { langDlg.hidden = true; return; }
      var lb = ev.target.closest("[data-lang]");
      if (!lb) return;
      var l = lb.getAttribute("data-lang");
      if (l && l !== I18N.lang()) {
        I18N.setLang(l);
        document.title = t("app.name");
        render(input.value);
        document.dispatchEvent(new Event("langchange"));
      }
      syncLangUI();
      langDlg.hidden = true;
    });
    syncLangUI();
  }

  // ---------- 外觀主題 ----------
  var THEME_KEY = "hanviet.ui.theme";
  var themeBtn = document.getElementById("themeBtn");
  var themeDlg = document.getElementById("theme-dialog");
  var mqDark = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function themePref() {
    try { return localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { return "auto"; }
  }

  function syncThemeBtn() {
    if (!themeBtn) return;
    var pref = themePref();
    themeBtn.setAttribute("data-mode", pref);
    themeBtn.title = t("theme." + pref);
  }

  function applyTheme() {
    var pref = themePref();
    var dark = pref === "dark" || (pref === "auto" && mqDark && mqDark.matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    syncThemeBtn();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#131116" : "#f7f4ee");
    var list = document.getElementById("themelist");
    if (list) {
      Array.prototype.forEach.call(list.children, function (b) {
        var on = b.getAttribute("data-theme-opt") === pref;
        b.classList.toggle("on", on);
        b.setAttribute("aria-current", on ? "true" : "false");
      });
    }
  }

  var THEME_CYCLE = ["light", "dark", "auto"];
  function cycleTheme() {
    var cur = themePref();
    var idx = THEME_CYCLE.indexOf(cur);
    var next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme();
  }

  if (themeBtn && themeDlg) {
    var pressTimer = null, longPressed = false;
    function cancelPress() { clearTimeout(pressTimer); pressTimer = null; }
    themeBtn.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      longPressed = false;
      cancelPress();
      pressTimer = setTimeout(function () {
        longPressed = true;
        applyTheme();
        themeDlg.hidden = false;
      }, 550);
    });
    themeBtn.addEventListener("pointerup", cancelPress);
    themeBtn.addEventListener("pointerleave", cancelPress);
    themeBtn.addEventListener("pointercancel", function () { longPressed = false; cancelPress(); });
    themeBtn.addEventListener("click", function () {
      if (longPressed) { longPressed = false; return; }
      cycleTheme();
    });
    themeBtn.addEventListener("contextmenu", function (ev) {
      ev.preventDefault();
      applyTheme();
      themeDlg.hidden = false;
    });
    themeDlg.addEventListener("click", function (ev) {
      if (ev.target === themeDlg) { themeDlg.hidden = true; return; }
      var tb = ev.target.closest("[data-theme-opt]");
      if (!tb) return;
      try { localStorage.setItem(THEME_KEY, tb.getAttribute("data-theme-opt")); } catch (e) {}
      applyTheme();
      themeDlg.hidden = true;
    });
    applyTheme();
    document.addEventListener("langchange", function () { applyTheme(); });
  }
  if (mqDark) {
    var onSys = function () { if (themePref() === "auto") applyTheme(); };
    if (mqDark.addEventListener) mqDark.addEventListener("change", onSys);
    else if (mqDark.addListener) mqDark.addListener(onSys);
  }

  countEl.textContent = t("foot.count", { n: ZV.length.toLocaleString() });

  var pre = new URLSearchParams(location.search).get("q");
  if (pre) {
    input.value = pre;
    clearBtn.hidden = false;
    render(pre);
  }

  // ---------- 更新檢測 ----------
  var APP_VERSION = "1.5.5";
  var UPD_DISMISS = "hanviet.update.dismissed";

  function verNum(s) {
    var m = String(s || "").match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }
  function verNewer(a, b) {
    for (var i = 0; i < 3; i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return false;
  }

  function showUpdateDialog(tag, url) {
    var box = document.getElementById("update-dialog");
    if (!box) return;
    var msgEl = document.getElementById("upd-msg");
    msgEl.textContent = t("update.msg", { v: tag });
    box.hidden = false;
    document.getElementById("upd-go").onclick = function () {
      window.open(url, "_blank");
      box.hidden = true;
    };
    document.getElementById("upd-later").onclick = function () {
      try { localStorage.setItem(UPD_DISMISS, tag); } catch (e) {}
      box.hidden = true;
    };
    document.addEventListener("langchange", function () {
      if (!box.hidden) msgEl.textContent = t("update.msg", { v: tag });
    });
  }

  function checkUpdate() {
    fetch("https://api.github.com/repos/SiqYin/zhongviet-translate/releases/latest")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.tag_name) return;
        var tag = d.tag_name.replace(/^v/i, "");
        var cur = verNum(APP_VERSION), lat = verNum(tag);
        if (!cur || !lat || !verNewer(lat, cur)) return;
        try { if (localStorage.getItem(UPD_DISMISS) === d.tag_name) return; } catch (e) {}
        showUpdateDialog(d.tag_name, d.html_url);
      })
      .catch(function () {});   // 離線或接口失敗：靜默
  }
  setTimeout(checkUpdate, 1200);

  // 空閒時預建越南語去聲調索引，首次免聲調查詢不必等待
  setTimeout(function () { try { buildNormIndex(); } catch (e) {} }, 1600);
})();
