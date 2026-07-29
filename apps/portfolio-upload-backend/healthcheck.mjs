import http from "node:http";

const port = Number(process.env.PORT || 8787);

const request = http.get(
  {
    hostname: "127.0.0.1",
    port,
    path: "/api/health",
    timeout: 3_000,
  },
  (response) => {
    response.resume();
    const isHealthy = response.statusCode >= 200 && response.statusCode < 300;
    process.exit(isHealthy ? 0 : 1);
  },
);

request.on("timeout", () => {
  request.destroy();
});

request.on("error", () => {
  process.exit(1);
});
