import { alphaPanel } from "./alphaStyle.js";

export const deploymentNoticeText = (
  env = process.env,
  startedAt = new Date(),
) => {
  const raw = env.RENDER_GIT_COMMIT || env.SOURCE_VERSION || "";
  const revision = /^[a-f0-9]{7,64}$/i.test(raw)
    ? raw.slice(0, 12)
    : "not provided by host";
  return alphaPanel({
    icon: "🚀",
    title: "Alpha startup confirmed",
    lines: [
      "Alpha has started and connected to WhatsApp.",
      `Revision: ${revision}`,
      `Started: ${startedAt.toISOString()} (UTC)`,
      "This confirms startup and connection; external features may still need testing.",
    ],
    footer:
      "Private owner notification · A process restart can also trigger this notice.",
  });
};

// One successful notification per process, not on every reconnect. Failed sends
// may retry on a later connection-open, at most three attempts per process.
export const createDeploymentNotifier = ({
  env = process.env,
  send,
  startedAt = new Date(),
} = {}) => {
  let delivered = false,
    pending = null,
    attempts = 0;
  return (sock) => {
    if (env.ALPHA_DEPLOY_NOTIFY === "false" || delivered || attempts >= 3)
      return Promise.resolve(false);
    if (pending) return pending;
    const number = String(env.MY_NUMBER || "")
      .split(",")[0]
      .trim()
      .replace(/[+\s()-]/g, "");
    if (!/^\d{7,15}$/.test(number) || !sock?.user)
      return Promise.resolve(false);
    attempts++;
    pending = Promise.resolve()
      .then(() =>
        send
          ? send(
              sock,
              `${number}@s.whatsapp.net`,
              deploymentNoticeText(env, startedAt),
            )
          : sock.sendMessage(`${number}@s.whatsapp.net`, {
              text: deploymentNoticeText(env, startedAt),
            }),
      )
      .then(() => {
        delivered = true;
        console.log("[DEPLOY] Private startup confirmation delivered.");
        return true;
      })
      .catch(() => {
        console.warn(
          "[DEPLOY] Private startup confirmation could not be delivered.",
        );
        return false;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  };
};
