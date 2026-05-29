FROM node:20-alpine AS build

WORKDIR /app

# Nuxt/Supabase server-side helpers (e.g. serverSupabaseServiceRole) may read
# certain config at build time. We pass these as build args so local docker
# builds work without requiring changes to app/server code.
ARG SUPABASE_URL
ARG SUPABASE_KEY
ARG SUPABASE_SERVICE_KEY
ARG SUPABASE_SECRET_KEY
ENV SUPABASE_URL=$SUPABASE_URL \
    SUPABASE_KEY=$SUPABASE_KEY \
    SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
    SUPABASE_SECRET_KEY=$SUPABASE_SECRET_KEY

# Install deps first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy only what Nuxt needs to build (avoid copying host node_modules)
COPY nuxt.config.ts tsconfig.json eslint.config.mjs ./
COPY app ./app
COPY server ./server
COPY public ./public

RUN npm run build


FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Provide a tiny TCP proxy so SSR code can call the Supabase public URL
# (http://localhost:${SUPABASE_KONG_PORT}) from inside the container.
RUN apk add --no-cache socat

COPY --from=build /app/.output ./.output

COPY deploy/app/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
