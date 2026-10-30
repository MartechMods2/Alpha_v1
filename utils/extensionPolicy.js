import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
export const extensionId = phone => {
  if (!/^\d{7,15}$/.test(phone)) throw Error("A verified international phone number is required.");
  return createHash("sha256").update(`alpha-extension:${phone}`).digest("hex").slice(0,24);
};
export function extensionDatabase(name, id = process.env.ALPHA_EXTENSION_ID) {
  if (!id) return name;
  if (!/^[a-f0-9]{24}$/.test(id)) throw Error("Invalid extension identity");
  if (typeof name !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(name)) throw Error("Invalid database namespace");
  return `${name}_ext_${id}`;
}
export const extensionLimit = (value = process.env.ALPHA_EXTENSION_MAX) => {
  const n = Number(value ?? 1);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1;
};
const authKey = secret => {
  if (typeof secret !== "string" || secret.length < 32) throw Error("Extension auth requires a server secret of at least 32 characters");
  return createHash("sha256").update(`alpha-extension-auth-v1:${secret}`).digest();
};
export function extensionAuthCodec(id, secret) {
  if (!id) return { encode: value => value, decode: value => value };
  extensionDatabase("Auth", id);
  const key = authKey(secret), aad = Buffer.from(id);
  return {
    encode(value) {
      const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm",key,iv);
      cipher.setAAD(aad);
      const data = Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
      return JSON.stringify({v:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")});
    },
    decode(value) {
      const row = JSON.parse(value);
      if (row.v !== 1 || typeof row.data !== "string") throw Error("Invalid encrypted extension auth");
      const cipher = createDecipheriv("aes-256-gcm",key,Buffer.from(row.iv,"base64"));
      cipher.setAAD(aad); cipher.setAuthTag(Buffer.from(row.tag,"base64"));
      return Buffer.concat([cipher.update(Buffer.from(row.data,"base64")),cipher.final()]).toString("utf8");
    },
  };
}
