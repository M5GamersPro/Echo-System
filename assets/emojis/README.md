# Echo Custom Emoji Pack

The PNGs in this folder are original Echo System emoji artwork. Generate or refresh them with `npm run emojis:build`, then upload the PNGs to each Discord server where you want the custom marks to appear. Keep the filenames: the bot resolves emojis by names such as `echo_core`, `echo_ticket`, and `echo_giveaways`.

Discord does not let a bot create server emojis globally. Upload them in **Server Settings → Emojis** (Manage Expressions permission required). If a server has not uploaded an emoji, the bot uses a text label instead of a standard Unicode emoji.
