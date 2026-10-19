// Soft delete for every user-owned element. 移到回收站 only stamps trashedAt; the live view hides it and
// references simply stop resolving, so 恢复 brings everything back exactly. 永久删除 removes it and cleans references.
import {KIND_LABEL, TYPE_LABEL, VARIANT_LABEL} from './data.js';

export const TRASH_DAYS = 5;
const live = x => x && !x.trashedAt;
const stamp = (x, on) => ({...x, trashedAt: on ? Date.now() : null});
const busy = v => v.status === 'queued' || v.status === 'generating';

export const KIND_NAME = {story: '故事', chapter: '章节', scene: '场', shot: '镜头', version: '版本', session: '快速创作'};

// What the rest of the app sees.
export function liveView(state) {
  const stories = state.stories.filter(live).map(s => ({...s, chapters: s.chapters.filter(live).map(c => ({...c, scenes: c.scenes.filter(live)}))}));
  const scenes = new Set(stories.flatMap(s => s.chapters.flatMap(c => c.scenes.map(sc => sc.id))));
  const shots = state.shots.filter(s => live(s) && scenes.has(s.sceneId)).map(s => {
    if (!s.versions.some(v => v.trashedAt)) return s;
    const versions = s.versions.filter(live);
    const chosen = versions.some(v => v.id === s.chosen) ? s.chosen : (versions.filter(v => v.status === 'done').pop()?.id || null);
    return {...s, versions, chosen};
  });
  let profiles = state.profiles.filter(live).map(p => (p.variants.some(v => v.trashedAt) ? {...p, variants: p.variants.filter(live)} : p));
  // A trashed file disappears from every place that points at it (counts included) until it is restored.
  const gone = new Set(state.assets.filter(a => a.trashedAt).map(a => a.id));
  let out = shots;
  if (gone.size) {
    const ok = id => !gone.has(id);
    out = shots.map(s => ({...s, refs: s.refs.filter(ok), start: ok(s.start) ? s.start : null, end: ok(s.end) ? s.end : null, guides: (s.guides || []).filter(g => ok(g.asset))}));
    profiles = profiles.map(p => ({...p, ambient: ok(p.ambient) ? p.ambient : null, voice: ok(p.voice) ? p.voice : null, voices: (p.voices || []).filter(v => ok(v.asset)),
      variants: p.variants.map(v => ({...v, images: v.images.filter(ok), voice: ok(v.voice) ? v.voice : null}))}));
  }
  const vgone = new Set((state.voices || []).filter(v => v.trashedAt).map(v => v.id));
  if (vgone.size) profiles = profiles.map(p => ({...p, voiceId: vgone.has(p.voiceId) ? null : p.voiceId, variants: p.variants.map(v => ({...v, voiceId: vgone.has(v.voiceId) ? null : v.voiceId}))}));
  return {...state, stories, shots: out, assets: state.assets.filter(live), profiles};
}

// Running jobs block 移到回收站 (they would keep billing out of sight).
export function running(view, it) {
  const shots = view.shots.filter(s => (it.kind === 'story' ? s.storyId : it.kind === 'chapter' ? s.chapterId : it.kind === 'scene' ? s.sceneId : s.id) === it.id);
  return shots.reduce((n, s) => n + s.versions.filter(busy).length, 0);
}

export function assetUsage(view, id) {
  const shots = view.shots.filter(s => s.refs.includes(id) || s.start === id || s.end === id || (s.guides || []).some(g => g.asset === id)
    || Object.values(s.picks || {}).some(p => (p.images || []).includes(id) || p.voice === id));
  const profiles = view.profiles.filter(p => p.ambient === id || p.voice === id || (p.voices || []).some(v => v.asset === id) || p.variants.some(v => v.images.includes(id) || v.voice === id));
  return {shots, profiles, text: [shots.length && `${shots.length} 个镜头`, profiles.length && `${profiles.map(p => p.name).join('、')}的档案${profiles.some(p => profileUsage(view, p.id).shots.length) ? '（镜头里会少这张）' : ''}`].filter(Boolean).join('、')};
}
export function profileUsage(view, id) {
  const shots = view.shots.filter(s => s.cast.some(c => c.id === id) || s.place?.id === id || s.props.includes(id));
  return {shots, text: shots.length ? `${shots.length} 个镜头` : ''};
}

