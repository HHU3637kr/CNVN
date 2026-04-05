# CNVN 前端（Vite + React）；开发模式见仓库根目录 docker-compose.yml
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 5173

CMD ["pnpm", "exec", "vite", "--host", "0.0.0.0", "--port", "5173"]
