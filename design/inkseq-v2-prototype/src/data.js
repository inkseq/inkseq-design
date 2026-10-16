// Demo data for the prototype. Profiles (人物 / 场景 / 道具) group raw files plus descriptions.

const portrait = (letter, bg, tag) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="${bg}"/>` +
    `<circle cx="80" cy="62" r="30" fill="#fff" opacity=".9"/><rect x="34" y="100" width="92" height="60" rx="26" fill="#fff" opacity=".9"/>` +
    `<text x="80" y="72" font-size="28" text-anchor="middle" fill="${bg}" font-family="sans-serif">${letter}</text>` +
    `<rect x="0" y="134" width="160" height="26" fill="rgba(0,0,0,.35)"/><text x="80" y="152" font-size="15" text-anchor="middle" fill="#fff" font-family="sans-serif">${tag}</text></svg>`);
const frame = (c, t) => `/clips/c${c}-t${t}.jpg`;

export const KIND_LABEL = {image: '图片', video: '动作视频', audio: '声音'};
export const TYPE_LABEL = {character: '人物', location: '场景', prop: '道具'};
export const VARIANT_LABEL = {character: '造型', location: '版本', prop: '图片组'};

export function seedAssets() {
  const a = [];
  const img = (id, name, thumb, extra = {}) => a.push({id, kind: 'image', name, thumb, ...extra});
  // character photos
  img('lin-u1', '林岚 · 制服正面', portrait('岚', '#3b5b4f', '制服 正面'));
  img('lin-u2', '林岚 · 制服侧面', portrait('岚', '#35524a', '制服 侧面'));
  img('lin-u3', '林岚 · 制服全身', portrait('岚', '#2f4a42', '制服 全身'));
  img('lin-c1', '林岚 · 便装正面', portrait('岚', '#8a6d4b', '便装 正面'));
  img('lin-c2', '林岚 · 便装半身', portrait('岚', '#7d6243', '便装 半身'));
  img('zhou-u1', '周屿 · 制服正面', portrait('屿', '#5b4a3b', '制服 正面'));
  img('zhou-u2', '周屿 · 背影', portrait('屿', '#4d3d2c', '背影'));
  img('chen-1', '老陈 · 正面', portrait('陈', '#7a4b3a', '正面'));
  // location images
  img('hall-d', '售票厅 · 白天', frame(7, 2)); img('hall-n', '售票厅 · 夜', frame(7, 6)); img('hall-c', '售票厅 · 柜台', frame(8, 4));
  img('lost-1', '失物间 · 门口', frame(8, 2)); img('lost-2', '失物间 · 储物柜', frame(11, 4));
  img('plat-1', '站台 · 雨夜', frame(2, 4)); img('plat-2', '站台 · 长椅', frame(1, 6));
  // props
  img('letter-1', '信 · 信封', frame(11, 2)); img('letter-2', '信 · 信纸特写', frame(11, 6));
  img('tape-1', '录音机', frame(5, 4)); img('watch-1', '怀表', frame(9, 4));
  // loose storyboard sketches
  ['推门', '看信', '回头', '雨中奔跑'].forEach((n, i) => img('sb' + i, '分镜草图 · ' + n, frame(i + 3, 2)));
  // motion references
  [['mv-push', '推门动作', 2.5, 6], ['mv-turn', '回头动作', 6, 5], ['mv-run', '奔跑动作', 4, 10], ['mv-open', '拆信动作', 3, 12]]
    .forEach(([id, name, s, c]) => a.push({id, kind: 'video', name, thumb: frame(c, 4), seconds: s}));
  // audio
  [['au-lin', '林岚 · 说话样本（平静）', 15], ['au-lin2', '林岚 · 说话样本（激动）', 10], ['au-zhou', '周屿 · 说话样本', 12],
   ['au-hall', '售票厅 · 空旷回声', 8], ['au-rain', '雨声', 10], ['au-tape', '录音机杂音', 2], ['au-music', '配乐 · 钢琴主题', 20]]
    .forEach(([id, name, s]) => a.push({id, kind: 'audio', name, seconds: s, src: `/audio/${id}.mp3`}));
  return a;
}

export function seedProfiles() {
  return [
    {id: 'lin', type: 'character', name: '林岚', desc: '25 岁女性，短发，沉静，观察细致', voice: 'au-lin', def: 'uniform',
      voices: [{asset: 'au-lin', start: 2, note: '平时说话'}, {asset: 'au-lin2', start: 4, note: '情绪激动时'}],
      variants: [{id: 'uniform', name: '制服', desc: '深灰色车站制服，白衬衫', images: ['lin-u1', 'lin-u2', 'lin-u3']},
        {id: 'casual', name: '便装', desc: '米色风衣，黑色围巾', images: ['lin-c1', 'lin-c2']},
        {id: 'young', name: '回忆 · 少女', desc: '十几岁，校服，长发', images: []}]},
    {id: 'zhou', type: 'character', name: '周屿', desc: '30 岁男性，瘦高，说话克制', voice: 'au-zhou', def: 'uniform',
      voices: [{asset: 'au-zhou', start: 0, note: ''}],
      variants: [{id: 'uniform', name: '制服', desc: '深蓝色站务制服', images: ['zhou-u1', 'zhou-u2']}]},
    {id: 'chen', type: 'character', name: '老陈', desc: '60 岁售票员，花白头发，眼镜', voice: null, def: 'main', voices: [],
      variants: [{id: 'main', name: '日常', desc: '旧毛衣，袖套', images: ['chen-1']}]},
    {id: 'hall', type: 'location', name: '旧车站 · 售票厅', desc: '柜台在北侧，入口在南侧，失物间门在右侧，空旷', ambient: 'au-hall', def: 'night',
      variants: [{id: 'day', name: '白天', desc: '阳光斜照，灰尘飘浮', images: ['hall-d', 'hall-c']},
        {id: 'night', name: '夜', desc: '冷色灯管，灯光闪烁', images: ['hall-n', 'hall-c']}]},
    {id: 'lost', type: 'location', name: '旧车站 · 失物间', desc: '狭窄过道，旧储物柜，桌上有录音机', ambient: null, def: 'main',
      variants: [{id: 'main', name: '默认', desc: '昏暗，只有一盏台灯', images: ['lost-1', 'lost-2']}]},
    {id: 'plat', type: 'location', name: '旧车站 · 站台', desc: '露天站台，铁轨延伸到远处', ambient: 'au-rain', def: 'rain',
      variants: [{id: 'rain', name: '雨夜', desc: '大雨，站灯昏黄', images: ['plat-1', 'plat-2']}]},
    {id: 'letter', type: 'prop', name: '信', desc: '泛黄的信封，红色邮戳，日期写着明天', def: 'main',
      variants: [{id: 'main', name: '图片', desc: '', images: ['letter-1', 'letter-2']}]},
    {id: 'tape', type: 'prop', name: '录音机', desc: '老式卡带录音机，银色外壳', def: 'main',
      variants: [{id: 'main', name: '图片', desc: '', images: ['tape-1']}]},
    {id: 'watch', type: 'prop', name: '怀表', desc: '黄铜怀表，表盖刻着字母 L', def: 'main',
      variants: [{id: 'main', name: '图片', desc: '', images: ['watch-1']}]},
  ];
}

const v = (n, clip, quality = 'draft') => ({id: 'v' + Math.random().toString(36).slice(2, 8), n, clip, quality, seed: 1000 + n, status: 'done', progress: 1});
export const BLANK_SHOT = {start: null, end: null, refs: [], cast: [], place: null, props: [], continuePrev: false, quality: 'draft',
  seedLock: false, versions: [], chosen: null, dialogue: '', script: '', prompt: '', duration: 5, mode: 'FL'};
const base = BLANK_SHOT;
const at = (storyId, chapterId, sceneId) => ({storyId, chapterId, sceneId});

export const DEFAULT_SETTINGS = {logline: '', audience: '', aspect: '16:9', targetSec: 60, style: '', defaultQuality: 'draft'};

export function seedStories() {
  return [
    {id: 'st1', title: '最后一班来信', local: false, updatedAt: Date.now() - 2 * 3600e3,
      settings: {...DEFAULT_SETTINGS, logline: '停运的车站里，林岚收到一封来自明天的信。', audience: '18–35 岁悬疑短剧观众',
        style: '电影感，冷色调，胶片颗粒，夜景低照度'},
      chapters: [
        {id: 'ch1', title: '明天的信', scenes: [{id: 'sc1', title: '收到来信'}, {id: 'sc2', title: '门后的声音'}]},
        {id: 'ch2', title: '失物间', scenes: [{id: 'sc3', title: '未播完的录音'}]},
      ]},
    {id: 'st2', title: '雨中剑客斩机械龙', local: false, updatedAt: Date.now() - 26 * 3600e3,
      settings: {...DEFAULT_SETTINGS, logline: '雨夜里，一名剑客独自对抗失控的机械龙。', aspect: '9:16', style: '水墨质感，雨夜，强对比'},
      chapters: [{id: 'ch-r1', title: '第一章', scenes: [{id: 'sc-r1', title: '街口'}]}]},
    {id: 'st3', title: '霓虹雨夜：剑客追龙', local: true, updatedAt: Date.now() - 5 * 24 * 3600e3,
      settings: {...DEFAULT_SETTINGS, aspect: '9:16'}, chapters: [{id: 'ch-n1', title: '第一章', scenes: [{id: 'sc-n1', title: '场 1'}]}]},
  ];
}

export function seedShots() {
  const s1 = [v(1, 'c1'), v(2, 'c2')], s2 = [v(1, 'c7')], s3 = [v(1, 'c3')], r1 = [v(1, 'c9')];
  return [
    {...base, ...at('st1', 'ch1', 'sc1'), id: 's1', title: '推门进站', script: '深夜，林岚推开停运车站的大门。', prompt: '推开玻璃门走进来，镜头缓慢跟进', duration: 6,
      cast: [{id: 'lin', variant: 'uniform'}], place: {id: 'hall', variant: 'night'}, versions: s1, chosen: s1[1].id},
    {...base, ...at('st1', 'ch1', 'sc1'), id: 's2', title: '看到桌上的信', script: '售票厅柜台上放着一封信。', prompt: '镜头从柜台推近到信封', duration: 6,
      place: {id: 'hall', variant: 'night'}, props: ['letter'], start: 'hall-c', end: 'letter-1', versions: s2, chosen: s2[0].id},
    {...base, ...at('st1', 'ch1', 'sc1'), id: 's3', mode: 'REF', title: '拆开信', script: '林岚拆开信，神情从疑惑变成震惊。', dialogue: '这……是明天的日期？',
      prompt: '她拆开信，表情从疑惑变为震惊，近景', duration: 5, cast: [{id: 'lin', variant: 'uniform'}], props: ['letter'], refs: ['mv-open'], versions: s3, chosen: s3[0].id},
    {...base, ...at('st1', 'ch1', 'sc2'), id: 's4', title: '明天的日期', script: '信纸上的日期，是明天。', prompt: '信纸特写，日期清晰，手指微微发抖', duration: 5,
      props: ['letter'], continuePrev: true},
    {...base, ...at('st1', 'ch1', 'sc2'), id: 's5', mode: 'REF', title: '录音机响起', script: '失物间里，旧录音机自己开始播放。', dialogue: '（录音）林岚，别回头。',
      prompt: '桌上的录音机突然开始转动', duration: 5, place: {id: 'lost', variant: 'main'}, props: ['tape'], refs: ['au-tape']},
    {...base, ...at('st1', 'ch1', 'sc2'), id: 's6', mode: 'REF', title: '回头', script: '身后有人叫她的名字。林岚回头。', dialogue: '谁？',
      prompt: '听到声音猛然回头，背景虚化', duration: 5, cast: [{id: 'lin', variant: 'casual'}], place: {id: 'lost', variant: 'main'}, refs: ['mv-turn']},
    {...base, ...at('st1', 'ch2', 'sc3'), id: 's7', title: '旧储物柜', script: '一排旧储物柜，其中一个半开着。', prompt: '缓慢横移，储物柜门半开', duration: 6, place: {id: 'lost', variant: 'main'}},
    {...base, ...at('st1', 'ch2', 'sc3'), id: 's8', title: '怀表', script: '柜子里有一块刻着 L 的怀表。', prompt: '手拿起怀表，翻开表盖', duration: 5, props: ['watch']},
    {...base, ...at('st2', 'ch-r1', 'sc-r1'), id: 'r1', title: '雨夜街口', script: '大雨中，剑客站在空荡的街口。', prompt: '雨夜街口，剑客背影，霓虹倒影', duration: 6, versions: r1, chosen: r1[0].id},
    {...base, ...at('st2', 'ch-r1', 'sc-r1'), id: 'r2', title: '机械龙出现', script: '远处传来金属摩擦声，机械龙从楼后探出头。', prompt: '巨大的机械龙从楼后出现，火花四溅', duration: 6},
  ];
}

// Quick Chat results that can be moved into a story as a shot.
export function seedQuickChats() {
  return [
    {id: 'qc1', title: '雨中剑客斩机械龙 · 试拍', prompt: '剑客挥剑，雨水飞溅，慢动作', clip: 'c10', mode: 'FL', at: Date.now() - 20 * 3600e3},
    {id: 'qc2', title: '霓虹雨夜：剑客追龙', prompt: '霓虹街道追逐，镜头跟拍', clip: 'c12', mode: 'FL', at: Date.now() - 40 * 3600e3},
    {id: 'qc3', title: '林岚 · 回眸测试', prompt: '短发女子回头，背景虚化', clip: 'c5', mode: 'REF', at: Date.now() - 3 * 24 * 3600e3},
  ];
}

// Split a pasted script into chapters / scenes / shots.
// "第…章" starts a chapter; "场…", "## …" or "【…】" starts a scene; every other non-empty line is a shot.
export function parseScript(text) {
  const chapters = [];
  const newChapter = title => { const c = {title, scenes: []}; chapters.push(c); return c; };
  const newScene = (c, title) => { const s = {title, shots: []}; c.scenes.push(s); return s; };
  let ch = null, sc = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^第.{1,6}章/.test(line)) { ch = newChapter(line.replace(/^#+\s*/, '')); sc = null; continue; }
    if (/^(场|场景|##\s|【)/.test(line)) { ch = ch || newChapter('第一章'); sc = newScene(ch, line.replace(/^#+\s*|[【】]/g, '')); continue; }
    ch = ch || newChapter('第一章'); sc = sc || newScene(ch, '场 1');
    sc.shots.push(line);
  }
  return chapters;
}

// Mock "uploads" that land in 待整理 with a suggested profile.
export function mockUploads() {
  const t = Date.now().toString(36);
  return [
    {id: 'up1' + t, kind: 'image', name: 'IMG_0412 林岚 雨衣.jpg', thumb: portrait('岚', '#2d5d7a', '雨衣'), inbox: true, suggest: {id: 'lin'}},
    {id: 'up2' + t, kind: 'image', name: 'IMG_0413 林岚 雨衣 侧.jpg', thumb: portrait('岚', '#28556f', '雨衣 侧'), inbox: true, suggest: {id: 'lin'}},
    {id: 'up3' + t, kind: 'image', name: '站台_白天.jpg', thumb: frame(1, 2), inbox: true, suggest: {id: 'plat'}},
    {id: 'up4' + t, kind: 'image', name: '怀表_打开.jpg', thumb: frame(9, 6), inbox: true, suggest: {id: 'watch'}},
    {id: 'up5' + t, kind: 'image', name: 'DSC_9921.jpg', thumb: frame(12, 4), inbox: true, suggest: null},
  ];
}

export const CLIPS = Array.from({length: 12}, (_, i) => 'c' + (i + 1));
