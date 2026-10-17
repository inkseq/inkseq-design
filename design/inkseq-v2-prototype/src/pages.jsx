import React, {useEffect, useState} from 'react';
import {Bot, Trash2, Cpu, LayoutGrid, MessageSquare, Images, Settings2, KeyRound, LogOut, Play, Plus, Power, ShieldCheck, SlidersHorizontal, Square, Timer, UserRound, Wallet} from 'lucide-react';
import {AdvancedSheet, changedSummary} from './advanced.jsx';
import {MODELS} from './model.js';
import {queuePositions, useStore} from './store.jsx';
import {trashItems} from './trash.js';
import {AgentSettings} from './agent.jsx';
import {getLang, onLang, setLang} from './i18n.js';

// 中 / EN switch (English is the default).
export function LangToggle() {
  const [l, setL] = useState(getLang());
  useEffect(() => onLang(setL), []);
  return <button className="ghost lang-toggle keep-label" data-no-i18n title={l === 'en' ? '切换到中文' : 'Switch to English'} onClick={() => setLang(l === 'en' ? 'zh' : 'en')}>{l === 'en' ? '中文' : 'EN'}</button>;
}

/* ---------- shared header for 作品 / 算力 / 设置 ---------- */
export function AppHeader() {
  const {state, raw, dispatch} = useStore();
  const page = state.page === 'story' ? 'home' : state.page;
  const binned = trashItems(raw).length;
  const busy = state.machines.filter(m => m.status !== 'ended').length;
  return (
    <header className="hbar">
      <b className="logo">映序</b>
      <nav>
        <button className={page === 'home' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'home'})}><LayoutGrid className="nav-ico" size={20} /><span>作品</span></button>
        <button className={page === 'quick' ? 'on' : ''} onClick={() => state.sessions.some(x => x.id === state.activeSession && !x.trashedAt) ? dispatch({type: 'page', page: 'quick'}) : state.sessions.find(x => !x.trashedAt) ? dispatch({type: 'qcOpen', id: state.sessions.find(x => !x.trashedAt).id}) : dispatch({type: 'qcNew'})}><MessageSquare className="nav-ico" size={20} /><span>快速创作</span></button>
        <button className={page === 'library' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'library'})}><Images className="nav-ico" size={20} /><span>素材库</span></button>
        <button className={page === 'gpu' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'gpu'})}><Cpu className="nav-ico" size={20} /><span>算力</span>{busy > 0 && <em className="navdot">{busy}</em>}</button>
        <button className={page === 'settings' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'settings'})}><Settings2 className="nav-ico" size={20} /><span>设置</span></button>
      </nav>
      <div className="spacer" />
      <LangToggle />
      <button className={'ghost hbar-trash' + (page === 'trash' ? ' on' : '')} title="回收站" onClick={() => dispatch({type: 'page', page: 'trash'})}><Trash2 size={15} />{binned > 0 && <em>{binned}</em>}</button>
      <span className="avatar" title="superdan">S</span>
    </header>
  );
}

