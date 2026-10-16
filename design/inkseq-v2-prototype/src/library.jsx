import React, {useMemo, useRef, useState} from 'react';
import {Box, Check, Download, Files, Film, FolderInput, Image as ImageIcon, Inbox, MapPin, Music, Plus, Tag, Trash2, Upload, UserRound, X} from 'lucide-react';

const VIEW_ICON = {character: UserRound, location: MapPin, prop: Box, all: Files, image: ImageIcon, video: Film, audio: Music, inbox: Inbox};
import {AppHeader} from './pages.jsx';
import {AssetThumb, PlayButton, ProfileEditor, readFiles} from './components.jsx';
import {KIND_LABEL, TYPE_LABEL, VARIANT_LABEL} from './data.js';
import {coverOf} from './model.js';
import {useStore} from './store.jsx';

// The account-wide library. Works are linked automatically from what actually uses a file (no manual
// tagging needed); tags are optional, for the user's own grouping.
const SOURCE = {upload: '上传', ai: 'AI 生成', frame: '视频截帧'};

function useUsage() {
  const {state} = useStore();
  return useMemo(() => {
    const story = id => state.stories.find(s => s.id === id);
    const profileShots = {}, assetShots = {}, assetProfiles = {};
    const add = (map, k, v) => { (map[k] = map[k] || []).push(v); };
    state.shots.forEach(s => {
      [...s.cast.map(c => c.id), s.place?.id, ...s.props].filter(Boolean).forEach(pid => add(profileShots, pid, s));
      [...s.refs, s.start, s.end, ...(s.guides || []).map(g => g.asset)].filter(Boolean).forEach(id => add(assetShots, id, s));
    });
    state.profiles.forEach(p => {
      const ids = new Set([p.ambient, p.voice, ...(p.voices || []).map(v => v.asset), ...p.variants.flatMap(v => [...v.images, v.voice])].filter(Boolean));
      ids.forEach(id => add(assetProfiles, id, p));
    });
    // Works an asset belongs to: used directly by a shot, or through a profile a shot uses.
    const assetStories = id => new Set([...(assetShots[id] || []).map(s => s.storyId), ...(assetProfiles[id] || []).flatMap(p => (profileShots[p.id] || []).map(s => s.storyId))]);
    const profileStories = id => new Set((profileShots[id] || []).map(s => s.storyId));
    return {story, profileShots, assetShots, assetProfiles, assetStories, profileStories};
  }, [state.shots, state.profiles, state.stories]);
}

