import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { createServer } from "node:http";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const prototypeDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(prototypeDir, "public");
const defaultEnvFile = resolve(prototypeDir, "../../../../tools/S3/.env");
loadEnvFile(process.env.PORTFOLIO_ENV_FILE || defaultEnvFile);

const config = {
  port: numberFromEnv("PORT", 8787),
  host: process.env.HOST || "127.0.0.1",
  s3Endpoint: requiredEnv("S3_ENDPOINT").replace(/\/+$/, ""),
  s3Region: process.env.S3_REGION || "ru-1",
  s3Bucket: requiredEnv("S3_BUCKET"),
  s3AccessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
  s3SecretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
  s3Prefix: (process.env.S3_PREFIX || "portfolio-prototype").replace(/^\/+|\/+$/g, ""),
  maxFileBytes: numberFromEnv("MAX_FILE_BYTES", 30 * 1024 * 1024),
  uploadUrlTtlSeconds: numberFromEnv("UPLOAD_URL_TTL_SECONDS", 600),
  mockDelayMs: numberFromEnv("MOCK_ANALYSIS_DELAY_MS", 5000),
  mockScore: numberFromEnv("MOCK_SCORE", 6),
  mockEnabled: booleanFromEnv("MOCK_ANALYZER_ENABLED", true),
  publicApiToken: process.env.PROTOTYPE_API_TOKEN || randomBytes(18).toString("base64url"),
  callbackSecret: process.env.CALLBACK_SECRET || randomBytes(32).toString("hex"),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, ""),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  stateFile: resolve(
    prototypeDir,
    process.env.STATE_FILE || "data/jobs.json",
  ),
};

