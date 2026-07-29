FROM node:22-alpine

WORKDIR /app

COPY package.json server.mjs healthcheck.mjs ./
COPY public ./public

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=8787
ENV STATE_FILE=/app/data/jobs.json

EXPOSE 8787

# Timeweb App Platform also monitors the container process. Keep the Docker
# readiness check independent of S3 and external services for this MVP.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 CMD true

CMD ["node", "server.mjs"]
