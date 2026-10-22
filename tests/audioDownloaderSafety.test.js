import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import { audioCacheKey, inspectAudio, encodeVoiceNote, MAX_AUDIO_BYTES } from "../utils/audioDelivery.js";
import { createBoundedYtDlpExecutor, isYouTubeUrl } from "../utils/ytdlp.js";
const wave = () => {
  const buffer = Buffer.alloc(1644);
  buffer.write("RIFF",0); buffer.writeUInt32LE(buffer.length-8,4); buffer.write("WAVEfmt ",8);
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(1,20); buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(8000,24); buffer.writeUInt32LE(16000,28);
  buffer.writeUInt16LE(2,32); buffer.writeUInt16LE(16,34);
  buffer.write("data",36); buffer.writeUInt32LE(1600,40);
  return buffer;
};
test("audio signatures reject HTML, empty and oversized payloads before delivery", async () => {
  assert.equal((await inspectAudio(wave())).ext, "wav");
  await assert.rejects(inspectAudio(Buffer.from("<html>fake mp3</html>")), /recognized audio/);
  await assert.rejects(inspectAudio(Buffer.alloc(0)), /empty/);
  await assert.rejects(inspectAudio(Buffer.alloc(MAX_AUDIO_BYTES + 1)), /25MB/);
});
test("YouTube cache keys preserve case-sensitive IDs while normal artist queries share a cache", () => {
  assert.notEqual(audioCacheKey("https://youtu.be/AbCd",isYouTubeUrl), audioCacheKey("https://youtu.be/abcd",isYouTubeUrl));
  assert.equal(audioCacheKey("Artist Song",isYouTubeUrl), audioCacheKey("artist song",isYouTubeUrl));
});
test("actual FFmpeg conversion creates an Opus Ogg voice note and removes temporary files", async () => {
  const before = (await fs.readdir(os.tmpdir())).filter((x)=>x.startsWith("alpha-voice-note-"));
  const output = await encodeVoiceNote(wave());
  assert.equal(output.subarray(0,4).toString(), "OggS");
  assert.ok(output.includes(Buffer.from("OpusHead")));
  const after = (await fs.readdir(os.tmpdir())).filter((x)=>x.startsWith("alpha-voice-note-"));
  assert.deepEqual(after, before);
});
test("failed FFmpeg startup cleans its entire temporary directory", async () => {
  const before = (await fs.readdir(os.tmpdir())).filter((x)=>x.startsWith("alpha-voice-note-"));
  const previous = process.env.FFMPEG_PATH;
  process.env.FFMPEG_PATH = "/nonexistent-alpha-ffmpeg-fixture";
  try { await assert.rejects(encodeVoiceNote(wave())); }
  finally { if (previous === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = previous; }
  assert.deepEqual((await fs.readdir(os.tmpdir())).filter((x)=>x.startsWith("alpha-voice-note-")), before);
});
test("yt-dlp is spawned without a shell and with a kill deadline/output cap", async () => {
  const calls = [];
  const run = createBoundedYtDlpExecutor(async(...args)=>{calls.push(args);return {stdout:'{"duration":30,"title":"test"}'};});
  const result = await run("/fake/yt-dlp", "https://youtu.be/CaseID", { noPlaylist:true, dumpSingleJson:true });
  assert.equal(result.duration,30);
  assert.ok(calls[0][1].includes("--no-playlist"));
  assert.equal(calls[0][2].timeout,120000);
  assert.equal(calls[0][2].killSignal,"SIGKILL");
  assert.equal(calls[0][2].maxBuffer,2*1024*1024);
  assert.ok(!calls[0][2].shell);
  await assert.rejects(run("/fake", "https://127.0.0.1/file"), /YouTube URL/);
  assert.equal(isYouTubeUrl("https://user:secret@youtube.com/watch?v=x"),false);
  assert.equal(isYouTubeUrl("https://youtube.com:444/watch?v=x"),false);
});
test("yta validates its arguments and delegates voice requests to the shared queued song handler", async () => {
  const calls = [], replies = [];
  globalThis.__ytaDelegate = (...args) => calls.push(args);
  try {
    let source = await fs.readFile(new URL("../commands/group/members/yta.js", import.meta.url), "utf8");
    const mock = "data:text/javascript;base64," + Buffer.from("export default ()=>({handler:(...args)=>globalThis.__ytaDelegate(...args)});").toString("base64");
    source = source.replace('"./song.js"', JSON.stringify(mock)).replace('"../../../utils/ytdlp.js"', JSON.stringify(new URL("../utils/ytdlp.js", import.meta.url).href));
    const { default: create } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
    const info = { sendMessageWTyping: async (_g,p) => replies.push(p) };
    await create().handler({}, {}, "test@g.us", ["https://example.com/file"], info);
    await create().handler({}, {}, "test@g.us", ["https://youtu.be/CaseID", "wrong"], info);
    assert.equal(calls.length,0); assert.equal(replies.length,2);
    await create().handler({}, {}, "test@g.us", ["https://youtu.be/CaseID", "--voice"], info);
    assert.equal(calls.length,1); assert.deepEqual(calls[0][3],["https://youtu.be/CaseID","--voice"]);
  } finally { delete globalThis.__ytaDelegate; }
});
