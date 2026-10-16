import React from 'react';
import {Volume2, VolumeX, X} from 'lucide-react';

/* Input pieces shared by 快速创作 and the story shot editor. */
export const roleLabel = r => (r.role === 'first' ? '1 开头' : r.role === 'last' ? '2 结尾' : `第 ${r.t}s`);
// FL: show chips in time order 开头 → 中间 → 结尾; non-frame items (audio) go last.
export const orderFL = (atts, roles) => [...atts].sort((a, b) => {
  const k = x => (!roles[x.id] ? 99 : roles[x.id].role === 'first' ? -1 : roles[x.id].role === 'last' ? 50 : roles[x.id].t);
  return k(a) - k(b);
});

/* One attachment in the composer. Shows only what applies to it:
   首尾帧 → its place on the timeline; video/audio → which seconds to use; video → keep its sound or not. */
export function Chip({a, mode, role, dur, opt, editing, setEditing, setRole, setT, setOpt, onRemove}) {
  const media = a.kind === 'video' || a.kind === 'audio', len = a.seconds || 3;
  const range = opt.range || [0, Math.min(len, 3)];
  // H3 defaults: reference videos keep their sound (video_audio), timeline video anchors don't (use_audio).
  const sound = opt.sound ?? (mode === 'REF');
  const key = k => a.id + ':' + k;
  // H3 rejects an anchor that runs past the end of the clip, so flag it here instead of failing later.
  const over = mode === 'FL' && media && role?.role === 'guide' && role.t + (range[1] - range[0]) > dur;
  return (
    <span className="ref">{a.kind === 'audio' ? '♪' : <img src={a.thumb} alt="" />}{a.name}
      {mode === 'FL' && role && (editing === key('role')
        ? <span className="role-edit">{(a.kind === 'image' ? ['first', 'guide', 'last'] : ['guide']).map(k => <button key={k} className={role.role === k ? 'on' : ''} onClick={() => setRole(k)}>{{first: '开头', guide: '中间', last: '结尾'}[k]}</button>)}
            {role.role === 'guide' && <>第<input type="number" min={0} max={dur - 0.5} step={0.5} value={role.t} onChange={e => setT(Number(e.target.value))} />秒</>}
            <button onClick={() => setEditing(null)}>好</button></span>
        : <b className="role-tag click" title={a.kind === 'image' ? '点一下改：开头 / 中间第几秒 / 结尾' : '视频和声音只能放在中间，点一下改从第几秒开始'} onClick={() => setEditing(key('role'))}>{roleLabel(role)}</b>)}
      {media && (editing === key('range')
        ? <span className="role-edit">用<input type="number" min={0} max={len} step={0.5} value={range[0]} onChange={e => setOpt({range: [Number(e.target.value), range[1]]})} />–<input type="number" min={0} max={len} step={0.5} value={range[1]} onChange={e => setOpt({range: [range[0], Number(e.target.value)]})} />秒<button onClick={() => setEditing(null)}>好</button></span>
        : <b className={'opt-tag click' + (over ? ' bad' : '')} title={over ? `从第 ${role.t} 秒开始放不下，会超出 ${dur} 秒的结尾` : `原素材 ${len} 秒，点一下选用哪几秒`} onClick={() => setEditing(key('range'))}>{range[0]}–{range[1]}s</b>)}
      {a.kind === 'video' && <button className={'opt-tag sound' + (sound ? ' on' : '')} title={sound ? '带原声，点一下静音' : '不带原声，点一下带上'} onClick={() => setOpt({sound: !sound})}>{sound ? <Volume2 size={11} /> : <VolumeX size={11} />}</button>}
      <button className="x" onClick={onRemove}><X size={12} /></button></span>
  );
}

/* What H3 will reject, checked before sending (h3-studio capabilities.LIMITS + comfy_workflow input rules). */
const LIMITS = {image: 9, video: 3, audio: 3, total: 12, mediaTotal: 15, guides: 8};
const KIND = {image: '图片', video: '视频', audio: '声音'};
export function checkInputs(mode, atts, roles = {}, aopt = {}, dur = 5) {
  const out = [], n = k => atts.filter(a => a.kind === k).length;
  const span = a => { const r = aopt[a.id]?.range || [0, Math.min(a.seconds || 3, 3)]; return r[1] - r[0]; };
  for (const a of atts) if (a.kind !== 'image') {
    const [s0, s1] = aopt[a.id]?.range || [0, Math.min(a.seconds || 3, 3)];
    if (s1 - s0 < 2) out.push(`「${a.name}」至少要用 2 秒`);
    else if (s1 > (a.seconds || 3)) out.push(`「${a.name}」只有 ${a.seconds} 秒`);
  }
  if (mode === 'REF') {
    if (!atts.length) out.push('全能参考至少要放一个素材；只写文字请用首尾帧');
    ['image', 'video', 'audio'].forEach(k => { if (n(k) > LIMITS[k]) out.push(`${KIND[k]}最多 ${LIMITS[k]} 个，现在 ${n(k)} 个`); });
    if (atts.length > LIMITS.total) out.push(`素材最多 ${LIMITS.total} 个`);
    ['video', 'audio'].forEach(k => { const t = atts.filter(a => a.kind === k).reduce((x, a) => x + span(a), 0); if (t > LIMITS.mediaTotal) out.push(`${KIND[k]}合计最多 ${LIMITS.mediaTotal} 秒，现在 ${t} 秒`); });
  } else {
    const g = atts.filter(a => roles[a.id]?.role === 'guide');
    if (g.length > LIMITS.guides) out.push(`中间帧最多 ${LIMITS.guides} 个`);
    for (const a of g) if (a.kind !== 'image' && roles[a.id].t + span(a) > dur) out.push(`「${a.name}」从第 ${roles[a.id].t} 秒放会超出 ${dur} 秒结尾`);
    for (const a of g) if (roles[a.id].t >= dur) out.push(`「${a.name}」的时间超出了 ${dur} 秒`);
  }
  return out;
}

// 时长 · 分辨率 · 画幅 as three small dropdowns; a choice writes the same H3 control the 高级 sheet edits.
export function SpecPicker({quality, c, onChange, disabled}) {
  const set = (k, v) => onChange(k, v);
  const autoRes = quality === 'final' ? '768P' : '480P';
  return (
    <span className="spec">
      <select disabled={disabled} value={c.duration ?? 5} onChange={e => set('duration', Number(e.target.value))} title="时长">
        {Array.from({length: 12}, (_, i) => i + 4).map(n => <option key={n} value={n}>{n} 秒</option>)}</select>
      <select disabled={disabled} value={c.resolution || ''} onChange={e => set('resolution', e.target.value || undefined)} title="分辨率；自定义宽高在「高级」里填">
        <option value="">{autoRes}</option>{['480P', '576P', '768P'].filter(r => r !== autoRes).map(r => <option key={r} value={r}>{r}</option>)}
        <option value="custom">{c.resolution === 'custom' && c.width && c.height ? `${c.width}×${c.height}` : '自定义…'}</option></select>
      <select disabled={disabled} value={c.aspect_ratio || '16:9'} onChange={e => set('aspect_ratio', e.target.value)} title="画幅">
        {['16:9', '9:16', '21:9', '4:3', '3:4', '1:1'].map(r => <option key={r} value={r}>{r}</option>)}</select>
    </span>
  );
}

