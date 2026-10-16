import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Popover} from './ui.jsx';
import {Menu, AlertCircle, ArrowRight, Bot, Columns2, Star, Download, Film, MoreHorizontal, Pencil, RotateCcw, Trash2, Upload, Volume2, VolumeX, FolderInput, Paperclip, Plus, RefreshCw, Send, SlidersHorizontal, Sparkles, Wand2, X} from 'lucide-react';
import {AdvancedSheet, autoRoles, changedCount, changedSummary} from './advanced.jsx';
import {AppHeader} from './pages.jsx';
import {readFiles} from './components.jsx';
import {checkInputs, Chip, orderFL, roleLabel, SpecPicker} from './inputs.jsx';
import {estimate, MODELS} from './model.js';
import {queuePositions, useStore} from './store.jsx';
import {daysLeft} from './trash.js';
import {AgentSheet, ByAgent} from './agent.jsx';

const MODE_NAME = {FL: '首尾帧', REF: '全能参考'};
const EXAMPLES = ['雨夜街口，剑客回头，霓虹倒影', '清晨的老车站，一个女孩推门进来', '机械龙从楼后探出头，火花四溅'];

/* ---------- the (simulated) assistant ---------- */
// It only ever proposes. Nothing is generated until the user presses 生成 on a proposal.
const TWEAKS = [[/暗|夜|阴/, '低照度，暗部更深，冷色调'], [/亮|白天|阳光/, '明亮通透，柔和日光'], [/慢/, '慢动作'], [/快|激烈/, '节奏更快，动作更激烈'],
  [/近|特写/, '近景特写，聚焦人物表情'], [/远|全景/, '远景，交代环境'], [/雨/, '大雨，雨水飞溅'], [/声音|音乐|安静/, '声音克制，只保留环境声']];

function propose(text, attachments, prev, forced) {
  const tweaks = TWEAKS.filter(([re]) => re.test(text)).map(([, t]) => t);
  const hasRef = attachments.some(a => a.kind === 'video' || a.kind === 'audio');
  if (prev) {
    const fresh = tweaks.filter(t => !prev.prompt.includes(t));
    const prompt = `${prev.prompt}${tweaks.length ? (fresh.length ? '，' + fresh.join('，') : '') : '，' + text}`;
    return {reply: `按你说的改了：${tweaks.length ? tweaks.join('、') : text}。其余保持不变，看看下面的方案。`, proposal: {...prev, prompt, v: prev.v + 1}};
  }
  const mode = forced || (hasRef ? 'REF' : 'FL');
  const prompt = `${text}，电影感构图，镜头缓慢推进，${tweaks.length ? tweaks.join('，') + '，' : ''}画面细节清晰，环境声自然`;
  return {
    reply: `我把它理解成一个 5 秒的镜头。${forced === 'FL' ? (attachments.length ? `按你选的「首尾帧」：${attachments.length === 1 ? '这张图做开头' : '第一张做开头、第二张做结尾'}${attachments.length > 2 ? '，其余作为中间关键帧' : ''}。` : '按你选的「首尾帧」，只用文字生成。') : forced === 'REF' ? '按你选的「全能参考」，人和动作会尽量贴近参考素材。' : hasRef ? '你放了视频或声音参考，所以用「全能参考」。' : attachments.length >= 2 ? '两张图我按「首尾帧」处理：第一张开头、第二张结尾。想当人物参考就切到「全能参考」。' : attachments.length === 1 ? '这张图我当作开头帧。想当人物参考就切到「全能参考」。' : '只有文字，用「首尾帧」直接生成。'}提示词我补了构图和镜头运动，你可以直接改，或者告诉我哪里要调整。`,
    proposal: {prompt, mode, quality: 'draft', duration: mode === 'REF' ? 5 : 5, refs: attachments.map(a => a.id), v: 1},
  };
}

