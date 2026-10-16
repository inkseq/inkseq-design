import React, {useEffect, useState} from 'react';
import {Bot, Check, Copy, ExternalLink, Pause, Play, X} from 'lucide-react';
import {useStore} from './store.jsx';

// 让 AI 助手来做：范围 → 能做什么 → 复制一段话给它。连上以后它做的东西会带 🤖 标记，花费有每日上限。
export const SKILL_URL = 'https://inkseq.com/for-agents/SKILL.md';
const PERMS = {
  view: {label: '只看和整理', hint: '读作品、写提示词、整理素材和档案；不生成，不花钱'},
  generate: {label: '创作并生成', hint: '还可以提交生成，花费不超过下面的每日上限'},
};
const money = n => `$${n.toFixed(2)}`;

export function scopeOptions(state, here) {
  const opts = [];
  if (here?.kind === 'session') { const s = state.sessions.find(x => x.id === here.id); if (s) opts.push({kind: 'session', id: s.id, label: `这条快速创作「${s.title}」`}); }
  if (here?.kind === 'story') { const s = state.stories.find(x => x.id === here.id); if (s) opts.push({kind: 'story', id: s.id, label: `这个故事「${s.title}」`}); }
  opts.push({kind: 'all', id: null, label: '我的全部作品'});
  return opts;
}

export function AgentSheet({here, onClose}) {
  const {state, dispatch} = useStore();
  const scopes = scopeOptions(state, here);
  const [scope, setScope] = useState(0), [perm, setPerm] = useState('generate'), [cap, setCap] = useState(5), [copied, setCopied] = useState(false);
  const inv = state.agentInvite;
  const joined = inv && state.agents.find(a => a.invite === inv.code);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = inv ? Math.max(0, Math.round((inv.expires - now) / 1000)) : 0;
  const text = inv && `请用映序（Inkseq）帮我创作视频。
1. 先读说明：${SKILL_URL}
2. 用这个一次性连接码连接我的账号：${inv.code}（${Math.ceil(left / 60)} 分钟内有效）
3. 范围：${inv.scope.label}；权限：${PERMS[inv.perm].label}${inv.perm === 'generate' ? `，每天最多花 ${money(inv.cap)}` : ''}。
4. 做出来的东西留在映序里，做完把链接发给我，我在网页上看结果、挑版本。`;
  const make = () => { setCopied(false); dispatch({type: 'agentInvite', scope: scopes[scope], perm, cap}); };
  const copy = () => { try { navigator.clipboard?.writeText(text); } catch {} setCopied(true); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="agent-sheet" onClick={e => e.stopPropagation()}>
        <div className="row tight"><Bot size={18} /><b>让 AI 助手来做</b><div className="spacer" /><button className="x" onClick={onClose}><X size={16} /></button></div>
        <p className="muted">把一段话发给 Claude Code、Codex 等 AI 助手，它就能用你的账号写提示词、传素材、生成视频。它做的东西会出现在这里，带 🤖 标记，你照常看结果、挑版本。</p>
        {!inv || joined ? <>
          <div className="agent-step"><b>1 · 让它做哪些</b>
            {scopes.map((s, i) => <label key={i} className="check"><input type="radio" checked={scope === i} onChange={() => setScope(i)} />{s.label}</label>)}</div>
          <div className="agent-step"><b>2 · 能做什么</b>
            {Object.entries(PERMS).map(([k, p]) => <label key={k} className="check"><input type="radio" checked={perm === k} onChange={() => setPerm(k)} /><span>{p.label}<small className="muted"> · {p.hint}</small></span></label>)}
            {perm === 'generate' && <label className="agent-cap">每天最多花 <select value={cap} onChange={e => setCap(+e.target.value)}>{[1, 2, 5, 10, 20].map(n => <option key={n} value={n}>${n}</option>)}</select>
              <small className="muted">到了就停下，不会超；你可以随时改</small></label>}</div>
          {joined && <div className="agent-ok"><Check size={14} />{joined.name} 已连接，可以在「设置 → AI 助手」里查看它做了什么。</div>}
          <button className="primary" onClick={make}>生成给 AI 的说明</button>
        </> : <>
          <div className="agent-step"><b>3 · 把这段话发给你的 AI 助手</b>
            <pre className="agent-text">{text}</pre>
            <div className="row tight"><button className="primary" onClick={copy}>{copied ? <><Check size={14} />已复制</> : <><Copy size={14} />复制</>}</button>
              <a className="small ghost-link" href={SKILL_URL} target="_blank" rel="noreferrer"><ExternalLink size={13} />它会读的说明</a>
              <div className="spacer" /><small className="muted">{left ? `连接码 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} 后失效` : '已失效，重新生成一个'}</small></div></div>
          <div className="agent-wait"><span className="spin" />等它连接…<small className="muted">连上后这里会变成「已连接」。连接码只能用一次。</small>
            <button className="small" onClick={() => dispatch({type: 'agentConnect', name: 'Codex', device: 'SuperDanPC'})}>原型：模拟它连上了</button></div>
          <button className="ghost small" onClick={() => dispatch({type: 'agentInvite', cancel: true})}>取消，换个设置</button>
        </>}
      </div>
    </div>
  );
}

