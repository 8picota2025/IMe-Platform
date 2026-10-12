#!/usr/bin/env node
// Servidor MCP local (stdio) para I-ME Platform.
// Expone como herramientas todos los scripts de package.json (npm_<nombre>)
// y todos los .mjs/.sh de scripts/ (script_<nombre>). Acceso solo local.
//
// Registro en Claude Code (desde la raíz del repo):
//   claude mcp add imelic -- node "$(pwd)/scripts/mcp/imelic-mcp-server.mjs"
//
// Sin dependencias: JSON-RPC 2.0 por stdio, un mensaje JSON por línea.
// Los argumentos se pasan con spawn (sin shell), así que no se interpretan.
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPTS_DIR = join(ROOT, 'scripts');
const PROTOCOL_VERSION = '2024-11-05';
const SERVER_VERSION = '0.1.0';
const TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_CHARS = 200_000;

const INPUT_SCHEMA = {
  type: 'object',
  properties: {
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Argumentos posicionales que se pasan al comando tal cual (sin shell).',
    },
  },
  additionalProperties: false,
};

const toolName = (raw) => raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);

function buildTools() {
  const tools = new Map();
  const add = (tool) => tools.set(tool.name, tool);

  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    add({
      name: toolName(`npm_${name}`),
      description: `npm run ${name} (${command})`,
      inputSchema: INPUT_SCHEMA,
      build: (args) => ({
        cmd: 'npm',
        argv: ['run', name, ...(args.length ? ['--', ...args] : [])],
      }),
    });
  }

  for (const entry of readdirSync(SCRIPTS_DIR, { withFileTypes: true })) {
    const ext = extname(entry.name);
    if (!entry.isFile() || (ext !== '.mjs' && ext !== '.sh')) continue;
    const file = join(SCRIPTS_DIR, entry.name);
    add({
      name: toolName(`script_${basename(entry.name, ext)}`),
      description: `scripts/${entry.name}`,
      inputSchema: INPUT_SCHEMA,
      build: (args) =>
        ext === '.mjs'
          ? { cmd: process.execPath, argv: ['--env-file-if-exists=.env', file, ...args] }
          : { cmd: 'bash', argv: [file, ...args] },
    });
  }

  return tools;
}

function runTool(tool, args) {
  return new Promise((resolve) => {
    const { cmd, argv } = tool.build(args);
    const chunks = [];
    let size = 0;
    let timedOut = false;

    const child = spawn(cmd, argv, {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (chunk) => {
      size += chunk.length;
      if (size <= MAX_OUTPUT_CHARS * 2) chunks.push(chunk);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, TIMEOUT_MS);

    const finish = (status, isError) => {
      clearTimeout(timer);
      let out = Buffer.concat(chunks).toString('utf8');
      if (out.length > MAX_OUTPUT_CHARS) out = `${out.slice(0, MAX_OUTPUT_CHARS)}\n[salida truncada]`;
      resolve({ isError, text: `${out}\n${status}`.trim() });
    };

    child.on('error', (err) => finish(`Error al lanzar ${cmd}: ${err.message}`, true));
    child.on('close', (code, signal) => {
      if (timedOut) return finish(`Tiempo agotado (${TIMEOUT_MS / 1000}s); proceso terminado.`, true);
      if (code === 0) return finish('[exit 0]', false);
      finish(`[exit ${code ?? signal}]`, true);
    });
  });
}

const rpcError = (code, message) => Object.assign(new Error(message), { code });
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

const tools = buildTools();

async function handle(req) {
  switch (req.method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'imelic', version: SERVER_VERSION },
      };
    case 'tools/list':
      return {
        tools: [...tools.values()].map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      };
    case 'tools/call': {
      const tool = tools.get(req.params?.name);
      if (!tool) throw rpcError(-32602, `Herramienta desconocida: ${req.params?.name}`);
      const args = req.params?.arguments?.args ?? [];
      if (!Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
        throw rpcError(-32602, 'args debe ser un array de strings');
      }
      const result = await runTool(tool, args);
      return { content: [{ type: 'text', text: result.text }], isError: result.isError };
    }
    case 'ping':
      return {};
    default:
      throw rpcError(-32601, `Método no soportado: ${req.method}`);
  }
}

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  if (req.id === undefined) return; // notificación: no lleva respuesta
  try {
    send({ jsonrpc: '2.0', id: req.id, result: await handle(req) });
  } catch (err) {
    send({ jsonrpc: '2.0', id: req.id, error: { code: err.code ?? -32603, message: err.message } });
  }
});
