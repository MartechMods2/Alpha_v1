import test from "node:test";
import assert from "node:assert/strict";
import command,{SAFE_MEDIA_COMMANDS} from "../commands/public/safeMediaMega.js";
import {providerStatus} from "../utils/safeMediaProviders.js";

test("safe media mega pack exposes at least 100 distinct commands",()=>{
	assert.ok(SAFE_MEDIA_COMMANDS.length>=100);
	assert.equal(new Set(SAFE_MEDIA_COMMANDS).size,SAFE_MEDIA_COMMANDS.length);
	for(const name of ["giflaugh","naturephoto","danceclip","applausefx","marspic","safemediahelp","freeproviders"])assert.ok(SAFE_MEDIA_COMMANDS.includes(name));
	assert.equal(command().handler instanceof Function,true);
});

test("keyless providers remain available when optional keys are absent",()=>{
	const status=providerStatus();
	assert.equal(status.openverse,true);assert.equal(status.nasa,true);assert.equal(status.archive,true);
});
