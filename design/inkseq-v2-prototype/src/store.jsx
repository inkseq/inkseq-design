import React, {createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState} from 'react';
import {expire, liveView, purge, setTrash} from './trash.js';
import {BLANK_SHOT, CLIPS, DEFAULT_SETTINGS, mockUploads, parseScript, seedAssets, seedProfiles, seedQuickChats, seedShots, seedStories} from './data.js';
import {makeDb, modeOf, MODELS, planDrop, RECIPE_KEYS} from './model.js';

const KEY = 'story-prototype-v8';
const initial = () => ({
  stories: seedStories(), shots: seedShots(), assets: seedAssets(), profiles: seedProfiles(), quickChats: seedQuickChats(),
  sessions: seedQuickChats().map(q => ({id: 'ss-' + q.id, title: q.title, updatedAt: q.at, messages: [
    {id: 'm1-' + q.id, role: 'user', text: q.prompt, attachments: []},
    {id: 'm2-' + q.id, role: 'result', prompt: q.prompt, mode: q.mode, quality: 'draft', duration: 5, status: 'done', progress: 1, clip: q.clip, n: 1}]})),
  activeSession: null,
  page: 'home', activeStory: null, activeChapter: null,
  machines: [
    {id: 'm1', mode: 'FL', quality: 'draft', gpu: 'RTX 5090', region: '拉脱维亚', provider: 'Vast', host: 'vast-41822', price: 0.69, keep: 'idle', idleMin: 10, status: 'ready', since: 0, startedAt: -900, group: 'g1', jobs: 14},
    {id: 'm2', mode: 'REF', quality: 'draft', gpu: 'RTX 5090', region: '美国', provider: 'RunPod', host: 'rp-a17f', price: 0.57, keep: 'until_stopped', idleMin: 10, status: 'ready', since: 0, startedAt: -600, group: 'g1', jobs: 6},
  ],
  groups: [{id: 'g1', name: '内测机群'}],
  // Past hosts with measured speed; 优先 / 避开 steer future starts (not a reservation).
  hosts: [
    {id: 'vast-41822', provider: 'Vast', gpu: 'RTX 5090', region: '拉脱维亚', runs: 31, avgSec: 212, fails: 0, tag: 'prefer'},
    {id: 'rp-a17f', provider: 'RunPod', gpu: 'RTX 5090', region: '美国', runs: 12, avgSec: 240, fails: 1, tag: null},
    {id: 'vast-30715', provider: 'Vast', gpu: 'RTX 5090', region: '美国', runs: 9, avgSec: 395, fails: 4, tag: 'avoid'},
    {id: 'vast-55201', provider: 'Vast', gpu: 'RTX PRO 6000', region: '美国', runs: 7, avgSec: 318, fails: 0, tag: null},
  ],
  autoscale: {FL: {on: false, queue: 3, max: 2}, REF: {on: false, queue: 3, max: 2}},
  spent: 18.4,
  ended: [{id: 'm0', mode: 'FL', quality: 'final', gpu: 'RTX PRO 6000', region: '美国', price: 1.29, ranMin: 46, reason: '空闲 10 分钟自动关机'}],
  tokens: [{id: 't1', name: 'Claude Code · 本机', scope: '读写任务和素材', created: Date.now() - 6 * 24 * 3600e3, used: Date.now() - 3600e3}],
  clock: 0, uploads: 0, agents: [], agentInvite: null,
});
const mapStory = (state, id, fn) => ({...state, stories: state.stories.map(s => (s.id === id ? fn(s) : s))});
const touch = (state, storyId) => (storyId ? mapStory(state, storyId, s => ({...s, updatedAt: Date.now()})) : state);
const sceneHome = (state, sceneId) => {
  for (const st of state.stories) for (const ch of st.chapters) if (ch.scenes.some(sc => sc.id === sceneId)) return {storyId: st.id, chapterId: ch.id, sceneId};
  return null;
};
// Short card title from a script line: up to the first punctuation, unless that is too short.
const shotTitle = line => { const head = line.replace(/[，。！？、；：].*$/, ''); return (head.length >= 4 ? head : line.replace(/[，。！？、；：]/g, '')).slice(0, 12) || '镜头'; };
const newShot = (home, settings, patch = {}) => ({...BLANK_SHOT, ...home, id: uid('s'), title: '新镜头', quality: settings?.defaultQuality || 'draft', ...patch});

// A few example tags so the 素材库 filters have something to show.
function seedTags(s) {
  if (s.tagsSeeded) return s;
  const t = {sb: ['分镜草图'], mv: ['动作参考'], plat: ['雨夜'], 'hall-n': ['夜景'], 'au-rain': ['雨夜', '环境声']};
  return {...s, tagsSeeded: true, assets: s.assets.map(a => { const k = Object.keys(t).find(k => a.id.startsWith(k)); return k ? {...a, tags: [...new Set([...(a.tags || []), ...t[k]])]} : a; })};
}
// Older saved demos have no agents yet.
// Every limit is a setting (with a default) the owner/admin can change in 设置 — nothing is hard-coded.
export const DEFAULT_LIMITS = {daily: 20, confirmAbove: 1, testDaily: 20, maxHourly: 1.5, idleStopMin: 10, maxRunHours: 2};
const normalize = s => ({...s, agents: s.agents || [], agentInvite: s.agentInvite || null, limits: {...DEFAULT_LIMITS, ...(s.limits || {})}, spentToday: s.spentToday ?? 3.42});
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(seedTags(expire(JSON.parse(raw)))); } catch {}
  return normalize(seedTags(initial()));
}

