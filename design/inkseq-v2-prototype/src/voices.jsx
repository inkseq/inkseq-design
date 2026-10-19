import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {AudioLines, Check, Film, Mic, Plus, Sparkles, Trash2, Upload, Volume2, Wand2, X} from 'lucide-react';
import {useStore} from './store.jsx';
import {fmtCredits} from './model.js';

// 声音 (prototype). A Voice is a reusable library object: characters, look overrides, story narrators and
// dialogue lines reference it by id. Production: VoxCPM2 on our GPU workers designs/clones voices and
// speaks lines; the line audio is sent to H3 as the audio reference (lip-sync) or mixed in at film time.
// Here the browser's speech synthesis stands in for audition only.

export const VOICE_KIND = {designed: ['描述设计', Wand2], cloned: ['克隆', Mic], take: ['从视频提取', Film], preset: ['预设', AudioLines]};
export const EMOTIONS = [['', '自然'], ['calm', '平静'], ['happy', '开心'], ['sad', '难过'], ['angry', '生气'], ['scared', '害怕'], ['whisper', '低声'], ['shout', '喊']];
// Dialogue credits: line audio is cheap next to video. ~2 credits per 10 s of speech (admin setting).
export const lineSeconds = text => Math.max(1, Math.round((text || '').replace(/\s/g, '').length / 4));
export const voiceCredits = lines => Math.ceil(lines.reduce((n, l) => n + lineSeconds(l.text), 0) / 10 * 2);

// Audition with the browser voice (prototype only).
export function speak(voice, text, emotion) {
  try {
    const synth = window.speechSynthesis; if (!synth || !voice) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text || voice.sampleText || '你好，这是我的声音。');
    const lang = voice.lang === 'en' ? 'en' : 'zh';
    const pool = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang));
    if (pool.length) u.voice = pool[(voice.seed || 0) % pool.length];
    u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    const e = {happy: [1.15, 1.08], sad: [0.85, 0.9], angry: [1.05, 1.15], scared: [1.2, 1.15], whisper: [1, 0.85], shout: [1.1, 1.2], calm: [0.95, 0.95]}[emotion] || [1, 1];
    u.pitch = Math.min(2, (voice.pitch ?? 1) * e[0]); u.rate = Math.min(2, (voice.rate ?? 1) * e[1]); u.volume = emotion === 'whisper' ? 0.5 : 1;
    synth.speak(u);
  } catch {}
}

export const usedBy = (state, voiceId) => ({
  characters: state.profiles.filter(p => p.voiceId === voiceId || p.variants?.some(v => v.voiceId === voiceId)),
  stories: state.stories.filter(s => s.settings?.narratorVoice === voiceId),
  lines: state.shots.reduce((n, s) => n + (s.lines || []).filter(l => l.voiceId === voiceId).length, 0),
});

export function KindBadge({kind}) {
  const [l, I] = VOICE_KIND[kind] || VOICE_KIND.preset;
  return <span className={'vkind ' + kind}><I size={11} />{l}</span>;
}

export function PlayVoice({voice, text, emotion, label}) {
  return <button className="small ghost play-voice keep-label" disabled={!voice} title="试听" onClick={e => { e.stopPropagation(); speak(voice, text, emotion); }}><Volume2 size={13} />{label}</button>;
}

