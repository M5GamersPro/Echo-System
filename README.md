# Echo System

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/Discord.js-14-5865F2?style=for-the-badge&logo=discord" alt="Discord.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas_or_Local-4EA94B?style=for-the-badge&logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />

  <h3>A complete Discord bot for moderation, security, automation, and community management.</h3>

</div>

Echo System is a feature-rich Discord bot built to help communities run smoothly and securely. It combines moderation tools, anti-nuke protection, welcome systems, ticketing, giveaways, level tracking, and custom emoji support into one polished package.

## Why Echo System?

Whether you're running a small gaming community or a large Discord server, Echo System gives you the tools to:

- Keep your server safe with automated moderation and anti-raid / anti-nuke protections
- Manage support tickets and community communication efficiently
- Reward activity with leveling, rankings, and leaderboards
- Handle giveaways, server automation, and welcome flows
- Customize the experience with prefixes, aliases, and Discord-ready assets

## Features

### Security & Moderation

- Warning and strike tracking
- Timeout, kick, and ban commands
- Bulk message cleanup
- Channel locking, hiding, and visibility controls
- Role and user whitelisting
- Anti-raid and anti-nuke protection
- Audit-friendly log configuration

### Community Management

- Ticket system with category and support role configuration
- Welcome channel and welcome message customization
- Giveaway creation and early end support
- Prefix customization per server
- Alias and shortcut support for commands
- Temporary voice channel setup

### Economy & Growth

- EchoSR wallet system
- Daily reward claims
- Wallet transfers and rate display
- Leveling and XP tracking
- Leaderboards for text and voice activity
- Rank cards and activity summaries

### Utility & Customization

- Canvas-based profile and server cards
- Role and server information commands
- Avatar and user lookup tools
- Custom emoji generation support
- Flexible `.env` configuration

## Requirements

Before you run the bot, make sure you have:

- Node.js 20 or newer
- npm
- MongoDB database (local or MongoDB Atlas)
- A Discord bot token
- A Discord application with the correct bot permissions

## Quick Start

1. Clone the repository

```bash
git clone https://github.com/M5GamersPro/Echo-System
cd Echo-System
```

2. Install dependencies

```bash
npm install
```

3. Create your environment file

Create a `.env` file in the project root and add your values:

```env
DISCORD_TOKEN=your_bot_token
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=echo_system
BOT_OWNER_IDS=your_discord_user_id
DEFAULT_PREFIX=+
```

> Never commit or share your `.env` file. Keep it private.

4. Build and run the bot

```bash
npm run build
npm start
```

For development mode:

```bash
npm run dev
```

## Recommended Discord Settings

In the Discord Developer Portal, enable:

- Message Content Intent
- Server Members Intent

When inviting the bot, give it the permissions needed for the features you enable, such as:

- View Channels
- Send Messages
- Manage Messages
- Kick Members
- Ban Members
- Manage Roles
- View Audit Log
- Read Message History

## Project Structure

```text
Enzo-System-By-M5/
├── assets/
│   └── emojis/
├── scripts/
├── src/
├── test/
├── .env.example
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.json
└── dist/
```

## Main Configuration

The bot is configured through environment variables and server-level settings. The default prefix can be changed with `DEFAULT_PREFIX`, and server admins can change the prefix later with commands like:

```text
+setprefix !
```

You can also seed initial bot owners with a comma-separated list in `BOT_OWNER_IDS`.

## Command Highlights

Here are some of the most useful commands included in the system:

### General & Utility

```text
+help
+id @member
+serverid
+avatar @member
+server
+roles
+calc 2+2
+snipe
```

### Moderation

```text
+warn @member spam
+warns @member
+removewarn 12
+timeout @member 10m spam
+kick @member reason
+ban @member reason
+clear 50
+lock
+unlock
+hide
+show
+setlogs #channel
+logs
+whitelist add @user
+whitelist list
+whitelist remove @user
```

### Tickets & Community

```text
+ticketpanel
+ticketteam
+ticketrole @role
+ticketcategory category-name
+greet #channel
+greetmsg Welcome {user} to {server}!
+giveaway 1h 2 Nitro
+endgiveaway 123
```

### Leveling & Economy

```text
+balance
+daily
+pay @member 100
+rank
+topxp
+setlevelchannel #channel
```

### Security Features

```text
+antiraid on 8 10 alert
+antinuke on 3 20 alert
+whitelist add @role
```

## Custom Emojis

Echo System includes support for a custom emoji pack. To generate the emoji assets:

```bash
npm run emojis:build
```

Then upload the generated PNGs from `assets/emojis` to your Discord server, keeping the expected names like:

- `echo_core`
- `echo_coin`
- `echo_tickets`

## Notes

- `+convert` shows a reference rate for EchoSR and ProBot credits; it does not move or verify real ProBot credits.
- Premium features are placeholders pending payment-provider integration.
- Anti-raid and anti-nuke systems are disabled by default until configured.
- The bot attempts to create database indexes automatically at startup.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file 


## Support

For issues, feature requests, or questions, use the GitHub repository issues tab or contact the maintainer on the project page.

---

Built with TypeScript, Discord.js, MongoDB, and Canvas for modern Discord server automation.

M5
EnzoCord
