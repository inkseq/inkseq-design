import {ACCOUNT,fixture,project} from './fixtures.js';
import {createFixtureFetch} from './transport.js';
const base=import.meta.env.BASE_URL;
globalThis.__INKSEQ_PREVIEW_BASE__=base;
const memory=()=>{const map=new Map();return {get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(String(k))??null,setItem:(k,v)=>map.set(String(k),String(v)),removeItem:k=>map.delete(String(k)),clear:()=>map.clear()};};
const local=memory(),session=memory();
local.setItem('yingxu-studio-v4',JSON.stringify({project,mode:'guide',section:'story',scopeId:'preview-chapter'}));
for(const [key,value]of [['localStorage',local],['sessionStorage',session],['indexedDB',{open(){throw Error('Uploads and persistent media are disabled in this progress preview.')}}]])Object.defineProperty(window,key,{value,configurable:false});
const audit={synthetic:true,documentId:crypto.randomUUID(),account:ACCOUNT,sourceSnapshot:__SOURCE_SNAPSHOT__,build:__PREVIEW_BUILD__,calls:[],blocked:[]};
Object.defineProperty(window,'__INKSEQ_PREVIEW__',{value:audit});
globalThis.fetch=createFixtureFetch({origin:location.origin,audit});
for(const key of ['XMLHttpRequest','WebSocket','EventSource'])Object.defineProperty(window,key,{value:class{constructor(){throw Error('Network disabled in progress preview.')}},configurable:false});
Object.defineProperty(navigator,'sendBeacon',{value:()=>false});
const paths=['/','/quick-chat','/library','/operator','/settings','/trash','/freestyle'];
const prefix=path=>path===base.slice(0,-1)||path.startsWith(base)?path:paths.includes(path.replace(/\/+$/,'')||'/')?base.slice(0,-1)+path:path;
globalThis.__previewPath=prefix;
for(const method of ['pushState','replaceState']){
 const original=history[method].bind(history);
 history[method]=(state,title,href)=>{if(href!=null){const u=new URL(href,location.href);if(u.origin===location.origin)href=prefix(u.pathname)+u.search+u.hash;}return original(state,title,href);};
}
document.addEventListener('click',event=>{
 const a=event.target.closest?.('a[href]');if(!a)return;
 const u=new URL(a.href,location.href);
 const localPath=u.pathname.startsWith(base)?u.pathname.slice(base.length-1):u.pathname;
 if(u.origin!==location.origin||!paths.includes(localPath.replace(/\/+$/,'')||'/')){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('submit',event=>{event.preventDefault();},true);
const disableLiveForms=()=>{for(const field of document.querySelectorAll('input[type=password],input[type=file],form button:not([type=button]),button[aria-label="Send"],button[aria-label="发送"]')){if(!field.disabled)field.disabled=true;field.title='Disabled in the synthetic progress preview';}};
new MutationObserver(disableLiveForms).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
const marker=document.createElement('aside');marker.id='preview-notice';marker.attachShadow({mode:'open'}).innerHTML=`<style>:host{position:fixed;right:12px;bottom:12px;z-index:2147483647;max-width:290px;font:12px/1.5 system-ui;color:#e9edf5;background:#181b24;border:1px solid #58617a;border-radius:10px;padding:9px 12px;box-shadow:0 4px 20px #0008}small{display:block;color:#acb4c6}summary{cursor:pointer}@media(max-width:760px){:host{bottom:75px;right:8px;max-width:245px;font-size:11px}}</style><details><summary>Progress preview · synthetic data</summary><small>No live API, generation, uploads or account changes. Actual component snapshot; seven-page visual acceptance is incomplete.</small><small>Snapshot ${audit.sourceSnapshot.slice(0,8)} · build ${audit.build.slice(0,8)}</small></details>`;
document.body.append(marker);
void import('../src/main.jsx').catch(()=>{document.getElementById('root').textContent='Progress preview could not open. No live action was attempted.';});

