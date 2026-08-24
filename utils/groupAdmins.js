import { isAdminParticipant, participantJids } from "./groupParticipants.js";

const getGroupAdmins = (participants) => [
	...new Set((participants || []).filter(isAdminParticipant).flatMap(participantJids)),
];

export default getGroupAdmins;
