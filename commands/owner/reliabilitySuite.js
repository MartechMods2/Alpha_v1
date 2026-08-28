import { readdir } from "node:fs/promises";
import path from "node:path";
import { createEncryptedBackup, getBackupStatus, verifyEncryptedBackup } from "../../utils/backupManager.js";
import { objectStorageConfigured } from "../../utils/objectStorage.js";
import { emitSignedWebhook, webhookConfigured } from "../../utils/signedWebhooks.js";
import { getAiRuntimeStatus } from "../../utils/safeAi.js";
import { listQueueFailures } from "../../db/safePackData.js";
import messageQueue from "../../queue/messageQueue.js";
import { logBuffer } from "../../notify/adminEvents.js";

const handler=async(sock,msg,from,args,info)=>{const{command,sendMessageWTyping}=info;const reply=(text)=>sendMessageWTyping(from,{text},{quoted:msg});try{
	if(command==="backup"){if(String(args[0]||"now").toLowerCase()!=="now")return reply("❌ Usage: `backup now`. ");const result=await createEncryptedBackup();return reply(`✅ *Encrypted Backup Complete*\nFile: ${result.fileName}\nCollections: ${result.collections}\nSize: ${(result.size/1024/1024).toFixed(2)} MB\nOff-site: ${result.remote?"uploaded":"local encrypted copy"}`);}
	if(command==="backupstatus"){const status=await getBackupStatus();return reply(`💾 *Backup Status*\nEncryption configured: *${status.configured?"YES":"NO"}*\nOff-site S3/MinIO: *${status.offsiteConfigured?"READY":"NOT CONFIGURED"}*\nLast backup: *${status.latest?.createdAt?new Date(status.latest.createdAt).toISOString():"never"}*\nRetention: *${process.env.BACKUP_RETENTION_COUNT||7} local copies*`);}
	if(command==="restorecheck"){const files=(await readdir(path.resolve("backups"))).filter((x)=>x.endsWith(".enc")).sort().reverse();const file=args[0]||files[0];if(!file)return reply("❌ No encrypted backup found.");const result=await verifyEncryptedBackup(file);return reply(`✅ *Restore Verification Passed*\nFile: ${file}\nCollections: ${result.collections}\nDocuments: ${result.documents}\nCreated: ${result.createdAt}\n\nNo production data was overwritten.`);}
	if(command==="storagehealth")return reply(`🗄️ *Persistent Storage*\nS3/MinIO: *${objectStorageConfigured()?"CONFIGURED":"NOT CONFIGURED"}*\nEndpoint: ${process.env.S3_ENDPOINT?new URL(process.env.S3_ENDPOINT).host:"none"}\nBucket: ${process.env.S3_BUCKET||"none"}\nCredentials are never displayed.`);
	if(command==="webhookadmin"){const action=String(args[0]||"status").toLowerCase();if(action==="test"){if(!webhookConfigured())return reply("❌ Configure OUTBOUND_WEBHOOK_URL and OUTBOUND_WEBHOOK_SECRET first.");await emitSignedWebhook("bot.health",{status:"ok",time:new Date()});return reply("✅ Signed test webhook delivered.");}return reply(`🔗 Signed webhooks: *${webhookConfigured()?"READY":"NOT CONFIGURED"}*\nAllowed events: moderation.audit, bot.error, backup.completed, bot.health`);}
	if(command==="queuestatus"){const stats=messageQueue.getStats();const failures=await listQueueFailures(10);return reply(`📨 *Queue Status*\nQueued: *${stats.totalQueued}*\nActive sends: *${stats.activeSends}*\nDurable failed-send records: *${failures.length}*\n\n${failures.map((x)=>`- ${x.chatId}: ${x.error}`).join("\n")||"No recent failures."}`);}
	if(command==="errorstatus"){const errors=logBuffer.filter((x)=>x.level==="error").slice(-15);const ai=getAiRuntimeStatus();return reply(`🚨 *Error Status*\nRecent runtime errors: *${errors.length}*\nAI requests today: *${ai.usageToday}*\nTelegram owner alerts: *${process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID?"READY":"NOT CONFIGURED"}*\n\n${errors.slice(-5).map((x)=>`- ${x.msg.slice(0,200)}`).join("\n")||"No recent errors."}`);}
	if(command==="migrationstatus")return reply(`🧬 *Schema and Compatibility*\nSafe Pack schema: *v1*\nBot version: *${process.env.npm_package_version||"3.0.0"}*\nBaileys target: *7.0.0-rc14*\nDatabase indexes are created idempotently at startup. CI validates imports, syntax and tests before merge.`);
}catch(error){console.error("Reliability suite failed:",error.message);return reply(`❌ ${error.message}`);}};
export default()=>({cmd:["backup","backupstatus","restorecheck","storagehealth","webhookadmin","queuestatus","errorstatus","migrationstatus"],desc:"Encrypted backups, storage, signed webhooks, queues, errors and migrations",usage:"backup now | backupstatus | restorecheck | storagehealth",handler});

