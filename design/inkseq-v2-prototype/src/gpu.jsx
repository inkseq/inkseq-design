import React, {useState} from 'react';
import {AlertCircle, Copy, Cpu, Plus, Power, RefreshCw, Square, ThumbsDown, ThumbsUp, Timer, Trash2, X, Zap} from 'lucide-react';
import {AppHeader} from './pages.jsx';
import {MODELS} from './model.js';
import {useStore} from './store.jsx';

/* 算力: everything the live GPU 控制台 (h3-studio P4OperatorConsole / DstackCapacity) offers, in the prototype's style,
   plus host scoring, 自动加机器 and machines that hold both models. Prices are hourly ceilings, not bills. */
const MODE = {FL: '首尾帧', REF: '全能参考', both: '两种都能跑'};
const PROFILES = {draft: {label: '草稿 · H3 剪枝版 INT8', gpu: 'RTX 5090', gb: 20}, final: {label: '精修 · H3 完整版', gpu: 'RTX PRO 6000', gb: 66}};
const STEPS = [['renting', '申请机器'], ['downloading', '下载模型'], ['loading', '加载模型'], ['ready', '就绪']];
const SIM = {renting: 3, downloading: 5, loading: 3, switching: 2};
const keepText = m => (m.keep === 'idle' ? `空闲 ${m.idleMin || 10} 分钟后关机` : m.keep === 'until' ? `保持到 ${m.until || '23:30'}` : '一直开，直到手动关');
const money = n => `$${n.toFixed(2)}`;
// The prototype clock runs fast: 1 simulated second ≈ 1 real minute of machine time.
const runMin = (m, clock) => Math.max(0, Math.round(clock - (m.startedAt ?? 0)));

function useGpuData() {
  const {state} = useStore();
  const versions = state.shots.flatMap(s => s.versions.map(v => ({s, v})));
  const waiting = mode => versions.filter(({v}) => v.status === 'queued' && v.mode === mode).length;
  const running = mode => versions.filter(({v}) => v.status === 'generating' && v.mode === mode);
  const busy = {};
  for (const mode of ['FL', 'REF']) {
    const jobs = running(mode);
    state.machines.filter(m => m.active === mode && m.status === 'ready').forEach((m, i) => { if (jobs[i]) busy[m.id] = jobs[i]; });
  }
  const done = versions.filter(({v}) => v.doneAt != null && v.startedAt != null);
  const avg = mode => { const d = done.filter(({v}) => v.mode === mode).map(({v}) => v.doneAt - v.startedAt); return d.length ? {sec: d.reduce((a, b) => a + b, 0) / d.length, n: d.length} : null; };
  return {versions, waiting, running, busy, avg};
}

function Keep({m, onChange}) {
  return (
    <span className="keep">
      <select value={m.keep} onChange={e => onChange({keep: e.target.value})} title="保持开机方式">
        <option value="idle">空闲后关机</option><option value="until">保持到某个时间</option><option value="until_stopped">一直开到手动关</option></select>
      {m.keep === 'idle' && <><input type="number" min={1} max={1440} value={m.idleMin || 10} onChange={e => onChange({idleMin: +e.target.value})} />分钟</>}
      {m.keep === 'until' && <input type="time" value={m.until || '23:30'} onChange={e => onChange({until: e.target.value})} />}
    </span>
  );
}

function Prep({m, clock}) {
  const step = STEPS.findIndex(([k]) => k === m.status);
  const frac = Math.min(1, (clock - m.since) / (SIM[m.status] || 1));
  const gb = PROFILES[m.quality]?.gb || 20;
  return (
    <div className="prep">
      <div className="steps">{STEPS.map(([k, l], i) => <span key={k} className={i < step ? 'done' : i === step ? 'now' : ''}>{l}</span>)}</div>
      {m.status === 'downloading' && <small className="muted">模型权重 {(gb * frac).toFixed(1)} / {gb} GB · 本阶段 {Math.round(frac * 100)}%</small>}
      {m.status === 'renting' && <small className="muted">等供应商分配机器、拉取运行镜像…</small>}
      {m.status === 'loading' && <small className="muted">加载到显存并自检…</small>}
    </div>
  );
}