/* ---------- picker: used by characters, looks, narrator, dialogue ---------- */
export function VoicePicker({value, onChange, suggest, allowNone = true, noneLabel = '不指定（模型自己配，每个镜头可能不一样）', emptyLabel, compact}) {
  const {state} = useStore();
  const [open, setOpen] = useState(false), [creating, setCreating] = useState(false);
  const voices = state.voices.filter(v => !v.trashedAt);
  const cur = voices.find(v => v.id === value);
  const box = useRef();
  useEffect(() => { if (!open) return; const h = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); }; document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h); }, [open]);
  return <div className={'vpicker' + (compact ? ' compact' : '')} ref={box}>
    <button className={'vpick-btn keep-label' + (cur ? '' : ' empty')} onClick={() => setOpen(!open)}>
      <AudioLines size={14} /><span className="clip">{cur ? cur.name : emptyLabel || (allowNone ? '还没有音色' : '选一个音色')}</span>{cur && <KindBadge kind={cur.kind} />}</button>
    {cur && <PlayVoice voice={cur} />}
    {open && <div className="vpick-menu">
      <button className="vpick-new keep-label" onClick={() => { setOpen(false); setCreating(true); }}><Plus size={14} />新建音色{suggest?.desc ? <small>按「{suggest.desc.slice(0, 18)}」设计</small> : null}</button>
      {voices.map(v => <div key={v.id} className={'vpick-row' + (v.id === value ? ' on' : '')} onClick={() => { onChange(v.id); setOpen(false); }}>
        <span className="clip"><b>{v.name}</b><small className="muted">{v.desc}</small></span><KindBadge kind={v.kind} /><PlayVoice voice={v} />
        {v.id === value && <Check size={14} />}</div>)}
      {allowNone && <div className={'vpick-row none' + (!value ? ' on' : '')} onClick={() => { onChange(null); setOpen(false); }}><span>{noneLabel}</span></div>}
    </div>}
    {creating && <VoiceCreator initial={suggest} onClose={() => setCreating(false)} onDone={id => { onChange(id); setCreating(false); }} />}
  </div>;
}

/* ---------- create: describe / clone / from a take / preset ---------- */
const PITCH_HINTS = [[/男|male|man|大叔|老人|低沉|deep/i, 0.75], [/女|female|woman|girl|少女|清亮|bright/i, 1.25], [/孩|童|kid|child|少年/i, 1.5], [/老|old|elder|花白|沙哑/i, 0.7]];
const guess = desc => { let p = 1; for (const [re, v] of PITCH_HINTS) if (re.test(desc || '')) p = v; return p; };

