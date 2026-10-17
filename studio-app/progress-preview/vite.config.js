import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
 root:here,publicDir:false,base:process.env.PREVIEW_BASE||'/sixnine-design/p251/local/',
 define:{__SOURCE_SNAPSHOT__:JSON.stringify('49d58e13f67b52360f94cb96354c5a41d55e4441'),__PREVIEW_BUILD__:JSON.stringify(process.env.PREVIEW_BUILD||'local')},
 plugins:[{name:'isolated-progress-preview',enforce:'pre',
 load(id){if(id.endsWith('/src/legacy-seed.json'))return JSON.stringify({title:'Synthetic preview',chapters:[]});},
 transform(code,id){
  if(id.endsWith('/src/app-navigation.js')){
   const old="export const appPath=pathname=>pathname.replace(/\\/+$/,'')||'/';";
   if(!code.includes(old))throw Error('Canonical router changed; review preview prefix adapter.');
   code=code.replace(old,"export const appPath=pathname=>(pathname.startsWith(globalThis.__INKSEQ_PREVIEW_BASE__)?pathname.slice(globalThis.__INKSEQ_PREVIEW_BASE__.length-1):pathname).replace(/\\/+$/,'')||'/';");
   code=code.replace('const next=url.pathname+url.search+url.hash;','url.pathname=globalThis.__previewPath(url.pathname);const next=url.pathname+url.search+url.hash;');
  }
  if(id.endsWith('/src/cloud-client.js'))code=code.replace("return parsed.pathname+'?'+query;","return globalThis.__INKSEQ_PREVIEW_BASE__+'preview-assets/shape.svg';");
  return code;
 }}],
 build:{outDir:path.resolve(here,'../../.progress-site','p251',process.env.PREVIEW_BUILD||'local'),emptyOutDir:true,sourcemap:false},
});

