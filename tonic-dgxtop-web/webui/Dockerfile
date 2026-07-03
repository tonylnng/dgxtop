# syntax=docker/dockerfile:1.7
# ---- stage 1: build the React app --------------------------------------------
FROM node:20-alpine AS build
WORKDIR /src

COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src
RUN npm run build

# ---- stage 2: serve with nginx + auth ----------------------------------------
FROM nginx:1.27-alpine
RUN apk add --no-cache apache2-utils gettext bash \
    && rm -rf /etc/nginx/conf.d/default.conf

COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx/nginx.conf.template /etc/nginx/templates/dgxtop.conf.template
COPY nginx/entrypoint.sh /docker-entrypoint.d/40-dgxtop-auth.sh

RUN chmod +x /docker-entrypoint.d/40-dgxtop-auth.sh

EXPOSE 80
