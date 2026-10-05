/** Local stdio adapter; the HTTP endpoint is the remote agent connection. */
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { ejecutarComercio } from '../lib/mcp-comercio-core.ts';
import { dispatchMcp } from '../lib/mcp-comercio-rpc.ts';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
const secrets = [key, process.env.TWENTY_MCP_API_KEY].filter((s): s is string => Boolean(s));
const lineas = createInterface({ input: process.stdin });
// Serialize requests to avoid out-of-order mutations and unhandled JSON errors.
let pending = Promise.resolve();
lineas.on('line', line => {
  if (!line.trim()) return;
  pending = pending
    .then(async () => {
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        process.stdout.write(
          `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`
        );
        return;
      }
      const response = await dispatchMcp(message, {
        execute: (name, args) => ejecutarComercio(name, args, db, process.env),
        secrets,
      });
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    })
    .catch(() => {
      process.stderr.write('Error interno MCP\n');
    });
});