export function LibraryPage() {
  const {state, dispatch, toast, db} = useStore();
  const use = useUsage();
  const [view, setView] = useState('image'), [work, setWork] = useState('all'), [tag, setTag] = useState(null), [q, setQ] = useState('');
  const [picked, setPicked] = useState([]), [open, setOpen] = useState(null), [tagInput, setTagInput] = useState(''), [drop, setDrop] = useState(false);
  const fileInput = useRef();
  const isProfile = ['character', 'location', 'prop'].includes(view);
  const tags = useMemo(() => { const n = {}; state.assets.forEach(a => (a.tags || []).forEach(t => { n[t] = (n[t] || 0) + 1; })); return Object.entries(n).sort((a, b) => b[1] - a[1]); }, [state.assets]);
  const inWork = stories => work === 'all' || (work === 'unused' ? !stories.size : stories.has(work));

  const assets = state.assets.filter(a => (view === 'all' ? !a.inbox : view === 'inbox' ? a.inbox : a.kind === view && !a.inbox)
    && inWork(use.assetStories(a.id)) && (!tag || (a.tags || []).includes(tag)) && (!q || (a.name + (a.tags || []).join(' ')).includes(q)));
  const profiles = state.profiles.filter(p => p.type === view && inWork(use.profileStories(p.id)) && (!q || (p.name + p.desc).includes(q)));
  const count = k => k === 'inbox' ? state.assets.filter(a => a.inbox).length : k === 'all' ? state.assets.filter(a => !a.inbox).length
    : ['character', 'location', 'prop'].includes(k) ? state.profiles.filter(p => p.type === k).length : state.assets.filter(a => a.kind === k && !a.inbox).length;
  const go = k => { setView(k); setPicked([]); setOpen(null); };
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const upload = async files => { if (!files.length) return; dispatch({type: 'uploadFiles', files: await readFiles(files)}); go('inbox'); toast(`已上传 ${files.length} 个文件，在「待整理」里`); };
  const cur = open && state.assets.find(a => a.id === open);
  const sel = picked.map(id => state.assets.find(a => a.id === id)).filter(Boolean);
  const addTag = (ids, t) => { t = t.trim(); if (t) dispatch({type: 'tagAssets', ids, add: t}); };

  return (
    <div className="home lib-shell">
      <AppHeader />
      <div className="libp">
        <aside className="libp-side">
          <div className="libp-group">档案</div>
          {['character', 'location', 'prop'].map(k => { const I = VIEW_ICON[k]; return <button key={k} className={view === k ? 'on' : ''} onClick={() => go(k)}><I size={14} /><span>{TYPE_LABEL[k]}</span><small>{count(k)}</small></button>; })}
          <div className="libp-group">文件</div>
          {[['all', '全部文件'], ['image', '图片'], ['video', '动作视频'], ['audio', '声音'], ['inbox', '待整理']].map(([k, l]) =>
            <button key={k} className={(view === k ? 'on ' : '') + (k === 'inbox' && count(k) ? 'alert' : '')} onClick={() => go(k)}>{(I => <I size={14} />)(VIEW_ICON[k])}<span>{l}</span><small>{count(k)}</small></button>)}
          <div className="libp-group">作品 <small>自动按用到的地方归类</small></div>
          <button className={work === 'all' ? 'on' : ''} onClick={() => setWork('all')}>全部作品</button>
          {state.stories.map(s => <button key={s.id} className={work === s.id ? 'on' : ''} onClick={() => setWork(s.id)}><span className="clip">{s.title}</span></button>)}
          <button className={work === 'unused' ? 'on' : ''} onClick={() => setWork('unused')}>还没用过的</button>
          {!isProfile && tags.length > 0 && <><div className="libp-group">标签</div>
            <div className="libp-tags">{tags.map(([t, n]) => <button key={t} className={'tagchip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? null : t)}>{t}<small>{n}</small></button>)}</div></>}
        </aside>

        <main className={'libp-main' + (drop ? ' drop-hot' : '')}
          onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDrop(true); } }} onDragLeave={() => setDrop(false)}
          onDrop={e => { e.preventDefault(); setDrop(false); upload(e.dataTransfer.files); }}>
          <div className="libp-head">
            <h1 className="page-title">{(I => <I size={20} />)(VIEW_ICON[view])}{isProfile ? TYPE_LABEL[view] : {all: '全部文件', image: '图片', video: '动作视频', audio: '声音', inbox: '待整理'}[view]}
              <small>{isProfile ? profiles.length : assets.length}</small></h1>
            {work !== 'all' && <span className="pill">{work === 'unused' ? '还没用过的' : use.story(work)?.title}<button className="x" onClick={() => setWork('all')}><X size={11} /></button></span>}
            {tag && <span className="pill"><Tag size={11} />{tag}<button className="x" onClick={() => setTag(null)}><X size={11} /></button></span>}
            <div className="spacer" />
            <input className="lib-search" placeholder="搜索名字或标签…" value={q} onChange={e => setQ(e.target.value)} />
            {isProfile ? <button className="primary" onClick={() => { const name = prompt(`新建${TYPE_LABEL[view]}的名字`); if (name) dispatch({type: 'newProfile', ptype: view, name}); }}><Plus size={15} />新建{TYPE_LABEL[view]}</button>
              : <button className="primary" onClick={() => fileInput.current.click()}><Upload size={15} />上传</button>}
            <input ref={fileInput} type="file" multiple hidden accept="image/*,video/*,audio/*" onChange={e => { upload(e.target.files); e.target.value = ''; }} />
          </div>

          {sel.length > 0 && <div className="libp-bulk">
            <b>已选 {sel.length} 个</b>
            <input placeholder="加标签，回车" value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { addTag(picked, tagInput); setTagInput(''); } }} list="lib-tags" />
            <FileInto ids={sel.filter(a => a.kind === 'image').map(a => a.id)} onDone={() => setPicked([])} />
            <button className="small danger" onClick={() => { sel.forEach(a => dispatch({type: 'trash', item: {kind: 'asset', id: a.id}})); toast(`${sel.length} 个文件已移到回收站`, () => sel.forEach(a => dispatch({type: 'restore', item: {kind: 'asset', id: a.id}}))); setPicked([]); setOpen(null); }}><Trash2 size={13} />移到回收站</button>
            <div className="spacer" />
            <button className="small ghost" onClick={() => setPicked(assets.map(a => a.id))}>全选 {assets.length}</button>
            <button className="small ghost" onClick={() => setPicked([])}>取消选择</button>
          </div>}
          <datalist id="lib-tags">{tags.map(([t]) => <option key={t} value={t} />)}</datalist>

          {isProfile ? <div className="libp-profiles">{profiles.map(p => {
            const n = (use.profileShots[p.id] || []).length, works = [...use.profileStories(p.id)].map(id => use.story(id)?.title).filter(Boolean);
            return <button key={p.id} className="libp-pcard" onClick={() => dispatch({type: 'openProfile', id: p.id})}>
              <AssetThumb asset={coverOf(db, p, p.def)} size={64} />
              <span><b>{p.name}</b><small className="muted clip">{p.desc}</small>
                <small>{p.type === 'prop' ? '' : `${p.variants.length} 个${VARIANT_LABEL[p.type]} · `}{p.variants.reduce((x, v) => x + v.images.length, 0)} 张图{n ? ` · 用在 ${n} 个镜头` : ' · 还没用过'}</small>
                {works.length > 0 && <small className="muted">{works.join('、')}</small>}</span></button>;
          })}{!profiles.length && <p className="muted">没有符合条件的档案。</p>}</div>
            : <div className="libp-grid">{assets.map(a => {
              const works = use.assetStories(a.id).size;
              return <div key={a.id} className={'libp-tile' + (picked.includes(a.id) ? ' picked' : '') + (open === a.id ? ' open' : '')} onClick={e => (e.shiftKey || e.metaKey || e.ctrlKey || picked.length ? toggle(a.id) : setOpen(open === a.id ? null : a.id))}>
                <span className="libp-check" onClick={e => { e.stopPropagation(); toggle(a.id); }}>{picked.includes(a.id) && <Check size={12} />}</span>
                {a.kind === 'audio' ? <div className="libp-audio">♪<small>{a.seconds}s</small></div> : <img src={a.thumb} alt="" style={{filter: a.hue ? `hue-rotate(${a.hue}deg)` : undefined}} />}
                {a.kind === 'video' && <span className="tile-badge">▶ {a.seconds}s</span>}
                <span className="libp-name clip">{a.name}</span>
                <span className="libp-meta">{works ? `${works} 个作品在用` : '未使用'}{(a.tags || []).length ? ' · ' + a.tags.join(' · ') : ''}</span>
              </div>;
            })}{!assets.length && <p className="muted">{view === 'inbox' ? '没有待整理的文件。' : '没有符合条件的文件。把文件拖到这里就能上传。'}</p>}</div>}
          {!isProfile && <p className="muted libp-tip">点一下看详情和用在哪里；按住 Shift / Ctrl 点，或点左上角的圆圈，可以多选后批量加标签、归入档案或删除。把文件拖到这页任何地方即可上传。</p>}
        </main>

        {cur && <AssetDetail key={cur.id} a={cur} use={use} onClose={() => setOpen(null)} onTag={t => addTag([cur.id], t)} tags={tags} />}
      </div>
      <ProfileEditor />
    </div>
  );
}

