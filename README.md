## Running the Bot locally

1. Make sure you install `node` and `npm` first. You can download Node.js from [here](https://nodejs.org/en/download/).

2. Run once before start to install dependencies:

```bash
npm install
```

3. To run the bot from command line, make sure to set the `BOT_TOKEN` environment variable.

```bash
BOT_TOKEN=your_bot_token_here; npm run start
```

```powershell
$env:BOT_TOKEN="your_bot_token_here"; npm run start
```

OR you can do this by updating the variables in the `.env` file in the project folder and then running:

```bash
npm run start
```

## Docker

To build and run the bot using Docker, use the following commands:

```bash
docker build -t telegram-video-bot .
docker run -d --name telegram-video-bot -e BOT_TOKEN=your_bot_token_here telegram-video-bot
```
