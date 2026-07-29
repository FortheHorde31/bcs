FROM node:22-alpine

WORKDIR /app

COPY package.json server.mjs healthcheck.mjs ./
COPY public ./public

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=8787
ENV STATE_FILE=/app/data/jobs.json

EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD ["node", "healthcheck.mjs"]

CMD ["node", "server.mjs"]
