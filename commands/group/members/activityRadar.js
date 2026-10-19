import { group } from "../../../db/groupData.js";
import { createActivityHandler } from "../../../utils/activityRadar.js";
export default () => ({
  cmd: ["activitycard", "groupmood"],
  desc: "Your playful recorded-message badge or the group's aggregate conversation mood",
  usage: "activitycard | groupmood | groupmood 48h",
  handler: (sock, msg, from, args, info) =>
    createActivityHandler((...query) => group.findOne(...query), info.command)(
      sock,
      msg,
      from,
      args,
      info,
    ),
});
