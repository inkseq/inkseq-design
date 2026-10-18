import React, {useCallback, useEffect, useState} from 'react';
import {Popover} from './ui.jsx';
import {chosenVersion} from './model.js';
import {useStore} from './store.jsx';
import {AppHeader} from './pages.jsx';
import {Bot, Check, Clapperboard, LayoutGrid, ArrowRight, MessageSquare, MoreHorizontal, Pencil, Plus, Sparkles, Trash2} from 'lucide-react';
import {AgentSheet} from './agent.jsx';
import {AssistantHint} from './account.jsx';
import {running} from './trash.js';

const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`;
};
const SAMPLE_SCRIPT = `第一章 明天的信
场 1 · 售票厅
深夜，林岚推开停运车站的大门。
售票厅柜台上放着一封信。
林岚拆开信，神情从疑惑变成震惊。
场 2 · 失物间
旧录音机自己开始播放。
身后有人叫她的名字，林岚回头。`;

// 交给 AI (prototype): in production POST /v1/story-imports runs an LLM plan → creates the storyboard through
// the same public API an external Agent uses → returns the project to open. Here a local splitter stands in.
function aiScript(text) {
  const paras = text.split(/\n\s*\n|\r?\n/).map(x => x.trim()).filter(Boolean);
  const out = [];
  paras.forEach((p, i) => {
    if (i % 3 === 0) out.push(`第${'一二三四五六七八九十'[Math.floor(i / 3)] || Math.floor(i / 3) + 1}章`);
    const lines = p.split(/(?<=[。！？!?.])\s*/).map(x => x.trim()).filter(x => x.length > 1);
    out.push(`场 ${i + 1} · ${(lines[0] || p).replace(/[，。！？,.!?].*$/, '').slice(0, 10)}`);
    lines.slice(0, 6).forEach(l => out.push(l));
  });
  return out.join('\n');
}
const STEPS = ['读懂故事', '拆成章节和场景', '找出人物、地点和道具', '写每个镜头的画面', '建好故事板'];
const SAMPLE_STORY = `深夜，林岚推开停运车站的大门。售票厅里只亮着一盏灯，柜台上放着一封写着她名字的信。

她拆开信，信上的日期是明天。落款是她自己。

失物间里的旧录音机突然开始播放，是她小时候的声音。身后有人叫她的名字，林岚回头。

