import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import mdClient from "../db/client.js";
import { putObject, objectStorageConfigured } from "./objectStorage.js";
import { emitSignedWebhook } from "./signedWebhooks.js";

const gzipAsync = promisify(gzip); const gunzipAsync = promisify(gunzip); const BACKUP_DIR = path.resolve("backups"); const runs = mdClient.db("MyBotDataDB").collection("BackupRuns");
const key = () => { if (!process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY.length < 16) throw new Error("BACKUP_ENCRYPTION_KEY must contain at least 16 characters"); return createHash("sha256").update(process.env.BACKUP_ENCRYPTION_KEY).digest(); };
const encrypt = async (value) => { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(await gzipAsync(value)), cipher.final()]); return Buffer.concat([Buffer.from("ALPHA1"), iv, cipher.getAuthTag(), encrypted]); };
const decrypt = async (value) => { if (value.subarray(0,6).toString() !== "ALPHA1") throw new Error("Invalid backup header"); const iv=value.subarray(6,18); const tag=value.subarray(18,34); const decipher=createDecipheriv("aes-256-gcm",key(),iv); decipher.setAuthTag(tag); return gunzipAsync(Buffer.concat([decipher.update(value.subarray(34)),decipher.final()])); };

export const createEncryptedBackup = async () => {
	await mkdir(BACKUP_DIR,{recursive:true}); const db=mdClient.db("MyBotDataDB"); const names=(await db.listCollections().toArray()).map((x)=>x.name).filter((name)=>!/^sessions$/i.test(name)); const collections={}; for(const name of names) collections[name]=await db.collection(name).find({}).limit(100000).toArray(); const payload=Buffer.from(JSON.stringify({version:1,createdAt:new Date(),database:"MyBotDataDB",collections})); const encrypted=await encrypt(payload); const stamp=new Date().toISOString().replace(/[:.]/g,"-"); const fileName=`alpha-backup-${stamp}.json.gz.enc`; const file=path.join(BACKUP_DIR,fileName); await writeFile(file,encrypted); let remote=null; if(objectStorageConfigured()) remote=await putObject(`backups/${fileName}`,encrypted,"application/octet-stream"); await runs.insertOne({createdAt:new Date(),fileName,size:encrypted.length,collections:names.length,remoteKey:remote?.key||"",status:"completed"}); await emitSignedWebhook("backup.completed",{fileName,size:encrypted.length,collections:names.length}).catch(()=>{}); await enforceRetention(); return {file,fileName,size:encrypted.length,collections:names.length,remote};
};

export const verifyEncryptedBackup = async (fileName) => { const file=path.join(BACKUP_DIR,path.basename(fileName)); const parsed=JSON.parse((await decrypt(await readFile(file))).toString()); if(parsed.version!==1||!parsed.collections)throw new Error("Backup structure is invalid"); return {createdAt:parsed.createdAt,collections:Object.keys(parsed.collections).length,documents:Object.values(parsed.collections).reduce((n,x)=>n+x.length,0)}; };
export const getBackupStatus = async () => ({ latest: await runs.findOne({}, { sort: { createdAt: -1 } }), configured: Boolean(process.env.BACKUP_ENCRYPTION_KEY), offsiteConfigured: objectStorageConfigured() });
export const enforceRetention = async () => { const keep=Math.min(30,Math.max(2,Number(process.env.BACKUP_RETENTION_COUNT)||7)); const files=(await readdir(BACKUP_DIR)).filter((x)=>x.endsWith(".enc")); const rows=await Promise.all(files.map(async(name)=>({name,time:(await stat(path.join(BACKUP_DIR,name))).mtimeMs}))); rows.sort((a,b)=>b.time-a.time); for(const row of rows.slice(keep))await unlink(path.join(BACKUP_DIR,row.name)); };