/* ---------- pieces ---------- */
function ProposalCard({sid, msg, latest, onGenerate}) {
  const {state, dispatch, db} = useStore();
  const [adv, setAdv] = useState(false), [n, setN] = useState(1);
  const p = msg.proposal, set = patch => dispatch({type: 'qcPatch', sid, mid: msg.id, patch: {proposal: {...p, ...patch}}});
  const c = {...(state.genDefaults || {}), ...(p.controls || {})}, items = p.refs.map(id => db.asset(id)).filter(Boolean);
  const changed = changedSummary(p.controls || {});
  const issues = latest ? checkInputs(p.mode, items, p.frames || autoRoles(items, c.duration ?? 5), p.inputOpts, c.duration ?? 5) : [];
  return (
    <div className={'proposal' + (latest ? '' : ' old')}>
      <div className="proposal-head"><Wand2 size={15} /><b>镜头方案 v{p.v}</b>{msg.used && <span className="pill good">已生成</span>}<div className="spacer" />{msg.via && <small className="muted via">{msg.via}</small>}</div>
      {p.base && <div className="refs"><span className="ref base-ref"><img src={`/clips/${p.base.clip}-${p.base.kind === 'next' ? 'last' : 'first'}.jpg`} alt="" />基于第 {p.base.n} 条{p.base.kind === 'next' ? ' · 接着拍' : p.base.kind === 'copy' ? ' · 照这条拍' : ''}</span></div>}
      <textarea rows={3} value={p.prompt} disabled={!latest} onChange={e => set({prompt: e.target.value})} />
      {items.length > 0 && (() => { const fr = p.frames || autoRoles(items, c.duration ?? 5), fl = p.mode === 'FL'; return <div className="refs">{(fl ? orderFL(items, fr) : items).map((a, i, arr) => <React.Fragment key={a.id}>
        {fl && i > 0 && fr[a.id] && fr[arr[i - 1].id] && <ArrowRight size={14} className="fl-arrow" />}
        <span className="ref">{a.kind === 'audio' ? '♪' : <img src={a.thumb} alt="" />}{a.name}{fl && fr[a.id] && <b className="role-tag">{roleLabel(fr[a.id])}</b>}
          {a.kind !== 'image' && <b className="opt-tag">{(p.inputOpts?.[a.id]?.range || [0, Math.min(a.seconds || 3, 3)]).join('–')}s</b>}
          {a.kind === 'video' && ((p.inputOpts?.[a.id]?.sound ?? !fl) ? <Volume2 size={11} className="good-ic" /> : <VolumeX size={11} className="muted" />)}</span></React.Fragment>)}</div>; })()}
      <div className="row tight">
        <div className="seg">{['FL', 'REF'].map(k => <button key={k} disabled={!latest} className={p.mode === k ? 'on' : ''} onClick={() => set({mode: k})}>{MODE_NAME[k]}</button>)}</div>
        <div className="seg">{['draft', 'final'].map(k => <button key={k} disabled={!latest} className={p.quality === k ? 'on' : ''} onClick={() => set({quality: k})}>{MODELS[k].label}</button>)}</div>
        <SpecPicker quality={p.quality} c={c} disabled={!latest} onChange={(k, v) => { const n = {...(p.controls || {})}; if (v === undefined) delete n[k]; else n[k] = v; set({controls: n, ...(k === 'duration' ? {duration: v} : {})}); }} />
        <button className="ghost small adv-btn" disabled={!latest} onClick={() => setAdv(true)}><SlidersHorizontal size={13} />高级{changed.length ? ` · 已改 ${changed.length}` : ''}</button>
        <div className="spacer" />
        {latest && <select className="count-pick" value={n} onChange={e => setN(+e.target.value)} title="一次出几条，每条换一个随机种子">{[1, 2, 3, 4].map(k => <option key={k} value={k}>{k} 条</option>)}</select>}
        {latest && <small className="muted est">{estimate([{quality: p.quality, duration: c.duration ?? 5, resolution: c.resolution, count: n}]).text}</small>}
        {latest && <button className="primary" disabled={issues.length > 0} title={issues[0] || ''} onClick={() => onGenerate(msg, n)}><Sparkles size={15} />生成{n > 1 ? ` ${n} 条` : ''}</button>}
      </div>
      {issues.length > 0 && <div className="problems"><AlertCircle size={13} />{issues.join('；')}</div>}
      {changed.length > 0 && <small className="muted adv-sum">{changed.join(' · ')}</small>}
      {adv && <AdvancedSheet title={`高级参数 · 方案 v${p.v}`} scope="只改这一个方案。" value={p.controls || {}} base={state.genDefaults} onChange={x => set({controls: x})} onClose={() => setAdv(false)} />}
    </div>
  );
}

// Takes made from the same 方案 stay together: pick one to act on, star the good ones, or compare two side by side.
const groupKey = m => m.batch || m.id;
function BatchCard({sid, takes, ...actions}) {
  const {dispatch} = useStore();
  const [pick, setPick] = useState(null), [cmp, setCmp] = useState(null), [all, setAll] = useState(false);
  const done = takes.filter(t => t.status === 'done');
  const cur = takes.find(t => t.id === pick) || takes.find(t => t.star && t.status === 'done') || done[0] || takes[0];
  if (takes.length === 1) return <>{takes[0].by && <div className="batch-by"><ByAgent by={takes[0].by} /> 做的</div>}<ResultCard sid={sid} msg={takes[0]} {...actions} /></>;
  const pair = cmp && cmp.map(id => takes.find(t => t.id === id)).filter(Boolean);
  // Newest first; long groups show two rows and fold the rest (the one you are looking at always stays visible).
  const newest = [...takes].reverse(), LIMIT = 8;
  const shown = all || newest.length <= LIMIT ? newest : [...newest.slice(0, LIMIT - 1), ...(newest.slice(0, LIMIT - 1).includes(cur) ? [newest[LIMIT - 1]] : [cur])];
  const comparing = pair && pair.length === 2;
  const tap = t => { if (cmp) setCmp(c => (c.includes(t.id) ? c.filter(x => x !== t.id) : [...c, t.id].slice(-2))); else setPick(t.id); };
  return (
    <div className="batch">
      <div className="batch-head"><b>这一组 {takes.length} 条</b>{takes[0].by && <ByAgent by={takes[0].by} />}<small className="muted">同一个方案，每条换了随机种子{takes.length - done.length ? ` · ${takes.length - done.length} 条还在生成` : ''}</small>
        <div className="spacer" />
        {done.length > 1 && <button className={'small ghost' + (cmp ? ' on' : '')} onClick={() => setCmp(cmp ? null : [cur.id, done.find(t => t.id !== cur.id)?.id].filter(Boolean))}><Columns2 size={13} />{cmp ? '退出对比' : '并排对比'}</button>}
      </div>
      <div className="batch-strip">{shown.map(t => (
        <button key={t.id} className={'bt' + (!cmp && t.id === cur.id ? ' on' : '') + (cmp?.includes(t.id) ? ' cmp' : '')} onClick={() => t.status === 'done' && tap(t)}>
          {t.status === 'done' ? <video src={`/clips/${t.clip}.mp4`} poster={`/clips/${t.clip}-first.jpg`} muted loop playsInline preload="none"
            onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
            : <span className="bt-wait">{t.status === 'queued' ? '排队' : `${Math.round(t.progress * 100)}%`}<i style={{width: `${Math.round(t.progress * 100)}%`}} /></span>}
          <span className="bt-label">第 {t.n} 条{cmp?.includes(t.id) ? ` · ${cmp.indexOf(t.id) === 0 ? 'A' : 'B'}` : ''}</span>
          {t.status === 'done' && <span className={'bt-star' + (t.star ? ' on' : '')} title="收藏" onClick={e => { e.stopPropagation(); dispatch({type: 'qcPatch', sid, mid: t.id, patch: {star: !t.star}}); }}><Star size={12} /></span>}
          {t.movedTo && <span className="bt-moved">已放进故事</span>}
        </button>))}
        {newest.length > LIMIT && <button className="bt-more" onClick={() => setAll(!all)}>{all ? '收起' : `显示全部 ${newest.length} 条`}</button>}
      </div>
      {comparing ? <div className="batch-cmp">{pair.map((t, i) => <div key={t.id}><video src={`/clips/${t.clip}.mp4`} controls loop muted playsInline autoPlay />
          <div className="row tight"><b>{i ? 'B' : 'A'} · 第 {t.n} 条</b><div className="spacer" /><button className="small" onClick={() => { setPick(t.id); setCmp(null); }}>选这条</button></div></div>)}</div>
        : cmp ? <small className="muted">在上面点两条来对比（已选 {cmp.length}）</small>
        : <ResultCard sid={sid} msg={cur} {...actions} />}
    </div>
  );
}

