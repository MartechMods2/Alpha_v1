import { selectInactiveCandidates, unknownActivityMembers } from "./dangerGroupActions.js";
import { isSameGroupUser } from "./groupParticipants.js";

export const configuredInactiveProtectedJids = () => [process.env.MY_NUMBER, process.env.MODERATORS]
	.filter(Boolean)
	.flatMap((value) => String(value).split(","))
	.map((value) => value.replace(/[^0-9]/g, ""))
	.filter(Boolean)
	.map((value) => `${value}@s.whatsapp.net`);

export const isInactiveProtectedMember = (member, metadata, protectedJids = configuredInactiveProtectedJids()) => {
	if (member?.isAdmin) return true;
	return (protectedJids || []).some((jid) => isSameGroupUser(metadata, member?.id, jid));
};

export const selectActionableInactiveMembers = (members = [], days, metadata, protectedJids) =>
	selectInactiveCandidates(members, days)
		.filter((member) => !isInactiveProtectedMember(member, metadata, protectedJids));

export const selectUnknownInactiveHistoryMembers = (members = [], metadata, protectedJids) =>
	unknownActivityMembers(members)
		.filter((member) => !isInactiveProtectedMember(member, metadata, protectedJids));
