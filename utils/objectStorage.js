import { createHash, createHmac } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
const encodePath = (value) => value.split("/").map(encodeURIComponent).join("/");
const accessKey = () => process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || "";
const secretKey = () => process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || "";
export const objectStorageConfigured = () => Boolean(process.env.S3_ENDPOINT && process.env.S3_BUCKET && accessKey() && secretKey());

export const putObject = async (key, body, contentType = "application/octet-stream") => {
	if (!objectStorageConfigured()) throw new Error("S3-compatible storage is not configured"); const region = process.env.S3_REGION || "us-east-1"; const endpoint = new URL(process.env.S3_ENDPOINT); const objectPath = `/${encodePath(process.env.S3_BUCKET)}/${encodePath(key)}`; const url = new URL(objectPath, endpoint); const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amzDate.slice(0, 8); const payload = Buffer.isBuffer(body) ? body : Buffer.from(body); const payloadHash = hash(payload); const headers = `content-type:${contentType}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date"; const canonical = `PUT\n${objectPath}\n\n${headers}\n${signedHeaders}\n${payloadHash}`; const scope = `${date}/${region}/s3/aws4_request`; const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonical)}`; const dateKey = hmac(`AWS4${secretKey()}`, date); const regionKey = hmac(dateKey, region); const serviceKey = hmac(regionKey, "s3"); const signingKey = hmac(serviceKey, "aws4_request"); const signature = hmac(signingKey, stringToSign, "hex"); const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey()}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	const response = await fetch(url, { method: "PUT", headers: { "Content-Type": contentType, Host: url.host, "X-Amz-Content-Sha256": payloadHash, "X-Amz-Date": amzDate, Authorization: authorization }, body: payload, signal: AbortSignal.timeout(60_000) }); if (!response.ok) throw new Error(`Object storage returned ${response.status}`); return { key, url: url.toString() };
};
