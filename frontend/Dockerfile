FROM node:22-alpine AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json* /src/
RUN npm install
COPY frontend /src
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 80
