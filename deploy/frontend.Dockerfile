# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV VITE_USE_MOCK=false VITE_API_BASE_URL=/api/v1
# tsc -b kiểm cả file test; test đọc shared/test-fixtures ở gốc repo (đường ../../../../../shared trỏ tới /shared)
COPY --from=shared . /shared
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=deploy nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=deploy nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
