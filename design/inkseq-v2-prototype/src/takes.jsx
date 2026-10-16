import React, {useRef, useState} from 'react';
import {Columns2, Maximize2, Minimize2, Play, RotateCcw, Star, Trash2} from 'lucide-react';
import {MODELS, RECIPE_KEYS} from './model.js';
import {useStore} from './store.jsx';

// What a version was made with, so versions can be compared and an old one's setup brought back.
const LABEL = {script: '剧本', prompt: '动作描述', cast: '人物/造型', place: '场景', props: '道具', refs: '参考素材', start: '开头画面', end: '结尾画面',
  guides: '中间参考', picks: '选用的照片/声音', duration: '时长', mode: '生成方式', controls: '高级参数', continuePrev: '接上一镜'};
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function diffText(v, prev) {
  if (!prev || !v.recipe || !prev.recipe) return '';
  const changed = RECIPE_KEYS.filter(k => !same(v.recipe[k], prev.recipe[k])).map(k => LABEL[k]);
  if (v.quality !== prev.quality) changed.push(MODELS[v.quality].label);
  if (!changed.length) return v.sameSeedAs ? '同样设置、同一种子' : '同样设置，换了随机种子';
  return '改了' + changed.join('、');
}

function Thumb({v, onClick, children, className = ''}) {
  return (
    <div className={'take ' + className} onClick={onClick}>
      {v.status === 'done' ? <video src={`/clips/${v.clip}.mp4`} poster={`/clips/${v.clip}-first.jpg`} muted loop playsInline preload="none"
        onMouseEnter={e => e.currentTarget.play().catch(() => {})} onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
        : <div className="take-wait">{v.status === 'queued' ? '排队中' : <>生成中 {Math.round(v.progress * 100)}%<i style={{width: `${Math.round(v.progress * 100)}%`}} /></>}</div>}
      {children}
    </div>
  );
}

