# Echo System

Echo System is a prefix-based Discord server bot built with Discord.js, TypeScript, MongoDB, and Canvas. It includes moderation, tickets, giveaways, EchoSR wallets, leveling, Egypt-time activity boards, temporary voice rooms, and server-specific configuration.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB server or MongoDB Atlas database
- A Discord application and bot token

## Install and configure

From the `echoss` folder, install dependencies:

```powershell
npm install
```

Create a private `.env` file in the project root with your own values:

```env
DISCORD_TOKEN=your_bot_token
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=echo_system
BOT_OWNER_IDS=your_discord_user_id
DEFAULT_PREFIX=+
```

For Atlas, put your Atlas connection string in `MONGODB_URI`. The database user needs the built-in `readWrite` role on the database named by `MONGODB_DATABASE`. Never commit or share `.env`.

In the Discord Developer Portal, enable **Message Content Intent** and **Server Members Intent**. Invite the bot with the permissions needed for the features you enable: View Channels, Send Messages, Embed Links, Read Message History, Manage Messages, Manage Channels, Move Members, Manage Roles, Moderate Members, Kick Members, Ban Members, and View Audit Log.

Build and start the bot:

```powershell
npm run build
npm start
```

For development, run `npm run dev`. Run the tests with `npm test`. Generate the Echo emoji PNG pack with `npm run emojis:build`.

The bot attempts to create database indexes at startup. If the database user cannot create indexes, it continues with a warning; read/write access is still required, and missing indexes can reduce performance or uniqueness protection. This bot uses prefix commands and does not require slash-command registration.

## Prefix and help

The fallback prefix is `$`. Set `DEFAULT_PREFIX` in `.env` for newly configured servers, or change one server with `+setprefix !` (replace `+` with that server’s current prefix). `+help` opens the interactive command categories. The bot uses the prefix saved for each server.

In examples below, replace `+` with your server’s current prefix. A command that takes `#channel` accepts a channel mention; commands that take `@member` accept a user mention.

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
| `+timeout @member <10m|2h|1d> [reason]` | `+prison` | Timeout a member. |
| `+kick @member [reason]`, `+ban @member [reason]` | Remove a member. |
| `+clear <1-100>` | Bulk-delete recent messages. |
| `+lock`, `+unlock`, `+hide`, `+show` | Change channel access. |
| `+say <message>` | Send a message without triggering mentions. |
| `+setprefix <prefix>` | Change this server’s prefix; Manage Server required. |
| `+setlogs #channel`, `+logs`, `+setlogs off` | Configure or inspect the event-log channel. |

### Tickets, greetings, and giveaways

| Command | Purpose |
| --- | --- |
| `+ticketpanel`, `+ticketteam` | Post the standard or Arabic ticket panel. |
| `+ticketrole @role` | Set the support role. |
| `+ticketcategory <category>` | Set the parent category for new tickets. |
| `+greet #channel` | Set the welcome channel. |
| `+greetmsg <message>` | Set the welcome text; supports `{user}`, `{server}`, and `{memberCount}`. |
| `+greetdel <0-60>`, `+greetshow` | Configure or view greeting settings. |
| `+giveaway <duration> <winners> <prize>` | Start a button-entry giveaway, e.g. `+giveaway 1h 2 Nitro`. |
| `+endgiveaway <id>` / `+gend` | End a giveaway early. |

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

Use `+tempvoice setup #join-to-create [category]` to configure the trigger, `+tempvoice status` to inspect it, and `+tempvoice off` to disable it. Members joining the trigger are moved into a room named for them; the room is deleted when empty. The bot needs **Manage Channels** and **Move Members**.

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

## Scope notes

Premium is a placeholder until a payment provider is configured. ProBot credits are not transferred by this bot; `+convert` only displays a reference value. Nadeko feature parity is not complete; the implemented modules are listed above.
