/* EastCoin Music shared-room configuration.
   Leave websocketUrl blank for local/single-browser mode.
   After deploying the included Cloudflare Worker, set this to the Worker URL.
   Example: https://eastcoin-music-room.<your-subdomain>.workers.dev
*/
window.EASTCOIN_MUSIC_CONFIG = Object.assign(
  {
    websocketUrl: "",
    room: "main"
  },
  window.EASTCOIN_MUSIC_CONFIG || {}
);
