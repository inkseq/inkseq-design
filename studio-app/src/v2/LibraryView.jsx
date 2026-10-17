// View ported from design/inkseq-v2-prototype/src/library.jsx.
// All ownership, uploads, commands and receipts are supplied by Library.jsx.
import React from 'react';
import {Box,Check,Files,Film,Image as ImageIcon,MapPin,Music,Plus,SlidersHorizontal,Tag,Trash2,Upload,UserRound,X} from 'lucide-react';
import StudioHeader from '../StudioHeader.jsx';
import {useI18n} from '../i18n/I18nProvider.jsx';
const ICONS={character:UserRound,location:MapPin,prop:Box,file:Files,image:ImageIcon,video:Film,audio:Music};

export default function LibraryView({account,filters={type:'image'},setFilters,projects=[],rows=[],selected=[],setSelected,libraryKey,locked,loading,next,onMore,onUpload,showUpload,uploadPanel,onRefresh,onTags,onFile,onDelete,onDetail,renderMedia,feedback,children}){
 const {t}=useI18n(),profile=['character','location','prop'].includes(filters.type),tags=[...new Set(rows.flatMap(r=>r.tags||[]))];
 const change=patch=>setFilters({...filters,...patch});
 const label=type=>t(type==='file'?'library.allFiles':'trash.kind.'+type);
 const toggle=row=>setSelected(old=>old.includes(libraryKey(row.target))?old.filter(k=>k!==libraryKey(row.target)):[...old,libraryKey(row.target)]);
 const Title=ICONS[filters.type]||Files;
 return <div className="home lib-shell"><StudioHeader account={account} active="library"/>
  <div className="libp"><aside className="libp-side">
   <div className="libp-group">{t('library.profile')}</div>
   {['character','location','prop'].map(k=>{const I=ICONS[k];return <button key={k} className={filters.type===k?'on':''} onClick={()=>change({type:k})}><I size={14}/><span>{label(k)}</span>{filters.type===k&&<small>{rows.length}</small>}</button>;})}
   <div className="libp-group">{t('library.file')}</div>
   {['file','image','video','audio'].map(k=>{const I=ICONS[k];return <button key={k} className={filters.type===k?'on':''} onClick={()=>change({type:k})}><I size={14}/><span>{label(k)}</span>{filters.type===k&&<small>{rows.length}</small>}</button>;})}
   <div className="libp-group">{t('library.work')}</div>
   <button className={!filters.work&&!filters.unused?'on':''} onClick={()=>change({work:'',unused:''})}>{t('library.anyWork')}</button>
   {projects.map(p=><button key={p.id} className={filters.work===p.id?'on':''} onClick={()=>change({work:p.id,unused:''})}><span className="clip">{p.title}</span></button>)}
   <button className={filters.unused?'on':''} onClick={()=>change({work:'',unused:true})}>{t('library.unused')}</button>
   {!!tags.length&&<><div className="libp-group">{t('library.tagHeading')}</div><div className="libp-tags">{tags.map(tag=><button key={tag} className={'tagchip'+(filters.tag===tag?' on':'')} onClick={()=>change({tag:filters.tag===tag?'':tag})}>{tag}<small>{rows.filter(r=>r.tags?.includes(tag)).length}</small></button>)}</div></>}
  </aside>
  <main className="libp-main" onDragOver={e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();}} onDrop={e=>{e.preventDefault();if(account)onUpload?.(e.dataTransfer.files);}}>
   <div className="libp-head"><h1 className="page-title"><Title size={20}/>{label(filters.type)}<small>{rows.length}</small></h1>
    {(filters.work||filters.unused)&&<span className="pill">{filters.unused?t('library.unused'):projects.find(p=>p.id===filters.work)?.title}<button className="x" onClick={()=>change({work:'',unused:''})}><X size={11}/></button></span>}
    {filters.tag&&<span className="pill"><Tag size={11}/>{filters.tag}<button className="x" onClick={()=>change({tag:''})}><X size={11}/></button></span>}
    <div className="spacer"/><input className="lib-search" aria-label={t('library.search')} placeholder={t('library.search')} value={filters.q||''} disabled={!account} onChange={e=>change({q:e.target.value})}/>
    <button className="primary" disabled={!account||locked} onClick={()=>onUpload?.()}><Upload size={15}/>{t('v2.upload')}</button>
    <details className="v2-library-tools"><summary aria-label={t('library.tagHeading')}><SlidersHorizontal size={16}/></summary><div className="card-box"><label className="field"><span>{t('library.source')}</span><select value={filters.project_id||''} onChange={e=>change({project_id:e.target.value})}><option value="">{t('library.all')}</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label><button disabled={loading} onClick={onRefresh}>{t('library.refresh')}</button></div></details>
   </div>
   {feedback}{!account?<p className="muted"><a href="/quick-chat">{t('library.signIn')}</a></p>:<>
   {showUpload&&uploadPanel}
   {selected.length>0&&<div className="libp-bulk"><b>{t('library.selected',{count:selected.length})}</b><button disabled={locked||!filters.project_id} onClick={onTags}><Tag size={14}/>{t('library.applyTags')}</button><button disabled={locked||!filters.project_id} onClick={onFile}>{t('library.fileInto')}</button><button className="small danger" disabled={locked||!filters.project_id} onClick={onDelete}><Trash2 size={13}/>{t('trash.move')}</button><div className="spacer"/><button className="small ghost" onClick={()=>setSelected(rows.map(r=>libraryKey(r.target)))}>{t('library.select')}</button><button className="small ghost" onClick={()=>setSelected([])}>{t('library.clear')}</button></div>}
   {loading&&rows.length===0&&<p className="muted" role="status">{t('library.loading')}</p>}
   <div className={profile?'libp-profiles':'libp-grid'}>{rows.map(row=>profile?<button key={libraryKey(row.target)} className="libp-pcard" onClick={()=>onDetail(row)}>{renderMedia(row)}<span><b>{row.title}</b><small className="muted">{row.source_project_title}</small><small>{row.unused?t('library.unused'):t('library.usage')+' · '+row.usage.length}</small></span></button>:<div key={libraryKey(row.target)} className={'libp-tile'+(selected.includes(libraryKey(row.target))?' picked':'')} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')onDetail(row);}} onClick={e=>e.shiftKey||e.metaKey||e.ctrlKey||selected.length?toggle(row):onDetail(row)}>
    <button className="libp-check" aria-label={row.title} aria-pressed={selected.includes(libraryKey(row.target))} onClick={e=>{e.stopPropagation();toggle(row);}}>{selected.includes(libraryKey(row.target))&&<Check size={12}/>}</button>{renderMedia(row)}<span className="libp-name clip">{row.title||t('library.receiptName')}</span><span className="libp-meta">{row.unused?t('library.unused'):t('library.usage')+' · '+row.usage.length}{row.tags?.length?' · '+row.tags.join(' · '):''}</span>
   </div>)}</div>
   {!loading&&!rows.length&&<p className="muted">{t('library.none')}</p>}{next!==null&&<button disabled={loading||locked} onClick={onMore}>{t('library.more')}</button>}<p className="muted libp-tip">{t('library.usageNote')}</p>
   </>}
  </main>{children}</div>
 </div>;
}
