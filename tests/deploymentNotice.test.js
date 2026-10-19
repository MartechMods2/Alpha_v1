import test from "node:test";
import assert from "node:assert/strict";
import {
  createDeploymentNotifier,
  deploymentNoticeText,
} from "../utils/deploymentNotice.js";
const env = {
  MY_NUMBER: "+234 800 000 0000",
  RENDER_GIT_COMMIT: "7826d9654c249a428d705de0d0eab4a9c23ae9c4",
};
const sock = { user: { id: "bot" } };
test("startup report includes safe revision and no private config", () => {
  const text = deploymentNoticeText(
    { ...env, SECRET: "hidden" },
    new Date("2026-10-19T12:00:00Z"),
  );
  assert.match(text, /7826d9654c24/);
  assert.match(text, /2026-10-19T12:00:00.000Z/);
  assert.ok(!text.includes("hidden"));
  assert.ok(!text.includes("234800"));
  assert.match(
    deploymentNoticeText({ ...env, RENDER_GIT_COMMIT: "secret\nvalue" }),
    /not provided/,
  );
});
test("sends only to configured private owner, coalesces concurrent opens and reconnects", async () => {
  const sent = [];
  let resolve;
  const notify = createDeploymentNotifier({
    env,
    send: async (...args) => {
      sent.push(args);
      await new Promise((r) => {
        resolve = r;
      });
    },
  });
  const first = notify(sock),
    second = notify(sock);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1], "2348000000000@s.whatsapp.net");
  resolve();
  assert.equal(await first, true);
  await notify(sock);
  assert.equal(sent.length, 1);
});
test("missing owner, disconnected socket, malformed number and optout never send", async () => {
  for (const value of [
    {},
    { ...env, MY_NUMBER: "123@g.us" },
    { ...env, ALPHA_DEPLOY_NOTIFY: "false" },
  ]) {
    assert.equal(
      await createDeploymentNotifier({ env: value, send: () => assert.fail() })(
        sock,
      ),
      false,
    );
  }
  assert.equal(
    await createDeploymentNotifier({ env, send: () => assert.fail() })({}),
    false,
  );
});
test("failed notices retry only on later opens with a three attempt cap", async () => {
  let count = 0;
  const notify = createDeploymentNotifier({
    env,
    send: async () => {
      count++;
      throw Error("private failure");
    },
  });
  for (let i = 0; i < 6; i++) assert.equal(await notify(sock), false);
  assert.equal(count, 3);
});
