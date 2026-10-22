import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { fileTypeFromBuffer } from "file-type";
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const execute = promisify(execFile);
export const audioCacheKey = (query, isYoutube) => isYoutube(query) ? query : query.toLowerCase();
export async function inspectAudio(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_AUDIO_BYTES)
    throw Error("Audio is empty or exceeds the 25MB safety limit.");
  const type = await fileTypeFromBuffer(buffer);
  if (!type?.mime?.startsWith("audio/")) throw Error("The download is not a recognized audio file.");
  return type;
}
export async function encodeVoiceNote(buffer) {
  const type = await inspectAudio(buffer);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "alpha-voice-note-"));
  const input = path.join(directory, "input." + type.ext), output = path.join(directory, "voice.ogg");
  try {
    await fs.writeFile(input, buffer);
    await execute(process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : "ffmpeg"), [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-threads", "1",
      "-protocol_whitelist", "file,pipe", "-i", input, "-vn", "-ac", "1", "-ar", "48000",
      "-c:a", "libopus", "-b:a", "48k", "-t", "720", "-fs", String(MAX_AUDIO_BYTES), output,
    ], { timeout: 45000, killSignal: "SIGKILL", maxBuffer: 256 * 1024 });
    if ((await fs.stat(output)).size > MAX_AUDIO_BYTES) throw Error("Voice note exceeds the safety limit.");
    const encoded = await fs.readFile(output);
    if (encoded.subarray(0, 4).toString() !== "OggS") throw Error("Voice-note encoding failed.");
    return encoded;
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
