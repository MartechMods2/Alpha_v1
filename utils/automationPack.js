import { group } from "../db/groupData.js";
import {
  DEFAULT_GROUP_AUTOMATION,
  getGroupAutomation,
  groupAutomations,
} from "../db/groupAutomation.js";
import { getGroupSafetySettings } from "./groupSafety.js";

export const RECOMMENDED_GROUP_AUTOMATION_FIELDS = Object.freeze([
  "isWelcomeOn",
  "isGoodbyeOn",
  "isAntiLinkOn",
  "isAntiSpamOn",
  "isAntiStatusMentionOn",
  "humanEngagementEnabled",
]);

export const RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS = Object.freeze([
  "birthdayEnabled",
  "eventAlertsEnabled",
  "morningEnabled",
  "nightEnabled",
]);

export const buildAutomationPackUpdates = (enabled = true) => ({
  groupUpdate: Object.fromEntries(RECOMMENDED_GROUP_AUTOMATION_FIELDS.map((field) => [field, Boolean(enabled)])),
  scheduledUpdate: Object.fromEntries(RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS.map((field) => [field, Boolean(enabled)])),
});

export const setRecommendedAutomationPack = async (groupJid, enabled = true) => {
  const { groupUpdate, scheduledUpdate } = buildAutomationPackUpdates(enabled);
  await Promise.all([
    group.updateOne({ _id: groupJid }, { $set: groupUpdate }),
    groupAutomations.updateOne(
      { _id: groupJid },
      {
        $set: { ...scheduledUpdate, updatedAt: new Date() },
        $setOnInsert: {
          createdAt: new Date(),
          time: DEFAULT_GROUP_AUTOMATION.time,
          morningTime: DEFAULT_GROUP_AUTOMATION.morningTime,
          nightTime: DEFAULT_GROUP_AUTOMATION.nightTime,
          doorOpenTime: DEFAULT_GROUP_AUTOMATION.doorOpenTime,
          doorCloseTime: DEFAULT_GROUP_AUTOMATION.doorCloseTime,
          timezone: DEFAULT_GROUP_AUTOMATION.timezone,
          actionDailyEnabled: false,
          doorScheduleEnabled: false,
        },
      },
      { upsert: true },
    ),
  ]);
  return automationPackStatus(groupJid);
};

export const automationPackStatus = async (groupJid) => {
  const [groupData, automation] = await Promise.all([
    group.findOne({ _id: groupJid }),
    getGroupAutomation(groupJid),
  ]);
  const safety = getGroupSafetySettings(groupData || {});
  const groupStates = Object.fromEntries(RECOMMENDED_GROUP_AUTOMATION_FIELDS.map((field) => [field, Boolean(field === "humanEngagementEnabled" ? groupData?.[field] : safety[field])]));
  const scheduledStates = Object.fromEntries(RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS.map((field) => [field, Boolean(automation[field])]));
  const enabledCount = [...Object.values(groupStates), ...Object.values(scheduledStates)].filter(Boolean).length;
  const totalCount = RECOMMENDED_GROUP_AUTOMATION_FIELDS.length + RECOMMENDED_SCHEDULED_AUTOMATION_FIELDS.length;
  return {
    groupData,
    automation,
    groupStates,
    scheduledStates,
    enabledCount,
    totalCount,
    ready: enabledCount === totalCount,
  };
};
