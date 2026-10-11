// Minimal stdio MCP server for tests: newline-delimited JSON-RPC on stdin/stdout.
// Implements just enough of the protocol for the bundled MCP client to connect.
import { createInterface } from "node:readline";

const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

lines.on("line", (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined) return; // notifications need no reply
  let result;
  switch (message.method) {
    case "initialize":
      result = {
        protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "echo-fixture", version: "1.0.0" },
      };
      break;
    case "ping":
      result = {};
      break;
    case "tools/list":
      result = {
        tools: [
          {
            name: "echo",
            description: "Echo the given text back.",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
              additionalProperties: false,
            },
          },
        ],
      };
      break;
    case "tools/call":
      result = {
        content: [
          {
            type: "text",
            text: `echo:${message.params?.arguments?.text ?? ""}`,
          },
        ],
      };
      break;
    default:
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: "Method not found" },
      });
      return;
  }
  send({ jsonrpc: "2.0", id: message.id, result });
});
