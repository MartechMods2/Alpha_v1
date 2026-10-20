import {
  selectedRecipient,
  selectedAmount,
  selectedItem,
} from "../../utils/aura/selection.js";
import { auraQuickGuide } from "../../utils/aura/quickGuide.js";
import { salvageRefund } from "../../utils/aura/refunds.js";
import { shopCardPayload } from "../../utils/aura/shopCard.js";
import { inventoryStatus } from "../../utils/aura/inventory.js";
import { collectionCardPayload } from "../../utils/aura/collectionCard.js";
import { isAuraEnabled, setAuraEnabled } from "../../utils/aura/activation.js";
import { auraMemberGuide } from "../../utils/aura/memberGuide.js";
import { auraProfilePayload } from "../../utils/aura/profile.js";
import { aura, auraStore } from "../../db/auraData.js";
import { auraIdentity } from "../../utils/aura/identity.js";
import {
  dayKey,
  key,
  xpRank,
  rpRank,
  EVO,
  SHOP,
  PRESTIGE_FRAMES,
  COLLECTIBLES,
  PRICES,
} from "../../utils/aura/policy.js";
import { alphaPanel } from "../../utils/alphaStyle.js";
import { learningQuest } from "../../utils/aura/quests.js";
import { participantJids } from "../../utils/groupParticipants.js";
const help =
  "Aura has no cash value. Earn with $daily, $quests, ranked wins and scheduled $redeem codes. Spend with $aurashop or priced commands. Only the primary creator has unlimited Aura. Wallets are global; old virtual coins remain separate. Use $auraprices, $auratransactions, $auraprofile, $aurarank, $evo, $aurarules.";
