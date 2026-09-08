import { group } from "../../../db/groupData.js";
import { getGroupAutomation } from "../../../db/groupAutomation.js";
import { mergeLiveGroupActivity, summarizeGroupActivity } from "../../../utils/groupActivity.js";
import { getGroupSafetySettings } from "../../../utils/groupSafety.js";
import { alphaPanel } from "../../../utils/alphaStyle.js";

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { groupMetadata, botJids, sendMessageWTyping } = msgInfoObj;
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });
	try {
		const [groupData, automation] = await Promise.all([group.findOne({ _id: from }), getGroupAutomation(from)]);
		const members = mergeLiveGroupActivity({ participants: groupMetadata?.participants || [], trackedMembers: groupData?.members || [], botJids: botJids || [] });
		const activity = summarizeGroupActivity(members, 20);
		const safety = getGroupSafetySettings(groupData || {});
		const protections = [safety.isWelcomeOn, safety.isGoodbyeOn, safety.isAntiLinkOn, safety.isAntiSpamOn, safety.isAntiStatusMentionOn];
		const schedules = [automation.birthdayEnabled, automation.eventAlertsEnabled, automation.morningEnabled, automation.nightEnabled];
		const protectionsOn = protections.filter(Boolean).length;
		const schedulesOn = schedules.filter(Boolean).length;
		const readiness = Math.round((activity.coverage * 0.5) + (protectionsOn / protections.length * 30) + (schedulesOn / schedules.length * 20));
		const warningRecords = (groupData?.memberWarnCount || []).filter((entry) => Number(entry?.count || 0) > 0).length;
		const muted = (groupData?.mutedMembers || []).length;
		const recommendations = [];
		if (protectionsOn < protections.length) recommendations.push("• Run `automationpack on` to enable the recommended protection set.");
		if (schedulesOn < schedules.length) recommendations.push("• Enable the scheduled community automations you want to use.");
		if (activity.zeroMembers > 0) recommendations.push(`• Review the *${activity.zeroMembers}* current member(s) with zero recorded activity before cleanup.`);
		if (!recommendations.length) recommendations.push("• Core community controls are configured. Keep reviewing activity rather than relying only on automation.");
		return reply(alphaPanel({
			icon: "📡", title: "Group Pulse",
			lines: [
				`Group: *${groupData?.grpName || groupMetadata?.subject || "Current group"}*`, `Readiness: *${readiness}%*`, "",
				`👥 Current human members: *${activity.totalMembers}*`, `📈 Tracking coverage: *${activity.coverage}%*`,
				`💬 Tracked messages: *${activity.totalMessages.toLocaleString()}*`, `🪫 Zero recorded activity: *${activity.zeroMembers}*`,
				`🛡️ Core protections: *${protectionsOn}/${protections.length}*`, `⚡ Scheduled automations: *${schedulesOn}/${schedules.length}*`,
				`⚠️ Members with warnings: *${warningRecords}*`, `🔇 Muted members: *${muted}*`, "", "*Recommended next steps*", ...recommendations,
			],
			footer: "Activity means what Alpha has recorded since tracking began; zero history is not proof of lifetime inactivity.",
		}));
	} catch (error) { return reply(`❌ Could not build the group pulse: ${error.message}`); }
};

export default () => ({
	cmd: ["grouppulse", "pulse"],
	desc: "Show a live group-management readiness report with activity, protections, warnings and automation status",
	usage: "grouppulse",
	handler,
});
