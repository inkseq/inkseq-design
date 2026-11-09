// Turn a recorded HAR into the committed visual fixture (h3-studio#897): keep only the API
// answers the screens need, with no cookies, auth headers, signed media URLs or e-mail
// addresses. Media redirects are dropped, so videos stay blank and screenshots stay stable.
// Account ids are swapped for a fixed stand-in, repeated reads of one address are kept once,
// and every address is put on the audit's own origin, whatever port it was recorded on.
// Usage: node tools/visual/sanitize-har.mjs tools/visual/raw.har tools/visual/storyboard.har
import { readFileSync, writeFileSync } from 'node:fs';

// An optional project id keeps the story list to that one story: the QA account's other
// stories have test names that describe our infrastructure.
const [from, to, onlyProject] = process.argv.slice(2);
const har = JSON.parse(readFileSync(from, 'utf8'));
const ORIGIN = 'http://127.0.0.1:4173';
// The signed-in account's ids (and the account a media address names) become one stand-in.
const ACCOUNT_KEYS = new Set(['user_id', 'account_id', 'owner_id', 'created_by', 'actor_id']);
const accountIds = new Set();
const collect = (value, key) => {
  if (Array.isArray(value)) value.forEach((v) => collect(v, key));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) collect(v, k);
  else if (typeof value === 'string' && ACCOUNT_KEYS.has(key) && value.length >= 8)
    accountIds.add(value.replace(/^browser:/, ''));
};
for (const e of har.log.entries) {
  for (const q of e.request.queryString || [])
    if (q.name === 'expected_account') accountIds.add(q.value);
  if (/\/(api\/auth\/me|v1\/account)$/.test(new URL(e.request.url).pathname)) {
    try {
      const body = JSON.parse(e.response.content.text || '{}');
      collect(body);
      if (body.id) accountIds.add(body.id);
    } catch {
      // not JSON; nothing to collect
    }
  }
}
const STAND_IN = '00000000-0000-4000-8000-000000000000';
const noAccount = (text) =>
  [...accountIds].reduce((t, id) => t.split(id).join(id === 'qa-user' ? id : STAND_IN), text);
// Generation internals (steps, sampler shifts, provider, our cost) never belong in a public
// repo, even where an API still returns them to the owner of a job.
const INTERNAL = new Set([
  'steps',
  'max_steps',
  'shift_audio',
  'shift_video',
  'step_skipping',
  'sampler',
  'scheduler',
  'backend',
  'actual_cost_microusd',
  'estimated_cost_microusd',
  // Model and storage names (an assistant's model, a delivery policy naming the store).
  'model',
  'policy',
]);
// The prompt a job actually sent is our compiled prompt format, not the words on the card.
const COMPILED = new Set(['effective_request']);
const dropInternal = (value, parent) =>
  Array.isArray(value)
    ? value.map((v) => dropInternal(v, parent))
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !INTERNAL.has(key))
            .map(([key, v]) => [
              key,
              COMPILED.has(parent) && key === 'prompt' ? '' : dropInternal(v, key),
            ]),
        )
      : value;
const oneStory = (body) =>
  onlyProject && Array.isArray(body?.projects)
    ? { ...body, projects: body.projects.filter((x) => x?.id === onlyProject) }
    : body;
const json = (text) => {
  try {
    return JSON.stringify(oneStory(dropInternal(JSON.parse(text))));
  } catch {
    return text;
  }
};
const scrub = (text) =>
  noAccount(json(text))
    // Signed object URLs (R2/S3) carry credentials in the query; the fixture never loads media.
    .replace(/https?:\/\/[^"\s]+?\?[^"\s]*X-Amz-[^"\s]*/g, '/visual-fixture/media')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'qa@example.invalid');
const seen = new Set();
const kept = har.log.entries
  // Only API answers: media (redirects to signed storage, pictures) is never committed.
  .filter((e) => e.response.status >= 200 && e.response.status < 300)
  .filter((e) => /json|text/.test(e.response.content.mimeType || ''))
  .map((e) => {
    const url = new URL(e.request.url);
    return { ...e, request: { ...e.request, url: noAccount(ORIGIN + url.pathname + url.search) } };
  })
  .filter((e) => {
    const key = `${e.request.method} ${e.request.url} ${e.request.postData?.text || ''}`;
    return !seen.has(key) && seen.add(key);
  })
  .map((e) => ({
    startedDateTime: e.startedDateTime,
    time: 0,
    request: {
      method: e.request.method,
      url: e.request.url,
      httpVersion: 'HTTP/1.1',
      headers: [],
      queryString: (e.request.queryString || []).map((q) => ({ ...q, value: noAccount(q.value) })),
      cookies: [],
      headersSize: -1,
      bodySize: -1,
      ...(e.request.postData
        ? { postData: { mimeType: e.request.postData.mimeType, text: e.request.postData.text } }
        : {}),
    },
    response: {
      status: e.response.status,
      statusText: e.response.statusText,
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'content-type', value: e.response.content.mimeType }],
      cookies: [],
      content: {
        size: -1,
        mimeType: e.response.content.mimeType,
        text: scrub(e.response.content.text || ''),
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: -1,
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
  }));
writeFileSync(
  to,
  JSON.stringify({ log: { version: '1.2', creator: har.log.creator, entries: kept } }, null, 1) +
    '\n',
);
console.log(`${kept.length} of ${har.log.entries.length} entries kept -> ${to}`);
