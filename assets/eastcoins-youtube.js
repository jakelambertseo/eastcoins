// Shared YouTube URL -> embeddable URL conversion. YouTube's watch/shorts/live
// pages refuse to load in a third-party iframe, but /embed/<id> works fine, so
// anywhere EastCoin accepts a pasted URL (the top search bar, /submit) needs to
// convert one before handing it to the player. Used by submit.html and
// v2/assets/js/app.js.
(() => {
  "use strict";

  function parseStart(value) {
    if (!value) return null;

    if (/^\d+$/.test(value)) return parseInt(value, 10);

    const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!match || (!match[1] && !match[2] && !match[3])) return null;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  function extractVideo(raw) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return null;

    let url;
    try {
      url = new URL(/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
      return null;
    }

    const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();
    let id = null;

    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0] || null;
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else {
        const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/);
        if (match) id = match[1];
      }
    }

    if (!id || !/^[a-zA-Z0-9_-]{10,12}$/.test(id)) return null;

    return {
      id,
      start: parseStart(url.searchParams.get("t") || url.searchParams.get("start")),
      si: url.searchParams.get("si")
    };
  }

  function buildEmbedUrl(video) {
    const params = [];
    if (video.start) params.push(`start=${video.start}`);
    if (video.si) params.push(`si=${encodeURIComponent(video.si)}`);

    // youtube-nocookie.com is YouTube's own privacy-enhanced embed domain.
    // It plays the same videos as youtube.com/embed but skips setting
    // YouTube's tracking cookies from the iframe, which sidesteps the
    // stricter cookie/tracking-protection handling that can otherwise make
    // Firefox refuse the frame outright. It does not change per-video
    // embedding permissions — a video the uploader has blocked from
    // embedding stays blocked on either domain.
    return `https://www.youtube-nocookie.com/embed/${video.id}${params.length ? `?${params.join("&")}` : ""}`;
  }

  function watchUrl(video) {
    const url = new URL(`https://www.youtube.com/watch?v=${video.id}`);
    if (video.start) url.searchParams.set("t", `${video.start}s`);
    return url.href;
  }

  function toEmbedUrl(raw) {
    const video = extractVideo(raw);
    return video ? buildEmbedUrl(video) : null;
  }

  window.EastcoinYouTube = Object.freeze({
    extractVideo,
    buildEmbedUrl,
    watchUrl,
    toEmbedUrl
  });
})();
