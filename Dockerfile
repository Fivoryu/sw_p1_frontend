# Build static assets
FROM public.ecr.aws/docker/library/node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NG_CONFIGURATION=production
RUN npm run build -- --configuration=${NG_CONFIGURATION}

# Serve with nginx (SPA)
FROM public.ecr.aws/docker/library/nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/workflow-ui /usr/share/nginx/html
EXPOSE 80
