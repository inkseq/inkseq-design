import React, {useEffect, useRef, useState} from 'react';
import {useDroppable} from '@dnd-kit/core';
import {SortableContext, rectSortingStrategy} from '@dnd-kit/sortable';
import {AssetLibrary, ProfileEditor, Screen, ShotCard, ShotEditor, Timeline, Transport, usePlayer} from './components.jsx';
import {chosenVersion, estimate, fmt, segments, shotControls, totalDuration} from './model.js';
import {queuePositions, useStore} from './store.jsx';
import {Splitter, usePanelSize} from './panels.jsx';
import {ArrowLeft, Captions, ChevronDown, Clapperboard, Download, FileSpreadsheet, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Plus, Settings2, Sparkles, Trash2} from 'lucide-react';
import {running} from './trash.js';
import {AgentSheet} from './agent.jsx';
import {LangToggle} from './pages.jsx';
import {Bot} from 'lucide-react';

const ids = shots => shots.map(s => 'shot:' + s.id);

function download(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], {type: type + ';charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const srtTime = sec => {
  const ms = Math.round(sec * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};

/* ---------- small popover menu ---------- */
function Menu({label, children, className = ''}) {
  const [open, setOpen] = useState(false);
  const box = useRef();
  useEffect(() => {
    if (!open) return;
    const away = e => box.current && !box.current.contains(e.target) && setOpen(false);
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [open]);
  return (
    <div className={'menu ' + className} ref={box}>
      <button onClick={() => setOpen(!open)}>{label}<ChevronDown size={14} className="chev" /></button>
      {open && <div className="menu-pop" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

/* ---------- story settings ---------- */
function StorySettings({story, onClose}) {
  const {dispatch} = useStore();
  const st = story.settings;
  const set = patch => dispatch({type: 'storySettings', id: story.id, patch});
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose settings" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>故事设置</b><button className="x" onClick={onClose}>×</button></div>
        <label className="field"><span>故事名</span>
          <input value={story.title} onChange={e => dispatch({type: 'renameStory', id: story.id, title: e.target.value})} /></label>
        <label className="field"><span>一句话故事（谁想要什么，遇到了什么阻碍）</span>
          <textarea rows={2} value={st.logline} onChange={e => set({logline: e.target.value})} /></label>
        <label className="field"><span>目标观众</span><input value={st.audience} onChange={e => set({audience: e.target.value})} /></label>
        <div className="row">
          <label className="field small"><span>画幅</span>
            <div className="seg">{['9:16', '16:9', '1:1'].map(x => <button key={x} className={st.aspect === x ? 'on' : ''} onClick={() => set({aspect: x})}>{x}</button>)}</div></label>
          <label className="field small"><span>每章目标时长（秒）</span>
            <input type="number" min={10} max={600} value={st.targetSec} onChange={e => set({targetSec: +e.target.value})} /></label>
          <label className="field small"><span>新镜头默认</span>
            <div className="seg">{[['draft', '草稿'], ['final', '精修']].map(([k, l]) => <button key={k} className={st.defaultQuality === k ? 'on' : ''} onClick={() => set({defaultQuality: k})}>{l}</button>)}</div></label>
        </div>
        <label className="field"><span>全片风格 · 自动加在每个镜头提示词最前面</span>
          <input value={st.style} placeholder="例如：电影感，冷色调，胶片颗粒" onChange={e => set({style: e.target.value})} /></label>
        {st.aspect !== '16:9' && <div className="warn">⚠ 竖屏/方形：全能参考目前只验收了 16:9，用全能参考的镜头会提示</div>}
        <div className="row tight" style={{justifyContent: 'flex-end'}}><button className="primary" onClick={onClose}>完成</button></div>
      </div>
    </div>
  );
}

/* ---------- top bar ---------- */
function WorkspaceBar({story, chapter, shots, onToast}) {
  const {state, dispatch, trash} = useStore();
  const [agentOpen, setAgentOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const busy = state.shots.filter(s => s.storyId === story.id && s.versions.some(v => v.status === 'queued' || v.status === 'generating'));
  const pos = queuePositions(state);
  const maxPos = Math.max(0, ...busy.map(s => pos[s.id] || 0));
  const waitingModes = [...new Set(busy.flatMap(s => s.versions.filter(v => v.status === 'queued').map(v => v.mode)))];
  const noMachine = waitingModes.filter(m => !state.machines.some(x => (x.mode === m || x.mode === 'both') && x.status !== 'stopping')).map(m => (m === 'REF' ? '全能参考' : '首尾帧'));
  const segs = segments(shots), missing = shots.filter(s => !chosenVersion(s));
  const exportSrt = () => {
    const lines = segs.filter(x => x.shot.dialogue).map((x, i) => `${i + 1}\n${srtTime(x.start)} --> ${srtTime(x.start + x.dur)}\n${x.shot.dialogue}\n`);
    if (!lines.length) return onToast('这一章还没有写台词');
    download(`${story.title}-${chapter.title}.srt`, lines.join('\n'));
    onToast(`已导出字幕：${lines.length} 条`);
  };
  const exportCsv = () => {
    const rows = [['序号', '场', '镜头', '时长', '模式', '剧本', '台词', '选定版本']];
    segs.forEach((x, i) => rows.push([i + 1, chapter.scenes.find(sc => sc.id === x.shot.sceneId)?.title, x.shot.title, x.dur,
      x.shot.mode === 'REF' ? '全能参考' : '首尾帧', x.shot.script, x.shot.dialogue || '', chosenVersion(x.shot) ? 'v' + chosenVersion(x.shot).n : '未选']));
    download(`${story.title}-${chapter.title}-镜头清单.csv`, rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    onToast('已导出镜头清单');
  };
  const roughCut = () => onToast(missing.length ? `还有 ${missing.length} 个镜头没选定版本，粗剪会用文字占位（模拟）` : '粗剪成片已开始生成（模拟），完成后可下载 MP4');
  return (
    <header className="wbar">
      <button className="ghost back" onClick={() => dispatch({type: 'home'})}><ArrowLeft size={16} />作品库</button>
      <Menu label={<b>{story.title}</b>} className="story-menu">
        <div className="menu-head">切换故事</div>
        {state.stories.map(s => <button key={s.id} className={s.id === story.id ? 'on' : ''} onClick={() => dispatch({type: 'openStory', id: s.id})}>{s.title}{s.local && <small> · 本机</small>}</button>)}
      </Menu>
      <span className="sep">/</span>
      <Menu label={chapter.title} className="chapter-menu">
        <div className="menu-head">章节</div>
        {story.chapters.map((c, i) => <button key={c.id} className={c.id === chapter.id ? 'on' : ''} onClick={() => dispatch({type: 'setChapter', id: c.id})}>
          第 {i + 1} 章 · {c.title}<small> {state.shots.filter(s => s.chapterId === c.id).length} 镜</small></button>)}
        <hr />
        <button onClick={() => { const t = prompt('章节名', chapter.title); if (t) dispatch({type: 'renameChapter', storyId: story.id, id: chapter.id, title: t}); }}>✎ 重命名本章</button>
        <button onClick={() => { const t = prompt('新章节名', `第 ${story.chapters.length + 1} 章`); if (t) dispatch({type: 'addChapter', storyId: story.id, title: t}); }}>＋ 新章节</button>
        <button className="danger-item" disabled={story.chapters.length < 2 || running(state, {kind: 'chapter', id: chapter.id}) > 0}
          onClick={() => trash({kind: 'chapter', id: chapter.id, storyId: story.id}, chapter.title)}><Trash2 size={13} /> 本章移到回收站
          <small>{story.chapters.length < 2 ? ' 至少保留一章' : running(state, {kind: 'chapter', id: chapter.id}) ? ' 还有镜头在生成' : ' 连同里面的镜头'}</small></button>
      </Menu>
      <span className={'badge ' + (story.local ? 'local' : 'cloud')}>{story.local ? '本机' : '云端 · 已保存'}</span>
      <div className="spacer" />
      {busy.length > 0 && <button className="qstatus" title="去算力页看机器" onClick={() => dispatch({type: 'page', page: 'gpu'})}>
        {busy.length} 个镜头生成中 / 排队{maxPos ? ` · 最多排第 ${maxPos}` : ''}{noMachine.length ? ` · ${noMachine.join('、')}没有机器` : ''}</button>}
      <Menu label={<><Download size={15} />导出</>} className="export-menu">
        <button onClick={roughCut}><span className="mi"><Clapperboard size={15} />粗剪成片（MP4）</span><small>把选定版本按时间线接起来</small></button>
        <button onClick={exportSrt}><span className="mi"><Captions size={15} />字幕 SRT</span><small>按台词和时间线生成</small></button>
        <button onClick={exportCsv}><span className="mi"><FileSpreadsheet size={15} />镜头清单 CSV</span><small>给剪辑师或审片用</small></button>
        {missing.length > 0 && <div className="menu-note">还有 {missing.length} 个镜头没选定版本</div>}
      </Menu>
      <LangToggle />
      <button className="ghost" onClick={() => setAgentOpen(true)} title="把这个故事交给 AI 助手"><Bot size={16} />AI 助手</button>
      <button className="ghost" onClick={() => setSettings(true)} title="故事设置"><Settings2 size={16} />设置</button>
      {agentOpen && <AgentSheet here={{kind: 'story', id: story.id}} onClose={() => setAgentOpen(false)} />}
      <span className="avatar" title="superdan">S</span>
      {settings && <StorySettings story={story} onClose={() => setSettings(false)} />}
    </header>
  );
}

/* ---------- 多选后的批量操作 ---------- */
function BulkBar({story, shots, picked, setPicked}) {
  const {dispatch, toast, db} = useStore();
  const [count, setCount] = useState(1);
  const sel = shots.filter(s => picked.includes(s.id));
  const busy = s => s.versions.some(v => v.status === 'queued' || v.status === 'generating');
  const fresh = sel.filter(s => !s.versions.length).length, running = sel.filter(busy).length;
  const est = estimate(sel.map(s => ({quality: s.quality, duration: s.duration, resolution: shotControls(s, db).resolution, count})));
  const scenes = story.chapters.flatMap(c => c.scenes.map(sc => ({id: sc.id, label: `${c.title} · ${sc.title}`})));
  const remove = () => {
    const ok = sel.filter(s => !busy(s));
    ok.forEach(s => dispatch({type: 'trash', item: {kind: 'shot', id: s.id}}));
    setPicked([]);
    toast(`${ok.length} 个镜头已移到回收站${running ? `；${running} 个还在生成，没有删` : ''}`, () => ok.forEach(s => dispatch({type: 'restore', item: {kind: 'shot', id: s.id}})));
  };
  return (
    <div className="bulkbar" onClick={e => e.stopPropagation()}>
      <b>已选 {sel.length} 个镜头</b>
      <small className="muted">{[fresh && `${fresh} 个没生成过`, running && `${running} 个在生成`].filter(Boolean).join(' · ')}</small>
      <span className="bulk-sep" />
      <select className="count-pick" value={count} onChange={e => setCount(+e.target.value)}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>每个 {n} 条</option>)}</select>
      <button className="small primary" title={est.text} onClick={() => { dispatch({type: 'generate', ids: sel.map(s => s.id), count}); toast(`已排队 ${sel.length * count} 条 · ${est.text}`); }}>生成 {sel.length * count} 条</button>
      <small className="muted">{est.text}</small>
      <div className="seg">{['draft', 'final'].map(q => <button key={q} className={sel.every(s => s.quality === q) ? 'on' : ''} onClick={() => sel.forEach(s => dispatch({type: 'update', id: s.id, patch: {quality: q}}))}>{q === 'draft' ? '草稿' : '精修'}</button>)}</div>
      <select className="small" value="" onChange={e => { if (!e.target.value) return; sel.forEach(s => dispatch({type: 'moveShot', id: s.id, sceneId: e.target.value})); toast(`${sel.length} 个镜头已移到「${scenes.find(x => x.id === e.target.value)?.label}」`); }}>
        <option value="">移到…</option>{scenes.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      <button className="small ghost danger-text" onClick={remove}>删除</button>
      <div className="spacer" />
      <button className="small ghost" onClick={() => setPicked(shots.map(s => s.id))}>全选本章 {shots.length}</button>
      <button className="small ghost" onClick={() => setPicked([])}>取消（Esc）</button>
    </div>
  );
}

/* ---------- scene group ---------- */
function SceneGroup({story, scene, shots, offset, selected, setSelected, picked, onPick}) {
  const {dispatch, trash} = useStore();
  const siblings = story.chapters.find(c => c.scenes.some(x => x.id === scene.id))?.scenes.length || 1;
  const [editingTitle, setEditingTitle] = useState(false);
  const busy = shots.reduce((n, s) => n + s.versions.filter(v => v.status === 'queued' || v.status === 'generating').length, 0);
  const {setNodeRef, isOver, active} = useDroppable({id: 'scene:' + scene.id});
  const moving = isOver && String(active?.id).startsWith('shot:');
  const dur = shots.reduce((n, s) => n + (s.mode === 'REF' ? 5 : s.duration), 0);
  return (
    <section ref={setNodeRef} className={'scene' + (moving ? ' drop-hot' : '')}>
      <div className="scene-head">
        {editingTitle ? <input autoFocus defaultValue={scene.title} onBlur={e => { const v = e.target.value.trim(); if (v) dispatch({type: 'renameScene', storyId: story.id, id: scene.id, title: v}); setEditingTitle(false); }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingTitle(false); }} />
          : <button className="scene-title" title="点击改名" onClick={() => setEditingTitle(true)}>{scene.title}</button>}
        <small>{shots.length} 镜 · {fmt(dur)}</small>
        <button className="small ghost" onClick={() => dispatch({type: 'add', sceneId: scene.id})}><Plus size={14} />镜头</button>
        <button className="small ghost icon-only" disabled={siblings < 2 || busy > 0} title={siblings < 2 ? '这一章至少保留一场' : busy ? '还有镜头在生成' : `这一场移到回收站（连同 ${shots.length} 个镜头）`}
          onClick={() => trash({kind: 'scene', id: scene.id, storyId: story.id}, scene.title)}><Trash2 size={13} /></button>
      </div>
      <SortableContext items={ids(shots)} strategy={rectSortingStrategy}>
        <div className="wall">
          {shots.map((s, i) => <ShotCard key={s.id} shot={s} index={offset + i} selected={selected === s.id} onOpen={setSelected} picked={picked.includes(s.id)} picking={picked.length > 0} onPick={onPick} />)}
          {!shots.length && <div className="scene-empty">把镜头拖到这里，或点「＋ 镜头」</div>}
        </div>
      </SortableContext>
    </section>
  );
}

/* ---------- workspace ---------- */
export function Workspace({selected, setSelected, pickAsset, onToast}) {
  const {state, dispatch, db} = useStore();
  const story = db.story(state.activeStory);
  const chapter = story?.chapters.find(c => c.id === state.activeChapter) || story?.chapters[0];
  const shots = story ? db.chapterShots(story.id, chapter.id) : [];
  const player = usePlayer(shots);
  const lib = usePanelSize('W.lib', 260, 170, 560), dock = usePanelSize('W.dock', 190, 110, 900), drawer = usePanelSize('W.drawer', 440, 340, 820);
  const [libOpen, setLibOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 760);
  // 多选: Ctrl/Shift-click or the circle on a card; Shift selects a range in chapter order. Esc clears.
  const [picked, setPicked] = useState([]), lastPick = useRef(null);
  const onPick = (id, e) => setPicked(p => {
    if (e?.shiftKey && lastPick.current) {
      const order = shots.map(s => s.id), a = order.indexOf(lastPick.current), b = order.indexOf(id);
      if (a >= 0 && b >= 0) { const range = order.slice(Math.min(a, b), Math.max(a, b) + 1); lastPick.current = id; return [...new Set([...p, ...range])]; }
    }
    lastPick.current = id;
    return p.includes(id) ? p.filter(x => x !== id) : [...p, id];
  });
  useEffect(() => { setPicked([]); }, [state.activeChapter, state.activeStory]);
  useEffect(() => { if (!picked.length) return; const k = e => { if (e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) setPicked([]); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [picked.length]);
  const [wide, setWide] = useState(() => { try { return localStorage.getItem('W.wideEditor') === '1'; } catch { return false; } });
  const toggleWide = () => setWide(w => { try { localStorage.setItem('W.wideEditor', w ? '0' : '1'); } catch {} return !w; });
  // Browser 后退 steps back inside the editor first: 展开 → 侧栏 → 关闭, instead of leaving the page.
  const setWideSaved = v => { setWide(v); try { localStorage.setItem('W.wideEditor', v ? '1' : '0'); } catch {} };
  const editorOpen = !!selected, wideOpen = wide && editorOpen, unwinding = useRef(false);
  useEffect(() => {
    if (!editorOpen) return;
    window.history.pushState({sixnineEditor: 1}, '');
    const pop = () => { if (!window.history.state?.sixnineEditor) setSelected(null); };
    window.addEventListener('popstate', pop);
    return () => {
      window.removeEventListener('popstate', pop);
      const depth = window.history.state?.sixnineEditor; // 1, or 2 when closed while 展开
      if (depth) { unwinding.current = true; window.history.go(-depth); setTimeout(() => { unwinding.current = false; }, 0); }
    };
  }, [editorOpen]); // eslint-disable-line
  useEffect(() => {
    if (!wideOpen) return;
    window.history.pushState({sixnineEditor: 2}, '');
    const pop = () => { if (window.history.state?.sixnineEditor !== 2) setWideSaved(false); };
    const key = e => { if (e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) setWideSaved(false); };
    window.addEventListener('popstate', pop); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('keydown', key); if (!unwinding.current && window.history.state?.sixnineEditor === 2) window.history.back(); };
  }, [wideOpen]); // eslint-disable-line
  useEffect(() => { if (selected && !shots.some(s => s.id === selected)) setSelected(null); }, [chapter?.id]); // eslint-disable-line
  // Preview dock: until the user drags it, it grows into the empty space under a short card wall;
  // double-click the bar toggles compact / large; 影院 mode puts a big preview over the card wall.
  const colRef = useRef(), mainRef = useRef();
  const [room, setRoom] = useState({col: 0, content: 0});
  useEffect(() => {
    const measure = () => {
      const col = colRef.current, main = mainRef.current;
      if (!col || !main) return;
      const last = main.lastElementChild, top = main.getBoundingClientRect().top;
      const content = last ? last.getBoundingClientRect().bottom - top + main.scrollTop + 32 : 0;
      setRoom(r => (Math.abs(r.col - col.clientHeight) < 2 && Math.abs(r.content - content) < 2 ? r : {col: col.clientHeight, content}));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (colRef.current) ro.observe(colRef.current);
    if (mainRef.current) { ro.observe(mainRef.current); [...mainRef.current.children].forEach(c => ro.observe(c)); }
    return () => ro.disconnect();
  });
  const COMPACT = 190, large = Math.max(COMPACT, Math.round(room.col * 0.58)), maxDock = Math.max(COMPACT, room.col - 140);
  const autoDock = Math.min(large, Math.max(COMPACT, room.col - room.content - 8));
  const dockH = Math.min(maxDock, dock.custom ? dock.size : autoDock);
  const toggleDock = () => dock.set(dockH > (COMPACT + large) / 2 ? COMPACT : large);
  const [theater, setTheater] = useState(false);
  useEffect(() => {
    if (!theater) return;
    const k = e => { if (e.key === 'Escape' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) setTheater(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [theater]);
  useEffect(() => { setTheater(false); }, [state.activeChapter, state.activeStory]);
  if (!story) return null;
  const pending = shots.filter(s => !s.versions.length);
  const target = story.settings.targetSec, total = totalDuration(shots);
  let offset = 0;
  return (
    <div className="workspace">
      <WorkspaceBar story={story} chapter={chapter} shots={shots} onToast={onToast} />
      <div className="layout A" style={{gridTemplateColumns: libOpen ? `${lib.size}px 8px minmax(0, 1fr)` : '0 0 minmax(0, 1fr)', '--libw': (libOpen ? lib.size : 0) + 'px'}}>
        {libOpen ? <AssetLibrary onPick={pickAsset} selectedShot={state.shots.find(s => s.id === selected)} /> : <div />}
        {libOpen ? <Splitter panel={lib} axis="x" sign={1} /> : <div />}
        <div className="col" ref={colRef}>
          <main className="main" ref={mainRef}>
            <div className="chapter-head">
              <div className="row tight">
                <button className="small ghost" title={libOpen ? '收起素材库' : '展开素材库'} onClick={() => setLibOpen(!libOpen)}>{libOpen ? <PanelLeftClose size={16} /> : <><PanelLeftOpen size={16} />素材库</>}</button>
                <h1>{chapter.title}</h1>
                <small className="muted">{shots.length} 镜 · {fmt(total)}{target ? ` / 目标 ${fmt(target)}` : ''} · 已选定 {shots.filter(s => s.chosen).length}/{shots.length}</small>
              </div>
              <div className="row tight">
                <button onClick={() => dispatch({type: 'addScene', storyId: story.id, chapterId: chapter.id})}><Plus size={14} />新场</button>
                <button className="primary" disabled={!pending.length} onClick={() => dispatch({type: 'generate', ids: pending.map(s => s.id)})}><Sparkles size={15} />生成全部未生成 · {pending.length}</button>
              </div>
            </div>
            {chapter.scenes.map(sc => {
              const list = shots.filter(s => s.sceneId === sc.id);
              const el = <SceneGroup key={sc.id} story={story} scene={sc} shots={list} offset={offset} selected={selected} setSelected={setSelected} picked={picked} onPick={onPick} />;
              offset += list.length;
              return el;
            })}
            {picked.length > 0 && <BulkBar story={story} shots={shots} picked={picked} setPicked={setPicked} />}
          </main>
          {theater && <div className="theater" role="dialog" aria-label="影院模式" style={{bottom: COMPACT - 60 + 8}}>
            <div className="theater-stage"><Screen player={player} big /></div>
            <button className="ghost theater-close" title="退出影院模式 (Esc)" onClick={() => setTheater(false)}><Minimize2 size={16} />退出</button>
          </div>}
          <Splitter panel={dock} axis="y" sign={-1} current={dockH} onDouble={toggleDock} title="拖动调整预览大小 · 双击在紧凑 / 大预览之间切换" />
          <div className={'dock' + (theater ? ' in-theater' : dockH > 300 ? ' tall' : '')} style={{height: theater ? COMPACT - 60 : dockH}}>
            <div className="dock-screen">
              <Screen player={player} />
              <button className="screen-expand" title="影院模式：放大预览，时间线保留" onClick={() => setTheater(true)}><Maximize2 size={15} /></button>
            </div>
            <div className="dock-right">
              <Transport player={player} />
              <Timeline player={player} selectedId={selected} onPick={setSelected} />
              <small className="muted">点时间线上的一段 → 打开这个镜头</small>
            </div>
          </div>
        </div>
        {selected && <div className={'drawer' + (wide ? ' wide' : '')} style={wide ? {left: libOpen ? lib.size + 8 : 0} : {width: drawer.size}}>
          {!wide && <Splitter panel={drawer} axis="x" sign={-1} className="edge" />}
          <ShotEditor shotId={selected} onClose={() => setSelected(null)} wide={wide} onWide={toggleWide} /></div>}
        <ProfileEditor />
      </div>
    </div>
  );
}
