import React, {useCallback, useState} from 'react';
import {Popover} from './ui.jsx';
import {chosenVersion} from './model.js';
import {useStore} from './store.jsx';
import {AppHeader} from './pages.jsx';
import {ArrowRight, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2} from 'lucide-react';
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

function NewStory({onClose}) {
  const {dispatch} = useStore();
  const [mode, setMode] = useState('logline');
  const [title, setTitle] = useState(''), [logline, setLogline] = useState(''), [aspect, setAspect] = useState('9:16'),
    [style, setStyle] = useState(''), [script, setScript] = useState('');
  const modes = [['logline', '从一句话开始', '写一句故事，自动建好第一章和 4 个空镜头'],
    ['script', '导入剧本', '粘贴剧本，按“章 / 场 / 每行一个镜头”自动拆好'], ['blank', '空白故事', '什么都不建，自己从头搭']];
  const create = () => dispatch({type: 'newStory', mode, title: title || '未命名故事', logline, aspect, style, script});
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose newstory" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>新建故事</b><button className="x" onClick={onClose}>×</button></div>
        <div className="modes">{modes.map(([k, l, d]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}><b>{l}</b><small>{d}</small></button>))}</div>
        <label className="field"><span>故事名</span><input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：最后一班来信" /></label>
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
          <button className="primary" disabled={mode === 'script' && !script.trim()} onClick={create}>创建并打开</button>
        </div>
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
  const closeMenu = useCallback(() => setMenu(null), []);
  const stories = state.stories.filter(s => !q || (s.title + s.settings.logline).includes(q));
  return (
    <div className="home">
      <AppHeader />
      <main className="home-main">
        <div className="home-head">
          <h1 className="page-title">我的故事 <small>{state.stories.length}</small></h1>
          <input className="lib-search" placeholder="搜索故事…" value={q} onChange={e => setQ(e.target.value)} />
          <button onClick={() => dispatch({type: 'qcNew'})}><MessageSquare size={16} />快速创作</button>
          <button className="primary" onClick={() => setCreating(true)}><Plus size={16} />新建故事</button>
        </div>
        <div className="story-grid">
          {stories.map(s => {
            const shots = state.shots.filter(x => x.storyId === s.id);
            const cover = shots.map(chosenVersion).find(Boolean);
            const Card = renaming === s.id ? 'div' : 'button', busy = running(state, {kind: 'story', id: s.id});
            return (
              <div key={s.id} className={'story-wrap' + (menu === s.id ? ' menu-open' : '')}>
              <Card className="story-card" onClick={() => renaming !== s.id && dispatch({type: 'openStory', id: s.id})}>
                <div className="cover">
                  {cover ? <img src={`/clips/${cover.clip}-first.jpg`} alt="" /> : <span>{s.title.slice(0, 1)}</span>}
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
          <button className="story-card new" onClick={() => setCreating(true)}><span><Plus size={40} strokeWidth={1.5} /></span><b>新建故事</b><small>从一句话、剧本或空白开始</small></button>
        </div>
        <div className="home-foot"><button className="ghost small" onClick={() => dispatch({type: 'page', page: 'trash'})}><Trash2 size={13} />回收站</button></div>
      </main>
      {creating && <NewStory onClose={() => setCreating(false)} />}
    </div>
  );
}

