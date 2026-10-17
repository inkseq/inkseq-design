import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureFetch} from './transport.js';
import {ACCOUNT,project} from './fixtures.js';
import {validateProject} from '../src/store.js';
import {checkedLibraryPage} from '../src/library-commands.js';
test('fixture project is valid synthetic canonical data',()=>{assert.equal(validateProject(project).ok,true);assert.match(project.title,/Night delivery/);assert.equal(ACCOUNT,'preview-demo');assert.equal(project.entities.filter(e=>e.type==='shot').length,4);});
test('fixture transport has no network fallback, rejects every write and foreign/unknown read',async()=>{
 const audit={calls:[],blocked:[]},fetcher=createFixtureFetch({origin:'https://preview.example',audit});
 assert.equal((await (await fetcher('/api/auth/me')).json()).username,ACCOUNT);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetcher('/v1/jobs',{method,body:'synthetic'})).status,403);
 for(const url of ['https://inkseq.invalid/v1/jobs','https://staging.invalid/v1/projects','/v1/unmapped','/arbitrary'])assert.equal((await fetcher(url)).status,403);
 assert.equal(checkedLibraryPage(await (await fetcher('/v1/library')).json()).items.length,3);
 assert.equal(audit.calls.length,10);
});

