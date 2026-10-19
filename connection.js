import NodeCache from "node-cache";
import { createDeploymentNotifier } from "./utils/deploymentNotice.js";
import socket from "./core/socket.js";
import events from "./core/events.js";
import { setSock } from "./core/socketRef.js";
import { createConnectionManager } from "./utils/connectionManager.js";
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
  maxKeys: 300,
  deleteOnExpire: true,
});
const notifyDeployment = createDeploymentNotifier();
let onSocket = null;
export const onNewSock = (fn) => {
  onSocket = fn;
};
const manager = createConnectionManager({
  create: socket,
  attach: (sock, start) =>
    events(
      sock,
      async (reason) => {
        const result = await start(reason);
        if (reason === "connection-open" && result === sock)
          void notifyDeployment(sock);
        return result;
      },
      cache,
    ),
  onSocket: (sock) => {
    setSock(sock);
    onSocket?.(sock);
  },
});
export const stopConnections = () => {
  manager.stop();
  cache.close();
};
export const connectionStatus = () => manager.stats();
export default manager.start;
