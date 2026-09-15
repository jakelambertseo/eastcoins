/* ============================================================
   EastCoin V3 — the bell

   A bell in the nav with a red count, and the panel under it: what
   happened to you since you last looked — picks settled, a prop
   called, the Daily Jackpot, your team opening for picks, a badge,
   an admin's announcement. Reads /api/picks/notifications on load
   and every 90 s while the tab is visible; a hidden tab stops.

   Opening the panel tells the server you looked (POST), the rows
   stay lit until the panel closes, and the count clears then. A
   new item arriving while the page is open gets a small toast.

   The panel is fixed and placed by hand so it never covers the
   Twitch rail — Twitch flags itself obscured and keeps the error
   until the chat reloads.
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 45 * 1000;      // 45 s: a settled pick or a jackpot toasts while it still matters (~1,900 reads a day per tab)
  const TOAST_MS = 7000;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };

  const wrap = document.getElementById("notifWrap");
  const btn = document.getElementById("notifBtn");
  const count = document.getElementById("notifCount");
  const panel = document.getElementById("notifPanel");
  if (!wrap || !btn || !panel) return;

  let data = null;
  let open = false;
  let timer = 0;
  let lastUnread = null;
  let signedOut = false;

  /* ---------------------------------------------------------- reads */

  async function load() {
    if (signedOut) return;
    let payload = null;
    try {
      const ctl = new AbortController();
      const cap = window.setTimeout(() => ctl.abort(), 8000);
      payload = await fetch("/api/picks/notifications", { credentials: "include", signal: ctl.signal }).then((r) => (r.status === 401 ? { code: "NOT_SIGNED_IN" } : r.json()));
      window.clearTimeout(cap);
    } catch { payload = null; }
    if (payload?.code === "NOT_SIGNED_IN") { signedOut = true; wrap.hidden = true; return; }
    if (!payload?.ok) return;
    const before = lastUnread;
    data = payload;
    wrap.hidden = false;
    paintCount(open ? 0 : payload.unread);
    if (open) paintPanel();
    // Something new landed while this page was open: say so once.
    if (before !== null && payload.unread > before && !open && !document.hidden) {
      const fresh = payload.items.find((i) => i.unread);
      if (fresh) toast(fresh);
    }
    lastUnread = payload.unread;
    // The Gold Button's window comes down this pipe because this is the
    // one request every open tab already makes. v3-gold.js draws it.
    document.dispatchEvent(new CustomEvent("ec-gold", { detail: payload.gold || null }));
  }

  async function markSeen() {
    try { await fetch("/api/picks/notifications", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{\"seen\":true}" }); } catch { /* the next look will */ }
    lastUnread = 0;
  }

  /* ---------------------------------------------------------- paint */

  function paintCount(n) {
    count.textContent = n > 99 ? "99+" : String(n);
    count.hidden = !(n > 0);
    btn.classList.toggle("has-new", n > 0);
    btn.setAttribute("aria-label", n > 0 ? `Notifications, ${n} unread` : "Notifications");
  }

  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return time;
    const days = (today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000;
    return days === 1 ? `Yesterday ${time}` : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  };
  const sinceLabel = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const ms = Date.now() - d.getTime();
    const h = Math.round(ms / 3600000);
    const ago = ms < 3600000 ? `${Math.max(1, Math.round(ms / 60000))} min` : h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
    return `since ${when(iso)} · ${ago}`;
  };

  function amount(n, word) {
    const s = el("span", `notif-amt${n > 0 ? " up" : n < 0 ? " down" : ""}`);
    s.textContent = `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()} ZC${word ? " " + word : ""}`;
    return s;
  }

  function row(item) {
    const a = el("a", `notif-row${item.unread ? " unread" : ""}${item.href?.startsWith("/g/") ? " glink" : item.href?.startsWith("/u/") ? " ulink" : ""}`);
    a.href = item.href || "#";
    a.append(el("span", `notif-ico ${item.tone || ""}`, item.icon || "·"));
    const t = el("span", "notif-t");
    const head = el("span");
    head.append(el("b", null, item.strong || ""));
    if (item.text) head.append(document.createTextNode(` ${item.text}`));
    if (item.amount !== null && item.amount !== undefined && Number.isFinite(Number(item.amount))) head.append(document.createTextNode(" · "), amount(Number(item.amount), item.amountWord));
    t.append(head);
    if (item.sub) t.append(el("small", null, item.sub));
    a.append(t, el("span", "notif-at", item.fresh ? "New" : when(item.at)));
    a.addEventListener("click", (e) => {
      // Views by name stay inside the shell; /g/ and /u/ are routed by the shell's own handler.
      const view = /^\/\?view=([a-z]+)/.exec(item.href || "");
      if (view && !e.metaKey && !e.ctrlKey && !e.shiftKey && window.ECV3?.go) {
        e.preventDefault();
        history.pushState({ view: view[1] }, "", item.href);
        window.ECV3.go(view[1], { push: false });
      }
      setOpen(false);
    });
    return a;
  }

  function paintPanel() {
    panel.replaceChildren();
    const head = el("div", "notif-head");
    const title = el("div");
    title.append(el("b", null, data?.unread ? "While you were away" : "Notifications"));
    title.append(el("small", null, data?.firstLook ? "the last few days" : sinceLabel(data?.since)));
    head.append(title);
    const tools = el("div", "notif-tools");
    const ledger = el("a", "notif-lnk", "Ledger →");
    ledger.href = "/?view=picks&tab=history";
    ledger.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); history.pushState({ view: "picks" }, "", ledger.getAttribute("href")); window.ECV3?.go("picks", { push: false }); setOpen(false); });
    tools.append(ledger);
    // Your own profile, right under the ledger: the panel is the one
    // place in the nav that is about you rather than the site.
    const login = String(data?.login || window.ECV3?.state?.session?.user?.login || "").toLowerCase();
    if (login) {
      const me = el("a", "notif-lnk ulink", "View my profile →");
      me.href = `/u/${encodeURIComponent(login)}`;
      me.addEventListener("click", () => setOpen(false));
      tools.append(me);
    }
    head.append(tools);
    panel.append(head);

    const items = data?.items || [];
    if (!items.length) {
      const empty = el("div", "notif-empty");
      empty.append(el("b", null, "Nothing yet"), el("span", null, "Picks that settle, props that get called, the Jackpot, your team opening and new badges land here."));
      panel.append(empty);
      return;
    }
    const fresh = items.filter((i) => i.unread);
    const older = items.filter((i) => !i.unread);
    const list = el("div", "notif-list");
    if (fresh.length) {
      const g = el("div", "notif-grp"); g.append(el("span", null, "New"), el("i", null, String(fresh.length)));
      list.append(g);
      for (const i of fresh) list.append(row(i));
    } else {
      const empty = el("div", "notif-empty small");
      empty.append(el("b", null, "Nothing since you last looked"), el("span", null, "Your open picks are still riding."));
      list.append(empty);
    }
    if (older.length) {
      const g = el("div", "notif-grp"); g.append(el("span", null, "Earlier"), el("i", null, String(older.length)));
      list.append(g);
      for (const i of older) list.append(row(i));
    }
    panel.append(list);
  }

  /* ---------------------------------------------------------- placing

     Fixed, right-aligned to the bell — but never over the chat rail
     (min-width 981px with the rail open): it slides left to stop at
     the rail's edge, the way the ⋯ menu does. */
  function place() {
    const r = btn.getBoundingClientRect();
    const chatOpen = document.body.classList.contains("chat-open") && !document.body.classList.contains("chat-hidden") && window.innerWidth >= 981;
    const chatW = chatOpen ? parseFloat(getComputedStyle(document.body).getPropertyValue("--chat-w")) || 340 : 0;
    const right = Math.max(window.innerWidth - r.right, chatOpen ? chatW + 4 : 0, 8);
    panel.style.top = `${Math.round(r.bottom + 8)}px`;
    panel.style.right = `${Math.round(right)}px`;
    panel.style.maxHeight = `${Math.max(240, window.innerHeight - r.bottom - 24)}px`;
    if (window.innerWidth < 520) { panel.style.right = "8px"; panel.style.left = "8px"; } else panel.style.left = "";
  }

  function setOpen(v) {
    if (v === open) return;
    open = v;
    panel.hidden = !v;
    btn.setAttribute("aria-expanded", String(v));
    btn.classList.toggle("on", v);
    if (v) {
      paintPanel();
      place();
      paintCount(0);
      if (data?.unread) markSeen();
      panel.querySelector(".notif-lnk, .notif-row")?.focus?.({ preventScroll: true });
    } else if (data) {
      // The rows dim once the panel is closed; the server already knows.
      for (const i of data.items) i.unread = false;
      data.unread = 0;
    }
  }

  /* ---------------------------------------------------------- toast */

  function toast(item) {
    document.querySelector(".notif-toast")?.remove();
    const t = el("div", "notif-toast");
    t.append(el("span", `notif-ico ${item.tone || ""}`, item.icon || "·"));
    const copy = el("span", "notif-toast-t");
    const b = el("b", null, item.strong || "");
    copy.append(b);
    if (item.text) copy.append(document.createTextNode(` ${item.text}`));
    if (Number.isFinite(Number(item.amount)) && item.amount !== null) copy.append(document.createTextNode(" · "), amount(Number(item.amount), item.amountWord));
    t.append(copy);
    t.addEventListener("click", () => { t.remove(); setOpen(true); });
    // Bottom LEFT, always: the Twitch rail is on the right and flags
    // itself obscured by anything that ever covers it.
    document.body.append(t);
    window.setTimeout(() => t.classList.add("show"), 20);
    window.setTimeout(() => { t.classList.remove("show"); window.setTimeout(() => t.remove(), 300); }, TOAST_MS);
  }

  /* ---------------------------------------------------------- wiring */

  btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(!open); });
  document.addEventListener("click", (e) => { if (open && !panel.contains(e.target) && !btn.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { setOpen(false); btn.focus(); } });
  window.addEventListener("resize", () => { if (open) place(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  const tick = () => { if (!document.hidden) load(); };
  load();
  timer = window.setInterval(tick, POLL_MS);
  window.ECNotify = Object.freeze({ refresh: load, open: () => setOpen(true) });
})();
