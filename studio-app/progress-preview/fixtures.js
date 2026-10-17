// Curated synthetic content only. No captured account responses or media.
export const ACCOUNT='preview-demo';
const entity=(id,type,title,parentId,order,data={})=>({id,type,title,parentId,order,data,description:'Synthetic progress fixture',version:1,status:'draft'});
export const project={schemaVersion:4,id:'preview-night-delivery',title:'Night delivery',logline:'A fictional courier brings a paper lantern across a quiet city. Synthetic preview only.',entities:[entity('preview-chapter','chapter','After dark',null,0),entity('preview-street','scene','Lantern street','preview-chapter',0),entity('preview-door','scene','The last doorstep','preview-chapter',1),...['A quiet crossing','A light in the window','The final turn','A doorstep greeting'].map((title,i)=>entity('preview-shot-'+i,'shot',title,i<2?'preview-street':'preview-door',i%2,{seconds:5,prompt:'A fictional geometric city at dusk; no real person or location.'})),entity('preview-character','character','The courier',null,1,{role:'Fictional lead'}),entity('preview-location','location','Lantern street',null,2,{time:'Dusk'})],links:[],layout:{positions:{},viewport:{x:0,y:0,zoom:1}},jobs:[],updatedAt:'2026-10-17T00:00:00Z'};
const clone=x=>structuredClone(x);
const recipes=['fl','ref'].map(mode=>({id:'preview-'+mode,name:mode==='fl'?'FL · preview disabled':'REF · preview disabled',mode,model_id:'preview',controls:{duration:{type:'number',default:5,minimum:1,maximum:10},resolution:{type:'string',enum:['480p'],default:'480p'},aspect_ratio:{type:'string',enum:['16:9','9:16'],default:'16:9'}},limits:{min_clip_duration:1,max_clip_duration:10},execution_support:{configured:false,enabled:false,reason:'Synthetic progress preview. Paid actions are disabled.'}}));
const library=['character','location','prop'].map((type,i)=>({target:{kind:'entity',project_id:project.id,id:'preview-library-'+i},project_version:1,title:['The courier','Lantern street','Paper lantern'][i],type,tags:['synthetic','progress preview'],usage:[],project_id:project.id,project_title:project.title,description:'A synthetic fixture for this public progress preview.'}));
export function fixture(path){
 const url=new URL(path,'https://preview.invalid'),p=url.pathname,now=Date.now()/1000;
 if(p==='/api/auth/config')return {mode:'preview',auth_mode:'preview',ready:true,users:[]};
 if(p==='/api/auth/me')return {username:ACCOUNT,operator_capacity:{view:true,admin:false},features:{storyboard_workspace:true}};
 if(p==='/v1/projects')return {projects:[clone(project)]};
 if(p==='/v1/projects/'+project.id)return {id:project.id,owner_id:ACCOUNT,version:1,project:clone(project)};
 if(p.endsWith('/meta'))return {id:project.id,version:1};
 if(p==='/v1/capabilities')return {generation_enabled:false,render_enabled:false,recipes,models:[],deployment_profiles:[],upload_max_bytes:0};
 if(p==='/v1/generation-availability')return {version:1,advisory_only:true,observed_at:now,expires_at:now+10,profiles:[{deployment_profile_id:null,modes:Object.fromEntries(recipes.map(r=>[r.mode,{recipe_id:r.id,state:'disabled',available:false,reason_code:'progress_preview'}]))}]};
 if(p==='/v1/quick-chat/schema')return {version:1,assistant_enabled:false,models:[],default_model_id:'preview',default_settings:{recipe_id:'preview-fl',controls:{}}};
 if(p==='/v1/quick-chat/preferences')return {version:1,copies_max:4,takes_fold_count:8};
 if(p==='/v1/quick-chat/sessions')return {sessions:[],next_cursor:null,as_of:'2026-10-17T00:00:00Z'};
 if(p==='/v1/library'){
  const type=url.searchParams.get('type'),query=(url.searchParams.get('q')||'').toLowerCase();
  const images=['Geometric skyline','Paper lantern','Evening crossing'].map((title,i)=>({target:{kind:'asset',project_id:project.id,id:'preview-image-'+i},asset_id:'preview-image-'+i,project_version:1,title,type:'image',tags:['synthetic','progress preview'],usage:[],project_id:project.id,project_title:project.title}));
  const rows=(type==='image'||type==='file'?images:library).filter(row=>(!type||type==='file'||row.type===type)&&row.title.toLowerCase().includes(query));
  return {storage_scope:'project',usage_scope:'authorized_projects',aggregate_read_only:true,items:clone(rows),next_offset:null};
 }
 if(p==='/v1/trash')return {items:[],next_offset:null,auto_purge:false};
 if(p==='/v1/operator/dstack/catalog')return {profiles:[]};
 if(['/v1/operator/dstack/workspace','/v1/operator/dstack/state'].includes(p))return {capacity_backend:'dstack-v1',operator:{account:ACCOUNT,admin:false},observed_at:now,nodes:[],groups:[],queue:[]};
 if(p==='/v1/operator/budgets')return {account:ACCOUNT,basis:'cumulative',currency:'USD',timezone:'UTC',budgets:[]};
 if(p==='/v1/account/spending-settings')return {version:1,snapshot:'synthetic',value:{daily_limit_microusd:0,ask_above_microusd:0,connection_limits:{}},usage:{projected_microusd:0},connections:[],admin:false};
 if(p==='/v1/account/agent-connections')return {connections:[],items:[],next_offset:null};
 if(p==='/v1/jobs')return {jobs:[]};
 if(p==='/v1/assets')return {assets:[]};
 if(p==='/v1/batches')return {batches:[]};
 if(p==='/v1/activity-summary')return {active:0,total:0};
 if(p==='/v1/storage-usage')return {accounted_bytes:0,limit_bytes:0,active_uploads:0,max_active:0};
 throw Error('No synthetic fixture for '+p);
}

