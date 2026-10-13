import { createInterface } from "node:readline";

// Exercise the real IPC wait without credentials, a model or external network.
const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");
emit({
  type: "auth",
  providers: { deepseek: { configured: false, models: [] } },
});
createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.op === "usage") {
    setTimeout(
      () => emit({ type: "network_result", id: request.id, result: {} }),
      2000,
    );
  }
});