function ResultCard({sid, msg, onTweak, onNext, onCopy, onAgain, onMove, onDelete}) {
  const {state, dispatch} = useStore();
  const [more, setMore] = useState(false), closeMore = useCallback(() => setMore(false), []);
  const story = msg.movedTo && state.stories.find(s => s.id === msg.movedTo);
  const noMachine = msg.status === 'queued' && !state.machines.some(m => (m.mode === msg.mode || m.mode === 'both') && m.status !== 'stopping');
  return (
    <div className="result">
      <div className="result-media">
        {msg.status === 'done' ? <video src={`/clips/${msg.clip}.mp4`} controls loop muted playsInline poster={`/clips/${msg.clip}-first.jpg`} />
          : <div className="result-wait">{msg.status === 'queued' ? (noMachine ? <>没有{MODE_NAME[msg.mode]}机器 <button className="small primary" onClick={() => dispatch({type: 'page', page: 'gpu'})}>去开一台</button></> : `排队中 · 第 ${queuePositions(state).msgs[msg.id] || 1} 位`)
            : <><span className="spin" />生成中 {Math.round(msg.progress * 100)}%</>}
            {msg.status === 'queued' && <button className="small ghost" onClick={() => dispatch({type: 'qcCancel', sid, mid: msg.id})}>取消</button>}
            <div className="progress"><i style={{width: `${Math.round((msg.progress || 0) * 100)}%`}} /></div></div>}
      </div>
      <div className="result-body">
        <div className="row tight"><span className={'mode ' + msg.mode.toLowerCase()}>{MODE_NAME[msg.mode]}</span><span className="q">{MODELS[msg.quality].label}</span>
          <span className="muted">{msg.duration} 秒 · 第 {msg.n} 条</span></div>
        <small className="muted clip2">{msg.prompt}</small>
        {msg.controls && changedCount(msg.controls) > 0 && <small className="muted adv-sum">高级：{changedSummary(msg.controls).join(' · ')}</small>}
        {msg.status === 'done' && <div className="row tight">
          <button className="small" onClick={() => onTweak(msg)}><Wand2 size={13} />改一改</button>
          <button className="small" onClick={() => onAgain(msg)}><RefreshCw size={13} />再来一条</button>
          <div className="more-wrap"><button className="small ghost" data-pop={'res-' + msg.id} onClick={() => setMore(!more)}><MoreHorizontal size={14} /></button>
            {more && <Popover owner={'res-' + msg.id} onClose={closeMore}>
              <button onClick={() => { setMore(false); onNext(msg); }}><ArrowRight size={13} />接着拍<small>用最后一帧开头</small></button>
              <button onClick={() => { setMore(false); onCopy(msg); }}><Film size={13} />照这条拍<small>学它的动作和运镜</small></button>
              <button onClick={() => setMore(false)}><Download size={13} />下载</button>
              <hr /><button className="danger-item" onClick={() => { setMore(false); onDelete(msg); }}><Trash2 size={13} />删除这条<small>{msg.movedTo ? '故事里的不受影响' : '可以撤销'}</small></button></Popover>}</div>
          <div className="spacer" />
          {story ? <span className="pill good">已放进「{story.title}」</span> : <button className="small primary" onClick={() => onMove(msg)}><FolderInput size={13} />放进故事</button>}
        </div>}
      </div>
    </div>
  );
}