const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const uid = p => p + Math.random().toString(36).slice(2, 8);
const mapShot = (state, id, fn) => ({...state, shots: state.shots.map(s => (s.id === id ? fn(s) : s))});
const mapProfile = (state, id, fn) => ({...state, profiles: state.profiles.map(p => (p.id === id ? fn(p) : p))});
const mapVariant = (state, pid, vid, fn) => mapProfile(state, pid, p => ({...p, variants: p.variants.map(v => (v.id === vid ? fn(v) : v))}));
const fileInto = (state, assetId, pid, vid) => {
  const s = mapVariant(state, pid, vid, v => ({...v, images: v.images.includes(assetId) ? v.images : [...v.images, assetId]}));
  return {...s, assets: s.assets.map(a => (a.id === assetId ? {...a, inbox: false, suggest: null} : a))};
};

function enqueue(state, shot, quality, vary) {
  const q = quality || shot.quality;
  const base = shot.versions.find(v => v.id === shot.chosen) || shot.versions[shot.versions.length - 1];
  const lock = shot.seedLock && base && !vary; // a batch of several always varies the seed
  const seed = lock ? base.seed : Math.floor(Math.random() * 1e6);
  const n = shot.versions.length + 1;
  return {...shot, quality: q, versions: [...shot.versions, {
    id: uid('v'), n, quality: q, seed, mode: modeOf(shot), status: 'queued', progress: 0,
    enqueuedAt: state.clock + n / 1000, sameSeedAs: lock ? base.id : null, clip: null,
    recipe: Object.fromEntries(RECIPE_KEYS.map(k => [k, k === 'mode' ? modeOf(shot) : shot[k]]))}]};
}

