// Live story chat (#422): the same interface as story-chat-preview.js, backed by
// /v1/story-chats. The server owns the transcript and cards; every reply replaces the local
// state with the server's view. Paid generation is never started here: a proposal hands the
// story to Works, where the existing preflight, quote and confirmation run.

const KIND = { characters: 'character', places: 'place', props: 'prop' };

export function fromServer(view, labels = {}) {
  const cards = [];
  for (const [group, kind] of Object.entries(KIND))
    for (const card of view.cards?.[group] || [])
      cards.push({ id: card.id, kind, name: card.name, text: card.text, version: card.version });
  for (const shot of view.cards?.shots || [])
    cards.push({
      id: shot.id,
      kind: 'shot',
      order: shot.order,
      text: shot.text,
      start: shot.start,
      end: shot.end,
      seconds: shot.seconds,
      cast: shot.cast || [],
      place: shot.place || null,
      props: shot.props || [],
      refs: [...(shot.cast || []), shot.place, ...(shot.props || [])].filter(Boolean),
      status: shot.selected_artifact_id ? 'ready' : 'draft',
      version: shot.version,
    });
  const messages = [],
    quotes = {};
  // Only the newest reply's proposal is actionable; older ones are superseded by later edits.
  const latest = [...(view.messages || [])].reverse().find((item) => item.role === 'assistant');
  for (const message of view.messages || []) {
    if (message.role === 'user') {
      messages.push({
        id: message.id,
        role: 'user',
        text: message.text,
        attachments: [],
        chips: [],
      });
      continue;
    }
    const counts = {};
    for (const change of message.changes || []) {
      if (change.op !== 'create') continue;
      const kind = change.kind === 'location' || change.kind === 'prop' ? 'place' : change.kind;
      counts[kind] = (counts[kind] || 0) + 1;
    }
    const edits = (message.changes || []).filter(
      (change) => change.op === 'update' && change.kind !== 'title',
    ).length;
    for (const [kind, count] of Object.entries(counts))
      if (['character', 'place', 'shot'].includes(kind))
        messages.push({ id: `${message.id}-${kind}`, role: 'change', summary: { kind, count } });
    if (edits)
      messages.push({
        id: `${message.id}-edit`,
        role: 'change',
        summary: { kind: 'edit', count: edits },
      });
    messages.push({
      id: message.id,
      role: 'assistant',
      text: message.text,
      attachments: [],
      chips: message.chips || [],
    });
    if (message === latest && message.proposal?.shot_ids?.length) {
      const id = `${message.id}-q`;
      quotes[id] = {
        id,
        live: true,
        status: 'open',
        action: { kind: 'generate', cards: message.proposal.shot_ids },
        label: labels.generate?.(message.proposal.shot_ids.length) || '',
      };
      messages.push({ id, role: 'quote', quoteId: id });
    }
  }
  return { title: view.title || '', version: view.version, cards, messages, quotes, busy: false };
}

const turnId = () =>
  'turn-' +
  (globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2) + Date.now().toString(36));

export function createLiveChat({ api, language = 'zh', projectId = null, labels, onProject }) {
  let project = projectId,
    view = null;
  const settled = {};
  const load = (value, emit, fresh = []) => {
    view = value;
    const state = fromServer(value, labels);
    for (const [id, status] of Object.entries(settled))
      if (state.quotes[id]) state.quotes[id] = { ...state.quotes[id], status };
    emit({ type: 'chat.loaded', state, fresh });
  };
  async function ensure() {
    if (project) return project;
    const created = await api.request('/v1/story-chats', { method: 'POST', body: { language } });
    project = created.project_id;
    view = created;
    onProject?.(project);
    return project;
  }
  return {
    live: true,
    balance: Number.NaN,
    get projectId() {
      return project;
    },
    async open(emit) {
      if (!project) return;
      load(await api.request(`/v1/story-chats/${encodeURIComponent(project)}`), emit);
    },
    async send({ text }, emit) {
      const id = turnId();
      emit({ type: 'user.message', id: id + '-u', text });
      emit({ type: 'turn.started' });
      try {
        const ident = await ensure();
        const value = await api.request(`/v1/story-chats/${encodeURIComponent(ident)}/turns`, {
          method: 'POST',
          body: { turn_id: id, text },
        });
        load(value, emit, (value.turn?.changes || []).map((change) => change.id).filter(Boolean));
      } catch (failure) {
        emit({
          type: 'assistant.message',
          id: id + '-error',
          text: labels.failed?.(failure) || failure.message,
          chips: [],
        });
        emit({ type: 'turn.finished' });
      }
    },
    // The live proposal opens the story in Works, where generation is confirmed and charged.
    settle(quote, accepted, _cards, emit) {
      settled[quote.id] = accepted ? 'confirmed' : 'declined';
      emit({ type: 'quote.settled', id: quote.id, status: settled[quote.id] });
      if (accepted) labels.openWorks?.(project, quote.action.cards?.[0]);
    },
    propose(action, card) {
      if (action.kind === 'generate') labels.openWorks?.(project, card.id);
    },
    // A card edit from the drawer goes through the ordinary project actions API.
    async edit(id, patch, emit) {
      const card = fromServer(view, labels).cards.find((item) => item.id === id);
      if (!card || !project) return;
      const path = `/v1/projects/${encodeURIComponent(project)}`;
      const change = {};
      let expected = view.version;
      if (card.kind === 'shot') {
        const data = {};
        if ('text' in patch) {
          data.prompt = patch.text;
          change.description = patch.text;
        }
        if ('refs' in patch) {
          // Merge into the stored storyboard so explicit generation choices survive.
          const current = await api.request(path);
          expected = current.version;
          const entity = current.project.entities.find((item) => item.id === id);
          const kinds = Object.fromEntries(
            current.project.entities.map((item) => [item.id, item.type]),
          );
          const places = patch.refs.filter((ref) => kinds[ref] === 'location');
          // Keep an existing explicit look; new characters use the default look.
          const looks = Object.fromEntries(
            (entity?.data?.cast || []).map((c) =>
              typeof c === 'string' ? [c, ''] : [c.characterId, c.lookId || ''],
            ),
          );
          data.cast = patch.refs
            .filter((ref) => kinds[ref] === 'character')
            .map((ref) => ({ characterId: ref, lookId: looks[ref] || '' }));
          data.storyboard = {
            version: 1,
            mode: 'ref',
            ...(entity?.data?.storyboard || {}),
            place: places.length ? { locationId: places[places.length - 1] } : null,
            propIds: patch.refs.filter((ref) => kinds[ref] === 'prop'),
          };
        }
        if (Object.keys(data).length) change.data = data;
      } else {
        if ('name' in patch) change.title = patch.name;
        if ('text' in patch) change.description = patch.text;
      }
      if (!Object.keys(change).length) return;
      try {
        await api.request(path + '/actions', {
          method: 'POST',
          body: {
            expected_version: expected,
            actions: [{ op: 'entity.update', entity_id: id, patch: change }],
          },
        });
      } finally {
        // Success or a version conflict: either way show what the server now holds.
        load(await api.request(`/v1/story-chats/${encodeURIComponent(project)}`), emit, [id]);
      }
    },
    edited() {},
    close() {},
  };
}
