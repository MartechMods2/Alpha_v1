import test from "node:test";
import assert from "node:assert/strict";
import {detectSmartIntent,SMART_INTENT_EXAMPLES,smartIntentSummary} from "../utils/smartIntent.js";

test("smart intents distinguish music, lyrics and music video requests",()=>{
	assert.equal(detectSmartIntent("send me the song Asake - Forgiveness").command,"music");
	assert.equal(detectSmartIntent("get lyrics for Wizkid - Essence").command,"lyrics");
	assert.equal(detectSmartIntent("show me Burna Boy music video").command,"video");
	assert.equal(detectSmartIntent("send me Nigerian song Asake - Forgiveness").command,"naijasong");
});

test("smart intents recognise useful non-media requests",()=>{
	assert.deepEqual(detectSmartIntent("weather in Lagos"),{command:"weather",args:["Lagos"],label:"weather"});
	assert.equal(detectSmartIntent("calculate 25 * 8").command,"calc");
	assert.deepEqual(detectSmartIntent("translate to French good morning").args,["fr","good","morning"]);
	assert.equal(detectSmartIntent("remind me in 2h to call Tunde").command,"remind");
});

test("group-only intents do not activate in private messages",()=>{
	assert.equal(detectSmartIntent("start trivia",{isGroup:false}),null);
	assert.equal(detectSmartIntent("start trivia",{isGroup:true}).command,"trivia");
	assert.ok(SMART_INTENT_EXAMPLES.length>=10);
	assert.ok(smartIntentSummary().utilities.length>=7);
});