// 设置 → AI 助手
export function AgentSettings() {
  const {state, dispatch} = useStore();
  const [open, setOpen] = useState(false);
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : `${Math.round(m / 60)} 小时前`; };
  return <>
    <h2>AI 助手</h2>
    <p className="muted">连上的助手能做的事和你在网页上一样，但只在你给的范围和每日上限里。它做的东西带 🤖 标记；不想用了随时暂停或作废，已经做好的作品都保留。</p>
    <button className="primary" onClick={() => setOpen(true)}><Bot size={15} />连接一个 AI 助手</button>
    <div className="agent-list">{state.agents.map(a => (
      <div key={a.id} className={'card-box agent-card' + (a.paused ? ' paused' : '')}>
        <div className="row tight"><Bot size={18} /><b>{a.name}</b><small className="muted">· {a.device} · 连接于 {ago(a.connectedAt)}</small><div className="spacer" />
          {a.paused ? <span className="pill">已暂停</span> : <span className="pill good">可用</span>}</div>
        <small className="muted">范围：{a.scope.label} · {PERMS[a.perm].label}</small>
        {a.perm === 'generate' && <div className="agent-spend"><span>今天已花 {money(a.spent)} / {money(a.cap)}</span><i><b style={{width: `${Math.min(100, a.spent / a.cap * 100)}%`}} /></i></div>}
        <div className="agent-log">{a.log.slice(-4).reverse().map((l, i) => <div key={i}><small className="muted">{ago(l.at)}</small> {l.text}</div>)}
          {!a.log.length && <small className="muted">还没做任何事。</small>}</div>
        <div className="row tight">
          {!a.paused && <button className="small" onClick={() => dispatch({type: 'agentDemo', id: a.id})}>原型：模拟它做一次</button>}
          <div className="spacer" />
          <button className="small ghost" onClick={() => dispatch({type: 'agentPause', id: a.id})}>{a.paused ? <><Play size={13} />恢复</> : <><Pause size={13} />暂停</>}</button>
          <button className="small danger" onClick={() => dispatch({type: 'agentRevoke', id: a.id})}>作废</button></div>
      </div>))}
      {!state.agents.length && <p className="muted">还没有连接的助手。</p>}</div>
    <div className="card-box"><h4>它能做什么</h4>
      <p className="muted">和网页上的功能一一对应，说明都在 <a href={SKILL_URL} target="_blank" rel="noreferrer">SKILL.md</a>：</p>
      <ul className="agent-caps">
        <li>快速创作：开一条创作、写提示词、加参考素材，按方案一次生成多条（同一组，换种子）</li>
        <li>挑结果：列出一组里的每一条和它用的设置；收藏、放进故事（带上整套设置）</li>
        <li>故事：建章、场、镜头，绑定人物/场景/道具和造型，批量生成，选定使用的版本</li>
        <li>素材库：上传、改名、打标签、查「用在哪里」，归入档案</li>
        <li>生成前先问价和排队位置；超出每日上限会被拒绝，不会偷偷多花</li>
        <li>删除只进回收站，你可以恢复</li>
      </ul></div>
    {open && <AgentSheet here={null} onClose={() => setOpen(false)} />}
  </>;
}

export const ByAgent = ({by, short}) => {
  const {state} = useStore();
  if (!by) return null;
  const a = state.agents.find(x => x.id === by);
  return <span className="by-agent" title={`由 ${a?.name || 'AI 助手'} 做的`}><Bot size={11} />{short ? '' : (a?.name || 'AI')}</span>;
};
