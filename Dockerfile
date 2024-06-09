# syntax=docker/dockerfile:1

ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine

# Install Python, make, and g++ for node-gyp compatibility
RUN apk add --no-cache python3 make g++ && ln -sf python3 /usr/bin/python

# Use production node environment by default.
ENV NODE_ENV production

WORKDIR /usr/src/app

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.npm to speed up subsequent builds.
# Leverage bind mounts to package.json and package-lock.json to avoid having to copy them into
# this layer.
RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Copy the rest of the source files into the image.
COPY . .

# Fix permissions for the node_modules directory
RUN chown -R node:node /usr/src/app

# Run the application as a non-root user.
USER node

# Expose the port that the application listens on.
EXPOSE 80

# Run the application.
CMD ["npm", "start"]
