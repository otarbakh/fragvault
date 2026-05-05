FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --legacy-peer-deps
RUN npx prisma generate
COPY . .
RUN npm run build
EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]
