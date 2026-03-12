FROM apify/actor-node-playwright-chrome:22
COPY package*.json ./
RUN npm install --include=dev --audit=false
COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && npm cache clean --force
CMD ["node", "dist/main.js"]
