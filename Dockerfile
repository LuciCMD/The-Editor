# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.12.0

FROM node:${NODE_VERSION}-alpine

# System dependencies:
#   python3, make, g++  -> node-gyp builds (@discordjs/opus, sqlite3)
#   ffmpeg              -> required by DisTube/@discordjs/voice for audio (NOT bundled)
#   python3            -> also required at runtime by the yt-dlp zipapp binary
# ffmpeg + python3 are kept in the final image (runtime deps), so this is a single stage.
RUN apk add --no-cache python3 make g++ ffmpeg && ln -sf python3 /usr/bin/python

# Use production node environment by default.
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Install dependencies in their own layer for caching. We COPY the manifests
# (rather than bind-mounting them) so that any change to package.json /
# package-lock.json reliably invalidates this layer and forces a fresh npm ci.
# The previous bind-mount approach could reuse a stale install after dependency
# bumps (e.g. leaving an old @distube/spotify behind).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy the rest of the source files into the image.
COPY . .

# Fix permissions so the non-root user can write the yt-dlp binary into node_modules at boot.
RUN chown -R node:node /usr/src/app

# Run the application as a non-root user.
USER node

# Expose the port that the health-check HTTP server listens on.
EXPOSE 3000

# Run the application.
CMD ["npm", "start"]
