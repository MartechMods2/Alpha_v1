import { defenseConfig, validateMessage } from "./ingestionDefense.js";
export function boundedGroupMetadata(value, jid) {
  const checked = validateMessage(
    {
      key: { remoteJid: jid, id: "metadata", participant: "service@lid" },
      message: { groupEvent: value },
    },
    { ...defenseConfig(), maxNodes: 16384, maxBytes: 1048576 },
  );
  if (!checked.ok) throw Error("Group metadata exceeded validation limits");
  const metadata = checked.message.message.groupEvent;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !Array.isArray(metadata.participants) ||
    metadata.participants.length > 1024 ||
    (metadata.id && metadata.id !== jid) ||
    (metadata.subject != null &&
      (typeof metadata.subject !== "string" || metadata.subject.length > 256))
  )
    throw Error("Invalid group metadata");
  for (const participant of metadata.participants) {
    const id =
      typeof participant === "string"
        ? participant
        : participant?.id ||
          participant?.jid ||
          participant?.lid ||
          participant?.phoneNumber;
    if (
      typeof id !== "string" ||
      id.length > 160 ||
      !/^[\w.:-]+@(s\.whatsapp\.net|lid)$/.test(id)
    )
      throw Error("Invalid group participant metadata");
    if (
      typeof participant === "object" &&
      participant.admin != null &&
      !["admin", "superadmin"].includes(participant.admin)
    )
      throw Error("Invalid group role metadata");
  }
  return metadata;
}