function reducer(state, a) {
  switch (a.type) {
    case 'reset': return initial();
    case 'page': return {...state, page: a.page};
    case 'genDefaults': return {...state, genDefaults: a.value};
    // 故事默认：存在故事上，镜头没改过的项自动跟随；不写进每个镜头，所以不会覆盖镜头自己的修改。时长属于镜头内容，不进默认。
    case 'storyControls': { const {duration, seed, ...v} = a.value; return touch(mapStory(state, a.storyId, st => ({...st, settings: {...st.settings, controls: {...(st.settings.controls || {}), ...v}}})), a.storyId); }
    case 'addAsset': return state.assets.some(x => x.id === a.asset.id) ? state : {...state, assets: [...state.assets, a.asset]};
    case 'qcNew': {
      const id = uid('ss');
      return {...state, sessions: [{id, title: '新的创作', updatedAt: Date.now(), messages: []}, ...state.sessions], activeSession: id, page: 'quick'};
    }
    case 'qcOpen': return {...state, activeSession: a.id, page: 'quick'};
    case 'qcRename': return {...state, sessions: state.sessions.map(x => (x.id === a.id ? {...x, title: a.title} : x))};
    // ---- AI 助手 (Agent) ----
    case 'agentInvite': {
      if (a.cancel) return {...state, agentInvite: null};
      const r = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      return {...state, agentInvite: {code: `INK-${r()}-${r()}`, scope: a.scope, perm: a.perm, cap: a.cap, expires: Date.now() + 10 * 60e3}};
    }
    case 'agentConnect': {
      const inv = state.agentInvite; if (!inv) return state;
      const ag = {id: uid('ag'), name: a.name, device: a.device, scope: inv.scope, perm: inv.perm, cap: inv.cap, spent: 0, paused: false,
        connectedAt: Date.now(), invite: inv.code, log: [{at: Date.now(), text: '已连接'}]};
      return {...state, agents: [...state.agents, ag]};
    }
    case 'agentPause': return {...state, agents: state.agents.map(x => (x.id === a.id ? {...x, paused: !x.paused, log: [...x.log, {at: Date.now(), text: x.paused ? '你恢复了它' : '你暂停了它'}]} : x))};
    case 'agentCap': return {...state, agents: state.agents.map(x => (x.id === a.id ? {...x, cap: a.cap, log: [...x.log, {at: Date.now(), text: `你把每日上限改成 $${a.cap}`}]} : x))};
    case 'limits': return {...state, limits: {...state.limits, ...a.patch}};
    case 'agentRevoke': return {...state, agents: state.agents.filter(x => x.id !== a.id)};
    // 原型：模拟助手在它的范围里做一次事（2 条草稿），并记账；超出每日上限就不提交。
    case 'agentDemo': {
      const ag = state.agents.find(x => x.id === a.id); if (!ag || ag.paused) return state;
      const cost = 0.06, logIt = (s, text, spent = 0) => ({...s, agents: s.agents.map(x => (x.id === ag.id ? {...x, spent: x.spent + spent, log: [...x.log, {at: Date.now(), text}]} : x))});
      if (ag.perm !== 'generate') return logIt(state, '整理了提示词（只看权限，没有生成）');
      if (ag.spent + cost > ag.cap) return logIt(state, `想生成 2 条，但会超过每日上限 $${ag.cap}，没有提交`);
      const prompt = ['雨夜站台，女孩回头，霓虹倒影', '清晨车站，老陈擦眼镜，阳光斜照', '林岚拆开信，手微微发抖，近景'][state.agents.indexOf(ag) % 3 + (ag.log.length % 2)] || '雨夜站台，女孩回头';
      if (ag.scope.kind === 'story') {
        const st = state.stories.find(x => x.id === ag.scope.id), ch = st?.chapters[0], sc = ch?.scenes[0];
        if (!sc) return state;
        let shot = newShot({storyId: st.id, chapterId: ch.id, sceneId: sc.id}, st.settings, {title: prompt.slice(0, 10), script: prompt, prompt, by: ag.id});
        shot = enqueue(state, enqueue(state, shot, null, true), null, true);
        return logIt(touch({...state, shots: [...state.shots, shot]}, st.id), `在「${st.title} / ${sc.title}」加了镜头「${shot.title}」，生成 2 条草稿`, cost);
      }
      const b = 'b' + Math.random().toString(36).slice(2, 8);
      const n0 = state.sessions.reduce((n, x) => n + x.messages.filter(m => m.role === 'result').length, 0) + 1;
      const takes = [0, 1].map(i => ({id: uid('m'), role: 'result', status: 'queued', progress: 0, clip: null, n: n0 + i, prompt, mode: 'FL', quality: 'draft', duration: 5,
        batch: b, seed: String(Math.floor(Math.random() * 1e9)), enqueuedAt: state.clock + i / 1e6, by: ag.id}));
      const ask = {id: uid('m'), role: 'user', text: `🤖 ${ag.name}：${prompt}（一次 2 条）`, attachments: [], by: ag.id};
      let sessions, where;
      if (ag.scope.kind === 'session' && state.sessions.some(x => x.id === ag.scope.id)) {
        sessions = state.sessions.map(x => (x.id === ag.scope.id ? {...x, updatedAt: Date.now(), messages: [...x.messages, ask, ...takes]} : x));
        where = '这条快速创作';
      } else {
        sessions = [{id: uid('ss'), title: prompt.slice(0, 16), updatedAt: Date.now(), by: ag.id, messages: [ask, ...takes]}, ...state.sessions];
        where = `新的快速创作「${prompt.slice(0, 12)}」`;
      }
      return logIt({...state, sessions}, `在${where}里生成 2 条草稿`, cost);
    }
    case 'trash': return setTrash(state, a.item, true);
    case 'restore': return setTrash(state, a.item, false);
    case 'purge': return (a.items || [a.item]).reduce(purge, state);
    case 'tagAssets': return {...state, assets: state.assets.map(x => (!a.ids.includes(x.id) ? x
      : {...x, tags: a.add ? [...new Set([...(x.tags || []), a.add])] : (x.tags || []).filter(t => t !== a.remove)}))};
    // From 素材库 → 用在哪里: open the story at that shot.
    case 'focusShot': {
      const s = state.shots.find(x => x.id === a.id);
      return s ? {...state, page: 'story', activeStory: s.storyId, activeChapter: s.chapterId, openProfile: null, lastAdded: s.id, focusAt: Date.now()} : state;
    }
    case 'renameAsset': return {...state, assets: state.assets.map(x => (x.id === a.id ? {...x, name: a.name} : x))};
    case 'qcHideMsg': return {...state, sessions: state.sessions.map(x => (x.id === a.sid ? {...x, messages: x.messages.map(m => (m.id === a.mid ? {...m, hidden: a.hidden} : m))} : x))};
    case 'qcCancel': return {...state, sessions: state.sessions.map(x => (x.id === a.sid ? {...x, messages: x.messages.filter(m => m.id !== a.mid)} : x))};
    case 'qcPush': return {...state, seq: (state.seq || 0) + 1, sessions: state.sessions.map(x => (x.id === a.sid ? {...x, updatedAt: Date.now(),
      title: x.messages.length || !a.msg.text ? x.title : a.msg.text.slice(0, 16), messages: [...x.messages, {id: uid('m'), ...(a.msg.role === 'result' ? {enqueuedAt: state.clock + ((state.seq || 0) % 1000) / 1e6} : {}), ...a.msg}]} : x))};
    case 'qcPatch': return {...state, sessions: state.sessions.map(x => (x.id === a.sid ? {...x, messages: x.messages.map(m => (m.id === a.mid ? {...m, ...a.patch} : m))} : x))};
    case 'qcToStory': {
      const ses = state.sessions.find(x => x.id === a.sid), msg = ses?.messages.find(m => m.id === a.mid), home = sceneHome(state, a.sceneId);
      if (!msg || !home) return state;
      // 整套设置一起带过去：素材和用途、参数、种子；在故事里重新生成能得到同样的结果（固定种子已打开）。
      const fr = msg.frames || {}, roleOf = r => Object.keys(fr).find(id => fr[id]?.role === r) || null;
      const {seed, ...controls} = msg.controls || {};
      const inputs = msg.mode === 'FL'
        ? {start: roleOf('first'), end: roleOf('last'), guides: Object.keys(fr).filter(id => fr[id]?.role === 'guide').map(id => ({asset: id, t: fr[id].t}))}
        : {refs: msg.refs || [], refOpts: msg.inputOpts || {}};
      const shot0 = newShot(home, null, {title: (msg.prompt || '快速创作').slice(0, 12), prompt: msg.prompt, mode: msg.mode, quality: msg.quality,
        duration: msg.duration || 5, controls, seedLock: true, ...inputs, from: {sid: a.sid, mid: a.mid}});
      const ver = {id: uid('v'), n: 1, clip: msg.clip, quality: msg.quality, seed: msg.seed, status: 'done', progress: 1, mode: msg.mode,
        recipe: Object.fromEntries(RECIPE_KEYS.map(k => [k, k === 'mode' ? modeOf(shot0) : shot0[k]]))};
      const shot = {...shot0, versions: [ver], chosen: ver.id};
      const s2 = reducer({...state, shots: [...state.shots, shot]}, {type: 'qcPatch', sid: a.sid, mid: a.mid, patch: {movedTo: home.storyId}});
      return touch(s2, home.storyId);
    }
    case 'addQuick': return {...state, quickChats: [{id: a.id, title: a.prompt.slice(0, 14), prompt: a.prompt, mode: a.mode, status: 'generating', at: Date.now(), clip: null}, ...state.quickChats]};
    case 'finishQuick': return {...state, quickChats: state.quickChats.map(x => (x.id === a.id ? {...x, status: 'done', clip: CLIPS[Math.floor(Math.random() * CLIPS.length)]} : x))};
    case 'startMachine': return {...state, machines: [...state.machines, ...Array.from({length: a.count || 1}, () => ({id: uid('m'), status: 'renting', since: state.clock, startedAt: state.clock, jobs: 0,
      host: a.spec.host || uid(a.spec.provider === 'RunPod' ? 'rp-' : 'vast-'), ...a.spec, active: a.spec.mode === 'both' ? 'FL' : a.spec.mode}))]};
    case 'stopMachine': return {...state, machines: state.machines.map(m => (m.id === a.id ? {...m, status: 'stopping', since: state.clock} : m))};
    case 'keepMachine': return {...state, machines: state.machines.map(m => (m.id === a.id ? {...m, ...a.patch} : m))};
    case 'groupKeep': return {...state, machines: state.machines.map(m => (m.group === a.group ? {...m, ...a.patch} : m))};
    case 'stopGroup': return {...state, machines: state.machines.map(m => (m.group === a.group && m.status !== 'stopping' ? {...m, status: 'stopping', since: state.clock} : m))};
    case 'newGroup': return {...state, groups: [...state.groups, {id: a.id, name: a.name}]};
    case 'renameGroup': return {...state, groups: state.groups.map(g => (g.id === a.id ? {...g, name: a.name} : g))};
    case 'hostTag': return {...state, hosts: state.hosts.map(h => (h.id === a.id ? {...h, tag: h.tag === a.tag ? null : a.tag} : h))};
    case 'autoscale': return {...state, autoscale: {...state.autoscale, [a.mode]: {...state.autoscale[a.mode], ...a.patch}}};
    case 'addToken': return {...state, tokens: [...state.tokens, {id: uid('t'), name: a.name, scope: a.scope, created: Date.now(), used: null}]};
    case 'revokeToken': return {...state, tokens: state.tokens.filter(t => t.id !== a.id)};
    case 'moveShot': {
      // Move a shot before another shot (any scene) or to the end of a scene.
      const shot = state.shots.find(x => x.id === a.id);
      const target = a.beforeId ? state.shots.find(x => x.id === a.beforeId) : null;
      const home = sceneHome(state, target ? target.sceneId : a.sceneId);
      if (!shot || !home || shot.id === a.beforeId) return state;
      const rest = state.shots.filter(x => x.id !== shot.id);
      const moved = {...shot, ...home};
      let i = target ? rest.findIndex(x => x.id === target.id) : -1;
      if (i < 0) { const last = rest.map(x => x.sceneId).lastIndexOf(home.sceneId); i = last < 0 ? rest.length : last + 1; }
      rest.splice(i, 0, moved);
      return touch({...state, shots: rest}, home.storyId);
    }
    case 'add': {
      const home = sceneHome(state, a.sceneId);
      if (!home) return state;
      const st = state.stories.find(x => x.id === home.storyId);
      const shot = newShot(home, st.settings);
      const rest = [...state.shots];
      const last = rest.map(x => x.sceneId).lastIndexOf(home.sceneId);
      rest.splice(last < 0 ? rest.length : last + 1, 0, shot);
      return touch({...state, shots: rest, lastAdded: shot.id}, home.storyId);
    }
    // stories, chapters, scenes
    case 'home': return {...state, page: 'home'};
    case 'openStory': {
      const st = state.stories.find(x => x.id === a.id);
      if (!st) return state;
      const keep = state.activeStory === st.id && st.chapters.some(c => c.id === state.activeChapter);
      return {...state, page: 'story', activeStory: st.id, activeChapter: keep ? state.activeChapter : st.chapters[0]?.id};
    }
    case 'setChapter': return {...state, activeChapter: a.id};
    case 'storySettings': return touch(mapStory(state, a.id, st => ({...st, settings: {...st.settings, ...a.patch}})), a.id);
    case 'renameStory': return touch(mapStory(state, a.id, st => ({...st, title: a.title})), a.id);
    case 'addChapter': {
      const cid = uid('ch'), scid = uid('sc');
      const s2 = mapStory(state, a.storyId, st => ({...st, chapters: [...st.chapters, {id: cid, title: a.title, scenes: [{id: scid, title: '场 1'}]}]}));
      return touch({...s2, activeChapter: cid}, a.storyId);
    }
    case 'renameChapter': return touch(mapStory(state, a.storyId, st => ({...st, chapters: st.chapters.map(c => (c.id === a.id ? {...c, title: a.title} : c))})), a.storyId);
    case 'addScene': return touch(mapStory(state, a.storyId, st => ({...st, chapters: st.chapters.map(c => (c.id === a.chapterId
      ? {...c, scenes: [...c.scenes, {id: uid('sc'), title: a.title || `场 ${c.scenes.length + 1}`}]} : c))})), a.storyId);
    case 'renameScene': return touch(mapStory(state, a.storyId, st => ({...st, chapters: st.chapters.map(c => ({...c,
      scenes: c.scenes.map(sc => (sc.id === a.id ? {...sc, title: a.title} : sc))}))})), a.storyId);
    case 'newStory': {
      const id = uid('st');
      const settings = {...DEFAULT_SETTINGS, logline: a.logline || '', aspect: a.aspect || '16:9', style: a.style || ''};
      let chapters, shots = [];
      if (a.mode === 'script') {
        const parsed = parseScript(a.script || '');
        chapters = parsed.map(c => ({id: uid('ch'), title: c.title, scenes: c.scenes.map(sc => ({id: uid('sc'), title: sc.title, lines: sc.shots}))}));
        for (const c of chapters) for (const sc of c.scenes) {
          for (const line of sc.lines) shots.push(newShot({storyId: id, chapterId: c.id, sceneId: sc.id}, settings,
            {title: shotTitle(line), script: line}));
          delete sc.lines;
        }
        if (!chapters.length) chapters = [{id: uid('ch'), title: '第一章', scenes: [{id: uid('sc'), title: '场 1'}]}];
      } else {
        chapters = [{id: uid('ch'), title: '第一章', scenes: [{id: uid('sc'), title: '场 1'}]}];
        if (a.mode === 'logline') {
          const home = {storyId: id, chapterId: chapters[0].id, sceneId: chapters[0].scenes[0].id};
          ['开场 · 交代环境', '人物登场', '事件发生', '反应与悬念'].forEach(t => shots.push(newShot(home, settings, {title: t})));
        }
      }
      const story = {id, title: a.title || '未命名故事', local: false, updatedAt: Date.now(), settings, chapters};
      return {...state, stories: [story, ...state.stories], shots: [...state.shots, ...shots], page: 'story', activeStory: id, activeChapter: chapters[0].id};
    }
    case 'quickToStory': {
      const qc = state.quickChats.find(x => x.id === a.qc), home = sceneHome(state, a.sceneId);
      if (!qc || !home) return state;
      const ver = {id: uid('v'), n: 1, clip: qc.clip, quality: 'draft', seed: 1, status: 'done', progress: 1, mode: qc.mode};
      const shot = newShot(home, null, {title: qc.title.slice(0, 12), prompt: qc.prompt, mode: qc.mode, versions: [ver], chosen: ver.id, fromQuick: qc.id});
      return touch({...state, shots: [...state.shots, shot], quickChats: state.quickChats.map(x => (x.id === qc.id ? {...x, movedTo: home.storyId} : x))}, home.storyId);
    }
    case 'remove': return {...state, shots: state.shots.filter(s => s.id !== a.id)};
    case 'update': return touch(mapShot(state, a.id, s => ({...s, ...a.patch})), state.shots.find(x => x.id === a.id)?.storyId);
    case 'drop': {
      const db = makeDb(state);
      const item = a.profile ? {profile: db.profile(a.profile)} : {asset: db.asset(a.asset)};
      if (!item.profile && !item.asset) return state;
      return mapShot(state, a.shot, s => { const {patch} = planDrop(s, item, a.slot || 'smart', db); return patch ? {...s, ...patch} : s; });
    }
    case 'unref': return mapShot(state, a.shot, s => ({...s, refs: s.refs.filter(r => r !== a.asset)}));
    case 'uncast': return mapShot(state, a.shot, s => ({...s, cast: s.cast.filter(c => c.id !== a.id)}));
    case 'castVariant': return mapShot(state, a.shot, s => ({...s, cast: s.cast.map(c => (c.id === a.id ? {...c, variant: a.variant} : c))}));
    case 'placeVariant': return mapShot(state, a.shot, s => ({...s, place: {...s.place, variant: a.variant}}));
    case 'unplace': return mapShot(state, a.shot, s => ({...s, place: null}));
    case 'unprop': return mapShot(state, a.shot, s => ({...s, props: s.props.filter(p => p !== a.id)}));

    // profiles
    case 'profile': return mapProfile(state, a.id, p => ({...p, ...a.patch}));
    case 'variant': return mapVariant(state, a.pid, a.vid, v => ({...v, ...a.patch}));
    case 'addVariant': {
      const vid = uid('var');
      return mapProfile(state, a.pid, p => ({...p, variants: [...p.variants, {id: vid, name: a.name || '新造型', desc: '', images: []}]}));
    }
    case 'newProfile': {
      const id = uid('p');
      const p = {id, type: a.ptype, name: a.name, desc: '', voice: null, ambient: null, def: 'main',
        variants: [{id: 'main', name: a.ptype === 'character' ? '默认造型' : a.ptype === 'location' ? '默认' : '图片', desc: '', images: []}]};
      return {...state, profiles: [...state.profiles, p], openProfile: id};
    }
    case 'fileImage': return fileInto(state, a.asset, a.pid, a.vid);
    case 'unfileImage': return mapVariant(state, a.pid, a.vid, v => ({...v, images: v.images.filter(i => i !== a.asset)}));
    case 'coverImage': return mapVariant(state, a.pid, a.vid, v => ({...v, images: [a.asset, ...v.images.filter(i => i !== a.asset)]}));
    case 'aiImage': {
      const p = state.profiles.find(x => x.id === a.pid), v = p?.variants.find(x => x.id === a.vid);
      if (!p || !v) return state;
      const src = state.assets.find(x => x.id === v.images[0]) || state.assets.find(x => x.id === p.variants.flatMap(y => y.images)[0]);
      const id = uid('ai');
      const asset = {id, kind: 'image', name: `${p.name} · ${v.name} · AI 定妆照`, thumb: src?.thumb || `/clips/c${(hash(id) % 12) + 1}-t4.jpg`, source: 'ai', hue: (hash(id) % 300) + 30};
      return fileInto({...state, assets: [...state.assets, asset]}, id, a.pid, a.vid);
    }
    case 'saveFrame': {
      const id = uid('fr');
      const asset = {id, kind: 'image', name: `截帧 · ${a.label}`, thumb: `/clips/${a.clip}-t${a.t}.jpg`, source: 'frame'};
      const s = {...state, assets: [...state.assets, asset]};
      return a.pid ? fileInto(s, id, a.pid, a.vid) : {...s, assets: s.assets.map(x => (x.id === id ? {...x, inbox: true} : x))};
    }
    case 'addVoice': return mapProfile(state, a.pid, p => {
      const voices = p.voices || [];
      if (voices.some(v => v.asset === a.asset)) return p;
      return {...p, voices: [...voices, {asset: a.asset, start: 0, note: ''}], voice: p.voice || a.asset};
    });
    case 'removeVoice': return mapProfile(state, a.pid, p => {
      const voices = (p.voices || []).filter(v => v.asset !== a.asset);
      return {...p, voices, voice: p.voice === a.asset ? voices[0]?.asset || null : p.voice,
        variants: p.variants.map(v => (v.voice === a.asset ? {...v, voice: null} : v))};
    });
    case 'voice': return mapProfile(state, a.pid, p => ({...p, voices: (p.voices || []).map(v => (v.asset === a.asset ? {...v, ...a.patch} : v))}));
    case 'uploadFiles': {
      const assets = a.files.map(f => ({...f, id: uid('f'), source: 'upload', inbox: !a.target, from: state.page === 'story' ? state.activeStory : null, tags: []}));
      let s = {...state, assets: [...state.assets, ...assets]};
      for (const x of assets) {
        if (a.target?.kind === 'image' && x.kind === 'image') s = fileInto(s, x.id, a.target.pid, a.target.vid);
        else if (a.target?.kind === 'voice' && x.kind === 'audio') s = reducer(s, {type: 'addVoice', pid: a.target.pid, asset: x.id});
        else if (a.target) s = {...s, assets: s.assets.map(y => (y.id === x.id ? {...y, inbox: true} : y))};
      }
      return s;
    }
    case 'upload': return {...state, assets: [...state.assets, ...mockUploads()], uploads: state.uploads + 1};
    case 'dismissInbox': return {...state, assets: state.assets.map(x => (x.id === a.asset ? {...x, inbox: false, suggest: null} : x))};

    // generation
    case 'generate': {
      const ids = new Set(a.ids);
      const n = a.count || 1, many = s => { let x = s; for (let i = 0; i < n; i++) x = enqueue(state, x, a.quality, n > 1); return x; };
      return {...state, shots: state.shots.map(s => (ids.has(s.id) ? many(s) : s))};
    }
    case 'versionPatch': return mapShot(state, a.shot, s => ({...s, versions: s.versions.map(v => (v.id === a.version ? {...v, ...a.patch} : v))}));
    case 'choose': return mapShot(state, a.shot, s => ({...s, chosen: a.version}));
    case 'cancel': return mapShot(state, a.shot, s => ({...s, versions: s.versions.filter(v => v.id !== a.version)}));
    case 'tick': {
      const clock = state.clock + a.dt;
      // Story shots and 快速创作 results share one queue per mode, served in the order they were queued.
      const all = [...state.shots.flatMap(s => s.versions.map(v => ({s, v}))),
        ...(state.sessions || []).flatMap(x => x.messages.filter(m => m.role === 'result' && !m.hidden).map(m => ({q: true, v: {id: m.id, status: m.status, mode: m.mode, enqueuedAt: m.enqueuedAt ?? 0}})))];
      // Machine lifecycle (simulated, fast): renting 3s -> downloading 5s -> loading 3s -> ready; stopping 2s -> ended.
      const STEP = {renting: ['downloading', 3], downloading: ['loading', 5], loading: ['ready', 3], switching: ['ready', 2]};
      let machines = (state.machines || []).map(m => (m.active ? m : {...m, active: m.mode}));
      let ended = state.ended;
      // 自动加机器: when a mode's queue reaches the threshold and it has no machine on the way, start one (up to max).
      const auto = state.autoscale || {};
      for (const mode of ['FL', 'REF']) {
        const rule = auto[mode]; if (!rule?.on) continue;
        const waitingN = all.filter(({v}) => v.status === 'queued' && v.mode === mode).length;
        const mine = machines.filter(m => m.mode === mode || m.mode === 'both');
        if (waitingN >= rule.queue && mine.length < rule.max && !mine.some(m => ['renting', 'downloading', 'loading'].includes(m.status)))
          machines = [...machines, {id: uid('m'), mode, active: mode, quality: 'draft', gpu: 'RTX 5090', region: '美国', provider: 'Vast', host: uid('vast-'), price: 0.45,
            keep: 'idle', idleMin: 10, status: 'renting', since: clock, startedAt: clock, jobs: 0, auto: true}];
      }
      if (machines.some(m => STEP[m.status] || m.status === 'stopping')) {
        const gone = machines.filter(m => m.status === 'stopping' && clock - m.since >= 2);
        machines = machines.filter(m => !gone.includes(m)).map(m => (STEP[m.status] && clock - m.since >= STEP[m.status][1] ? {...m, status: STEP[m.status][0], since: clock} : m));
        ended = [...gone.map(m => ({...m, ranMin: Math.max(1, Math.round((clock - (m.startedAt ?? 0)) / 6)), reason: '手动关机'})), ...ended];
      }
      const ready = {FL: 0, REF: 0};
      machines.forEach(m => m.status === 'ready' && (ready[m.active] += 1));
      // A machine that holds both models switches to the other mode when only that mode has work (simulated 2s switch).
      const waitBy = mode => all.filter(({v}) => v.status === 'queued' && v.mode === mode).length;
      const busyBy = mode => all.filter(({v}) => v.status === 'generating' && v.mode === mode).length;
      machines = machines.map(m => {
        if (m.mode !== 'both' || m.status !== 'ready') return m;
        const other = m.active === 'FL' ? 'REF' : 'FL';
        if (waitBy(other) > 0 && waitBy(m.active) === 0 && busyBy(m.active) < ready[m.active] && ready[other] === 0) { ready[m.active] -= 1; return {...m, status: 'switching', since: clock, active: other}; }
        return m;
      });
      const running = {FL: 0, REF: 0};
      all.forEach(({v}) => v.status === 'generating' && (running[v.mode] += 1));
      const toStart = new Set();
      for (const mode of ['FL', 'REF']) {
        const queued = all.filter(({v}) => v.status === 'queued' && v.mode === mode).sort((x, y) => x.v.enqueuedAt - y.v.enqueuedAt);
        for (const {v} of queued) { if (running[mode] >= ready[mode]) break; toStart.add(v.id); running[mode] += 1; }
      }
      let changed = toStart.size > 0;
      const shots = state.shots.map(s => {
        let touched = false;
        const versions = s.versions.map(v => {
          if (toStart.has(v.id)) { touched = true; return {...v, status: 'generating', progress: 0, startedAt: clock}; }
          if (v.status !== 'generating') return v;
          touched = true;
          const progress = Math.min(1, v.progress + a.dt / MODELS[v.quality].sim);
          if (progress < 1) return {...v, progress};
          const same = v.sameSeedAs && s.versions.find(x => x.id === v.sameSeedAs);
          return {...v, progress: 1, status: 'done', doneAt: clock, clip: same?.clip || CLIPS[hash(s.id + v.n + v.seed) % CLIPS.length]};
        });
        if (!touched) return s;
        changed = true;
        const firstDone = !s.chosen && versions.find(v => v.status === 'done');
        return {...s, versions, chosen: s.chosen || (firstDone ? firstDone.id : null)};
      });
      let sessions = state.sessions;
      if (sessions.some(x => x.messages.some(m => m.role === 'result' && (m.status === 'queued' || m.status === 'generating')))) {
        sessions = sessions.map(x => ({...x, messages: x.messages.map(m => {
          if (m.role !== 'result') return m;
          if (m.status === 'queued' && toStart.has(m.id)) return {...m, status: 'generating', progress: 0};
          if (m.status !== 'generating') return m;
          const progress = Math.min(1, m.progress + a.dt / MODELS[m.quality].sim);
          return progress < 1 ? {...m, progress} : {...m, progress: 1, status: 'done', clip: CLIPS[hash(m.id) % CLIPS.length]};
        })}));
        changed = true;
      }
      // Credit each finished job to a ready machine of that mode (for 机器详情 · 完成任务).
      const finished = shots.flatMap(x => x.versions).filter(v => v.doneAt === clock).map(v => v.mode);
      finished.forEach(mode => { const i = machines.findIndex(m => m.active === mode && m.status === 'ready'); if (i >= 0) machines = machines.map((m, j) => (j === i ? {...m, jobs: (m.jobs || 0) + 1} : m)); });
      return {...state, shots, clock, machines, ended, sessions};
    }
    // 只给这个故事复制一份档案：本故事的镜头改用副本，其它故事不受影响。
    case 'forkProfile': {
      const p = state.profiles.find(x => x.id === a.pid);
      if (!p) return state;
      const id = uid('p'), copy = {...JSON.parse(JSON.stringify(p)), id, name: `${p.name}（${a.storyTitle}）`};
      const swap = x => (x === a.pid ? id : x);
      const shots = state.shots.map(s => (s.storyId !== a.storyId ? s : {...s, cast: s.cast.map(c => ({...c, id: swap(c.id)})),
        place: s.place ? {...s.place, id: swap(s.place.id)} : s.place, props: s.props.map(swap),
        picks: s.picks && s.picks[a.pid] ? {...Object.fromEntries(Object.entries(s.picks).filter(([k]) => k !== a.pid)), [id]: s.picks[a.pid]} : s.picks}));
      return {...state, profiles: [...state.profiles, copy], shots, openProfile: id};
    }
    case 'openProfile': return {...state, openProfile: a.id};
    default: return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({children}) {
  const [state, dispatch] = useReducer(reducer, null, load);
  useEffect(() => { const t = setInterval(() => dispatch({type: 'tick', dt: 0.25}), 250); return () => clearInterval(t); }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }, [state]);
  const view = useMemo(() => liveView(state), [state]);
  const db = useMemo(() => makeDb(view), [view]);
  // One toast for the whole app; with undo it stays a little longer.
  const [note, setNote] = useState(null);
  const toast = useCallback((text, undo) => setNote(text ? {text, undo, at: Date.now()} : null), []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), note.undo ? 6000 : 3500); return () => clearTimeout(t); }, [note]);
  // 移到回收站 never asks first; it can always be undone.
  const trash = useCallback((item, label) => { dispatch({type: 'trash', item}); toast(`「${label}」已移到回收站`, () => dispatch({type: 'restore', item})); }, [toast]);
  return <Ctx.Provider value={{state: view, raw: state, dispatch, db, toast, trash}}>{children}
    {note && <div className="toast undo-toast" key={note.at}>{note.text}{note.undo && <button onClick={() => { note.undo(); setNote(null); }}>撤销</button>}</div>}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

// One queue per mode, shared by story shots and 快速创作 results (they use the same machines).
// Returns position by shot id and by 快速创作 message id.
export function queuePositions(state) {
  const pos = {}, msgs = {};
  for (const mode of ['FL', 'REF']) {
    const q = [...state.shots.flatMap(s => s.versions.filter(v => v.status === 'queued' && v.mode === mode).map(v => ({at: v.enqueuedAt ?? 0, shot: s.id}))),
      ...(state.sessions || []).flatMap(x => x.messages.filter(m => m.role === 'result' && m.status === 'queued' && m.mode === mode).map(m => ({at: m.enqueuedAt ?? 0, msg: m.id})))];
    q.sort((x, y) => x.at - y.at).forEach((e, i) => { if (e.shot) pos[e.shot] = i + 1; else msgs[e.msg] = i + 1; });
  }
  pos.msgs = msgs;
  return pos;
}
