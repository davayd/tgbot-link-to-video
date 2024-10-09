# Use an official Node.js runtime as the base image
FROM node:22-alpine

# Устанавливаем зависимости для Playwright
RUN apk add --no-cache python3 make g++ jpeg-dev libpng-dev cairo-dev pango-dev giflib-dev

# Устанавливаем Playwright и его зависимости
RUN npm install -g playwright
RUN playwright install chromium
RUN apk add --no-cache \
    ffmpeg \
    chromium \
    font-noto-emoji \
    font-noto-cjk \
    ttf-freefont \
    nss \
    freetype \
    harfbuzz \
    ca-certificates
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install Playwright dependencies
RUN apk add --no-cache \
    ffmpeg \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    yarn

# Set environment variables for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install Playwright
RUN yarn add playwright-core

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install system dependencies
RUN apk update && apk add --no-cache \
    alsa-lib \
    at-spi2-core \
    musl \
    cairo \
    cups-libs \
    dbus-libs \
    libdrm \
    expat \
    mesa-gbm \
    glib \
    nspr \
    nss \
    pango \
    libstdc++ \
    eudev-libs \
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
    libxtst

RUN apk update && apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip

# Remove these lines
# && ln -sf /usr/bin/python3 /usr/bin/python \
# && python3 -m ensurepip \
# && pip3 install --no-cache-dir --upgrade pip setuptools

# Instead, use apk to install Python packages
RUN apk add --no-cache py3-setuptools

# Install yt-dlp in a virtual environment
RUN python3 -m venv /opt/venv \
    && . /opt/venv/bin/activate \
    && pip install --no-cache-dir --upgrade yt-dlp

# Install project dependencies
RUN npm install

# Build the application
RUN npm run build

# Expose the port the app runs on (if needed)
# EXPOSE 8080

# Command to run the application
CMD ["npm", "start"]

# Docker build command:
# docker build --build-arg -t telegram-video-bot .

# Docker run command:
# docker run -d --name telegram-video-bot -e BOT_TOKEN=your_bot_token_here telegram-video-bot

# Note: Replace 'your_bot_token_here' with your actual Telegram bot token when running the container