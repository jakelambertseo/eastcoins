(() => {
  "use strict";

  const ROLE_ADMIN = "admin";
  const ROLE_VIEWER = "viewer";
  const CHANNEL_PREFIX =
    "eastcoin-halftime-jams-test-v1:";
  const STATE_PREFIX =
    "eastcoinHalftimeJamTestState:v1:";
  const AUDIO_KEY =
    "eastcoinHalftimeJamAudioEnabledV1";

  const parameters =
    new URLSearchParams(location.search);
  const role =
    parameters.get("role") === ROLE_VIEWER
      ? ROLE_VIEWER
      : ROLE_ADMIN;
  const initialRoom =
    cleanRoom(
      parameters.get("room") ||
      localStorage.getItem(
        "eastcoinHalftimeJamLastRoom"
      ) ||
      "eastcoin-halftime-test"
    );

  document.body.dataset.role = role;

  const elements = {
    roleBadge:
      document.getElementById("roleBadge"),
    adminRoleLink:
      document.getElementById("adminRoleLink"),
    viewerRoleLink:
      document.getElementById("viewerRoleLink"),
    toast:
      document.getElementById("toast"),

    adminRoomInput:
      document.getElementById("adminRoomInput"),
    switchRoomButton:
      document.getElementById("switchRoomButton"),
    videoInput:
      document.getElementById("videoInput"),
    titleInput:
      document.getElementById("titleInput"),
    delaySelect:
      document.getElementById("delaySelect"),
    startJamButton:
      document.getElementById("startJamButton"),
    loadDemoButton:
      document.getElementById("loadDemoButton"),
    pauseButton:
      document.getElementById("pauseButton"),
    resumeButton:
      document.getElementById("resumeButton"),
    resyncButton:
      document.getElementById("resyncButton"),
    endButton:
      document.getElementById("endButton"),
    adminError:
      document.getElementById("adminError"),
    adminConnectionPill:
      document.getElementById(
        "adminConnectionPill"
      ),
    listenerCount:
      document.getElementById("listenerCount"),
    adminStateStatus:
      document.getElementById(
        "adminStateStatus"
      ),
    adminStateTitle:
      document.getElementById(
        "adminStateTitle"
      ),
    adminStateVideo:
      document.getElementById(
        "adminStateVideo"
      ),
    adminStatePosition:
      document.getElementById(
        "adminStatePosition"
      ),
    adminStateRevision:
      document.getElementById(
        "adminStateRevision"
      ),
    openViewerButton:
      document.getElementById(
        "openViewerButton"
      ),
    copyViewerButton:
      document.getElementById(
        "copyViewerButton"
      ),
    viewerUrlPreview:
      document.getElementById(
        "viewerUrlPreview"
      ),

    viewerRoomName:
      document.getElementById(
        "viewerRoomName"
      ),
    viewerSyncChip:
      document.getElementById(
        "viewerSyncChip"
      ),
    enableAudioButton:
      document.getElementById(
        "enableAudioButton"
      ),
    jamOverlay:
      document.getElementById("jamOverlay"),
    viewerSongTitle:
      document.getElementById(
        "viewerSongTitle"
      ),
    viewerSongMeta:
      document.getElementById(
        "viewerSongMeta"
      ),
    joinJamButton:
      document.getElementById(
        "joinJamButton"
      ),
    leaveJamButton:
      document.getElementById(
        "leaveJamButton"
      ),
    startCountdown:
      document.getElementById(
        "startCountdown"
      ),
    countdownValue:
      document.getElementById(
        "countdownValue"
      ),
    viewerPlaybackStatus:
      document.getElementById(
        "viewerPlaybackStatus"
      ),
    viewerDriftStatus:
      document.getElementById(
        "viewerDriftStatus"
      ),
    viewerResyncButton:
      document.getElementById(
        "viewerResyncButton"
      ),
    volumeControl:
      document.getElementById(
        "volumeControl"
      ),
    viewerWatchLayout:
      document.getElementById(
        "viewerWatchLayout"
      ),
    twitchCommandInput:
      document.getElementById(
        "twitchCommandInput"
      ),
    runTwitchCommandButton:
      document.getElementById(
        "runTwitchCommandButton"
      ),
    twitchCommandResult:
      document.getElementById(
        "twitchCommandResult"
      )
  };

  let room = initialRoom;
  let channel = null;
  let jamState = readState();
  let adminStartTimer = null;
  let viewerStartTimer = null;
  let countdownTimer = null;
  let driftTimer = null;
  let presenceTimer = null;
  let adminRenderTimer = null;
  let toastTimer = null;
  let youtubePromise = null;
  let player = null;
  let playerReady = false;
  let audioEnabled =
    sessionStorage.getItem(AUDIO_KEY) ===
    "true";
  let viewerHiddenCurrentJam = false;
  let lastAppliedRevision = -1;
  const viewers = new Map();
  const clientId =
    crypto.randomUUID?.() ||
    `client-${Date.now()}-${Math.random()}`;

  function cleanRoom(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) ||
      "eastcoin-halftime-test";
  }

  function stateKey() {
    return `${STATE_PREFIX}${room}`;
  }

  function buildRoleUrl(nextRole) {
    const url = new URL(
      location.href
    );

    url.searchParams.set("role", nextRole);
    url.searchParams.set("room", room);
    return url;
  }

  function applyRoleLinks() {
    elements.roleBadge.textContent =
      role === ROLE_ADMIN
        ? "Admin"
        : "Viewer";

    const adminUrl =
      buildRoleUrl(ROLE_ADMIN);
    const viewerUrl =
      buildRoleUrl(ROLE_VIEWER);

    elements.adminRoleLink.href =
      adminUrl.href;
    elements.viewerRoleLink.href =
      viewerUrl.href;

    elements.adminRoleLink.classList.toggle(
      "active",
      role === ROLE_ADMIN
    );
    elements.viewerRoleLink.classList.toggle(
      "active",
      role === ROLE_VIEWER
    );

    elements.viewerUrlPreview.textContent =
      viewerUrl.href;
  }

  function showToast(message) {
    if (!elements.toast) return;

    elements.toast.textContent = message;
    elements.toast.classList.add("visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove(
        "visible"
      );
    }, 2600);
  }

  function readState() {
    try {
      const value = JSON.parse(
        localStorage.getItem(stateKey()) ||
        "null"
      );

      return value &&
        typeof value === "object"
        ? value
        : null;
    } catch {
      return null;
    }
  }

  function saveState(nextState) {
    jamState = nextState;

    try {
      localStorage.setItem(
        stateKey(),
        JSON.stringify(nextState)
      );
    } catch {}

    sendMessage({
      type: "state",
      state: nextState
    });

    renderAdminState();
    applyViewerState();
  }

  function sendMessage(message) {
    channel?.postMessage({
      ...message,
      room,
      senderId: clientId,
      sentAt: Date.now()
    });
  }

  function connectChannel() {
    channel?.close();

    if ("BroadcastChannel" in window) {
      channel = new BroadcastChannel(
        `${CHANNEL_PREFIX}${room}`
      );

      channel.addEventListener(
        "message",
        (event) => {
          handleChannelMessage(event.data);
        }
      );
    }

    sendMessage({
      type: "presence-request"
    });
  }

  function handleChannelMessage(message) {
    if (
      !message ||
      message.room !== room ||
      message.senderId === clientId
    ) {
      return;
    }

    if (message.type === "state") {
      jamState = message.state;
      renderAdminState();
      applyViewerState();
      return;
    }

    if (
      message.type ===
      "presence-request" &&
      role === ROLE_VIEWER
    ) {
      sendPresence();
      return;
    }

    if (
      message.type === "presence" &&
      role === ROLE_ADMIN
    ) {
      viewers.set(
        message.senderId,
        Number(message.sentAt) ||
        Date.now()
      );
      renderViewerCount();
    }
  }

  function sendPresence() {
    sendMessage({
      type: "presence",
      role
    });
  }

  function startPresence() {
    if (role === ROLE_VIEWER) {
      sendPresence();

      presenceTimer =
        window.setInterval(
          sendPresence,
          4000
        );
    } else {
      presenceTimer =
        window.setInterval(() => {
          const cutoff =
            Date.now() - 11_000;

          for (
            const [id, seenAt]
            of viewers.entries()
          ) {
            if (seenAt < cutoff) {
              viewers.delete(id);
            }
          }

          renderViewerCount();
          sendMessage({
            type: "presence-request"
          });
        }, 4000);
    }
  }

  function renderViewerCount() {
    if (!elements.listenerCount) return;
    elements.listenerCount.textContent =
      String(viewers.size);
  }

  function parseVideoId(value) {
    const input = String(value || "").trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
      return input;
    }

    try {
      const url = new URL(input);
      const host = url.hostname
        .replace(/^www\./, "");

      if (host === "youtu.be") {
        return url.pathname
          .split("/")
          .filter(Boolean)[0] || "";
      }

      if (
        host.endsWith("youtube.com") ||
        host.endsWith(
          "youtube-nocookie.com"
        )
      ) {
        const queryId =
          url.searchParams.get("v");

        if (queryId) return queryId;

        const parts = url.pathname
          .split("/")
          .filter(Boolean);

        const markerIndex =
          parts.findIndex((part) =>
            ["embed", "shorts", "live"].includes(
              part
            )
          );

        if (
          markerIndex >= 0 &&
          parts[markerIndex + 1]
        ) {
          return parts[markerIndex + 1];
        }
      }
    } catch {}

    return "";
  }

  function expectedPosition(
    state = jamState,
    now = Date.now()
  ) {
    if (!state) return 0;

    const base =
      Number(state.position || 0);

    if (
      ["scheduled", "playing"].includes(
        state.status
      ) &&
      Number(state.startAt) <= now
    ) {
      return Math.max(
        0,
        base +
        (
          now -
          Number(state.startAt)
        ) / 1000
      );
    }

    return Math.max(0, base);
  }

  function effectiveStatus(
    state = jamState
  ) {
    if (!state) return "idle";

    if (
      state.status === "scheduled" &&
      Date.now() >= Number(state.startAt)
    ) {
      return "playing";
    }

    return state.status || "idle";
  }

  function formatTime(seconds) {
    const safe =
      Math.max(
        0,
        Math.floor(Number(seconds) || 0)
      );
    const minutes =
      Math.floor(safe / 60);
    const remainder =
      safe % 60;

    return `${minutes}:${String(
      remainder
    ).padStart(2, "0")}`;
  }

  function nextRevision() {
    return Number(
      jamState?.revision || 0
    ) + 1;
  }

  function renderAdminState() {
    if (role !== ROLE_ADMIN) return;

    const status =
      effectiveStatus(jamState);

    const labels = {
      idle: "Idle",
      scheduled: "Scheduled",
      playing: "Playing",
      paused: "Paused",
      ended: "Ended"
    };

    elements.adminStateStatus.textContent =
      labels[status] || status;
    elements.adminStateTitle.textContent =
      jamState?.title ||
      "Nothing selected";
    elements.adminStateVideo.textContent =
      jamState?.videoId || "—";
    elements.adminStatePosition.textContent =
      formatTime(
        expectedPosition(jamState)
      );
    elements.adminStateRevision.textContent =
      String(
        jamState?.revision || 0
      );

    const active =
      ["scheduled", "playing", "paused"]
        .includes(status);

    elements.pauseButton.disabled =
      status !== "playing" &&
      status !== "scheduled";
    elements.resumeButton.disabled =
      status !== "paused";
    elements.resyncButton.disabled =
      !active;
    elements.endButton.disabled =
      !active;

    if (status === "scheduled") {
      const remaining =
        Math.max(
          0,
          Math.ceil(
            (
              Number(jamState.startAt) -
              Date.now()
            ) / 1000
          )
        );

      elements.adminConnectionPill.textContent =
        `Starts in ${remaining}s`;
    } else if (status === "playing") {
      elements.adminConnectionPill.textContent =
        "Broadcasting";
    } else if (status === "paused") {
      elements.adminConnectionPill.textContent =
        "Paused";
    } else {
      elements.adminConnectionPill.textContent =
        "Local test ready";
    }
  }

  function scheduleAdminRender() {
    adminRenderTimer =
      window.setInterval(
        renderAdminState,
        500
      );
  }

  function updateStartButton() {
    const delay =
      Number(elements.delaySelect.value) ||
      3;

    elements.startJamButton.textContent =
      `▶ Start in ${delay} seconds`;
  }

  function startJam() {
    elements.adminError.textContent = "";

    const videoId =
      parseVideoId(
        elements.videoInput.value
      );

    if (!videoId) {
      elements.adminError.textContent =
        "Enter a valid YouTube URL or 11-character video ID.";
      return;
    }

    const delay =
      Number(elements.delaySelect.value) ||
      3;
    const title =
      elements.titleInput.value.trim() ||
      "EastCoin Halftime Jam";
    const startAt =
      Date.now() + delay * 1000;

    const next = {
      version: 1,
      room,
      status: "scheduled",
      videoId,
      title,
      position: 0,
      startAt,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        crypto.randomUUID?.() ||
        `jam-${Date.now()}`
    };

    viewerHiddenCurrentJam = false;
    saveState(next);
    showToast(
      `Jam scheduled for ${delay} seconds from now.`
    );

    window.clearTimeout(adminStartTimer);
    adminStartTimer =
      window.setTimeout(
        renderAdminState,
        delay * 1000 + 100
      );
  }

  function pauseJam() {
    if (!jamState) return;

    const next = {
      ...jamState,
      status: "paused",
      position:
        expectedPosition(jamState),
      startAt: null,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        crypto.randomUUID?.() ||
        `pause-${Date.now()}`
    };

    saveState(next);
    showToast("Jam paused for the room.");
  }

  function resumeJam() {
    if (!jamState) return;

    const next = {
      ...jamState,
      status: "scheduled",
      startAt: Date.now() + 1500,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        crypto.randomUUID?.() ||
        `resume-${Date.now()}`
    };

    viewerHiddenCurrentJam = false;
    saveState(next);
    showToast(
      "Jam resumes together in 1.5 seconds."
    );
  }

  function resyncJam() {
    if (!jamState) return;

    const status =
      effectiveStatus(jamState);
    const position =
      expectedPosition(jamState);

    const next = {
      ...jamState,
      status:
        status === "playing"
          ? "scheduled"
          : status,
      position,
      startAt:
        status === "playing"
          ? Date.now() + 1200
          : jamState.startAt,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        crypto.randomUUID?.() ||
        `resync-${Date.now()}`
    };

    saveState(next);
    showToast(
      "Resync command sent to every viewer tab."
    );
  }

  function endJam() {
    if (!jamState) return;

    const next = {
      ...jamState,
      status: "ended",
      position:
        expectedPosition(jamState),
      startAt: null,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        crypto.randomUUID?.() ||
        `end-${Date.now()}`
    };

    saveState(next);
    showToast("Halftime jam ended.");
  }

  function switchRoom() {
    const nextRoom =
      cleanRoom(
        elements.adminRoomInput.value
      );

    localStorage.setItem(
      "eastcoinHalftimeJamLastRoom",
      nextRoom
    );

    const url = buildRoleUrl(role);
    url.searchParams.set("room", nextRoom);
    location.href = url.href;
  }

  function openViewer() {
    window.open(
      buildRoleUrl(ROLE_VIEWER).href,
      "_blank",
      "noopener"
    );
  }

  async function copyViewerLink() {
    const value =
      buildRoleUrl(ROLE_VIEWER).href;

    try {
      await navigator.clipboard.writeText(
        value
      );
      showToast("Viewer link copied.");
    } catch {
      showToast(
        "Copy failed. Use the link shown below."
      );
    }
  }

  function loadDemo() {
    elements.videoInput.value =
      "M7lc1UVf-VE";
    elements.titleInput.value =
      "YouTube Player API Demo";
  }

  function loadYouTubeApi() {
    if (
      window.YT?.Player
    ) {
      return Promise.resolve();
    }

    if (youtubePromise) {
      return youtubePromise;
    }

    youtubePromise =
      new Promise((resolve) => {
        const previous =
          window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady =
          () => {
            previous?.();
            resolve();
          };

        const script =
          document.createElement("script");
        script.src =
          "https://www.youtube.com/iframe_api";
        script.async = true;
        document.head.appendChild(script);
      });

    return youtubePromise;
  }

  async function ensurePlayer() {
    if (player && playerReady) {
      return player;
    }

    await loadYouTubeApi();

    if (player) {
      return new Promise((resolve) => {
        const wait =
          window.setInterval(() => {
            if (playerReady) {
              window.clearInterval(wait);
              resolve(player);
            }
          }, 50);
      });
    }

    return new Promise((resolve) => {
      player = new YT.Player(
        "jamYoutubePlayer",
        {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            enablejsapi: 1,
            origin:
              location.origin === "null"
                ? undefined
                : location.origin
          },
          events: {
            onReady(event) {
              playerReady = true;
              event.target.setVolume(
                Number(
                  elements.volumeControl.value
                ) || 70
              );
              resolve(event.target);
            },
            onStateChange(event) {
              handlePlayerState(event.data);
            },
            onAutoplayBlocked() {
              elements.joinJamButton.hidden =
                false;
              setViewerStatus(
                "syncing",
                "Click Join the Jam",
                "Your browser blocked automatic sound."
              );
            },
            onError() {
              setViewerStatus(
                "waiting",
                "YouTube could not load",
                "Check that the video allows embedding."
              );
            }
          }
        }
      );
    });
  }

  function setOverlayVisible(visible) {
    if (visible) {
      elements.jamOverlay.classList.add(
        "active"
      );
      elements.jamOverlay.setAttribute(
        "aria-hidden",
        "false"
      );
    } else {
      elements.jamOverlay.classList.remove(
        "active"
      );
      elements.jamOverlay.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  }

  function setViewerStatus(
    mode,
    title,
    detail
  ) {
    const status =
      elements.viewerPlaybackStatus
        .closest(".jam-status");

    status.className =
      `jam-status ${mode || ""}`;
    elements.viewerPlaybackStatus.textContent =
      title;
    elements.viewerDriftStatus.textContent =
      detail;

    elements.viewerSyncChip.className =
      `sync-chip ${mode || "waiting"}`;
    elements.viewerSyncChip.textContent =
      title;
  }

  function clearViewerTimers() {
    window.clearTimeout(viewerStartTimer);
    window.clearInterval(countdownTimer);
    viewerStartTimer = null;
    countdownTimer = null;
    elements.startCountdown.hidden = true;
  }

  function showCountdown(state) {
    clearViewerTimers();

    const update = () => {
      const remaining =
        Number(state.startAt) -
        Date.now();

      if (remaining <= 0) {
        elements.startCountdown.hidden =
          true;
        window.clearInterval(
          countdownTimer
        );
        startPlaybackFromState(state);
        return;
      }

      elements.startCountdown.hidden =
        false;
      elements.countdownValue.textContent =
        String(
          Math.max(
            1,
            Math.ceil(remaining / 1000)
          )
        );
    };

    update();
    countdownTimer =
      window.setInterval(update, 100);
  }

  async function startPlaybackFromState(
    state,
    force = false
  ) {
    if (!state?.videoId) return;

    const youtube =
      await ensurePlayer();
    const expected =
      expectedPosition(state);

    const currentId =
      youtube.getVideoData?.()
        ?.video_id || "";
    const current =
      Number(
        youtube.getCurrentTime?.() || 0
      );

    if (
      force ||
      currentId !== state.videoId
    ) {
      youtube.loadVideoById({
        videoId: state.videoId,
        startSeconds: expected
      });
    } else if (
      Math.abs(current - expected) >
      1
    ) {
      youtube.seekTo(expected, true);
    }

    if (audioEnabled) {
      youtube.unMute();
      youtube.setVolume(
        Number(
          elements.volumeControl.value
        ) || 70
      );
      elements.joinJamButton.hidden =
        true;
    } else {
      youtube.mute();
      elements.joinJamButton.hidden =
        false;
    }

    youtube.playVideo();

    setViewerStatus(
      "syncing",
      "Synchronizing",
      `Target position ${formatTime(expected)}`
    );
  }

  async function applyViewerState(
    force = false
  ) {
    if (role !== ROLE_VIEWER) return;

    const state =
      jamState || readState();
    const status =
      effectiveStatus(state);

    elements.viewerRoomName.textContent =
      room;

    if (
      !state ||
      ["idle", "ended"].includes(status)
    ) {
      clearViewerTimers();
      setOverlayVisible(false);
      elements.joinJamButton.hidden = true;

      if (playerReady) {
        player.stopVideo();
      }

      setViewerStatus(
        "waiting",
        "Waiting for admin",
        "No active halftime jam."
      );
      return;
    }

    if (
      viewerHiddenCurrentJam &&
      !force &&
      Number(state.revision) ===
      lastAppliedRevision
    ) {
      return;
    }

    viewerHiddenCurrentJam = false;
    lastAppliedRevision =
      Number(state.revision || 0);

    setOverlayVisible(true);
    elements.viewerSongTitle.textContent =
      state.title ||
      "EastCoin Halftime Jam";
    elements.viewerSongMeta.textContent =
      `Video ${state.videoId} · Room ${room}`;

    const youtube =
      await ensurePlayer();

    if (status === "paused") {
      clearViewerTimers();

      const currentId =
        youtube.getVideoData?.()
          ?.video_id || "";

      if (currentId !== state.videoId) {
        youtube.cueVideoById({
          videoId: state.videoId,
          startSeconds:
            Number(state.position || 0)
        });
      } else {
        youtube.seekTo(
          Number(state.position || 0),
          true
        );
      }

      youtube.pauseVideo();

      setViewerStatus(
        "paused",
        "Paused by admin",
        `Held at ${formatTime(state.position)}`
      );
      return;
    }

    if (
      state.status === "scheduled" &&
      Date.now() <
        Number(state.startAt)
    ) {
      youtube.cueVideoById({
        videoId: state.videoId,
        startSeconds:
          Number(state.position || 0)
      });

      setViewerStatus(
        "scheduled",
        "Jam starting",
        "Preparing the synchronized start."
      );
      showCountdown(state);
      return;
    }

    clearViewerTimers();
    await startPlaybackFromState(
      state,
      force
    );
  }

  function handlePlayerState(playerState) {
    if (role !== ROLE_VIEWER) return;

    if (
      playerState ===
      YT.PlayerState.PLAYING
    ) {
      setViewerStatus(
        "playing",
        audioEnabled
          ? "Playing in sync"
          : "Playing muted",
        driftDescription()
      );
      return;
    }

    if (
      playerState ===
      YT.PlayerState.BUFFERING
    ) {
      setViewerStatus(
        "syncing",
        "Buffering",
        "EastCoin will correct the position afterward."
      );
      return;
    }

    if (
      playerState ===
      YT.PlayerState.PAUSED &&
      effectiveStatus(jamState) ===
      "paused"
    ) {
      setViewerStatus(
        "paused",
        "Paused by admin",
        `Held at ${formatTime(jamState.position)}`
      );
    }
  }

  function driftDescription() {
    if (
      !playerReady ||
      effectiveStatus(jamState) !==
      "playing"
    ) {
      return "Waiting for playback.";
    }

    const current =
      Number(
        player.getCurrentTime?.() || 0
      );
    const expected =
      expectedPosition(jamState);
    const drift =
      current - expected;
    const absolute =
      Math.abs(drift);

    if (absolute < .35) {
      return "Synced within 0.35 seconds.";
    }

    return `${absolute.toFixed(2)}s ${
      drift > 0 ? "ahead" : "behind"
    }.`;
  }

  function beginDriftCorrection() {
    driftTimer =
      window.setInterval(() => {
        if (
          role !== ROLE_VIEWER ||
          !playerReady ||
          effectiveStatus(jamState) !==
          "playing"
        ) {
          return;
        }

        const current =
          Number(
            player.getCurrentTime?.() ||
            0
          );
        const expected =
          expectedPosition(jamState);
        const drift =
          current - expected;

        elements.viewerDriftStatus
          .textContent =
          driftDescription();

        if (
          Math.abs(drift) > 1.15
        ) {
          player.seekTo(
            expected,
            true
          );

          setViewerStatus(
            "syncing",
            "Correcting sync",
            `Moved to ${formatTime(expected)}`
          );
        }
      }, 4000);
  }

  async function enableAudio() {
    audioEnabled = true;
    sessionStorage.setItem(
      AUDIO_KEY,
      "true"
    );

    elements.enableAudioButton.textContent =
      "Audio enabled";
    elements.enableAudioButton.disabled =
      true;

    const youtube =
      await ensurePlayer();

    youtube.unMute();
    youtube.setVolume(
      Number(
        elements.volumeControl.value
      ) || 70
    );

    if (
      ["scheduled", "playing"].includes(
        effectiveStatus(jamState)
      )
    ) {
      await startPlaybackFromState(
        jamState,
        true
      );
    }

    elements.joinJamButton.hidden = true;
    showToast(
      "Synced halftime audio enabled for this tab."
    );
  }

  function hideCurrentJam() {
    viewerHiddenCurrentJam = true;
    setOverlayVisible(false);
  }

  function manualViewerResync() {
    viewerHiddenCurrentJam = false;
    applyViewerState(true);
    showToast("Viewer resync requested.");
  }

  function handleStorage(event) {
    if (event.key !== stateKey()) {
      return;
    }

    jamState = readState();
    renderAdminState();
    applyViewerState();
  }

  function setCommandResult(message, success = true) {
    if (!elements.twitchCommandResult) return;

    elements.twitchCommandResult.textContent =
      message;
    elements.twitchCommandResult.classList.toggle(
      "error",
      !success
    );
  }

  function simulateTwitchCommand(rawCommand) {
    const commandLine =
      String(rawCommand || "").trim();
    const [command, ...argumentsList] =
      commandLine.split(/\s+/);
    const normalized =
      String(command || "").toLowerCase();
    const optionalVideo =
      argumentsList.join(" ").trim();

    if (!normalized) {
      setCommandResult(
        "Enter a Twitch command to simulate.",
        false
      );
      return;
    }

    if (
      normalized ===
      "!starthalftime"
    ) {
      if (optionalVideo) {
        elements.videoInput.value =
          optionalVideo;
      }

      startJam();
      setCommandResult(
        `Simulated ${normalized} as an authorized admin command.`
      );
      return;
    }

    if (
      normalized ===
      "!pausehalftime"
    ) {
      pauseJam();
      setCommandResult(
        `Simulated ${normalized}.`
      );
      return;
    }

    if (
      normalized ===
      "!resumehalftime"
    ) {
      resumeJam();
      setCommandResult(
        `Simulated ${normalized}.`
      );
      return;
    }

    if (
      normalized ===
      "!resynchaltime"
    ) {
      resyncJam();
      setCommandResult(
        `Simulated ${normalized}.`
      );
      return;
    }

    if (
      normalized ===
      "!endhalftime"
    ) {
      endJam();
      setCommandResult(
        `Simulated ${normalized}.`
      );
      return;
    }

    setCommandResult(
      `Unknown test command: ${normalized}`,
      false
    );
  }

  function initializeJamDragging() {
    if (
      role !== ROLE_VIEWER ||
      !elements.jamOverlay ||
      !elements.viewerWatchLayout
    ) {
      return;
    }

    const handle =
      elements.jamOverlay.querySelector(
        "[data-jam-drag-handle]"
      );

    if (!handle) return;

    let dragState = null;

    const stopDragging = (event) => {
      if (!dragState) return;

      try {
        handle.releasePointerCapture(
          event.pointerId
        );
      } catch {}

      dragState = null;
    };

    handle.addEventListener(
      "pointerdown",
      (event) => {
        if (
          event.button !== 0 ||
          event.target.closest("button")
        ) {
          return;
        }

        const bounds =
          elements.viewerWatchLayout
            .getBoundingClientRect();
        const panel =
          elements.jamOverlay
            .getBoundingClientRect();

        dragState = {
          pointerId: event.pointerId,
          offsetX:
            event.clientX - panel.left,
          offsetY:
            event.clientY - panel.top,
          bounds
        };

        elements.jamOverlay.style.right =
          "auto";
        elements.jamOverlay.style.bottom =
          "auto";

        handle.setPointerCapture(
          event.pointerId
        );

        event.preventDefault();
      }
    );

    handle.addEventListener(
      "pointermove",
      (event) => {
        if (
          !dragState ||
          event.pointerId !==
          dragState.pointerId
        ) {
          return;
        }

        const bounds =
          elements.viewerWatchLayout
            .getBoundingClientRect();
        const width =
          elements.jamOverlay.offsetWidth;
        const height =
          elements.jamOverlay.offsetHeight;

        const left = Math.min(
          Math.max(
            0,
            event.clientX -
              bounds.left -
              dragState.offsetX
          ),
          Math.max(0, bounds.width - width)
        );

        const top = Math.min(
          Math.max(
            0,
            event.clientY -
              bounds.top -
              dragState.offsetY
          ),
          Math.max(0, bounds.height - height)
        );

        elements.jamOverlay.style.left =
          `${left}px`;
        elements.jamOverlay.style.top =
          `${top}px`;
      }
    );

    handle.addEventListener(
      "pointerup",
      stopDragging
    );
    handle.addEventListener(
      "pointercancel",
      stopDragging
    );
  }

  function initializeAdmin() {
    elements.adminRoomInput.value = room;

    elements.switchRoomButton
      .addEventListener(
        "click",
        switchRoom
      );
    elements.delaySelect.addEventListener(
      "change",
      updateStartButton
    );
    elements.startJamButton.addEventListener(
      "click",
      startJam
    );
    elements.loadDemoButton.addEventListener(
      "click",
      loadDemo
    );
    elements.pauseButton.addEventListener(
      "click",
      pauseJam
    );
    elements.resumeButton.addEventListener(
      "click",
      resumeJam
    );
    elements.resyncButton.addEventListener(
      "click",
      resyncJam
    );
    elements.endButton.addEventListener(
      "click",
      endJam
    );
    elements.openViewerButton
      .addEventListener(
        "click",
        openViewer
      );
    elements.copyViewerButton
      .addEventListener(
        "click",
        copyViewerLink
      );

    elements.runTwitchCommandButton
      ?.addEventListener(
        "click",
        () => simulateTwitchCommand(
          elements.twitchCommandInput.value
        )
      );

    elements.twitchCommandInput
      ?.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            simulateTwitchCommand(
              elements.twitchCommandInput.value
            );
          }
        }
      );

    document
      .querySelectorAll(
        "[data-test-command]"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            elements.twitchCommandInput.value =
              button.dataset.testCommand;
            simulateTwitchCommand(
              button.dataset.testCommand
            );
          }
        );
      });

    updateStartButton();
    renderAdminState();
    scheduleAdminRender();
  }

  function initializeViewer() {
    elements.viewerRoomName.textContent =
      room;

    elements.enableAudioButton
      .addEventListener(
        "click",
        enableAudio
      );
    elements.joinJamButton.addEventListener(
      "click",
      enableAudio
    );
    elements.leaveJamButton.addEventListener(
      "click",
      hideCurrentJam
    );
    elements.viewerResyncButton
      .addEventListener(
        "click",
        manualViewerResync
      );
    elements.volumeControl.addEventListener(
      "input",
      () => {
        if (playerReady) {
          player.setVolume(
            Number(
              elements.volumeControl.value
            ) || 0
          );
        }
      }
    );

    if (audioEnabled) {
      elements.enableAudioButton.textContent =
        "Audio enabled";
      elements.enableAudioButton.disabled =
        true;
    }

    initializeJamDragging();
    applyViewerState();
    beginDriftCorrection();
  }

  window.addEventListener(
    "storage",
    handleStorage
  );

  window.addEventListener(
    "beforeunload",
    () => {
      channel?.close();
      window.clearInterval(
        presenceTimer
      );
      window.clearInterval(
        driftTimer
      );
      window.clearInterval(
        adminRenderTimer
      );
    }
  );

  localStorage.setItem(
    "eastcoinHalftimeJamLastRoom",
    room
  );

  applyRoleLinks();
  connectChannel();
  startPresence();

  if (role === ROLE_ADMIN) {
    initializeAdmin();
  } else {
    initializeViewer();
  }
})();
