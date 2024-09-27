## Setup

Before running the bot, make sure to create a `cookies.txt` file in the project folder. This file is necessary for authentication with certain websites.

To create the `cookies.txt` file:

1. You can use the `--cookies-from-browser` option of yt-dlp to extract cookies from your browser. For example:

   ```bash
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt
   ```

   This will extract cookies from Chrome and save them to `cookies.txt`.

2. Alternatively, you can use browser extensions like "Get cookies.txt LOCALLY" for Chrome or "cookies.txt" for Firefox to export your cookies.

For more detailed information on creating and using the cookies file, refer to the [yt-dlp FAQ on passing cookies](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp).

Remember to keep your `cookies.txt` file secure and do not share it, as it contains sensitive information.

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
