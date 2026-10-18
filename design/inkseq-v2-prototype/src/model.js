// Domain logic: what is in a shot (cast / place / props) is independent of the generation mode.
// The mode only decides how those things are fed to the model.

export const LIMITS = {
  FL: {minSec: 4, maxSec: 15},
  REF: {qualified: {images: 1, videos: 1, audios: 1, clipSec: 3, sec: 5, aspect: '16:9', res: '480P'},
        model: {images: 9, videos: 3, audios: 3}},
};
export const MODELS = {
  draft: {label: '草稿', model: 'H3 剪枝版', gpu: 'RTX 5090', price: 0.5, sim: 6},
  final: {label: '精修', model: 'H3 完整版', gpu: 'PRO 6000', price: 1.3, sim: 10},
};
export const MODE_LABEL = {FL: '首尾帧', REF: '全能参考'};

export function makeDb(state) {
  const assets = new Map(state.assets.map(a => [a.id, a]));
  const profiles = new Map(state.profiles.map(p => [p.id, p]));
  const stories = new Map(state.stories.map(s => [s.id, s]));
  // Shots of one chapter in display order: scene order first, then their order in state.shots.
  const chapterShots = (storyId, chapterId) => {
    const ch = stories.get(storyId)?.chapters.find(c => c.id === chapterId);
    return ch ? ch.scenes.flatMap(sc => state.shots.filter(s => s.sceneId === sc.id)) : [];
  };
  const prev = shot => { const list = chapterShots(shot.storyId, shot.chapterId); const i = list.findIndex(s => s.id === shot.id); return i > 0 ? list[i - 1] : null; };
  return {state, asset: id => assets.get(id), profile: id => profiles.get(id), story: id => stories.get(id),
    settings: shot => stories.get(shot.storyId)?.settings || {}, chapterShots, prev};
}
export const variantOf = (p, vid) => p && (p.variants.find(v => v.id === vid) || p.variants.find(v => v.id === p.def) || p.variants[0]);
// The voice used for a character in a given look: the look's override, else the main voice.
export function voiceOf(p, v) {
  const list = p.voices || [];
  const id = v?.voice || p.voice;
  return list.find(x => x.asset === id) || (id ? {asset: id, start: 0} : null);
}
export const coverOf = (db, p, vid) => db.asset(variantOf(p, vid)?.images[0] || p.variants.flatMap(v => v.images)[0]);
export const modeOf = shot => shot.mode || 'FL';
export const chosenVersion = shot => shot.versions.find(v => v.id === shot.chosen) || null;

export function startFrame(shot, db) {
  if (shot.continuePrev) {
    const prev = db.prev(shot), v = prev && chosenVersion(prev);
    return v ? {src: `/clips/${v.clip}-last.jpg`, label: '上一镜最后一帧'} : {src: null, label: '等待上一镜选定版本'};
  }
  const a = shot.start && db.asset(shot.start);
  return a ? {src: a.thumb, label: a.name} : null;
}

