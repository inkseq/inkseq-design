import React, {useState} from 'react';
import {RotateCcw, Trash2} from 'lucide-react';
import {AppHeader} from './pages.jsx';
import {useStore} from './store.jsx';
import {daysLeft, TRASH_DAYS, trashItems} from './trash.js';

const GROUPS = [['all', '全部'], ['story', '故事和镜头', ['story', 'chapter', 'scene', 'shot', 'version']], ['lib', '素材库', ['asset', 'profile', 'variant']], ['session', '快速创作', ['session']]];

export function TrashPage() {
  const {raw, dispatch, toast} = useStore();
  const [group, setGroup] = useState('all'), [picked, setPicked] = useState([]), [confirm, setConfirm] = useState(null);
  const all = trashItems(raw);
  const kinds = GROUPS.find(g => g[0] === group)[2];
  const items = kinds ? all.filter(x => kinds.includes(x.item.kind)) : all;
  const sel = items.filter(x => picked.includes(x.key));
  const restore = list => { list.forEach(x => dispatch({type: 'restore', item: x.item})); setPicked([]); toast(list.length > 1 ? `已恢复 ${list.length} 项` : `「${list[0].name}」已恢复`); };
  const toggle = k => setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
  return (
    <div className="home">
      <AppHeader />
      <main className="trash-page">
        <div className="trash-head"><h1 className="page-title"><Trash2 size={20} />回收站 <small>{all.length}</small></h1><div className="spacer" />
          {all.length > 0 && <button className="ghost small danger-text" onClick={() => setConfirm({list: all, text: `清空回收站里的全部 ${all.length} 项？`})}>清空回收站</button>}</div>
        <p className="muted">删掉的东西在这里保留 {TRASH_DAYS} 天，随时可以恢复到原来的位置。</p>
        <div className="seg trash-filter">{GROUPS.map(([k, l, ks]) => { const n = ks ? all.filter(x => ks.includes(x.item.kind)).length : all.length;
          return <button key={k} className={group === k ? 'on' : ''} onClick={() => { setGroup(k); setPicked([]); }}>{l} · {n}</button>; })}</div>
        {items.length ? <div className="trash-list">
          {sel.length > 0 && <div className="trash-bar">已选 {sel.length} 项<div className="spacer" style={{flex: 1}} />
            <button className="small" onClick={() => restore(sel)}><RotateCcw size={13} />恢复</button>
            <button className="small danger" onClick={() => setConfirm({list: sel, text: `永久删除选中的 ${sel.length} 项？`})}>永久删除</button></div>}
          {items.map(x => <div key={x.key} className="trash-row">
            <input type="checkbox" checked={picked.includes(x.key)} onChange={() => toggle(x.key)} aria-label={'选择 ' + x.name} />
            {x.clip ? <img className="thumb" src={`/clips/${x.clip}-first.jpg`} alt="" /> : x.asset && x.asset.kind !== 'audio' ? <img className="thumb" src={x.asset.thumb} alt="" /> : <span className="thumb">{x.asset ? '♪' : x.type}</span>}
            <div className="name"><b className="clip">{x.name}</b><small>{x.type} · {x.where}</small></div>
            <span className="left">{daysLeft(x.at) ? `${daysLeft(x.at)} 天后永久删除` : '今天永久删除'}</span>
            <div className="acts"><button className="small" onClick={() => restore([x])}><RotateCcw size={13} />恢复</button>
              <button className="small ghost" title="永久删除" onClick={() => setConfirm({list: [x], text: `永久删除「${x.name}」？`})}><Trash2 size={13} /></button></div>
          </div>)}
        </div> : <div className="empty-state"><span><Trash2 size={22} /></span><b>回收站是空的</b><small className="muted">删除的故事、镜头、素材和创作会先放在这里。</small></div>}
      </main>
      {confirm && <div className="modal-back" onClick={() => setConfirm(null)}><div className="purge-confirm modal-card" onClick={e => e.stopPropagation()}>
        <b>{confirm.text}</b><small>永久删除后没法恢复。用到它的镜头会改用默认造型，或把这个素材空出来。</small>
        <div className="row tight"><div style={{flex: 1}} /><button className="small" onClick={() => setConfirm(null)}>算了</button>
          <button className="small danger" onClick={() => { dispatch({type: 'purge', items: confirm.list.map(x => x.item)}); setPicked([]); setConfirm(null); toast(`已永久删除 ${confirm.list.length} 项`); }}>永久删除</button></div>
      </div></div>}
    </div>
  );
}
