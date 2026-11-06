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


  // ---------- 拼音 -> 注音 ----------
  var ZY_INIT = [["zh","ㄓ"],["ch","ㄔ"],["sh","ㄕ"],["b","ㄅ"],["p","ㄆ"],["m","ㄇ"],["f","ㄈ"],
    ["d","ㄉ"],["t","ㄊ"],["n","ㄋ"],["l","ㄌ"],["g","ㄍ"],["k","ㄎ"],["h","ㄏ"],
    ["j","ㄐ"],["q","ㄑ"],["x","ㄒ"],["r","ㄖ"],["z","ㄗ"],["c","ㄘ"],["s","ㄙ"]];
  var ZY_FIN = {"a":"ㄚ","o":"ㄛ","e":"ㄜ","ai":"ㄞ","ei":"ㄟ","ao":"ㄠ","ou":"ㄡ","an":"ㄢ","en":"ㄣ",
    "ang":"ㄤ","eng":"ㄥ","er":"ㄦ","i":"ㄧ","ia":"ㄧㄚ","ie":"ㄧㄝ","iao":"ㄧㄠ","iu":"ㄧㄡ",
    "ian":"ㄧㄢ","in":"ㄧㄣ","iang":"ㄧㄤ","ing":"ㄧㄥ","iong":"ㄩㄥ","u":"ㄨ","ua":"ㄨㄚ","uo":"ㄨㄛ",
    "uai":"ㄨㄞ","ui":"ㄨㄟ","uan":"ㄨㄢ","un":"ㄨㄣ","uang":"ㄨㄤ","ong":"ㄨㄥ","ü":"ㄩ","üe":"ㄩㄝ",
    "üan":"ㄩㄢ","ün":"ㄩㄣ"};
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

  // ---------- 越 -> 中：把該詞當作義項的中文詞（精確／開頭／包含三組） ----------
  function searchVi(q) {
    var key = q.toLowerCase().trim();
    if (!key) return { exact: [], starts: [], contains: [], key: "" };
    var isPhrase = tokens(key).length > 1;
    var exact = [], starts = [], contains = [];
    for (var i = 0; i < ZV.length; i++) {
      var e = ZV[i];
      if (e[1].length > 8) continue;
      var ss = senses(e), lv = 9, lvLen = 99, lvRaw = "";
      for (var j = 0; j < ss.length; j++) {
        var raw = ss[j].toLowerCase().replace(/[（(][^）)]*[）)]/g, " ")
          .replace(/[.,;:!?"'”’\]]+$/, "").trim();
        if (!raw) continue;
        var sc = 9;
        if (raw === key) sc = 0;
        else if (raw.indexOf(key) === 0) sc = 1;
        else if (isPhrase ? raw.indexOf(key) > -1 : tokens(raw).indexOf(key) > -1) sc = 2;
        else if (raw.indexOf(key) > -1) sc = 3;
        var wc = raw.split(/\s+/).length;
        if (sc < lv || (sc === lv && wc < lvLen)) {
          lv = sc; lvLen = wc; lvRaw = raw;
          if (lv === 0 && j === 0) break;
        }
      }
      if (lv === 0) exact.push([i, lvLen, lvRaw]);
      else if (lv === 1) starts.push([i, lvLen, lvRaw]);
      else if (lv < 9) contains.push([i, lvLen, lvRaw]);
    }
    // 排序：詞庫成詞（nhà nước）> 短語，命中義項越短越靠前，再看首義項與詞頭長度
    function ord(h) {
      var i = h[0], e = ZV[i], L = e[1].length;
      var lw = (L === 2 ? 0 : L === 1 ? 1 : L === 3 ? 2 : 3);
      var f = (senses(e)[0] || "").toLowerCase().replace(/[（(][^）)]*[）)]/g, " ").trim();
      var fPen = (f === key || f.indexOf(key) === 0) ? 0 : 1;
      var lexPen = NOM.has((h[2] || "").toLowerCase()) ? 0 : 1;
      return fPen * 100 + lexPen * 30 + h[1] * 4 + lw;
    }
    exact.sort(function (a, b) { return ord(a) - ord(b); });
    starts.sort(function (a, b) { return ord(a) - ord(b); });
    contains.sort(function (a, b) { return ord(a) - ord(b); });
    return {
      exact: exact.map(function (h) { return h[0]; }),
      starts: starts.map(function (h) { return h[0]; }),
      contains: contains.map(function (h) { return h[0]; }),
      key: key
    };
  }

  function viScore(i, key) {
    var e = ZV[i], ss = senses(e), best = 9;
    for (var j = 0; j < ss.length; j++) {
      var sv = ss[j].toLowerCase().trim();
      if (sv === key) { best = 0; break; }
      if (sv.indexOf(key) === 0) best = Math.min(best, 1);
      else if (tokens(sv).indexOf(key) > -1) best = Math.min(best, 2);
    }
    return best * 10 + (e[1].length === 1 ? 0 : e[1].length === 2 ? 1 : 2);
  }

  function viFamily(key) {
    var k = key.toLowerCase().trim();
    var out = [];
    if (!k) return out;
    var isPhrase = tokens(k).length > 1;
    for (var i = 0; i < ZV.length && out.length < 20; i++) {
      var e = ZV[i];
      if (e[1].length > 6) continue;
      var ss = senses(e);
      for (var j = 0; j < ss.length; j++) {
        var t = ss[j].toLowerCase();
        if (isPhrase ? t.indexOf(k) > -1 : tokens(t).indexOf(k) > -1) { out.push(i); break; }
      }
    }
    return out;
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

  // 越南語查詢：以越南語詞為入口，列出對應的中文詞
  function viHero(q) {
    var r = searchVi(q);
    if (!r.exact.length && !r.starts.length && !r.contains.length) return "";
    var nom = NOM.get(r.key) || "";
    var html = '<article class="hero vihero">' +
      '<div class="hero-head">' +
        '<div class="hz vi-big">' + esc(q.trim()) + "</div>" +
        '<div class="hz-side">' + nomTag(nom, "nom-sm") + "</div>" +
      "</div>";
    function rows(list, n) {
      var out = "";
      list.slice(0, n).forEach(function (i) {
        var e = ZV[i];
        out += '<div class="fam-row" data-i="' + i + '" data-kind="zv">' +
          '<span class="fz">' + esc(e[1]) + "</span>" +
          '<span class="fv">' + esc(e[2]) + "</span>" +
          "</div>";
      });
      return out;
    }
    if (r.exact.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("vi.hero.label")) + "</div>" + rows(r.exact, 10) + "</div>";
    }
    if (r.starts.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.starts", { w: r.key })) + "</div>" + rows(r.starts, 10) + "</div>";
    }
    if (r.contains.length) {
      html += '<div class="fam"><div class="fam-title">' + esc(t("fam.contains", { w: r.key })) + "</div>" + rows(r.contains, 16) + "</div>";
    }
    return html + "</article>";
  }

  function render(q) {
    q = (q || "").trim();
    if (!q) {
      resultsEl.innerHTML = "";
      emptyEl.hidden = true;
      return;
    }
    var isCJK = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(q);
    var html = "", n = 0;

    if (isCJK) {
      var r = searchZh(q);
      if (r.exact.length) { html += heroCard(r.exact[0], q); n++; }
      r.rest.forEach(function (i) { html += compactCard(i); n++; });
    } else {
      var h = viHero(q);
      if (h) { html += h; n = 1; }
    }

    resultsEl.innerHTML = html;
    emptyEl.hidden = n > 0;
    countEl.textContent = n ? t("foot.count1", { n: n }) : t("foot.none");
  }

  function detailZv(i) {
    var e = ZV[i];
    var fam = familyZh(firstSense(e), i);
    fam.key = firstSense(e);
    var html = '<div class="det-hz">' + esc(e[1]) + "</div>" +
      '<div class="det-vi">' + esc(firstSense(e)) + nomTag(e[5], "nom-md") + "</div>" +
      '<div class="det-senses">' + esc(e[3]) + "</div>" +
      (e[6] ? '<div class="det-ex"><div class="det-ex-h">' + t("detail.example") + "</div>" +
        '<div class="det-ex-zh">' + esc(e[6][0]) + "</div>" +
        '<div class="det-ex-vi">' + esc(e[6][1]) + "</div></div>" : "") +
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

  var timer = null;
  input.addEventListener("input", function () {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(function () { render(input.value); }, 80);
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
    detail: detailZv, openSheet: openSheet
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

  countEl.textContent = t("foot.count", { n: ZV.length.toLocaleString() });

  var pre = new URLSearchParams(location.search).get("q");
  if (pre) {
    input.value = pre;
    clearBtn.hidden = false;
    render(pre);
  }

  // ---------- 更新檢測 ----------
  var APP_VERSION = "1.4.1";
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
})();
