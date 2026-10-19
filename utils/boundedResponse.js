export async function boundedResponseText(response, maxBytes = 1048576) {
  if (Number(response.headers?.get?.("content-length") || 0) > maxBytes) {
    await response.body?.cancel?.();
    throw Error("Provider response exceeds its byte limit");
  }
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes)
      throw Error("Provider response exceeds its byte limit");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Error("Provider response exceeds its byte limit");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}
