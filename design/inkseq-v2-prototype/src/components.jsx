import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Popover} from './ui.jsx';
import {Takes} from './takes.jsx';
import {ByAgent} from './agent.jsx';
import {createPortal} from 'react-dom';
import {useDraggable, useDroppable} from '@dnd-kit/core';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {Box, Clapperboard, Film, Image as ImageIcon, Inbox, MapPin, MoreHorizontal, Music, Pause, Pencil, Play, Plus, SkipBack, SlidersHorizontal, Sparkles, Trash2, UserRound} from 'lucide-react';
import {AdvancedInline, changedCount} from './advanced.jsx';
import {Chip, checkInputs, SpecPicker} from './inputs.jsx';
import {KIND_LABEL, TYPE_LABEL, VARIANT_LABEL} from './data.js';
import {estimate, shotControls, chosenVersion, coverOf, expand, fmt, LIMITS, MODE_LABEL, modeOf, MODELS, planDrop, segments, shotProfiles, shotStatus, startFrame, totalDuration, variantOf} from './model.js';
import {queuePositions, useStore} from './store.jsx';
import {assetUsage, profileUsage} from './trash.js';

/* ---------- thumbs & draggable tiles ---------- */

export function AssetThumb({asset, size = 36}) {
  if (!asset) return <span className="athumb empty" style={{width: size, height: size}} />;
  if (asset.kind === 'audio') return <span className="athumb audio" style={{width: size, height: size}}>♪</span>;
  return <img className="athumb" src={asset.thumb} alt="" style={{width: size, height: size, filter: asset.hue ? `hue-rotate(${asset.hue}deg)` : undefined}} />;
}

// ⋯ on a file: rename / 移到回收站 (says where it is used; shots keep working once restored).
function AssetMenu({asset}) {
  const {state, dispatch, trash} = useStore();
  const [open, setOpen] = useState(false);
  const use = open ? assetUsage(state, asset.id) : null;
  const stop = e => e.stopPropagation(), close = useCallback(() => setOpen(false), []);
  return <>
    <button className="tile-dots" title="更多" data-pop={'tile-' + asset.id} onPointerDown={stop} onClick={e => { stop(e); setOpen(!open); }}><MoreHorizontal size={14} /></button>
    {open && <Popover owner={'tile-' + asset.id} className="tile-menu" onPointerDown={stop} onClick={stop} onClose={close}>
      <button onClick={() => { setOpen(false); const n = prompt('文件名', asset.name); if (n?.trim()) dispatch({type: 'renameAsset', id: asset.id, name: n.trim()}); }}><Pencil size={13} />重命名</button>
      <hr />
      <button className="danger-item" onClick={() => { setOpen(false); trash({kind: 'asset', id: asset.id}, asset.name); }}><Trash2 size={13} />移到回收站</button>
      <small className="menu-note">{use.text ? `正在用在 ${use.text}；删除后那里会先空着，恢复就回来` : '没有地方在用'}</small>
    </Popover>}
  </>;
}

function Tile({asset, used, onClick, onZoom, dragId, children, menu}) {
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({id: dragId || 'asset:' + asset.id});
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={'tile' + (isDragging ? ' dragging' : '') + (used ? ' used' : '')}
      onClick={onClick} title={`${asset.name}\n拖到镜头或档案上，或选中镜头后点击添加`}>
      {asset.kind === 'audio' ? <div className="tile-audio">♪<small>{asset.seconds}s</small></div>
        : <img src={asset.thumb} alt="" draggable={false} style={{filter: asset.hue ? `hue-rotate(${asset.hue}deg)` : undefined}} />}
      {asset.kind === 'video' && <span className="tile-badge">▶ {asset.seconds}s</span>}
      {asset.kind === 'audio' && <span className="tile-play"><PlayButton asset={asset} /></span>}
      {asset.source === 'ai' && <span className="tile-badge ai">AI</span>}
      {asset.source === 'frame' && <span className="tile-badge">截帧</span>}
      {used && <span className="tile-used">✓</span>}
      <span className="tile-name">{asset.name}</span>
      {menu && <AssetMenu asset={asset} />}
      {onZoom && asset.kind !== 'audio' && <button className="tile-zoom" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onZoom(asset); }}>⤢</button>}
      {children}
    </div>
  );
}

function ProfileCard({p, used, onOpen, onAdd}) {
  const {db} = useStore();
  const drag = useDraggable({id: 'profile:' + p.id});
  const drop = useDroppable({id: 'pdrop:' + p.id});
  const cover = coverOf(db, p, p.def);
  const count = p.variants.reduce((n, v) => n + v.images.length, 0);
  const dragged = drop.isOver && String(drop.active?.id).startsWith('asset:') ? db.asset(String(drop.active.id).slice(6)) : null;
  const fileOver = !!dragged;
  const hint = !dragged ? '' : dragged.kind === 'image' ? `松开：照片存进 ${p.name}`
    : dragged.kind === 'audio' ? (p.type === 'character' ? `松开：加为 ${p.name} 的声音` : p.type === 'location' ? '松开：设为环境声' : '道具不能放声音')
    : '动作视频请拖到镜头上';
  return (
    <div ref={n => { drag.setNodeRef(n); drop.setNodeRef(n); }} {...drag.listeners} {...drag.attributes}
      className={'pcard ' + p.type + (drag.isDragging ? ' dragging' : '') + (used ? ' used' : '') + (fileOver ? ' drop-hot' : '')}
      onClick={onOpen} title="点击：打开档案编辑 · 拖到镜头上：加进镜头">
      <AssetThumb asset={cover} size={52} />
      <div className="pcard-body"><b>{p.name}</b>
        <small>{p.type === 'prop' ? `${count} 张图` : `${p.variants.length} 个${VARIANT_LABEL[p.type]} · ${count} 张图`}{p.voices?.length ? ` · ${p.voices.length} 段声音` : ''}{p.ambient ? ' · 有环境声' : ''}</small>
        <small className="muted clip">{p.desc}</small></div>
      {onAdd && <button className="pcard-open" title="加到当前选中的镜头" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onAdd(); }}>{used ? '✓ 已在镜头' : '＋ 镜头'}</button>}
      {fileOver && <div className={'drop-hint' + (dragged.kind === 'video' || (dragged.kind === 'audio' && p.type === 'prop') ? ' warn' : '')}>{hint}</div>}
    </div>
  );
}

/* ---------- audio playback ---------- */

let player = null;
export function PlayButton({asset, start = 0, len = null, label}) {
  const [on, setOn] = useState(false);
  useEffect(() => () => { if (player?.owner === setOn) { player.audio.pause(); player = null; } }, []);
  if (!asset?.src) return null;
  const toggle = e => {
    e.stopPropagation();
    if (player) { const same = player.owner === setOn; player.audio.pause(); player.owner(false); player = null; if (same) return; }
    const audio = new Audio(asset.src);
    audio.currentTime = start;
    audio.play().catch(() => {});
    const stop = () => { audio.pause(); setOn(false); if (player?.audio === audio) player = null; };
    if (len) audio.addEventListener('timeupdate', () => audio.currentTime >= start + len && stop());
    audio.addEventListener('ended', stop);
    player = {audio, owner: setOn};
    setOn(true);
  };
  return <button className={'play' + (on ? ' on' : '')} onPointerDown={e => e.stopPropagation()} onClick={toggle} title={label || '试听'}>{on ? '■' : '▶'}{label ? ' ' + label : ''}</button>;
}

/* ---------- files from the computer ---------- */

const mediaDuration = (url, tag) => new Promise(res => {
  const el = document.createElement(tag); el.preload = 'metadata'; el.src = url;
  el.onloadedmetadata = () => res(Math.round(el.duration * 10) / 10); el.onerror = () => res(0);
});
// A real poster for an uploaded video: the frame at ~0.5s, drawn to a small canvas.
const videoPoster = url => new Promise(res => {
  const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.src = url;
  v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
  v.onseeked = () => { const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * (v.videoHeight || 9) / (v.videoWidth || 16));
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); };
  v.onerror = () => res(null);
  setTimeout(() => res(null), 4000);
});
export async function readFiles(fileList) {
  const out = [];
  for (const f of [...fileList]) {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith('image/')) out.push({kind: 'image', name: f.name, thumb: url});
    else if (f.type.startsWith('audio/')) out.push({kind: 'audio', name: f.name, src: url, seconds: await mediaDuration(url, 'audio')});
    else if (f.type.startsWith('video/')) out.push({kind: 'video', name: f.name, src: url, thumb: (await videoPoster(url)) || '/clips/c6-first.jpg', seconds: await mediaDuration(url, 'video')});
  }
  return out;
}
const nativeDrop = onFiles => ({
  onDragOver: e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.currentTarget.classList.add('drop-hot'); } },
  onDragLeave: e => e.currentTarget.classList.remove('drop-hot'),
  onDrop: async e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); e.currentTarget.classList.remove('drop-hot'); onFiles(await readFiles(e.dataTransfer.files)); },
});

