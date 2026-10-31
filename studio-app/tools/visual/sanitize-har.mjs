// Turn a recorded HAR into the committed visual fixture (h3-studio#897): keep only the API
// answers the screens need, with no cookies, auth headers, signed media URLs or e-mail
// addresses. Media redirects are dropped, so videos stay blank and screenshots stay stable.
// Usage: node tools/visual/sanitize-har.mjs tools/visual/raw.har tools/visual/storyboard.har
import { readFileSync, writeFileSync } from 'node:fs';

const [from, to] = process.argv.slice(2);
const har = JSON.parse(readFileSync(from, 'utf8'));
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
]);
const dropInternal = (value) =>
  Array.isArray(value)
    ? value.map(dropInternal)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => !INTERNAL.has(key))
            .map(([key, v]) => [key, dropInternal(v)]),
        )
      : value;
const json = (text) => {
  try {
    return JSON.stringify(dropInternal(JSON.parse(text)));
  } catch {
    return text;
  }
};
const scrub = (text) =>
  json(text)
    // Signed object URLs (R2/S3) carry credentials in the query; the fixture never loads media.
    .replace(/https?:\/\/[^"\s]+?\?[^"\s]*X-Amz-[^"\s]*/g, '/visual-fixture/media')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, 'qa@example.invalid');
const kept = har.log.entries
  .filter((e) => e.response.status >= 200 && e.response.status < 300)
  .map((e) => ({
    startedDateTime: e.startedDateTime,
    time: 0,
    request: {
      method: e.request.method,
      url: e.request.url,
      httpVersion: 'HTTP/1.1',
      headers: [],
      queryString: e.request.queryString,
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
