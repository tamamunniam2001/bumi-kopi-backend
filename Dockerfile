FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
EXPOSE 5000
CMD ["node", "src/index.js"]
