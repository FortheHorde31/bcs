import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const prototypeDir = new URL("..", import.meta.url).pathname;
const defaultEnvFile = resolve(prototypeDir, "../../../../tools/S3/.env");
loadEnvFile(process.env.PORTFOLIO_ENV_FILE || defaultEnvFile);

const config = {
  endpoint: requiredEnv("S3_ENDPOINT").replace(/\/+$/, ""),
  region: process.env.S3_REGION || "ru-1",
  bucket: requiredEnv("S3_BUCKET"),
  accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
  secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
};

const args = new Set(process.argv.slice(2));
const originArgument = process.argv.find((argument) => argument.startsWith("--origin="));
const origin = originArgument?.slice("--origin=".length);
const shouldApply = args.has("--apply");

const currentResponse = await signedCorsRequest("GET");
let currentXml = "";

if (currentResponse.status === 404) {
  console.log("Current S3 CORS: not configured");
} else if (currentResponse.ok) {
  currentXml = await currentResponse.text();
  console.log("Current S3 CORS:");
  console.log(summarizeCors(currentXml));
} else {
  throw new Error(
    `GetBucketCors returned ${currentResponse.status}: ${(await currentResponse.text()).slice(0, 500)}`,
  );
}

if (!shouldApply) {
  process.exit(0);
}
if (!origin || !/^https?:\/\/[^/]+$/i.test(origin)) {
  throw new Error("Для применения укажите --origin=http://host:port или https://host");
}
if (currentXml.includes(`<AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>`)) {
  console.log(`CORS rule for ${origin} already exists`);
  process.exit(0);
}

const rule = `
  <CORSRule>
    <AllowedOrigin>${escapeXml(origin)}</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>Content-Type</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>600</MaxAgeSeconds>
  </CORSRule>`;

const updatedXml = currentXml
  ? currentXml.replace("</CORSConfiguration>", `${rule}\n</CORSConfiguration>`)
  : `<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${rule}
</CORSConfiguration>`;

const updateResponse = await signedCorsRequest("PUT", updatedXml);
if (!updateResponse.ok) {
  throw new Error(
    `PutBucketCors returned ${updateResponse.status}: ${(await updateResponse.text()).slice(0, 500)}`,
  );
}

console.log(`Added browser upload CORS rule for ${origin}`);

async function signedCorsRequest(method, body = "") {
  const endpoint = new URL(config.endpoint);
  const encodedBucket = encodeURIComponent(config.bucket);
  const url = `${endpoint.origin}/${encodedBucket}?cors`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const payloadHash = sha256(body);
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    `/${encodedBucket}`,
    "cors=",
    `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = signatureKey(config.secretAccessKey, dateStamp, config.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return fetch(url, {
    method,
    headers: {
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": "application/xml",
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
    },
    body: method === "PUT" ? body : undefined,
  });
}

function signatureKey(secret, dateStamp, region) {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function summarizeCors(xml) {
  const origins = [...xml.matchAll(/<AllowedOrigin>(.*?)<\/AllowedOrigin>/g)].map(
    (match) => match[1],
  );
  const methods = [...new Set(
    [...xml.matchAll(/<AllowedMethod>(.*?)<\/AllowedMethod>/g)].map((match) => match[1]),
  )];
  return JSON.stringify({ origins, methods }, null, 2);
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная окружения ${name}`);
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
