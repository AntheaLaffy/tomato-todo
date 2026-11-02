// Only synthetic worker tests load this: real service URLs map to one local mock.
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const paths = {
    "https://auth.openai.com/oauth/token": "/oauth/token",
    "https://chatgpt.com/backend-api/wham/usage": "/usage",
  };
  const path = paths[String(url)];
  if (!path) throw new Error("Unexpected network request in usage regression");
  return originalFetch(
    new URL(path, process.env.TOMATO_TEST_USAGE_ORIGIN),
    options,
  );
};