/* ---------- 设置 ---------- */
export function SettingsPage({onToast}) {
  const {state, dispatch} = useStore();
  const [tab, setTab] = useState('account'), [newToken, setNewToken] = useState(null), [name, setName] = useState('');
  const ago = t => (t ? `${Math.max(1, Math.round((Date.now() - t) / 3600e3))} 小时前` : '还没用过');
  const [advOpen, setAdvOpen] = useState(false), gd = state.genDefaults || {};
  const tabs = [['account', '账号', UserRound], ['gen', '生成默认值', SlidersHorizontal], ['agent', 'AI 助手', Bot], ['budget', '我的额度', Wallet], ['admin', '管理员', ShieldCheck]];
  return (
    <div className="home">
      <AppHeader />
      <main className="home-main settings-page">
        <aside className="snav">{tabs.map(([k, l, I]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><I size={16} />{l}</button>)}</aside>
        <section className="spanel">
          {tab === 'account' && <>
            <h2>账号</h2>
            <div className="card-box"><div className="row tight"><span className="avatar big">S</span><div><b>superdan</b><small className="muted"> · 管理员</small><br /><small className="muted">用户名登录 · 内测账号</small></div></div></div>
            <div className="card-box"><h4>修改密码</h4>
              <label className="field"><span>当前密码</span><input type="password" autoComplete="off" /></label>
              <label className="field"><span>新密码</span><input type="password" autoComplete="off" /></label>
              <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={() => onToast('原型：不会真的修改密码')}>保存</button></div></div>
            <button className="ghost danger" onClick={() => onToast('原型：不会真的退出')}><LogOut size={15} />退出登录</button>
          </>}
          {tab === 'gen' && <>
            <h2>生成默认值</h2>
            <p className="muted">每次生成默认用的参数，对快速创作和故事里的镜头都生效。平时不用管；想精细控制时，H3 的每个参数都在这里。单次生成还可以在「高级」里临时改。</p>
            <div className="card-box"><div className="row tight"><SlidersHorizontal size={18} /><div><b>H3 全部参数</b><br />
              <small className="muted">{changedSummary(gd).length ? '已改：' + changedSummary(gd).join(' · ') : '全部使用推荐值'}</small></div><div className="spacer" />
              <button className="primary" onClick={() => setAdvOpen(true)}>打开高级参数</button></div></div>
            {advOpen && <AdvancedSheet title="生成默认值（全局）" scope="对你之后的所有生成生效。" value={gd} onChange={x => dispatch({type: 'genDefaults', value: x})} onClose={() => setAdvOpen(false)} />}
          </>}
          {tab === 'agent' && <AgentSettings />}
          {tab === 'budget' && <LimitsPanel />}
          {tab === 'admin' && <AdminLimits />}
        </section>
      </main>
    </div>
  );
}

// A number field that saves on change; every limit in the app is edited through one of these.
function LimitField({label, hint, k, unit = '$', step = 1, min = 0, options}) {
  const {state, dispatch} = useStore();
  const v = state.limits[k];
  return <label className="limit-row"><div><b>{label}</b>{hint && <small className="muted">{hint}</small>}</div>
    {options ? <select value={v} onChange={e => dispatch({type: 'limits', patch: {[k]: +e.target.value}})}>{options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select>
      : <span className="limit-input">{unit === '$' && '$'}<input type="number" min={min} step={step} value={v} onChange={e => dispatch({type: 'limits', patch: {[k]: Math.max(min, +e.target.value || 0)}})} />{unit !== '$' && unit}</span>}</label>;
}

function LimitsPanel() {
  const {state} = useStore();
  const L = state.limits, pct = L.daily ? Math.min(100, state.spentToday / L.daily * 100) : 0;
  return <>
    <h2>我的额度</h2>
    <p className="muted">这些都由你自己定，随时可以改。到了上限，新的生成会先停下来问你，正在跑的不受影响。</p>
    <div className="card-box"><div className="agent-spend"><span>今天已花 ${state.spentToday.toFixed(2)}{L.daily ? ` / $${L.daily}` : '（不限）'}</span><i><b style={{width: pct + '%'}} /></i></div></div>
    <div className="card-box limits">
      <LimitField label="每天最多花" hint="所有生成加起来，按悉尼时间每天清零；0 = 不限" k="daily" />
      <LimitField label="单次超过多少先问我" hint="一次提交（比如批量 8 个镜头各 4 条）预计超过这个数，会先弹出确认" k="confirmAbove" step={0.5} />
    </div>
    <p className="muted">AI 助手的每日上限在「AI 助手」里，每个助手单独设。</p>
  </>;
}

function AdminLimits() {
  return <>
    <h2>管理员</h2>
    <p className="muted">只有管理员能看到这一页。这里的数都是默认值，改了立刻生效；不会有写死在后台、没地方改的限制。</p>
    <div className="card-box limits"><h4>测试机（开发和验收用）</h4>
      <LimitField label="测试机每天最多花" hint="主要防止忘记关机；到了自动停掉测试机并通知" k="testDaily" />
      <LimitField label="单台每小时最高价" hint="租机时超过这个价的报价不考虑" k="maxHourly" step={0.1} />
      <LimitField label="空闲多久自动关机" k="idleStopMin" unit=" 分钟" options={[[5, '5 分钟'], [10, '10 分钟'], [20, '20 分钟'], [30, '30 分钟'], [60, '1 小时']]} />
      <LimitField label="测试机最长运行" hint="超过就自动关机，防止忘了" k="maxRunHours" unit=" 小时" options={[[1, '1 小时'], [2, '2 小时'], [4, '4 小时'], [8, '8 小时']]} />
    </div>
    {[['后台批量取消任务，并告诉 Agent 原因', '#176'], ['机器排行和黑白名单', '#177']].map(([t, n]) => (
      <div key={n} className="card-box soon"><ShieldCheck size={20} /><div><b>{t}</b><small className="muted">见算力页 · {n}</small></div></div>))}
  </>;
}
