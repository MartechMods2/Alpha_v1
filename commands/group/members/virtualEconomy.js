import { addInventoryItem, changeWalletCoins, claimDailyCoins, getRichList, getWallet } from "../../../db/safePackData.js";
import { dateKey } from "../../../utils/safePack.js";

const SHOP = Object.freeze([
	{ id: "gold-title", name: "Golden Profile Title", price: 300 },
	{ id: "streak-shield", name: "Streak Shield", price: 500 },
	{ id: "quiz-master", name: "Quiz Master Badge", price: 750 },
	{ id: "legend-frame", name: "Legend Profile Frame", price: 1200 },
]);
const targetFrom = (context) => context?.mentionedJid?.[0] || context?.participant || "";

const handler = async (sock, msg, from, args, info) => {
	const { command, senderJid, updateName, extendedMessageOriginal, sendMessageWTyping } = info; const reply = (text, mentions=[]) => sendMessageWTyping(from,{text,mentions},{quoted:msg});
	try {
		if (command === "wallet") { const wallet = await getWallet(from,senderJid); return reply(`🪙 *Virtual Wallet*\nCoins: *${wallet.coins || 0}*\nItems: *${wallet.inventory?.length || 0}*\n\nCoins have no cash value and cannot be bought or withdrawn.`); }
		if (command === "dailycoins") { const wallet = await claimDailyCoins({groupJid:from,memberJid:senderJid,memberName:updateName,dateKey:dateKey(),amount:50}); return reply(wallet ? `🎁 Daily reward claimed: *50 coins*. Balance: *${wallet.coins}*.` : "⏳ You already claimed today’s reward."); }
		if (command === "shop") return reply(`🛍️ *Cosmetic Shop*\n${SHOP.map((x,i)=>`${i+1}. ${x.name} — ${x.price} coins`).join("\n")}\n\nBuy with \`buy <number>\`.`);
		if (command === "buy") { const item = SHOP[Number(args[0])-1]; if (!item) return reply("❌ Item not found."); const current = await getWallet(from,senderJid); if ((current.coins||0)<item.price) return reply("❌ Not enough virtual coins."); if ((current.inventory||[]).some((x)=>x.id===item.id)) return reply("✅ You already own that item."); const wallet = await changeWalletCoins({groupJid:from,memberJid:senderJid,memberName:updateName,amount:-item.price,requireBalance:true}); if (!wallet) return reply("❌ Not enough coins."); await addInventoryItem(from,senderJid,item); return reply(`✅ Bought *${item.name}*.`); }
		if (command === "inventory") { const wallet=await getWallet(from,senderJid); return reply(wallet.inventory?.length?`🎒 *Inventory*\n${wallet.inventory.map((x,i)=>`${i+1}. ${x.name}`).join("\n")}`:"🎒 Your inventory is empty."); }
		if (command === "giftcoins") { const target=targetFrom(extendedMessageOriginal); const amount=Number(args.find((x)=>/^\d+$/.test(x))); if (!target||target===senderJid||!Number.isInteger(amount)||amount<1||amount>500) return reply("❌ Usage: `giftcoins @member 1-500`. "); const source=await changeWalletCoins({groupJid:from,memberJid:senderJid,memberName:updateName,amount:-amount,requireBalance:true}); if(!source)return reply("❌ Not enough coins."); await changeWalletCoins({groupJid:from,memberJid:target,memberName:target.split("@")[0],amount}); return reply(`🎁 Sent *${amount} coins* to @${target.split("@")[0]}.`,[target]); }
		if(command==="richlist"){const rows=await getRichList(from,10);return reply(rows.length?`💰 *Virtual Rich List*\n${rows.map((x,i)=>`${i+1}. ${x.memberName||x.memberJid.split("@")[0]} — ${x.coins} coins`).join("\n")}`:"💰 No wallets yet.");}
	} catch(error){console.error("Virtual economy failed:",error.message);return reply(`❌ ${error.message}`);}
};
export default()=>({cmd:["wallet","dailycoins","shop","buy","inventory","giftcoins","richlist"],desc:"Virtual-only coins, daily rewards and cosmetic inventory",usage:"wallet | dailycoins | shop | buy 1 | giftcoins @member 50",handler});

