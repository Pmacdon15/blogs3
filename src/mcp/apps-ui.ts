/*
 * The HTML for the blog's in-chat apps (MCP Apps, SEP-1865, and the OpenAI
 * Apps SDK). Each page is self-contained: inline CSS and JS, no requests of
 * its own (only a post's https images load). The page talks only to the host
 * it is embedded in, and anything it changes goes through the host as an
 * ordinary MCP `tools/call` (get_post, publish_post, ...), so the server's
 * sign-in and admin checks decide what is allowed, exactly as when the model
 * calls those tools.
 *
 * Every piece of post data is added as a text node or an attribute through
 * the DOM, never as HTML, so nothing in a post can run in the page.
 *
 * The client script below is plain ES2019 kept in a string; it must not use
 * template literals (backticks), since it lives inside one.
 */

export type BlogAppView = "post" | "posts";

const STYLES = `
:root {
  color-scheme: light dark;
  --b-bg: #ffffff;
  --b-surface: #f5f8ff;
  --b-border: #e1e7f5;
  --b-text: #131a2b;
  --b-muted: #5b6680;
  --b-accent: #2563eb;
  --b-accent-soft: #e8efff;
  --b-accent-text: #ffffff;
  --b-ok: #067647;
  --b-ok-soft: #e7f8ee;
  --b-danger: #b42318;
  --b-code-bg: #0f172a;
  --b-code-text: #e2e8f0;
  --b-radius: 12px;
  --b-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --b-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --b-bg: #0d1322; --b-surface: #141c30; --b-border: #26314d; --b-text: #e8ecf6;
    --b-muted: #9aa6c2; --b-accent: #6e9bff; --b-accent-soft: #1b2849; --b-accent-text: #0b1220;
    --b-ok: #47cd89; --b-ok-soft: #12301f; --b-danger: #f97066;
  }
}
:root[data-theme="dark"] {
  --b-bg: #0d1322; --b-surface: #141c30; --b-border: #26314d; --b-text: #e8ecf6;
  --b-muted: #9aa6c2; --b-accent: #6e9bff; --b-accent-soft: #1b2849; --b-accent-text: #0b1220;
  --b-ok: #47cd89; --b-ok-soft: #12301f; --b-danger: #f97066;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-background-primary, var(--b-bg));
  color: var(--color-text-primary, var(--b-text));
  font: 14px/1.55 var(--font-sans, var(--b-font));
}
main { padding: 16px 18px 18px; }
.eyebrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: var(--b-muted); font-size: 12px; }
h1 { font-size: 22px; line-height: 1.25; margin: 8px 0 0; font-weight: 700; letter-spacing: -0.01em; }
.excerpt { color: var(--b-muted); font-size: 15px; margin: 8px 0 0; }
.badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; text-transform: capitalize; }
.badge.draft { background: var(--b-accent-soft); color: var(--b-accent); }
.badge.published { background: var(--b-ok-soft); color: var(--b-ok); }
.tag { display: inline-block; font-size: 11.5px; color: var(--b-accent); background: var(--b-accent-soft); border-radius: 999px; padding: 1px 8px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.cover { display: block; width: 100%; max-height: 260px; object-fit: cover; border-radius: var(--b-radius); margin-top: 14px; border: 1px solid var(--b-border); }
article { margin-top: 16px; border-top: 1px solid var(--b-border); padding-top: 4px; }
article h2 { font-size: 17px; margin: 18px 0 6px; }
article p { margin: 10px 0; white-space: pre-wrap; }
figure { margin: 14px 0; }
figure img { display: block; max-width: 100%; border-radius: 10px; border: 1px solid var(--b-border); }
figcaption { color: var(--b-muted); font-size: 12.5px; margin-top: 6px; }
pre { background: var(--b-code-bg); color: var(--b-code-text); border-radius: 10px; padding: 12px 14px; overflow-x: auto; font: 12.5px/1.5 var(--b-mono); margin: 12px 0; }
.lang { display: block; color: #93a4c8; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
.muted { color: var(--b-muted); }
.empty-state { padding: 28px 0; text-align: center; color: var(--b-muted); }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; }
button { font: inherit; font-size: 13px; border-radius: 9px; border: 1px solid var(--b-border); background: var(--b-bg); color: inherit; padding: 5px 12px; cursor: pointer; }
button.primary { background: var(--b-accent); border-color: var(--b-accent); color: var(--b-accent-text); }
button:disabled { opacity: .55; cursor: default; }
button:focus-visible { outline: 2px solid var(--b-accent); outline-offset: 2px; }
.list { display: grid; gap: 8px; margin-top: 12px; }
.row { display: block; width: 100%; text-align: left; border: 1px solid var(--b-border); border-radius: var(--b-radius); padding: 10px 12px; background: var(--b-bg); }
.row:hover { border-color: var(--b-accent); background: var(--b-surface); }
.row .top { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.row .title { font-weight: 600; font-size: 14.5px; }
.row .meta { color: var(--b-muted); font-size: 12px; margin-top: 2px; }
.row .ex { color: var(--b-muted); font-size: 13px; margin-top: 4px; }
.status { margin-top: 10px; font-size: 13px; min-height: 1em; }
.status.err { color: var(--b-danger); }
.status.ok { color: var(--b-ok); }
`;

