import React, {useState} from 'react';
import {Bot, Trash2, Cpu, KeyRound, LogOut, Play, Plus, Power, ShieldCheck, SlidersHorizontal, Square, Timer, UserRound, Wallet} from 'lucide-react';
import {AdvancedSheet, changedSummary} from './advanced.jsx';
import {MODELS} from './model.js';
import {queuePositions, useStore} from './store.jsx';
import {trashItems} from './trash.js';
import {AgentSettings} from './agent.jsx';

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
        <button className={page === 'home' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'home'})}>作品</button>
        <button className={page === 'quick' ? 'on' : ''} onClick={() => state.sessions.some(x => x.id === state.activeSession && !x.trashedAt) ? dispatch({type: 'page', page: 'quick'}) : state.sessions.find(x => !x.trashedAt) ? dispatch({type: 'qcOpen', id: state.sessions.find(x => !x.trashedAt).id}) : dispatch({type: 'qcNew'})}>快速创作</button>
        <button className={page === 'library' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'library'})}>素材库</button>
        <button className={page === 'gpu' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'gpu'})}>算力{busy > 0 && <em className="navdot">{busy}</em>}</button>
        <button className={page === 'settings' ? 'on' : ''} onClick={() => dispatch({type: 'page', page: 'settings'})}>设置</button>
      </nav>
      <div className="spacer" />
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
          {tab === 'budget' && <>
            <h2>我的额度</h2>
            <div className="card-box soon"><Wallet size={22} /><div><b>内测期间不限额</b><small className="muted">由管理员统一管理。额度、已花、剩余和每日花费会在 #175 加上。</small></div></div>
          </>}
          {tab === 'admin' && <>
            <h2>管理员</h2>
            <p className="muted">只有 superdan 能看到这一页。</p>
            {[['账号额度和价格上限', '#175'], ['后台批量取消任务，并告诉 Agent 原因', '#176'], ['机器排行和黑白名单', '#177'], ['创作记录回收站和测试记录清理', '#182']].map(([t, n]) => (
              <div key={n} className="card-box soon"><ShieldCheck size={20} /><div><b>{t}</b><small className="muted">即将上线 · {n}</small></div></div>))}
          </>}
        </section>
      </main>
    </div>
  );
}