// Choose files already in the library, or bring new ones from the computer.
function ChooseFiles({kind, exclude, title, onPick, onFiles, onClose}) {
  const {state} = useStore();
  const [q, setQ] = useState('');
  const input = useRef();
  const list = state.assets.filter(a => a.kind === kind && !exclude.has(a.id) && (!q || a.name.includes(q)));
  return createPortal(
    <div className="choose-overlay" onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="choose" onClick={e => e.stopPropagation()} {...nativeDrop(files => { onFiles(files); onClose(); })}>
        <div className="picker-head"><b>{title}</b><button className="x" onClick={onClose}>×</button></div>
        <div className="row tight">
          <input className="lib-search" autoFocus placeholder="在素材库里搜索…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="primary" onClick={() => input.current.click()}>从电脑选择…</button>
          <input ref={input} type="file" multiple hidden accept={kind === 'image' ? 'image/*' : 'audio/*'}
            onChange={async e => { onFiles(await readFiles(e.target.files)); onClose(); }} />
        </div>
        <div className="picker-note">也可以把文件从电脑桌面直接拖进这个窗口</div>
        {kind === 'image' ? <div className="picker-grid">{list.map(a => (
          <button key={a.id} className="tile" onClick={() => onPick(a.id)} title={a.name}><img src={a.thumb} alt="" /><span className="tile-name">{a.name}</span></button>))}</div>
          : <div className="alist">{list.map(a => (
            <div key={a.id} className="arow"><PlayButton asset={a} /><span className="clip">{a.name}</span><small>{a.seconds}s</small>
              <button className="small" onClick={() => onPick(a.id)}>添加</button></div>))}</div>}
        {!list.length && <p className="muted">素材库里没有可添加的{kind === 'image' ? '图片' : '声音'}了，从电脑选择吧</p>}
      </div>
    </div>, document.body);
}

/* ---------- library ---------- */

const LIB_TABS = [['character', '人物', UserRound], ['location', '场景', MapPin], ['prop', '道具', Box], ['image', '图片', ImageIcon], ['video', '动作', Film], ['audio', '声音', Music], ['inbox', '待整理', Inbox]];

export function AssetLibrary({onPick, selectedShot, compact}) {
  const {state, dispatch, db} = useStore();
  const [tab, setTab] = useState('character'), [q, setQ] = useState(''), [wide, setWide] = useState(false), [zoom, setZoom] = useState(null);
  const inbox = state.assets.filter(a => a.inbox);
  const count = k => k === 'inbox' ? inbox.length : ['character', 'location', 'prop'].includes(k) ? state.profiles.filter(p => p.type === k).length
    : state.assets.filter(a => a.kind === k && !a.inbox).length;
  const match = s => !q || s.includes(q);
  const usedP = new Set(selectedShot ? [...selectedShot.cast.map(c => c.id), selectedShot.place?.id, ...selectedShot.props] : []);
  const usedA = new Set(selectedShot ? [...selectedShot.refs, selectedShot.start, selectedShot.end].filter(Boolean) : []);
  const isProfileTab = ['character', 'location', 'prop'].includes(tab);
  return (
    <aside className={'library' + (wide ? ' wide' : '') + (compact ? ' compact' : '')}>
      <div className="lib-head"><b>素材库</b><small>{state.profiles.length} 个档案 · {state.assets.length} 个文件</small>
        <button className="small ghost" onClick={() => setWide(!wide)}>{wide ? '收起' : '展开'}</button></div>
      <input className="lib-search" placeholder="搜索：林岚、站台、信…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="lib-tabs">{LIB_TABS.map(([k, l, I]) => (
        <button key={k} className={(tab === k ? 'on ' : '') + (k === 'inbox' && inbox.length ? 'alert' : '')} onClick={() => setTab(k)} title={l}><I size={13} /><span>{l}</span><small>{count(k)}</small></button>))}</div>
      {selectedShot && <div className="lib-ctx">当前镜头「{selectedShot.title}」· ✓ 已用 · 点击即添加</div>}

      {isProfileTab && <>
        <div className="plist">{state.profiles.filter(p => p.type === tab && match(p.name + p.desc)).map(p => (
          <ProfileCard key={p.id} p={p} used={usedP.has(p.id)} onOpen={() => dispatch({type: 'openProfile', id: p.id})}
            onAdd={selectedShot ? () => onPick({profile: p.id}) : null} />))}</div>
        <button className="small add-profile" onClick={() => { const name = prompt(`新建${TYPE_LABEL[tab]}的名字`); if (name) dispatch({type: 'newProfile', ptype: tab, name}); }}>
          ＋ 新建{TYPE_LABEL[tab]}</button>
        <div className="lib-tip">{tab === 'character' ? '人物 = 描述 + 造型照片 + 声音。拖到镜头上，三样一起带上。' : tab === 'location' ? '场景 = 布局描述 + 白天/夜晚等版本 + 环境声。' : '道具 = 描述 + 几张图。'}</div>
      </>}

      {['image', 'video', 'audio'].includes(tab) && <div className="grid">
        {state.assets.filter(a => a.kind === tab && !a.inbox && match(a.name)).map(a =>
          <Tile key={a.id} asset={a} used={usedA.has(a.id)} onClick={() => onPick?.({asset: a.id})} onZoom={setZoom} menu />)}</div>}

      {tab === 'inbox' && <div className="inbox">
        <button className="small" onClick={() => dispatch({type: 'upload'})}>＋ 模拟上传 5 个文件</button>
        {!inbox.length && <p className="muted">没有待整理的文件。上传的、截帧没选档案的会出现在这里。</p>}
        {inbox.map(a => <InboxRow key={a.id} a={a} />)}
      </div>}
      {zoom && <div className="zoom" onClick={() => setZoom(null)}><img src={zoom.thumb} alt="" /><b>{zoom.name}</b><small>点击关闭</small></div>}
    </aside>
  );
}

