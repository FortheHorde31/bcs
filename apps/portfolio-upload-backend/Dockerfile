FROM node:22-alpine

WORKDIR /app

COPY package.json server.mjs ./
COPY public ./public

RUN mkdir -p /app/data

ENV HOST=0.0.0.0
ENV PORT=8787
ENV STATE_FILE=/app/data/jobs.json

EXPOSE 8787

CMD ["node", "server.mjs"]
