/** Remote verification: URL + MCP bearer only; no Supabase key or local server. */
import process from 'node:process';

const endpoint =
  process.env.IME_MCP_COMERCIO_URL ||
  'https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-comercio';
const token = process.env.IME_MCP_COMERCIO_TOKEN;
if (!token) throw new Error('Missing IME_MCP_COMERCIO_TOKEN');
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json, text/event-stream',
  'Content-Type': 'application/json',
  'MCP-Protocol-Version': '2025-11-25',
};
async function post(body, extra = {}) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
    signal: globalThis.AbortSignal.timeout(30000),
  });
  return response;
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const listedBody = { jsonrpc: '2.0', id: 2, method: 'tools/list' };
assert(
  (await post(listedBody, { Authorization: '' })).status === 401,
  'Missing token was not rejected'
);
assert(
  (await post(listedBody, { Authorization: `Bearer ${token}x` })).status === 401,
  'Invalid token was not rejected'
);
assert(
  (await post(listedBody, { Origin: 'https://example.com' })).status === 403,
  'Browser origin was not rejected'
);
const healthResponse = await fetch(`${endpoint}/health`, {
  headers: { Authorization: headers.Authorization },
  signal: globalThis.AbortSignal.timeout(30000),
});
assert(healthResponse.status === 200, `Health HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
const initResponse = await post({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'ime-remote-smoke', version: '1.0' },
  },
});
assert(initResponse.status === 200, `Initialize HTTP ${initResponse.status}`);
const initialized = await initResponse.json();
assert(initialized.result?.protocolVersion === '2025-11-25', 'Unexpected protocol version');
assert(
  (await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status === 202,
  'Notification failed'
);
const listResponse = await post(listedBody);
assert(listResponse.status === 200, `Tools/list HTTP ${listResponse.status}`);
const list = await listResponse.json();
assert(list.result?.tools?.length === health.tools, 'Tool count mismatch');
const readResponse = await post({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: { name: 'buscar_cotizaciones', arguments: { limite: 1 } },
});
assert(readResponse.status === 200, `Read HTTP ${readResponse.status}`);
const read = await readResponse.json();
assert(
  !read.result?.isError,
  'Quote read failed; inspect server configuration without printing credentials'
);
const quotes = JSON.parse(read.result.content[0].text);
assert(quotes.ok === true && Array.isArray(quotes.cotizaciones), 'Invalid quote read result');
// Never print client PII, tool response bodies, or token values.
console.log(
  JSON.stringify({
    ok: true,
    endpoint,
    transport: 'http',
    tools: health.tools,
    quoteRowsRead: quotes.cotizaciones.length,
    missingToken: 401,
    invalidToken: 401,
    browserOrigin: 403,
    localStdioRequired: false,
  })
);
