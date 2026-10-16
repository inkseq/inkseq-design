import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter, pointerWithin, useSensor, useSensors} from '@dnd-kit/core';
import {sortableKeyboardCoordinates} from '@dnd-kit/sortable';
import {StoreProvider, useStore} from './store.jsx';
import {AssetThumb} from './components.jsx';
import {Workspace} from './layouts.jsx';
import {Home} from './home.jsx';
import {QuickPage} from './quick.jsx';
import {SettingsPage} from './pages.jsx';
import {GpuPage} from './gpu.jsx';
import {TrashPage} from './trashPage.jsx';
import {LibraryPage} from './library.jsx';
import {coverOf, planDrop, variantOf} from './model.js';
import './styles.css';
import {installHoldHint} from './holdhint.js';
import {startI18n} from './i18n.js';

installHoldHint();

// Files and profiles drop only where the pointer is (the most specific target wins);
// shots reorder by nearest position.
const collision = args => {
  const id = String(args.active.id);
  if (id.startsWith('asset:') || id.startsWith('profile:')) {
    const hits = pointerWithin(args).filter(h => !(id.startsWith('profile:') && /^(pdrop|vdrop|voicedrop):/.test(String(h.id))));
    const best = hits.find(h => /^(slot|vdrop|voicedrop):/.test(String(h.id)));
    return best ? [best] : hits;
  }
  // Shots: a card under the pointer wins, then a scene area (move to its end), else the nearest card.
  const hits = pointerWithin(args).filter(h => /^(shot|scene):/.test(String(h.id)) && String(h.id) !== id);
  const card = hits.find(h => String(h.id).startsWith('shot:'));
  if (card) return [card];
  const scene = hits.find(h => String(h.id).startsWith('scene:'));
  if (scene) return [scene];
  return closestCenter({...args, droppableContainers: args.droppableContainers.filter(c => String(c.id).startsWith('shot:'))});
};


function App() {
  const {state, dispatch, db, toast: setToast} = useStore();
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}),
    useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));

  useEffect(() => { if (state.lastAdded) setSelected(state.lastAdded); }, [state.lastAdded, state.focusAt]);
  // ?page=home|quick|library|gpu|settings|trash|story opens that page directly (handy for links and side-by-side tabs).
  useEffect(() => {
    const p = new URLSearchParams(location.search).get('page');
    if (p === 'story') { const id = state.activeStory || state.stories[0]?.id; if (id) dispatch({type: 'openStory', id}); }
    else if (p === 'quick') { const s = state.sessions.find(x => !x.trashedAt); s ? dispatch({type: 'qcOpen', id: s.id}) : dispatch({type: 'qcNew'}); }
    else if (['home', 'library', 'gpu', 'settings', 'trash'].includes(p)) dispatch({type: 'page', page: p});
  }, []); // eslint-disable-line

  // item = {asset: id} | {profile: id}
  const dropOnShot = (item, shotId, slot = 'smart') => {
    const s = state.shots.find(x => x.id === shotId);
    const obj = item.profile ? {profile: db.profile(item.profile)} : {asset: db.asset(item.asset)};
    if (!s || !(obj.profile || obj.asset)) return;
    setToast(`「${(obj.profile || obj.asset).name}」→「${s.title}」：${planDrop(s, obj, slot, db).msg}`);
    dispatch({type: 'drop', ...item, shot: shotId, slot});
  };
  const pick = item => {
    if (!selected) {
      if (item.profile) return dispatch({type: 'openProfile', id: item.profile});
      return setToast('先选中一个镜头，或者直接把素材拖到镜头上');
    }
    dropOnShot(item, selected);
  };

  const onDragStart = e => {
    const id = String(e.active.id);
    setDragging(id.startsWith('asset:') ? {asset: id.slice(6)} : id.startsWith('profile:') ? {profile: id.slice(8)} : null);
  };
  const onDragEnd = ({active, over}) => {
    setDragging(null);
    if (!over) return;
    const a = String(active.id), o = String(over.id);
    if (a.startsWith('shot:') && o.startsWith('shot:')) return dispatch({type: 'moveShot', id: a.slice(5), beforeId: o.slice(5)});
    if (a.startsWith('shot:') && o.startsWith('scene:')) return dispatch({type: 'moveShot', id: a.slice(5), sceneId: o.slice(6)});
    const item = a.startsWith('asset:') ? {asset: a.slice(6)} : a.startsWith('profile:') ? {profile: a.slice(8)} : null;
    if (!item) return;
    if (o.startsWith('shot:')) return dropOnShot(item, o.slice(5));
    if (o.startsWith('slot:')) { const [, slot, shot] = o.split(':'); return dropOnShot(item, shot, slot === 'cast' ? 'smart' : slot); }
    if (item.asset && /^(pdrop|vdrop|voicedrop):/.test(o)) {
      const asset = db.asset(item.asset);
      const [kind, pid, vid] = o.split(':');
      const p = db.profile(pid);
      if (!asset || !p) return;
      if (asset.kind === 'audio') {
        if (p.type === 'character') { dispatch({type: 'addVoice', pid, asset: asset.id}); return setToast(`「${asset.name}」已加为 ${p.name} 的声音`); }
        if (p.type === 'location') { dispatch({type: 'profile', id: pid, patch: {ambient: asset.id}}); return setToast(`「${asset.name}」已设为 ${p.name} 的环境声`); }
        return setToast('道具不能放声音');
      }
      if (asset.kind !== 'image') return setToast('动作视频请拖到镜头上，作为全能参考的附加素材');
      if (kind === 'voicedrop') return setToast('这里放声音；照片请拖到上面的造型照片区');
      const v = variantOf(p, vid || p.def);
      dispatch({type: 'fileImage', asset: item.asset, pid, vid: v.id});
      setToast(`「${asset.name}」已存进 ${p.name} · ${v.name}`);
    }
  };

  const dragged = dragging && (dragging.asset ? db.asset(dragging.asset) : db.profile(dragging.profile));
  const draggedThumb = dragging?.profile ? coverOf(db, dragged, dragged?.def) : dragged;
  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="app">
        {state.page === 'story' && state.activeStory ? <Workspace selected={selected} setSelected={setSelected} pickAsset={pick} onToast={setToast} />
          : state.page === 'quick' ? <QuickPage onToast={setToast} /> : state.page === 'gpu' ? <GpuPage /> : state.page === 'trash' ? <TrashPage /> : state.page === 'library' ? <LibraryPage /> : state.page === 'settings' ? <SettingsPage onToast={setToast} /> : <Home onToast={setToast} />}
      </div>
      <DragOverlay dropAnimation={null}>{dragged ? <div className="achip overlay"><AssetThumb asset={draggedThumb} /><b>{dragged.name}</b></div> : null}</DragOverlay>
      <div className="proto-note">原型 · 示例数据 · 生成和粗剪是模拟的 · 字幕和镜头清单可真实下载 · 不连服务器，不花钱</div>
    </DndContext>
  );
}

createRoot(document.getElementById('root')).render(<StoreProvider><App /></StoreProvider>);
startI18n();