function InboxRow({a}) {
  const {state, dispatch, db, trash} = useStore();
  const sug = a.suggest && db.profile(a.suggest.id);
  const [target, setTarget] = useState(sug ? `${sug.id}|${sug.def}` : '');
  return (
    <div className="inrow">
      <Tile asset={a} />
      <div className="inrow-body">
        <small className="clip">{a.name}</small>
        {sug ? <small className="sug">看起来是「{sug.name}」</small> : <small className="muted">没认出来，手动选</small>}
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="">选择档案…</option>
          {state.profiles.map(p => <optgroup key={p.id} label={`${TYPE_LABEL[p.type]} · ${p.name}`}>
            {p.variants.map(v => <option key={v.id} value={`${p.id}|${v.id}`}>{p.name} · {v.name}</option>)}</optgroup>)}
        </select>
        <div className="row tight">
          <button className="small primary" disabled={!target} onClick={() => { const [pid, vid] = target.split('|'); dispatch({type: 'fileImage', asset: a.id, pid, vid}); }}>归档</button>
          <button className="small ghost" onClick={() => dispatch({type: 'dismissInbox', asset: a.id})}>留在文件里</button>
          <button className="small ghost" title="移到回收站" onClick={() => trash({kind: 'asset', id: a.id}, a.name)}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- profile editor ---------- */

function VariantDrop({pid, vid, children, onFiles}) {
  const {setNodeRef, isOver, active} = useDroppable({id: `vdrop:${pid}:${vid}`});
  return <div ref={setNodeRef} {...nativeDrop(onFiles)} className={'vimages' + (isOver && String(active?.id).startsWith('asset:') ? ' drop-hot' : '')}>{children}</div>;
}

function VoiceSection({p}) {
  const {dispatch, db} = useStore();
  const [choose, setChoose] = useState(false);
  const voices = p.voices || [];
  const {setNodeRef, isOver, active} = useDroppable({id: 'voicedrop:' + p.id});
  const hot = isOver && db.asset(String(active?.id).slice(6))?.kind === 'audio';
  return (
    <div ref={setNodeRef} className={'voices' + (hot ? ' drop-hot' : '')} {...nativeDrop(files => dispatch({type: 'uploadFiles', files, target: {kind: 'voice', pid: p.id}}))}>
      <div className="row tight"><b>声音</b><small className="muted">说话样本：全能参考生成时截其中 3 秒，让人物的声音保持一致</small>
        <button className="small" onClick={() => setChoose(true)}>＋ 添加声音</button></div>
      <div className="drop-line">把声音从左边素材库「声音」或电脑桌面拖到这里</div>
      {!voices.length && <div className="slot-empty">还没有声音样本。没有声音时，模型会自己配声音。</div>}
      {voices.map(v => { const a = db.asset(v.asset); if (!a) return null; const max = Math.max(0, Math.floor((a.seconds || 3) - 3)); return (
        <div key={v.asset} className={'voice' + (p.voice === v.asset ? ' main' : '')}>
          <div className="row tight">
            <label className="check"><input type="radio" checked={p.voice === v.asset} onChange={() => dispatch({type: 'profile', id: p.id, patch: {voice: v.asset}})} />主声音</label>
            <span className="clip"><b>{a.name}</b> · {a.seconds} 秒{a.source === 'upload' ? ' · 刚上传' : ''}</span>
            <PlayButton asset={a} label="整段" />
            <button className="x" title="移除" onClick={() => dispatch({type: 'removeVoice', pid: p.id, asset: v.asset})}>×</button>
          </div>
          <div className="row tight">
            <span className="muted">生成用的 3 秒：</span>
            <input type="range" min={0} max={max} step={0.5} value={Math.min(v.start, max)} disabled={!max}
              onChange={e => dispatch({type: 'voice', pid: p.id, asset: v.asset, patch: {start: +e.target.value}})} />
            <span className="muted">第 {v.start}–{v.start + 3} 秒</span>
            <PlayButton asset={a} start={v.start} len={3} label="试听这 3 秒" />
          </div>
          <input className="note-in" placeholder="备注：比如“平时说话”“情绪激动时”" value={v.note || ''}
            onChange={e => dispatch({type: 'voice', pid: p.id, asset: v.asset, patch: {note: e.target.value}})} />
        </div>); })}
      {choose && <ChooseFiles kind="audio" title={`给${p.name}添加声音`} exclude={new Set(voices.map(v => v.asset))}
        onPick={id => { dispatch({type: 'addVoice', pid: p.id, asset: id}); setChoose(false); }}
        onFiles={files => dispatch({type: 'uploadFiles', files, target: {kind: 'voice', pid: p.id}})} onClose={() => setChoose(false)} />}
    </div>
  );
}

export function ProfileEditor() {
  const {state, dispatch, db, trash} = useStore();
  const p = state.openProfile && db.profile(state.openProfile);
  const [vid, setVid] = useState(null), [choose, setChoose] = useState(false);
  useEffect(() => { setVid(null); setChoose(false); }, [state.openProfile]);
  if (!p) return null;
  const v = variantOf(p, vid || p.def);
  const close = () => dispatch({type: 'openProfile', id: null});
  const audios = state.assets.filter(a => a.kind === 'audio');
  const usedIn = state.shots.filter(s => s.cast.some(c => c.id === p.id) || s.place?.id === p.id || s.props.includes(p.id));
  const upload = files => dispatch({type: 'uploadFiles', files, target: {kind: 'image', pid: p.id, vid: v.id}});
  return (
    <div className="profile-overlay" onClick={close}>
      <section className="profile" onClick={e => e.stopPropagation()}>
        <header className="ed-head">
          <div><small>{TYPE_LABEL[p.type]}档案</small><input className="ed-title" value={p.name} onChange={e => dispatch({type: 'profile', id: p.id, patch: {name: e.target.value}})} /></div>
          {(() => { const ids = [...new Set(usedIn.map(s => s.storyId))], here = state.page === 'story' && state.activeStory, others = ids.filter(x => x !== here);
            if (!others.length || (!here && ids.length < 2)) return null;
            const names = ids.map(x => db.story(x)?.title).filter(Boolean);
            return <div className="shared-note" title={'用到这个档案的故事：' + names.join('、')}>共用于 {ids.length} 个故事，改这里会一起改
              {here && ids.includes(here) && <button className="small" onClick={() => dispatch({type: 'forkProfile', pid: p.id, storyId: here, storyTitle: db.story(here)?.title || '本故事'})}>只给本故事复制一份</button>}</div>; })()}
          <button className="ghost small danger" title={(() => { const u = profileUsage(state, p.id); return u.text ? `正在用在 ${u.text}；删除后那里会先空着，恢复就回来` : '没有镜头在用'; })()}
            onClick={() => trash({kind: 'profile', id: p.id}, p.name)}><Trash2 size={13} />移到回收站</button>
          <button className="x big" onClick={close}>×</button>
        </header>
        <label className="field"><span>{p.type === 'character' ? '人物描述（长相、年龄、性格）' : p.type === 'location' ? '场景描述（布局、空间关系）' : '道具描述'} · 会自动拼进提示词</span>
          <textarea rows={2} value={p.desc} onChange={e => dispatch({type: 'profile', id: p.id, patch: {desc: e.target.value}})} /></label>

        {p.type !== 'prop' && <div className="vtabs">{p.variants.map(x => (
          <button key={x.id} className={x.id === v.id ? 'on' : ''} onClick={() => setVid(x.id)}>{x.name}{x.id === p.def && <em>默认</em>}<small>{x.images.length}</small></button>))}
          <button className="ghost" onClick={() => { const name = prompt(`新${VARIANT_LABEL[p.type]}的名字（如：红裙、长发、雨衣）`); if (name) dispatch({type: 'addVariant', pid: p.id, name}); }}>＋ {VARIANT_LABEL[p.type]}</button>
        </div>}

        <div className="variant">
          {p.type !== 'prop' && <div className="row tight variant-head">
            <input value={v.name} onChange={e => dispatch({type: 'variant', pid: p.id, vid: v.id, patch: {name: e.target.value}})} style={{maxWidth: 160}} />
            <input value={v.desc} placeholder={p.type === 'character' ? '这套造型的衣服、发型…' : '光线、天气、时间…'}
              onChange={e => dispatch({type: 'variant', pid: p.id, vid: v.id, patch: {desc: e.target.value}})} />
            {v.id !== p.def && <button className="small" onClick={() => dispatch({type: 'profile', id: p.id, patch: {def: v.id}})}>设为默认</button>}
            <button className="small ghost" disabled={v.id === p.def} title={v.id === p.def ? '默认的不能删，先把别的设为默认' : `删除「${v.name}」，用它的镜头改用默认`}
              onClick={() => { setVid(null); trash({kind: 'variant', id: v.id, pid: p.id}, `${p.name} · ${v.name}`); }}><Trash2 size={13} /></button>
          </div>}
          <div className="row tight"><b>照片</b><small className="muted">第一张是主图，生成时优先用</small>
            <button className="small" onClick={() => setChoose(true)}>＋ 添加照片</button>
            {p.type === 'character' && <button className="small" onClick={() => dispatch({type: 'aiImage', pid: p.id, vid: v.id})}>✨ AI 生成定妆照（模拟）</button>}</div>
          <VariantDrop pid={p.id} vid={v.id} onFiles={upload}>
            {v.images.map((id, i) => { const a = db.asset(id); return a && (
              <div key={id} className="vimg">
                <img src={a.thumb} alt="" style={{filter: a.hue ? `hue-rotate(${a.hue}deg)` : undefined}} />
                {i === 0 ? <em>主图 · 生成时优先用</em> : <button className="small" onClick={() => dispatch({type: 'coverImage', pid: p.id, vid: v.id, asset: id})}>设为主图</button>}
                {a.source === 'ai' && <span className="tile-badge ai">AI</span>}
                <button className="x" onClick={() => dispatch({type: 'unfileImage', pid: p.id, vid: v.id, asset: id})}>×</button>
                <small className="clip">{a.name}</small>
              </div>); })}
            <div className="vimg add" onClick={() => setChoose(true)}>＋ 添加照片<br /><small>点这里选择，或把图片从左边素材库 / 电脑桌面拖进来</small></div>
          </VariantDrop>
          {p.type === 'character' && !v.images.length && <div className="warn">这套造型还没有照片：生成时只能靠文字描述，人物容易不一致</div>}
          {p.type === 'character' && (p.voices || []).length > 1 && <label className="row tight"><span className="muted">这套造型用的声音：</span>
            <select value={v.voice || ''} onChange={e => dispatch({type: 'variant', pid: p.id, vid: v.id, patch: {voice: e.target.value || null}})}>
              <option value="">跟随主声音</option>{p.voices.map(x => <option key={x.asset} value={x.asset}>{db.asset(x.asset)?.name}</option>)}</select></label>}
        </div>

        {p.type === 'character' && <VoiceSection p={p} />}
        {p.type === 'location' && <label className="row tight"><b>环境声</b>
          <select value={p.ambient || ''} onChange={e => dispatch({type: 'profile', id: p.id, patch: {ambient: e.target.value || null}})}>
            <option value="">无</option>{audios.map(a => <option key={a.id} value={a.id}>{a.name}（{a.seconds} 秒）</option>)}</select>
          {p.ambient && <PlayButton asset={db.asset(p.ambient)} />}<small className="muted">全能参考时作为声音参考（优先级最低）</small></label>}

        <div className="usedin"><b>用在 {usedIn.length} 个镜头</b>{usedIn.map(s => <span key={s.id} className="chip">{s.title}</span>)}
          {usedIn.length > 0 && <small className="muted">改了档案后，这些镜头下次生成会自动用新内容（不会自动重新生成）</small>}</div>
        {choose && <ChooseFiles kind="image" title={`给「${p.name} · ${v.name}」添加照片`} exclude={new Set(v.images)}
          onPick={id => dispatch({type: 'fileImage', asset: id, pid: p.id, vid: v.id})} onFiles={upload} onClose={() => setChoose(false)} />}
      </section>
    </div>
  );
}

/* ---------- right-click picker ---------- */

const SLOT_TITLE = {start: '选开头画面', end: '选结尾画面', refs: '添加附加素材', cast: '这一镜里有谁 / 在哪 / 什么道具', smart: '给这个镜头加东西'};
const SLOT_ALLOW = {start: ['location', 'prop', 'image'], end: ['location', 'prop', 'image'], refs: ['image', 'video', 'audio'],
  cast: ['character', 'location', 'prop'], smart: ['character', 'location', 'prop', 'image', 'video', 'audio']};

export function AssetPicker({shotId, slot, x, y, onClose}) {
  const {state, dispatch, db} = useStore();
  const shot = state.shots.find(s => s.id === shotId);
  const [q, setQ] = useState(''), [tab, setTab] = useState('all'), [flash, setFlash] = useState('');
  const box = useRef(), input = useRef();
  useEffect(() => {
    input.current?.focus();
    const away = e => box.current && !box.current.contains(e.target) && onClose();
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [onClose]);
  if (!shot) return null;
  const allow = SLOT_ALLOW[slot];
  const tabs = ['all', ...allow];
  const label = k => ({all: '全部', ...TYPE_LABEL, image: '图片', video: '动作', audio: '声音'})[k];
  const ok = k => allow.includes(k) && (tab === 'all' || tab === k);
  const profiles = state.profiles.filter(p => ok(p.type) && (!q || (p.name + p.desc).includes(q)));
  const files = state.assets.filter(a => !a.inbox && ok(a.kind) && (!q || a.name.includes(q)));
  const results = [...profiles.map(p => ({profile: p})), ...files.map(a => ({asset: a}))];
  const multi = slot !== 'start' && slot !== 'end';
  const pick = item => {
    const s = state.shots.find(x => x.id === shotId);
    const {patch, msg} = planDrop(s, item, slot === 'cast' ? 'smart' : slot, db);
    dispatch(item.profile ? {type: 'drop', profile: item.profile.id, shot: shotId, slot: slot === 'cast' ? 'smart' : slot}
      : {type: 'drop', asset: item.asset.id, shot: shotId, slot: slot === 'cast' ? 'smart' : slot});
    if (!patch || multi) setFlash(msg); else onClose();
  };
  const usedP = new Set([...shot.cast.map(c => c.id), shot.place?.id, ...shot.props]);
  const usedA = new Set([...shot.refs, shot.start, shot.end]);
  const left = Math.max(8, Math.min(x, window.innerWidth - 420)), top = Math.max(8, Math.min(y, window.innerHeight - 500));
  return createPortal(
    <div ref={box} className="picker" style={{left, top}} role="dialog" aria-label={SLOT_TITLE[slot]}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
      <div className="picker-head"><b>{SLOT_TITLE[slot]}</b><small>「{shot.title}」</small><button className="x" onClick={onClose}>×</button></div>
      <input ref={input} className="lib-search" placeholder="搜索… 回车选第一个" value={q} onChange={e => setQ(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && results[0]) pick(results[0]); }} />
      <div className="lib-tabs">{tabs.map(k => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label(k)}</button>)}</div>
      {(slot === 'start' || slot === 'end') && <div className="picker-note">开头/结尾画面：用场景、道具档案的主图，或任意图片</div>}
      <div className="picker-grid">
        {profiles.map(p => { const c = coverOf(db, p, p.def); return (
          <button key={p.id} className={'tile prof ' + p.type + (usedP.has(p.id) ? ' used' : '')} onClick={() => pick({profile: p})} title={p.desc}>
            {c ? <img src={c.thumb} alt="" /> : <div className="tile-audio">{TYPE_LABEL[p.type]}</div>}
            <span className="tile-badge">{TYPE_LABEL[p.type]}</span>{usedP.has(p.id) && <span className="tile-used">✓</span>}
            <span className="tile-name">{p.name}</span></button>); })}
        {files.map(a => (
          <button key={a.id} className={'tile' + (usedA.has(a.id) ? ' used' : '')} onClick={() => pick({asset: a})} title={a.name}>
            {a.kind === 'audio' ? <div className="tile-audio">♪<small>{a.seconds}s</small></div> : <img src={a.thumb} alt="" />}
            {a.kind === 'video' && <span className="tile-badge">▶ {a.seconds}s</span>}{usedA.has(a.id) && <span className="tile-used">✓</span>}
            <span className="tile-name">{a.name}</span></button>))}
      </div>
      {!results.length && <p className="muted">没有匹配的内容</p>}
      <div className="picker-foot">{flash || (multi ? '可以连续点选 · Esc 关闭' : '点一下就放进去 · Esc 关闭')}</div>
    </div>, document.body);
}

/* ---------- shot card ---------- */

export function useShotSortable(id) {
  const s = useSortable({id: 'shot:' + id});
  return {...s, style: {transform: CSS.Transform.toString(s.transform), transition: s.transition, opacity: s.isDragging ? 0.4 : 1}};
}

export function ModeChip({info}) {
  return <span className={'mode ' + info.mode.toLowerCase()} title={info.machine}>{info.kind}</span>;
}
const Pill = ({status}) => <span className={'pill ' + status.tone}>{status.label}</span>;
function Progress({v}) {
  if (!v || (v.status !== 'generating' && v.status !== 'queued')) return null;
  return <div className="progress"><i style={{width: `${Math.round(v.progress * 100)}%`}} /></div>;
}
export function ShotThumb({shot}) {
  const v = chosenVersion(shot);
  return v ? <img className="sthumb" src={`/clips/${v.clip}-first.jpg`} alt="" /> : <div className="sthumb empty"><Clapperboard size={18} /><small>待生成</small></div>;
}

export function WhoChips({shot, small}) {
  const {db} = useStore();
  return (
    <div className={'who' + (small ? ' small' : '')}>
      {shot.cast.map(c => { const p = db.profile(c.id); return p && <span key={c.id} className="chip character">{p.name}<i>{variantOf(p, c.variant).name}</i></span>; })}
      {shot.place && db.profile(shot.place.id) && <span className="chip location">{db.profile(shot.place.id).name.replace('旧车站 · ', '')}</span>}
      {shot.props.map(id => db.profile(id) && <span key={id} className="chip prop">{db.profile(id).name}</span>)}
    </div>
  );
}

const dragItem = (active, db) => {
  const id = String(active?.id || '');
  if (id.startsWith('asset:')) return {asset: db.asset(id.slice(6))};
  if (id.startsWith('profile:')) return {profile: db.profile(id.slice(8))};
  return null;
};

export function ShotCard({shot, index, selected, onOpen, picked, picking, onPick}) {
  const {state, db} = useStore();
  const [picker, setPicker] = useState(null);
  const {setNodeRef, attributes, listeners, style, isOver, active} = useShotSortable(shot.id);
  const info = expand(shot, db);
  const status = shotStatus(shot, queuePositions(state)[shot.id]);
  const latest = shot.versions[shot.versions.length - 1];
  const item = isOver ? dragItem(active, db) : null;
  const plan = item && (item.asset || item.profile) ? planDrop(shot, item, 'smart', db) : null;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={'card' + (selected ? ' selected' : '') + (plan ? ' drop-hot' : '') + (picked ? ' picked' : '') + (picking ? ' picking' : '')}
      onClick={e => (onPick && (picking || e.shiftKey || e.ctrlKey || e.metaKey) ? onPick(shot.id, e) : onOpen(shot.id))} onContextMenu={e => { e.preventDefault(); setPicker({slot: 'smart', x: e.clientX, y: e.clientY}); }}>
      <div className="card-media">
        <ShotThumb shot={shot} />
        <span className="card-no">{String(index + 1).padStart(2, '0')}</span>
        {onPick && <span className="card-pick" title="选中（按住 Ctrl/Shift 点卡片也可以）" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onPick(shot.id, e); }}>{picked ? '✓' : ''}</span>}
        <span className="card-dur">{fmt(info.sec)}</span>
        <Progress v={latest} />
      </div>
      <div className="card-body">
        <div className="card-title">{shot.by && <ByAgent by={shot.by} short />}{shot.title}</div>
        <div className="card-meta"><ModeChip info={info} /><span className="q">{MODELS[shot.quality].label}</span>{shot.versions.length > 1 && <span className="q" title="版本数">{shot.versions.length} 版</span>}
          {info.warnings.length > 0 && <span className="warnbadge" title={info.warnings.join('\n')}>!</span>}</div>
        <WhoChips shot={shot} small />
        <Pill status={status} />
      </div>
      {plan && <div className={'drop-hint' + (plan.warn ? ' warn' : '')}>{plan.hint || plan.msg}</div>}
      {picker && <AssetPicker shotId={shot.id} {...picker} onClose={() => setPicker(null)} />}
    </div>
  );
}

