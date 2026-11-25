# The site: built once with Node, then served by nginx, which also passes /api on to the API container.
# Build from the mytickets-frontend folder: docker build -t mytickets-web .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
