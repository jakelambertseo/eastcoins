(() => {
  "use strict";

  const ROLE_LISTENER = "listener";
  const ROLE_VIEWER = "viewer";
  const CHANNEL_PREFIX =
    "eastcoin-halftime-jams-test-v2:";
  const STATE_PREFIX =
    "eastcoinHalftimeJamTestState:v2:";
  const AUDIO_KEY =
    "eastcoinHalftimeJamAudioEnabledV1";
  const SETTINGS_KEY =
    "eastcoinHalftimeListenerSettingsV1";
  const EVENTSUB_URL =
    "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";
  const START_DELAY_MS = 3000;

  const parameters =
    new URLSearchParams(location.search);
  const rawRole = parameters.get("role");
  const role =
    rawRole === ROLE_VIEWER
      ? ROLE_VIEWER
      : ROLE_LISTENER;
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
    listenerRoleLink:
      document.getElementById(
        "listenerRoleLink"
      ),
    viewerRoleLink:
      document.getElementById(
        "viewerRoleLink"
      ),
    toast:
      document.getElementById("toast"),

    clientIdInput:
      document.getElementById(
        "clientIdInput"
      ),
    accessTokenInput:
      document.getElementById(
        "accessTokenInput"
      ),
    channelInput:
      document.getElementById(
        "channelInput"
      ),
    authorizedUsersInput:
      document.getElementById(
        "authorizedUsersInput"
      ),
    listenerRoomInput:
      document.getElementById(
        "listenerRoomInput"
      ),
    switchRoomButton:
      document.getElementById(
        "switchRoomButton"
      ),
    connectListenerButton:
      document.getElementById(
        "connectListenerButton"
      ),
    disconnectListenerButton:
      document.getElementById(
        "disconnectListenerButton"
      ),
    listenerError:
      document.getElementById(
        "listenerError"
      ),
    listenerConnectionPill:
      document.getElementById(
        "listenerConnectionPill"
      ),
    tokenUserValue:
      document.getElementById(
        "tokenUserValue"
      ),
    channelValue:
      document.getElementById(
        "channelValue"
      ),
    subscriptionValue:
      document.getElementById(
        "subscriptionValue"
      ),
    lastCommandValue:
      document.getElementById(
        "lastCommandValue"
      ),
    playlistTitles: [1, 2, 3].map(
      (number) =>
        document.getElementById(
          `playlistTitle${number}`
        )
    ),
    playlistVideos: [1, 2, 3].map(
      (number) =>
        document.getElementById(
          `playlistVideo${number}`
        )
    ),
    listenerCount:
      document.getElementById(
        "listenerCount"
      ),
    stateStatus:
      document.getElementById(
        "stateStatus"
      ),
    stateVideo:
      document.getElementById(
        "stateVideo"
      ),
    statePlaylistPosition:
      document.getElementById(
        "statePlaylistPosition"
      ),
    statePosition:
      document.getElementById(
        "statePosition"
      ),
    stateRevision:
      document.getElementById(
        "stateRevision"
      ),
    controllerPill:
      document.getElementById(
        "controllerPill"
      ),
    listenerLog:
      document.getElementById(
        "listenerLog"
      ),
    clearLogButton:
      document.getElementById(
        "clearLogButton"
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
    viewerWatchLayout:
      document.getElementById(
        "viewerWatchLayout"
      ),
    jamOverlay:
      document.getElementById(
        "jamOverlay"
      ),
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
    viewerPlaylistProgress:
      document.getElementById(
        "viewerPlaylistProgress"
      ),
    viewerResyncButton:
      document.getElementById(
        "viewerResyncButton"
      ),
    volumeControl:
      document.getElementById(
        "volumeControl"
      )
  };

  let room = initialRoom;
  let roomChannel = null;
  let jamState = readState();
  let twitchSocket = null;
  let reconnectTimer = null;
  let intentionalDisconnect = false;
  let listenerCredentials = null;
  let currentSessionId = "";
  let currentSubscriptionId = "";
  let seenMessageIds = new Set();
  let viewerStartTimer = null;
  let countdownTimer = null;
  let driftTimer = null;
  let presenceTimer = null;
  let monitorTimer = null;
  let toastTimer = null;
  let youtubePromise = null;
  let viewerPlayer = null;
  let viewerPlayerReady = false;
  let controllerPlayer = null;
  let controllerPlayerReady = false;
  let controllerExpectedVideoId = "";
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

  function cleanLogin(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9_]/g, "");
  }

  function stateKey() {
    return `${STATE_PREFIX}${room}`;
  }

  function buildRoleUrl(nextRole) {
    const url = new URL(location.href);
    url.searchParams.set(
      "role",
      nextRole
    );
    url.searchParams.set("room", room);
    return url;
  }

  function applyRoleLinks() {
    elements.roleBadge.textContent =
      role === ROLE_LISTENER
        ? "Listener"
        : "Viewer";

    const listenerUrl =
      buildRoleUrl(ROLE_LISTENER);
    const viewerUrl =
      buildRoleUrl(ROLE_VIEWER);

    elements.listenerRoleLink.href =
      listenerUrl.href;
    elements.viewerRoleLink.href =
      viewerUrl.href;

    elements.listenerRoleLink.classList.toggle(
      "active",
      role === ROLE_LISTENER
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
    elements.toast.classList.add(
      "visible"
    );

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove(
        "visible"
      );
    }, 2600);
  }

  function addLog(
    message,
    mode = ""
  ) {
    if (!elements.listenerLog) return;

    const empty =
      elements.listenerLog.querySelector(
        ".muted-log"
      );
    empty?.remove();

    const entry =
      document.createElement("p");
    entry.className = mode;
    entry.textContent =
      `[${new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      })}] ${message}`;

    elements.listenerLog.prepend(entry);

    while (
      elements.listenerLog.children.length >
      60
    ) {
      elements.listenerLog.lastElementChild
        ?.remove();
    }
  }

  function setListenerStatus(
    mode,
    label
  ) {
    if (!elements.listenerConnectionPill) {
      return;
    }

    elements.listenerConnectionPill.className =
      `connection-pill ${mode || ""}`;
    elements.listenerConnectionPill.textContent =
      label;
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

    sendRoomMessage({
      type: "state",
      state: nextState
    });

    renderRoomState();
    applyViewerState();
    applyControllerState();
  }

  function sendRoomMessage(message) {
    roomChannel?.postMessage({
      ...message,
      room,
      senderId: clientId,
      sentAt: Date.now()
    });
  }

  function connectRoomChannel() {
    roomChannel?.close();

    if ("BroadcastChannel" in window) {
      roomChannel = new BroadcastChannel(
        `${CHANNEL_PREFIX}${room}`
      );

      roomChannel.addEventListener(
        "message",
        (event) => {
          handleRoomMessage(event.data);
        }
      );
    }

    sendRoomMessage({
      type: "presence-request"
    });
  }

  function handleRoomMessage(message) {
    if (
      !message ||
      message.room !== room ||
      message.senderId === clientId
    ) {
      return;
    }

    if (message.type === "state") {
      jamState = message.state;
      renderRoomState();
      applyViewerState();
      applyControllerState();
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
      role === ROLE_LISTENER
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
    sendRoomMessage({
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
      return;
    }

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
        sendRoomMessage({
          type: "presence-request"
        });
      }, 4000);
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
            ["embed", "shorts", "live"]
              .includes(part)
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

  function playlistFromInputs() {
    const playlist =
      elements.playlistVideos.map(
        (input, index) => ({
          videoId:
            parseVideoId(input.value),
          title:
            elements.playlistTitles[index]
              .value.trim() ||
            `Halftime Jam ${index + 1}`
        })
      );

    if (
      playlist.some(
        (item) => !item.videoId
      )
    ) {
      throw new Error(
        "All three playlist entries need a valid YouTube URL or video ID."
      );
    }

    return playlist;
  }

  function authorizedUsers() {
    const users =
      elements.authorizedUsersInput.value
        .split(",")
        .map(cleanLogin)
        .filter(Boolean);

    const broadcaster =
      cleanLogin(
        elements.channelInput.value
      );

    return new Set([
      ...users,
      broadcaster
    ]);
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

  function currentPlaylistItem(
    state = jamState
  ) {
    return (
      state?.playlist?.[
        Number(state.currentIndex || 0)
      ] || null
    );
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

  function renderRoomState() {
    if (role !== ROLE_LISTENER) return;

    const status =
      effectiveStatus(jamState);
    const item =
      currentPlaylistItem(jamState);
    const index =
      Number(jamState?.currentIndex || 0);

    const labels = {
      idle: "Idle",
      scheduled: "Scheduled",
      playing: "Playing",
      paused: "Paused",
      ended: "Ended"
    };

    elements.stateStatus.textContent =
      labels[status] || status;
    elements.stateVideo.textContent =
      item?.title ||
      "Nothing selected";
    elements.statePlaylistPosition
      .textContent =
      jamState?.playlist?.length
        ? `${index + 1} / ${jamState.playlist.length}`
        : "0 / 3";
    elements.statePosition.textContent =
      formatTime(
        expectedPosition(jamState)
      );
    elements.stateRevision.textContent =
      String(
        jamState?.revision || 0
      );

    if (elements.controllerPill) {
      elements.controllerPill.textContent =
        status === "playing"
          ? `Playing ${index + 1} / 3`
          : labels[status] || "Waiting";
    }
  }

  function scheduleMonitorRender() {
    monitorTimer =
      window.setInterval(
        renderRoomState,
        500
      );
  }

  function startPlaylistFromCommand(
    commandEvent
  ) {
    let playlist;

    try {
      playlist = playlistFromInputs();
    } catch (error) {
      addLog(
        `Start rejected: ${error.message}`,
        "error"
      );
      return;
    }

    const next = {
      version: 2,
      room,
      status: "scheduled",
      playlist,
      currentIndex: 0,
      position: 0,
      startAt:
        Date.now() + START_DELAY_MS,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        commandEvent.message_id ||
        crypto.randomUUID?.() ||
        `start-${Date.now()}`,
      triggeredBy:
        commandEvent.chatter_user_login ||
        ""
    };

    viewerHiddenCurrentJam = false;
    saveState(next);

    addLog(
      `${commandEvent.chatter_user_login} started the three-video playlist.`,
      "success"
    );
    showToast(
      "Authorized Twitch command started the playlist."
    );
  }

  function pausePlaylist(
    commandEvent
  ) {
    if (
      !jamState ||
      !["scheduled", "playing"].includes(
        effectiveStatus(jamState)
      )
    ) {
      addLog(
        "Pause ignored because no playlist is playing.",
        "error"
      );
      return;
    }

    const next = {
      ...jamState,
      status: "paused",
      position:
        expectedPosition(jamState),
      startAt: null,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        commandEvent.message_id ||
        `pause-${Date.now()}`
    };

    saveState(next);
    addLog(
      `${commandEvent.chatter_user_login} paused the playlist.`,
      "command"
    );
  }

  function resumePlaylist(
    commandEvent
  ) {
    if (
      !jamState ||
      effectiveStatus(jamState) !==
      "paused"
    ) {
      addLog(
        "Resume ignored because the playlist is not paused.",
        "error"
      );
      return;
    }

    const next = {
      ...jamState,
      status: "scheduled",
      startAt:
        Date.now() + 1500,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        commandEvent.message_id ||
        `resume-${Date.now()}`
    };

    saveState(next);
    addLog(
      `${commandEvent.chatter_user_login} resumed the playlist.`,
      "command"
    );
  }

  function resyncPlaylist(
    commandEvent
  ) {
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
        commandEvent.message_id ||
        `resync-${Date.now()}`
    };

    saveState(next);
    addLog(
      `${commandEvent.chatter_user_login} resynchronized the playlist.`,
      "command"
    );
  }

  function advancePlaylist(
    reason = "ended"
  ) {
    if (!jamState?.playlist?.length) {
      return;
    }

    const nextIndex =
      Number(jamState.currentIndex || 0) +
      1;

    if (
      nextIndex >=
      jamState.playlist.length
    ) {
      endPlaylist({
        chatter_user_login:
          "Playlist controller",
        message_id:
          `complete-${Date.now()}`
      });
      addLog(
        "All three halftime videos finished.",
        "success"
      );
      return;
    }

    const next = {
      ...jamState,
      status: "scheduled",
      currentIndex: nextIndex,
      position: 0,
      startAt:
        Date.now() + 1200,
      updatedAt: Date.now(),
      revision: nextRevision(),
      commandId:
        `${reason}-${Date.now()}`
    };

    saveState(next);
    addLog(
      `Advancing automatically to video ${nextIndex + 1} of 3.`,
      "success"
    );
  }

  function skipPlaylist(
    commandEvent
  ) {
    if (!jamState?.playlist?.length) {
      addLog(
        "Skip ignored because no playlist is active.",
        "error"
      );
      return;
    }

    addLog(
      `${commandEvent.chatter_user_login} skipped the current video.`,
      "command"
    );
    advancePlaylist("skip");
  }

  function endPlaylist(
    commandEvent
  ) {
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
        commandEvent.message_id ||
        `end-${Date.now()}`
    };

    saveState(next);
    addLog(
      `${commandEvent.chatter_user_login} ended the halftime playlist.`,
      "command"
    );
  }

  function handleAuthorizedCommand(
    event
  ) {
    const text =
      String(event.message?.text || "")
        .trim();
    const [command] =
      text.split(/\s+/);
    const normalized =
      String(command || "").toLowerCase();

    const handlers = {
      "!starthalftime":
        startPlaylistFromCommand,
      "!pausehalftime":
        pausePlaylist,
      "!resumehalftime":
        resumePlaylist,
      "!skiphalftime":
        skipPlaylist,
      "!resynchaltime":
        resyncPlaylist,
      "!endhalftime":
        endPlaylist
    };

    const handler = handlers[normalized];

    if (!handler) return;

    elements.lastCommandValue.textContent =
      `${normalized} — ${event.chatter_user_login}`;

    if (
      !authorizedUsers().has(
        cleanLogin(
          event.chatter_user_login
        )
      )
    ) {
      addLog(
        `Ignored ${normalized} from unauthorized user ${event.chatter_user_login}.`,
        "error"
      );
      return;
    }

    addLog(
      `Received ${normalized} from ${event.chatter_user_login}.`,
      "command"
    );
    handler(event);
  }

  async function twitchFetch(
    url,
    options = {}
  ) {
    const response = await fetch(
      url,
      {
        ...options,
        headers: {
          Authorization:
            `Bearer ${listenerCredentials.accessToken}`,
          "Client-Id":
            listenerCredentials.clientId,
          ...(options.headers || {})
        }
      }
    );

    if (!response.ok) {
      let detail = "";

      try {
        const payload =
          await response.json();
        detail =
          payload.message ||
          payload.error ||
          "";
      } catch {}

      throw new Error(
        detail ||
        `Twitch request failed (${response.status}).`
      );
    }

    return response.json();
  }

  async function validateListenerCredentials() {
    const clientId =
      elements.clientIdInput.value.trim();
    const accessToken =
      elements.accessTokenInput.value
        .trim()
        .replace(/^oauth:/i, "");
    const channel =
      cleanLogin(
        elements.channelInput.value
      );

    if (
      !clientId ||
      !accessToken ||
      !channel
    ) {
      throw new Error(
        "Client ID, access token, and channel login are required."
      );
    }

    setListenerStatus(
      "connecting",
      "Validating token"
    );

    const validationResponse =
      await fetch(
        "https://id.twitch.tv/oauth2/validate",
        {
          headers: {
            Authorization:
              `OAuth ${accessToken}`
          }
        }
      );

    if (!validationResponse.ok) {
      throw new Error(
        "Twitch rejected the access token."
      );
    }

    const validation =
      await validationResponse.json();

    if (
      validation.client_id !== clientId
    ) {
      throw new Error(
        "The Client ID does not match the access token."
      );
    }

    if (
      !Array.isArray(validation.scopes) ||
      !validation.scopes.includes(
        "user:read:chat"
      )
    ) {
      throw new Error(
        "The token needs the user:read:chat scope."
      );
    }

    listenerCredentials = {
      clientId,
      accessToken,
      channel,
      tokenUserId:
        validation.user_id,
      tokenLogin:
        validation.login
    };

    const broadcasterPayload =
      await twitchFetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`
      );

    const broadcaster =
      broadcasterPayload.data?.[0];

    if (!broadcaster?.id) {
      throw new Error(
        `Twitch channel "${channel}" was not found.`
      );
    }

    listenerCredentials.broadcasterId =
      broadcaster.id;
    listenerCredentials.broadcasterLogin =
      broadcaster.login;

    elements.tokenUserValue.textContent =
      validation.login ||
      validation.user_id;
    elements.channelValue.textContent =
      `#${broadcaster.login}`;

    saveListenerSettings();
  }

  function saveListenerSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          clientId:
            elements.clientIdInput.value
              .trim(),
          channel:
            cleanLogin(
              elements.channelInput.value
            ),
          authorizedUsers:
            elements.authorizedUsersInput
              .value,
          playlistTitles:
            elements.playlistTitles.map(
              (input) => input.value
            ),
          playlistVideos:
            elements.playlistVideos.map(
              (input) => input.value
            )
        })
      );
    } catch {}
  }

  function loadListenerSettings() {
    try {
      const settings = JSON.parse(
        localStorage.getItem(
          SETTINGS_KEY
        ) || "null"
      );

      if (!settings) return;

      elements.clientIdInput.value =
        settings.clientId || "";
      elements.channelInput.value =
        settings.channel || "zwades";
      elements.authorizedUsersInput.value =
        settings.authorizedUsers ||
        "zwades";

      settings.playlistTitles
        ?.slice(0, 3)
        .forEach((value, index) => {
          elements.playlistTitles[index]
            .value = value;
        });

      settings.playlistVideos
        ?.slice(0, 3)
        .forEach((value, index) => {
          elements.playlistVideos[index]
            .value = value;
        });
    } catch {}
  }

  async function createChatSubscription(
    sessionId
  ) {
    setListenerStatus(
      "connecting",
      "Creating subscription"
    );

    const payload =
      await twitchFetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            type:
              "channel.chat.message",
            version: "1",
            condition: {
              broadcaster_user_id:
                listenerCredentials
                  .broadcasterId,
              user_id:
                listenerCredentials
                  .tokenUserId
            },
            transport: {
              method: "websocket",
              session_id: sessionId
            }
          })
        }
      );

    currentSubscriptionId =
      payload.data?.[0]?.id || "";

    elements.subscriptionValue.textContent =
      currentSubscriptionId
        ? `Active · ${currentSubscriptionId.slice(0, 8)}…`
        : "Active";

    setListenerStatus(
      "",
      "Listening"
    );
    elements.connectListenerButton.disabled =
      true;
    elements.disconnectListenerButton.disabled =
      false;

    addLog(
      `Listening to #${listenerCredentials.broadcasterLogin} chat through Twitch EventSub.`,
      "success"
    );
  }

  function connectTwitchSocket(
    url = EVENTSUB_URL,
    isReconnect = false
  ) {
    window.clearTimeout(reconnectTimer);

    if (
      twitchSocket &&
      twitchSocket.readyState <= 1
    ) {
      twitchSocket.close();
    }

    twitchSocket = new WebSocket(url);

    twitchSocket.addEventListener(
      "open",
      () => {
        setListenerStatus(
          "connecting",
          isReconnect
            ? "Reconnecting"
            : "Connecting"
        );
      }
    );

    twitchSocket.addEventListener(
      "message",
      async (message) => {
        let packet;

        try {
          packet = JSON.parse(
            message.data
          );
        } catch {
          return;
        }

        const messageType =
          packet.metadata?.message_type;

        if (
          messageType ===
          "session_welcome"
        ) {
          currentSessionId =
            packet.payload?.session?.id ||
            "";

          if (!isReconnect) {
            try {
              await createChatSubscription(
                currentSessionId
              );
            } catch (error) {
              elements.listenerError.textContent =
                error.message;
              addLog(
                error.message,
                "error"
              );
              disconnectTwitchListener();
            }
          } else {
            setListenerStatus(
              "",
              "Listening"
            );
            addLog(
              "Twitch EventSub reconnected.",
              "success"
            );
          }
          return;
        }

        if (
          messageType ===
          "session_reconnect"
        ) {
          const reconnectUrl =
            packet.payload?.session
              ?.reconnect_url;

          if (reconnectUrl) {
            addLog(
              "Twitch requested an EventSub reconnect."
            );
            connectTwitchSocket(
              reconnectUrl,
              true
            );
          }
          return;
        }

        if (
          messageType ===
          "revocation"
        ) {
          const status =
            packet.payload?.subscription
              ?.status ||
            "revoked";
          elements.listenerError.textContent =
            `Twitch revoked the subscription: ${status}.`;
          addLog(
            `Subscription revoked: ${status}.`,
            "error"
          );
          return;
        }

        if (
          messageType !==
          "notification" ||
          packet.metadata
            ?.subscription_type !==
          "channel.chat.message"
        ) {
          return;
        }

        const event =
          packet.payload?.event;

        if (!event?.message_id) return;

        if (
          seenMessageIds.has(
            event.message_id
          )
        ) {
          return;
        }

        seenMessageIds.add(
          event.message_id
        );

        if (seenMessageIds.size > 300) {
          seenMessageIds =
            new Set(
              [...seenMessageIds].slice(-150)
            );
        }

        handleAuthorizedCommand(event);
      }
    );

    twitchSocket.addEventListener(
      "close",
      () => {
        currentSessionId = "";

        if (intentionalDisconnect) {
          return;
        }

        setListenerStatus(
          "connecting",
          "Reconnecting"
        );
        addLog(
          "Twitch listener disconnected. Retrying in three seconds.",
          "error"
        );

        reconnectTimer =
          window.setTimeout(
            () =>
              connectTwitchSocket(
                EVENTSUB_URL,
                false
              ),
            3000
          );
      }
    );

    twitchSocket.addEventListener(
      "error",
      () => {
        addLog(
          "The Twitch EventSub WebSocket reported an error.",
          "error"
        );
      }
    );
  }

  async function connectTwitchListener() {
    if (role !== ROLE_LISTENER) return;

    elements.listenerError.textContent =
      "";
    intentionalDisconnect = false;
    elements.connectListenerButton.disabled =
      true;

    try {
      await validateListenerCredentials();
      addLog(
        `Validated Twitch token for ${listenerCredentials.tokenLogin}.`,
        "success"
      );
      connectTwitchSocket();
    } catch (error) {
      elements.listenerError.textContent =
        error.message;
      addLog(error.message, "error");
      setListenerStatus(
        "offline",
        "Disconnected"
      );
      elements.connectListenerButton.disabled =
        false;
    }
  }

  function disconnectTwitchListener() {
    intentionalDisconnect = true;
    window.clearTimeout(reconnectTimer);

    if (twitchSocket) {
      twitchSocket.close();
      twitchSocket = null;
    }

    listenerCredentials = null;
    currentSessionId = "";
    currentSubscriptionId = "";
    elements.accessTokenInput.value = "";
    elements.subscriptionValue.textContent =
      "Not created";
    setListenerStatus(
      "offline",
      "Disconnected"
    );
    elements.connectListenerButton.disabled =
      false;
    elements.disconnectListenerButton.disabled =
      true;
    addLog(
      "Twitch listener disconnected."
    );
  }

  function switchRoom() {
    const nextRoom =
      cleanRoom(
        elements.listenerRoomInput.value
      );

    localStorage.setItem(
      "eastcoinHalftimeJamLastRoom",
      nextRoom
    );

    const url = buildRoleUrl(role);
    url.searchParams.set(
      "room",
      nextRoom
    );
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
        "Copy failed. Use the displayed link."
      );
    }
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) {
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

  async function ensureControllerPlayer() {
    if (
      controllerPlayer &&
      controllerPlayerReady
    ) {
      return controllerPlayer;
    }

    await loadYouTubeApi();

    if (controllerPlayer) {
      return new Promise((resolve) => {
        const wait =
          window.setInterval(() => {
            if (controllerPlayerReady) {
              window.clearInterval(wait);
              resolve(controllerPlayer);
            }
          }, 50);
      });
    }

    return new Promise((resolve) => {
      controllerPlayer = new YT.Player(
        "controllerYoutubePlayer",
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
              controllerPlayerReady = true;
              event.target.mute();
              event.target.setVolume(0);
              resolve(event.target);
            },
            onStateChange(event) {
              if (
                event.data ===
                YT.PlayerState.ENDED &&
                currentPlaylistItem()
                  ?.videoId ===
                controllerExpectedVideoId
              ) {
                advancePlaylist(
                  "video-ended"
                );
              }
            },
            onError() {
              addLog(
                "The controller could not load the current YouTube video.",
                "error"
              );
            }
          }
        }
      );
    });
  }

  async function applyControllerState() {
    if (role !== ROLE_LISTENER) return;

    const status =
      effectiveStatus(jamState);
    const item =
      currentPlaylistItem(jamState);

    if (
      !item ||
      ["idle", "ended"].includes(
        status
      )
    ) {
      if (controllerPlayerReady) {
        controllerPlayer.stopVideo();
      }
      controllerExpectedVideoId = "";
      return;
    }

    const youtube =
      await ensureControllerPlayer();
    const expected =
      expectedPosition(jamState);
    const currentId =
      youtube.getVideoData?.()
        ?.video_id || "";

    controllerExpectedVideoId =
      item.videoId;

    if (
      currentId !== item.videoId
    ) {
      youtube.cueVideoById({
        videoId: item.videoId,
        startSeconds: expected
      });
    }

    youtube.mute();
    youtube.setVolume(0);

    if (status === "paused") {
      youtube.seekTo(expected, true);
      youtube.pauseVideo();
      return;
    }

    if (
      jamState.status === "scheduled" &&
      Date.now() <
        Number(jamState.startAt)
    ) {
      window.setTimeout(
        () => applyControllerState(),
        Math.max(
          0,
          Number(jamState.startAt) -
          Date.now()
        )
      );
      return;
    }

    if (
      currentId !== item.videoId
    ) {
      youtube.loadVideoById({
        videoId: item.videoId,
        startSeconds: expected
      });
    } else {
      const current =
        Number(
          youtube.getCurrentTime?.() ||
          0
        );

      if (
        Math.abs(current - expected) >
        1
      ) {
        youtube.seekTo(
          expected,
          true
        );
      }

      youtube.playVideo();
    }
  }

  async function ensureViewerPlayer() {
    if (
      viewerPlayer &&
      viewerPlayerReady
    ) {
      return viewerPlayer;
    }

    await loadYouTubeApi();

    if (viewerPlayer) {
      return new Promise((resolve) => {
        const wait =
          window.setInterval(() => {
            if (viewerPlayerReady) {
              window.clearInterval(wait);
              resolve(viewerPlayer);
            }
          }, 50);
      });
    }

    return new Promise((resolve) => {
      viewerPlayer = new YT.Player(
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
              viewerPlayerReady = true;
              event.target.setVolume(
                Number(
                  elements.volumeControl.value
                ) || 70
              );
              resolve(event.target);
            },
            onStateChange(event) {
              handleViewerPlayerState(
                event.data
              );
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
                "Check that this video allows embedding."
              );
            }
          }
        }
      );
    });
  }

  function setOverlayVisible(visible) {
    elements.jamOverlay.classList.toggle(
      "active",
      visible
    );
    elements.jamOverlay.setAttribute(
      "aria-hidden",
      String(!visible)
    );
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
        startViewerPlayback(state);
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

  async function startViewerPlayback(
    state,
    force = false
  ) {
    const item =
      currentPlaylistItem(state);

    if (!item) return;

    const youtube =
      await ensureViewerPlayer();
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
      currentId !== item.videoId
    ) {
      youtube.loadVideoById({
        videoId: item.videoId,
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
      `Video ${Number(state.currentIndex) + 1} of ${state.playlist.length}`
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
    const item =
      currentPlaylistItem(state);

    elements.viewerRoomName.textContent =
      room;

    if (
      !state ||
      !item ||
      ["idle", "ended"].includes(status)
    ) {
      clearViewerTimers();
      setOverlayVisible(false);
      elements.joinJamButton.hidden = true;
      elements.viewerPlaylistProgress
        .textContent = "0 / 3";

      if (viewerPlayerReady) {
        viewerPlayer.stopVideo();
      }

      setViewerStatus(
        "waiting",
        "Waiting for Twitch command",
        "No active halftime playlist."
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
      item.title;
    elements.viewerSongMeta.textContent =
      `Video ${Number(state.currentIndex) + 1} of ${state.playlist.length}`;
    elements.viewerPlaylistProgress
      .textContent =
      `${Number(state.currentIndex) + 1} / ${state.playlist.length}`;

    const youtube =
      await ensureViewerPlayer();

    if (status === "paused") {
      clearViewerTimers();
      const currentId =
        youtube.getVideoData?.()
          ?.video_id || "";

      if (currentId !== item.videoId) {
        youtube.cueVideoById({
          videoId: item.videoId,
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
        "Paused by Twitch command",
        `Video ${Number(state.currentIndex) + 1} of ${state.playlist.length}`
      );
      return;
    }

    if (
      state.status === "scheduled" &&
      Date.now() <
        Number(state.startAt)
    ) {
      youtube.cueVideoById({
        videoId: item.videoId,
        startSeconds:
          Number(state.position || 0)
      });

      setViewerStatus(
        "scheduled",
        Number(state.currentIndex) === 0
          ? "Playlist starting"
          : "Next video starting",
        `Video ${Number(state.currentIndex) + 1} of ${state.playlist.length}`
      );
      showCountdown(state);
      return;
    }

    clearViewerTimers();
    await startViewerPlayback(
      state,
      force
    );
  }

  function handleViewerPlayerState(
    playerState
  ) {
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
      YT.PlayerState.ENDED &&
      effectiveStatus(jamState) ===
      "playing"
    ) {
      setViewerStatus(
        "syncing",
        "Waiting for next video",
        "The Twitch listener is advancing the playlist."
      );
    }
  }

  function driftDescription() {
    if (
      !viewerPlayerReady ||
      effectiveStatus(jamState) !==
      "playing"
    ) {
      return "Waiting for playback.";
    }

    const current =
      Number(
        viewerPlayer.getCurrentTime?.() ||
        0
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
          !viewerPlayerReady ||
          effectiveStatus(jamState) !==
          "playing"
        ) {
          return;
        }

        const current =
          Number(
            viewerPlayer
              .getCurrentTime?.() ||
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
          viewerPlayer.seekTo(
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
      await ensureViewerPlayer();

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
      await startViewerPlayback(
        jamState,
        true
      );
    }

    elements.joinJamButton.hidden = true;
    showToast(
      "Synced halftime audio enabled for this tab."
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
            event.clientY - panel.top
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
          Math.max(
            0,
            bounds.width - width
          )
        );

        const top = Math.min(
          Math.max(
            0,
            event.clientY -
              bounds.top -
              dragState.offsetY
          ),
          Math.max(
            0,
            bounds.height - height
          )
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

  function initializeListener() {
    loadListenerSettings();

    elements.listenerRoomInput.value =
      room;
    elements.channelValue.textContent =
      `#${cleanLogin(
        elements.channelInput.value
      ) || "zwades"}`;

    elements.switchRoomButton
      .addEventListener(
        "click",
        switchRoom
      );
    elements.connectListenerButton
      .addEventListener(
        "click",
        connectTwitchListener
      );
    elements.disconnectListenerButton
      .addEventListener(
        "click",
        disconnectTwitchListener
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
    elements.clearLogButton
      .addEventListener(
        "click",
        () => {
          elements.listenerLog.innerHTML =
            '<p class="muted-log">Log cleared.</p>';
        }
      );

    [
      elements.clientIdInput,
      elements.channelInput,
      elements.authorizedUsersInput,
      ...elements.playlistTitles,
      ...elements.playlistVideos
    ].forEach((input) => {
      input.addEventListener(
        "change",
        saveListenerSettings
      );
    });

    renderRoomState();
    scheduleMonitorRender();
    applyControllerState();
  }

  function initializeViewer() {
    elements.viewerRoomName.textContent =
      room;

    elements.enableAudioButton
      .addEventListener(
        "click",
        enableAudio
      );
    elements.joinJamButton
      .addEventListener(
        "click",
        enableAudio
      );
    elements.leaveJamButton
      .addEventListener(
        "click",
        () => {
          viewerHiddenCurrentJam = true;
          setOverlayVisible(false);
        }
      );
    elements.viewerResyncButton
      .addEventListener(
        "click",
        () => {
          viewerHiddenCurrentJam = false;
          applyViewerState(true);
          showToast(
            "Viewer resync requested."
          );
        }
      );
    elements.volumeControl
      .addEventListener(
        "input",
        () => {
          if (viewerPlayerReady) {
            viewerPlayer.setVolume(
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
    (event) => {
      if (event.key !== stateKey()) {
        return;
      }

      jamState = readState();
      renderRoomState();
      applyViewerState();
      applyControllerState();
    }
  );

  window.addEventListener(
    "beforeunload",
    () => {
      intentionalDisconnect = true;
      twitchSocket?.close();
      roomChannel?.close();
      window.clearInterval(
        presenceTimer
      );
      window.clearInterval(
        driftTimer
      );
      window.clearInterval(
        monitorTimer
      );
      window.clearTimeout(
        reconnectTimer
      );
    }
  );

  localStorage.setItem(
    "eastcoinHalftimeJamLastRoom",
    room
  );

  applyRoleLinks();
  connectRoomChannel();
  startPresence();

  if (role === ROLE_LISTENER) {
    initializeListener();
  } else {
    initializeViewer();
  }
})();
