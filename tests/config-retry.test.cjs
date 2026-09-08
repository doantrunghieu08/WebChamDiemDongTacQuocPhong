const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let responses;
let calls = 0;
const context = {
  window: { fetch: async () => (calls++, responses.shift()) },
  document: { cookie: '' },
  sessionStorage: { getItem: () => null },
  setTimeout: (fn) => (fn(), 0),
  clearTimeout: () => {},
  FormData: class {},
  AbortController,
  console: { warn: () => {} },
};
vm.runInNewContext(fs.readFileSync('assets/js/api/config.js', 'utf8'), context);

(async () => {
  responses = [{ status: 502 }, { status: 200 }];
  assert.equal((await context.window.fetch('/runpod-ai/api/ai/extract-student')).status, 200);
  assert.equal(calls, 2);

  responses = [{ status: 502 }];
  assert.equal((await context.window.fetch('/teacher/grading-session/start')).status, 502);
  assert.equal(calls, 3);
})();