// Everything that would actually be sent to the model, with what is left out and why.
export function expand(shot, db) {
  const project = db.settings(shot), mode = modeOf(shot), q = LIMITS.REF.qualified;
  const warnings = [], notes = [], items = [];
  const cast = shot.cast.map(c => ({c, p: db.profile(c.id)})).filter(x => x.p);
  const place = shot.place && db.profile(shot.place.id);
  const props = shot.props.map(id => db.profile(id)).filter(Boolean);
  const raw = shot.refs.map(id => db.asset(id)).filter(Boolean);

  const parts = [];
  if (project.style) parts.push({label: '全片风格', text: project.style});
  if (place) { const v = variantOf(place, shot.place.variant); parts.push({label: '场景', text: `${place.name}（${v.name}）：${place.desc}${v.desc ? '，' + v.desc : ''}`}); }
  cast.forEach(({c, p}) => { const v = variantOf(p, c.variant); parts.push({label: '人物', text: `${p.name}：${p.desc}；${v.name}：${v.desc}`}); });
  props.forEach(p => parts.push({label: '道具', text: `${p.name}：${p.desc}`}));
  if (shot.prompt) parts.push({label: '动作', text: shot.prompt});
  if (!shot.prompt) warnings.push('还没写这一镜的动作描述');

  if (mode === 'REF') {
    const images = [], videos = [], audios = [];
    // picks[profileId] = {images: [...], voice: assetId | 'none', ambient: false}; default = first photo of the chosen look.
    const pick = id => shot.picks?.[id] || {};
    // Only photos of the current look count; a pick left over from another look falls back to that look's first photo.
    const photos = (id, list) => { const got = (pick(id).images || []).filter(x => list.includes(x)); return (got.length ? got : list.slice(0, 1)).map(x => db.asset(x)).filter(Boolean); };
    cast.forEach(({c, p}) => {
      const v = variantOf(p, c.variant), got = photos(p.id, v.images);
      got.forEach((a, i) => images.push({a, why: `${p.name} · ${v.name}${got.length > 1 ? ` · 第 ${i + 1} 张` : ''}`}));
      if (!got.length) warnings.push(`${p.name} 的「${v.name}」造型还没有照片，只能用文字描述`);
      const chosen = pick(p.id).voice, vo = chosen === 'none' ? null : chosen ? (p.voices || []).find(x => x.asset === chosen) || {asset: chosen, start: 0} : voiceOf(p, v);
      if (vo && db.asset(vo.asset)) audios.push({a: db.asset(vo.asset), why: `${p.name} 的声音 · 第 ${vo.start}–${vo.start + 3} 秒`});
    });
    if (place) photos(place.id, variantOf(place, shot.place.variant).images).forEach(a => images.push({a, why: '场景'}));
    props.forEach(p => photos(p.id, p.variants.flatMap(v => v.images)).forEach(a => images.push({a, why: '道具 · ' + p.name})));
    raw.forEach(a => (a.kind === 'image' ? images : a.kind === 'video' ? videos : audios).push({a, why: '附加素材'}));
    if (place?.ambient && pick(place.id).ambient !== false && db.asset(place.ambient)) audios.push({a: db.asset(place.ambient), why: '场景环境声'});
    const skip = new Set(shot.skip || []);
    const take = (list, n, kind) => { let used = 0; list.forEach(x => {
      if (skip.has(x.a.id)) { items.push({...x, kind, sent: false, skipped: true, reason: '你设为不发送'}); return; }
      const ok = used < n; used += ok ? 1 : 0;
      items.push({...x, kind, sent: ok, reason: ok ? '' : `线上目前只验收 ${n} 个${kind}（模型最多 ${LIMITS.REF.model[{图片: 'images', 视频: 'videos', 声音: 'audios'}[kind]]} 个），按优先级未发送`}); }); };
    take(images, q.images, '图片'); take(videos, q.videos, '视频'); take(audios, q.audios, '声音');
    if (!images.length && !videos.length && !audios.length) warnings.push('全能参考还没有任何参考：拖入人物、场景或动作视频');
    if (items.some(i => !i.sent)) notes.push('优先级：人物 > 场景 > 道具 > 附加素材；人物声音 > 附加声音 > 环境声');
    if (project.aspect !== q.aspect) warnings.push(`画幅 ${project.aspect}：全能参考目前只验收 16:9，竖屏要先做 GPU 验收`);
    if (shot.start || shot.end || shot.continuePrev) notes.push('首尾帧里设的开头/结尾画面在全能参考模式下不使用（切回首尾帧时恢复）');
    return {mode, kind: '全能参考', machine: '参考机', sec: shot.duration, res: shotControls(shot, db).resolution || q.res, parts, items, warnings, notes};
  }

  const sf = startFrame(shot, db), end = shot.end && db.asset(shot.end);
  if (sf) items.push({a: {name: sf.label, thumb: sf.src}, kind: '开头画面', why: shot.continuePrev ? '接上一镜' : '开头', sent: !!sf.src,
    reason: sf.src ? '' : '上一镜还没有选定版本'});
  if (end) items.push({a: end, kind: '结尾画面', why: '结尾', sent: true});
  if (cast.length || place || props.length) notes.push('首尾帧模式不能放参考图：人物、场景、道具只用文字描述');
  if (raw.length) notes.push(`附加素材 ${raw.length} 项在首尾帧模式下不使用（切到全能参考时恢复）`);
  if (shot.continuePrev && !db.prev(shot)) warnings.push('这是第一个镜头，没有上一镜');
  const kind = shot.continuePrev ? (end ? '接上一镜 + 结尾' : '接上一镜') : sf && end ? '首尾帧' : sf ? '首帧生成' : end ? '尾帧生成' : '文字生成';
  return {mode, kind, machine: '首尾帧机', sec: shot.duration, res: shotControls(shot, db).resolution || (shot.quality === 'final' ? '768P' : '480P'), parts, items, warnings, notes};
}