const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);
const jobs = loadJobs(config.stateFile);
const callbackIds = new Set();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    setCorsHeaders(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const requestUrl = new URL(request.url || "/", "http://localhost");
    const pathname = requestUrl.pathname;

    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        service: "portfolio-upload-prototype",
        storage: "timeweb-s3",
        mock_analyzer: config.mockEnabled,
        jobs: jobs.size,
      });
      return;
    }

    if (request.method === "GET" && pathname === "/tilda-snippet.txt") {
      const baseUrl = resolvePublicBaseUrl(request);
      const template = readFileSync(join(publicDir, "tilda-block.html"), "utf8")
        .replaceAll("__API_BASE__", baseUrl)
        .replaceAll("__PROTOTYPE_TOKEN__", config.publicApiToken);
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(template);
      return;
    }

    if (request.method === "POST" && pathname === "/api/uploads/init") {
      requirePrototypeToken(request);
      const payload = await readJson(request);
      const file = validateFileInput(payload);
      const jobId = `job_${randomBytes(9).toString("hex")}`;
      const fileId = `file_${randomBytes(8).toString("hex")}`;
      const extension = extname(file.name).toLowerCase();
      const day = new Date().toISOString().slice(0, 10);
      const objectKey = `${config.s3Prefix}/${day}/${jobId}/${fileId}${extension}`;

      const job = {
        id: jobId,
        fileId,
        fileName: file.name,
        declaredSize: file.size,
        declaredType: file.type,
        objectKey,
        status: "created",
        score: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        events: [],
      };
      addEvent(job, "job_created", "Создано задание на загрузку");
      jobs.set(jobId, job);

      const uploadUrl = createPresignedUrl({
        method: "PUT",
        objectKey,
        expiresIn: config.uploadUrlTtlSeconds,
      });

      job.status = "uploading";
      addEvent(job, "upload_url_created", "Выдан временный URL Timeweb S3");
      persistJobs();

      sendJson(response, 201, {
        job_id: jobId,
        file_id: fileId,
        upload: {
          method: "PUT",
          url: uploadUrl,
          expires_in_seconds: config.uploadUrlTtlSeconds,
        },
      });
      return;
    }

    const completeMatch = pathname.match(/^\/api\/uploads\/([^/]+)\/complete$/);
    if (request.method === "POST" && completeMatch) {
      requirePrototypeToken(request);
      await readJson(request);
      const job = getJob(completeMatch[1]);

      const objectInfo = await inspectS3Object(job.objectKey);
      if (!objectInfo.exists) {
        throw httpError(409, "Файл не найден в Timeweb S3");
      }
      if (objectInfo.size > config.maxFileBytes) {
        throw httpError(413, "Файл в S3 превышает допустимый размер");
      }

      job.status = "processing";
      job.actualSize = objectInfo.size;
      addEvent(job, "upload_confirmed", `Файл найден в S3 (${objectInfo.size} байт)`);
      if (config.mockEnabled) {
        addEvent(job, "analysis_started", "Mock-анализатор начал обработку");
        setTimeout(() => {
          sendMockCallback(job.id).catch((error) => {
            job.status = "failed";
            addEvent(job, "mock_callback_failed", error.message);
            persistJobs();
            console.error(`[mock] callback failed for ${job.id}: ${error.message}`);
          });
        }, config.mockDelayMs);
      } else {
        addEvent(job, "analysis_waiting", "Ожидается callback внешнего анализатора");
      }
      persistJobs();

      sendJson(response, 202, {
        job_id: job.id,
        status: job.status,
      });
      return;
    }

    const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (request.method === "GET" && jobMatch) {
      requirePrototypeToken(request);
      const job = getJob(jobMatch[1]);
      sendJson(response, 200, publicJob(job));
      return;
    }

    if (request.method === "POST" && pathname === "/api/analysis-callback") {
      const rawBody = await readBody(request);
      const callbackId = request.headers["x-callback-id"];
      if (callbackId && callbackIds.has(callbackId)) {
        sendJson(response, 200, {
          ok: true,
          duplicate: true,
        });
        return;
      }
      verifyCallback(request, rawBody);
      const payload = parseJson(rawBody);
      const job = getJob(payload.job_id);

      if (payload.status !== "completed") {
        throw httpError(422, "Прототип ожидает callback со статусом completed");
      }

      const score = Number(payload.score);
      if (!Number.isInteger(score) || score < 0 || score > 10) {
        throw httpError(422, "Score должен быть целым числом от 0 до 10");
      }

      job.status = "completed";
      job.score = score;
      job.callbackReceivedAt = new Date().toISOString();
      addEvent(job, "callback_received", `Получен callback с результатом ${score}/10`);
      persistJobs();
      console.log(`[callback] ${job.id}: completed, score=${score}`);

      sendJson(response, 200, {
        ok: true,
        job_id: job.id,
      });
      return;
    }

    if (request.method === "GET") {
      await serveStatic(request, response, pathname);
      return;
    }

    throw httpError(404, "Маршрут не найден");
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error(error);
    }
    sendJson(response, status, {
      error: error.message || "Внутренняя ошибка",
    });
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Portfolio upload prototype: http://${config.host}:${config.port}`);
  console.log(`Timeweb S3 endpoint: ${config.s3Endpoint}`);
  console.log(`Timeweb S3 bucket: ${config.s3Bucket}`);
  console.log(`Tilda block template: http://${config.host}:${config.port}/tilda-block.html`);
  console.log(`Job state file: ${config.stateFile}`);
  console.log(`Mock analyzer: ${config.mockEnabled ? "enabled" : "disabled"}`);
  console.log("S3 credentials loaded: yes (values are not printed)");
});

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
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

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} должна быть положительным числом`);
  }
  return number;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function loadJobs(filePath) {
  if (!existsSync(filePath)) {
    return new Map();
  }
  try {
    const values = JSON.parse(readFileSync(filePath, "utf8"));
    return new Map(values.map((job) => [job.id, job]));
  } catch (error) {
    throw new Error(`Не удалось прочитать STATE_FILE: ${error.message}`);
  }
}

function persistJobs() {
  mkdirSync(dirname(config.stateFile), { recursive: true });
  const temporaryPath = `${config.stateFile}.tmp`;
  writeFileSync(
    temporaryPath,
    JSON.stringify([...jobs.values()], null, 2),
    { mode: 0o600 },
  );
  renameSync(temporaryPath, config.stateFile);
}

function validateFileInput(payload) {
  const name = String(payload?.file_name || "").trim();
  const size = Number(payload?.file_size);
  const type = String(payload?.file_type || "application/octet-stream");
  const extension = extname(name).toLowerCase();

  if (!name || name.length > 200) {
    throw httpError(422, "Некорректное имя файла");
  }
  if (!allowedExtensions.has(extension)) {
    throw httpError(415, "Поддерживаются PDF, DOC, DOCX, JPG, JPEG и PNG");
  }
  if (!Number.isFinite(size) || size <= 0 || size > config.maxFileBytes) {
    throw httpError(413, `Максимальный размер файла — ${Math.round(config.maxFileBytes / 1024 / 1024)} МБ`);
  }

  return { name, size, type };
}

function addEvent(job, type, message) {
  const now = new Date().toISOString();
  job.updatedAt = now;
  job.events.push({
    at: now,
    type,
    message,
  });
}

function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    throw httpError(404, "Задание не найдено");
  }
  return job;
}

function publicJob(job) {
  return {
    job_id: job.id,
    status: job.status,
    score: job.score,
    file_name: job.fileName,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    events: job.events,
  };
}

async function inspectS3Object(objectKey) {
  const headUrl = createPresignedUrl({
    method: "HEAD",
    objectKey,
    expiresIn: 60,
  });
  const response = await fetch(headUrl, { method: "HEAD" });
  if (response.status === 404) {
    return { exists: false, size: 0 };
  }
  if (!response.ok) {
    throw httpError(502, `Timeweb S3 вернул ${response.status} при проверке файла`);
  }
  return {
    exists: true,
    size: Number(response.headers.get("content-length") || 0),
  };
}

async function sendMockCallback(jobId) {
  const callbackBase = config.publicBaseUrl || `http://127.0.0.1:${config.port}`;
  const callbackId = `cb_${randomUUID()}`;
  const payload = JSON.stringify({
    job_id: jobId,
    status: "completed",
    score: config.mockScore,
    analyzer: "local-mock",
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", config.callbackSecret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${callbackBase}/api/analysis-callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Callback-Id": callbackId,
          "X-Callback-Timestamp": timestamp,
          "X-Callback-Signature": `sha256=${signature}`,
        },
        body: payload,
      });
      if (response.ok) {
        return;
      }
      lastError = new Error(`callback endpoint вернул ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 1000));
    }
  }
  throw lastError || new Error("Не удалось отправить callback");
}

function verifyCallback(request, rawBody) {
  const callbackId = request.headers["x-callback-id"];
  const timestamp = request.headers["x-callback-timestamp"];
  const supplied = request.headers["x-callback-signature"];

  if (!callbackId || !timestamp || !supplied) {
    throw httpError(401, "Отсутствует подпись callback");
  }
  if (callbackIds.has(callbackId)) {
    throw httpError(409, "Callback уже обработан");
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    throw httpError(401, "Callback просрочен");
  }

  const expected = `sha256=${createHmac("sha256", config.callbackSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;

  const suppliedBuffer = Buffer.from(String(supplied));
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw httpError(401, "Неверная подпись callback");
  }

  callbackIds.add(callbackId);
}

function createPresignedUrl({ method, objectKey, expiresIn }) {
  const endpoint = new URL(config.s3Endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.s3Region}/s3/aws4_request`;
  const canonicalUri = [
    endpoint.pathname.replace(/\/+$/, ""),
    awsEncode(config.s3Bucket),
    ...objectKey.split("/").map(awsEncode),
  ]
    .filter(Boolean)
    .join("/")
    .replace(/^([^/])/, "/$1");

  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.s3AccessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.entries(query)
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort(([keyA, valueA], [keyB, valueB]) => {
      const keyOrder = keyA.localeCompare(keyB);
      return keyOrder || valueA.localeCompare(valueB);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const canonicalHeaders = `host:${endpoint.host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const dateKey = createHmac("sha256", `AWS4${config.s3SecretAccessKey}`)
    .update(dateStamp)
    .digest();
  const regionKey = createHmac("sha256", dateKey)
    .update(config.s3Region)
    .digest();
  const serviceKey = createHmac("sha256", regionKey)
    .update("s3")
    .digest();
  const signingKey = createHmac("sha256", serviceKey)
    .update("aws4_request")
    .digest();
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function requirePrototypeToken(request) {
  const supplied = request.headers["x-prototype-token"];
  if (!supplied || supplied !== config.publicApiToken) {
    throw httpError(401, "Неверный prototype token");
  }
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const allowAll = config.allowedOrigins.includes("*");
  if (allowAll) {
    response.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && config.allowedOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,X-Prototype-Token",
  );
  response.setHeader("Access-Control-Max-Age", "600");
}

async function readJson(request) {
  return parseJson(await readBody(request));
}

function parseJson(rawBody) {
  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw httpError(400, "Некорректный JSON");
  }
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        rejectBody(httpError(413, "Тело запроса слишком большое"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", rejectBody);
  });
}

async function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(publicDir, `.${safePath}`);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    throw httpError(404, "Файл не найден");
  }

  const extension = extname(filePath).toLowerCase();
  let content = readFileSync(filePath);

  if (extension === ".html") {
    const baseUrl = resolvePublicBaseUrl(request);
    content = Buffer.from(
      content
        .toString("utf8")
        .replaceAll("__API_BASE__", baseUrl)
        .replaceAll("__PROTOTYPE_TOKEN__", config.publicApiToken),
    );
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=60",
  });
  response.end(content);
}

function resolvePublicBaseUrl(request) {
  if (config.publicBaseUrl) {
    return config.publicBaseUrl;
  }
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  const protocol = forwardedProtocol || "http";
  const host = request.headers.host || `127.0.0.1:${config.port}`;
  return `${protocol}://${host}`;
}

function sendJson(response, status, payload) {
  if (response.headersSent) {
    return;
  }
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