export function AddCard({onAdd, label = '＋ 新镜头'}) {
  return <button className="card add" onClick={onAdd}>{label}</button>;
}

/* ---------- shot editor ---------- */

function Slot({id, label, hint, children, onClear, onPick, className = ''}) {
  const {setNodeRef, isOver, active} = useDroppable({id});
  const hot = isOver && /^(asset|profile):/.test(String(active?.id));
  const open = e => { e.preventDefault(); onPick?.(e); };
  return (
    <div ref={setNodeRef} className={'slot ' + className + (hot ? ' drop-hot' : '')} onContextMenu={open} title="右键：搜索">
      <div className="slot-label">{label}<span>{onPick && <button className="x" title="搜索" onClick={open}>⌕</button>}
        {onClear && <button className="x" onClick={onClear}>×</button>}</span></div>
      {children || <div className="slot-empty clickable" onClick={open}>{hint}<br /><small>拖进来，或点这里 / 右键搜索</small></div>}
    </div>
  );
}

function SaveFrame({shot, version, onDone}) {
  const {state, dispatch, db} = useStore();
  const sugg = shotProfiles(shot).map(x => ({...x, p: db.profile(x.id)})).filter(x => x.p && x.p.type !== 'prop' || x.p);
  const [t, setT] = useState(4);
  const [target, setTarget] = useState(sugg[0] ? `${sugg[0].id}|${sugg[0].variant || sugg[0].p.def}` : '');
  const save = () => {
    const [pid, vid] = target ? target.split('|') : [null, null];
    dispatch({type: 'saveFrame', clip: version.clip, t, label: `${shot.title} v${version.n} 第 ${t} 秒`, pid, vid});
    onDone(pid ? `已存进「${db.profile(pid).name} · ${variantOf(db.profile(pid), vid).name}」` : '已放进待整理');
  };
  return (
    <div className="saveframe">
      <b>截这一帧存为参考</b>
      <div className="row tight">{[2, 4, 6].map(s => (
        <button key={s} className={'frame-pick' + (t === s ? ' on' : '')} onClick={() => setT(s)}>
          <img src={`/clips/${version.clip}-t${s}.jpg`} alt="" /><small>第 {s} 秒</small></button>))}</div>
      <select value={target} onChange={e => setTarget(e.target.value)}>
        {sugg.map(x => <option key={x.id + (x.variant || '')} value={`${x.id}|${x.variant || x.p.def}`}>建议：{x.p.name} · {variantOf(x.p, x.variant).name}（这一镜里有）</option>)}
        <option value="">放进待整理，稍后再归档</option>
        {state.profiles.map(p => <optgroup key={p.id} label={`${TYPE_LABEL[p.type]} · ${p.name}`}>
          {p.variants.map(v => <option key={v.id} value={`${p.id}|${v.id}`}>{p.name} · {v.name}</option>)}</optgroup>)}
      </select>
      <button className="primary small" onClick={save}>存</button>
    </div>
  );
}