function FileInto({ids, onDone}) {
  const {state, dispatch, toast} = useStore();
  if (!ids.length) return null;
  return <select className="small" value="" onChange={e => { const [pid, vid] = e.target.value.split('|'); ids.forEach(asset => dispatch({type: 'fileImage', asset, pid, vid}));
    const p = state.profiles.find(x => x.id === pid); toast(`${ids.length} 张图已归入 ${p.name}`); onDone(); }}>
    <option value="">归入档案…（{ids.length} 张图）</option>
    {state.profiles.map(p => <optgroup key={p.id} label={`${TYPE_LABEL[p.type]} · ${p.name}`}>{p.variants.map(v => <option key={v.id} value={`${p.id}|${v.id}`}>{p.name} · {v.name}</option>)}</optgroup>)}
  </select>;
}

function AssetDetail({a, use, onClose, onTag, tags}) {
  const {state, dispatch, trash} = useStore();
  const [t, setT] = useState('');
  const shots = use.assetShots[a.id] || [], profs = use.assetProfiles[a.id] || [];
  const byStory = {};
  shots.forEach(s => { (byStory[s.storyId] = byStory[s.storyId] || []).push({s, how: s.start === a.id ? '首帧' : s.end === a.id ? '尾帧' : (s.guides || []).some(g => g.asset === a.id) ? '中间参考' : '参考素材'}); });
  profs.forEach(p => (use.profileShots[p.id] || []).forEach(s => { const list = byStory[s.storyId] = byStory[s.storyId] || []; if (!list.some(x => x.s.id === s.id)) list.push({s, how: `通过 ${p.name}`}); }));
  const from = a.from && use.story(a.from);
  return (
    <aside className="libp-detail">
      <div className="row tight"><b>{KIND_LABEL[a.kind]}</b><div className="spacer" /><button className="x" onClick={onClose}><X size={14} /></button></div>
      {a.kind === 'audio' ? <div className="libp-audio big">♪<PlayButton asset={a} /></div> : a.kind === 'video' && a.src ? <video src={a.src} controls muted /> : <img className="libp-big" src={a.thumb} alt="" />}
      <label className="field"><span>名字</span><input value={a.name} onChange={e => dispatch({type: 'renameAsset', id: a.id, name: e.target.value})} /></label>
      <div className="field"><span>标签 <small className="muted">自己分组用，可不填</small></span>
        <div className="libp-tags">{(a.tags || []).map(x => <span key={x} className="tagchip on">{x}<button className="x" onClick={() => dispatch({type: 'tagAssets', ids: [a.id], remove: x})}><X size={10} /></button></span>)}
          <input className="tag-input" placeholder="＋ 标签" value={t} list="lib-tags" onChange={e => setT(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onTag(t); setT(''); } }} /></div></div>
      <small className="muted">{SOURCE[a.source] || '示例素材'}{from ? ` · 在「${from.title}」里上传` : ''}{a.seconds ? ` · ${a.seconds} 秒` : ''}</small>

      <div className="libp-uses"><b>用在哪里</b>
        {profs.length > 0 && <div className="use-line">档案：{profs.map(p => <button key={p.id} className="linkish" onClick={() => dispatch({type: 'openProfile', id: p.id})}>{p.name}</button>)}</div>}
        {Object.entries(byStory).map(([sid, list]) => <div key={sid} className="use-story"><small className="muted">{use.story(sid)?.title}</small>
          {list.map(({s, how}) => <button key={s.id} className="use-shot" onClick={() => dispatch({type: 'focusShot', id: s.id})}><span className="clip">{s.title}</span><small>{how}</small></button>)}</div>)}
        {!profs.length && !shots.length && !Object.keys(byStory).length && <small className="muted">还没有地方在用。可以归入档案，或在镜头里直接选它。</small>}
      </div>

      <div className="libp-actions">
        {a.kind === 'image' && <FileInto ids={[a.id]} onDone={() => {}} />}
        <button className="small" onClick={() => {}}><Download size={13} />下载</button>
        <button className="small danger" onClick={() => { trash({kind: 'asset', id: a.id}, a.name); onClose(); }}><Trash2 size={13} />移到回收站</button>
      </div>
    </aside>
  );
}
