// Node 22.0 exposes fetch lazily; materialize it before node:test mocks inspect it.
const nativeFetch = globalThis.fetch;
Object.defineProperty(globalThis, "fetch", {
  value: nativeFetch,
  configurable: true,
  writable: true,
});
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const moduleURL = (code) =>
  "data:text/javascript;base64," + Buffer.from(code).toString("base64");
async function load() {
  const url = new URL("../utils/safeAi.js", import.meta.url);
  let source = await readFile(url, "utf8");
  const mocks = {
    "../db/safePackData.js":
      "export const getSafeSettings=async()=>({aiPiiRedaction:false});",
    "./safePack.js": "export const redactPii=value=>value;",
    "./creatorBirthday.js": 'export const getCreatorBirthdayKnowledge=()=>"";',
  };
  source = source.replace(
    /from "([^"]+)"/g,
    (match, path) =>
      `from "${mocks[path] ? moduleURL(mocks[path]) : path.startsWith(".") ? new URL(path, url).href : new URL("../node_modules/" + path + "/dist/index.mjs", import.meta.url).href}"`,
  );
  // Unique import per fixture keeps provider circuit state isolated between tests.
  return import(moduleURL(source + "\n// " + Math.random()));
}
const options = {
  systemPrompt: "Synthetic test",
  messages: [{ role: "user", content: "Hello" }],
};
function configure(t) {
  for (const [key, value] of Object.entries({
    GROQ_API_KEY: "synthetic-fixture-key",
    ALPHA_AI_PROVIDER_ORDER: "groq",
    ALPHA_AI_RETRIES: "0",
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() =>
      previous === undefined
        ? delete process.env[key]
        : (process.env[key] = previous),
    );
  }
}
test("AI admission caps overlapping requests and releases capacity after completion", async (t) => {
  configure(t);
  const ai = await load();
  let resolve;
  const gate = new Promise((r) => (resolve = r));
  t.mock.method(globalThis, "fetch", async () => {
    await gate;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
      { status: 200 },
    );
  });
  const a = ai.askSafeAi(options),
    b = ai.askSafeAi(options);
  await assert.rejects(
    ai.askSafeAi(options),
    (error) => error.code === "AI_BUSY",
  );
  resolve();
  assert.equal((await a).text, "ok");
  assert.equal((await b).text, "ok");
  assert.equal((await ai.askSafeAi(options)).text, "ok");
});
test("AI HTTP failures exhaust a bounded retry budget and open the existing circuit", async (t) => {
  configure(t);
  process.env.ALPHA_AI_RETRIES = "1";
  const ai = await load();
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(
      JSON.stringify({ error: { message: "synthetic service failure" } }),
      { status: 503 },
    );
  });
  await assert.rejects(ai.askSafeAi(options));
  assert.equal(requests, 2);
  await assert.rejects(ai.askSafeAi(options));
  assert.ok(requests <= 4);
});
test("slow AI requests propagate abort rather than leaving an uncancelled fetch", async (t) => {
  configure(t);
  const ai = await load();
  const original = setTimeout;
  t.mock.method(globalThis, "setTimeout", (callback, ms, ...rest) =>
    original(callback, ms === 15000 ? 15 : ms, ...rest),
  );
  let aborted = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        ),
      ),
  );
  await assert.rejects(ai.askSafeAi(options));
  assert.equal(aborted, true);
});
test("oversized AI context is rejected before any provider call", async (t) => {
  configure(t);
  const ai = await load();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
  });
  await assert.rejects(
    ai.askSafeAi({
      ...options,
      messages: Array(65).fill({ role: "user", content: "x" }),
    }),
  );
  assert.equal(calls, 0);
});

test("provider response streaming is bounded and oversized bodies are cancelled", async () => {
  const { boundedResponseText } = await import("../utils/boundedResponse.js");
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(8));
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    boundedResponseText(new Response(body), 10),
    /byte limit/,
  );
  assert.equal(cancelled, true);
  assert.equal(
    await boundedResponseText(new Response("Hello 👋"), 100),
    "Hello 👋",
  );
});

test("Gemini forwards the timeout signal to the supported SDK request API", async (t) => {
  configure(t);
  process.env.ALPHA_AI_PROVIDER_ORDER = "gemini";
  const previous = process.env.GOOGLE_API_KEY;
  process.env.GOOGLE_API_KEY = "synthetic-gemini-key";
  t.after(() =>
    previous === undefined
      ? delete process.env.GOOGLE_API_KEY
      : (process.env.GOOGLE_API_KEY = previous),
  );
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  let aborted = false;
  t.mock.method(GoogleGenerativeAI.prototype, "getGenerativeModel", () => ({
    generateContent: async (_prompt, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        ),
      ),
  }));
  const original = setTimeout;
  t.mock.method(globalThis, "setTimeout", (fn, ms, ...rest) =>
    original(fn, ms === 15000 ? 15 : ms, ...rest),
  );
  const ai = await load();
  await assert.rejects(ai.askSafeAi(options));
  assert.equal(aborted, true);
});