// Pick a 中间画面 for 首尾帧: any image, video clip or sound from the library, or a new file from the computer.
function GuidePicker({exclude, onPick, onClose}) {
  const {state, dispatch} = useStore();
  const [q, setQ] = useState(''), file = useRef();
  const list = state.assets.filter(a => !a.inbox && !exclude.has(a.id) && (!q || a.name.includes(q)));
  const add = files => files.forEach((f, i) => { const a = {...f, id: 'g-' + Math.random().toString(36).slice(2, 8)}; dispatch({type: 'addAsset', asset: a}); if (i === 0) onPick(a); });
  return createPortal(
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose" onClick={e => e.stopPropagation()} {...nativeDrop(add)}>
        <div className="picker-head"><b>加中间画面</b><button className="x" onClick={onClose}>×</button></div>
        <div className="row tight"><input className="lib-search" autoFocus placeholder="搜索素材…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="primary" onClick={() => file.current.click()}>从电脑选择…</button>
          <input ref={file} type="file" hidden accept="image/*,video/*,audio/*" onChange={async e => add(await readFiles(e.target.files))} /></div>
        <div className="picker-grid">{list.map(a => (
          <button key={a.id} className="tile" onClick={() => onPick(a)} title={a.name}>
            {a.kind === 'audio' ? <div className="tile-audio">♪<small>{a.seconds}s</small></div> : <img src={a.thumb} alt="" />}
            {a.kind === 'video' && <span className="tile-badge">▶ {a.seconds}s</span>}<span className="tile-name">{a.name}</span></button>))}</div>
      </div>
    </div>, document.body);
}

// Small marker for an AI-chosen (solid) or AI-suggested (dashed) look / voice; hidden once the user chose by hand.
function AiTag({s, manual, label}) {
  if (!s || manual) return null;
  return <span className={'ai-tag' + (s.applied ? '' : ' sug')} title={`把握 ${Math.round(s.conf * 100)}%`}>{s.applied ? 'AI' : `建议：${label(s.id)}`}</span>;
}

