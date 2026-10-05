import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import {readFile} from 'node:fs/promises';
import {runTechnicalTool,TECHNICAL_TOOLS,lookupDkim} from '../utils/technicalSecurity.js';
import command from '../commands/public/technicalSecurity.js';
import defensive from '../commands/public/defensiveSecurityLab.js';
test('all local technical examples execute and certificate inspection rejects private keys',async()=>{
  assert.equal(Object.keys(TECHNICAL_TOOLS).length,9);
  for(const [name,tool] of Object.entries(TECHNICAL_TOOLS))if(name!=='pemaudit')assert.ok(runTechnicalTool(name,tool.example));
  const certificate=await readFile(new URL('./fixtures/security-public-cert.pem',import.meta.url),'utf8');
  assert.match(runTechnicalTool('pemaudit',certificate),/alpha.example/);
  assert.throws(()=>runTechnicalTool('pemaudit','-----BEGIN PRIVATE KEY-----'),/not a private key/);
});
test('configuration reviews catch dangerous settings without displaying secrets',()=>{
  assert.match(runTechnicalTool('sshaudit','PermitRootLogin yes\nPermitEmptyPasswords yes'),/Empty passwords/);
  assert.match(runTechnicalTool('dockeraudit','privileged: true\nvolumes:\n - /var/run/docker.sock:/var/run/docker.sock'),/host-level control/);
  assert.match(runTechnicalTool('spfreview','v=spf1 +all'),/permits every sender/);
  assert.match(runTechnicalTool('dmarcreview','v=DMARC1; p=none; pct=101'),/0 to 100/);
  assert.match(runTechnicalTool('mailheaderreview','Authentication-Results: mx.example;\n dkim=pass; spf=fail'),/forged/);
  assert.match(runTechnicalTool('gitignoreaudit','.env\n!.env.secret'),/re-include/);
  assert.equal(JSON.parse(runTechnicalTool('ioccompare','a\nb | b\nc')).shared[0],'b');
  assert.throws(()=>runTechnicalTool('sshaudit','x'.repeat(6001)),/6000/);
});
test('DKIM lookup accepts the standard underscore label and bounds results',async t=>{
  let queried;
  t.mock.method(dns,'resolveTxt',async name=>{queried=name;return [['v=DKIM1; ','p=public-key']];});
  assert.equal(await lookupDkim('example.com','selector1'),'v=DKIM1; p=public-key');
  assert.equal(queried,'selector1._domainkey.example.com');
  await assert.rejects(lookupDkim('example.com','bad/selector'),/Use/);
});
test('commands preserve multiline configuration input and owner disablement',async t=>{
  const replies=[],info={command:'sshaudit',inputText:'PermitRootLogin no\nPermitEmptyPasswords yes',senderJid:'tester',prefix:'$',sendMessageWTyping:async(_jid,p)=>replies.push(p.text)};
  await command().handler({}, {}, 'g@g.us',[],info);assert.match(replies.pop(),/Empty passwords/);
  const old=process.env.SECURITY_TOOLS_ENABLED;process.env.SECURITY_TOOLS_ENABLED='false';
  try{await command().handler({}, {}, 'g@g.us',[],info);assert.match(replies.pop(),/disabled/);}finally{if(old===undefined)delete process.env.SECURITY_TOOLS_ENABLED;else process.env.SECURITY_TOOLS_ENABLED=old;}
  await defensive().handler({}, {}, 'g@g.us',[],{...info,command:'secheaderreport',inputText:'X-Content-Type-Options: nosniff\nX-Frame-Options: DENY'});assert.match(replies.pop(),/DENY/);
});
test('technical tools appear in the guide and execute locally in Command Lab',async()=>{
  const {buildCommandGuide}=await import('../utils/commandGuide.js');
  const {runCommandLab}=await import('../utils/commandLab.js');
  const guide=buildCommandGuide({commands:{publicCommands:[command()]},prefix:'$'});
  for(const [name,tool] of Object.entries(TECHNICAL_TOOLS)){
    const input=name==='pemaudit'?await readFile(new URL('./fixtures/security-public-cert.pem',import.meta.url),'utf8'):tool.example;
    const result=await runCommandLab({text:`$${name} ${input}`,guide});
    assert.equal(result.results[0].ok,true,name);assert.equal(result.results[0].mode,'offline execution');
    assert.equal(guide.find(row=>row.name===name).description,tool.description);
  }
});