const SCRIPT = `
(function () {
  "use strict";
  var VIEW = document.documentElement.getAttribute("data-view");
  var root = document.getElementById("app");
  var state = { data: null, list: null, busy: false, msg: null };

  /* ---------- host bridge: MCP Apps (postMessage JSON-RPC) or OpenAI Apps SDK ---------- */
  var openai = window.openai || null;
  var nextId = 1;
  var waiting = {};
  function post(msg) { if (window.parent && window.parent !== window) window.parent.postMessage(msg, "*"); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) {
      waiting[id] = { resolve: resolve, reject: reject };
      setTimeout(function () {
        if (waiting[id]) { delete waiting[id]; reject(new Error("The chat app did not answer in time.")); }
      }, 30000);
    });
  }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function callTool(name, args) {
    if (openai && typeof openai.callTool === "function") return openai.callTool(name, args);
    return request("tools/call", { name: name, arguments: args });
  }
  function resultText(res) {
    var c = res && res.content;
    if (c && c.length && c[0] && typeof c[0].text === "string") return c[0].text;
    return "";
  }
  function applyTheme(theme) {
    if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  }
  function applyHostContext(ctx) {
    if (!ctx) return;
    applyTheme(ctx.theme);
    var vars = ctx.styles && ctx.styles.variables;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        if (/^--[a-z0-9-]+$/i.test(k) && typeof vars[k] === "string") document.documentElement.style.setProperty(k, vars[k]);
      });
    }
  }
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var m = event.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && m.id !== null && !m.method) {
      var w = waiting[m.id];
      if (!w) return;
      delete waiting[m.id];
      if (m.error) w.reject(new Error(m.error.message || "Request failed")); else w.resolve(m.result);
      return;
    }
    if (m.method === "ui/notifications/tool-result") {
      var p = m.params || {};
      if (p.structuredContent && !p.isError) setData(p.structuredContent);
      else if (p.isError) showMessage(resultText(p) || "The tool returned an error.", true);
    } else if (m.method === "ui/notifications/host-context-changed") {
      applyHostContext(m.params);
    } else if (m.method === "ui/resource-teardown" || m.method === "ping") {
      if (m.id !== undefined) post({ jsonrpc: "2.0", id: m.id, result: {} });
    }
  });

  function reportSize() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (openai && typeof openai.notifyIntrinsicHeight === "function") { try { openai.notifyIntrinsicHeight(h); } catch (e) {} }
    else notify("ui/notifications/size-changed", { height: h });
  }

  function start() {
    if (openai) {
      applyTheme(openai.theme);
      if (openai.toolOutput) setData(openai.toolOutput); else render();
      window.addEventListener("openai:set_globals", function (e) {
        var g = (e && e.detail && e.detail.globals) || {};
        if (g.theme) applyTheme(g.theme);
        if (g.toolOutput) setData(g.toolOutput);
      });
    } else {
      render();
      request("ui/initialize", {
        protocolVersion: "2026-01-26",
        appInfo: { name: "blogs-" + VIEW, version: "1.0.0" },
        appCapabilities: {}
      }).then(function (res) {
        applyHostContext(res && res.hostContext);
        notify("ui/notifications/initialized", {});
      }).catch(function () { /* not embedded in an MCP Apps host */ });
    }
    if (typeof ResizeObserver === "function") new ResizeObserver(reportSize).observe(document.body);
  }

  /* ---------- helpers: every value goes in as text or an attribute ---------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === "class") el.className = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "disabled") el.disabled = Boolean(v);
      else el.setAttribute(k, v === true ? "" : String(v));
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
    });
    return el;
  }
  function safeImage(url) {
    return typeof url === "string" && /^https:[/][/][^\\s"'<>]+$/i.test(url) ? url : null;
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function badge(status) {
    var s = status === "published" ? "published" : "draft";
    return h("span", { class: "badge " + s }, [s]);
  }
  function tagList(tags) {
    if (!Array.isArray(tags) || !tags.length) return null;
    return h("div", { class: "tags" }, tags.map(function (t) { return h("span", { class: "tag" }, ["#" + t]); }));
  }
  function showMessage(text, err) { state.msg = { text: text, err: Boolean(err) }; render(); }

  function setData(d) {
    state.msg = null;
    if (d && Array.isArray(d.posts)) { state.list = d; state.data = null; }
    else state.data = d;
    render();
  }

  /* ---------- post preview ---------- */
  function paragraphs(text) {
    return String(text).split(/\\n{2,}/).filter(function (p) { return p.trim(); }).map(function (p) { return h("p", null, [p]); });
  }
  function block(b) {
    if (!b || typeof b !== "object") return null;
    if (b.type === "heading") return h("h2", null, [b.text]);
    if (b.type === "text") return h("div", null, paragraphs(b.text));
    if (b.type === "image") {
      var src = safeImage(b.url);
      return h("figure", null, [
        src ? h("img", { src: src, alt: b.alt || "", loading: "lazy" }) : h("div", { class: "muted" }, ["(image)"]),
        b.caption ? h("figcaption", null, [b.caption]) : null
      ]);
    }
    if (b.type === "code") return h("pre", null, [h("span", { class: "lang" }, [b.language || "plaintext"]), h("code", null, [b.code])]);
    return null;
  }
  function changeStatus(p, tool) {
    state.busy = true; state.msg = null; render();
    callTool(tool, { id: p.id }).then(function (res) {
      state.busy = false;
      if (res && res.structuredContent && !res.isError) { setData(res.structuredContent); showMessage(resultText(res).split("\\n")[0], false); }
      else showMessage(resultText(res) || "That didn't work.", true);
    }, function (e) { state.busy = false; showMessage(e.message, true); });
  }
  function renderPost(d) {
    var p = d.post;
    var when = p.status === "published" ? "Published " + fmtDate(p.publishedAt) : "Edited " + fmtDate(p.updatedAt);
    var cover = safeImage(p.coverImageUrl);
    var blocks = Array.isArray(p.blocks) ? p.blocks : [];
    return [
      state.list ? h("button", { onclick: function () { state.data = null; state.msg = null; render(); } }, ["\\u2190 All posts"]) : null,
      h("div", { class: "eyebrow" }, [badge(p.status), when, d.path ? "\\u00b7 " + d.path : null]),
      h("h1", null, [p.title]),
      p.excerpt ? h("p", { class: "excerpt" }, [p.excerpt]) : null,
      tagList(p.tags),
      cover ? h("img", { class: "cover", src: cover, alt: "" }) : null,
      h("article", null, blocks.length ? blocks.map(block) : [h("div", { class: "empty-state" }, ["No content yet."])]),
      h("div", { class: "toolbar" }, [
        p.status === "published"
          ? h("button", { disabled: state.busy, onclick: function () { changeStatus(p, "unpublish_post"); } }, ["Unpublish"])
          : h("button", { class: "primary", disabled: state.busy || !blocks.length, onclick: function () { changeStatus(p, "publish_post"); } }, ["Publish"])
      ])
    ];
  }

  /* ---------- posts list ---------- */
  function openPost(id) {
    state.busy = true; state.msg = null; render();
    callTool("get_post", { id: id }).then(function (res) {
      state.busy = false;
      if (res && res.structuredContent && res.structuredContent.post) { state.data = res.structuredContent; render(); }
      else showMessage(resultText(res) || "Couldn't open that post.", true);
    }, function (e) { state.busy = false; showMessage(e.message, true); });
  }
  function renderList(d) {
    var posts = d.posts;
    var title = d.query ? "Results for \\u201c" + d.query + "\\u201d" : "Posts";
    if (!posts.length) return [h("h1", null, [title]), h("div", { class: "empty-state" }, ["No posts to show."])];
    return [
      h("h1", null, [title]),
      h("div", { class: "muted", style: "margin-top:2px" }, [posts.length + " post" + (posts.length === 1 ? "" : "s")]),
      h("div", { class: "list" }, posts.map(function (p) {
        var date = p.status === "published" ? fmtDate(p.publishedAt) : "Edited " + fmtDate(p.updatedAt);
        return h("button", { class: "row", disabled: state.busy, onclick: function () { openPost(p.id); } }, [
          h("div", { class: "top" }, [h("span", { class: "title" }, [p.title]), badge(p.status)]),
          h("div", { class: "meta" }, [date + " \\u00b7 /" + p.slug]),
          p.excerpt ? h("div", { class: "ex" }, [p.excerpt]) : null,
          tagList(p.tags)
        ]);
      }))
    ];
  }

  function render() {
    var nodes;
    if (state.data && state.data.post) nodes = renderPost(state.data);
    else if (state.list) nodes = renderList(state.list);
    else if (state.data && state.data.deleted) nodes = [h("div", { class: "empty-state" }, ["Deleted \\u201c" + state.data.deleted.title + "\\u201d."])];
    else nodes = [h("div", { class: "empty-state" }, [VIEW === "posts" ? "Loading posts\\u2026" : "Loading the post\\u2026"])];
    if (state.msg) nodes.push(h("div", { class: "status " + (state.msg.err ? "err" : "ok"), role: "status", "aria-live": "polite" }, [state.msg.text]));
    root.replaceChildren(h("main", null, nodes));
  }

  start();
})();
`;

const TITLES: Record<BlogAppView, string> = {
  post: "Post preview",
  posts: "Posts",
};

/** The complete, self-contained HTML page for one of the blog's in-chat apps. */
export function blogAppHtml(view: BlogAppView) {
  return `<!doctype html>
<html lang="en" data-view="${view}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${TITLES[view]}</title>
<style>${STYLES}</style>
</head>
<body>
<div id="app" aria-live="polite"></div>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
