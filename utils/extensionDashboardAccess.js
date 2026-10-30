import { createHash, randomBytes } from "node:crypto";
import { extensionId } from "./extensionPolicy.js";
export function createExtensionDashboardAccess({now=Date.now}={}) {
  const invites=new Map();
  const hash=token=>createHash("sha256").update(token).digest("hex");
  const purge=()=>{for(const [key,row] of invites)if(row.expiresAt<=now())invites.delete(key);};
  return {
    create(phone){
      extensionId(phone);purge();
      if(invites.size>=20)throw Error("Too many pending pairing links. Wait for one to expire.");
      const token=randomBytes(32).toString("base64url"),expiresAt=now()+15*60000;
      invites.set(hash(token),{phone,expiresAt});return {token,expiresAt};
    },
    consume(token){
      purge();if(typeof token!=="string" || !/^[A-Za-z0-9_-]{43}$/.test(token))return null;
      const key=hash(token),row=invites.get(key);if(!row)return null;
      invites.delete(key);return {...row};
    },
  };
}
