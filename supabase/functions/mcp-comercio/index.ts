import { createClient } from 'npm:@supabase/supabase-js@2.108.0';
import { ejecutarComercio } from '../../../src/lib/mcp-comercio-core.ts';
import { createCommerceHttpHandler } from '../../../src/lib/mcp-comercio-http.ts';

const env = Deno.env.toObject();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const secrets = Object.entries(env)
  .filter(
    ([name, value]) =>
      /TOKEN|SECRET|PASSWORD|PRIVATE|API_KEY|SERVICE_ROLE/i.test(name) && value.length > 0
  )
  .map(([, value]) => value);

Deno.serve(
  createCommerceHttpHandler({
    token: env.IME_MCP_COMERCIO_TOKEN,
    secrets,
    consumeRateLimit: async keys => {
      const { data, error } = await db.rpc('consume_mcp_comercio_rate_limit', { p_keys: keys });
      if (error) throw new Error('Rate limit unavailable');
      return data === true;
    },
    execute: async (name, args) => {
      // Audit every remote tool attempt before execution; fail closed if audit is down.
      // Business mutations additionally keep their original before/after audit.
      const { error } = await db.from('comercio_actuaciones').insert({
        actor: args.actor,
        rol: 'agente',
        herramienta: name,
        entidad: 'mcp_http',
        motivo: 'Solicitud autenticada de plataforma MCP HTTP',
      });
      if (error) throw new Error('Audit unavailable');
      return ejecutarComercio(name, args, db, env);
    },
  })
);
