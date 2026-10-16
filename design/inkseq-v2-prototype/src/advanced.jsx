import React, {useState} from 'react';
import {ArrowRight, Code2, RotateCcw, Save, SlidersHorizontal, X} from 'lucide-react';

/* Every H3 control the backend accepts (h3-studio comfy_workflow.controls_metadata + capabilities.control_schema).
   Hidden by default; one click shows all of it, like iOS settings. */
const SAMPLERS = ['res_multistep', 'euler', 'euler_cfg_pp', 'euler_ancestral', 'euler_ancestral_cfg_pp', 'heun', 'heunpp2',
  'exp_heun_2_x0', 'exp_heun_2_x0_sde', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral',
  'dpmpp_2s_ancestral_cfg_pp', 'dpmpp_sde', 'dpmpp_sde_gpu', 'dpmpp_2m', 'dpmpp_2m_cfg_pp', 'dpmpp_2m_sde', 'dpmpp_2m_sde_gpu',
  'dpmpp_2m_sde_heun', 'dpmpp_2m_sde_heun_gpu', 'dpmpp_3m_sde', 'dpmpp_3m_sde_gpu', 'ddpm', 'lcm', 'ipndm', 'ipndm_v', 'deis',
  'cfgpp_ud10_ab', 'res_multistep_cfg_pp', 'res_multistep_ancestral', 'res_multistep_ancestral_cfg_pp', 'gradient_estimation',
  'gradient_estimation_cfg_pp', 'er_sde', 'seeds_2', 'seeds_3', 'sa_solver', 'sa_solver_pece', 'ddim', 'uni_pc', 'uni_pc_bh2'];
const SCHEDULERS = ['auto', 'simple', 'sgm_uniform', 'karras', 'exponential', 'ddim_uniform', 'beta', 'normal', 'linear_quadratic', 'kl_optimal'];

