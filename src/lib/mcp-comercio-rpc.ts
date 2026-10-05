/** JSON-RPC framing shared by stdio and stateless Streamable HTTP. Server only. */
import { MCP_TOOLS, type McpToolName } from './comercio-operacion.ts';
import { herramientasComercio } from './mcp-comercio-core.ts';

export const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
export type McpArgs = Record<string, unknown>;
export interface McpRpcOptions {
  execute: (name: McpToolName, args: McpArgs) => Promise<McpArgs>;
  secrets?: readonly string[];
  versions?: readonly string[];
}
export function isObject(value: unknown): value is McpArgs {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function rpcError(id: unknown, code: number, message: string): McpArgs {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/** Strip credential fields and redact credential values even in upstream error strings. */
export function safeMcpResult(value: unknown, secrets: readonly string[] = []): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const secret of secrets) {
      if (secret) result = result.split(secret).join('[REDACTED]');
    }
    return result;
  }
  if (Array.isArray(value)) return value.map(item => safeMcpResult(item, secrets));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(?:service_role|api_key|password|secret|authorization|access_token|refresh_token)/i.test(
              key
            )
        )
        .map(([key, item]) => [key, safeMcpResult(item, secrets)])
    );
  }
  return value;
}

export async function dispatchMcp(
  message: unknown,
  options: McpRpcOptions
): Promise<McpArgs | null> {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(null, -32600, 'Invalid request');
  }
  const id = message.id;
  if (id === undefined) {
    // Tools must never execute as notifications: the client needs a result.
    return message.method.startsWith('notifications/')
      ? null
      : rpcError(null, -32600, 'Invalid request');
  }
  if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) {
    return rpcError(null, -32600, 'Invalid request');
  }
  if (message.params !== undefined && !isObject(message.params))
    return rpcError(id, -32602, 'Invalid params');
  const params = (message.params ?? {}) as McpArgs;
  const response = (result: unknown) => ({ jsonrpc: '2.0', id, result });
  switch (message.method) {
    case 'initialize':
      return response({
        protocolVersion: (options.versions ?? MCP_VERSIONS).includes(String(params.protocolVersion))
          ? params.protocolVersion
          : (options.versions ?? MCP_VERSIONS)[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'ime-comercio', version: '0.2.0' },
      });
    case 'ping':
      return response({});
    case 'tools/list':
      return response({ tools: herramientasComercio() });
    case 'tools/call': {
      if (!MCP_TOOLS.includes(params.name as McpToolName))
        return rpcError(id, -32602, 'Unknown tool');
      if (params.arguments !== undefined && !isObject(params.arguments))
        return rpcError(id, -32602, 'Invalid arguments');
      try {
        const result = await options.execute(
          params.name as McpToolName,
          (params.arguments ?? {}) as McpArgs
        );
        return response({
          content: [{ type: 'text', text: JSON.stringify(safeMcpResult(result, options.secrets)) }],
          isError: result.ok === false,
        });
      } catch {
        // Exceptions may contain URLs, bearer headers, or database credentials.
        return response({
          content: [
            { type: 'text', text: '{"ok":false,"error":"Error interno de la herramienta"}' },
          ],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, 'Method not found');
  }
}