export function ShotEditor({shotId, onClose, inline, wide, onWide}) {
  const {state, dispatch, db, trash} = useStore();
  const shot = state.shots.find(s => s.id === shotId);
  const [preview, setPreview] = useState(null), [picker, setPicker] = useState(null), [saving, setSaving] = useState(false), [msg, setMsg] = useState('');
  const [count, setCount] = useState(1);
  const [adv, setAdv] = useState(false), [editing, setEditing] = useState(null), [writing, setWriting] = useState(false), [guidePick, setGuidePick] = useState(false), [aiNote, setAiNote] = useState('');
  useEffect(() => { setPreview(null); setPicker(null); setSaving(false); setMsg(''); }, [shotId]);
  // AI matching reruns ~0.7s after the script, cast, looks or mode change (hooks stay above the early return).
  const [matchInfo, setMatchInfo] = useState(null), runMatchRef = useRef();
  const matchKey = shot ? JSON.stringify([shot.script, shot.prompt, shot.dialogue, shot.mode, shot.cast.map(c => [c.id, c.variant]), shot.place, shot.props]) : '';
  useEffect(() => { if (!matchKey) return; const t = setTimeout(() => runMatchRef.current?.(), 700); return () => clearTimeout(t); }, [matchKey]);
  if (!shot) return null;
  const list = db.chapterShots(shot.storyId, shot.chapterId), index = list.indexOf(shot);
  const info = expand(shot, db);
  const upd = patch => dispatch({type: 'update', id: shot.id, patch});
  const openPicker = slot => e => setPicker({slot, x: e.clientX, y: e.clientY});
  const sf = startFrame(shot, db), endA = shot.end && db.asset(shot.end);
  const viewing = shot.versions.find(v => v.id === preview) || chosenVersion(shot);
  const busy = shot.versions.some(v => v.status === 'queued' || v.status === 'generating');
  const chosen = chosenVersion(shot), m = MODELS[shot.quality];
  const c = {aspect_ratio: db.settings(shot).aspect, ...shotControls(shot, db), duration: shot.duration};
  const setC = (k, v) => { const n = {...(shot.controls || {})}; if (v === undefined) delete n[k]; else n[k] = v; upd({controls: n, ...(k === 'duration' ? {duration: v} : {})}); if (k === 'resolution' && v === 'custom') setAdv(true); };
  const guides = shot.guides || [], refAssets = shot.refs.map(id => db.asset(id)).filter(Boolean), opts = shot.refOpts || {};
  const setOpt = (id, patch) => upd({refOpts: {...opts, [id]: {...opts[id], ...patch}}});
  // 全能参考: which of a profile's photos / which voice go to the model. Click a photo to add or remove it.
  const picks = shot.picks || {};
  const setPick = (pid, patch) => upd({picks: {...picks, [pid]: {...picks[pid], ...patch}}});
  const togglePhoto = (pid, id, fallback) => {
    const kept = (picks[pid]?.images || []).filter(x => fallback.includes(x)), cur = kept.length ? kept : fallback.slice(0, 1);
    setPick(pid, {images: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id], manual: true});
  };
  const ai = shot.ai || {};
  const PhotoPick = ({pid, list}) => {
    const kept = (picks[pid]?.images || []).filter(x => list.includes(x)), cur = kept.length ? kept : list.slice(0, 1), sug = ai[pid]?.photo;
    return info.mode === 'REF' && list.length > 0 && <div className="photo-pick" title="点照片选择发给模型的那几张；数字是顺序">
      {list.map(id => db.asset(id)).filter(Boolean).map(a => { const n = cur.indexOf(a.id), isAi = sug?.id === a.id && !(picks[pid]?.manual && kept.length); return (
        <button key={a.id} className={'pp' + (n >= 0 ? ' on' : '') + (isAi && !sug.applied ? ' sug' : '')} title={isAi ? `AI ${sug.applied ? '选的' : '建议'} · 把握 ${Math.round(sug.conf * 100)}%` : a.name}
          onClick={() => togglePhoto(pid, a.id, list)}><img src={a.thumb} alt="" />{n >= 0 && <b>{n + 1}</b>}{isAi && <i>{sug.applied ? 'AI' : '建议'}</i>}</button>); })}</div>;
  };
  // Jev (TypeSafe) answers typed choices with calibrated confidence: sure → apply, unsure → only suggest.
  const SURE = 0.6;
  const runMatch = (force = false) => {
    const qs = {}, castP = shot.cast.map(c => ({c, p: db.profile(c.id)})).filter(x => x.p);
    const look = (p, cur) => { if (p.variants.length > 1 && (force || !picks[p.id]?.manualVariant)) qs[p.id + '__look'] = {type: 'choice', instructions: `Which look of ${p.name} fits this shot`, criteria: Object.fromEntries(p.variants.map(v => [v.id, `${v.name}：${v.desc || ''}`]))}; };
    const photo = (pid, name, list) => { if (info.mode === 'REF' && list.length > 1 && (force || !(picks[pid]?.manual && (picks[pid].images || []).some(x => list.includes(x))))) qs[pid + '__photo'] = {type: 'choice', instructions: `Which reference photo of ${name} best matches the pose and framing of this shot`, criteria: Object.fromEntries(list.map(id => [id, db.asset(id)?.name || id]))}; };
    castP.forEach(({c, p}) => {
      look(p); photo(p.id, p.name, variantOf(p, c.variant).images);
      if (info.mode === 'REF' && (p.voices || []).length > 1 && (force || !picks[p.id]?.manualVoice))
        qs[p.id + '__voice'] = {type: 'choice', instructions: `Which voice sample of ${p.name} fits the emotion of this shot`, criteria: Object.fromEntries(p.voices.map(v => [v.asset, v.note || db.asset(v.asset)?.name || v.asset]))};
    });
    const pl = shot.place && db.profile(shot.place.id);
    if (pl) { look(pl); photo(pl.id, pl.name, variantOf(pl, shot.place.variant).images); }
    shot.props.map(id => db.profile(id)).filter(Boolean).forEach(p => photo(p.id, p.name, p.variants.flatMap(v => v.images)));
    if (!Object.keys(qs).length || !(shot.script || shot.prompt)) { setMatchInfo(null); return; }
    const t0 = performance.now();
    setMatchInfo({busy: true});
    fetch('/api/match', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
      state: {剧本: shot.script, 动作: shot.prompt, 台词: shot.dialogue || '', 人物: castP.map(x => x.p.name).join('、'), 场景: pl?.name || ''}, questions: qs})})
      .then(r => r.json()).then(res => {
        if (res.error) throw new Error(res.error);
        const next = {...ai}, nextPicks = {...picks};
        let applied = 0, unsure = 0;
        for (const [qid, ans] of Object.entries(res.answers || {})) {
          const [pid, what] = qid.split('__'), sure = ans.confidence >= SURE;
          sure ? applied++ : unsure++;
          next[pid] = {...next[pid], [what]: {id: ans.choice, conf: ans.confidence, applied: sure}};
          if (!sure) continue;
          if (what === 'photo') nextPicks[pid] = {...nextPicks[pid], images: [ans.choice], manual: false};
          if (what === 'voice') nextPicks[pid] = {...nextPicks[pid], voice: ans.choice, manualVoice: false};
          if (what === 'look') {
            if (shot.cast.some(c => c.id === pid && (c.variant || '') !== ans.choice)) dispatch({type: 'castVariant', shot: shot.id, id: pid, variant: ans.choice});
            if (shot.place?.id === pid && shot.place.variant !== ans.choice) dispatch({type: 'placeVariant', shot: shot.id, variant: ans.choice});
          }
        }
        upd({ai: next, picks: nextPicks});
        setMatchInfo({model: res.model, ms: Math.round(performance.now() - t0), applied, unsure});
      }).catch(err => setMatchInfo({error: String(err.message || err).slice(0, 60)}));
  };
  runMatchRef.current = runMatch;
  // REF here may be fed by 档案 photos alone, so an empty 附加素材 list is fine.
  const issues = info.mode === 'REF' ? checkInputs('REF', refAssets, {}, opts, shot.duration).filter(x => !x.startsWith('全能参考至少'))
    : checkInputs('FL', guides.map(g => db.asset(g.asset)).filter(Boolean), Object.fromEntries(guides.map(g => [g.asset, {role: 'guide', t: g.t}])), opts, shot.duration);
  // Same Gemini assistant as 快速创作, asked for the action line only (cast and place come from 档案).
  const writeAction = () => {
    setWriting(true); setAiNote('');
    fetch('/api/assistant', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
      text: `剧本：${shot.script || '（无）'}。只写这一镜的动作描述，30 字以内，不要写人物外貌、服装和场景样子。`,
      mode: info.mode, previous: shot.prompt ? {prompt: shot.prompt, mode: info.mode} : null,
      attachments: [...shot.cast.map(x => db.profile(x.id)).filter(Boolean).map(p => ({name: p.name, kind: 'image', role: '人物'})),
        ...(shot.place && db.profile(shot.place.id) ? [{name: db.profile(shot.place.id).name, kind: 'image', role: '场景'}] : [])]})})
      .then(r => r.json()).then(res => { if (res.error) throw new Error(res.error); upd({prompt: res.prompt}); setAiNote(`助手：${res.reply}`); })
      .catch(err => setAiNote('助手没连上：' + String(err.message || err).slice(0, 60))).finally(() => setWriting(false));
  };

  return (
    <section className={'editor' + (inline ? ' inline' : '') + (wide ? ' wide' : '')}>
      <header className="ed-head">
        <div><small>镜头 {String(index + 1).padStart(2, '0')}</small><input className="ed-title" value={shot.title} onChange={e => upd({title: e.target.value})} /></div>
        {onClose && <button className="x big" onClick={onClose}>×</button>}
      </header>

      <div className="ed-media"><Takes shot={shot} wide={wide} onWide={onWide} viewing={viewing} setPreview={setPreview}
        saveFrame={viewing?.status === 'done' && (saving ? <SaveFrame shot={shot} version={viewing} onDone={t => { setSaving(false); setMsg(t); }} />
        : <div className="row tight"><button className="small" onClick={() => { setSaving(true); setMsg(''); }}>📌 截一帧存为参考</button>{msg && <small className="okmsg">{msg}</small>}</div>)} /></div>
      <div className="ed-form">
      <label className="field"><span>剧本（这一镜发生什么）</span><textarea rows={2} value={shot.script} onChange={e => upd({script: e.target.value})} /></label>
      <label className="field"><span>台词 · 导出字幕时按时间线自动生成</span>
        <input value={shot.dialogue || ''} onChange={e => upd({dialogue: e.target.value})} placeholder="这一镜里谁说了什么，没有可留空" /></label>
      <div className="field"><span className="row tight">动作描述 · 只写动作，人物和场景的样子来自档案<span className="spacer" />
        <button className="small ghost" disabled={writing || !(shot.script || shot.prompt)} title="按剧本让助手写动作描述" onClick={writeAction}>
          <Sparkles size={13} />{writing ? '写着呢…' : '助手帮写'}</button></span>
        <textarea rows={2} value={shot.prompt} onChange={e => upd({prompt: e.target.value})} placeholder="例如：她拆开信，表情从疑惑变成震惊" />
        {aiNote && <small className="muted">{aiNote}</small>}</div>

      <Slot id={'slot:cast:' + shot.id} className="castslot" label="这一镜里（人物 / 场景 / 道具）· 两种模式都用" hint="拖入人物、场景或道具档案" onPick={openPicker('cast')}>
        {(shot.cast.length || shot.place || shot.props.length) ? <div className="castlist">
          {shot.cast.map(c => { const p = db.profile(c.id); if (!p) return null; const a = db.asset(variantOf(p, c.variant).images[0]); return (
            <div key={c.id} className="castitem character"><AssetThumb asset={a} size={34} /><div><b className="link" title="打开档案" onClick={() => dispatch({type: 'openProfile', id: p.id})}>{p.name}</b>
              <select value={variantOf(p, c.variant).id} onChange={e => { dispatch({type: 'castVariant', shot: shot.id, id: c.id, variant: e.target.value}); setPick(p.id, {manualVariant: true}); }}>
                {p.variants.map(v => <option key={v.id} value={v.id}>{v.name}{v.images.length ? '' : '（无照片）'}</option>)}</select>
                <AiTag s={ai[p.id]?.look} manual={picks[p.id]?.manualVariant} label={id => p.variants.find(v => v.id === id)?.name} />
                {info.mode === 'REF' && <AiTag s={ai[p.id]?.voice} manual={picks[p.id]?.manualVoice} label={id => '声音 ' + (p.voices.find(v => v.asset === id)?.note || '')} />}
                <PhotoPick pid={p.id} list={variantOf(p, c.variant).images} />
                {info.mode === 'REF' && (p.voices || []).length > 0 && <select className="voice-pick" value={picks[p.id]?.voice || ''} onChange={e => setPick(p.id, {voice: e.target.value || undefined, manualVoice: true})} title={ai[p.id]?.voice ? `AI ${ai[p.id].voice.applied ? '选的' : '建议'}：${p.voices.find(v => v.asset === ai[p.id].voice.id)?.note || ''} · 把握 ${Math.round(ai[p.id].voice.conf * 100)}%` : '发给模型的声音'}>
                  <option value="">声音：默认</option>{p.voices.map(vo => <option key={vo.asset} value={vo.asset}>声音：{db.asset(vo.asset)?.name || vo.asset}{vo.note ? ` · ${vo.note}` : ''}</option>)}<option value="none">不用声音</option></select>}</div>
              <button className="x" onClick={() => dispatch({type: 'uncast', shot: shot.id, id: c.id})}>×</button></div>); })}
          {shot.place && (() => { const p = db.profile(shot.place.id); if (!p) return null; return (
            <div className="castitem location"><AssetThumb asset={coverOf(db, p, shot.place.variant)} size={34} /><div><b className="link" title="打开档案" onClick={() => dispatch({type: 'openProfile', id: p.id})}>{p.name}</b>
              <select value={variantOf(p, shot.place.variant).id} onChange={e => { dispatch({type: 'placeVariant', shot: shot.id, variant: e.target.value}); setPick(p.id, {manualVariant: true}); }}>
                {p.variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                <AiTag s={ai[p.id]?.look} manual={picks[p.id]?.manualVariant} label={id => p.variants.find(v => v.id === id)?.name} />
                <PhotoPick pid={p.id} list={variantOf(p, shot.place.variant).images} />
                {info.mode === 'REF' && p.ambient && <label className="check small"><input type="checkbox" checked={picks[p.id]?.ambient !== false} onChange={e => setPick(p.id, {ambient: e.target.checked})} />带环境声</label>}</div>
              <button className="x" onClick={() => dispatch({type: 'unplace', shot: shot.id})}>×</button></div>); })()}
          {shot.props.map(id => { const p = db.profile(id); return p && (
            <div key={id} className="castitem prop"><AssetThumb asset={coverOf(db, p)} size={34} /><div><b className="link" title="打开档案" onClick={() => dispatch({type: 'openProfile', id: p.id})}>{p.name}</b><small>道具</small>
              <PhotoPick pid={p.id} list={p.variants.flatMap(v => v.images)} /></div>
              <button className="x" onClick={() => dispatch({type: 'unprop', shot: shot.id, id})}>×</button></div>); })}
        </div> : null}
      </Slot>

      {matchInfo && <div className="match-line">
        {matchInfo.busy ? <span className="muted">AI 正在匹配素材…</span>
          : matchInfo.error ? <span className="muted" title={matchInfo.error}>AI 匹配暂时不可用，可以手动选造型和照片</span>
          : <span className="muted"><b className="ai-badge">AI</b> 按剧本自动选了 {matchInfo.applied} 项{matchInfo.unsure ? `，${matchInfo.unsure} 项拿不准只标了「建议」` : ''} · {matchInfo.model} · {matchInfo.ms} 毫秒 · 你手动改过的不会被覆盖</span>}
        {!matchInfo.busy && <button className="small ghost" onClick={() => runMatch(true)}>重新匹配全部</button>}</div>}
      <div className="modetabs" role="tablist" aria-label="生成模式（二选一）">
        {['FL', 'REF'].map(k => (
          <button key={k} role="tab" aria-selected={info.mode === k} className={'mt ' + k.toLowerCase() + (info.mode === k ? ' on' : '')} onClick={() => upd({mode: k})}>
            <b>{MODE_LABEL[k]}</b><small>{k === 'FL' ? '人物场景只用文字 · 可设开头 / 结尾画面' : '人物场景用照片和声音 · 可加动作视频'}</small></button>))}
      </div>
      <div className={'modepanel ' + info.mode.toLowerCase()}>
        {info.mode === 'FL' ? <>
          <div className="slots">
            <Slot id={'slot:start:' + shot.id} label="开头画面" hint="可留空" onPick={openPicker('start')}
              onClear={shot.start || shot.continuePrev ? () => upd({start: null, continuePrev: false}) : null}>
              {sf && (sf.src ? <figure><img src={sf.src} alt="" /><figcaption>{sf.label}</figcaption></figure> : <div className="slot-empty">{sf.label}</div>)}
            </Slot>
            <Slot id={'slot:end:' + shot.id} label="结尾画面" hint="可留空" onPick={openPicker('end')} onClear={shot.end ? () => upd({end: null}) : null}>
              {endA && <figure><img src={endA.thumb} alt="" /><figcaption>{endA.name}</figcaption></figure>}
            </Slot>
          </div>
          {index > 0 && <label className="check"><input type="checkbox" checked={shot.continuePrev}
            onChange={e => upd({continuePrev: e.target.checked, start: e.target.checked ? null : shot.start})} />
            接上一镜：用「{list[index - 1].title}」选定版本的最后一帧作为开头</label>}
          <div className="field"><span>中间画面 · 可选，指定第几秒出现（最多 8 个，图片、视频片段或声音）</span>
            <div className="refs">{guides.map(g => db.asset(g.asset)).filter(Boolean).map(a => <Chip key={a.id} a={a} mode="FL" dur={shot.duration}
              role={{role: 'guide', t: guides.find(g => g.asset === a.id).t}} opt={opts[a.id] || {}} editing={editing} setEditing={setEditing}
              setRole={() => {}} setT={t => upd({guides: guides.map(g => (g.asset === a.id ? {...g, t} : g))})} setOpt={p => setOpt(a.id, p)}
              onRemove={() => upd({guides: guides.filter(g => g.asset !== a.id)})} />)}
              {guides.length < 8 && <button className="small ghost" onClick={() => setGuidePick(true)}><Plus size={13} />加中间画面</button>}</div></div>
        </> : <>
          <Slot id={'slot:refs:' + shot.id} label="附加素材（动作视频、额外的图或声音）" hint="可留空 · 人物和场景已经在上面了" onPick={openPicker('refs')}>
            {refAssets.length > 0 && <div className="refs">{refAssets.map(a => <Chip key={a.id} a={a} mode="REF" dur={shot.duration} opt={opts[a.id] || {}}
              editing={editing} setEditing={setEditing} setOpt={p => setOpt(a.id, p)} onRemove={() => dispatch({type: 'unref', shot: shot.id, asset: a.id})} />)}</div>}
          </Slot>
          <div className="limits muted">模型最多 9 张图、3 段视频、3 段声音；线上目前验收过 1 图 + 1 段 ≤3 秒视频 + 1 段 ≤3 秒声音 · 480P</div>
        </>}
      </div>

      <div className="sent">
        <div className="sent-head"><b>实际发给模型</b><ModeChip info={info} /><span className="muted">{info.machine} · {info.res} · {info.sec} 秒</span></div>
        <div className="sent-prompt">{info.parts.map((x, i) => <div key={i}><em>{x.label}</em>{x.text}</div>)}</div>
        {info.items.length > 0 && <div className="sent-items">{info.items.map((x, i) => (
          <div key={i} className={'sent-item' + (x.sent ? '' : ' off') + (info.mode === 'REF' && x.a.id ? ' click' : '')} title={info.mode === 'REF' ? (x.skipped ? '点一下恢复发送' : '点一下设为不发送') : x.reason}
            onClick={() => info.mode === 'REF' && x.a.id && upd({skip: x.skipped ? (shot.skip || []).filter(id => id !== x.a.id) : [...(shot.skip || []), x.a.id]})}>
            <AssetThumb asset={x.a.thumb || x.a.kind === 'audio' ? x.a : null} size={40} />
            <span><b>{x.kind}</b><small>{x.why}</small>{!x.sent && <small className="warn">未发送：{x.reason}</small>}</span></div>))}</div>}
        {info.warnings.map(w => <div key={w} className="warn">⚠ {w}</div>)}
        {info.notes.map(w => <div key={w} className="note">· {w}</div>)}
      </div>

      {issues.length > 0 && <div className="problems">⚠ {issues.join('；')}</div>}
      <div className="row tight">
        <div className="seg">{['draft', 'final'].map(q => (
          <button key={q} className={shot.quality === q ? 'on' : ''} onClick={() => upd({quality: q})}>{MODELS[q].label}<small>{MODELS[q].model} · {MODELS[q].gpu}</small></button>))}</div>
        <SpecPicker quality={shot.quality} c={c} onChange={setC} />
        <button className={'ghost small adv-btn' + (changedCount(shot.controls || {}) ? ' on' : '')} onClick={() => setAdv(!adv)}><SlidersHorizontal size={13} />{adv ? '收起高级' : '高级'}{changedCount(shot.controls || {}) ? ` · 已改 ${changedCount(shot.controls || {})}` : ''}</button>
      </div>
      {adv && <AdvancedInline value={shot.controls || {}} base={{...(state.genDefaults || {}), ...(db.settings(shot).controls || {})}} onChange={x => upd({controls: x})} onClose={() => setAdv(false)} actions={[
        {label: '设为本故事默认', done: '本故事没单独改过的镜头都跟着用这套', hint: '镜头自己改过的参数保留，不会被覆盖', run: v => dispatch({type: 'storyControls', storyId: shot.storyId, value: v})},
        {label: '设为全局默认', done: '以后新的生成都默认用这套（设置 → 生成默认值）', hint: '快速创作和所有故事的默认值', run: v => dispatch({type: 'genDefaults', value: {...(state.genDefaults || {}), ...v}})}]} />}
      {shot.versions.length > 0 && <label className="check"><input type="checkbox" checked={shot.seedLock} onChange={e => upd({seedLock: e.target.checked})} />
        固定随机种子：只改提示词或素材，其余尽量和当前版本一致</label>}
      <div className="ed-actions">
        <button className="primary" disabled={issues.length > 0} title={issues[0] || ''} onClick={() => dispatch({type: 'generate', ids: [shot.id], count})}>
          {shot.versions.length ? '再生成' : '生成'}{count > 1 ? ` ${count} 条` : ''} · {m.label}</button>
        <small className="muted est">{estimate([{quality: shot.quality, duration: shot.duration, resolution: c.resolution, count}]).text}</small>
        <select className="count-pick" value={count} onChange={e => setCount(+e.target.value)} title="一次出几条，每条换一个随机种子，方便挑">
          {[1, 2, 3, 4].map(n => <option key={n} value={n}>一次 {n} 条</option>)}</select>
        {chosen && chosen.quality === 'draft' && <button onClick={() => dispatch({type: 'generate', ids: [shot.id], quality: 'final'})}>用精修重做选定版本</button>}
        <button className="ghost danger" disabled={shot.versions.some(v => v.status === 'queued' || v.status === 'generating')} title="移到回收站，5 天内可恢复"
          onClick={() => { trash({kind: 'shot', id: shot.id}, shot.title); onClose?.(); }}>删除镜头</button>
      </div>
      </div>
      {picker && <AssetPicker shotId={shot.id} {...picker} onClose={() => setPicker(null)} />}
      {guidePick && <GuidePicker exclude={new Set(guides.map(g => g.asset))} onClose={() => setGuidePick(false)}
        onPick={a => { upd({guides: [...guides, {asset: a.id, t: a.kind === 'image' ? Math.round(shot.duration / 2 * 2) / 2 : 0}]}); setGuidePick(false); }} />}
    </section>
  );
}

