import { extensionId, extensionLimit } from "./extensionPolicy.js";
export function createExtensionManager({ store, launch, notify, max = extensionLimit(), delay = setTimeout, cancel = clearTimeout }) {
  const running = new Map(), cooldowns = new Map();
  let chain = Promise.resolve(), closing = false;
  const serial = fn => { const next = chain.then(fn); chain = next.catch(()=>{}); return next; };
  const publish = async (phone, message) => {
    let timer;
    try { await Promise.race([Promise.resolve().then(()=>notify(phone,message)),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]); }
    catch {} finally {clearTimeout(timer);}
  };
  const stopOne = async id => {
    const entry = running.get(id);
    if (!entry) return;
    entry.stopping = true; cancel(entry.timer);
    await entry.child.stop();
    running.delete(id);
  };
  const startOne = async row => {
    if (running.has(row._id)) return;
    if (closing || running.size >= max) throw Error("Extension capacity is full. Try again later.");
    const entry = { status: "starting", stopping:false, child:null, timer:null };
    running.set(row._id, entry);
    try {
      entry.child = await launch(row, {
        message: event => { void serial(async () => {
          if (running.get(row._id) !== entry || entry.stopping) return;
          if (event?.type === "code" && /^[A-Z0-9-]{6,20}$/.test(event.code || "") && !entry.codeSent) {
            entry.codeSent = true; entry.status = "pairing";
            await publish(row.phone, `🔐 Your Alpha pairing code: ${event.code}\nOn YOUR WhatsApp: Settings → Linked devices → Link a device → Link with phone number. Never share this code. It expires shortly.`);
          } else if (event?.type === "open") {
            entry.status = "connected"; cancel(entry.timer);
            if (entry.openNotified) return; entry.openNotified=true;
            await store.put({...row,active:true,paired:true});
            await publish(row.phone,"✅ Your Alpha extension is connected. Your bot uses separate data and group settings. Add your number to a group and have its admins enable Alpha. You have not gained creator permissions or unlimited Aura.");
          } else if (event?.type === "closed") entry.status = "reconnecting";
        }).catch(()=>{}); },
        exit: () => { void serial(async () => {
          if (running.get(row._id) !== entry) return;
          cancel(entry.timer); running.delete(row._id);
          if (!entry.openNotified && !entry.stopping) await store.put({...row,active:false});
          if (!entry.stopping && !closing) await publish(row.phone,"Your Alpha extension stopped. Use $extension pair in this private chat to resume; check Linked devices if WhatsApp logged it out.");
        }).catch(()=>{}); },
      });
      entry.timer = delay(() => { void serial(async()=>{
        if (running.get(row._id) !== entry || entry.status === "connected") return;
        await stopOne(row._id);
        await store.put({...row,active:false});
        await publish(row.phone,"Alpha pairing/reconnection timed out. Use $extension pair to try again.");
      }).catch(()=>{}); },180000);
      entry.timer?.unref?.();
    } catch {
      running.delete(row._id);
      throw Error("Extension could not start. Ask the creator to check hosting capacity.");
    }
  };
  return {
    enable: value => serial(async () => {
      if (closing) throw Error("Extensions are shutting down.");
      await store.enabled(Boolean(value));
      if (!value) for (const id of [...running.keys()]) await stopOne(id);
      else {
        const rows=await store.list();
        for(const row of rows.filter(x=>x.active && !x.paired && !running.has(x._id))) await store.put({...row,active:false});
        for (const row of rows.filter(x=>x.active && x.paired && !x.blocked).slice(0,max)) await startOne(row);
      }
      return {enabled:Boolean(value),max};
    }),
    restore: () => serial(async()=>{
      if (closing || !await store.enabled()) return;
      const rows=await store.list();
      for(const row of rows.filter(x=>x.active && !x.paired && !running.has(x._id))) await store.put({...row,active:false});
      for (const row of rows.filter(x=>x.active && x.paired && !x.blocked).slice(0,max)) await startOne(row);
    }),
    pair: phone => serial(async()=>{
      const id = extensionId(phone);
      if (closing || !await store.enabled()) throw Error("Extensions are OFF. The creator must enable them first.");
      if (running.has(id)) throw Error("Your extension is already running or pairing. Use $extension status.");
      const now = Date.now();
      if ((cooldowns.get(id)||0) > now) throw Error("Wait one minute before requesting another pairing attempt.");
      const rows = await store.list();
      if (rows.length >= 100 && !rows.some(x=>x._id===id)) throw Error("Extension registry is full; creator review required.");
      if (rows.filter(x=>x.active && x._id !== id).length >= max) throw Error("Extension capacity is full. Ask the creator to free a slot.");
      while (cooldowns.size >= 1000) cooldowns.delete(cooldowns.keys().next().value);
      cooldowns.set(id,now+60000);
      const old = rows.find(x=>x._id===id);
      if (old?.blocked) throw Error("The creator has disabled this extension account.");
      const row = {_id:id,phone,active:true,paired:old?.paired===true};
      await startOne(row);
      try { await store.put(row); } catch { await stopOne(id); throw Error("Extension registration could not be saved."); }
      return {status:"starting"};
    }),
    revoke: phone => serial(async()=>{
      const id=extensionId(phone), row=(await store.list()).find(x=>x._id===id);
      if (!row && (await store.list()).length >= 100) throw Error("Extension registry is full.");
      await store.put({...row,_id:id,phone,active:false,blocked:true});
      await stopOne(id);
    }),
    status: phone => serial(async()=>{
      const id=extensionId(phone), rows=await store.list();
      return {enabled:await store.enabled(),max,status:running.get(id)?.status || (rows.some(x=>x._id===id && x.paired) ? "stopped; credentials saved" : "not paired")};
    }),
    stop: phone => serial(async()=>{
      const id=extensionId(phone), row=(await store.list()).find(x=>x._id===id);
      if (row) await store.put({...row,active:false});
      await stopOne(id);
    }),
    shutdown: () => serial(async()=>{ closing=true; await Promise.all([...running.keys()].map(stopOne)); }),
  };
}