export function VoiceCreator({initial, onClose, onDone}) {
  const {state, dispatch, toast} = useStore();
  const [tab, setTab] = useState(initial?.tab || 'design');
  const [name, setName] = useState(initial?.name || ''), [desc, setDesc] = useState(initial?.desc || ''), [lang, setLang] = useState('zh');
  const [cands, setCands] = useState([]), [pick, setPick] = useState(null), [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null), [transcript, setTranscript] = useState(''), [consent, setConsent] = useState(false), [rec, setRec] = useState(false);
  const [take, setTake] = useState(initial?.take || null), [span, setSpan] = useState([1, 6]);
  const sample = lang === 'en' ? 'Hello, this is how I sound.' : '你好，我会用这个声音说你写的台词。';
  const takes = useMemo(() => state.shots.flatMap(s => s.versions.filter(v => v.status === 'done').map(v => ({key: s.id + ':' + v.id, label: `${s.title} · 第 ${v.n} 条`, shot: s, v}))).slice(0, 30), [state.shots]);
  const design = () => { setBusy(true); setPick(null); setTimeout(() => { const base = guess(desc); setCands([0, 1, 2].map(i => ({i, pitch: +(base * [0.92, 1, 1.1][i]).toFixed(2), rate: [0.95, 1, 1.05][i], seed: i + 1}))); setBusy(false); }, 700); };
  const save = voice => { const id = 'vo' + Math.random().toString(36).slice(2, 7); dispatch({type: 'voiceCreate', voice: {id, lang, sampleText: sample, createdAt: Date.now(), ...voice}}); toast(`音色「${voice.name}」已存进素材库`); onDone?.(id); };
  const ok = {design: name.trim() && pick != null, clone: name.trim() && file && consent, take: name.trim() && take, preset: false}[tab];
  const presets = state.voices.filter(v => v.kind === 'preset' && !v.trashedAt);
  const tabs = [['design', '用文字描述', Wand2], ['clone', '上传或录音克隆', Mic], ['take', '从生成的视频里取', Film], ['preset', '预设声音', AudioLines]];
  const submit = () => {
    if (tab === 'design') { const c = cands[pick]; save({name: name.trim(), kind: 'designed', desc, pitch: c.pitch, rate: c.rate, seed: c.seed}); }
    if (tab === 'clone') save({name: name.trim(), kind: 'cloned', desc: desc || '克隆自上传的声音', pitch: 1, rate: 1, seed: 4, source: {file: file.name, transcript: transcript || null},
      consent: {at: Date.now(), statement: '这是我本人的声音，或我已取得声音主人的同意'}});
    if (tab === 'take') { const t = takes.find(x => x.key === take); save({name: name.trim(), kind: 'take', desc: desc || `取自「${t?.label}」第 ${span[0]}–${span[1]} 秒`, pitch: guess(desc) || 1, rate: 1, seed: 5, source: {take, span}}); }
  };
  // Portal: opened from inside the profile / shot panels, which create their own stacking context.
  return createPortal(<div className="choose-overlay" onClick={onClose}><div className="choose vcreator" onClick={e => e.stopPropagation()}>
    <div className="picker-head"><b><AudioLines size={16} /> 新建音色</b><button className="x" onClick={onClose}>×</button></div>
    <p className="muted">做好的音色存在素材库「音色」里，可以给多个人物、多个故事用。生成镜头时，台词会用它来配音，同一个人物每个镜头听起来都一样。</p>
    <div className="seg vtabs2">{tabs.map(([k, l, I]) => <button key={k} className={'keep-label' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}><I size={13} />{l}</button>)}</div>

    {tab !== 'preset' && <div className="row">
      <label className="field" style={{flex: 2}}><span>名字</span><input value={name} onChange={e => setName(e.target.value)} placeholder="例如：林岚的声音、旁白·温柔" /></label>
      <label className="field small"><span>主要语言</span><div className="seg">{[['zh', '中文'], ['en', 'English']].map(([k, l]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{l}</button>)}</div></label></div>}

    {tab === 'design' && <>
      <label className="field"><span>描述这个声音 · 年龄、性别、音色、语气、口音都可以写</span>
        <textarea rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="例如：25 岁女性，声音清亮偏冷，说话慢、很克制，带一点南方口音" /></label>
      <div className="row tight"><button className="primary" disabled={!desc.trim() || busy} onClick={design}><Sparkles size={14} />{busy ? '正在设计…' : cands.length ? '再来 3 个' : '设计 3 个候选'}</button>
        <small className="muted">试听免费；不满意就改描述再来</small></div>
      {cands.length > 0 && <div className="vcands">{cands.map((c, i) => <button key={i} className={'vcand keep-label' + (pick === i ? ' on' : '')} onClick={() => { setPick(i); speak({...c, lang}, sample); }}>
        <Volume2 size={14} /><b>候选 {i + 1}</b><small>{['偏低一些', '居中', '偏亮一些'][i]}</small>{pick === i && <Check size={14} />}</button>)}</div>}
    </>}

    {tab === 'clone' && <>
      <div className="vclone">
        <label className="vdrop"><Upload size={18} /><b>{file ? file.name : '上传一段清楚的说话录音'}</b><small>10–60 秒最好，只有一个人在说话，没有背景音乐</small>
          <input type="file" accept="audio/*,video/*" hidden onChange={e => setFile(e.target.files[0] || null)} /></label>
        <button className={'vrec keep-label' + (rec ? ' on' : '')} onClick={() => { if (rec) { setRec(false); setFile({name: '录音 ' + new Date().toLocaleTimeString()}); } else setRec(true); }}>
          <Mic size={18} />{rec ? '录音中… 点这里停止' : '用麦克风录一段'}<small>读下面这段话就行</small></button>
      </div>
      {rec && <div className="vscript">「今天天气不错，我想把这个故事讲给你听。有些话，说出来就再也收不回去了。」</div>}
      <label className="field"><span>录音里说的文字（可选，填了更像）</span><input value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="把录音内容逐字写下来" /></label>
      <label className="check vconsent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>这是<b>我本人的声音</b>，或者我<b>已经取得声音主人的同意</b>。我知道不能克隆名人、动漫角色或别人的声音，违规会被删除并停用账号。</span></label>
    </>}

    {tab === 'take' && <>
      <p className="muted">有时候模型自己配的声音正好合适。把它留下来，以后这个人物的每个镜头都用这个声音，就不会每次变样。</p>
      <label className="field"><span>选一条生成好的视频</span>
        <select value={take || ''} onChange={e => setTake(e.target.value || null)}><option value="">选择…</option>{takes.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
      {take && <label className="field"><span>取第 {span[0]}–{span[1]} 秒（只有这个人在说话的一段，3–10 秒）</span>
        <div className="row tight"><input type="range" min={0} max={8} step={0.5} value={span[0]} onChange={e => setSpan([+e.target.value, Math.max(+e.target.value + 3, span[1])])} />
          <input type="range" min={3} max={10} step={0.5} value={span[1]} onChange={e => setSpan([Math.min(span[0], +e.target.value - 3), +e.target.value])} /></div>
        <small className="muted">会自动去掉背景音和音乐，只保留人声。</small></label>}
      <label className="field"><span>描述（可选）</span><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="例如：老陈，沙哑、慢" /></label>
    </>}

    {tab === 'preset' && <div className="vpresets">{presets.map(v => <div key={v.id} className="vpreset"><span><b>{v.name}</b><small className="muted">{v.desc}</small></span>
      <PlayVoice voice={v} label="试听" /><button className="small primary" onClick={() => { onDone?.(v.id); }}>用这个</button></div>)}</div>}

    {tab !== 'preset' && <div className="row tight" style={{justifyContent: 'flex-end'}}><button onClick={onClose}>取消</button>
      <button className="primary" disabled={!ok} onClick={submit}><Check size={14} />存为音色</button></div>}
  </div></div>, document.body);
}

/* ---------- library view ---------- */
export function VoiceLibrary({q}) {
  const {state, dispatch, trash} = useStore();
  const [creating, setCreating] = useState(false), [tryText, setTryText] = useState({});
  const list = state.voices.filter(v => !v.trashedAt && (!q || (v.name + v.desc).includes(q)));
  return <>
    <div className="vlib-head"><p className="muted">音色可以给多个人物、多个故事用。人物档案里选好音色以后，台词会自动用它配音。</p>
      <button className="primary" onClick={() => setCreating(true)}><Plus size={15} />新建音色</button></div>
    <div className="vlib">{list.map(v => { const u = usedBy(state, v.id); return <div key={v.id} className="vcard">
      <div className="row tight"><AudioLines size={16} />{v.kind === 'preset' ? <b className="vname fixed clip">{v.name}</b>
        : <input className="vname" value={v.name} onChange={e => dispatch({type: 'voiceUpdate', id: v.id, patch: {name: e.target.value}})} />}<KindBadge kind={v.kind} /></div>
      <small className="muted clip2">{v.desc}</small>
      <div className="row tight"><input className="vtry" placeholder="试读一句…" value={tryText[v.id] || ''} onChange={e => setTryText({...tryText, [v.id]: e.target.value})}
        onKeyDown={e => { if (e.key === 'Enter') speak(v, tryText[v.id]); }} /><PlayVoice voice={v} text={tryText[v.id]} label="试听" /></div>
      <div className="vused">{!u.characters.length && !u.stories.length && <small className="muted">还没用过</small>}
        {u.characters.length > 0 && <small><span className="muted">人物</span> {u.characters.map(p => p.name).join('、')}</small>}
        {u.stories.length > 0 && <small><span className="muted">旁白</span> {u.stories.length > 2 ? `${u.stories.length} 个故事` : u.stories.map(s => s.title).join('、')}</small>}</div>
      {v.consent && <small className="muted">已确认授权 · {new Date(v.consent.at).toLocaleDateString()}</small>}
      {v.kind !== 'preset' && <button className="small ghost danger" onClick={() => trash({kind: 'voice', id: v.id}, v.name)}><Trash2 size={12} />移到回收站</button>}
    </div>; })}</div>
    {creating && <VoiceCreator onClose={() => setCreating(false)} onDone={() => setCreating(false)} />}
  </>;
}

/* ---------- dialogue lines in the shot editor ---------- */
export function DialogueLines({shot, upd, mode}) {
  const {state, dispatch, db} = useStore();
  const [creatingFor, setCreatingFor] = useState(null);
  const lines = shot.lines || [];
  const story = db.story(shot.storyId), narrator = story?.settings?.narratorVoice;
  const cast = shot.cast.map(c => db.profile(c.id)).filter(Boolean);
  const voiceOf = l => l.voiceId || (l.who === 'narrator' ? narrator : (() => { const p = db.profile(l.who); if (!p) return null; const c = shot.cast.find(x => x.id === p.id); const v = p.variants.find(x => x.id === c?.variant); return v?.voiceId || p.voiceId; })());
  const set = next => upd({lines: next, dialogue: next.map(l => l.text).filter(Boolean).join(' ')});
  const patch = (id, p) => set(lines.map(l => (l.id === id ? {...l, ...p} : l)));
  const add = () => set([...lines, {id: 'l' + Math.random().toString(36).slice(2, 7), who: cast[0]?.id || 'narrator', text: '', emotion: ''}]);
  const missing = [...new Set(lines.filter(l => l.text && !voiceOf(l)).map(l => l.who))];
  const spoken = lines.filter(l => l.text && l.who !== 'narrator');
  const sm = shot.soundMode || (spoken.some(voiceOf) ? 'lipsync' : 'model');
  const cost = voiceCredits(lines.filter(l => l.text && voiceOf(l)));
  return <div className="field dlines"><span className="row tight">台词和旁白 · 每句自动用说话人的声音配音，也会生成字幕<span className="spacer" /><button className="small ghost" onClick={add}><Plus size={13} />加一句</button></span>
    {lines.map(l => { const vid = voiceOf(l), v = state.voices.find(x => x.id === vid); return <div key={l.id} className="dline">
      <div className="dline-head">
        <select className="dwho" value={l.who} onChange={e => patch(l.id, {who: e.target.value, voiceId: null})}>
          {cast.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="narrator">旁白</option>
          {l.who !== 'narrator' && !cast.some(p => p.id === l.who) && <option value={l.who}>{db.profile(l.who)?.name || '（不在这一镜）'}</option>}</select>
        <select className="demo" value={l.emotion || ''} onChange={e => patch(l.id, {emotion: e.target.value})}>{EMOTIONS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        {v ? <span className="dvoice clip" title="用这个声音配音"><AudioLines size={12} />{v.name}</span> : <span className="dnovoice">没有声音</span>}
        <span className="spacer" />
        {v && <PlayVoice voice={v} text={l.text} emotion={l.emotion} label="试听" />}
        <button className="x" title="删掉这句" onClick={() => set(lines.filter(x => x.id !== l.id))}>×</button>
      </div>
      <textarea className="dtext" rows={1} value={l.text} onChange={e => patch(l.id, {text: e.target.value})} placeholder={l.who === 'narrator' ? '旁白说什么' : '这句台词'} />
    </div>; })}
    {!lines.length && <div className="slot-empty">没有台词。加一句以后，人物开口说的话会和配音对上。</div>}
    {missing.length > 0 && <div className="dmissing">{missing.map(w => { const p = w === 'narrator' ? null : db.profile(w); return <span key={w}>
      {p ? <>「{p.name}」还没有音色，模型会自己配，每个镜头可能不一样。</> : <>这个故事还没设旁白声音。</>}
      <button className="small" onClick={() => setCreatingFor(w)}><AudioLines size={13} />{p ? `给${p.name}配一个音色` : '选旁白音色'}</button></span>; })}</div>}
    {lines.some(l => l.text) && <div className="dmode">
      <span className="muted">声音怎么用：</span>
      <div className="seg">{[['lipsync', '对口型', '把配音交给模型，人物开口和台词对上'], ['overlay', '后期叠加', '画面先生成，配音在成片时叠上，适合画外音'], ['model', '模型自己配', '不用配音，声音可能每个镜头都不一样']].map(([k, t, h]) =>
        <button key={k} title={h} className={sm === k ? 'on' : ''} disabled={k === 'lipsync' && !spoken.some(voiceOf)} onClick={() => upd({soundMode: k})}>{t}</button>)}</div>
      {cost > 0 && sm !== 'model' && <small className="muted">配音约 {fmtCredits(cost)}，和视频一起扣</small>}
      {sm === 'lipsync' && mode === 'FL' && <small className="muted">首尾帧也支持声音参考，配音会放在第 0 秒</small>}
    </div>}
    {creatingFor && (() => { const p = creatingFor === 'narrator' ? null : db.profile(creatingFor); return <VoiceCreator initial={p ? {name: `${p.name}的声音`, desc: p.desc} : {name: '旁白', tab: 'preset'}} onClose={() => setCreatingFor(null)}
      onDone={id => { if (p) dispatch({type: 'profile', id: p.id, patch: {voiceId: id}}); else dispatch({type: 'storySettings', id: shot.storyId, patch: {narratorVoice: id}}); setCreatingFor(null); }} />; })()}
  </div>;
}
