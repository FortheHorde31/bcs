FROM node:22-alpine

WORKDIR /app

COPY package.json server.mjs ./
COPY public ./public

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=8787
ENV STATE_FILE=/app/data/jobs.json

EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