站台上，最后一班车亮着灯缓缓进站。车门打开，里面坐着十年前的自己。`;

function NewStory({onClose, start = 'ai'}) {
  const {dispatch} = useStore();
  const [mode, setMode] = useState(start);
  const [title, setTitle] = useState(''), [logline, setLogline] = useState(''), [aspect, setAspect] = useState('9:16'),
    [style, setStyle] = useState(''), [script, setScript] = useState(''), [story, setStory] = useState('');
  const [step, setStep] = useState(-1), [agent, setAgent] = useState(false);
  const own = [['logline', '从一句话开始', '自动建好第一章和 4 个空镜头'], ['script', '导入剧本', '按“章 / 场 / 每行一个镜头”拆好'], ['blank', '空白故事', '什么都不建，自己从头搭']];
  const create = () => dispatch({type: 'newStory', mode, title: title || '未命名故事', logline, aspect, style, script});
  // Simulated import progress; the real one streams GET /v1/story-imports/{id} step by step.
  useEffect(() => {
    if (step < 0) return;
    if (step >= STEPS.length) { const t = setTimeout(() => dispatch({type: 'newStory', mode: 'script', title: title || 'AI 建的故事', aspect, style, script: aiScript(story)}), 700); return () => clearTimeout(t); }
    const t = setTimeout(() => setStep(step + 1), 650);
    return () => clearTimeout(t);
  }, [step]); // eslint-disable-line
  if (agent) return <AgentSheet here={null} onClose={onClose} />;
  if (step >= 0) return (
    <div className="choose-overlay"><div className="choose newstory">
      <div className="picker-head"><b><Sparkles size={16} /> AI 正在建故事板</b></div>
      <div className="import-steps">{STEPS.map((l, i) => <div key={l} className={i < step ? 'done' : i === step ? 'now' : ''}>
        {i < step ? <Check size={14} /> : i === step ? <span className="spin" /> : <i />}{l}</div>)}</div>
      <small className="muted">{step >= STEPS.length ? '好了，正在打开…' : '一般 20–60 秒。只建故事板，不会生成视频，不花积分。'}</small>
    </div></div>);
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose newstory" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>新建故事</b><button className="x" onClick={onClose}>×</button></div>
        <div className="modes ai-first">
          <button className={'ai-mode' + (mode === 'ai' ? ' on' : '')} onClick={() => setMode('ai')}><em className="rec">推荐</em><Sparkles size={18} />
            <b>交给 AI</b><small>贴一篇完整的故事、小说片段或一段想法。AI 拆好章节、人物、地点和每个镜头，建好故事板直接带你进去。</small></button>
          <button className={'ai-mode' + (mode === 'own' ? ' on' : '')} onClick={() => setMode('own')}><Bot size={18} />
            <b>用我自己的 AI</b><small>Claude、Codex、ChatGPT 等助手连上你的账号，帮你写、帮你生成，你在网页上挑结果。</small></button>
        </div>
        <div className="modes-sub"><small className="muted">或者自己来</small>
          <div className="modes">{own.map(([k, l, d]) => (
            <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><b>{l}</b><small>{d}</small></button>))}</div></div>
        {mode === 'own' ? <>
          <p className="muted">会生成一段话，发给你的 AI 助手就能连上。它能做的事和你在网页上一样，花费有每日上限，随时可以暂停或作废。</p>
          <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={onClose}>取消</button>
            <button className="primary" onClick={() => setAgent(true)}><Bot size={15} />连接我的 AI</button></div>
        </> : <>
          <label className="field"><span>故事名{mode === 'ai' && <small className="muted"> （可留空，AI 会起一个）</small>}</span><input autoFocus={mode !== 'ai'} value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：最后一班来信" /></label>
          {mode === 'ai' && <label className="field"><span>你的故事</span>
            <textarea rows={9} autoFocus value={story} onChange={e => setStory(e.target.value)} placeholder="把整篇故事贴进来，或者写几句你想拍什么。越具体，镜头越准。" />
            <div className="row tight"><button className="small ghost" onClick={() => setStory(SAMPLE_STORY)}>填入示例故事</button><div className="spacer" />
              <small className="muted">{story.length.toLocaleString()} / 50,000 字</small></div></label>}
          {mode === 'logline' && <label className="field"><span>一句话故事</span>
            <textarea rows={2} value={logline} onChange={e => setLogline(e.target.value)} placeholder="谁想要什么，遇到了什么阻碍？" /></label>}
          {mode === 'script' && <label className="field"><span>剧本 · 「第…章」开新章，「场…」开新场，其余每行一个镜头</span>
            <textarea rows={9} value={script} onChange={e => setScript(e.target.value)} placeholder={SAMPLE_SCRIPT} />
            <button className="small ghost" style={{alignSelf: 'flex-start'}} onClick={() => setScript(SAMPLE_SCRIPT)}>填入示例剧本</button></label>}
          {mode !== 'blank' && <div className="row">
            <label className="field small"><span>画幅</span>
              <div className="seg">{['9:16', '16:9', '1:1'].map(x => <button key={x} className={aspect === x ? 'on' : ''} onClick={() => setAspect(x)}>{x}</button>)}</div></label>
            <label className="field small" style={{flex: 2}}><span>全片风格（可留空）</span>
              <input value={style} onChange={e => setStyle(e.target.value)} placeholder="例如：电影感，冷色调" /></label>
          </div>}
          <div className="row tight" style={{justifyContent: 'flex-end'}}>
            <button onClick={onClose}>取消</button>
            {mode === 'ai' ? <button className="primary" disabled={story.trim().length < 10} onClick={() => setStep(0)}><Sparkles size={15} />让 AI 建故事板</button>
              : <button className="primary" disabled={mode === 'script' && !script.trim()} onClick={create}>创建并打开</button>}
          </div>
        </>}
      </div>
    </div>
  );
}

function MoveToStory({qc, onClose, onDone}) {
  const {state, dispatch} = useStore();
  const [storyId, setStoryId] = useState(state.stories[0]?.id);
  const story = state.stories.find(s => s.id === storyId);
  const [target, setTarget] = useState('');
  const options = story ? story.chapters.flatMap(c => c.scenes.map(sc => ({id: sc.id, label: `${c.title} · ${sc.title}`}))) : [];
  const sceneId = target || options[0]?.id;
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>放进故事</b><button className="x" onClick={onClose}>×</button></div>
        <p className="muted">「{qc.title}」会成为一个新镜头，这条视频作为它的第一个版本，提示词一起带过去。</p>
        <label className="field"><span>故事</span>
          <select value={storyId} onChange={e => { setStoryId(e.target.value); setTarget(''); }}>{state.stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="field"><span>放到哪一场</span>
          <select value={sceneId} onChange={e => setTarget(e.target.value)}>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        <div className="row tight" style={{justifyContent: 'flex-end'}}>
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={() => { dispatch({type: 'quickToStory', qc: qc.id, sceneId}); onDone(`已放进「${story.title}」`); onClose(); }}>放进去</button>
        </div>
      </div>
    </div>
  );
}

export function Home({onToast}) {
  const {state, dispatch, trash} = useStore();
  const [q, setQ] = useState(''), [creating, setCreating] = useState(false), [menu, setMenu] = useState(null), [renaming, setRenaming] = useState(null);
  const [startMode, setStartMode] = useState('ai');
  const closeMenu = useCallback(() => setMenu(null), []);
  const stories = state.stories.filter(s => !q || (s.title + s.settings.logline).includes(q));
  return (
    <div className="home">
      <AppHeader />
      <main className="home-main">
        <div className="home-head">
          <h1 className="page-title"><LayoutGrid size={20} />我的故事 <small>{state.stories.length}</small></h1>
          <input className="lib-search" placeholder="搜索故事…" value={q} onChange={e => setQ(e.target.value)} />
          <button onClick={() => dispatch({type: 'qcNew'})}><MessageSquare size={16} />快速创作</button>
          <button className="primary" onClick={() => { setStartMode('ai'); setCreating(true); }}><Plus size={16} />新建故事</button>
        </div>
        <AssistantHint onStart={() => { setStartMode('ai'); setCreating(true); }} />
        <div className="story-grid">
          {stories.map(s => {
            const shots = state.shots.filter(x => x.storyId === s.id);
            const cover = shots.map(chosenVersion).find(Boolean);
            const Card = renaming === s.id ? 'div' : 'button', busy = running(state, {kind: 'story', id: s.id});
            return (
              <div key={s.id} className={'story-wrap' + (menu === s.id ? ' menu-open' : '')}>
              <Card className="story-card" onClick={() => renaming !== s.id && dispatch({type: 'openStory', id: s.id})}>
                <div className="cover">
                  {cover ? <img src={`/clips/${cover.clip}-first.jpg`} alt="" /> : <span className="cover-empty"><Clapperboard size={30} /></span>}
                  <em className={'badge ' + (s.local ? 'local' : 'cloud')}>{s.local ? '本机' : '云端'}</em>
                  <em className="aspect">{s.settings.aspect}</em>
                </div>
                {renaming === s.id ? <input autoFocus className="card-rename" defaultValue={s.title}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = s.title; e.currentTarget.blur(); } }}
                  onBlur={e => { const t = e.currentTarget.value.trim(); if (t) dispatch({type: 'renameStory', id: s.id, title: t}); setRenaming(null); }} /> : <b>{s.title}</b>}
                <small className="clip">{s.settings.logline || '还没写一句话故事'}</small>
                <small className="muted">{s.chapters.length} 章 · {shots.length} 镜 · 已选定 {shots.filter(x => x.chosen).length}/{shots.length} · {ago(s.updatedAt)}</small>
              </Card>
              <button className="card-dots" title="更多" data-pop={'story-' + s.id} onClick={() => setMenu(menu === s.id ? null : s.id)}><MoreHorizontal size={16} /></button>
              {menu === s.id && <Popover owner={'story-' + s.id} className="card-menu" onClose={closeMenu}>
                <button onClick={() => { setMenu(null); setRenaming(s.id); }}><Pencil size={13} />重命名</button>
                <hr />
                <button className="danger-item" disabled={busy > 0} onClick={() => { setMenu(null); trash({kind: 'story', id: s.id}, s.title); }}><Trash2 size={13} />移到回收站
                  <small>{busy ? `${busy} 个镜头还在生成` : '5 天内可恢复'}</small></button></Popover>}
              </div>);
          })}
          <button className="story-card new" onClick={() => { setStartMode('ai'); setCreating(true); }}><span><Plus size={40} strokeWidth={1.5} /></span><b>新建故事</b><small>交给 AI，或从一句话、剧本、空白开始</small></button>
        </div>
        <div className="home-foot"><button className="ghost small" onClick={() => dispatch({type: 'page', page: 'trash'})}><Trash2 size={13} />回收站</button></div>
      </main>
      {creating && <NewStory start={startMode} onClose={() => setCreating(false)} />}
    </div>
  );
}

