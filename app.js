/* HSE Interview Revision — application logic.
   Content lives in content.js and quiz.js. This file renders and grades. */

(function () {
  "use strict";

  var TOPICS = window.HSE_TOPICS || [];
  var BANK = window.HSE_QUIZ || [];

  var view = document.getElementById("view");
  var rail = document.getElementById("rail");
  var searchInput = document.getElementById("search");
  var searchWrap = document.getElementById("searchWrap");
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll(".mode"));

  var session = null;
  var testTopic = "all";
  var testCount = 10;

  /* ---------- helpers ---------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      });
    }
    add(el, children);
    return el;
  }

  function add(el, child) {
    if (child === null || child === undefined) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { add(el, c); });
      return;
    }
    if (typeof child === "string" || typeof child === "number") {
      el.appendChild(document.createTextNode(String(child)));
      return;
    }
    el.appendChild(child);
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function byId(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return null;
  }

  function topicTitle(id) {
    if (id === "all") return "All topics";
    var t = byId(id);
    return t ? t.title : id;
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* ---------- navigation ---------- */

  function renderRail(activeId) {
    clear(rail);
    var shell = document.querySelector(".shell");
    if (!activeId) {
      rail.style.display = "none";
      shell.classList.add("no-rail");
      return;
    }
    rail.style.display = "";
    shell.classList.remove("no-rail");

    var select = h("select", { class: "topic-select", "aria-label": "Topic" });
    [
      { key: "fixed", label: "Fixed categories" },
      { key: "expanded", label: "Expanded topics" }
    ].forEach(function (g) {
      var items = TOPICS.filter(function (t) { return (t.group || "fixed") === g.key; });
      if (!items.length) return;
      var og = h("optgroup", { label: g.label });
      items.forEach(function (t) {
        og.appendChild(h("option", { value: t.id, text: t.title }));
      });
      select.appendChild(og);
    });
    if (activeId) select.value = activeId;
    else {
      select.insertBefore(h("option", { value: "", text: "Choose a topic" }), select.firstChild);
      select.value = "";
    }
    select.addEventListener("change", function () {
      if (!select.value) return;
      location.hash = "#/read/" + select.value;
    });
    rail.appendChild(select);

    var groups = [
      { key: "fixed", label: "Fixed categories" },
      { key: "expanded", label: "Expanded topics" }
    ];

    groups.forEach(function (g) {
      var items = TOPICS.filter(function (t) { return (t.group || "fixed") === g.key; });
      if (!items.length) return;
      var wrap = h("div", { class: "nav-group" });
      wrap.appendChild(h("p", { class: "nav-label", text: g.label }));
      items.forEach(function (t) {
        var a = h("a", {
          class: "nav-item",
          href: "#/read/" + t.id,
          "aria-current": t.id === activeId ? "page" : null
        }, [
          h("span", { class: "dot" + (t.verdict === "well" ? "" : " thin") }),
          h("span", { text: t.title })
        ]);
        a.addEventListener("click", function () { searchInput.value = ""; });
        wrap.appendChild(a);
      });
      rail.appendChild(wrap);
    });
  }

  function setMode(mode) {
    modeButtons.forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-mode") === mode ? "true" : "false");
    });
    searchWrap.style.display = mode === "read" ? "" : "none";
  }

  /* ---------- read ---------- */

  function renderRead(id) {
    clear(view);
    var t = byId(id) || TOPICS[0];

    if (!t) {
      view.appendChild(h("h1", { text: "No chapters yet" }));
      view.appendChild(h("p", { class: "muted", text: "Run the content build." }));
      return;
    }

    if (id !== t.id) history.replaceState(null, "", "#/read/" + t.id);

    view.appendChild(h("p", {
      class: "kicker",
      text: t.group === "expanded" ? "Expanded topic" : "Fixed category"
    }));
    view.appendChild(h("h1", { text: t.title }));

    if (t.verdict !== "well") {
      view.appendChild(h("p", {
        class: "thin-tag",
        text: "Thin source: the documents cover only part of this topic."
      }));
    }

    view.appendChild(h("div", { class: "opening" }, [
      h("p", { class: "opening-label", text: "In short" }),
      h("p", { class: "opening-text", text: t.opening })
    ]));

    (t.sections || []).forEach(function (section) {
      var sec = h("section", { class: "chapter-section" });
      sec.appendChild(h("h2", { text: section.h }));
      (section.blocks || []).forEach(function (block) {
        if (block.type === "p") {
          sec.appendChild(h("p", { text: block.text }));
        } else if (block.type === "steps") {
          if (block.caption) sec.appendChild(h("p", { class: "block-caption", text: block.caption }));
          var ol = h("ol", { class: "steps" });
          (block.items || []).forEach(function (item) { ol.appendChild(h("li", { text: item })); });
          sec.appendChild(ol);
        } else if (block.type === "table") {
          sec.appendChild(tableFigure(block));
        }
      });
      view.appendChild(sec);
    });

    if (t.answers && t.answers.length) {
      var qa = h("section", { class: "chapter-section qa" });
      qa.appendChild(h("h2", { text: "Questions you will be asked" }));
      t.answers.forEach(function (answer) {
        var item = h("article", { class: "qa-item" });
        item.appendChild(h("h3", { text: answer.q }));
        (answer.a || []).forEach(function (para) { item.appendChild(h("p", { text: para })); });
        qa.appendChild(item);
      });
      view.appendChild(qa);
    }

    view.appendChild(appendix(t));
  }

  function tableFigure(block) {
    var table = h("table", null, [
      h("thead", null, h("tr", null, (block.head || []).map(function (cell) {
        return h("th", { text: cell });
      }))),
      h("tbody", null, (block.rows || []).map(function (row) {
        return h("tr", null, row.map(function (cell, i) {
          return h("td", { class: i === 0 ? "row-key" : null, text: cell });
        }));
      }))
    ]);
    return h("figure", { class: "table-block" }, [
      block.caption ? h("figcaption", { text: block.caption }) : null,
      h("div", { class: "table-scroll" }, table)
    ]);
  }

  function appendix(t) {
    var body = h("div", { class: "appendix-body" });

    body.appendChild(h("p", { class: "appendix-coverage", text: t.coverage }));

    var sectionCites = (t.sections || []).filter(function (s) { return s.refs && s.refs.length; });
    if (sectionCites.length) {
      body.appendChild(h("h3", { text: "Section citations" }));
      var list = h("ul", { class: "cite-list" });
      sectionCites.forEach(function (s) {
        list.appendChild(h("li", null, [h("b", { text: s.h }), " — " + s.refs.join("; ")]));
      });
      body.appendChild(list);
    }

    var answerCites = (t.answers || []).filter(function (a) { return a.refs && a.refs.length; });
    if (answerCites.length) {
      body.appendChild(h("h3", { text: "Answer citations" }));
      var alist = h("ul", { class: "cite-list" });
      answerCites.forEach(function (a) {
        alist.appendChild(h("li", null, [h("b", { text: a.q }), " — " + a.refs.join("; ")]));
      });
      body.appendChild(alist);
    }

    if (t.sources && t.sources.length) {
      body.appendChild(h("h3", { text: "Sources" }));
      var rows = t.sources.map(function (s) {
        return h("tr", null, [
          h("td", { text: s.doc }),
          h("td", { text: s.status }),
          h("td", { text: s.how })
        ]);
      });
      body.appendChild(h("div", { class: "table-scroll" }, h("table", { class: "appendix-table" }, [
        h("thead", null, h("tr", null, [
          h("th", { text: "Document" }),
          h("th", { text: "Status" }),
          h("th", { text: "How read" })
        ])),
        h("tbody", null, rows)
      ])));
    }

    if (t.conflicts && t.conflicts.length) {
      body.appendChild(h("h3", { text: "Conflicts" }));
      body.appendChild(h("p", {
        class: "appendix-note",
        text: "Each row names the conflict once, gives both values exactly as recorded, states the figure to quote and why; the WMS quiz may corroborate a documented value but never overrules one."
      }));
      var crow = t.conflicts.map(function (c) {
        return h("tr", null, [
          h("td", { text: c.point }),
          h("td", { text: c.values }),
          h("td", { text: c.quote }),
          h("td", { text: c.why })
        ]);
      });
      body.appendChild(h("div", { class: "table-scroll" }, h("table", { class: "appendix-table conflicts" }, [
        h("thead", null, h("tr", null, [
          h("th", { text: "Conflict" }),
          h("th", { text: "Source values" }),
          h("th", { text: "Quote" }),
          h("th", { text: "Why" })
        ])),
        h("tbody", null, crow)
      ])));
    }

    return h("details", { class: "appendix" }, [
      h("summary", { text: "Sources, coverage and conflicts" }),
      body
    ]);
  }

  /* ---------- search ---------- */

  function searchAll(q) {
    var needle = q.toLowerCase();
    var hits = [];

    function push(topic, text) {
      if (!text) return;
      if (String(text).toLowerCase().indexOf(needle) === -1) return;
      hits.push({ topic: topic, text: text });
    }

    TOPICS.forEach(function (t) {
      push(t, t.opening);
      (t.sections || []).forEach(function (s) {
        (s.blocks || []).forEach(function (b) {
          if (b.type === "p") push(t, b.text);
          else if (b.type === "steps") (b.items || []).forEach(function (i) { push(t, i); });
          else if (b.type === "table") (b.rows || []).forEach(function (r) { push(t, r.join(" — ")); });
        });
      });
      (t.answers || []).forEach(function (a) {
        push(t, a.q);
        (a.a || []).forEach(function (p) { push(t, p); });
      });
    });

    return hits.slice(0, 50);
  }

  function renderSearch(q) {
    clear(view);
    var hits = searchAll(q);
    view.appendChild(h("p", { class: "kicker", text: "Search" }));
    view.appendChild(h("h1", { text: hits.length + " results" }));
    view.appendChild(h("p", { class: "muted", text: "for “" + q + "”" }));

    if (!hits.length) {
      view.appendChild(h("p", { class: "muted", text: "No match. Try one word: a gas, a limit, an acronym." }));
      return;
    }

    hits.forEach(function (hit) {
      var a = h("a", { class: "result", href: "#/read/" + hit.topic.id }, [
        h("span", { class: "result-topic", text: hit.topic.title }),
        h("span", { class: "result-text", text: hit.text })
      ]);
      a.addEventListener("click", function () { searchInput.value = ""; route(); });
      view.appendChild(a);
    });
  }

  /* ---------- test ---------- */

  function countsByTopic() {
    var map = {};
    BANK.forEach(function (q) { map[q.category] = (map[q.category] || 0) + 1; });
    return map;
  }

  function renderTestStart() {
    clear(view);
    var counts = countsByTopic();
    var total = BANK.length;

    view.appendChild(h("p", { class: "kicker", text: "Test" }));
    view.appendChild(h("h1", { text: "Say it before you see it" }));
    view.appendChild(h("p", {
      class: "lede",
      text: "Every question comes from the chapter you just read. Answer, then read why the right answer is right."
    }));

    view.appendChild(h("p", { class: "pick-label", text: "Topic" }));
    var chips = h("div", { class: "chips" });
    chips.appendChild(chip("all", "All topics", total));
    TOPICS.forEach(function (t) {
      var n = counts[t.id] || 0;
      if (!n) return;
      chips.appendChild(chip(t.id, t.title, n));
    });
    view.appendChild(chips);

    view.appendChild(h("p", { class: "pick-label", text: "Questions" }));
    var countWrap = h("div", { class: "chips" });
    var poolSize = testTopic === "all" ? total : (counts[testTopic] || 0);
    var sizes = [Math.min(10, poolSize), Math.min(20, poolSize), poolSize].filter(function (n, i, arr) {
      return n > 0 && arr.indexOf(n) === i;
    });
    sizes.forEach(function (n) {
      var label = n === poolSize ? "All (" + n + ")" : String(n);
      var b = h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": testCount === n || (n === poolSize && testCount >= poolSize) ? "true" : "false",
        text: label
      });
      b.addEventListener("click", function () { testCount = n; renderTestStart(); });
      countWrap.appendChild(b);
    });
    view.appendChild(countWrap);

    var last = readLast();
    view.appendChild(h("div", { class: "start-row" }, [
      h("button", {
        type: "button",
        class: "btn",
        text: "Start test",
        onclick: function () { startQuiz(testTopic, testCount); }
      }),
      last ? h("span", {
        class: "last-score",
        text: "Last run: " + last.correct + " of " + last.total + " (" + last.date + ")"
      }) : null
    ]));

    if (!total) {
      view.appendChild(h("p", { class: "muted", text: "The quiz bank is empty. Build the chapters first." }));
    }
  }

  function chip(id, label, n) {
    var b = h("button", {
      type: "button",
      class: "chip",
      "aria-pressed": testTopic === id ? "true" : "false"
    }, [label, h("span", { class: "n", text: n })]);
    b.addEventListener("click", function () {
      testTopic = id;
      var pool = id === "all" ? BANK.length : (countsByTopic()[id] || 0);
      testCount = Math.min(10, pool);
      renderTestStart();
    });
    return b;
  }

  function startQuiz(topicId, count) {
    var pool = BANK.filter(function (q) {
      return topicId === "all" || q.category === topicId;
    });
    pool = shuffle(pool.slice());
    if (count > 0) pool = pool.slice(0, count);

    session = {
      items: pool,
      i: 0,
      phase: "ask",
      correct: 0,
      log: [],
      chosen: null,
      selfMarked: false,
      topicId: topicId
    };
    renderQuestion();
  }

  function renderQuestion() {
    clear(view);
    var s = session;
    if (!s) { renderTestStart(); return; }
    if (s.i >= s.items.length) { renderSummary(); return; }

    var item = s.items[s.i];
    var wrap = h("div", { class: "test-wrap" });

    wrap.appendChild(h("div", { class: "qtop" }, [
      h("span", { class: "topic", text: topicTitle(item.category) }),
      h("span", { text: "Question " + (s.i + 1) + " of " + s.items.length })
    ]));

    wrap.appendChild(h("div", { class: "bar" },
      h("i", { style: "width:" + Math.round((s.i / s.items.length) * 100) + "%" })));

    wrap.appendChild(h("p", { class: "qprompt", text: item.prompt }));

    if (item.type === "short") wrap.appendChild(shortBlock(item));
    else wrap.appendChild(mcqBlock(item));

    var foot = h("div", { class: "qfoot" });
    if (s.phase === "revealed" && (item.type !== "short" || s.selfMarked)) {
      foot.appendChild(h("button", {
        type: "button",
        class: "btn",
        text: s.i + 1 >= s.items.length ? "See result" : "Next",
        onclick: nextQuestion
      }));
    }
    foot.appendChild(h("span", {
      class: "score",
      text: s.correct + " correct · " + s.log.length + " answered"
    }));
    wrap.appendChild(foot);

    view.appendChild(wrap);
  }

  function mcqBlock(item) {
    var s = session;
    var wrap = h("div", { class: "options" });

    item.options.forEach(function (opt, idx) {
      var isCorrect = idx === item.answer;
      var cls = "option";
      if (s.phase === "revealed") {
        if (isCorrect) cls += " correct";
        else if (idx === s.chosen) cls += " wrong";
      }
      var b = h("button", {
        type: "button",
        class: cls,
        disabled: s.phase === "revealed" ? "disabled" : null
      }, [h("span", { class: "key", text: String(idx + 1) }), h("span", { text: opt })]);
      b.addEventListener("click", function () { answerMcq(idx); });
      wrap.appendChild(b);
    });

    if (s.phase === "revealed") {
      wrap.appendChild(h("div", { class: "reveal" }, [
        h("p", { class: "label", text: "Why" }),
        h("p", { class: "answer", text: item.explain || "" })
      ]));
    }
    return wrap;
  }

  function answerMcq(idx) {
    var s = session;
    if (!s || s.phase !== "ask") return;
    var item = s.items[s.i];
    var ok = idx === item.answer;
    s.chosen = idx;
    s.phase = "revealed";
    if (ok) s.correct++;
    s.log.push({
      category: item.category,
      prompt: item.prompt,
      yours: item.options[idx],
      correct: item.options[item.answer],
      ok: ok
    });
    renderQuestion();
  }

  function shortBlock(item) {
    var s = session;
    var wrap = h("div", { class: "short-answer" });
    var ta = h("textarea", {
      placeholder: "Say it in your own words, then reveal.",
      "aria-label": "Your answer"
    });
    ta.value = s.chosen || "";
    ta.addEventListener("input", function () { s.chosen = ta.value; });
    if (s.phase === "revealed") ta.setAttribute("readonly", "readonly");
    wrap.appendChild(ta);

    if (s.phase === "ask") {
      wrap.appendChild(h("div", { class: "start-row" }, h("button", {
        type: "button",
        class: "btn ghost",
        text: "Reveal answer",
        onclick: function () { s.phase = "revealed"; renderQuestion(); }
      })));
    } else {
      wrap.appendChild(h("div", { class: "reveal" }, [
        h("p", { class: "label", text: "Model answer" }),
        h("p", { class: "answer", text: item.answer || "" }),
        h("p", { class: "why", text: item.explain || "" })
      ]));
      if (!s.selfMarked) {
        wrap.appendChild(h("div", { class: "self-mark" }, [
          h("button", { type: "button", class: "btn", text: "I had it", onclick: function () { selfMark(true); } }),
          h("button", { type: "button", class: "btn ghost", text: "I missed it", onclick: function () { selfMark(false); } })
        ]));
      }
    }
    return wrap;
  }

  function selfMark(ok) {
    var s = session;
    if (!s || s.selfMarked) return;
    var item = s.items[s.i];
    s.selfMarked = true;
    if (ok) s.correct++;
    s.log.push({
      category: item.category,
      prompt: item.prompt,
      yours: s.chosen || "(blank)",
      correct: item.answer,
      ok: ok
    });
    renderQuestion();
  }

  function nextQuestion() {
    var s = session;
    if (!s) return;
    s.i++;
    s.phase = "ask";
    s.chosen = null;
    s.selfMarked = false;
    renderQuestion();
  }

  function renderSummary() {
    clear(view);
    var s = session;
    var total = s.items.length;
    var pct = total ? Math.round((s.correct / total) * 100) : 0;

    var wrap = h("div", { class: "test-wrap" });
    wrap.appendChild(h("p", { class: "kicker", text: "Result" }));
    wrap.appendChild(h("h1", { class: "summary-score", text: s.correct + " / " + total }));
    wrap.appendChild(h("p", { class: "summary-sub", text: pct + "% correct · " + topicTitle(s.topicId) }));

    var map = {};
    s.log.forEach(function (r) {
      if (!map[r.category]) map[r.category] = { ok: 0, n: 0 };
      map[r.category].n++;
      if (r.ok) map[r.category].ok++;
    });
    var rows = Object.keys(map).map(function (k) {
      return h("tr", null, [
        h("td", { text: topicTitle(k) }),
        h("td", { text: map[k].ok + " / " + map[k].n })
      ]);
    });
    if (rows.length) {
      wrap.appendChild(h("div", { class: "table-scroll" }, h("table", { class: "breakdown" }, [
        h("thead", null, h("tr", null, [h("th", { text: "Topic" }), h("th", { text: "Correct" })])),
        h("tbody", null, rows)
      ])));
    }

    wrap.appendChild(h("div", { class: "start-row" }, [
      h("button", {
        type: "button", class: "btn", text: "Test again",
        onclick: function () { session = null; renderTestStart(); }
      }),
      h("button", {
        type: "button", class: "btn ghost", text: "Back to the chapter",
        onclick: function () {
          var id = s.topicId === "all" && TOPICS[0] ? TOPICS[0].id : s.topicId;
          session = null;
          location.hash = "#/read/" + id;
        }
      })
    ]));

    wrap.appendChild(h("section", { class: "chapter-section" }, [
      h("h2", { text: "Review" }),
      h("ul", { class: "review" }, s.log.map(function (r) {
        return h("li", null, [
          h("p", { class: "q" }, [
            h("span", { class: "tag " + (r.ok ? "yes" : "no"), text: r.ok ? "correct" : "missed" }),
            r.prompt
          ]),
          h("p", { class: "a", text: "You: " + r.yours }),
          h("p", { class: "a", text: "Answer: " + r.correct })
        ]);
      }))
    ]));

    view.appendChild(wrap);
    saveLast({ correct: s.correct, total: total, date: new Date().toISOString().slice(0, 10) });
  }

  /* ---------- storage ---------- */

  function saveLast(obj) {
    try { localStorage.setItem("hse-quiz-last-v2", JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }

  function readLast() {
    try {
      var raw = localStorage.getItem("hse-quiz-last-v2");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------- router ---------- */

  function route() {
    var hash = location.hash.replace(/^#\/?/, "");
    var parts = hash.split("/");
    var mode = parts[0] === "test" ? "test" : "read";
    setMode(mode);

    if (mode === "test") {
      if (session) renderQuestion();
      else renderTestStart();
      renderRail(null);
    } else {
      var q = searchInput.value.trim();
      var id = parts[1];
      if (q) {
        renderSearch(q);
        renderRail(null);
      } else {
        renderRead(id);
        renderRail(byId(id) ? id : (TOPICS[0] ? TOPICS[0].id : null));
      }
    }
  }

  /* ---------- wiring ---------- */

  modeButtons.forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-mode");
      if (mode === "test") {
        location.hash = "#/test";
      } else {
        var current = location.hash.indexOf("#/read/") === 0
          ? location.hash.replace("#/read/", "")
          : (TOPICS[0] ? TOPICS[0].id : "");
        session = null;
        location.hash = "#/read/" + current;
      }
    });
  });

  var searchTimer = null;
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (location.hash.indexOf("#/test") === 0) {
        location.hash = "#/read/" + (TOPICS[0] ? TOPICS[0].id : "");
      } else {
        route();
      }
    }, 120);
  });

  document.addEventListener("keydown", function (e) {
    if (!session) return;
    var tag = e.target && e.target.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    var item = session.items[session.i];
    if (!item) return;

    if (session.phase === "ask" && item.type !== "short") {
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= item.options.length) {
        e.preventDefault();
        answerMcq(n - 1);
      }
      return;
    }

    if (session.phase === "revealed" && e.key === "Enter") {
      e.preventDefault();
      if (session.selfMarked || item.type !== "short") nextQuestion();
    }
  });

  window.addEventListener("hashchange", route);

  if (!location.hash) {
    history.replaceState(null, "", "#/read/" + (TOPICS[0] ? TOPICS[0].id : "h2s"));
  }
  route();
})();