export function Takes({shot, wide, onWide, viewing, setPreview, saveFrame}) {
  const {dispatch, trash} = useStore();
  const [onlyStar, setOnlyStar] = useState(false), [compare, setCompare] = useState([]), [comparing, setComparing] = useState(false);
  const pair = useRef([]);
  const vs = shot.versions, done = vs.filter(v => v.status === 'done'), running = vs.length - done.length;
  const list = [...vs].reverse().filter(v => !onlyStar || v.star);
  const prevOf = v => vs[vs.indexOf(v) - 1];
  const choose = v => dispatch({type: 'choose', shot: shot.id, version: v.id});
  const star = v => dispatch({type: 'versionPatch', shot: shot.id, version: v.id, patch: {star: !v.star}});
  const del = v => { if (viewing?.id === v.id) setPreview(null); setCompare(c => c.filter(x => x !== v.id)); trash({kind: 'version', id: v.id, shotId: shot.id}, `${shot.title} v${v.n}`); };
  const restore = v => dispatch({type: 'update', id: shot.id, patch: {...v.recipe, quality: v.quality}});
  const pickCompare = v => setCompare(c => (c.includes(v.id) ? c.filter(x => x !== v.id) : [...c, v.id].slice(-2)));
  const cmp = compare.map(id => vs.find(v => v.id === id)).filter(Boolean);
  const playBoth = () => pair.current.forEach(el => { if (el) { el.currentTime = 0; el.play().catch(() => {}); } });

  const big = (v, i) => v?.status === 'done'
    ? <video ref={el => { if (i != null) pair.current[i] = el; }} key={v.id} src={`/clips/${v.clip}.mp4`} controls loop autoPlay muted playsInline />
    : <div className="ed-preview-empty">{running ? '生成中…' : '还没有版本，写好右边的内容后点生成'}</div>;

  const head = <div className="takes-head">
    <b>版本</b><small className="muted">{vs.length} 个{running ? ` · ${running} 个在生成` : ''}</small>
    <div className="spacer" />
    {wide && done.length > 1 && <button className={'small ghost' + (comparing ? ' on' : '')} onClick={() => { setComparing(!comparing); setCompare(comparing ? [] : [shot.chosen, viewing?.id].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 2)); }}><Columns2 size={13} />{comparing ? '退出对比' : '并排对比'}</button>}
    {vs.some(v => v.star) && <button className={'small ghost' + (onlyStar ? ' on' : '')} onClick={() => setOnlyStar(!onlyStar)}><Star size={13} />只看收藏</button>}
    <button className="small ghost" onClick={onWide} title={wide ? '收起成侧栏' : '展开：大预览，所有版本平铺，可并排对比'}>{wide ? <><Minimize2 size={13} />收起</> : <><Maximize2 size={13} />展开</>}</button>
  </div>;

  if (!wide) return <>
    <div className="ed-preview">{big(viewing)}
      {viewing && viewing.id !== shot.chosen && viewing.status === 'done' && <button className="primary use" onClick={() => choose(viewing)}>用这个版本（替换时间线上的 v{vs.find(v => v.id === shot.chosen)?.n}）</button>}
    </div>
    {saveFrame}
    {vs.length > 0 && <>{head}<div className="versions">{list.map(v => (
      <button key={v.id} className={'ver' + (v.id === shot.chosen ? ' chosen' : '') + (v.id === viewing?.id ? ' viewing' : '')} onClick={() => v.status === 'done' && setPreview(v.id)}>
        {v.status === 'done' ? <img src={`/clips/${v.clip}-first.jpg`} alt="" /> : <div className="ver-wait">{v.status === 'queued' ? '排队' : `${Math.round(v.progress * 100)}%`}</div>}
        <span>v{v.n} · {MODELS[v.quality].label}{v.star ? ' ★' : ''}</span>
        {v.id === shot.chosen && <em>使用中</em>}
        {v.status === 'queued' && <i className="x" onClick={e => { e.stopPropagation(); dispatch({type: 'cancel', shot: shot.id, version: v.id}); }}>取消</i>}
        {v.status === 'done' && <i className="x del" title="删除这个版本" onClick={e => { e.stopPropagation(); del(v); }}>删除</i>}
      </button>))}</div></>}
  </>;

  return <>
    {comparing && cmp.length === 2 ? <div className="takes-compare">
      {cmp.map((v, i) => <div key={v.id} className="cmp-side">{big(v, i)}
        <div className="row tight"><b>v{v.n}</b><small className="muted">{MODELS[v.quality].label}{vs.indexOf(v) === 0 ? ' · 第一版' : diffText(v, prevOf(v)) ? ' · ' + diffText(v, prevOf(v)) : ''}</small><div className="spacer" />
          {v.id === shot.chosen ? <span className="pill good">使用中</span> : <button className="small primary" onClick={() => choose(v)}>用这个</button>}</div></div>)}
      <button className="small cmp-play" onClick={playBoth}><Play size={13} />两个一起从头播</button>
    </div> : <div className="ed-preview">{big(viewing)}
      {viewing && viewing.id !== shot.chosen && viewing.status === 'done' && <button className="primary use" onClick={() => choose(viewing)}>用这个版本</button>}
    </div>}
    {comparing && cmp.length < 2 && <small className="muted">在下面点两个版本来对比（已选 {cmp.length}）</small>}
    {!comparing && saveFrame}
    {vs.length > 0 && head}
    <div className="take-grid">{list.map(v => {
      const isCmp = compare.includes(v.id);
      return <Thumb key={v.id} v={v} className={(v.id === shot.chosen ? 'chosen ' : '') + (v.id === viewing?.id && !comparing ? 'viewing ' : '') + (isCmp ? 'cmp' : '')}
        onClick={() => v.status === 'done' && (comparing ? pickCompare(v) : setPreview(v.id))}>
        <div className="take-top">{v.id === shot.chosen && <em>使用中</em>}{comparing && isCmp && <em className="cmp-n">{compare.indexOf(v.id) === 0 ? 'A' : 'B'}</em>}
          <div className="spacer" />
          {v.status === 'done' && <button className={'take-star' + (v.star ? ' on' : '')} title="收藏" onClick={e => { e.stopPropagation(); star(v); }}><Star size={13} /></button>}</div>
        <div className="take-info"><b>v{v.n}</b><small>{MODELS[v.quality].label}{v.seed != null ? ` · 种子 ${v.seed}` : ''}</small>
          <small className="take-diff">{diffText(v, prevOf(v)) || (vs.indexOf(v) === 0 ? '第一版' : '')}</small>
          <div className="take-acts" onClick={e => e.stopPropagation()}>
            {v.status === 'done' && v.id !== shot.chosen && <button className="small" onClick={() => choose(v)}>用这个</button>}
            {v.recipe && <button className="small ghost" title="把右边的设置改回这一版当时的样子" onClick={() => restore(v)}><RotateCcw size={12} />用它的设置</button>}
            {v.status === 'queued' && <button className="small ghost" onClick={() => dispatch({type: 'cancel', shot: shot.id, version: v.id})}>取消</button>}
            {v.status === 'done' && <button className="small ghost" title="删除这个版本" onClick={() => del(v)}><Trash2 size={12} /></button>}
          </div></div>
      </Thumb>;
    })}{!list.length && <p className="muted">{onlyStar ? '还没有收藏的版本。' : '还没有版本。'}</p>}</div>
  </>;
}
