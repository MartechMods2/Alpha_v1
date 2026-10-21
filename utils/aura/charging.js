import { AuraUserError, publicAuraError } from "./errors.js";
import { key, priceFor } from "./policy.js";
import { withAuraSenderAliases } from "./identity.js";
export function createAuraChargeRunner({
  getEngine,
  identify,
  isEnabled = async () => true,
}) {
  return async (handler, sock, msg, from, args, info) => {
    const price = priceFor(info.command);
    if (!price) return handler(sock, msg, from, args, info);
    const reply = (text) =>
      info.sendMessageWTyping(from, { text }, { quoted: msg });
    let engine, actor, charge;
    try {
      if (!(await isEnabled())) return handler(sock, msg, from, args, info);
      engine = await getEngine();
      actor = await identify(sock, withAuraSenderAliases(info, msg));
      // Only the primary configured creator bypasses cost, never isOwner/isModerator flags.
      if (engine.owned(actor)) {
        const cleanArgs =
          args.at(-1) === "--confirm" ? args.slice(0, -1) : args;
        return handler(sock, msg, from, cleanArgs, {
          ...info,
          evv: cleanArgs.join(" "),
          inputText: cleanArgs.join(" "),
        });
      }
      if (!msg?.key?.id)
        throw new AuraUserError(
          "Missing message identity; this paid command cannot run safely.",
        );
      const event = key(from, msg.key.id, info.multiCommandIndex || 0);
      if (price.price >= 1000 && args.at(-1) !== "--confirm")
        return reply(
          `This command costs ${price.price} Aura on success. Repeat with --confirm to proceed. Failure refunds the reservation. See $prices.`,
        );
      const actualArgs = args.at(-1) === "--confirm" ? args.slice(0, -1) : args;
      charge = await engine.charge(actor, info.command, price.price, event);
      if (charge.duplicate)
        return reply(
          "This paid request was already processed; it will not run or charge twice.",
        );
      let delivered = false,
        approved = false;
      const original = info.sendMessageWTyping;
      const child = {
        ...info,
        evv: actualArgs.join(" "),
        inputText: actualArgs.join(" "),
        auraSuccess: () => {
          approved = true;
        },
        sendMessageWTyping: async (to, payload, opts) => {
          const isResult =
            to === from &&
            ((price.kind === "ai" && approved) ||
              (price.kind === "media" &&
                ["image", "video", "audio", "sticker", "document"].some(
                  (k) => payload?.[k],
                )));
          if (
            isResult &&
            !(await engine.activeReservation(actor, charge.reservation))
          )
            throw new AuraUserError(
              "Aura reservation expired or was recovered; result was not sent. Check $aura history.",
            );
          const result = await original(to, payload, opts);
          if (isResult) delivered = true;
          return result;
        },
      };
      try {
        const result = await handler(sock, msg, from, actualArgs, child);
        const settled = await engine.settle(
          actor,
          charge.reservation,
          delivered,
        );
        await reply(
          settled.status === "spent"
            ? `✨ Spent: ${settled.spent} Aura · Balance: ${settled.balance}`
            : `✨ Reservation refunded: ${settled.refunded} Aura · Balance: ${settled.balance}`,
        );
        return result;
      } catch (error) {
        await engine.settle(actor, charge.reservation, delivered);
        throw error;
      }
    } catch (error) {
      const safe = publicAuraError(
        error,
        "Aura could not complete or confirm this request. Check $aura history before retrying; pending reservations recover automatically.",
      );
      return reply(`⚠️ ${safe}`);
    }
  };
}
