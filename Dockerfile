# Use an official Node.js runtime as the base image
FROM node:22-alpine

# Install system dependencies
# https://source.chromium.org/chromium/chromium/src/+/main:chrome/installer/linux/debian/dist_package_versions.json
# We download external chromium and not use playwright one to avoid issues with executable path
# TODO: Playwright downloads own chromium (in /root/.cache/ms-playwright/... directory) which does not have ./chromium-laucher.sh
RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories && \
    apk update && \
    apk add --no-cache \
    libuuid \
    libx11 \
    libxcb \
    libxcomposite \
    libxcursor \
    libxdamage \
    libxext \
    libxfixes \
    libxi \
    libxkbcommon \
    libxrandr \
    libxrender \
    libxshmfence \
    libxtst \
    libxscrnsaver \
    libxft \
    ffmpeg \
    python3 \
    py3-pip \
    py3-setuptools \
    libxinerama \
    chromium \
    ca-certificates

# Создаем символическую ссылку python -> python3
RUN ln -sf python3 /usr/bin/python

# Install yt-dlp in a virtual environment
RUN python3 -m venv /opt/venv \
    && . /opt/venv/bin/activate \
    && pip install --no-cache-dir --upgrade yt-dlp

# Добавим PATH для Python виртуального окружения
ENV PATH="/opt/venv/bin:$PATH"

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY .env .

# Перед npm install добавим:
RUN npm install -g yt-dlp-exec --unsafe-perm=true

# Install project dependencies
RUN npm install --verbose

# Build the application
RUN npm run build

# Expose the port the app runs on (if needed)
EXPOSE 8443

# Command to run the application
CMD ["npm", "start"]

# Docker build command:
# docker build --build-arg -t telegram-video-bot .

# Docker run command:
# docker run -d --name telegram-video-bot -e BOT_TOKEN=your_bot_token_here telegram-video-bot

# Note: Replace 'your_bot_token_here' with your actual Telegram bot token when running the container