export const H3_GROUPS = [
  {title: '画面', fields: [
    {key: 'resolution', label: '分辨率', type: 'enum', options: ['480P', '576P', '768P', 'custom'], def: null, hint: '空着 = 草稿 480P、精修 768P。只有 768P 做过正式验收'},
    {key: 'aspect_ratio', label: '画幅', type: 'enum', options: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], def: '16:9'},
    {key: 'width', label: '自定义宽', type: 'int', min: 256, max: 1536, step: 32, def: null, when: v => v.resolution === 'custom', hint: '32 的倍数，宽×高 ≤ 768×1344，宽高比 0.4–2.5'},
    {key: 'height', label: '自定义高', type: 'int', min: 256, max: 1536, step: 32, def: null, when: v => v.resolution === 'custom'},
    {key: 'duration', label: '时长（秒）', type: 'int', min: 4, max: 15, step: 1, def: 5},
  ]},
  {title: '声音', fields: [
    {key: 'generate_audio', label: '输出声音', type: 'bool', def: true, hint: '关掉只是不导出音轨，模型仍然一起算声音'},
    {key: 'video_audio', label: '参考视频带原声', type: 'note', hint: '在每个参考视频上单独开关'},
  ]},
  {title: '采样', fields: [
    {key: 'steps', label: '步数', type: 'int', min: 1, max: 100, step: 1, def: 20, hint: '越多越慢；验收用的是 20'},
    {key: 'seed', label: '种子', type: 'seed', def: '', hint: '空着 = 每次随机。填同一个数可以复现'},
    {key: 'sampler_name', label: '采样器', type: 'enum', options: SAMPLERS, def: 'res_multistep'},
    {key: 'scheduler', label: '调度', type: 'enum', options: SCHEDULERS, def: 'auto'},
    {key: 'denoise', label: '去噪强度', type: 'num', min: 0.01, max: 1, step: 0.01, def: 1, hint: '改的是采样曲线，不是参考强度'},
    {key: 'shift_video', label: '视频 shift', type: 'num', min: 0.01, max: 100, step: 0.01, def: null, ph: '12', exp: true},
    {key: 'shift_audio', label: '音频 shift', type: 'num', min: 0.01, max: 100, step: 0.01, def: null, ph: '3', exp: true},
  ]},
  {title: '参考', fields: [
    {key: 'ref_image_size', label: '参考图尺寸', type: 'enum', options: ['max', 'match'], def: 'max', hint: 'max 用原图最大边；match 缩到输出尺寸'},
  ]},
  {title: '解码与导出', fields: [
    {key: 'video_decode', label: '视频解码', type: 'enum', options: ['normal', 'tiled'], def: 'normal', hint: '显存不够时用 tiled'},
    {key: 'video_tile_size', label: '分块大小', type: 'int', min: 64, max: 4096, step: 32, def: 512, when: v => v.video_decode === 'tiled'},
    {key: 'video_overlap', label: '分块重叠', type: 'int', min: 0, max: 4096, step: 32, def: 64, when: v => v.video_decode === 'tiled'},
    {key: 'video_temporal_size', label: '时间分块', type: 'int', min: 8, max: 4096, step: 4, def: 64, when: v => v.video_decode === 'tiled'},
    {key: 'video_temporal_overlap', label: '时间重叠', type: 'int', min: 4, max: 4096, step: 4, def: 8, when: v => v.video_decode === 'tiled'},
    {key: 'audio_decode', label: '音频解码', type: 'enum', options: ['normal'], def: 'normal'},
    {key: 'encoder_device', label: '编码设备', type: 'enum', options: ['default', 'cpu'], def: 'default'},
    {key: 'export_crf', label: '导出压缩 CRF', type: 'int', min: 0, max: 51, step: 1, def: 18, hint: '越小文件越大；不会增加画面细节'},
    {key: 'audio_tile_size', label: '音频分块', type: 'off', hint: 'H3 音频 VAE 不兼容，暂不开放'},
  ]},
];
const FIELDS = H3_GROUPS.flatMap(g => g.fields).filter(f => !['note', 'off'].includes(f.type));
const VISIBLE = ['duration', 'resolution', 'aspect_ratio']; // shown as dropdowns next to the composer
const HIDDEN = FIELDS.filter(f => !VISIBLE.includes(f.key));
export const changedCount = v => HIDDEN.filter(f => v[f.key] !== undefined && v[f.key] !== f.def && v[f.key] !== '').length;
export const changedSummary = v => HIDDEN.filter(f => v[f.key] !== undefined && v[f.key] !== f.def && v[f.key] !== '').map(f => `${f.label} ${f.type === 'bool' ? (v[f.key] ? '开' : '关') : v[f.key]}`);

function Field({f, v, set}) {
  const val = v[f.key] ?? f.def ?? '', changed = v[f.key] !== undefined && v[f.key] !== f.def && v[f.key] !== '';
  let input;
  if (f.type === 'enum') input = <select value={val ?? ''} onChange={e => set(f.key, e.target.value)}>{f.def === null && <option value="">自动</option>}{f.options.map(o => <option key={o} value={o} disabled={o.startsWith('…')}>{o}</option>)}</select>;
  else if (f.type === 'bool') input = <button className={'switch' + (val ? ' on' : '')} onClick={() => set(f.key, !val)}><i /></button>;
  else if (f.type === 'seed') input = <input inputMode="numeric" placeholder="随机" value={val} onChange={e => set(f.key, e.target.value.replace(/\D/g, '').slice(0, 20))} />;
  else if (f.type === 'note' || f.type === 'off') input = <small className="muted">{f.type === 'off' ? '不可用' : '—'}</small>;
  else input = <input type="number" min={f.min} max={f.max} step={f.step} placeholder={f.ph || '自动'} value={val ?? ''} onChange={e => set(f.key, e.target.value === '' ? null : Number(e.target.value))} />;
  return (
    <div className={'adv-row' + (changed ? ' changed' : '') + (f.type === 'off' ? ' off' : '')}>
      <div className="adv-label"><span>{f.label}{f.exp && <em>实验</em>}</span><code>{f.key}</code>{f.hint && <small>{f.hint}</small>}</div>
      <div className="adv-input">{input}{changed && <button className="x" title="恢复默认" onClick={() => set(f.key, undefined)}><RotateCcw size={12} /></button>}</div>
    </div>
  );
}

