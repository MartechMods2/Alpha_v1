import { key, priceFor } from "./policy.js";
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
      actor = await identify(sock, info);
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
        throw Error(
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
          const result = await original(to, payload, opts);
          if (
            to === from &&
            ((price.kind === "ai" && approved) ||
              (price.kind === "media" &&
                ["image", "video", "audio", "sticker", "document"].some(
                  (k) => payload?.[k],
                )))
          )
            delivered = true;
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
          delivered
            ? `✨ Spent: ${price.price} Aura · Balance: ${settled.balance}`
            : `✨ Reservation refunded: ${price.price} Aura · Balance: ${settled.balance}`,
        );
        return result;
      } catch (error) {
        await engine.settle(actor, charge.reservation, delivered);
        throw error;
      }
    } catch (error) {
      const safe =
        /^(Not enough Aura|Conduct score|Amount must|Aura cannot|A verified|Missing message)/.test(
          error.message,
        )
          ? error.message
          : "Aura could not complete this request safely. No unreserved paid work was started. Check $auratransactions; pending reservations are recovered automatically.";
      return reply(`⚠️ ${safe}`);
    }
  };
}
