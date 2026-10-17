import {build} from 'vite';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),revision=process.env.PREVIEW_BUILD||'local';
if(!/^(?:local|[a-f0-9]{40})$/.test(revision))throw Error('Invalid preview revision');
process.env.PREVIEW_BUILD=revision;process.env.PREVIEW_BASE=(process.env.PREVIEW_PROJECT_BASE||'/sixnine-design/')+'p251/'+revision+'/';
await build({configFile:path.join(here,'vite.config.js')});
const site=path.resolve(here,'../../.progress-site'),selected=path.join(site,'p251',revision),html=await readFile(path.join(selected,'index.html'),'utf8');
for(const route of ['quick-chat','library','operator','settings','trash','freestyle']){await mkdir(path.join(selected,route),{recursive:true});await writeFile(path.join(selected,route,'index.html'),html);}
await mkdir(path.join(selected,'preview-assets'),{recursive:true});
await copyFile(path.join(here,'../src/v2/fonts/OFL-Inter.txt'),path.join(selected,'OFL-Inter.txt'));
await writeFile(path.join(selected,'preview-assets/shape.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#202b42"/><circle cx="460" cy="100" r="50" fill="#e6b987"/><path d="M0 360L160 130 330 360 470 190 640 360" fill="#566c80"/><text x="24" y="330" fill="#dce4f0" font-family="sans-serif" font-size="18">Synthetic preview artwork</text></svg>');
await writeFile(path.join(site,'index.html'),'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inkseq progress preview</title><style>body{background:#11141c;color:#edf0f7;font:18px system-ui;padding:8vw}a{color:#b9c9ff}</style><h1>Inkseq progress preview</h1><p>Synthetic data only. Visual work in progress.</p><a href="./p251/'+revision+'/">Open latest component snapshot</a>');
await writeFile(path.join(site,'.nojekyll'),'');
console.log('Preview site: '+selected);

