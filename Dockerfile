# Use an official Node.js runtime as the base image
FROM node:22-alpine

# Setup Alpine repositories and update system
RUN apk update && apk upgrade && \
    echo "@edge http://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
    echo "@edgecommunity http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories && \
    echo "@testing http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories && \
    apk update

# Install basic dependencies
RUN apk add --no-cache \
    ca-certificates \
    ffmpeg \
    python3 \
    py3-pip \
    py3-setuptools

# Install X11 dependencies
RUN apk add --no-cache \
    libx11 \
    libxcb \
    libxcomposite \
    libxcursor \
    libxdamage \
    libxext \
    libxfixes \
    libxi \
    libxrandr \
    libxrender \
    libxtst \
    libxscrnsaver \
    libxft \
    libxinerama

# Install additional required libraries
RUN apk add --no-cache \
    libuuid \
    libxkbcommon \
    libxshmfence

# Install Chromium separately
RUN apk add --no-cache chromium@edge

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
COPY patches ./patches

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