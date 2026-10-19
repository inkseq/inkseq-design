import React, {useEffect, useState} from 'react';
import {Bot, Coins, Globe, Trash2, Cpu, LayoutGrid, MessageSquare, Images, Settings2, KeyRound, LogOut, Play, Plus, Power, ShieldCheck, SlidersHorizontal, Square, Timer, UserRound, Wallet} from 'lucide-react';
import {AdminPanel, CreditsChip, CreditsPanel, LinkedLogins} from './account.jsx';
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
  // Same control as inkseq.tv: globe + the CURRENT language; one click switches.
  return <button className="lang-toggle keep-label" data-no-i18n title={l === 'en' ? 'Language: English · 切换到中文' : '语言：中文 · Switch to English'} aria-label={l === 'en' ? 'Language: English' : '语言：中文'}
    onClick={() => setLang(l === 'en' ? 'zh' : 'en')}><Globe size={14} />{l === 'en' ? 'EN' : '中'}</button>;
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
        {state.role === 'admin' && <button className={page === 'gpu' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'gpu'})}><Cpu className="nav-ico" size={20} /><span>算力</span>{busy > 0 && <em className="navdot">{busy}</em>}</button>}
        <button className={page === 'settings' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'settings'})}><Settings2 className="nav-ico" size={20} /><span>设置</span></button>
      </nav>
      <div className="spacer" />
      <CreditsChip />
      <LangToggle />
      <button className={'ghost hbar-trash' + (page === 'trash' ? ' on' : '')} title="回收站" onClick={() => dispatch({type: 'page', page: 'trash'})}><Trash2 size={15} />{binned > 0 && <em>{binned}</em>}</button>
      <span className="avatar" title={state.role === 'admin' ? 'superdan · 管理员' : 'Mia Chen'}>{state.role === 'admin' ? 'S' : 'M'}</span>
    </header>
  );
}

/* ---------- 设置 ---------- */
export function SettingsPage({onToast}) {
  const {state, dispatch} = useStore();
  const [tab0, setTab] = useState('account'), [newToken, setNewToken] = useState(null), [name, setName] = useState('');
  const admin = state.role === 'admin';
  // 顶栏积分 / 积分不够 jump straight to a tab.
  useEffect(() => { if (state.settingsTab) { setTab(state.settingsTab); dispatch({type: 'settingsTab', tab: null}); } }, [state.settingsTab]); // eslint-disable-line
  const tab = tab0 === 'admin' && !admin ? 'account' : tab0;
  const ago = t => (t ? `${Math.max(1, Math.round((Date.now() - t) / 3600e3))} 小时前` : '还没用过');
  const [advOpen, setAdvOpen] = useState(false), gd = state.genDefaults || {};
  const tabs = [['account', '账号', UserRound], ['credits', '我的积分', Coins], ['gen', '生成默认值', SlidersHorizontal], ['agent', 'AI 助手', Bot], ...(admin ? [['admin', '管理员', ShieldCheck]] : [])];
  return (
    <div className="home">
      <AppHeader />
      <main className="home-main settings-page">
        <aside className="snav">{tabs.map(([k, l, I]) => <button key={k} className={'keep-label' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><I size={16} />{l}</button>)}</aside>
        <section className="spanel">
          {tab === 'account' && <>
            <h2>账号</h2>
            <div className="card-box"><div className="row tight"><span className="avatar big">{admin ? 'S' : 'M'}</span><div><b>{admin ? 'superdan' : 'Mia Chen'}</b><small className="muted"> · {admin ? '管理员' : '普通用户'}</small><br /><small className="muted">{admin ? 'dan@inkseq.com' : 'mia.c@gmail.com'}</small></div></div>
              <label className="field"><span>显示名字</span><input defaultValue={admin ? 'superdan' : 'Mia Chen'} /></label></div>
            <LinkedLogins />
            <button className="ghost danger" onClick={() => dispatch({type: 'role', role: 'guest'})}><LogOut size={15} />退出登录</button>
            <small className="muted">注销账号：作品和积分记录保留 30 天后删除，期间可以撤回。<button className="linkish" onClick={() => onToast('原型：会先发确认邮件')}>申请注销</button></small>
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
          {tab === 'credits' && <CreditsPanel LimitField={LimitField} />}
          {tab === 'admin' && admin && <AdminPanel testMachines={<AdminLimits />} />}
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

function AdminLimits() {
  return <>
    <p className="muted">这里的数都是默认值，改了立刻生效；不会有写死在后台、没地方改的限制。机器由系统按排队自动开关，普通用户不能开机。</p>
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
