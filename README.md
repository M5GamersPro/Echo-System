# Echo System

<div align="center">
  <img width="1408" height="768" alt="watermark-removed-image_bd5a9662" src="https://github.com/user-attachments/assets/c209009c-d8fc-4e68-9e0b-12347abeea24" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/Discord.js-14-5865F2?style=for-the-badge&logo=discord" alt="Discord.js" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas_or_Local-4EA94B?style=for-the-badge&logo=mongodb" alt="MongoDB" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />

  <h3>A complete Discord bot for moderation, security, automation, and community management.</h3>

</div>

Echo System is a feature-rich Discord bot built to help communities run smoothly and securely. It combines moderation tools, anti-nuke protection, welcome systems, ticketing, giveaways, level tracking, and custom emoji support into one polished package.

##  Echo System

Echo System is a self-hosted, prefix-command Discord bot built with TypeScript, Discord.js, MongoDB, and Canvas. It provides configurable moderation and event logs, five-type ticket panels, giveaways, temporary voice rooms, EchoSR wallets, leveling, and activity leaderboards.

> This project is independently developed and is not affiliated with or endorsed by Discord or ProBot.

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Discord setup](#discord-setup)
- [Commands](#command-guide)
- [Development](#development)
- [Data and limitations](#data-and-limitations)

## Features

- Moderation tools, warnings, and configurable security protections
- Per-category event logs, including moderation, members, messages, invites, giveaways, and tickets
- Ticket panels with five configurable types, support roles, welcome messages, images, and transcripts
- Giveaways with enter/leave buttons and event logging
- Temporary voice rooms with owner controls
- EchoSR wallets, message leveling, Canvas cards, and Egypt-time activity leaderboards
- Server-specific prefixes, command aliases, and custom Echo emoji support

## Requirements

- Node.js 20 or newer and npm
- A MongoDB server or MongoDB Atlas database
- A Discord application with a bot user and token

## Getting started

1. Clone or download this repository, then open a terminal in the project folder (`echoss`).
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a `.env` file in the project root and fill in the values described under [Configuration](#configuration).
4. Configure the Discord application and invite the bot as described under [Discord setup](#discord-setup).
5. Build and start the bot:

   ```sh
   npm run build
   npm start
   ```

For development with automatic restarts, use `npm run dev`. This bot uses prefix commands; slash-command registration is not required.

## Configuration

The bot loads environment variables from `.env` at startup.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | — | Bot token from the Discord Developer Portal. Keep it private. |
| `MONGODB_URI` | No | `mongodb://127.0.0.1:27017` | MongoDB connection URI. |
| `MONGODB_DATABASE` | No | `echo_system` | Database name used by the bot. |
| `BOT_OWNER_IDS` | No | Empty | Comma-separated Discord user IDs allowed to use owner commands. |
| `DEFAULT_PREFIX` | No | `$` | Prefix for servers before they save a custom prefix. |

Example `.env`:

```env
DISCORD_TOKEN=your_bot_token
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=echo_system
BOT_OWNER_IDS=your_discord_user_id
DEFAULT_PREFIX=+
```

For Atlas, set `MONGODB_URI` to your Atlas connection string. The database user needs the built-in `readWrite` role on the database named by `MONGODB_DATABASE`. The bot attempts to create indexes at startup; if index creation is denied, it continues with a warning, but missing indexes can reduce performance or uniqueness protection.

**Never commit or share `.env` or your bot token.** If a token is exposed, reset it in the Developer Portal immediately.

## Discord setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications), add a bot user, and copy its token into `.env`.
2. In **Bot → Privileged Gateway Intents**, enable **Message Content Intent** and **Server Members Intent**. Invite events use the Guild Invites gateway intent in the bot code and do not require a separate privileged-intent toggle.
3. Under **OAuth2 → URL Generator**, select the `bot` scope and invite the bot to your server.
4. Grant only the permissions for the features you intend to use. Common permissions include **View Channels**, **Send Messages**, **Embed Links**, and **Read Message History**. Depending on enabled modules, the bot may also need **Manage Messages**, **Manage Channels**, **Manage Server** (invite-create logging), **Move Members**, **Manage Roles**, **Moderate Members**, **Kick Members**, **Ban Members**, or **View Audit Log**.
5. Place the bot's role above roles it needs to manage. Discord's role hierarchy still applies to moderation, role, and channel actions.

Some permissions are feature-specific: temporary voice needs **Manage Channels** and **Move Members**; transcript export needs ticket-history access and **Attach Files** in the transcript destination; anti-nuke audit checks need **View Audit Log**.

## Prefix and help

The fallback prefix is `$`. Set `DEFAULT_PREFIX` for servers without a saved prefix, or use `+setprefix !` to change a server's prefix (replace `+` with that server's current prefix). `+help` opens the interactive command categories. Choose **Nadeko** for a directory of the commands currently implemented across all modules, including moderation, utilities, tickets, and economy. The bot uses the prefix saved for each server.

In the examples below, replace `+` with your server's current prefix. A command that takes `#channel` accepts a channel mention; commands that take `@member` accept a user mention.

## Command guide

### General and Canvas

| Command | Purpose |
| --- | --- |
| `+id [@member]` / `+whois` | Render a Canvas user ID card. |
| `+serverid` / `+guildid` | Render a Canvas server ID card. |
| `+avatar [@member]` | Show an avatar. |
| `+server` | Show server details. |
| `+roles` | List server roles. |
| `+calc <expression>` | Calculate basic arithmetic. |
| `+snipe` | Show the latest deleted text message in this channel. |

Canvas is also used for rank and activity leaderboard cards.

### Moderation and administration

| Command | Purpose |
| --- | --- |
| `+warn @member <reason>` | Add a warning. |
| `+warns @member` | View recent warnings. |
| `+removewarn <warning-id>` | Remove a warning. |
| `+resetwarns @member` | Clear a member’s warnings; Administrator required. |
| `+timeout @member <10m|2h|1d> [reason]` / `+prison` | Timeout a member. |
| `+kick @member [reason]`, `+ban @member [reason]` | Remove a member. |
| `+unban <user-id|mention> [reason]` | Unban a user; Ban Members permission required. |
| `+clear <1-100>` | Bulk-delete recent messages. |
| `+lock`, `+unlock`, `+hide`, `+show` | Change channel access. |
| `+say <message>` | Send a message without triggering mentions. |
| `+setprefix <prefix>` | Change this server’s prefix; Manage Server required. |
| `+setlogs <category> #channel|off` | Set or disable a category log channel. Categories include `moderation`, `members`, `messages`, `security`, `giveaways`, `invites`, `tickets`, and `transcripts`. |
| `+logs` | Show the configured channel for each log category. |

Each log category can be routed to a different channel. For example, use `+setlogs moderation #mod-logs` and `+setlogs giveaways #giveaway-logs`. Events are sent as timestamped embeds with the server name and icon. `+setlogs <category> off` disables that category; categories without a configured channel use the bot console unless the legacy shared log channel is still configured. `+logs` shows each category's current destination.

New invite links are logged in the `invites` category with their creator, channel, maximum uses, and expiry. The bot needs **Manage Server** permission in the guild for these events.

### Tickets, greetings, and giveaways

| Command | Purpose |
| --- | --- |
| `+ticketsetup #category1 #category2 #category3 #category4 #category5` | Set all five ticket categories and post a separate panel for each type. |
| `+ticketpanel [1|2|3|4|5]` | Post separate panels for all ticket types, or only the selected type. |
| `+ticketteam` | Post separate Arabic panels for all five ticket types. |
| `+ticketpaneltext [1|2|3|4|5] <message|off>` | Set shared panel text, or set/clear text for one type. Repost panels to apply changes. |
| `+ticketbutton <1|2|3|4|5> <text|off>` | Set or reset a ticket type’s button label (up to 80 characters). Post a new panel to apply it. |
| `+ticketrole <1|2|3|4|5> @role|off` | Set or clear the support role for a ticket type. The selected role is mentioned when that type opens. |
| `+ticketcategory <1|2|3|4|5> <category-id>` | Set the Discord parent category for one of the five ticket types. |
| `+ticketwelcome <1|2|3|4|5> <message|off>` | Set or clear a type’s opening message. Supports `{user}`, `{server}`, and `{category}`. |
| `+ticketimage <1|2|3|4|5> <https-image-url|off>` | Set or clear a type’s opening embed image. |
| `+greet #channel` | Set the welcome channel. |
| `+greetmsg <message>` | Set the welcome text; supports `{user}`, `{server}`, and `{memberCount}`. |
| `+greetdel <0-60>`, `+greetshow` | Configure or view greeting settings. |
| `+giveaway <duration> <winners> <prize>` | Start a giveaway with Enter and Leave buttons, e.g. `+giveaway 1h 2 Nitro`. |
| `+endgiveaway <id>` / `+gend` | End a giveaway early. |

Giveaway creation, entries, exits, and results are sent to the configured event-log channel as embeds.

Ticket panels are posted separately for each of the five types, so each panel can have its own text, button label, Discord parent category, support role, opening message, and image. Use `+ticketpanel 1` through `+ticketpanel 5` to repost one panel, or `+ticketpanel` to repost them all. Support staff can claim and unclaim tickets from the ticket controls; ticket openings, claims, unclaims, and closures go to the `tickets` log category. On close, up to the latest 1,000 messages and attachment links are exported as a `.txt` transcript (capped at 1 MB) to the `transcripts` log category. Configure the destinations with `+setlogs tickets #ticket-logs` and `+setlogs transcripts #transcript-logs`. The bot needs permission to view ticket history and attach files in the transcript destination.

### EchoSR and leveling

EchoSR is an internal wallet currency. `+convert` displays the reference rate **1 EchoSR = 40,000 ProBot credits**; it does not send or verify real ProBot credits.

| Command | Purpose |
| --- | --- |
| `+balance [@member]` / `+bal` | View an EchoSR wallet. |
| `+daily` | Claim 1 EchoSR once every 24 hours. |
| `+pay @member <amount>` | Transfer EchoSR to another member. |
| `+convert [amount]` / `+rate` | Display the reference conversion. |
| `+add echosr @member <amount>` | Add EchoSR; Manage Server required. |
| `+rank [@member]` / `+level` | Render a Canvas rank card. |
| `+topxp` / `+levels` | Show the XP leaderboard. |
| `+setlevelchannel #channel`, `+setlevelchannel off` | Route level-up notifications to a chosen channel or back to the source channel. |

XP is awarded for eligible messages with a one-minute per-user cooldown.

### Activity leaderboards

Daily and weekly windows use `Africa/Cairo`: daily stats begin at Cairo midnight; weekly stats begin Monday at Cairo midnight. Voice activity accumulates only while the bot is online. Combined scores equal text-message count plus voice minutes.

| Command | Shortcut | Ranking |
| --- | --- | --- |
| `+topday` | `+tday` | Combined activity today |
| `+topweek` | `+tweek` | Combined activity this week |
| `+topdaytext` | `+tday text` | Today’s text messages |
| `+topdayvoice` | `+tday voice` | Today’s voice minutes |
| `+topweektext` | `+tweek text` | This week’s text messages |
| `+topweekvoice` | `+tweek voice` | This week’s voice minutes |

### Temporary voice

Use `+tempvoice setup #join-to-create [category]` to configure the trigger, `+tempvoice status` to inspect it, and `+tempvoice off` to disable it. Members joining the trigger are moved into a room named for them; the room is deleted when empty. Each room gets a control embed in its voice-channel chat with controls to lock/unlock, hide/show, rename, set a user limit, claim an abandoned room, transfer ownership, allow/block a user, and disconnect a member. Ownership transfers automatically to a remaining room member if the owner leaves. Room owners and members with **Manage Channels** can use the controls. The bot needs **Manage Channels**, **Move Members**, **Send Messages**, **Embed Links**, and **Read Message History**.

### Owners and shortcuts

Seed initial owners with comma-separated Discord user IDs in `BOT_OWNER_IDS`. Owners can add another owner using `+addowner @user`. Owner shortcuts are server-specific:

```text
+alias tdaytext topdaytext
+aliases
+unalias tdaytext
```

Shortcuts can target registered commands and cannot replace built-in names.

### Security

Whitelist a user or role with `+whitelist add @user-or-role`; inspect with `+whitelist list`; remove with `+whitelist remove @user-or-role`.

Anti-raid and anti-nuke are disabled by default. Example configuration:

```text
+antiraid on 8 10 alert
+antinuke on 3 20 alert
```

Anti-raid can use `timeout` instead of `alert`; anti-nuke can use `strip` to remove selected privileged roles after its threshold. Anti-nuke requires **View Audit Log**; `strip` also requires **Manage Roles**. These protections monitor configured event thresholds and cannot restore deleted channels or roles.

## Echo custom emojis

Run `npm run emojis:build`, then upload the generated PNGs from `assets/emojis` to each server. Keep names such as `echo_core`, `echo_coin`, and `echo_tickets`; the bot finds uploaded emojis by name. Without them, the bot uses text labels.

## Development

```sh
npm run dev
npm run build
npm test
```

Run `npm run emojis:build` to generate the Echo emoji PNG pack in `assets/emojis`; see [Echo custom emojis](#echo-custom-emojis) for how to use it in a server.

## Data and limitations

Premium is a placeholder until a payment provider is configured. ProBot credits are not transferred by this bot; `+convert` only displays a reference value. The Nadeko help entry is a directory of Echo System's implemented commands; it does not indicate full Nadeko feature parity or use Nadeko's original code.

EnzoCord
