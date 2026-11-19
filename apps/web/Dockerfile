FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_RECOMMENDATIONS_ENABLED=true
ARG NEXT_PUBLIC_AI_CHAT_ENABLED=true
ARG API_WEBSOCKET_UPSTREAM=http://api:8088
ENV NEXT_PUBLIC_RECOMMENDATIONS_ENABLED=$NEXT_PUBLIC_RECOMMENDATIONS_ENABLED NEXT_PUBLIC_AI_CHAT_ENABLED=$NEXT_PUBLIC_AI_CHAT_ENABLED
ENV API_WEBSOCKET_UPSTREAM=$API_WEBSOCKET_UPSTREAM
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node","server.js"]
