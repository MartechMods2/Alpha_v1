import { getGroupData, group } from "../../../db/groupData.js";
import { getGroupSafetySettings, normalizeDomain } from "../../../utils/groupSafety.js";

const boolLabel = (value) => (value ? "ON ✅" : "OFF ❌");

const statusText = (groupData) => {
	const settings = getGroupSafetySettings(groupData);
	return (
		"🛡️ *Group Safety Settings*\n\n" +
		`Welcome: *${boolLabel(settings.isWelcomeOn)}*\n` +
		`Goodbye: *${boolLabel(settings.isGoodbyeOn)}*\n` +
		`Anti-link: *${boolLabel(settings.isAntiLinkOn)}* (${settings.antiLinkAction})\n` +
		`Allowed domains: *${settings.allowedDomains.join(", ") || "none"}*\n` +
		`Anti-spam: *${boolLabel(settings.isAntiSpamOn)}*\n` +
		`Spam rule: *${settings.spamLimit} messages/${settings.spamWindowSeconds}s*, ` +
		`${settings.duplicateLimit} duplicates\n` +
		`Warnings: *${settings.warningLimit}* → *${settings.warningAction}*\n\n` +
		"Everything is opt-in; admins/owners are exempt from automatic actions."
	);
};

const handler = async (sock, msg, from, args, msgInfoObj) => {
	const { sendMessageWTyping } = msgInfoObj;
	const feature = args[0]?.toLowerCase() || "status";
	const value = args[1]?.toLowerCase();
	const groupData = await getGroupData(from);
	const reply = (text) => sendMessageWTyping(from, { text }, { quoted: msg });

	if (feature === "status") return reply(statusText(groupData));

	if (["welcome", "goodbye", "antilink", "antispam"].includes(feature)) {
		if (!["on", "off"].includes(value)) return reply(`❌ Usage: automod ${feature} on/off`);
		const fields = {
			welcome: "isWelcomeOn",
			goodbye: "isGoodbyeOn",
			antilink: "isAntiLinkOn",
			antispam: "isAntiSpamOn",
		};
		const update = { [fields[feature]]: value === "on" };
		if (feature === "antilink" && ["warn", "delete"].includes(args[2]?.toLowerCase())) {
			update.antiLinkAction = args[2].toLowerCase();
		}
		await group.updateOne({ _id: from }, { $set: update });
		return reply(`✅ ${feature} turned *${value.toUpperCase()}*.`);
	}

	if (feature === "warnings") {
		const limit = Number.parseInt(value, 10);
		const action = args[2]?.toLowerCase() || groupData?.warningAction || "remove";
		if (
			!Number.isInteger(limit) ||
			limit < 2 ||
			limit > 10 ||
			!["remove", "notify"].includes(action)
		) {
			return reply("❌ Usage: automod warnings <2-10> [remove|notify]");
		}
		await group.updateOne(
			{ _id: from },
			{ $set: { warningLimit: limit, warningAction: action } },
		);
		return reply(`✅ Warning policy set to *${limit}* → *${action}*.`);
	}

	if (feature === "spam") {
		const limit = Number.parseInt(value, 10);
		const seconds = Number.parseInt(args[2], 10);
		const duplicates = Number.parseInt(args[3], 10);
		if (
			!Number.isInteger(limit) ||
			limit < 4 ||
			limit > 12 ||
			!Number.isInteger(seconds) ||
			seconds < 5 ||
			seconds > 30 ||
			!Number.isInteger(duplicates) ||
			duplicates < 2 ||
			duplicates > 5
		) {
			return reply("❌ Usage: automod spam <4-12 messages> <5-30 seconds> <2-5 duplicates>");
		}
		await group.updateOne(
			{ _id: from },
			{ $set: { spamLimit: limit, spamWindowSeconds: seconds, duplicateLimit: duplicates } },
		);
		return reply(`✅ Anti-spam set to ${limit} messages/${seconds}s or ${duplicates} duplicates.`);
	}

	if (feature === "allow") {
		const operation = value || "list";
		if (operation === "list") {
			return reply(`🔗 Allowed domains: *${groupData?.allowedDomains?.join(", ") || "none"}*`);
		}
		const domain = normalizeDomain(args[2]);
		if (!domain || !domain.includes(".")) {
			return reply("❌ Usage: automod allow add/remove example.com");
		}
		if (operation === "add") {
			await group.updateOne({ _id: from }, { $addToSet: { allowedDomains: domain } });
			return reply(`✅ Allowed *${domain}*.`);
		}
		if (operation === "remove") {
			await group.updateOne({ _id: from }, { $pull: { allowedDomains: domain } });
			return reply(`✅ Removed *${domain}* from the allowlist.`);
		}
	}

	if (feature === "reset") {
		await group.updateOne(
			{ _id: from },
			{
				$set: {
					isWelcomeOn: false,
					isGoodbyeOn: false,
					isAntiLinkOn: false,
					antiLinkAction: "warn",
					allowedDomains: [],
					isAntiSpamOn: false,
					spamLimit: 6,
					spamWindowSeconds: 12,
					duplicateLimit: 3,
					warningLimit: 3,
					warningAction: "remove",
				},
			},
		);
		return reply("✅ Automod reset. All automatic messaging/moderation is OFF.");
	}

	return reply(
		"❌ Try: automod status | welcome on/off | goodbye on/off | antilink on/off [warn|delete] | " +
			"antispam on/off | spam <limit> <seconds> <duplicates> | warnings <limit> [remove|notify] | " +
			"allow add/remove/list [domain] | reset",
	);
};

export default () => ({
	cmd: ["automod", "safety"],
	desc: "Configure low-volume group safety automation",
	usage: "automod status | <feature> <setting>",
	handler,
});