function MachineRow({m, job, onOpen, onStop}) {
  const {state, dispatch} = useStore();
  const story = id => state.stories.find(x => x.id === id)?.title;
  return (
    <div className={'mrow' + (m.status === 'stopping' ? ' stopping' : '')}>
      <Cpu size={22} className="mrow-icon" />
      <button className="mrow-main ghost" onClick={() => onOpen(m)} title="机器详情">
        <b>{m.gpu} · <span className={'mode ' + (m.mode === 'both' ? 'both' : m.mode.toLowerCase())}>{MODE[m.mode]}</span>{m.mode === 'both' && <small className="muted"> 当前 {MODE[m.active]}</small>}
          {' '}<span className="q">{MODELS[m.quality].label}</span>{m.auto && <span className="pill">自动加的</span>}</b>
        <small className="muted">{m.provider || 'Vast'} · {m.region} · {money(m.price)}/小时上限 · <Timer size={11} /> {keepText(m)}</small></button>
      <div className="mrow-state">
        {m.status === 'ready' ? (job ? <span className="pill busy">生成中：{job.s.title}<small className="muted"> · {story(job.s.storyId)}</small></span> : <span className="pill good">就绪，等待任务</span>)
          : m.status === 'stopping' ? <span className="pill muted">停止中：跑完手上的任务再关…</span>
          : m.status === 'switching' ? <span className="pill busy">切换到{MODE[m.active]}…</span>
          : <Prep m={m} clock={state.clock} />}
      </div>
      <div className="mrow-actions">
        <Keep m={m} onChange={patch => dispatch({type: 'keepMachine', id: m.id, patch})} />
        <select value={m.group || ''} title="机器组" onChange={e => dispatch({type: 'keepMachine', id: m.id, patch: {group: e.target.value || null}})}>
          <option value="">未分组</option>{state.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <button className="small" disabled={m.status === 'stopping'} onClick={() => onStop(m)}><Square size={12} />{job ? '跑完再关' : '关机'}</button>
      </div>
    </div>
  );
}

function Detail({m, onClose}) {
  const {state, dispatch} = useStore();
  const host = state.hosts.find(h => h.id === m.host);
  const mins = runMin(m, state.clock);
  return (
    <div className="adv-overlay" onClick={onClose}>
      <aside className="adv-sheet" onClick={e => e.stopPropagation()}>
        <div className="adv-head"><Cpu size={16} /><b>{m.gpu} · {MODE[m.mode]}</b><div className="spacer" /><button className="x" onClick={onClose}><X size={16} /></button></div>
        <div className="adv-body">
          <dl className="kv">
            <dt>模型</dt><dd>{PROFILES[m.quality].label}</dd>
            <dt>模式</dt><dd>{MODE[m.mode]}{m.mode === 'both' ? `（当前 ${MODE[m.active]}，没有这一种任务时自动切到另一种）` : ''}</dd>
            <dt>供应商 · 地区</dt><dd>{m.provider || 'Vast'} · {m.region} · 主机 {m.host}</dd>
            <dt>状态</dt><dd>{{renting: '申请机器', downloading: '下载模型', loading: '加载模型', ready: '就绪', switching: '切换模式', stopping: '停止中'}[m.status]}</dd>
            <dt>已运行</dt><dd>{mins} 分钟</dd>
            <dt>费用（上限估算）</dt><dd>{money(m.price * mins / 60)} · {money(m.price)}/小时</dd>
            <dt>完成任务</dt><dd>{m.jobs || 0} 条</dd>
            <dt>保持开机</dt><dd>{keepText(m)}</dd>
            <dt>机器组</dt><dd>{state.groups.find(g => g.id === m.group)?.name || '未分组'}</dd>
          </dl>
          {host && <section><h5>这台主机的历史表现</h5>
            <p className="muted">跑过 {host.runs} 次 · 平均 {host.avgSec} 秒一条 · 失败 {host.fails} 次</p>
            <div className="row tight"><button className={'small' + (host.tag === 'prefer' ? ' primary' : '')} onClick={() => dispatch({type: 'hostTag', id: host.id, tag: 'prefer'})}><ThumbsUp size={13} />以后优先租</button>
              <button className={'small' + (host.tag === 'avoid' ? ' danger' : '')} onClick={() => dispatch({type: 'hostTag', id: host.id, tag: 'avoid'})}><ThumbsDown size={13} />以后避开</button></div></section>}
          <details><summary>诊断信息</summary><code className="muted">reason_code: {m.status === 'ready' ? 'ready' : m.status}</code><p className="muted">原请求、预算预留和未结账单都保留在原账本；这里只是查看。</p></details>
        </div>
      </aside>
    </div>
  );
}

/* Start: one or more config rows → query every provider → pick a host per row → check total → confirm. */
function StartMachine({onClose, preset}) {
  const {state, dispatch} = useStore();
  const blank = () => ({id: Math.random().toString(36).slice(2), quality: 'draft', mode: preset || 'FL', count: 1, group: state.groups[0]?.id || '', pick: null});
  const [rows, setRows] = useState([blank()]), [scanned, setScanned] = useState(false), [scanning, setScanning] = useState(false);
  const [keep, setKeep] = useState({keep: 'idle', idleMin: 10}), [confirm, setConfirm] = useState(false), [newGroup, setNewGroup] = useState('');
  const edit = (id, patch) => { setRows(r => r.map(x => (x.id === id ? {...x, ...patch} : x))); setConfirm(false); };
  const tagOf = h => state.hosts.find(x => x.id === h)?.tag;
  const offersFor = q => {
    const base = q === 'draft'
      ? [['Vast', 'vast-41822', '拉脱维亚', 0.69, 64, 200, 900], ['Vast', 'vast-62019', '美国', 0.39, 48, 120, 400], ['RunPod', 'rp-a17f', '美国', 0.57, 62, 200, 1200], ['Vast', 'vast-30715', '美国', 0.35, 64, 150, 700], ['Vast', 'vast-70011', '日本', 0.52, 32, 80, 300]]
      : [['Vast', 'vast-55201', '美国', 1.29, 128, 300, 1000], ['RunPod', 'rp-c903', '加拿大', 1.45, 186, 400, 1500]];
    const need = q === 'draft' ? {ram: 48, disk: 100} : {ram: 96, disk: 200};
    return base.map(([provider, host, region, price, ram, disk, bw]) => {
      const h = state.hosts.find(x => x.id === host);
      const inUse = state.machines.some(m => m.host === host);
      const block = inUse ? '你正在用这台' : ram < need.ram ? `内存 ${ram} GB，不够 ${need.ram} GB` : disk < need.disk ? `磁盘 ${disk} GB，不够 ${need.disk} GB` : null;
      return {provider, host, region, price, ram, disk, bw, gpu: PROFILES[q].gpu, h, block};
    }).sort((a, b) => (!!a.block - !!b.block) || ((tagOf(a.host) === 'avoid') - (tagOf(b.host) === 'avoid')) || ((tagOf(b.host) === 'prefer') - (tagOf(a.host) === 'prefer')) || a.price - b.price);
  };
  const scan = () => { setScanning(true); setTimeout(() => { setScanning(false); setScanned(true); setRows(r => { const used = new Set();
    return r.map(x => { const pick = offersFor(x.quality).find(o => !o.block && tagOf(o.host) !== 'avoid' && !used.has(o.host)) || null; if (pick) used.add(pick.host); return {...x, pick}; }); }); }, 700); };
  // One exact host can back only one machine; it is taken once another row picked it.
  const takenBy = (host, rowId) => rows.findIndex(x => x.id !== rowId && x.pick?.host === host);
  const total = rows.reduce((n, r) => n + (r.pick ? r.pick.price * r.count : 0), 0), count = rows.reduce((n, r) => n + r.count, 0);
  const ready = scanned && rows.every(r => r.pick);
  const go = () => {
    let gid = null;
    if (newGroup.trim()) { gid = 'g' + Math.random().toString(36).slice(2, 6); dispatch({type: 'newGroup', id: gid, name: newGroup.trim()}); }
    rows.forEach(r => {
      const spec = {mode: r.mode, quality: r.quality, gpu: r.pick.gpu, region: r.pick.region, provider: r.pick.provider, price: r.pick.price, group: gid || r.group || null, ...keep};
      dispatch({type: 'startMachine', spec: {...spec, host: r.pick.host}});
      if (r.count > 1) dispatch({type: 'startMachine', count: r.count - 1, spec});
    });
    onClose();
  };
  return (
    <div className="choose-overlay" onClick={onClose}>
      <div className="choose wide" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>启动机器</b><small className="muted">每行一种配置，可以一次开几台</small><button className="x" onClick={onClose}>×</button></div>
        {rows.map((r, i) => (
          <div key={r.id} className="cfg">
            <div className="row tight">
              <b className="muted">配置 {i + 1}</b>
              <select value={r.quality} onChange={e => edit(r.id, {quality: e.target.value, pick: null})}>{Object.entries(PROFILES).map(([k, p]) => <option key={k} value={k}>{p.label} · {p.gpu}</option>)}</select>
              <div className="seg">{Object.entries(MODE).map(([k, l]) => <button key={k} className={r.mode === k ? 'on' : ''} onClick={() => edit(r.id, {mode: k})} title={k === 'both' ? '一台机器装两种模型，没有这种任务时自动切到另一种（切换要时间）' : ''}>{l}</button>)}</div>
              <label className="row tight">数量<input type="number" min={1} max={8} value={r.count} onChange={e => edit(r.id, {count: Math.max(1, +e.target.value)})} style={{width: 56}} />台</label>
              <select value={r.group} onChange={e => edit(r.id, {group: e.target.value})} title="加入机器组"><option value="">不分组</option>{state.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
              <div className="spacer" />
              <button className="small ghost" title="复制这一行" onClick={() => setRows(x => [...x, {...r, id: Math.random().toString(36).slice(2)}])}><Copy size={13} /></button>
              <button className="small ghost" disabled={rows.length === 1} title="删掉这一行" onClick={() => setRows(x => x.filter(y => y.id !== r.id))}><Trash2 size={13} /></button>
            </div>
            {scanned && r.count > 1 && <small className="muted">开 {r.count} 台时，选中的这台算第一台，其余按同样的 GPU、地区和价格上限另外找。</small>}
            {scanned && <div className="offers-table">{offersFor(r.quality).map(o => {
              const tag = tagOf(o.host), on = r.pick?.host === o.host, taken = takenBy(o.host, r.id);
              return (
                <button key={o.host} disabled={!!o.block || taken >= 0} className={'orow' + (on ? ' on' : '') + (tag === 'avoid' ? ' avoid' : '')} onClick={() => edit(r.id, {pick: o})}>
                  <span><b>{o.provider}</b> · {o.region}</span><span>{o.gpu}</span><span>内存 {o.ram} GB · 磁盘 {o.disk} GB · 下载 {o.bw} MB/s</span>
                  <span>{o.h ? `跑过 ${o.h.runs} 次 · 平均 ${o.h.avgSec}s · 失败 ${o.h.fails}` : '新主机，没有记录'}</span>
                  <span className="tagcell">{o.block ? <em className="bad">{o.block}</em> : taken >= 0 ? <em>配置 {taken + 1} 已选</em> : tag === 'prefer' ? <em className="good">优先</em> : tag === 'avoid' ? <em className="bad">已避开</em> : null}</span>
                  <strong>{money(o.price)}<small>/小时</small></strong></button>);
            })}</div>}
          </div>))}
        <div className="row tight"><button className="small" onClick={() => setRows(x => [...x, blank()])}><Plus size={13} />再加一种配置</button>
          <span className="muted">或新建机器组，这次启动的都放进去：</span><input placeholder="例如：supervan 量产" value={newGroup} onChange={e => setNewGroup(e.target.value)} style={{width: 180}} /></div>
        <div className="field"><span>保持开机（这次启动的都用这个，开机后每台还能单独改）</span><Keep m={keep} onChange={p => setKeep(k => ({...k, ...p}))} /></div>
        {!scanned ? <button className="primary" disabled={scanning} onClick={scan}><RefreshCw size={15} />{scanning ? '正在查 Vast、RunPod…' : '查询全部供应商的库存'}</button>
          : <p className="muted small-note">库存和价格是刚才查到的，不代表已经租到；按“优先 / 避开”和价格排好了，被拦住的写了原因。<button className="small ghost" onClick={scan}><RefreshCw size={12} />重新查</button></p>}
        {confirm && ready && <div className="confirm-box"><b>{count} 台，每小时合计上限 {money(total)}</b><p className="muted">准备和空闲也计费；实际按供应商账单。点确认后逐台申请，某台租不到会单独告诉你。</p></div>}
        <div className="row tight" style={{justifyContent: 'flex-end'}}>
          <button onClick={onClose}>取消</button>
          {!confirm ? <button className="primary" disabled={!ready} onClick={() => setConfirm(true)}>核对费用</button>
            : <button className="primary" onClick={go}><Power size={15} />确认启动 {count} 台</button>}
        </div>
      </div>
    </div>
  );
}

export function GpuPage() {
  const {state, dispatch} = useStore();
  const {waiting, busy, avg} = useGpuData();
  const [starting, setStarting] = useState(null), [detail, setDetail] = useState(null), [stopAsk, setStopAsk] = useState(null), [hostsOpen, setHostsOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(state.clock);
  const live = state.machines;
  const count = st => live.filter(m => [].concat(st).includes(m.status)).length;
  const perHour = live.filter(m => m.status !== 'stopping').reduce((n, m) => n + m.price, 0);
  const runningCost = live.reduce((n, m) => n + m.price * runMin(m, state.clock) / 60, 0);
  const canRun = mode => live.filter(m => (m.mode === mode || m.mode === 'both') && m.status !== 'stopping');
  // Stopping the last machine that can take a mode while that mode has a queue strands those tasks: ask first.
  const stop = m => {
    const modes = m.mode === 'both' ? ['FL', 'REF'] : [m.mode];
    const stranded = modes.filter(k => waiting(k) > 0 && canRun(k).length === 1);
    if (stranded.length) setStopAsk({m, stranded}); else dispatch({type: 'stopMachine', id: m.id});
  };
  const groups = [...state.groups.map(g => ({...g, list: live.filter(m => m.group === g.id)})), {id: null, name: '未分组', list: live.filter(m => !m.group || !state.groups.some(g => g.id === m.group))}];
  const age = Math.round(state.clock - refreshedAt);
  return (
    <div className="home">
      <AppHeader />
      <main className="home-main">
        <div className="home-head">
          <div className="tabs"><button className="on">算力 <small>GPU 机器</small></button></div>
          <small className="muted">{age < 3 ? '刚刚更新' : `更新于 ${age} 秒前`}</small><button className="small ghost" onClick={() => setRefreshedAt(state.clock)}><RefreshCw size={13} />刷新</button>
          <div className="spacer" />
          <button className="primary" onClick={() => setStarting('FL')}><Plus size={16} />启动机器</button>
        </div>
        <div className="stats five">
          <div><small>就绪</small><b>{count('ready') - Object.keys(busy).length}</b></div>
          <div><small>正在生成</small><b>{Object.keys(busy).length}</b></div>
          <div><small>准备中</small><b>{count(['renting', 'downloading', 'loading', 'switching'])}</b></div>
          <div><small>每小时上限</small><b>{money(perHour)}</b></div>
          <div><small>累计花费（估算）</small><b>{money(state.spent + runningCost)}</b><small className="muted">内测不限额</small></div>
        </div>
        <div className="queues">
          {['FL', 'REF'].map(k => {
            const ready = live.filter(m => m.active === k && m.status === 'ready').length, a = avg(k), rule = state.autoscale[k];
            const dual = live.filter(m => m.mode === 'both' && m.active !== k && m.status !== 'stopping').length, coming = live.filter(m => m.active === k && ['renting', 'downloading', 'loading', 'switching'].includes(m.status)).length;
            return (
              <div key={k} className={'queue ' + k.toLowerCase()}>
                <div><span className={'mode ' + k.toLowerCase()}>{MODE[k]}</span><b>{waiting(k)}</b><small>条在排队</small></div>
                <small className="muted">{ready ? `${ready} 台可接` : coming ? `${coming} 台正在准备` : dual ? `${dual} 台两用机器空下来就切过来` : waiting(k) ? '没有这种机器，排队的不会开始' : '没有机器'}{a ? ` · 平均 ${Math.round(a.sec * 60)} 秒一条（${a.n} 条样本）` : ''}</small>
                {!ready && !coming && !dual && waiting(k) > 0 && <button className="small primary" onClick={() => setStarting(k)}>开一台</button>}
                <label className="auto" title="排队到一定数量时自动开一台，有上限"><input type="checkbox" checked={rule.on} onChange={e => dispatch({type: 'autoscale', mode: k, patch: {on: e.target.checked}})} />
                  <Zap size={12} />自动加机器：排队 ≥<input type="number" min={1} max={50} value={rule.queue} onChange={e => dispatch({type: 'autoscale', mode: k, patch: {queue: +e.target.value}})} />条时加一台，最多
                  <input type="number" min={1} max={10} value={rule.max} onChange={e => dispatch({type: 'autoscale', mode: k, patch: {max: +e.target.value}})} />台</label>
              </div>);
          })}
        </div>

        {groups.filter(g => g.list.length || g.id).map(g => (
          <section key={g.id || 'none'} className="mgroup">
            <header className="row tight">
              <h3 className="sect">{g.name}</h3><small className="muted">{g.list.length} 台 · {money(g.list.reduce((n, m) => n + m.price, 0))}/小时</small>
              <div className="spacer" />
              {g.id && g.list.length > 0 && <>
                <select defaultValue="" onChange={e => { if (e.target.value) dispatch({type: 'groupKeep', group: g.id, patch: {keep: e.target.value}}); e.target.value = ''; }} title="整组统一保持方式">
                  <option value="">整组保持方式…</option><option value="idle">空闲后关机</option><option value="until">保持到某个时间</option><option value="until_stopped">一直开到手动关</option></select>
                <button className="small danger" onClick={() => dispatch({type: 'stopGroup', group: g.id})}><Square size={12} />停止整组</button></>}
            </header>
            <div className="machines-list">
              {!g.list.length && <div className="scene-empty">这个组还没有机器。启动机器时选这个组。</div>}
              {g.list.map(m => <MachineRow key={m.id} m={m} job={busy[m.id]} onOpen={setDetail} onStop={stop} />)}
            </div>
          </section>))}
        {!live.length && <div className="scene-empty">没有机器在跑。点「启动机器」开一台。</div>}

        <details className="ended" open={hostsOpen} onToggle={e => setHostsOpen(e.target.open)}>
          <summary>主机评分 · 优先 / 避开 {state.hosts.filter(h => h.tag).length} 台</summary>
          <p className="muted">每台租过的主机都记下速度和失败次数。标“优先”的以后先租，标“避开”的不再推荐。</p>
          <div className="hosts">{state.hosts.map(h => (
            <div key={h.id} className="hrow"><b>{h.provider} · {h.region}</b><span className="muted">{h.gpu} · {h.id}</span>
              <span>{h.runs} 次 · 平均 {h.avgSec}s · 失败 {h.fails}</span>
              <button className={'small' + (h.tag === 'prefer' ? ' primary' : '')} onClick={() => dispatch({type: 'hostTag', id: h.id, tag: 'prefer'})}><ThumbsUp size={12} />优先</button>
              <button className={'small' + (h.tag === 'avoid' ? ' danger' : '')} onClick={() => dispatch({type: 'hostTag', id: h.id, tag: 'avoid'})}><ThumbsDown size={12} />避开</button></div>))}</div>
        </details>
        {state.ended.length > 0 && <details className="ended"><summary>已结束 {state.ended.length} 台</summary>
          {state.ended.map(m => <div key={m.id} className="mrow ended-row"><Cpu size={18} className="mrow-icon" /><div className="mrow-main"><b>{m.gpu} · {MODE[m.mode] || m.mode}</b>
            <small className="muted">{m.region} · 运行约 {m.ranMin} 分钟 · {m.reason}</small></div></div>)}</details>}
        <p className="home-foot muted">原型：机器准备和生成都加速模拟；价格是每小时上限，不是账单。</p>
      </main>
      {starting && <StartMachine preset={starting} onClose={() => setStarting(null)} />}
      {detail && <Detail m={state.machines.find(x => x.id === detail.id) || detail} onClose={() => setDetail(null)} />}
      {stopAsk && <div className="choose-overlay" onClick={() => setStopAsk(null)}><div className="choose" onClick={e => e.stopPropagation()}>
        <div className="picker-head"><b>确定关这台？</b><button className="x" onClick={() => setStopAsk(null)}>×</button></div>
        {stopAsk.stranded.map(k => <p key={k} className="problems"><AlertCircle size={13} />{waiting(k)} 条{MODE[k]}任务会没有机器接，要等你再开一台。</p>)}
        <p className="muted">机器会先跑完手上的任务再关；排队中的任务不会丢。</p>
        <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={() => setStopAsk(null)}>先不关</button>
          <button className="danger" onClick={() => { dispatch({type: 'stopMachine', id: stopAsk.m.id}); setStopAsk(null); }}>还是关</button></div></div></div>}
    </div>
  );
}