const handler = async (sock, msg, from, args, info) => {
  const reply = (text) =>
    info.sendMessageWTyping(from, { text }, { quoted: msg });
  try {
    const routes = {
      aura: {
        shop: "aurashop",
        evo: "evo",
        daily: "daily",
        send: "aurasend",
        thanks: "aurathanks",
        help: "auraquickhelp",
        quests: "quests",
        answer: "questanswer",
        redeem: "redeem",
        profile: "auraprofile",
        bag: "aurabag",
        inventory: "aurainventory",
        prices: "auraprices",
        guide: "auraguide",
        history: "auratransactions",
        ranks: "aurarank",
        badges: "aurabadges",
        board: "auraboard",
        rules: "auraquickhelp",
        appeal: "auraappeal",
      },
      aurashop: {
        buy: "aurabuy",
        gift: "auraitemgift",
        item: "auraitem",
        preview: "aurapreview",
        equip: "auraequip",
        use: "aurause",
        bag: "aurabag",
        inventory: "aurainventory",
        pet: "aurapet",
        salvage: "aurasalvage",
        collect: "auracollect",
        album: "auracollection",
      },
    };
    // At most two hops: $aura shop gift -> internal item-gift action.
    for (let depth = 0; depth < 2; depth++) {
      const group = Object.hasOwn(routes, info.command)
        ? routes[info.command]
        : null;
      const routed =
        group && Object.hasOwn(group, args[0]) ? group[args[0]] : null;
      if (!routed) break;
      args = args.slice(1);
      info = { ...info, command: routed };
    }
    if (info.command === "aura" && args.length)
      return reply(
        "Start with $aura. Use $aura shop | send | thanks | daily | quests | inventory | bag | guide | evo.",
      );
    const command = info.command;
    const pages = auraMemberGuide(info.prefix || "$");
    if (command === "auraquickhelp")
      return reply(auraQuickGuide(info.prefix || "$"));
    if (command === "auraguide") {
      const page = String(args[0] || "1");
      if (!/^[1-3]$/.test(page))
        return reply("Use $auraguide 1, 2 or 3 for the complete member guide.");
      return reply(pages[Number(page) - 1]);
    }
    if (command === "aurasystem") {
      const mode = String(args[0] || "status").toLowerCase();
      if (mode === "status")
        return reply(
          `Aura is ${(await isAuraEnabled(auraStore)) ? "ON" : "OFF"}. Only the creator can change it. Use $auraguide for the member guide.`,
        );
      if (!["on", "off"].includes(mode))
        return reply("Usage: $aurasystem on | off | status");
      const creator = await auraIdentity(sock, info);
      await setAuraEnabled(auraStore, mode === "on", creator, aura.owned);
      return reply(
        mode === "on"
          ? "✨ Aura is now ON globally. Run $auraannounce in this group to explain the system; choose drop groups with $auradrops on."
          : "Aura is now OFF globally. No new Aura fees, rewards, purchases, transfers, duels or drops. Balances are retained; existing reservations can settle/refund.",
      );
    }
    if (command === "auraannounce") {
      const creator = await auraIdentity(sock, info);
      if (!aura.owned(creator) || !info.isGroup)
        throw Error(
          "Only the creator can announce the Aura guide inside a group.",
        );
      await reply(
        `✨ *AURA SYSTEM: ${(await isAuraEnabled(auraStore)) ? "ON" : "OFF"}*\nHere is the full member guide in three parts. Read with $auraguide anytime.`,
      );
      for (const page of pages) await reply(page);
      return;
    }
    const readOnly = [
      "aura",
      "balance",
      "auraprofile",
      "aurarank",
      "auraboard",
      "aurabadges",
      "aurarules",
      "auraquickhelp",
      "aurahelp",
      "auraprices",
      "prices",
      "auratransactions",
      "transactions",
      "aurashop",
      "auraitem",
      "aurapreview",
      "auracollection",
      "aurabag",
      "evo",
      "aurainventory",
      "auraappeal",
      "auraappeals",
      "aurarefund",
    ];
    if (!readOnly.includes(command) && !(await isAuraEnabled(auraStore)))
      return reply(
        "Aura is currently OFF. No currency is earned or spent. The creator can activate it with $aurasystem on; read $auraguide.",
      );
    const actor = await auraIdentity(sock, info),
      owner = aura.owned(actor),
      cmd = info.command;
    const event = key(from, msg.key?.id, cmd);
    if (!msg.key?.id) throw Error("Missing message identity.");
    if (["aurarules", "aurahelp"].includes(cmd))
      return reply(
        help +
          "\n\nPenalties require creator review: max 1,000 per incident / 5,000 per member daily; balances never go negative. No penalty for silence, normal losses or failed APIs. Appeals: $auraappeal <receipt> <reason>. Ranked seasons follow Lagos calendar months; the previous season’s best rank is retained. Evo and XP remain permanent.",
      );
    if (["auraprices", "prices"].includes(cmd))
      return reply(
        "✨ *AURA PRICES — apply only while Aura is ON*\n" +
          [...PRICES]
            .sort((a, b) => b.price - a.price)
            .map(
              (x) =>
                `${x.commands.map((c) => "$" + c).join(" / ")} — ${x.price}`,
            )
            .join("\n") +
          "\nAll unlisted commands remain free, including help, safety and moderation. Commands priced 1,000+ require a trailing --confirm. Refunds on failure; existing provider quotas still apply. Old virtual coins cannot pay Aura prices.",
      );
    if (["aura", "balance", "auraprofile", "aurarank"].includes(cmd)) {
      const w = await aura.profile(actor);
      const current =
        w.season === new Date(Date.now() + 3600000).toISOString().slice(0, 7)
          ? w.rp || 0
          : Math.min(300, Math.floor((w.rp || 0) / 2));
      const caption = alphaPanel({
        icon: "✨",
        title: "YOUR AURA PROFILE",
        lines: [
          `Aura: ${owner ? "∞ · CREATOR" : w.balance}`,
          `Lifetime XP: ${w.xp} · ${xpRank(w.xp)[1]}`,
          `Ranked: ${rpRank(current)} · ${current} RP`,
          `Evo rank: ${EVO[w.evo].name} · Completed quests: ${w.quests}`,
          ...(w.prestigeTitle ? [`Prestige title: ${w.prestigeTitle}`] : []),
          `Conduct: ${w.conduct}/100`,
          `Community: ${w.kudos || 0} thanks · ${w.itemsGiven || 0} items gifted`,
          `Equipped: ${[...SHOP, ...PRESTIGE_FRAMES].find((x) => x.id === w.equipped)?.name || "Default"}`,
          ...(w.tagline ? [`✧ ${w.tagline}`] : []),
          `Collection: ${w.collection?.length || 0}/${COLLECTIBLES.length}`,
          `Daily streak: ${w.streak || 0}`,
          `Bag: ${inventoryStatus(w).used}/${inventoryStatus(w).capacity} slots`,
          ...(w.pet
            ? [
                `Companion: ${SHOP.find((x) => x.id === w.pet)?.name || "None"} · Bond ${w.petBonds?.[w.pet] || 0}/100`,
              ]
            : []),
        ],
        footer: "$aura send · $aura thanks · $aura shop · $aura evo",
      });
      return info.sendMessageWTyping(
        from,
        await auraProfilePayload(sock, info.senderJid, caption, w.equipped),
        { quoted: msg },
      );
    }
    if (cmd === "auraboard") {
      if (!info.isGroup)
        throw Error("Group Aura leaderboards require a group.");
      const roster = (info.groupMetadata?.participants || [])
        .flatMap((p) => participantJids(p))
        .filter((j) => /^\d{7,15}@s\.whatsapp\.net$/.test(j) && !aura.owned(j));
      const rows = await auraStore.find(
        "AuraWallets",
        { _id: { $in: roster.slice(0, 1024) } },
        { xp: -1 },
        10,
      );
      return reply(
        rows.length
          ? "🏆 *GROUP AURA XP BOARD*\n" +
              rows
                .map(
                  (w, i) =>
                    `${i + 1}. Member …${w._id.split("@")[0].slice(-4)} · ${xpRank(w.xp)[1]} · ${w.xp} XP`,
                )
                .join("\n") +
              "\nCurrent group members only; creator excluded. XP board, not a wallet-rich list."
          : "No Aura XP recorded for identifiable current members yet.",
      );
    }
    if (cmd === "aurabadges") {
      const w = await aura.profile(actor);
      return reply(
        w.badges?.length
          ? w.badges.join(" · ")
          : "No Aura badges yet. Try $quests and $daily.",
      );
    }
    if (cmd === "daily") {
      const r = await aura.daily(actor);
      return reply(
        r.duplicate
          ? "Today's daily reward is already claimed."
          : `✨ +${r.reward} Aura · Balance ${r.balance} · Streak ${r.streak}${r.shieldUsed ? " · One streak shield used" : ""}`,
      );
    }
    if (cmd === "redeem") {
      const r = await aura.redeem(
        actor,
        String(args[0] || "").toUpperCase(),
        from,
        event,
      );
      return reply(
        r.duplicate
          ? "This redemption was already processed."
          : `🎉 You won ${r.reward} Aura! Balance: ${r.balance}`,
      );
    }
    if (cmd === "auratransactions" || cmd === "transactions") {
      const rows = await aura.history(actor);
      return info.sendMessageWTyping(actor, {
        text: rows.length
          ? rows
              .map(
                (x) =>
                  `${x.kind} · ${x.delta >= 0 ? "+" : ""}${x.delta} Aura${x.result?.item ? "\nItem: " + x.result.item : ""}${x.result?.kudos ? "\nThanks received: " + x.result.kudos : ""}\nReceipt: ${x._id}${x.reason ? "\nReason: " + x.reason : ""}`,
              )
              .join("\n\n")
          : "No Aura transactions yet.",
      });
    }
    if (cmd === "aurabag") {
      const bag = inventoryStatus(await aura.profile(actor));
      if (args[0] !== "expand")
        return reply(
          `🎒 Bag: ${bag.used}/${bag.capacity} slots · ${bag.free} free.\n${bag.next ? `Next upgrade: ${bag.next.slots} slots for ${bag.next.price} Aura${bag.next.evo ? " · Requires " + EVO[bag.next.evo].name : ""}. Use $aura bag expand --confirm.` : "Maximum capacity reached."}\nEach cosmetic or consumable unit uses one slot. Cards and badges use a separate album. Existing oversized inventories are preserved.`,
        );
      if (!(await isAuraEnabled(auraStore)))
        return reply("Aura is OFF. Bag expansion is paused.");
      if (!bag.next) throw Error("No further bag upgrade is available.");
      if (args[1] !== "--confirm")
        return reply(
          `Expand to ${bag.next.slots} slots for ${bag.next.price} Aura${bag.next.evo ? " · Requires " + EVO[bag.next.evo].name : ""}. Use $aura bag expand --confirm.`,
        );
      const r = await aura.expandBag(actor, event);
      return reply(
        `Bag expanded to ${r.slots} slots. Spent ${r.spent}; balance ${r.balance}.`,
      );
    }
    if (cmd === "aurasalvage") {
      const item = SHOP.find((x) => x.id === args[0]);
      if (!item) throw Error("Choose an owned shop item ID.");
      if (args[1] !== "--confirm")
        return reply(
          `Salvage ONE ${item.name} for ${salvageRefund(await aura.profile(actor), item, owner)} Aura and free one slot. This removes the item, including its equipped state. Use $aurasalvage ${item.id} --confirm to proceed.`,
        );
      const r = await aura.salvage(actor, item.id, event);
      return reply(
        `Salvaged ${item.name}. +${r.reward} Aura · Balance ${r.balance} · Free slots ${r.free}.`,
      );
    }
    if (cmd === "aurapet") {
      const w = await aura.profile(actor);
      if (args[0] !== "equip")
        return reply(
          `Companion: ${SHOP.find((x) => x.id === w.pet)?.name || "None"} · Bond ${w.petBonds?.[w.pet] || 0}/100.\nBuy with $aurashop pets. Equip with $aurapet equip <id>, or none. Use $aurause pet-treat to interact: three treats daily, cosmetic bond only.`,
        );
      const item = SHOP.find((x) => x.id === args[1]);
      await auraStore.transaction(async (tx) => {
        const row = await tx.get("AuraWallets", actor);
        if (!row) throw Error("No companion inventory yet.");
        if (args[1] === "none") delete row.pet;
        else {
          if (!item || item.kind !== "pet" || !row.inventory.includes(item.id))
            throw Error("Choose a companion you own.");
          row.pet = item.id;
        }
        await tx.put("AuraWallets", row);
      });
      return reply("Companion updated. View $auraprofile.");
    }
    if (cmd === "aurashop") {
      const category = args[0] || "all";
      if (
        ![
          "all",
          "frames",
          "titles",
          "themes",
          "tools",
          "pets",
          "emblems",
          "evo",
          "legendary",
        ].includes(category)
      )
        return reply(
          "Use $aurashop all | frames | titles | themes | tools | pets | emblems | evo | legendary [page].",
        );
      const kinds = {
        frames: "frame",
        titles: "title",
        themes: "theme",
        tools: "tool",
        pets: "pet",
        emblems: "emblem",
      };
      const rows = SHOP.filter(
        (x) =>
          category === "all" ||
          (category === "evo"
            ? x.evo === 5
            : category === "legendary"
              ? x.evo === 6
              : x.kind === kinds[category]),
      );
      const pages = Math.max(1, Math.ceil(rows.length / 8));
      const page = Number(args[1] || 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > pages)
        return reply(`Choose page 1–${pages}: $aurashop ${category} <page>.`);
      const caption =
        `✨ *AURA SHOP · ${category} · ${page}/${pages}*\n` +
        rows
          .slice((page - 1) * 8, page * 8)
          .map(
            (x) =>
              `${x.id} — ${x.price.toLocaleString("en-US")} Aura${x.evo ? " · " + EVO[x.evo].name + " required" : ""}${x.xp ? " · " + x.xp + " XP required" : ""}\n${x.name}`,
          )
          .join("\n\n") +
        (page < pages ? `\n\nNext: $aurashop ${category} ${page + 1}` : "") +
        "\n\n✦ $aura shop buy <id>\n✦ $aura shop preview <id>\n✦ $aura shop equip <id>\n✦ $aura inventory · $aura bag\n✦ $aura evo — prestige ranks & rewards\nPurchases work only when Aura is ON.";
      return info.sendMessageWTyping(
        from,
        shopCardPayload(
          rows.slice((page - 1) * 8, page * 8),
          category,
          page,
          pages,
          caption,
        ),
        { quoted: msg },
      );
    }
    if (cmd === "auraitem" || cmd === "aurapreview") {
      const item = SHOP.find((x) => x.id === args[0]);
      if (!item) throw Error("Choose an item ID from $aurashop.");
      const details = `${item.name} · ${item.price} Aura\nType: ${item.kind}${item.evo ? " · Requires " + EVO[item.evo].name : ""}${item.xp ? " · Requires " + item.xp + " XP" : ""}\n${item.description || "Permanent cosmetic for your Aura card; no gameplay or admin advantage."}`;
      if (cmd === "auraitem") return reply(details);
      if (item.kind === "tool")
        return reply(details + "\nTools have no visual preview.");
      return info.sendMessageWTyping(
        from,
        await auraProfilePayload(
          sock,
          info.senderJid,
          "PREVIEW ONLY · " + details + "\nNothing purchased or equipped.",
          item.id,
        ),
        { quoted: msg },
      );
    }
    if (cmd === "auracollection") {
      const w = await aura.profile(actor);
      return reply(
        "🃏 *YOUR COLLECTION*\n" +
          COLLECTIBLES.map(
            (x) => `${w.collection?.includes(x.id) ? "✅" : "▫️"} ${x.name}`,
          ).join("\n") +
          "\n$auracollect — one free new card per Lagos day. Complete all eight for 2,500 Aura and the Curator badge. No paid mystery boxes.",
      );
    }
    if (cmd === "auracollect") {
      const r = await aura.collect(actor);
      if (r.duplicate) return reply("Today's collectible is already claimed.");
      const caption = `🃏 Collected ${r.card}! ${r.total}/${COLLECTIBLES.length}${r.reward ? " · Collection complete! +" + r.reward + " Aura and Curator badge" : ""}`;
      return info.sendMessageWTyping(
        from,
        collectionCardPayload(r.card, r.total, caption),
        { quoted: msg },
      );
    }
    if (cmd === "aurause") {
      const r = await aura.useItem(
        actor,
        args[0],
        args.slice(1).join(" "),
        event,
      );
      return reply(
        r.message
          ? `${r.message} Treats left: ${r.remaining}.`
          : `Tagline saved: ${r.tagline}\nTickets remaining: ${r.remaining}. View $auraprofile.`,
      );
    }
    if (cmd === "aurabuy") {
      const product = SHOP.find((x) => x.id === args[0]);
      if (product && product.price >= 100000 && args[1] !== "--confirm")
        return reply(
          `Confirm purchase: ${product.name} for ${product.price.toLocaleString("en-US")} Aura. Use $aura shop buy ${product.id} --confirm. No Aura spent yet.`,
        );
      const r = await aura.buy(actor, args[0], event);
      return reply(
        `Purchased ${r.item}. Spent ${r.spent}; balance ${r.balance}.`,
      );
    }
    if (cmd === "aurainventory") {
      const w = await aura.profile(actor);
      const cosmetics = (w.inventory || []).map(
        (id) =>
          `${SHOP.find((x) => x.id === id)?.name || "Saved item"} [${id}]`,
      );
      const tools = SHOP.filter((x) => x.kind === "tool").map(
        (x) => `${x.name}: ${w.items?.[x.id] || 0}/${x.max}`,
      );
      return reply(
        `🎒 *YOUR AURA INVENTORY · ${inventoryStatus(w).used}/${inventoryStatus(w).capacity} SLOTS*\nOwned items: ` +
          (cosmetics.join(", ") || "None yet") +
          "\n" +
          tools.join("\n") +
          `\nPrestige rewards: ${
            PRESTIGE_FRAMES.filter((x) => (w.evo || 0) >= x.prestige)
              .map((x) => x.id)
              .join(", ") || "None"
          } (no bag slots)\nCards: ${w.collection?.length || 0}/${COLLECTIBLES.length}\nEquipped: ${[...SHOP, ...PRESTIGE_FRAMES].find((x) => x.id === w.equipped)?.name || "Default"}\n$aurashop use tagline-ticket Your tagline\nStreak shields work automatically. $aurashop album shows cards. $aura bag expands space; $aurashop salvage <id> previews a refund.`,
      );
    }
    if (cmd === "auraequip") {
      await auraStore.transaction(async (tx) => {
        const w = await tx.get("AuraWallets", actor);
        if (!w) throw Error("Your Aura inventory is empty.");
        if (args[0] === "none") delete w.equipped;
        else {
          const item = [...SHOP, ...PRESTIGE_FRAMES].find(
            (x) => x.id === args[0],
          );
          if (
            !item ||
            ["tool", "pet"].includes(item.kind) ||
            !(item.prestige
              ? w.evo >= item.prestige
              : w.inventory.includes(item.id))
          )
            throw Error("Choose a cosmetic you own; tools cannot be equipped.");
          w.equipped = item.id;
        }
        await tx.put("AuraWallets", w);
      });
      return reply("Profile cosmetic updated. View $auraprofile.");
    }
    if (cmd === "evo") {
      if (args[0] !== "upgrade")
        return reply(
          EVO.map(
            (x, i) =>
              `${i}. ${x.name}: ${x.price.toLocaleString("en-US")} Aura + ${x.quests} completed quests${x.frame ? " · Exclusive frame + permanent title" : ""}`,
          ).join("\n") +
            "\n$evo upgrade --confirm buys the next stage. Permanent cosmetic ranks. Evo unlocks 10,000-slot bag purchases; Evo-Legendary+ unlocks 9,999,999-slot bag purchases. Storage is bought separately.\nReward frames: $aurashop equip evo-sovereign-frame or legendary-infinity-frame after unlocking.",
        );
      if (!(await isAuraEnabled(auraStore)))
        return reply("Aura is OFF. Evo upgrades are paused.");
      if (args[1] !== "--confirm")
        return reply("Read $evo, then use $evo upgrade --confirm.");
      const r = await aura.evolve(actor, event);
      const w = await aura.profile(actor);
      return info.sendMessageWTyping(
        from,
        await auraProfilePayload(
          sock,
          info.senderJid,
          `✦ EVOLUTION COMPLETE ✦\n${r.evo}\n${w.prestigeTitle ? "Permanent title: " + w.prestigeTitle + "\nExclusive frame equipped.\n" : ""}Spent ${r.spent.toLocaleString("en-US")}; balance ${r.balance.toLocaleString("en-US")}.\n$aurashop evo · $aurashop legendary · $aura bag`,
          w.equipped,
        ),
        { quoted: msg },
      );
    }
    if (["auraitemgift", "aurathanks"].includes(cmd)) {
      const targetRaw = selectedRecipient(info);
      const target = await auraIdentity(sock, info, targetRaw);
      if (target === actor) throw Error("Choose another member.");
      if (cmd === "aurathanks") {
        const r = await aura.thank(actor, target, event);
        if (r.duplicate) return reply("This thank-you was already recorded.");
        return info.sendMessageWTyping(
          from,
          {
            text: `✦ COMMUNITY SPOTLIGHT ✦\n@${actor.split("@")[0]} thanked @${target.split("@")[0]} for making the community better.\n${r.kudos} thanks received · No Aura or XP awarded.`,
            mentions: [actor, target],
          },
          { quoted: msg },
        );
      }
      const item = selectedItem(args, SHOP);
      if (args.at(-1) !== "--confirm")
        return info.sendMessageWTyping(
          from,
          {
            text: `Gift ONE ${item.name} to @${target.split("@")[0]}? It leaves your inventory and is unequipped if active. This gift has no Aura fee and cannot be recalled. Recipient needs space and must meet XP/Evo gates.\nRepeat: $aura shop gift @member ${item.id} --confirm`,
            mentions: [target],
          },
          { quoted: msg },
        );
      const r = await aura.giftItem(actor, target, item.id, event);
      if (r.duplicate)
        return reply(
          "This item gift was already completed. Check $aura history.",
        );
      return info.sendMessageWTyping(
        from,
        {
          text: `🎁 *AURA GIFT DELIVERED*\n@${actor.split("@")[0]} gave ${item.name} to @${target.split("@")[0]}.\n$aura inventory — see your items\nNo Aura charged. Friendship bond stays with its earner.`,
          mentions: [actor, target],
        },
        { quoted: msg },
      );
    }
    if (cmd === "aurasend" || cmd === "auragift" || cmd === "aurapenalty") {
      const targetRaw = selectedRecipient(info);
      const target = await auraIdentity(sock, info, targetRaw);
      const amount =
        cmd === "aurapenalty"
          ? args.find((x) => /^\d+$/.test(x))
          : selectedAmount(args);
      if (!amount) throw Error("Provide a whole positive amount.");
      if (cmd === "aurapenalty") {
        const at = args.indexOf(amount),
          reason = args.slice(at + 1).join(" ");
        const r = await aura.discipline(actor, target, amount, reason, event);
        await info
          .sendMessageWTyping(target, {
            text: `${r.warning ? "Aura warning — no deduction" : "Aura penalty: " + r.deducted}. Reason: ${reason}\nReceipt: ${r.receipt}\n${r.warning ? "Further reviewed violations today may incur a deduction." : "Appeal privately: $auraappeal " + r.receipt + " <reason>"}`,
          })
          .catch(() => {});
        return reply(
          `${r.warning ? "Warning recorded; no deduction" : "Penalty recorded"}. Receipt ${r.receipt}. Private delivery attempted; history remains available.`,
        );
      }
      if (cmd === "aurasend" && args.at(-1) !== "--confirm") {
        const principal = Number(amount),
          fee = owner ? 0 : Math.ceil(principal * 0.05);
        if (
          !Number.isSafeInteger(principal) ||
          principal < 1 ||
          principal > (owner ? 500000 : 10000)
        )
          throw Error(
            "Transfer amount must be 1–10,000 Aura (creator gifts: up to 500,000).",
          );
        return info.sendMessageWTyping(
          from,
          {
            text: `@${target.split("@")[0]} gets ${principal} Aura; fee ${fee}; total debit ${principal + fee}. Repeat with --confirm to proceed. ${owner ? "Creator gift/coupon budget: 500,000 daily." : "Daily principal limit: 20,000."}`,
            mentions: [target],
          },
          { quoted: msg },
        );
      }
      const r =
        cmd === "auragift" || owner
          ? await aura.gift(actor, target, amount, event)
          : await aura.transfer(actor, target, amount, event);
      if (!r.duplicate)
        await info
          .sendMessageWTyping(target, {
            text: `✨ You received ${amount} Aura. Check $auratransactions privately.`,
          })
          .catch(() => {});
      return reply(
        `${r.duplicate ? "Already processed. " : ""}${cmd === "auragift" ? "Gift" : "Transfer"} recorded. ${r.fee ? `Fee: ${r.fee}.` : ""}`,
      );
    }
    if (cmd === "auracoupon") {
      const r = await aura.createCoupon(actor, args[0], event);
      await info.sendMessageWTyping(actor, {
        text: `Private Aura coupon: ${r.code}\nValue: ${r.reward}; expires in 30 minutes. Share with your intended audience.`,
      });
      return reply("Coupon details sent to your private chat.");
    }
    if (cmd === "aurarefund") {
      const r = await aura.refund(actor, args[0], event);
      return reply(`Penalty reversed; ${r.reward} Aura restored.`);
    }
    if (cmd === "auraappeal") {
      const receipt = args[0],
        reason = args.slice(1).join(" ").slice(0, 300);
      if (!/^[a-f0-9]{64}$/.test(receipt || "") || reason.length < 8)
        throw Error(
          "Use $auraappeal <receipt> <reason of at least 8 characters>.",
        );
      const entry = await auraStore.get("AuraLedger", receipt);
      if (entry?.actor !== actor || entry.kind !== "penalty")
        throw Error("You can appeal only your own penalty receipt.");
      await auraStore.transaction(async (tx) => {
        const id = key("appeal", receipt);
        if (await tx.get("AuraAppeals", id)) return;
        await tx.put("AuraAppeals", {
          _id: id,
          actor,
          receipt,
          reason,
          status: "open",
          at: new Date(),
        });
      });
      return reply("Appeal recorded for creator review. No extra fee.");
    }
    if (cmd === "auraappeals") {
      if (!owner) throw Error("Creator only.");
      const rows = await auraStore.find(
        "AuraAppeals",
        { status: "open" },
        { at: 1 },
        10,
      );
      return info.sendMessageWTyping(actor, {
        text:
          rows.map((x) => `${x.receipt}\n${x.reason}`).join("\n\n") ||
          "No open appeals.",
      });
    }
    if (cmd === "auradrops") {
      if (!owner || !info.isGroup)
        throw Error(
          "Only the creator can configure drops inside a selected group.",
        );
      if (!["on", "off"].includes(args[0]))
        throw Error(
          "Use $auradrops on or $auradrops off in each chosen group.",
        );
      await auraStore.transaction(async (tx) => {
        const row = (await tx.get("AuraSettings", "drops")) || {
          _id: "drops",
          groups: [],
        };
        row.groups = row.groups.filter((x) => x !== from);
        if (args[0] === "on") {
          if (row.groups.length >= 20)
            throw Error("Maximum 20 selected drop groups.");
          row.groups.push(from);
        }
        await tx.put("AuraSettings", row);
      });
      return reply(
        "Drop group updated. Times: 08:00 / 14:00 / 20:00 Africa/Lagos. One shared 20,000-Aura code per slot; first valid global claim wins.",
      );
    }
    if (cmd === "quests") {
      const id = key("quest", actor, dayKey(), String(args[0] || "1"));
      if (!["1", "2"].includes(args[0] || "1"))
        throw Error("Use $quests 1 or $quests 2.");
      let row = await auraStore.get("AuraQuests", id);
      if (!row) {
        const { prompt, options, answer } = learningQuest(
          actor,
          dayKey(),
          args[0] || "1",
        );
        row = {
          _id: id,
          actor,
          prompt,
          options,
          answer,
          expiresAt: new Date(Date.now() + 10 * 60000),
        };
        await auraStore.transaction(async (tx) => {
          const existing = await tx.get("AuraQuests", id);
          if (existing) row = existing;
          else await tx.put("AuraQuests", row);
        });
      }
      return reply(
        `${row.done ? "Quest already answered. " : ""}${row.prompt}\n${row.options.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n$questanswer ${args[0] || 1} <option 1–3> · One attempt; expires after 10 minutes. Reward: 750 Aura.`,
      );
    }
    if (cmd === "questanswer") {
      if (!["1", "2"].includes(args[0]) || !/^[1-3]$/.test(args[1] || ""))
        throw Error("Use $questanswer 1 2 (quest number, answer option).");
      const r = await aura.quest(
        actor,
        key("quest", actor, dayKey(), args[0]),
        args[1],
        event,
      );
      return reply(
        r.correct
          ? `Correct! +${r.reward} Aura · Balance ${r.balance}`
          : "Not correct this time. No Aura deducted.",
      );
    }
  } catch (error) {
    const message = /Mongo|transaction|ECONN|timed out|server|topology/i.test(
      error.message,
    )
      ? "Aura database is unavailable or does not support transactions. No unsafe balance change was attempted."
      : error.message;
    return reply(`⚠️ ${message}`);
  }
};
export default () => ({
  cmd: [
    "aura",
    "aurashop",
    "evo",
    "aurasystem",
    "auraguide",
    "auraannounce",
    "aurabadges",
    "auraboard",
    "balance",
    "auraprofile",
    "aurarank",
    "daily",
    "redeem",
    "auraprices",
    "prices",
    "auratransactions",
    "transactions",
    "aurabag",
    "aurasalvage",
    "aurapet",
    "aurabuy",
    "auraitem",
    "aurapreview",
    "auracollection",
    "auracollect",
    "aurause",
    "aurainventory",
    "auraequip",
    "aurasend",
    "auragift",
    "aurapenalty",
    "auracoupon",
    "aurarefund",
    "auraappeal",
    "auraappeals",
    "auradrops",
    "quests",
    "questanswer",
    "aurarules",
    "aurahelp",
  ],
  desc: "One entry point: $aura for wallet, sharing, shop, inventory and Evo progression",
  usage:
    "aura [shop | send @member AMOUNT --confirm | thanks @member | daily | inventory | bag | guide | evo]",
  handler,
});
