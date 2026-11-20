# dcamp playground 배포용 — server.js가 정적 페이지와 api/*.js를 함께 서비스한다.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "server.js"]