// Where a dropped item goes. item = {profile} | {asset}. Used by the reducer, drop hints and toasts.
export function planDrop(shot, item, slot, db) {
  const mode = modeOf(shot);
  if (item.profile) {
    const p = item.profile, label = {character: '出场人物', location: '场景', prop: '道具'}[p.type];
    if ((slot === 'start' || slot === 'end') && p.type !== 'character') {
      const img = variantOf(p, p.def).images[0];
      if (!img) return {patch: null, msg: `「${p.name}」还没有图片`};
      return {patch: slot === 'start' ? {start: img, continuePrev: false} : {end: img}, msg: `用「${p.name}」的图作${slot === 'start' ? '开头' : '结尾'}画面`};
    }
    if (slot === 'start' || slot === 'end') {
      const r = planDrop(shot, item, 'smart', db);
      return {...r, msg: r.patch ? '人物不能当开头/结尾画面，已加为出场人物（只用文字描述）' : r.msg};
    }
    const how = mode === 'REF' ? '用照片' + (p.type === 'character' && p.voice ? '和声音' : '') : '首尾帧模式只用文字描述';
    if (p.type === 'character') {
      if (shot.cast.some(c => c.id === p.id)) return {patch: null, msg: `「${p.name}」已经在这一镜里`};
      return {patch: {cast: [...shot.cast, {id: p.id, variant: p.def}]}, msg: `${label}：${p.name}（${how}）`, hint: `松开：加为${label}`};
    }
    if (p.type === 'location') return {patch: {place: {id: p.id, variant: p.def}}, msg: `${label}：${p.name}（${how}）`, hint: shot.place ? '松开：替换场景' : '松开：设为场景'};
    if (shot.props.includes(p.id)) return {patch: null, msg: `「${p.name}」已经在这一镜里`};
    return {patch: {props: [...shot.props, p.id]}, msg: `${label}：${p.name}（${how}）`, hint: '松开：加为道具'};
  }
  const a = item.asset;
  if (slot === 'start' || slot === 'end') {
    if (a.kind !== 'image') return {patch: null, msg: `「${a.name}」不是图片，不能当开头/结尾画面`};
    return {patch: slot === 'start' ? {start: a.id, continuePrev: false} : {end: a.id}, msg: `已设为${slot === 'start' ? '开头' : '结尾'}画面`};
  }
  if (shot.refs.includes(a.id)) return {patch: null, msg: '已经加过了'};
  const addRef = {refs: [...shot.refs, a.id]};
  if (slot === 'refs' || mode === 'REF') return {patch: addRef, msg: '已加到全能参考的附加素材', hint: '松开：加为附加素材'};
  if (a.kind === 'image') {
    if (!shot.start && !shot.continuePrev) return {patch: {start: a.id}, msg: '已设为开头画面', hint: '松开：作为开头画面'};
    return {patch: {end: a.id}, msg: shot.end ? '已替换结尾画面' : '已设为结尾画面', hint: shot.end ? '松开：替换结尾画面' : '松开：作为结尾画面'};
  }
  return {patch: addRef, msg: '首尾帧模式不能用视频/声音参考，先存进全能参考的附加素材', hint: '松开：存进全能参考（当前不用）', warn: true};
}

