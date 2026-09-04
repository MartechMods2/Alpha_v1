import test from "node:test";
import assert from "node:assert/strict";
import safeKaliGuides from "../commands/public/safeKaliGuides.js";

test("safe Kali pack is substantial and collision-free internally",()=>{const c=safeKaliGuides().cmd;assert.ok(c.length>=50);assert.equal(new Set(c).size,c.length);});
test("dangerous execution and credential-harvesting commands are absent",()=>{const c=safeKaliGuides().cmd.join(" ");for(const word of ["scanport","exploit","bruteforce","phishpage","credentialcapture","shell"])assert.equal(c.includes(word),false);});
