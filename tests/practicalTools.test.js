import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PRACTICAL_TOOLS, runPracticalTool } from '../utils/practicalTools.js';
import practicalCommand from '../commands/public/practicalTools.js';
import { buildCommandGuide } from '../utils/commandGuide.js';
import { runCommandLab } from '../utils/commandLab.js';
import { parseCommandSegment } from '../utils/multiCommand.js';

for(const tool of Object.values(PRACTICAL_TOOLS))test(`practical tool ${tool.name}: published example executes`,()=>{
  const output=runPracticalTool(tool.name,tool.example);
  assert.ok(output.length>0);assert.ok(output.length<=12000);
  assert.doesNotMatch(output,/^(?:undefined|NaN|Infinity)$/);
});
test('115 tools have distinct registrations and none overwrite an existing command name',async()=>{
  assert.equal(Object.keys(PRACTICAL_TOOLS).length,115);
  const command=practicalCommand();assert.equal(new Set(command.cmd).size,116);
  async function scan(dir){const entries=await readdir(new URL(dir,import.meta.url),{withFileTypes:true});for(const e of entries){const name=dir+'/'+e.name;if(e.isDirectory())await scan(name);else if(e.name.endsWith('.js')&&!name.endsWith('/practicalTools.js')){const text=await readFile(new URL(name,import.meta.url),'utf8');for(const tool of Object.keys(PRACTICAL_TOOLS))assert.equal(new RegExp(`["']${tool}["']`).test(text),false,`${tool} exists in ${name}`);}}}
  await scan('../commands');
});
test('tools produce independently checked mathematics, dates and encodings',()=>{
  const cases={nummean:['10 20 30','20'],nummedian:['8 2 4 6','5'],numvariance:['2 4 6',String(8/3)],numgcd:['24 36','12'],numlcm:['12 18','36'],fractionreduce:['-24 -36','2/3'],numsort:['9 2 10','2, 9, 10'],discountprice:['10000 15','8500'],simpleinterest:['100000 5 2','10000'],cuboidvolume:['4 5 6','120'],rectanglearea:['8 5','40'],adddays:['2024-02-28 1','2024-02-29'],monthlength:['2024 2','29'],dayofyear:['2024-12-31','366'],weekdayof:['2026-10-02','Friday'],hexdecode:['48656c6c6f','Hello'],bullettext:['One\nTwo','• One\n• Two'],urlclean:['https://example.com/?utm_source=chat&q=alpha','https://example.com/?q=alpha']};
  for(const [name,[input,expected]] of Object.entries(cases))assert.equal(runPracticalTool(name,input),expected,name);
});
test('malformed input and bounded operations fail safely',()=>{
  for(const [name,input] of [['numsum','NaN'],['numgcd','2.5 3'],['factorialcalc','101'],['primecheck','1000000001'],['monthlength','2026 13'],['weekdayof','2026-02-30'],['discountprice','100 -5'],['profitmargin','0 12'],['jsonpretty','{"a":'],['hexdecode','x'],['weightedmean','1 2 | 0 0'],['textrepeat','9999999 | hello']])assert.throws(()=>runPracticalTool(name,input),undefined,name);
  assert.throws(()=>runPracticalTool('numsum','1'.repeat(4001)),/4000/);
  assert.throws(()=>runPracticalTool('numsum','process.exit()'),/finite/);
});
test('every new tool is documented and executes offline in Command Lab',async()=>{
  const command=practicalCommand(),guide=buildCommandGuide({commands:{publicCommands:[command]},prefix:'!!'});
  for(const tool of Object.values(PRACTICAL_TOOLS)){
    const row=guide.find(r=>r.name===tool.name);assert.equal(row.description,tool.description);assert.equal(row.category,tool.category);
    const result=await runCommandLab({text:row.examples[0],prefix:'!!',guide});assert.equal(result.results[0].ok,true,tool.name);assert.equal(result.results[0].mode,'offline execution');assert.equal(result.results[0].output[0],runPracticalTool(tool.name,tool.example));
  }
  const invalid=await runCommandLab({text:'!!nummean text',prefix:'!!',guide});assert.equal(invalid.results[0].ok,false);
});
test('multiline command input reaches the real WhatsApp handler unchanged',async()=>{
  const segment=parseCommandSegment('$bullettext One\nTwo');assert.equal(segment.inputText,'One\nTwo');
  const replies=[];await practicalCommand().handler({}, {}, 'group@g.us',segment.args,{...segment,sendMessageWTyping:async(_jid,p)=>replies.push(p.text)});
  assert.match(replies[0],/• One\n• Two/);
});
