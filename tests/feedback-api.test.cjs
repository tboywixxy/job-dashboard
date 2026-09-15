const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync('lib/api.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
function setup(body, status = 200) {
  const calls = [];
  const context = { exports: {}, Headers, URLSearchParams, URL, fetch: async (url, options) => {
    calls.push({ url, options });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }};
  vm.runInNewContext(source, context);
  return { api: context.exports, calls };
}

test('feedback sends every supported filter, including false, with admin authentication', async () => {
  const { api, calls } = setup({ data: { feedback: [{ _id: 'f1', rating: 4 }], pagination: { total: 1, page: 2, limit: 10, totalPages: 2 } } });
  const filters = { source: 'cv & resume', ratingMin: '2', ratingMax: '5', hasComment: 'false', jobKind: 'remote', createdFrom: '2026-09-01', createdTo: '2026-09-14', includeDeleted: false, page: 2, limit: 10 };
  const controller = new AbortController();
  const result = await api.listFeedback(filters, 'test-token', controller.signal);
  const url = new URL(calls[0].url, 'http://localhost');
  assert.equal(url.pathname, '/api/auth/admin/feedback');
  for (const [key, value] of Object.entries(filters)) assert.equal(url.searchParams.get(key), String(value));
  assert.equal(calls[0].options.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(result.feedback[0].id, 'f1');
});

test('sources accept the backend id/label objects and preserve IDs for filtering', async () => {
  const sources = [
    { id: 'cv_review', label: 'CV Review' },
    { id: 'cv_optimization', label: 'CV Optimization' },
    { id: 'ace', label: 'ACE' },
    { id: 'jobs_page', label: 'Jobs Page' },
  ];
  const { api, calls } = setup({ code: 200, status: 'Success', data: { sources } });
  const result = await api.getFeedbackSources('token');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), sources);
  assert.equal(calls[0].url, '/api/auth/admin/feedback/sources');
  const list = setup({ data: { feedback: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } } });
  await list.api.listFeedback({ source: result[0].id }, 'token');
  assert.equal(new URL(list.calls[0].url, 'http://localhost').searchParams.get('source'), 'cv_review');
});

test('sources handle an empty list, deduplicate IDs, and reject malformed entries', async () => {
  const source = { id: 'custom_source', label: 'Custom Source' };
  assert.equal((await setup({ data: { sources: [] } }).api.getFeedbackSources('token')).length, 0);
  assert.equal((await setup({ data: { sources: [source, source] } }).api.getFeedbackSources('token')).length, 1);
  for (const entry of [null, {}, { id: 'ace' }, { id: '', label: 'Empty' }, { id: 'ace', label: 7 }]) {
    await assert.rejects(setup({ data: { sources: [entry] } }).api.getFeedbackSources('token'), /Unexpected feedback sources/);
  }
});

test('statistics normalize source counts and preserve null average for no ratings', async () => {
  const { api, calls } = setup({ data: { totalFeedback: 0, averageRating: null, countsBySource: { resume: 0 } } });
  const stats = await api.getFeedbackStats({ source: 'resume', createdFrom: '2026-09-01', createdTo: '2026-09-14' }, 'token');
  assert.equal(stats.totalFeedback, 0);
  assert.equal(stats.averageRating, null);
  assert.equal(stats.bySource[0].source, 'resume');
  assert.equal(stats.bySource[0].count, 0);
  assert.match(calls[0].url, /\/admin\/feedback\/stats\?source=resume&createdFrom=2026-09-01&createdTo=2026-09-14$/);
});

test('soft delete uses DELETE and safely encodes IDs; handles an empty success response', async () => {
  const { api, calls } = setup(null, 204);
  await api.deleteFeedback('id/with space', 'token');
  assert.equal(calls[0].url, '/api/auth/admin/feedback/id%2Fwith%20space');
  assert.equal(calls[0].options.method, 'DELETE');
});

test('API errors and malformed responses remain errors rather than empty data', async () => {
  await assert.rejects(setup({ message: 'Admin access required' }, 403).api.listFeedback({}, 'token'), /Admin access required/);
  await assert.rejects(setup({ success: false, message: 'Failed' }).api.deleteFeedback('f1', 'token'), /Failed/);
  await assert.rejects(setup({ data: {} }).api.listFeedback({}, 'token'), /Unexpected feedback response/);
  await assert.rejects(setup({ data: {} }).api.getFeedbackSources('token'), /Unexpected feedback sources/);
});
