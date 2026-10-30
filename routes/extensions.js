import { Router } from "express";
import { createExtensionDashboardAccess } from "../utils/extensionDashboardAccess.js";
export function createExtensionRouter({manager,requireAdmin,normalizePhone,primaryPhone=()=>"",now=Date.now}){
  const router=Router(),access=createExtensionDashboardAccess({now}),rates=new Map();
  router.use((req,_res,next)=>{if(!["/api/extensions","/api/admin/extensions"].some(base=>req.path===base || req.path.startsWith(base+"/")))return next("router");next();});
  router.use((_req,res,next)=>{res.set("Cache-Control","no-store");res.set("Referrer-Policy","no-referrer");next();});
  router.use((req,res,next)=>{
    if(req.method!=="POST")return next();
    try{if(new URL(req.get("origin")).origin===`${req.protocol}://${req.get("host")}`)return next();}catch{}
    return res.status(403).json({error:"Open pairing from this dashboard's own address."});
  });
  const grant=(req,res,next)=>{
    const row=req.session?.extensionPair;
    if(!row || row.expiresAt<=now())return res.status(403).json({error:"Pairing access expired. Ask the creator for a new dashboard link."});
    req.extensionPhone=row.phone;next();
  };
  const safe=fn=>async(req,res)=>{try{await fn(req,res);}catch{res.status(409).json({error:"Action unavailable. Check capacity, extension status and whether this account is blocked."});}};
  router.get("/api/admin/extensions",requireAdmin,safe(async(_req,res)=>res.json(await manager.overview())));
  router.post("/api/admin/extensions/settings",requireAdmin,safe(async(req,res)=>{
    if(typeof req.body?.enabled!=="boolean")return res.status(400).json({error:"enabled must be a boolean"});
    res.json(await manager.enable(req.body.enabled));
  }));
  router.post("/api/admin/extensions/invite",requireAdmin,safe(async(req,res)=>{
    const phone=normalizePhone(req.body?.phone),primary=primaryPhone(req);
    if(!primary)return res.status(503).json({error:"Primary Alpha identity is unavailable. Reconnect it before creating extension links."});
    if(!phone || phone===primary)return res.status(400).json({error:"Enter the member's international number, different from primary Alpha."});
    const state=await manager.overview();
    if(!state.enabled)return res.status(409).json({error:"Enable extensions in the dashboard first."});
    const created=access.create(phone);
    res.json({path:`/admin/extension-pair#invite=${created.token}`,expiresAt:created.expiresAt});
  }));
  for(const action of ["stop","revoke"])router.post(`/api/admin/extensions/${action}`,requireAdmin,safe(async(req,res)=>{
    const phone=normalizePhone(req.body?.phone);if(!phone)return res.status(400).json({error:"Invalid number"});
    await manager[action](phone);res.json({ok:true});
  }));
  router.post("/api/extensions/claim",safe(async(req,res)=>{
    const key=req.ip || "unknown",time=now(),old=rates.get(key);
    const row=old && old.until>time ? old : {until:time+60000,count:0};
    if(++row.count>10)return res.status(429).json({error:"Too many attempts. Wait one minute."});
    while(rates.size>=1000 && !rates.has(key))rates.delete(rates.keys().next().value);rates.set(key,row);
    const invite=access.consume(req.body?.token);
    if(!invite)return res.status(403).json({error:"This pairing link is expired, invalid or already used."});
    req.session.extensionPair=invite;
    res.json({phone:invite.phone,expiresAt:invite.expiresAt});
  }));
  router.get("/api/extensions/status",grant,safe(async(req,res)=>res.json({phone:req.extensionPhone,expiresAt:req.session.extensionPair.expiresAt,...await manager.pairingStatus(req.extensionPhone)})));
  router.post("/api/extensions/start",grant,safe(async(req,res)=>{
    if(req.body?.consent!==true)return res.status(400).json({error:"Confirm that you own this WhatsApp number before pairing."});
    if(req.extensionPhone===primaryPhone(req))return res.status(400).json({error:"Primary Alpha cannot pair as an extension."});
    res.json(await manager.pair(req.extensionPhone));
  }));
  router.post("/api/extensions/stop",grant,safe(async(req,res)=>{await manager.stop(req.extensionPhone);res.json({ok:true});}));
  return router;
}
