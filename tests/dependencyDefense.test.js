import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
const require = createRequire(import.meta.url);
test("security-critical resolutions use reviewed patched versions", () => {
  const fromExpress = createRequire(require.resolve("express"));
  assert.equal(fromExpress("proxy-addr/package.json").version, "2.0.8");
  assert.equal(require("form-data/package.json").version, "4.0.6");
  assert.equal(require("sharp").versions.sharp, "0.35.5");
  assert.equal(require("baileys/package.json").version, "7.0.0-rc14");
});
test("patched multipart library preserves the stream API used by legacy callers", async () => {
  const FormData = require("form-data");
  const form = new FormData();
  form.append("caption", "Ẹ káàárọ̀ 👋");
  form.append("file", Buffer.from("synthetic local file"), {
    filename: "sample.txt",
    contentType: "text/plain",
  });
  const chunks = [];
  const sink = new PassThrough();
  sink.on("data", (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => {
    sink.once("end", resolve);
    sink.once("error", reject);
    form.once("error", reject);
  });
  form.pipe(sink);
  await completed;
  const body = Buffer.concat(chunks).toString();
  assert.ok(body.includes("Ẹ káàárọ̀ 👋"));
  assert.ok(body.includes("synthetic local file"));
  assert.ok(
    form
      .getHeaders()
      ["content-type"].includes("multipart/form-data; boundary="),
  );
});
