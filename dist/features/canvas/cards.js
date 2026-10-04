import { createCanvas, loadImage } from '@napi-rs/canvas';
const ink = '#07111f';
const panel = '#101d30';
const teal = '#15c7b5';
const blue = '#4f8cff';
const white = '#f2f7ff';
const muted = '#a5b4c8';
function roundedBox(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
}
function paintBackground(context, width, height) {
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#0b1627');
    background.addColorStop(0.58, '#101d30');
    background.addColorStop(1, '#172841');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(125, 190, 216, 0.09)';
    context.lineWidth = 1;
    for (let x = 28; x < width; x += 36) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
}
function drawEchoMark(context, x, y, size = 42) {
    context.save();
    roundedBox(context, x, y, size, size, 13);
    const gradient = context.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, teal);
    gradient.addColorStop(1, blue);
    context.fillStyle = gradient;
    context.fill();
    context.fillStyle = ink;
    context.beginPath();
    context.arc(x + size * 0.35, y + size * 0.39, size * 0.045, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + size * 0.65, y + size * 0.39, size * 0.045, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = ink;
    context.lineWidth = Math.max(2, size * 0.055);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x + size * 0.3, y + size * 0.61);
    context.quadraticCurveTo(x + size * 0.5, y + size * 0.82, x + size * 0.7, y + size * 0.61);
    context.stroke();
    context.restore();
}
async function drawAvatar(context, avatarUrl, x, y, size) {
    context.save();
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    context.clip();
    if (avatarUrl) {
        try {
            const image = await loadImage(avatarUrl);
            context.drawImage(image, x, y, size, size);
        }
        catch {
            context.fillStyle = '#263a52';
            context.fillRect(x, y, size, size);
        }
    }
    else {
        context.fillStyle = '#263a52';
        context.fillRect(x, y, size, size);
    }
    context.restore();
    context.strokeStyle = teal;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
    context.stroke();
}
export async function renderIdCard(info) {
    const canvas = createCanvas(1120, 420);
    const context = canvas.getContext('2d');
    paintBackground(context, canvas.width, canvas.height);
    roundedBox(context, 22, 22, 1076, 376, 30);
    context.fillStyle = 'rgba(4, 13, 25, 0.68)';
    context.fill();
    drawEchoMark(context, 64, 54, 54);
    context.fillStyle = white;
    context.font = '700 27px sans-serif';
    context.fillText('ECHO IDENTITY', 132, 91);
    context.fillStyle = teal;
    context.font = '600 14px sans-serif';
    context.fillText(info.guildName?.toUpperCase() ?? 'DISCORD PROFILE', 133, 116);
    await drawAvatar(context, info.avatarUrl, 76, 158, 184);
    context.fillStyle = white;
    context.font = '700 42px sans-serif';
    context.fillText(info.displayName.slice(0, 24), 310, 214, 700);
    context.fillStyle = muted;
    context.font = '500 22px sans-serif';
    context.fillText(`@${info.username}`.slice(0, 38), 312, 254);
    context.fillStyle = teal;
    context.font = '700 14px sans-serif';
    context.fillText('USER ID', 312, 310);
    context.fillStyle = white;
    context.font = '600 21px monospace';
    context.fillText(info.id, 312, 342);
    const created = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(info.createdAt);
    context.fillStyle = muted;
    context.font = '500 16px sans-serif';
    context.fillText(`ACCOUNT CREATED  ${created}`, 740, 314);
    if (info.joinedAt)
        context.fillText(`SERVER MEMBER SINCE  ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(info.joinedAt)}`, 740, 344);
    context.fillStyle = teal;
    context.fillRect(64, 372, 992, 2);
    context.fillStyle = muted;
    context.font = '500 13px sans-serif';
    context.fillText('ECHO SYSTEM  •  VERIFIED PROFILE CARD', 66, 389);
    return canvas.toBuffer('image/png');
}
export async function renderServerIdCard(guild) {
    const canvas = createCanvas(1120, 420);
    const context = canvas.getContext('2d');
    paintBackground(context, canvas.width, canvas.height);
    roundedBox(context, 22, 22, 1076, 376, 30);
    context.fillStyle = 'rgba(4, 13, 25, 0.68)';
    context.fill();
    drawEchoMark(context, 64, 54, 54);
    context.fillStyle = white;
    context.font = '700 27px sans-serif';
    context.fillText('ECHO SERVER ID', 132, 91);
    context.fillStyle = teal;
    context.font = '600 14px sans-serif';
    context.fillText('SERVER DIRECTORY CARD', 133, 116);
    const iconUrl = guild.iconURL({ extension: 'png', size: 256 });
    await drawAvatar(context, iconUrl, 76, 158, 184);
    context.fillStyle = white;
    context.font = '700 42px sans-serif';
    context.fillText(guild.name.slice(0, 24), 310, 214, 700);
    context.fillStyle = teal;
    context.font = '700 14px sans-serif';
    context.fillText('SERVER ID', 312, 270);
    context.fillStyle = white;
    context.font = '600 21px monospace';
    context.fillText(guild.id, 312, 302);
    context.fillStyle = muted;
    context.font = '500 18px sans-serif';
    context.fillText(`${guild.memberCount.toLocaleString()} members`, 312, 340);
    context.fillText(`Created ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(guild.createdAt)}`, 610, 340);
    context.fillStyle = teal;
    context.fillRect(64, 372, 992, 2);
    context.fillStyle = muted;
    context.font = '500 13px sans-serif';
    context.fillText('ECHO SYSTEM  •  SERVER PROFILE CARD', 66, 389);
    return canvas.toBuffer('image/png');
}
export async function renderRankCard(user, xp, level, rank) {
    const canvas = createCanvas(1120, 360);
    const context = canvas.getContext('2d');
    paintBackground(context, canvas.width, canvas.height);
    roundedBox(context, 22, 22, 1076, 316, 30);
    context.fillStyle = 'rgba(4, 13, 25, 0.68)';
    context.fill();
    drawEchoMark(context, 64, 48, 48);
    context.fillStyle = white;
    context.font = '700 24px sans-serif';
    context.fillText('ECHO RANK', 126, 80);
    await drawAvatar(context, user.displayAvatarURL({ extension: 'png', size: 256 }), 76, 124, 150);
    context.fillStyle = white;
    context.font = '700 35px sans-serif';
    context.fillText(user.displayName.slice(0, 26), 270, 174, 690);
    context.fillStyle = muted;
    context.font = '600 18px sans-serif';
    context.fillText(`LEVEL ${level}   •   RANK #${rank}`, 274, 210);
    const current = xp - level * level * 100;
    const needed = (level + 1) * (level + 1) * 100 - level * level * 100;
    roundedBox(context, 274, 244, 750, 24, 12);
    context.fillStyle = '#23364b';
    context.fill();
    roundedBox(context, 274, 244, Math.max(20, 750 * Math.min(1, current / needed)), 24, 12);
    const progress = context.createLinearGradient(274, 244, 1_024, 244);
    progress.addColorStop(0, teal);
    progress.addColorStop(1, blue);
    context.fillStyle = progress;
    context.fill();
    context.fillStyle = white;
    context.font = '600 16px sans-serif';
    context.fillText(`${current.toLocaleString()} / ${needed.toLocaleString()} XP`, 274, 296);
    return canvas.toBuffer('image/png');
}
export async function renderLeaderboardCard(title, entries, identities, metric) {
    const canvas = createCanvas(1120, 740);
    const context = canvas.getContext('2d');
    paintBackground(context, canvas.width, canvas.height);
    roundedBox(context, 22, 22, 1076, 696, 30);
    context.fillStyle = 'rgba(4, 13, 25, 0.68)';
    context.fill();
    drawEchoMark(context, 64, 48, 48);
    context.fillStyle = white;
    context.font = '700 28px sans-serif';
    context.fillText(title.toUpperCase(), 126, 79);
    context.fillStyle = muted;
    context.font = '500 15px sans-serif';
    context.fillText(metric === 'totalActivity' ? 'ACTIVITY SCORE  •  MESSAGES + VOICE MINUTES' : metric === 'textMessages' ? 'TEXT MESSAGES' : 'VOICE TIME', 127, 105);
    context.fillStyle = teal;
    context.fillRect(64, 128, 992, 2);
    const identityById = new Map(identities.map(identity => [identity.id, identity.name]));
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const y = 148 + index * 53;
        roundedBox(context, 66, y, 988, 44, 13);
        context.fillStyle = index === 0 ? 'rgba(21, 199, 181, .15)' : 'rgba(255, 255, 255, .035)';
        context.fill();
        context.fillStyle = index < 3 ? teal : muted;
        context.font = '700 18px sans-serif';
        context.fillText(String(index + 1).padStart(2, '0'), 83, y + 28);
        context.fillStyle = white;
        context.font = '600 17px sans-serif';
        context.fillText((identityById.get(entry._id) ?? `User ${entry._id}`).slice(0, 30), 139, y + 28, 570);
        const value = metric === 'textMessages' ? `${entry.textMessages} messages` : metric === 'voiceSeconds' ? `${Math.floor(entry.voiceSeconds / 60)} min` : `${entry.totalActivity} pts`;
        context.textAlign = 'right';
        context.fillStyle = metric === 'totalActivity' ? teal : white;
        context.font = '700 16px sans-serif';
        context.fillText(value, 1_020, y + 28);
        context.textAlign = 'left';
    }
    if (!entries.length) {
        context.fillStyle = muted;
        context.font = '600 20px sans-serif';
        context.fillText('No activity has been recorded for this period yet.', 84, 190);
    }
    context.fillStyle = muted;
    context.font = '500 13px sans-serif';
    context.fillText('ECHO SYSTEM  •  UTC PERIOD', 68, 690);
    return canvas.toBuffer('image/png');
}