/* ---------- player + timeline ---------- */

export function usePlayer(shots) {
  const segs = useMemo(() => segments(shots), [shots]);
  const total = segs.reduce((n, s) => n + s.dur, 0);
  const [t, setT] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now(), raf;
    const step = now => {
      const dt = (now - last) / 1000; last = now;
      setT(x => { const nx = x + dt; if (nx >= total) { setPlaying(false); return 0; } return nx; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);
  const idx = Math.max(0, segs.findIndex(s => t >= s.start && t < s.start + s.dur));
  return {segs, total, t, setT, playing, setPlaying, seg: segs[idx], idx};
}

export function Screen({player, big, style}) {
  const {seg, t, playing} = player;
  const ref = useRef();
  const local = seg ? t - seg.start : 0;
  useEffect(() => {
    const v = ref.current;
    if (!v || !seg?.clip) return;
    if (Math.abs(v.currentTime - (local % 8)) > 0.4) v.currentTime = local % 8;
    if (playing) v.play().catch(() => {}); else v.pause();
  }, [seg?.clip, seg?.shot.id, playing]); // eslint-disable-line
  if (!seg) return <div className={'screen' + (big ? ' big' : '')} style={style}><div className="screen-empty">还没有镜头</div></div>;
  return (
    <div className={'screen' + (big ? ' big' : '')} style={style}>
      {seg.clip ? <video ref={ref} key={seg.shot.id + seg.clip} src={`/clips/${seg.clip}.mp4`} muted loop playsInline />
        : <div className="screen-empty"><b>{seg.shot.title}</b><span>还没有生成 · 用文字占位</span></div>}
      <div className="screen-cap">{seg.shot.title}<small>{seg.shot.script}</small></div>
    </div>
  );
}

export function Transport({player}) {
  const {playing, setPlaying, t, total, setT} = player;
  return (
    <div className="transport">
      <button className="primary round" onClick={() => setPlaying(!playing)}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
      <button className="ghost round" onClick={() => { setPlaying(false); setT(0); }}><SkipBack size={16} /></button>
      <span className="time">{fmt(t)} / {fmt(total)}</span>
    </div>
  );
}

function Segment({seg, selected, onPick, sortable}) {
  const {state} = useStore();
  const s = sortable ? useShotSortable(seg.shot.id) : null; // eslint-disable-line react-hooks/rules-of-hooks
  const status = shotStatus(seg.shot, queuePositions(state)[seg.shot.id]);
  const hot = s?.isOver && /^(asset|profile):/.test(String(s.active?.id));
  return (
    <div ref={s?.setNodeRef} {...(s ? {...s.attributes, ...s.listeners} : {})} style={{...(s?.style || {}), flexGrow: seg.dur, flexBasis: 0}}
      className={'tseg' + (selected ? ' selected' : '') + (hot ? ' drop-hot' : '')} onClick={() => onPick(seg)} title={status.label}>
      {seg.clip ? <img src={`/clips/${seg.clip}-first.jpg`} alt="" /> : <div className="tseg-empty" />}
      <span className="tseg-title">{seg.shot.title}</span>
      <span className={'tseg-dot ' + status.tone} />
    </div>
  );
}

export function Timeline({player, selectedId, onPick, sortable, tall}) {
  const {segs, total, t, setT} = player;
  const pick = seg => { setT(seg.start); onPick?.(seg.shot.id); };
  return (
    <div className={'timeline' + (tall ? ' tall' : '')}>
      <div className="track video">
        {segs.map(seg => sortable ? <Segment key={seg.shot.id} seg={seg} selected={seg.shot.id === selectedId} onPick={pick} sortable />
          : <PlainSegment key={seg.shot.id} seg={seg} selected={seg.shot.id === selectedId} onPick={pick} />)}
        <div className="playhead" style={{left: `${total ? (t / total) * 100 : 0}%`}} />
      </div>
      <div className="track audio"><span>声音：每个镜头自带生成的声音 · 配乐和对白轨在成片阶段叠加</span></div>
      <div className="ticks">{segs.map(s => <span key={s.shot.id} style={{flexGrow: s.dur, flexBasis: 0}}>{fmt(s.start)}</span>)}</div>
    </div>
  );
}
const PlainSegment = props => <Segment {...props} sortable={false} />;

export {totalDuration};
