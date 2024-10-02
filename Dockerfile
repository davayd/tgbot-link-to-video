# Use an official Node.js runtime as the base image
FROM node:22-bullseye-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

# Install system dependencies
RUN apt-get update && apt-get install -y \
    "libasound2" \
    "libatk-bridge2.0-0" \
    "libatk1.0-0" \
    "libatspi2.0-0" \
    "libc6" \
    "libcairo2" \
    "libcups2" \
    "libdbus-1-3" \
    "libdrm2" \
    "libexpat1" \
    "libgbm1" \
    "libglib2.0-0" \
    "libnspr4" \
    "libnss3" \
    "libpango-1.0-0" \
    "libpangocairo-1.0-0" \
    "libstdc++6" \
    "libudev1" \
    "libuuid1" \
    "libx11-6" \
    "libx11-xcb1" \
    "libxcb-dri3-0" \
    "libxcb1" \
    "libxcomposite1" \
    "libxcursor1" \
    "libxdamage1" \
    "libxext6" \
    "libxfixes3" \
    "libxi6" \
    "libxkbcommon0" \
    "libxrandr2" \
    "libxrender1" \
    "libxshmfence1" \
    "libxss1" \
    "libxtst6" 

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    && ln -s /usr/bin/python3 /usr/bin/python

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
CMD ["node", "dist/main.js"]

# Docker build command:
# docker build --build-arg -t telegram-video-bot .

# Docker run command:
# docker run -d --name telegram-video-bot -e BOT_TOKEN=your_bot_token_here telegram-video-bot

# Note: Replace 'your_bot_token_here' with your actual Telegram bot token when running the container