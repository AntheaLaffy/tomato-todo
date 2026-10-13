import { createInterface } from "node:readline";

const emit = (event) => process.stdout.write(JSON.stringify(event) + "\n");
emit({ type: "auth", providers: {} });
createInterface({ input: process.stdin }).on("line", async (line) => {
  const request = JSON.parse(line);
  if (request.op !== "usage") return;
  try {
    const response = await fetch("http://proxy-target.invalid/usage");
    emit({
      type: "network_result",
      id: request.id,
      result: await response.json(),
    });
  } catch (error) {
    emit({ type: "network_result", id: request.id, error: error.message });
  }
});
