import React, {useState} from 'react';
import {ArrowRight, Check, Coins, CreditCard, Gift, History, Lock, Mail, RotateCcw, ShieldCheck, Sparkles, TrendingUp, UserRound, Users, X} from 'lucide-react';
import {PACKS, useStore} from './store.jsx';
import {CREDIT_USD, fmtCredits} from './model.js';

// Launch batch A (prototype): sign-in, credits, top-up, admin console. Users only ever see credits;
// dollars, machine cost and margin are admin-only. Every number here comes from the backend in production.

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`; };
const num = n => Math.round(n).toLocaleString('en-US');

/* ---------- 登录 / 注册 ---------- */
const PROVIDERS = [
  ['google', '用 Google 继续', <svg key="g" viewBox="0 0 24 24" width="16" height="16"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" /></svg>],
  ['github', '用 GitHub 继续', <svg key="h" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 2.9.9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z" /></svg>],
];

export function AuthPage() {
  const {dispatch} = useStore();
  const [email, setEmail] = useState(''), [sent, setSent] = useState(false), [code, setCode] = useState('');
  const go = () => dispatch({type: 'signIn'});
  const okEmail = /.+@.+\..+/.test(email);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <b className="logo">映序</b>
        <h1>登录或注册</h1>
        <p className="muted">用一个账号做故事、快速创作，也能让你的 AI 助手帮你做。新用户验证邮箱后送 <b>100 积分</b>，够生成 5 条标准视频。</p>
        <div className="auth-providers">{PROVIDERS.map(([k, l, icon]) =>
          <button key={k} className="auth-provider keep-label" onClick={go}>{icon}{l}</button>)}</div>
        <div className="auth-or"><span>或者用邮箱</span></div>
        {!sent ? <>
          <label className="field"><span>邮箱</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <button className="primary auth-main keep-label" disabled={!okEmail} onClick={() => setSent(true)}><Mail size={15} />发送 6 位验证码</button>
        </> : <>
          <p className="muted">验证码已发到 <b>{email}</b>，10 分钟内有效。<button className="linkish" onClick={() => { setSent(false); setCode(''); }}>换个邮箱</button></p>
          <label className="field"><span>验证码</span><input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="code-input" /></label>
          <button className="primary auth-main keep-label" disabled={code.length !== 6} onClick={go}>登录</button>
        </>}
        <small className="muted auth-agree">继续即表示你同意 <a href="#terms">用户协议</a>、<a href="#privacy">隐私政策</a> 和 <a href="#content">内容规则</a>。</small>
        <small className="muted">同一个邮箱用 Google、GitHub、密码或验证码登录，都是同一个账号。</small>
      </div>
      <p className="muted auth-foot">原型：任意方式都会直接登录为普通用户。</p>
    </div>
  );
}

/* ---------- 顶栏积分 ---------- */
export function CreditsChip() {
  const {state, dispatch} = useStore();
  const low = state.credits.balance < 100;
  return <button className={'credits-chip keep-label' + (low ? ' low' : '')} title="积分余额 · 点击充值" onClick={() => dispatch({type: 'settingsTab', tab: 'credits'})}>
    <Coins size={14} /><b>{num(state.credits.balance)}</b><span className="credits-word">积分</span></button>;
}

/* ---------- 设置 → 积分 ---------- */
const KIND = {purchase: ['充值', CreditCard], grant: ['赠送', Gift], spend: ['使用', Sparkles], refund: ['退回', RotateCcw], adjust: ['调整', ShieldCheck]};
export const TIERS = [['fast', '快速草稿', '最快，细节稍软，适合先看效果'], ['draft', '标准', '480P · 20 步，大多数时候用这个'], ['final', '精修', '768P 完整模型，成片用']];

export function CreditsPanel({LimitField}) {
  const {state} = useStore();
  const [buy, setBuy] = useState(null);
  const c = state.credits, L = state.limits;
  const perClip = k => Math.ceil(state.rates[k] * 5);
  const pct = L.daily ? Math.min(100, (state.creditsToday || 0) / L.daily * 100) : 0;
  return <>
    <h2>我的积分</h2>
    <div className="credits-hero card-box">
      <div><small className="muted">余额</small><div className="credits-big"><Coins size={22} />{num(c.balance)}<span>积分</span></div>
        <small className="muted">大约够 {Math.floor(c.balance / perClip('draft'))} 条 5 秒标准视频 · 积分不会过期</small></div>
      <div className="credits-today"><small className="muted">今天已用</small><b>{fmtCredits(state.creditsToday || 0)}</b>
        {L.daily ? <><i className="bar"><b style={{width: pct + '%'}} /></i><small className="muted">每日上限 {fmtCredits(L.daily)}</small></> : <small className="muted">不设每日上限</small>}</div>
    </div>

    <div className="card-box"><h4>充值</h4>
      <div className="packs">{PACKS.map(p => <button key={p.id} className={'pack' + (p.id === 'creator' ? ' best' : '')} onClick={() => setBuy(p)}>
        {p.id === 'creator' && <em className="pack-tag">最常选</em>}
        <b>{num(p.credits)}<small> 积分</small></b>
        <span className="pack-name">{`${p.name}包`}{p.bonus ? <small className="good"> 多送 {p.bonus}%</small> : null}</span>
        <span className="pack-price">US${p.usd}</span></button>)}</div>
      <small className="muted"><Lock size={11} /> 通过 Stripe 安全支付：银行卡、Apple Pay、Google Pay 等。我们不保存你的卡号。暂时不支持中国大陆的付款。</small></div>

    <div className="card-box"><h4>生成要多少积分</h4>
      <div className="price-table">{TIERS.map(([k, l, d]) => <div key={k}><b>{l}</b><small className="muted">{d}</small>
        <span>{state.rates[k]} 积分 / 秒</span><span className="muted">5 秒一条 ≈ {perClip(k)} 积分</span></div>)}</div>
      <small className="muted">提交前会先告诉你要用多少；生成失败的自动退回，不扣积分。</small></div>

    <div className="card-box limits-box"><h4>用量提醒</h4>
      <LimitField label="每天最多用" hint="所有生成和 AI 助手加起来，按悉尼时间每天清零；0 = 不限" k="daily" unit=" 积分" step={100} />
      <LimitField label="单次超过多少先问我" hint="一次提交（比如批量 8 个镜头各 4 条）预计超过这个数，会先弹出确认" k="confirmAbove" unit=" 积分" step={10} />
      <small className="muted">AI 助手各自的每日上限在「AI 助手」里单独设。</small></div>

    <div className="card-box"><h4><History size={14} /> 积分记录</h4>
      <div className="credit-log">{[...c.entries].reverse().slice(0, 12).map(e => { const [l, I] = KIND[e.kind] || KIND.adjust; return (
        <div key={e.id}><I size={14} /><span className="clip">{e.label}</span><small className="muted">{l} · {ago(e.at)}</small>
          <b className={e.amount > 0 ? 'good' : ''}>{e.amount > 0 ? '+' : '−'}{num(Math.abs(e.amount))}</b></div>); })}</div>
      <small className="muted">需要发票或退款，在每条充值记录里下载收据，或联系 support@inkseq.com。</small></div>
    {buy && <Checkout pack={buy} onClose={() => setBuy(null)} />}
  </>;
}

// Stripe Checkout is a hosted page; the prototype only shows the hand-off and the result.
function Checkout({pack, onClose}) {
  const {dispatch, toast} = useStore();
  const [step, setStep] = useState('confirm');
  return <div className="choose-overlay" onClick={onClose}><div className="choose checkout" onClick={e => e.stopPropagation()}>
    <div className="picker-head"><b>充值 {pack.name}包</b><button className="x" onClick={onClose}>×</button></div>
    {step === 'confirm' ? <>
      <div className="checkout-sum"><span>{num(pack.credits)} 积分{pack.bonus ? `（含多送 ${pack.bonus}%）` : ''}</span><b>US${pack.usd}.00</b></div>
      <small className="muted">接下来会打开 Stripe 的安全付款页面。付款成功后积分马上到账，这个页面会自动刷新。税费按你所在地区在付款页显示。</small>
      <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={onClose}>取消</button>
        <button className="primary" onClick={() => setStep('stripe')}><CreditCard size={15} />去付款</button></div>
    </> : step === 'stripe' ? <div className="stripe-mock">
      <small className="muted">checkout.stripe.com</small><b>Inkseq · {num(pack.credits)} credits</b><span>US${pack.usd}.00</span>
      <div className="stripe-field">4242 4242 4242 4242 · 12/34 · 123</div>
      <button className="primary" onClick={() => { dispatch({type: 'topUp', pack: pack.id}); setStep('done'); }}>原型：模拟付款成功</button>
    </div> : <>
      <div className="agent-ok"><Check size={14} />已到账 {num(pack.credits)} 积分，收据已发到你的邮箱。</div>
      <div className="row tight" style={{justifyContent: 'flex-end'}}><button className="primary" onClick={() => { onClose(); toast('充值成功'); }}>好的</button></div>
    </>}
  </div></div>;
}

// Shown when a submit needs more credits than the balance; nothing is queued.
export function LowCredits() {
  const {state, dispatch} = useStore();
  const b = state.creditBlock;
  if (!b) return null;
  return <div className="choose-overlay" onClick={() => dispatch({type: 'creditBlockClose'})}><div className="choose" onClick={e => e.stopPropagation()}>
    <div className="picker-head"><b>积分不够</b><button className="x" onClick={() => dispatch({type: 'creditBlockClose'})}>×</button></div>
    <p>这次要用 <b>{fmtCredits(b.need)}</b>，你还有 {fmtCredits(b.have)}。没有提交，也没有扣积分。</p>
    <p className="muted">可以少生成几条、换成快速草稿，或者先充值。</p>
    <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={() => dispatch({type: 'creditBlockClose'})}>返回修改</button>
      <button className="primary" onClick={() => dispatch({type: 'settingsTab', tab: 'credits'})}><Coins size={15} />去充值</button></div>
  </div></div>;
}

/* ---------- 设置 → 账号：登录方式 ---------- */
export function LinkedLogins() {
  const {state, toast} = useStore();
  const admin = state.role === 'admin';
  // Owner decision 2026-10-19: Google + GitHub + email (password or code). More providers are a WorkOS toggle later.
  const rows = [['邮箱', admin ? 'dan@inkseq.com' : 'mia.c@gmail.com', true], ['Google', admin ? '' : 'mia.c@gmail.com', !admin], ['GitHub', '', false]];
  return <div className="card-box"><h4>登录方式</h4>
    {rows.map(([k, v, on]) => <div key={k} className="row tight login-row"><b>{k}</b><small className="muted">{on ? v || '已连接' : '未连接'}</small><div className="spacer" />
      {on ? <button className="small ghost" disabled={k === '邮箱'} onClick={() => toast('原型：已断开')}>断开</button> : <button className="small" onClick={() => toast(`原型：跳转到 ${k} 授权`)}>连接</button>}</div>)}
    <small className="muted">至少保留一种登录方式。邮箱用来收验证码和收据。</small></div>;
}

/* ---------- 设置 → 管理员 ---------- */
// Measured GPU seconds per 5 s clip (2026-10-15 benchmark) and the hourly price of the class it runs on.
const COST_BASIS = {fast: {sec: 29, hourly: 0.64, gpu: 'RTX 5090'}, draft: {sec: 87, hourly: 0.64, gpu: 'RTX 5090'}, final: {sec: 217, hourly: 1.29, gpu: 'PRO 6000'}};
const FEE = clip => clip * 0.035; // card processing, roughly

export function AdminPanel({testMachines}) {
  const [tab, setTab] = useState('users');
  return <>
    <h2>管理员</h2>
    <p className="muted">只有管理员能看到这一页。普通用户只看到积分，看不到美元、机器和利润。</p>
    <div className="seg admin-tabs">{[['users', '用户', Users], ['pricing', '定价与利润', TrendingUp], ['machines', '测试机', ShieldCheck], ['log', '操作记录', History]].map(([k, l, I]) =>
      <button key={k} className={'keep-label' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><I size={13} />{l}</button>)}</div>
    {tab === 'users' && <AdminUsers />}
    {tab === 'pricing' && <AdminPricing />}
    {tab === 'machines' && testMachines}
    {tab === 'log' && <AdminLog />}
  </>;
}

function AdminUsers() {
  const {state, dispatch} = useStore();
  const [q, setQ] = useState(''), [open, setOpen] = useState(null), [delta, setDelta] = useState(100), [reason, setReason] = useState('');
  const list = state.users.filter(u => !q || (u.name + u.email).toLowerCase().includes(q.toLowerCase()));
  return <div className="card-box">
    <div className="row tight"><input className="lib-search" placeholder="搜索名字或邮箱…" value={q} onChange={e => setQ(e.target.value)} /><div className="spacer" /><small className="muted">{state.users.length} 个账号</small></div>
    <div className="user-table">
      <div className="user-row head"><span>账号</span><span>角色</span><span>余额</span><span>30 天用量</span><span /></div>
      {list.map(u => <React.Fragment key={u.id}>
        <div className={'user-row' + (u.status === 'suspended' ? ' off' : '')}>
          <span><b>{u.name}{u.status === 'suspended' && <small className="muted"> · 已停用</small>}</b><small className="muted clip">{u.email} · {u.via.join(' / ')} · {ago(u.joined)}加入</small></span>
          <span><select className="small" value={u.role} onChange={e => dispatch({type: 'adminUser', user: u.id, patch: {role: e.target.value}})}><option value="user">普通用户</option><option value="admin">管理员</option></select></span>
          <span className="num">{num(u.balance)}</span><span className="num">{num(u.spent30)}</span>
          <span><button className="small" onClick={() => setOpen(open === u.id ? null : u.id)}>调整积分</button></span>
        </div>
        {open === u.id && <div className="user-adjust">
          <label className="field small"><span>增减（负数为扣除）</span><input type="number" step={10} value={delta} onChange={e => setDelta(+e.target.value)} /></label>
          <label className="field" style={{flex: 2}}><span>原因（必填，会记录并显示给用户）</span><input value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：生成故障补偿 / 内测赠送" /></label>
          <button className="primary" disabled={!delta || !reason.trim()} onClick={() => { dispatch({type: 'adminCredits', user: u.id, delta, reason: reason.trim()}); setReason(''); setOpen(null); }}>确认</button>
          <button className={'small ' + (u.status === 'suspended' ? '' : 'danger')} onClick={() => dispatch({type: 'adminUser', user: u.id, patch: {status: u.status === 'suspended' ? 'active' : 'suspended'}})}>{u.status === 'suspended' ? '恢复账号' : '停用账号'}</button>
        </div>}
      </React.Fragment>)}
    </div>
  </div>;
}

function AdminPricing() {
  const {state, dispatch} = useStore();
  const k = state.overhead;
  const rows = Object.entries(COST_BASIS).map(([tier, b]) => {
    const price = Math.ceil(state.rates[tier] * 5) * CREDIT_USD, gpu = b.sec / 3600 * b.hourly, cost = gpu * k + FEE(price);
    return {tier, b, price, gpu, cost, margin: price ? 1 - cost / price : 0};
  });
  const label = Object.fromEntries(TIERS.map(([t, l]) => [t, l]));
  return <>
    <div className="card-box"><h4>每档价格（积分 / 秒视频）</h4>
      <small className="muted">1 积分 = US$0.01。改完先看下面的利润，再点「发布」；已经提交的任务按提交时的价格算。当前 v{state.ratesRev}。</small>
      <div className="rate-edit">{TIERS.map(([t, l]) => <label key={t} className="field small"><span>{l}</span>
        <input type="number" min={1} step={1} value={state.rates[t]} onChange={e => dispatch({type: 'rates', patch: {[t]: Math.max(1, +e.target.value || 1)}})} /></label>)}
        <button className="primary" onClick={() => dispatch({type: 'ratesPublish'})}>发布为 v{state.ratesRev + 1}</button></div></div>
    <div className="card-box"><h4>每条 5 秒视频的利润</h4>
      <label className="limit-row"><div><b>机器成本放大系数</b><small className="muted">把开机、空转、失败重做算进去；看真实数据后调整</small></div>
        <span className="limit-input"><input type="number" min={1} step={0.5} value={k} onChange={e => dispatch({type: 'overhead', value: Math.max(1, +e.target.value || 1)})} />×</span></label>
      <div className="margin-table">
        <div className="head"><span>档位</span><span>用户付</span><span>纯机器</span><span>算上放大和手续费</span><span>毛利</span></div>
        {rows.map(r => <div key={r.tier}><span><b>{label[r.tier]}</b><small className="muted">{r.b.gpu} · {r.b.sec} 秒 · ${r.b.hourly}/时</small></span>
          <span>${r.price.toFixed(2)}</span><span className="muted">${r.gpu.toFixed(3)}</span><span>${r.cost.toFixed(3)}</span>
          <span className={r.margin < 0.3 ? 'bad' : r.margin < 0.5 ? 'warn' : 'good'}>{Math.round(r.margin * 100)}%</span></div>)}
      </div>
      <small className="muted">毛利低于 30% 标红。参考：MiniMax 官方 H3 约 $0.40–0.65 / 5 秒，Kling 约 $0.40–0.55，Runway 约 $0.25–0.60。</small></div>
    <div className="card-box"><h4>最近 30 天</h4>
      <div className="stats-row"><div><small className="muted">用户用掉</small><b>{num(41200)} 积分</b><small className="muted">= $412.00</small></div>
        <div><small className="muted">实际机器费用</small><b>$96.40</b><small className="muted">来自供应商账单</small></div>
        <div><small className="muted">毛利</small><b className="good">77%</b><small className="muted">另有 $3.04 免除、$0.80 待对账</small></div></div></div>
  </>;
}

function AdminLog() {
  const {state} = useStore();
  return <div className="card-box"><h4>管理员操作记录</h4>
    <div className="agent-log">{[...state.adminLog].reverse().map((l, i) => <div key={i}><small className="muted">{ago(l.at)}</small> {l.text}</div>)}
      {!state.adminLog.length && <small className="muted">还没有操作。调整积分、改角色、发布定价都会记在这里，不能删除。</small>}</div></div>;
}

/* ---------- 原型：切换预览身份 ---------- */
export function RolePreview() {
  const {state, dispatch} = useStore();
  return <div className="role-preview" data-no-i18n-skip>
    <UserRound size={12} /><span>预览身份</span>
    <select value={state.role} onChange={e => dispatch({type: 'role', role: e.target.value})}>
      <option value="user">普通用户</option><option value="admin">管理员</option><option value="guest">未登录</option></select></div>;
}

// "新手引导" strip on the home page: recommends the built-in assistant first.
export function AssistantHint({onStart}) {
  return <button className="assist-hint keep-label" onClick={onStart}><Sparkles size={18} />
    <span><b>不知道从哪开始？把故事交给 AI</b><small>贴一篇完整的故事或一段想法，AI 会拆好章节、人物和镜头，建好故事板直接带你进去。不生成视频就不花积分。</small></span>
    <ArrowRight size={16} /></button>;
}
