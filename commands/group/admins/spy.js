import { group } from "../../../db/groupData.js";
import { createActivityHandler } from "../../../utils/activityRadar.js";
export default () => ({
  cmd: ["spy"],
  desc: "Admin activity radar: recent messages, quiet members and unknown history; not online or reader detection",
  usage: "spy | spy 48h",
  handler: createActivityHandler((...args) => group.findOne(...args), "spy"),
});
