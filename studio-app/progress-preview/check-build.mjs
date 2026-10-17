import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.progress-site');
let count=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name),s=await lstat(full);assert(!s.isSymbolicLink(),'No links in public artifact');if(s.isDirectory()){await walk(full);continue;}assert(/\.(?:html|js|css|svg|woff2)$/.test(entry.name)||['.nojekyll','OFL-Inter.txt'].includes(entry.name),'Unexpected public artifact');if(entry.name.endsWith('.woff2')){const bytes=await readFile(full);assert(bytes.subarray(0,4).toString()==='wOF2'&&bytes.length<200000,'Unexpected font artifact');assert.equal(createHash('sha256').update(bytes).digest('hex'),'4ce3dc1af0117e2edfd9c8c5fb978251018f5f4d3ef88325796abfc3e680ef18','Unreviewed public font');count++;continue;}const raw=await readFile(full,'utf8');assert(!/-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----|AKIA[A-Z0-9]{16}|gh[pousr]_[A-Za-z0-9]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(raw),'Secret-shaped content in public artifact');if(entry.name==='index.html'&&full.includes(path.sep+'p251'+path.sep)){assert(raw.includes("connect-src 'none'"));assert(!/https?:\/\//.test(raw));assert(raw.includes('/assets/index-'));}count++;}}
await walk(root);console.log(JSON.stringify({state:'public_preview_bundle_checked',files:count,backend_artifacts:0,private_media:0,source_maps:0}));