export function shotStatus(shot, queuePos) {
  const latest = shot.versions[shot.versions.length - 1];
  if (latest?.status === 'queued') return {id: 'queued', label: `排队第 ${queuePos}`, tone: 'wait'};
  if (latest?.status === 'generating') return {id: 'gen', label: `生成中 ${Math.round(latest.progress * 100)}%`, tone: 'busy'};
  if (!shot.versions.length) return {id: 'empty', label: '待生成', tone: 'muted'};
  if (latest && latest.id !== shot.chosen && latest.status === 'done') return {id: 'pick', label: '新版本待挑选', tone: 'warn'};
  return {id: 'ok', label: chosenVersion(shot)?.quality === 'final' ? '已选定 · 精修' : '已选定 · 草稿', tone: 'good'};
}

export function segments(shots) {
  let t = 0;
  return shots.map(s => {
    const v = chosenVersion(s), seg = {shot: s, start: t, dur: s.duration, clip: v?.clip || null};
    t += seg.dur;
    return seg;
  });
}
export const totalDuration = shots => segments(shots).reduce((n, s) => n + s.dur, 0);
export const fmt = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Profiles touched by a shot — used to suggest where a saved frame belongs.
export const shotProfiles = shot => [...shot.cast.map(c => ({id: c.id, variant: c.variant})), ...(shot.place ? [shot.place] : []), ...shot.props.map(id => ({id}))];

// What a version was made with (stored on each version for compare / 用它的设置).
export const RECIPE_KEYS = ['script', 'prompt', 'cast', 'place', 'props', 'refs', 'start', 'end', 'guides', 'picks', 'duration', 'mode', 'controls', 'continuePrev'];

// 全局默认 → 故事默认 → 镜头自己改的：只有镜头改过的项覆盖上层。
export const shotControls = (shot, db) => ({...(db.state.genDefaults || {}), ...(db.settings(shot).controls || {}), ...(shot.controls || {})});

// 生成前的粗估（原型）：按精度、时长、分辨率估一条要多久、花多少；真实数字以算力页的机器价格为准。
const RES_FACTOR = {'480P': 1, '576P': 1.4, '768P': 2.2};
const HOURLY = {draft: 0.69, final: 1.29};
// Users pay in credits (1 credit = US$0.01 retail). Price = seconds of output video × the tier's rate;
// the operator edits the rates (设置 → 管理员 → 定价) and the backend quotes them — never hard-coded there.
// usd below is the internal machine-cost estimate, shown to admins only.
export const CREDIT_USD = 0.01;
export const DEFAULT_RATES = {fast: 2, draft: 4, final: 12}; // credits per second of video
export const fmtCredits = n => `${Math.round(n).toLocaleString('en-US')} 积分`;
export const creditsFor = ({quality = 'draft', duration = 5, count = 1}, rates = DEFAULT_RATES) => Math.ceil((rates[quality] ?? rates.draft) * duration) * count;
export function estimate(list, rates = DEFAULT_RATES) {
  let min = 0, usd = 0, credits = 0;
  for (const {quality = 'draft', duration = 5, resolution = quality === 'final' ? '768P' : '480P', count = 1} of list) {
    const m = (quality === 'final' ? 5 : 3) * (duration / 5) * (RES_FACTOR[resolution] || 1.6) * count;
    min += m; usd += m / 60 * HOURLY[quality]; credits += creditsFor({quality, duration, count}, rates);
  }
  return {min, usd, credits, text: `约 ${fmtCredits(credits)} · 约 ${min < 1 ? '1' : Math.round(min)} 分钟`};
}
