FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
COPY . ./

RUN bun install && bun run build

ENTRYPOINT ["bun", "run", "dist/src/index.js"]
CMD ["--help"]
