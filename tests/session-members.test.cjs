const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = path => ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function setup(handler) {
  let session = { token: 'old', refreshToken: 'refresh-1', email: 'admin@test.com', displayName: 'Admin', role: 'job_seeker' };
  const calls = [];
  const context = { exports: {}, Headers, URLSearchParams, URL, require: () => ({ getStoredAdminSession: () => session, storeAdminSession: value => { session = value; }, clearAdminSession: () => { session = null; } }), fetch: async (url, options) => {
    calls.push({ url, options });
    const [body, status = 200] = await handler(url, options);
    return new Response(JSON.stringify(body), { status });
  } };
  vm.runInNewContext(compile('lib/api.ts'), context);
  return { api: context.exports, calls, session: () => session };
}
const expired = [{ message: 'Invalid or expired token', code: 403 }, 403];
const sources = [{ data: { sources: [{ id: 'ace', label: 'ACE' }] } }];
test('parallel expired requests share refresh, rotate credentials and retry with the new token', async () => {
  const app = setup(async (url, options) => {
    if (url === '/api/refresh') { await new Promise(resolve => setTimeout(resolve, 10)); return [{ data: { accessToken: 'new', refreshToken: 'refresh-2' } }]; }
    return options.headers.get('Authorization') === 'Bearer new' ? sources : expired;
  });
  await Promise.all([app.api.getFeedbackSources('old'), app.api.getFeedbackSources('old')]);
  assert.equal(app.calls.filter(call => call.url === '/api/refresh').length, 1);
  assert.equal(app.session().refreshToken, 'refresh-2');
  assert.deepEqual(JSON.parse(app.calls.find(call => call.url === '/api/refresh').options.body), { refreshToken: 'refresh-1' });
  await app.api.getFeedbackSources('old');
  assert.equal(app.calls.at(-1).options.headers.get('Authorization'), 'Bearer new');
});
test('admin permission denial never triggers refresh', async () => {
  const app = setup(() => [{ message: 'Admin access required' }, 403]);
  await assert.rejects(app.api.getFeedbackSources('old'), /Admin access required/);
  assert.equal(app.calls.length, 1);
  assert.ok(app.session());
});
test('refresh rejection clears session; transient failures preserve it', async () => {
  for (const status of [400, 401, 403, 502]) {
    const app = setup(url => url === '/api/refresh' ? [{ message: 'Refresh failed' }, status] : expired);
    await assert.rejects(app.api.getFeedbackSources('old'), status === 502 ? /try again/ : /sign in again/);
    assert.equal(Boolean(app.session()), status === 502);
  }
});
test('retry is bounded and HTTP-200 error envelopes trigger refresh', async () => {
  const app = setup(url => url === '/api/refresh' ? [{ token: 'new' }] : [{ code: 403, message: 'Invalid or expired token' }]);
  await assert.rejects(app.api.getFeedbackSources('old'), /sign in again/);
  assert.equal(app.calls.length, 3);
  assert.equal(app.session(), null);
});
test('fresh login keeps refresh token and is not overridden by a stored old session', async () => {
  const app = setup(url => url === '/api/login' ? [{ data: { access_token: 'login-new', refresh_token: 'login-refresh' } }] : sources);
  const session = await app.api.loginAdmin('admin@test.com', 'password', 'job_seeker');
  assert.equal(session.refreshToken, 'login-refresh');
  await app.api.getFeedbackSources(session.token);
  assert.equal(app.calls.at(-1).options.headers.get('Authorization'), 'Bearer login-new');
});
const memberContext = { exports: {} };
vm.runInNewContext(compile('lib/campaignMembers.ts'), memberContext);
const { prepareCampaignMembers, fundingResultText } = memberContext.exports;
const draft = { enabled: true, entries: 'Ada@example.com,user-id:250', amount: '500', notify: true };
test('member entry supports emails, IDs, individual amounts and no-member saves', () => {
  const rows = prepareCampaignMembers(draft, 'active', null);
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [{ email: 'ada@example.com', amount: 500 }, { userId: 'user-id', amount: 250 }]);
  assert.equal(prepareCampaignMembers({ ...draft, enabled: false }, 'ended', null).length, 0);
});
test('invalid member amounts, duplicate identifiers and unfundable campaigns fail before saving', () => {
  for (const amount of ['0', '-1', 'Infinity', 'abc']) assert.throws(() => prepareCampaignMembers({ ...draft, amount }, 'active', null), /positive/);
  assert.throws(() => prepareCampaignMembers({ ...draft, entries: 'a@b.com:1,A@b.com:2' }, 'active', null), /duplicate/);
  assert.throws(() => prepareCampaignMembers(draft, 'ended', null), /ended/);
  assert.throws(() => prepareCampaignMembers(draft, 'active', '2000-01-01'), /expiry/);
});
test('partial funding result identifies unmatched users and reasons', () => {
  assert.match(fundingResultText({ funded: [{ userId: '1' }], unmatched: [{ email: 'missing@test.com', reason: 'no matching user' }] }), /1 member.*missing@test.com: no matching user/);
});

test('budget rejections preserve retry eligibility and expose budget details; network failures are uncertain', () => {
  const result = memberContext.exports.fundingFailure({ status: 400, message: 'Batch would exceed campaign budgetCap', body: { data: { budgetCap: 1000, alreadyGranted: 800, requested: 500 } } });
  assert.equal(result.rejected, true);
  assert.match(result.text, /1000.*800.*500/);
  assert.equal(memberContext.exports.fundingFailure(new Error('Network unavailable')).rejected, false);
});
