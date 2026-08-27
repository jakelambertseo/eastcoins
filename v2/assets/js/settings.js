(() => {
  "use strict";
  const V2=window.ECV2,$=V2.$,KEY="eastcoinV2SettingsV1";
  const defaults=Object.freeze({navVisible:true,chatVisible:true,showArtwork:true,compactCards:false,startingSoonFirst:false});
  const saved=V2.read(KEY,{}); V2.state.settings={...defaults,...(saved&&typeof saved==="object"?saved:{})};
  const E={button:$("#settingsBtn"),modal:$("#settingsModal"),close:$("#settingsClose"),done:$("#settingsDone"),navAction:$("#settingsNavAction"),chatAction:$("#settingsChatAction"),chatTitle:$("#settingsChatActionTitle"),chatValue:$("#settingsChatActionValue"),navRestore:$("#navRestore"),artwork:$("#settingArtwork"),compact:$("#settingCompact"),soon:$("#settingSoon"),sportMenu:$("#sportMoreMenu"),sportMore:$("#sportMoreBtn")};
  function save(){V2.write(KEY,V2.state.settings)}
  function apply(){const s=V2.state.settings;document.body.classList.toggle("ec-nav-hidden",!s.navVisible);document.body.classList.toggle("ec-chat-hidden",!s.chatVisible);document.body.classList.toggle("ec-no-artwork",!s.showArtwork);document.body.classList.toggle("ec-compact-cards",s.compactCards);E.navRestore.hidden=s.navVisible;E.artwork.checked=s.showArtwork;E.compact.checked=s.compactCards;E.soon.checked=s.startingSoonFirst;E.chatTitle.textContent=s.chatVisible?"Close Twitch Chat":"Open Twitch Chat";E.chatValue.textContent=s.chatVisible?"Hide":"Show";if(s.chatVisible)V2.els.chat.classList.add("open")}
  function open(){apply();E.modal.classList.add("open");E.modal.setAttribute("aria-hidden","false")}
  function close(){E.modal.classList.remove("open");E.modal.setAttribute("aria-hidden","true")}
  function setNavVisible(v){V2.state.settings.navVisible=!!v;if(!v){E.sportMenu.hidden=true;E.sportMore?.setAttribute("aria-expanded","false")}save();apply()}
  function setChatVisible(v,o={}){V2.state.settings.chatVisible=!!v;save();apply();if(v&&o.attention!==false){V2.els.chat.classList.add("attention");setTimeout(()=>V2.els.chat.classList.remove("attention"),700)}}
  function setPreference(n,v){if(!(n in defaults))return;V2.state.settings[n]=!!v;save();apply();if(n==="startingSoonFirst"){V2.events?.renderGrid?.();V2.events?.renderFeature?.();V2.events?.renderUpNext?.()}}
  function wire(){E.button.onclick=open;E.close.onclick=close;E.done.onclick=close;E.navAction.onclick=()=>{close();setNavVisible(false)};E.navRestore.onclick=()=>{setNavVisible(true);V2.toast("Navigation restored.")};E.chatAction.onclick=()=>setChatVisible(!V2.state.settings.chatVisible,{attention:false});E.artwork.onchange=()=>setPreference("showArtwork",E.artwork.checked);E.compact.onchange=()=>setPreference("compactCards",E.compact.checked);E.soon.onchange=()=>setPreference("startingSoonFirst",E.soon.checked);E.modal.addEventListener("click",e=>{if(e.target===E.modal)close()})}
  function init(){apply();wire()}
  V2.settings={defaults,open,close,apply,setNavVisible,setChatVisible,setPreference,init};
})();
