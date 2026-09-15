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

test("natural group decisions route to AI polls while explicit pipe polls stay manual",()=>{
	assert.equal(detectSmartIntent("help us decide the best day for game night",{isGroup:true}).command,"aipoll");
	assert.equal(detectSmartIntent("create a poll Best day? | Friday | Saturday",{isGroup:true}).command,"poll");
	assert.equal(detectSmartIntent("create a poll for the best food for tonight",{isGroup:true}).command,"aipoll");
	assert.equal(detectSmartIntent("start would you rather",{isGroup:true}).command,"wyr");
});

test("group-only intents do not activate in private messages",()=>{
	assert.equal(detectSmartIntent("start trivia",{isGroup:false}),null);
	assert.equal(detectSmartIntent("start trivia",{isGroup:true}).command,"trivia");
	assert.equal(detectSmartIntent("help us decide the best day for game night",{isGroup:false}),null);
	assert.ok(SMART_INTENT_EXAMPLES.length>=10);
	assert.ok(smartIntentSummary().utilities.length>=7);
});