const mapStory = (s, id, fn) => ({...s, stories: s.stories.map(x => (x.id === id ? fn(x) : x))});
const mapChapters = (s, storyId, fn) => mapStory(s, storyId, st => ({...st, chapters: st.chapters.map(fn)}));
const mapShot = (s, id, fn) => ({...s, shots: s.shots.map(x => (x.id === id ? fn(x) : x))});
const mapProfile = (s, id, fn) => ({...s, profiles: s.profiles.map(x => (x.id === id ? fn(x) : x))});

export function setTrash(state, it, on) {
  switch (it.kind) {
    case 'story': {
      const s = mapStory(state, it.id, x => stamp(x, on));
      return on && s.activeStory === it.id ? {...s, page: 'home', activeStory: null} : s;
    }
    case 'chapter': {
      const s = mapChapters(state, it.storyId, c => (c.id === it.id ? stamp(c, on) : c));
      if (!on) return {...s, activeChapter: it.id};
      return s.activeChapter === it.id ? {...s, activeChapter: s.stories.find(x => x.id === it.storyId).chapters.find(live)?.id} : s;
    }
    case 'scene': return mapChapters(state, it.storyId, c => ({...c, scenes: c.scenes.map(sc => (sc.id === it.id ? stamp(sc, on) : sc))}));
    case 'shot': return mapShot(state, it.id, x => stamp(x, on));
    case 'version': return mapShot(state, it.shotId, x => ({...x, versions: x.versions.map(v => (v.id === it.id ? stamp(v, on) : v))}));
    case 'asset': return {...state, assets: state.assets.map(a => (a.id === it.id ? stamp(a, on) : a))};
    case 'profile': {
      const s = mapProfile(state, it.id, x => stamp(x, on));
      return on && s.openProfile === it.id ? {...s, openProfile: null} : s;
    }
    case 'variant': return mapProfile(state, it.pid, p => ({...p, variants: p.variants.map(v => (v.id === it.id ? stamp(v, on) : v))}));
    case 'voice': return {...state, voices: state.voices.map(v => (v.id === it.id ? stamp(v, on) : v))};
    case 'session': {
      const sessions = state.sessions.map(x => (x.id === it.id ? stamp(x, on) : x));
      if (!on) return {...state, sessions, activeSession: it.id, page: state.page === 'quick' ? 'quick' : state.page};
      return {...state, sessions, activeSession: state.activeSession === it.id ? (sessions.find(live)?.id || null) : state.activeSession};
    }
    default: return state;
  }
}

const dropAsset = id => s => ({...s, refs: s.refs.filter(x => x !== id), start: s.start === id ? null : s.start, end: s.end === id ? null : s.end,
  guides: (s.guides || []).filter(g => g.asset !== id),
  picks: Object.fromEntries(Object.entries(s.picks || {}).map(([k, p]) => [k, {...p, images: (p.images || []).filter(x => x !== id), voice: p.voice === id ? undefined : p.voice}]))});

export function purge(state, it) {
  switch (it.kind) {
    case 'story': return {...state, stories: state.stories.filter(x => x.id !== it.id), shots: state.shots.filter(x => x.storyId !== it.id)};
    case 'chapter': return {...mapStory(state, it.storyId, st => ({...st, chapters: st.chapters.filter(c => c.id !== it.id)})), shots: state.shots.filter(x => x.chapterId !== it.id)};
    case 'scene': return {...mapChapters(state, it.storyId, c => ({...c, scenes: c.scenes.filter(sc => sc.id !== it.id)})), shots: state.shots.filter(x => x.sceneId !== it.id)};
    case 'shot': return {...state, shots: state.shots.filter(x => x.id !== it.id)};
    case 'version': return mapShot(state, it.shotId, x => ({...x, versions: x.versions.filter(v => v.id !== it.id), chosen: x.chosen === it.id ? null : x.chosen}));
    case 'asset': return {...state, assets: state.assets.filter(a => a.id !== it.id), shots: state.shots.map(dropAsset(it.id)),
      profiles: state.profiles.map(p => ({...p, ambient: p.ambient === it.id ? null : p.ambient, voice: p.voice === it.id ? null : p.voice,
        voices: (p.voices || []).filter(v => v.asset !== it.id), variants: p.variants.map(v => ({...v, images: v.images.filter(x => x !== it.id), voice: v.voice === it.id ? null : v.voice}))}))};
    case 'profile': return {...state, profiles: state.profiles.filter(p => p.id !== it.id),
      shots: state.shots.map(s => ({...s, cast: s.cast.filter(c => c.id !== it.id), place: s.place?.id === it.id ? null : s.place, props: s.props.filter(x => x !== it.id)}))};
    case 'variant': {
      const p = state.profiles.find(x => x.id === it.pid);
      const s = mapProfile(state, it.pid, x => ({...x, variants: x.variants.filter(v => v.id !== it.id)}));
      return {...s, shots: s.shots.map(x => ({...x, cast: x.cast.map(c => (c.id === it.pid && c.variant === it.id ? {...c, variant: p.def} : c)),
        place: x.place?.id === it.pid && x.place.variant === it.id ? {...x.place, variant: p.def} : x.place}))};
    }
    case 'session': return {...state, sessions: state.sessions.filter(x => x.id !== it.id)};
    case 'voice': return {...state, voices: state.voices.filter(v => v.id !== it.id),
      profiles: state.profiles.map(p => ({...p, voiceId: p.voiceId === it.id ? null : p.voiceId, variants: p.variants.map(v => ({...v, voiceId: v.voiceId === it.id ? null : v.voiceId}))}))};
    default: return state;
  }
}

