# Estágio 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Servir com Nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copia uma config básica para evitar erro de 404 no React Router
COPY --from=build /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# HEALTHCHECK (28/09/2026): o "wget" já vem no Alpine (BusyBox), sem precisar instalar
# nada extra. Sozinho, isso só marca o container como "unhealthy" em "docker ps" — quem
# realmente reinicia é o serviço "autoheal" no docker-compose.yml do bot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]