function MoveDialog({onPick, onClose}) {
  const {state} = useStore();
  const [storyId, setStoryId] = useState(state.stories[0]?.id);
  const story = state.stories.find(s => s.id === storyId);
  const options = story ? story.chapters.flatMap(c => c.scenes.map(sc => ({id: sc.id, label: `${c.title} · ${sc.title}`}))) : [];
  const [scene, setScene] = useState('');
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>放进故事</b><button className="x" onClick={onClose}>×</button></div>
        <p className="muted">这条视频会变成一个新镜头，加在所选场的最后；提示词和模式一起带过去。</p>
        <label className="field"><span>故事</span><select value={storyId} onChange={e => { setStoryId(e.target.value); setScene(''); }}>{state.stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="field"><span>放到哪一场</span><select value={scene || options[0]?.id} onChange={e => setScene(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={onClose}>取消</button>
          <button className="primary" onClick={() => onPick(scene || options[0]?.id, story.title)}>放进去</button></div>
      </div>
    </div>
  );
}

function AttachMenu({onPick, onFiles, onClose}) {
  const {state} = useStore();
  const [q, setQ] = useState(''), [kind, setKind] = useState('all');
  const file = useRef();
  const list = state.assets.filter(a => !a.inbox && !a.derived && (kind === 'all' || a.kind === kind) && (!q || a.name.includes(q))).slice(0, 30);
  return (
    <div className="attach-pop" onClick={e => e.stopPropagation()}>
      <div className="row tight"><input autoFocus placeholder="搜索素材：林岚、站台、雨声…" value={q} onChange={e => setQ(e.target.value)} /><button className="x" onClick={onClose}>×</button></div>
      <div className="row tight"><div className="seg">{[['all', '全部'], ['image', '图片'], ['video', '视频'], ['audio', '声音']].map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
        <div className="spacer" /><button className="small" onClick={() => file.current.click()}><Upload size={13} />从电脑上传</button>
        <input ref={file} type="file" multiple accept="image/*,video/*,audio/*" hidden onChange={async e => { const n = e.target.files.length; onFiles(await readFiles(e.target.files), n); e.target.value = ''; }} /></div>
      <div className="picker-grid">{list.map(a => (
        <button key={a.id} className="tile" onClick={() => onPick(a)} title={a.name}>
          {a.kind === 'audio' ? <div className="tile-audio">♪<small>{a.seconds}s</small></div> : <img src={a.thumb} alt="" />}
          {a.kind === 'video' && <span className="tile-badge">▶ {a.seconds}s</span>}<span className="tile-name">{a.name}</span></button>))}
        {!list.length && <p className="muted">没有找到。可以从电脑上传。</p>}</div>
      <small className="muted">也可以直接把文件拖进输入框，或者复制图片后在输入框里粘贴。</small>
    </div>
  );
}

/* ---------- page ---------- */
export function QuickPage({onToast}) {
  const {state, dispatch, trash, toast} = useStore();
  const ses = state.sessions.find(x => x.id === state.activeSession && !x.trashedAt);
  const live = state.sessions.filter(x => !x.trashedAt), trashed = state.sessions.filter(x => x.trashedAt);
  const closeRow = useCallback(() => setRowMenu(null), []);
  const [listOpen, setListOpen] = useState(false), [agentOpen, setAgentOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState(null), [renaming, setRenaming] = useState(null), [trashView, setTrashView] = useState(false), [purging, setPurging] = useState(null);
  const busyIn = x => x.messages.filter(m => m.role === 'result' && m.status === 'generating').length;
  const trashSession = x => { setRowMenu(null); trash({kind: 'session', id: x.id}, x.title); };
  const deleteMsg = m => { dispatch({type: 'qcHideMsg', sid: ses.id, mid: m.id, hidden: true}); toast(`第 ${m.n} 条已删除`, () => dispatch({type: 'qcHideMsg', sid: ses.id, mid: m.id, hidden: false})); };
  const left = x => daysLeft(x.trashedAt);
  const [text, setText] = useState(''), [atts, setAtts] = useState([]), [assistant, setAssistant] = useState(true);
  const [mode, setMode] = useState('auto'), [quality, setQuality] = useState('draft'), [attachOpen, setAttachOpen] = useState(false);
  const [thinking, setThinking] = useState(false), [moving, setMoving] = useState(null);
  const [adv, setAdv] = useState({}), [advOpen, setAdvOpen] = useState(false), [roles, setRoles] = useState({});
  const [editRole, setEditRole] = useState(null), [aopt, setAopt] = useState({}); // aopt: {id: {sound, range: [start, end]}}
  // Only one 开头 and one 结尾: whoever held it becomes a middle frame.
  const setRole = (id, role) => setRoles(r => {
    const n = {...r, [id]: {role, t: role === 'first' ? 0 : role === 'last' ? dur : (r[id]?.role === 'guide' ? r[id].t : dur / 2)}};
    if (role !== 'guide') Object.keys(n).forEach(k => { if (k !== id && n[k].role === role) n[k] = {role: 'guide', t: dur / 2}; });
    return n;
  });
  const ctl = {...(state.genDefaults || {}), ...adv}, dur = ctl.duration ?? 5;
  const effMode = mode === 'auto' ? (atts.some(a => a.kind !== 'image') ? 'REF' : 'FL') : mode;
  const problems = checkInputs(effMode, atts, roles, aopt, dur);
  useEffect(() => { setRoles(r => autoRoles(atts, dur, r)); }, [atts, dur]);
  const end = useRef(), input = useRef();
  useEffect(() => {
    const ms = ses?.messages || [], last = ms[ms.length - 1];
    const k = last?.role === 'result' && (last.batch || last.id), first = k && ms.findIndex(x => x.role === 'result' && (x.batch || x.id) === k);
    const earlier = k && ms.slice(first, -1).some(x => x.role !== 'result' || (x.batch || x.id) !== k);
    if (earlier) document.getElementById('grp-' + k)?.scrollIntoView({behavior: 'smooth', block: 'center'});
    else end.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
  }, [ses?.messages.length, thinking]);
  const ready = k => state.machines.filter(m => (m.mode === k || m.mode === 'both') && m.status === 'ready').length;

  const ensureSession = () => {
    if (ses) return ses.id;
    dispatch({type: 'qcNew'});
    return null;
  };
  const lastProposal = ses ? [...ses.messages].reverse().find(m => m.role === 'assistant' && m.proposal) : null;
  const lastResult = ses ? [...ses.messages].reverse().find(m => m.role === 'result') : null;
  const nextN = ses ? ses.messages.filter(m => m.role === 'result').length + 1 : 1;

  // Every result records its seed and inputs, so 改一改 can rerun the same recipe with one change.
  // count > 1: one 组 of takes; the first keeps a fixed seed if there is one, the rest each get a new seed.
  const generate = (sid, spec, count = 1, batch = null) => {
    const b = batch || 'b' + Math.random().toString(36).slice(2, 8);
    for (let i = 0; i < count; i++) dispatch({type: 'qcPush', sid, msg: {role: 'result', status: 'queued', progress: 0, clip: null, n: nextN + i, ...spec, batch: b,
      seed: (i === 0 && (spec.controls?.seed || spec.seed)) || String(Math.floor(Math.random() * 1e9))}});
  };
  const [count, setCount] = useState(1);
  const [base, setBase] = useState(null); // {kind: 'tweak'|'next'|'copy', msg}
  // Each conversation keeps its own unsent draft; switching never carries 附件/基于第 N 条 into another one.
  const drafts = useRef({}), shown = useRef(ses?.id);
  useEffect(() => {
    if (shown.current === ses?.id) return;
    if (shown.current) drafts.current[shown.current] = {text, atts, base, adv, roles, aopt, mode};
    const d = drafts.current[ses?.id] || {};
    setText(d.text || ''); setAtts(d.atts || []); setBase(d.base || null); setAdv(d.adv || {}); setRoles(d.roles || {}); setAopt(d.aopt || {}); setMode(d.mode || 'auto');
    setEditRole(null); setAttachOpen(false); shown.current = ses?.id;
  }, [ses?.id]);

  const send = () => {
    const body = text.trim();
    if (!body && !atts.length) return;
    if (!assistant && problems.length) { onToast(problems[0]); return; }
    let sid = ses?.id;
    if (!sid) { onToast('先点左上「新建创作」或选一条记录'); return; }
    dispatch({type: 'qcPush', sid, msg: {role: 'user', text: body, attachments: atts.map(a => a.id), mode: effMode, frames: roles, inputOpts: aopt, base: base && {kind: base.kind, n: base.msg.n, clip: base.msg.clip}}});
    const usedAtts = atts, usedBase = base, usedOpts = aopt;
    setText(''); setAtts([]); setBase(null); setAopt({});
    const usedRoles = roles, usedAdv = adv;
    const tweak = usedBase?.kind === 'tweak' ? usedBase.msg : null;
    if (!assistant) {
      generate(sid, {prompt: tweak ? `${tweak.prompt}，${body}` : body, mode: effMode, quality, duration: dur, controls: usedAdv, frames: usedRoles, refs: usedAtts.map(a => a.id), seed: tweak?.seed, inputOpts: usedOpts}, count);
      return;
    }
    setThinking(true);
    const prev = tweak ? {prompt: tweak.prompt, mode: tweak.mode, quality: tweak.quality, duration: dur, refs: usedAtts.map(a => a.id), frames: usedRoles, controls: usedAdv, v: 0}
      : lastProposal && !lastProposal.used ? lastProposal.proposal : null;
    const baseInfo = usedBase && {kind: usedBase.kind, n: usedBase.msg.n, clip: usedBase.msg.clip};
    const finish = (reply, proposal, via) => {
      Object.assign(proposal, {quality: prev?.quality || quality, base: baseInfo || prev?.base, seed: tweak?.seed ?? prev?.seed});
      if (!prev) Object.assign(proposal, {controls: usedAdv, frames: usedRoles, duration: dur});
      proposal.inputOpts = {...(prev?.inputOpts || {}), ...usedOpts};
      dispatch({type: 'qcPush', sid, msg: {role: 'assistant', text: reply, proposal, via}});
      setThinking(false);
    };
    // Real assistant: Gemini Flash through the local server (key stays server-side). Falls back to the rule stub.
    fetch('/api/assistant', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({
      text: body, mode: prev ? prev.mode : mode,
      attachments: usedAtts.map(a => ({name: a.name, kind: a.kind, thumb: a.thumb, role: effMode === 'FL' ? (usedRoles[a.id]?.role === 'guide' ? `第${usedRoles[a.id].t}秒出现` : usedRoles[a.id]?.role) : 'reference'})),
      previous: prev && {prompt: prev.prompt, mode: prev.mode},
      intent: usedBase?.kind === 'next' ? '接着上一条拍下一个镜头，开头帧是上一条的最后一帧' : usedBase?.kind === 'copy' ? '模仿上一条视频的动作和运镜，换成用户说的人或场景' : undefined,
    })}).then(r => r.json()).then(res => {
      if (res.error) throw new Error(res.error);
      finish(res.reply, {prompt: res.prompt, mode: prev ? prev.mode : mode === 'auto' ? res.mode : mode, refs: [...new Set([...(prev?.refs || []), ...usedAtts.map(a => a.id)])], duration: dur, v: (prev?.v || 0) + 1,
        ...(prev ? {frames: prev.frames, controls: prev.controls} : {})}, res.model);
    }).catch(err => {
      const r = propose(body, usedAtts, prev, mode === 'auto' ? null : mode);
      if (tweak) r.reply = `在第 ${tweak.n} 条的基础上只改了：${body}。其他都不变。`;
      finish(r.reply, r.proposal, null);
      onToast('助手没连上，先用本地规则：' + String(err.message || err).slice(0, 60));
    });
  };
  const onGenerate = (msg, n = 1) => {
    dispatch({type: 'qcPatch', sid: ses.id, mid: msg.id, patch: {used: true}});
    const p = msg.proposal;
    generate(ses.id, {prompt: p.prompt, mode: p.mode, quality: p.quality, duration: p.controls?.duration ?? p.duration, controls: p.controls, frames: p.frames, refs: p.refs, seed: p.seed, inputOpts: p.inputOpts}, n);
  };
  // New files from the computer go into 素材库 too, so they can be reused later.
  const addFiles = (files, raw) => {
    const added = files.map(f => ({...f, id: 'up-' + Math.random().toString(36).slice(2, 8), source: 'quick'}));
    added.forEach(x => dispatch({type: 'addAsset', asset: x}));
    setAtts(x => [...x, ...added]); setAttachOpen(false);
    if (raw !== undefined && added.length < raw) onToast(`${raw - added.length} 个文件不是图片、视频或声音，没有加进来`);
  };
  const [dropHot, setDropHot] = useState(false);
  const derived = asset => { dispatch({type: 'addAsset', asset: {...asset, derived: true}}); return asset; };
  // 改一改: same inputs, mode, settings and seed; only the change you type is added.
  const onTweak = msg => {
    const items = (msg.refs || []).map(id => state.assets.find(a => a.id === id)).filter(Boolean);
    setAtts(items); setRoles(msg.frames || {}); setAopt(msg.inputOpts || {}); setMode(msg.mode); setQuality(msg.quality);
    setAdv(msg.controls || {}); setBase({kind: 'tweak', msg}); setText(''); input.current?.focus();
  };
  // 接着拍: the last frame becomes 1 开头 of a new 首尾帧 shot.
  const onNext = msg => {
    const a = derived({id: 'lf-' + msg.id, kind: 'image', name: `第 ${msg.n} 条 · 最后一帧`, thumb: `/clips/${msg.clip}-last.jpg`});
    setAtts([a]); setRoles({[a.id]: {role: 'first', t: 0}}); setMode('FL'); setAdv({}); setBase({kind: 'next', msg}); setText(''); input.current?.focus();
  };
  // 照这条拍: a 3-second cut of the result becomes the 全能参考 video.
  const onCopy = msg => {
    const a = derived({id: 'cut-' + msg.id, kind: 'video', name: `第 ${msg.n} 条 · 0–3 秒`, thumb: `/clips/${msg.clip}-first.jpg`, seconds: 3});
    setAtts([a]); setMode('REF'); setAdv({}); setBase({kind: 'copy', msg}); setText(''); input.current?.focus();
  };
  const onAgain = msg => { const c = {...(msg.controls || {})}; delete c.seed; generate(ses.id, {prompt: msg.prompt, mode: msg.mode, quality: msg.quality, duration: msg.duration, controls: c, frames: msg.frames, refs: msg.refs, inputOpts: msg.inputOpts}, 1, groupKey(msg)); };
  const roleTag = (m, id) => m.frames?.[id] && (m.frames[id].role === 'first' ? '1 开头' : m.frames[id].role === 'last' ? '2 结尾' : `◆ ${m.frames[id].t}s`);

  return (
    <div className="home quick-shell">
      <AppHeader />
      <div className="qc">
        {listOpen && <div className="qc-scrim" onClick={() => setListOpen(false)} />}
        <aside className={'qc-side' + (listOpen ? ' open' : '')} onClick={e => { if (e.target.closest('.qc-open')) setListOpen(false); }}>
          <button className="primary qc-new" onClick={() => dispatch({type: 'qcNew'})}><Plus size={16} />新建创作</button>
          {!trashView ? <div className="qc-list">{live.map(x => (
            <div key={x.id} className={'qc-row' + (x.id === ses?.id ? ' on' : '') + (rowMenu === x.id ? ' menu-open' : '')}>
              {renaming === x.id ? <input autoFocus className="qc-rename" defaultValue={x.title}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = x.title; e.currentTarget.blur(); } }}
                onBlur={e => { const t = e.currentTarget.value.trim(); if (t) dispatch({type: 'qcRename', id: x.id, title: t}); setRenaming(null); }} />
                : <button className="qc-open" onClick={() => dispatch({type: 'qcOpen', id: x.id})} onDoubleClick={() => setRenaming(x.id)}>
                  <span className="clip">{x.by && <ByAgent by={x.by} short />}{x.title}</span><small>{x.messages.filter(m => m.role === 'result' && !m.hidden).length} 条结果{busyIn(x) ? ' · 生成中' : ''}</small></button>}
              <button className="qc-dots" title="更多" data-pop={'qrow-' + x.id} onClick={() => setRowMenu(rowMenu === x.id ? null : x.id)}><MoreHorizontal size={15} /></button>
              {rowMenu === x.id && <Popover owner={'qrow-' + x.id} className="row-menu" onClose={closeRow}>
                <button onClick={() => { setRowMenu(null); setRenaming(x.id); }}><Pencil size={13} />重命名</button>
                <hr />
                {busyIn(x) ? <button disabled title="生成结束后就能删除"><Trash2 size={13} />移到回收站<small>还在生成，等它结束</small></button>
                  : <button className="danger-item" onClick={() => trashSession(x)}><Trash2 size={13} />移到回收站<small>5 天内可恢复</small></button>}
              </Popover>}
            </div>))}
            {!live.length && <p className="muted qc-none">还没有创作</p>}</div>
          : <div className="qc-list qc-trash">
            <div className="qc-trash-head"><button className="ghost small" onClick={() => { setTrashView(false); setPurging(null); }}><ArrowRight size={13} style={{transform: 'rotate(180deg)'}} />返回</button><b>回收站</b></div>
            <small className="muted">放 5 天后自动永久删除。放进故事的镜头不受影响。</small>
            {trashed.map(x => <div key={x.id} className="qc-row trashed">
              <div className="qc-open"><span className="clip">{x.title}</span><small>{left(x) ? `${left(x)} 天后永久删除` : '今天永久删除'}</small></div>
              <button className="qc-dots" title="恢复" onClick={() => { dispatch({type: 'restore', item: {kind: 'session', id: x.id}}); if (trashed.length === 1) setTrashView(false); }}><RotateCcw size={14} /></button>
              <button className="qc-dots" title="永久删除" onClick={() => setPurging({ids: [x.id], text: `永久删除「${x.title}」？`})}><Trash2 size={14} /></button>
            </div>)}
            {!trashed.length && <p className="muted qc-none">回收站是空的</p>}
            {trashed.length > 1 && <button className="ghost small danger-text" onClick={() => setPurging({ids: trashed.map(x => x.id), text: `清空回收站里的 ${trashed.length} 条创作？`})}>清空回收站</button>}
            {purging && <div className="purge-confirm"><b>{purging.text}</b><small>对话和结果都会删掉，没法恢复。</small>
              <div className="row tight"><button className="small" onClick={() => setPurging(null)}>算了</button>
                <button className="small danger" onClick={() => { dispatch({type: 'purge', items: purging.ids.map(id => ({kind: 'session', id}))}); setPurging(null); if (purging.ids.length === trashed.length) setTrashView(false); }}>永久删除</button></div></div>}
          </div>}
          <button className="ghost small qc-agent keep-label" onClick={() => setAgentOpen(true)} title="把这条快速创作交给 Claude Code、Codex 等 AI 助手"><Bot size={14} />让 AI 助手来做</button>
          <button className="ghost small qc-machines" onClick={() => dispatch({type: 'page', page: 'gpu'})} title="去算力页开关机器">
            <span>可用机器</span><i className={ready('FL') ? 'ok' : ''} />首尾帧 {ready('FL')}<i className={ready('REF') ? 'ok' : ''} />全能参考 {ready('REF')}</button>
          <button className={'ghost small qc-trash-btn' + (trashView ? ' on' : '')} onClick={() => { setTrashView(!trashView); setPurging(null); }}><Trash2 size={13} />回收站{trashed.length ? ` · ${trashed.length}` : ''}</button>
        </aside>
        <main className="qc-main" onDragOver={e => { if (ses && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDropHot(true); } }}
          onDrop={async e => { if (!ses || !e.dataTransfer.files.length) return; e.preventDefault(); setDropHot(false); addFiles(await readFiles(e.dataTransfer.files), e.dataTransfer.files.length); }}>
          <div className="qc-mbar"><button className="ghost small" onClick={() => setListOpen(true)}><Menu size={16} />创作</button>
            <b className="clip">{ses?.title || '快速创作'}</b>
            <button className="ghost small" onClick={() => dispatch({type: 'qcNew'})}><Plus size={16} /></button></div>
          <div className="qc-scroll">
            {!ses || !ses.messages.filter(m => !m.hidden).length ? (
              <div className="qc-empty">
                <h1>想拍什么？</h1>
                <p className="muted">说一句画面就行。助手会先给你一个镜头方案，确认后才开始生成。</p>
                {!ses && <button className="primary" onClick={() => dispatch({type: 'qcNew'})}><Plus size={16} />新建创作</button>}
                {ses && <div className="examples">{EXAMPLES.map(e => <button key={e} onClick={() => { setText(e); input.current?.focus(); }}>{e}</button>)}</div>}
              </div>
            ) : (
              <div className="thread">
                {ses.messages.filter(m => !m.hidden).map(m => m.role === 'user' ? (
                  <div key={m.id} className="msg user"><div className="bubble">{m.base && <small className="base-tag">{m.base.clip && <img src={`/clips/${m.base.clip}-first.jpg`} alt="" />}基于第 {m.base.n} 条</small>}{m.text}
                    {m.attachments?.length > 0 && <div className="refs">{m.attachments.map(id => state.assets.find(a => a.id === id)).filter(Boolean).map(a => <span key={a.id} className="ref">{a.kind === 'audio' ? '♪' : <img src={a.thumb} alt="" />}{a.name}{m.mode === 'FL' && roleTag(m, a.id) && <b className="role-tag">{roleTag(m, a.id)}</b>}</span>)}</div>}</div></div>
                ) : m.role === 'assistant' ? (
                  <div key={m.id} className="msg bot"><span className="bot-ava"><Bot size={16} /></span><div className="bot-body"><p>{m.text}</p>
                    {m.proposal && <ProposalCard sid={ses.id} msg={m} latest={m.id === lastProposal?.id} onGenerate={onGenerate} />}</div></div>
                ) : (
                  (() => {
                    const k = groupKey(m), takes = ses.messages.filter(x => x.role === 'result' && !x.hidden && groupKey(x) === k);
                    if (takes[0]?.id !== m.id) return null; // later takes render inside the first one's group
                    return <div key={m.id} id={'grp-' + k} className="msg res"><BatchCard sid={ses.id} takes={takes} onTweak={onTweak} onNext={onNext} onCopy={onCopy} onAgain={onAgain} onMove={setMoving} onDelete={deleteMsg} /></div>;
                  })()
                ))}
                {thinking && <div className="msg bot"><span className="bot-ava"><Bot size={16} /></span><div className="typing"><i /><i /><i /></div></div>}
                <div ref={end} />
              </div>
            )}
          </div>

          {ses && <div className="composer">
            {base && <div className="base-bar">{base.msg.clip && <img src={`/clips/${base.msg.clip}-first.jpg`} alt="" />}基于第 {base.msg.n} 条{base.kind === 'next' ? ' · 接着拍' : base.kind === 'copy' ? ' · 照这条拍' : ''}
              <button className="x" title="不基于这条了" onClick={() => { setBase(null); setAtts([]); setAdv({}); setMode('auto'); }}><X size={12} /></button></div>}
            {atts.length > 0 && <div className="refs">{(effMode === 'FL' ? orderFL(atts, roles) : atts).map((a, i, arr) => <React.Fragment key={a.id}>
              {effMode === 'FL' && i > 0 && roles[a.id] && roles[arr[i - 1].id] && <ArrowRight size={14} className="fl-arrow" />}
              <Chip a={a} mode={effMode} role={roles[a.id]} dur={dur} opt={aopt[a.id] || {}} editing={editRole}
                setEditing={setEditRole} setRole={k => setRole(a.id, k)} setT={t => setRoles(r => ({...r, [a.id]: {role: 'guide', t}}))}
                setOpt={patch => setAopt(o => ({...o, [a.id]: {...o[a.id], ...patch}}))} onRemove={() => setAtts(atts.filter(x => x.id !== a.id))} />
            </React.Fragment>)}
              {effMode === 'FL' && atts.filter(a => a.kind === 'image').length >= 2 && <button className="ghost small" title="开头和结尾对调" onClick={() => setRoles(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.role === 'first' ? {role: 'last', t: dur} : v.role === 'last' ? {role: 'first', t: 0} : v])))}>⇄ 对调</button>}
            </div>}
            {problems.length > 0 && <div className="problems"><AlertCircle size={13} />{problems.join('；')}</div>}
            <div className={'composer-box' + (dropHot ? ' drop-hot' : '')}
              onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDropHot(true); } }}
              onDragLeave={() => setDropHot(false)}
              onDrop={async e => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setDropHot(false); addFiles(await readFiles(e.dataTransfer.files), e.dataTransfer.files.length); }}
              onPaste={async e => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); addFiles(await readFiles(f), f.length); } }}>
              <button className="ghost round" title="添加图片、视频、声音" onClick={() => setAttachOpen(!attachOpen)}><Paperclip size={18} /></button>
              <textarea ref={input} rows={1} value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={base?.kind === 'tweak' ? '要改哪里？比如：再暗一点，换成近景' : base?.kind === 'next' ? '下一镜发生什么？' : base?.kind === 'copy' ? '换成谁、在哪里？' : assistant ? '说说你想拍什么，助手会先给你一个方案…' : '直接写提示词，发送后马上生成'} />
              <button className="primary round" disabled={!text.trim() && !atts.length} onClick={send} title={assistant ? '发给助手' : '直接生成'}>{assistant ? <Send size={16} /> : <Sparkles size={16} />}</button>
              {attachOpen && <AttachMenu onFiles={(f, n) => addFiles(f, n)} onPick={a => { setAtts(x => (x.some(y => y.id === a.id) ? x : [...x, a])); setAttachOpen(false); }} onClose={() => setAttachOpen(false)} />}
            </div>
            <div className="composer-opts">
              <button className={'assist' + (assistant ? ' on' : '')} onClick={() => setAssistant(!assistant)}>
                <Bot size={14} />助手 {assistant ? '开' : '关'}<small>{assistant ? '先出方案，你点“生成”才开始' : '跳过助手，发送即生成'}</small></button>
              <div className="seg" title="自动：只有图片按首尾帧，放了视频或声音按全能参考">{[['auto', mode === 'auto' && atts.length ? `自动 · ${MODE_NAME[effMode]}` : '自动'], ['FL', '首尾帧'], ['REF', '全能参考']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
              <div className="seg">{['draft', 'final'].map(k => <button key={k} className={quality === k ? 'on' : ''} onClick={() => setQuality(k)}>{MODELS[k].label}</button>)}</div>
              {!assistant && <select className="count-pick" value={count} onChange={e => setCount(+e.target.value)} title="一次出几条">{[1, 2, 3, 4].map(k => <option key={k} value={k}>一次 {k} 条</option>)}</select>}
              <SpecPicker quality={quality} c={ctl} onChange={(k, v) => setAdv(x => { const n = {...x}; if (v === undefined) delete n[k]; else n[k] = v; return n; })} />
              <button className={'ghost adv-btn' + (changedCount(adv) ? ' on' : '')} onClick={() => setAdvOpen(true)} title="H3 全部生成参数">
                <SlidersHorizontal size={13} />高级{changedCount(adv) ? ` · 已改 ${changedCount(adv)}` : ''}</button>
            </div>
          </div>}
        </main>
      </div>
      {advOpen && <AdvancedSheet title="高级参数 · 这次对话" scope="对这个对话里之后的生成生效；全局默认值在「设置 → 生成默认值」。" value={adv} base={state.genDefaults}
        onChange={setAdv} onClose={() => setAdvOpen(false)} actions={[{label: '设为全局默认', done: '以后新的生成都默认用这套', hint: '快速创作和所有故事的默认值',
          run: v => dispatch({type: 'genDefaults', value: {...(state.genDefaults || {}), ...v}})}]} />}
      {agentOpen && <AgentSheet here={ses ? {kind: 'session', id: ses.id} : null} onClose={() => setAgentOpen(false)} />}
      {moving && <MoveDialog onClose={() => setMoving(null)} onPick={(sceneId, title) => { dispatch({type: 'qcToStory', sid: ses.id, mid: moving.id, sceneId}); setMoving(null); onToast(`已放进「${title}」`); }} />}
    </div>
  );
}
