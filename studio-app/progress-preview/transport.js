import {ACCOUNT,fixture} from './fixtures.js';
export function createFixtureFetch({origin,audit}){
 return async(input,options={})=>{
  const target=typeof input==='string'?input:input?.url,method=(options.method||input?.method||'GET').toUpperCase(),url=new URL(target,origin);
  audit.calls.push({path:url.pathname,method});if(audit.calls.length>500)audit.calls.shift();
  const denied=code=>new Response(JSON.stringify({message:'Progress preview only. Live actions are disabled.',code}),{status:403,headers:{'Content-Type':'application/json'}});
  if(url.origin!==origin||method!=='GET'||!/^\/(v1\/|api\/auth\/)/.test(url.pathname)){audit.blocked.push({path:url.pathname,method});return denied('progress_preview_disabled');}
  try{return new Response(JSON.stringify(fixture(url.pathname+url.search)),{headers:{'Content-Type':'application/json','X-Authenticated-Account':ACCOUNT}});}
  catch{return denied('progress_preview_missing_fixture');}
 };
}