/* Right-side sheet. `base` = global defaults (shown as the starting point), `value` = this scope's overrides. */
// 「设为全局默认」etc.: buttons that copy what was chosen here to a wider scope, with a short confirmation.
function ScopeActions({actions, value}) {
  const [done, setDone] = useState('');
  if (!actions?.length) return null;
  const changed = changedCount(value) > 0 || Object.keys(value).length > 0;
  return (
    <div className="scope-actions">
      {actions.map(x => <button key={x.label} className="small" disabled={!changed} title={changed ? x.hint : '还没改任何参数'} onClick={() => { x.run(value); setDone(x.done); }}><Save size={12} />{x.label}</button>)}
      {done && <small className="okmsg">✓ {done}</small>}
    </div>
  );
}

export function AdvancedSheet({title, scope, value, base = {}, onChange, onClose, actions}) {
  const [showJson, setShowJson] = useState(false);
  const v = {...base, ...value};
  const set = (k, x) => { const n = {...value}; if (x === undefined) delete n[k]; else n[k] = x; onChange(n); };
  const json = Object.fromEntries(FIELDS.filter(f => v[f.key] !== undefined && v[f.key] !== '' && v[f.key] !== null).map(f => [f.key, v[f.key]]));
  return (
    <div className="adv-overlay" onClick={onClose}>
      <aside className="adv-sheet" onClick={e => e.stopPropagation()}>
        <div className="adv-head"><SlidersHorizontal size={16} /><b>{title}</b><div className="spacer" /><button className="x" onClick={onClose}><X size={16} /></button></div>
        <p className="muted adv-intro">{scope}　不懂可以不动，默认值就是推荐值。改过的项会高亮，点 ↺ 恢复。</p>
        <div className="adv-body">
          {H3_GROUPS.map(g => <section key={g.title}><h5>{g.title}</h5>{g.fields.filter(f => !f.when || f.when(v)).map(f => <Field key={f.key} f={f} v={v} set={set} />)}</section>)}
          <section><button className="ghost small" onClick={() => setShowJson(!showJson)}><Code2 size={13} />{showJson ? '收起' : '查看'} API 参数（controls）</button>
            {showJson && <pre className="adv-json">{JSON.stringify(json, null, 2)}</pre>}</section>
        </div>
        <div className="adv-foot"><span className="muted">已改 {changedCount(value)} 项</span><ScopeActions actions={actions} value={value} /><div className="spacer" />
          <button onClick={() => onChange({})}>全部恢复默认</button><button className="primary" onClick={onClose}>完成</button></div>
      </aside>
    </div>
  );
}

/* Inline version for narrow side panels (the shot editor): unfolds in place under the 高级 button instead of
   covering the panel. Groups start folded; a group with changes opens and says how many. 时长/分辨率/画幅 are
   already visible as dropdowns, so they are left out here. */
export function AdvancedInline({value, base = {}, onChange, onClose, actions}) {
  const [showJson, setShowJson] = useState(false);
  const v = {...base, ...value};
  const set = (k, x) => { const n = {...value}; if (x === undefined) delete n[k]; else n[k] = x; onChange(n); };
  const json = Object.fromEntries(FIELDS.filter(f => v[f.key] !== undefined && v[f.key] !== '' && v[f.key] !== null).map(f => [f.key, v[f.key]]));
  return (
    <div className="adv-inline">
      <div className="row tight"><SlidersHorizontal size={14} /><b>高级参数</b><small className="muted">只改这个镜头 · 默认就是推荐值</small><div className="spacer" />
        {changedCount(value) > 0 && <button className="small ghost" onClick={() => onChange({})}><RotateCcw size={12} />全部恢复</button>}
        <button className="small" onClick={onClose}>收起</button></div>
      {H3_GROUPS.map(g => {
        const fields = g.fields.filter(f => !VISIBLE.includes(f.key) && (!f.when || f.when(v)));
        if (!fields.length) return null;
        const n = fields.filter(f => value[f.key] !== undefined && value[f.key] !== f.def && value[f.key] !== '').length;
        return (
          <details key={g.title} open={n > 0}><summary>{g.title}{n > 0 && <em> · 已改 {n}</em>}<small className="muted"> {fields.map(f => f.label).join('、')}</small></summary>
            {fields.map(f => <Field key={f.key} f={f} v={v} set={set} />)}</details>);
      })}
      <ScopeActions actions={actions} value={value} />
      <button className="ghost small" onClick={() => setShowJson(!showJson)}><Code2 size={13} />{showJson ? '收起' : '查看'} API 参数</button>
      {showJson && <pre className="adv-json">{JSON.stringify(json, null, 2)}</pre>}
    </div>
  );
}