// Everything in 回收站, newest first. Children of a trashed story are not listed separately.
export function trashItems(raw) {
  const out = [], push = (item, name, type, where, at, extra = {}) => out.push({key: item.kind + item.id, item, name, type, where, at, ...extra});
  const story = id => raw.stories.find(s => s.id === id);
  raw.stories.forEach(s => {
    if (s.trashedAt) return push({kind: 'story', id: s.id}, s.title, '故事', `${raw.shots.filter(x => x.storyId === s.id).length} 个镜头一起`, s.trashedAt);
    s.chapters.forEach(c => {
      if (c.trashedAt) return push({kind: 'chapter', id: c.id, storyId: s.id}, c.title, '章节', `${s.title} · ${raw.shots.filter(x => x.chapterId === c.id).length} 个镜头一起`, c.trashedAt);
      c.scenes.forEach(sc => sc.trashedAt && push({kind: 'scene', id: sc.id, storyId: s.id}, sc.title, '场', `${s.title} / ${c.title}`, sc.trashedAt));
    });
  });
  raw.shots.forEach(sh => {
    if (story(sh.storyId)?.trashedAt) return;
    if (sh.trashedAt) return push({kind: 'shot', id: sh.id}, sh.title, '镜头', story(sh.storyId)?.title || '', sh.trashedAt, {clip: sh.versions.find(v => v.id === sh.chosen)?.clip});
    sh.versions.forEach(v => v.trashedAt && push({kind: 'version', id: v.id, shotId: sh.id}, `v${v.n}`, '版本', `镜头「${sh.title}」`, v.trashedAt, {clip: v.clip}));
  });
  raw.assets.forEach(a => a.trashedAt && push({kind: 'asset', id: a.id}, a.name, KIND_LABEL[a.kind], '素材库', a.trashedAt, {asset: a}));
  raw.profiles.forEach(p => {
    if (p.trashedAt) return push({kind: 'profile', id: p.id}, p.name, TYPE_LABEL[p.type], '素材库', p.trashedAt);
    p.variants.forEach(v => v.trashedAt && push({kind: 'variant', id: v.id, pid: p.id}, v.name, VARIANT_LABEL[p.type], p.name, v.trashedAt));
  });
  raw.sessions.forEach(x => x.trashedAt && push({kind: 'session', id: x.id}, x.title, '快速创作', `${x.messages.filter(m => m.role === 'result').length} 条结果`, x.trashedAt));
  (raw.voices || []).forEach(v => v.trashedAt && push({kind: 'voice', id: v.id}, v.name, '声音', '素材库', v.trashedAt));
  return out.sort((a, b) => b.at - a.at);
}

export const daysLeft = at => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - at) / 86400000));

// Called on load: anything older than TRASH_DAYS is purged for good.
export function expire(state) {
  return trashItems(state).filter(x => daysLeft(x.at) === 0 && Date.now() - x.at >= TRASH_DAYS * 86400000).reduce((s, x) => purge(s, x.item), state);
}
