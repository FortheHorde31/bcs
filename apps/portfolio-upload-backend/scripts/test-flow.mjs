import { readFile } from "node:fs/promises";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8787";
const fixtureUrl = new URL("../fixtures/test-portfolio.pdf", import.meta.url);
const fixture = await readFile(fixtureUrl);
const homeResponse = await fetchWithRetry(baseUrl);

if (!homeResponse.ok) {
  throw new Error(`Demo page returned ${homeResponse.status}`);
}

const homeHtml = await homeResponse.text();
const tokenMatch = homeHtml.match(/data-prototype-token="([^"]+)"/);
if (!tokenMatch) {
  throw new Error("Prototype token was not injected into the demo page");
}
const prototypeToken = tokenMatch[1];

const apiHeaders = {
  "Content-Type": "application/json",
  "X-Prototype-Token": prototypeToken,
};

console.log("1/5 Demo page and runtime config loaded");

const initResponse = await fetchWithRetry(`${baseUrl}/api/uploads/init`, {
  method: "POST",
  headers: apiHeaders,
  body: JSON.stringify({
    file_name: "test-portfolio.pdf",
    file_size: fixture.length,
    file_type: "application/pdf",
  }),
});
const init = await readJsonResponse(initResponse);
console.log(`2/5 Presigned URL created for ${init.job_id}`);

const preflightResponse = await fetchWithRetry(init.upload.url, {
  method: "OPTIONS",
  headers: {
    Origin: baseUrl,
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "content-type",
  },
});
const corsOrigin = preflightResponse.headers.get("access-control-allow-origin");
const corsMethods = preflightResponse.headers.get("access-control-allow-methods");
console.log(
  `    S3 CORS: ${corsOrigin ? `origin=${corsOrigin}, methods=${corsMethods || "not returned"}` : "not configured for local origin"}`,
);

const uploadResponse = await fetchWithRetry(init.upload.url, {
  method: "PUT",
  headers: {
    "Content-Type": "application/pdf",
    Origin: baseUrl,
  },
  body: fixture,
});
if (!uploadResponse.ok) {
  const body = await uploadResponse.text();
  throw new Error(`S3 upload returned ${uploadResponse.status}: ${body.slice(0, 300)}`);
}
console.log("3/5 Test PDF uploaded directly to Timeweb S3");

const completeResponse = await fetchWithRetry(
  `${baseUrl}/api/uploads/${encodeURIComponent(init.job_id)}/complete`,
  {
    method: "POST",
    headers: apiHeaders,
    body: JSON.stringify({ file_id: init.file_id }),
  },
);
const completedUpload = await readJsonResponse(completeResponse);
console.log(`4/5 Upload confirmed, status=${completedUpload.status}`);

const deadline = Date.now() + 20_000;
while (Date.now() < deadline) {
  await delay(1000);
  const statusResponse = await fetchWithRetry(
    `${baseUrl}/api/jobs/${encodeURIComponent(init.job_id)}`,
    { headers: { "X-Prototype-Token": prototypeToken } },
  );
  const job = await readJsonResponse(statusResponse);
  if (job.status === "completed") {
    const callbackEvent = job.events.find((event) => event.type === "callback_received");
    if (!callbackEvent) {
      throw new Error("Job completed without callback_received event");
    }
    console.log(`5/5 Mock callback received, result=${job.score}/10`);
    console.log(`FLOW_OK job_id=${job.job_id}`);
    process.exit(0);
  }
  if (job.status === "failed") {
    throw new Error("Mock analysis failed");
  }
}

throw new Error("Timed out waiting for mock callback");

async function readJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request returned ${response.status}`);
  }
  return payload;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(500 * attempt);
      }
    }
  }
  throw lastError;
}