/* First/last-frame strip: ① start → guides at times → ② end. H3 FL takes first + last + up to 8 guides. */
export function FrameStrip({items, roles, duration = 5, onRole, onRemove, readOnly}) {
  const first = items.find(a => roles[a.id]?.role === 'first'), last = items.find(a => roles[a.id]?.role === 'last');
  const guides = items.filter(a => roles[a.id]?.role === 'guide').sort((a, b) => roles[a.id].t - roles[b.id].t);
  const Thumb = ({a, tag}) => a ? <span className="fs-thumb"><img src={a.thumb} alt="" /><b>{tag}</b></span> : <span className="fs-thumb empty"><b>{tag}</b><small>不放也行</small></span>;
  return (
    <div className="fstrip">
      <div className="fs-track">
        <div className="fs-end"><Thumb a={first} tag="1 开头" /><small>0s</small></div>
        <div className="fs-mid">
          <div className="fs-line"><ArrowRight size={14} /></div>
          {guides.map(a => <span key={a.id} className="fs-guide" style={{left: `${(roles[a.id].t / duration) * 100}%`}} title={a.name}><img src={a.thumb} alt="" /><small>{roles[a.id].t}s</small></span>)}
        </div>
        <div className="fs-end"><Thumb a={last} tag="2 结尾" /><small>{duration}s</small></div>
      </div>
      {!readOnly && items.length > 0 && <div className="fs-roles">{items.map(a => (
        <span key={a.id} className="ref"><img src={a.thumb} alt="" />{a.name}
          <select value={roles[a.id]?.role || 'guide'} onChange={e => onRole(a.id, {role: e.target.value})}><option value="first">开头</option><option value="guide">中间</option><option value="last">结尾</option></select>
          {roles[a.id]?.role === 'guide' && <input className="fs-t" type="number" min={0} max={duration} step={0.5} value={roles[a.id].t} onChange={e => onRole(a.id, {t: Number(e.target.value)})} />}
          {roles[a.id]?.role === 'guide' && <small>秒</small>}
          {onRemove && <button className="x" onClick={() => onRemove(a.id)}><X size={12} /></button>}
        </span>))}</div>}
      {!readOnly && <small className="muted">首尾帧：1 张 = 开头，2 张 = 开头 → 结尾，再多的作为中间关键帧（最多 8 张，可设在第几秒）。不放图只写字也能生成。</small>}
    </div>
  );
}

// Default roles: in order 开头, 结尾, then guides spaced evenly.
export function autoRoles(items, duration = 5, prev = {}) {
  // Images fill 开头, 结尾, then middle frames. Video clips and audio can only be middle anchors (H3 guides).
  const out = {}, frames = items.filter(a => ['image', 'video', 'audio'].includes(a.kind));
  const taken = r => Object.values(out).some(x => x.role === r);
  frames.forEach(a => { if (prev[a.id]) out[a.id] = prev[a.id]; });
  frames.filter(a => !out[a.id]).forEach(a => {
    out[a.id] = a.kind === 'image' && !taken('first') ? {role: 'first', t: 0} : a.kind === 'image' && !taken('last') ? {role: 'last', t: duration} : {role: 'guide', t: 0, fresh: true};
  });
  const g = frames.filter(a => out[a.id].fresh);
  g.forEach((a, i) => { out[a.id] = {role: 'guide', t: a.kind === 'image' ? Math.round(((i + 1) * duration) / (g.length + 1) * 2) / 2 : 0}; });
  return out;
}
