import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const emojiDesigns = [
  { name: 'core', colors: ['#11B5AE', '#2364AA'], mark: '<path d="M35 63h9l5-13 8 27 8-27 7 27 7-14h9"/>' },
  { name: 'owner', colors: ['#7C3AED', '#EC4899'], mark: '<path d="m35 51 13 10 16-20 16 20 13-10-6 28H41z"/><path d="M43 84h34"/>' },
  { name: 'system', colors: ['#0F766E', '#22C55E'], mark: '<circle cx="64" cy="64" r="21"/><circle cx="64" cy="64" r="8"/><path d="M64 31v9m0 48v9M31 64h9m48 0h9M41 41l7 7m32 32 7 7m0-46-7 7m-32 32-7 7"/>' },
  { name: 'moderation', colors: ['#E11D48', '#8B5CF6'], mark: '<path d="M64 35 88 44v17c0 16-11 27-24 33-13-6-24-17-24-33V44z"/><path d="m52 63 8 8 17-18"/>' },
  { name: 'general', colors: ['#2563EB', '#14B8A6'], mark: '<path d="M39 47h50v34H59L46 91V81h-7z"/><circle cx="53" cy="64" r="2"/><circle cx="64" cy="64" r="2"/><circle cx="75" cy="64" r="2"/>' },
  { name: 'admin', colors: ['#334155', '#84CC16'], mark: '<path d="M64 39v50M39 64h50"/><circle cx="64" cy="64" r="25"/>' },
  { name: 'premium', colors: ['#4338CA', '#F59E0B'], mark: '<path d="m40 48 12-11h24l12 11-24 39zM40 48h48M52 37l12 50 12-50"/>' },
  { name: 'giveaways', colors: ['#DB2777', '#F97316'], mark: '<path d="M42 57h44v31H42zM38 48h52v12H38zM64 48v40"/><path d="M64 48c-18 0-18-18-7-18 8 0 7 18 7 18zm0 0c18 0 18-18 7-18-8 0-7 18-7 18z"/>' },
  { name: 'greet', colors: ['#0284C7', '#22C55E'], mark: '<path d="M39 45h50v36H62L46 91V81h-7z"/><path d="M51 63h2m9 0h2m9 0h2"/>' },
  { name: 'tickets', colors: ['#0E7490', '#34D399'], mark: '<path d="M40 45h48v12a9 9 0 0 0 0 18v12H40V75a9 9 0 0 0 0-18z"/><path d="M64 48v6m0 8v6m0 8v6"/>' },
  { name: 'warning', colors: ['#EA580C', '#FACC15'], mark: '<path d="m64 34 31 56H33z"/><path d="M64 52v17m0 9v1"/>' },
  { name: 'locked', colors: ['#475569', '#38BDF8'], mark: '<rect x="42" y="54" width="44" height="34" rx="6"/><path d="M51 54v-8a13 13 0 0 1 26 0v8m-13 13v9"/>' },
  { name: 'kick', colors: ['#7C2D12', '#FB923C'], mark: '<path d="M39 73c11 0 17-7 20-20l18 6 3 15 11 7v8H39z"/><path d="M48 82h7m8 0h7"/>' },
  { name: 'ban', colors: ['#991B1B', '#F87171'], mark: '<circle cx="64" cy="64" r="28"/><path d="m44 44 40 40"/>' },
  { name: 'clean', colors: ['#4D7C0F', '#2DD4BF'], mark: '<path d="m47 40 41 41-11 11-41-41zM48 67l-9 9m22-21 8-9"/><path d="m85 34 2 8 8 2-8 2-2 8-2-8-8-2 8-2zm-44 3 1 5 5 1-5 1-1 5-1-5-5-1 5-1z"/>' },
  { name: 'calculator', colors: ['#1D4ED8', '#A78BFA'], mark: '<rect x="43" y="34" width="42" height="60" rx="6"/><path d="M51 43h26v11H51z"/><circle cx="54" cy="65" r="2"/><circle cx="64" cy="65" r="2"/><circle cx="74" cy="65" r="2"/><circle cx="54" cy="78" r="2"/><circle cx="64" cy="78" r="2"/><circle cx="74" cy="78" r="2"/>' },
  { name: 'ping', colors: ['#0369A1', '#67E8F9'], mark: '<path d="M36 55a40 40 0 0 1 56 0M46 66a25 25 0 0 1 36 0M56 77a11 11 0 0 1 16 0"/><circle cx="64" cy="88" r="3"/>' },
  { name: 'coin', colors: ['#0F766E', '#FACC15'], mark: '<circle cx="64" cy="64" r="29"/><path d="M73 50c-3-4-8-6-14-4-11 3-11 13-1 17l12 4c11 4 10 15-1 19-7 2-15 0-19-5m14-41v48"/>' },
] as const;

function createSvg(name: string, colors: readonly [string, string], mark: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs><linearGradient id="shell" x1="12" y1="8" x2="116" y2="120" gradientUnits="userSpaceOnUse"><stop stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient><filter id="shadow" x="4" y="4" width="120" height="120" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="3"/></filter></defs>
    <rect x="17" y="16" width="94" height="100" rx="34" fill="#050816" opacity=".35" filter="url(#shadow)"/>
    <path d="M64 8c6 0 10 4 10 10v4h12c16 0 28 12 28 28v42c0 16-12 28-28 28H42c-16 0-28-12-28-28V50c0-16 12-28 28-28h12v-4c0-6 4-10 10-10z" fill="url(#shell)" stroke="#F8FAFC" stroke-width="5" stroke-linejoin="round"/>
    <path d="M45 56c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7zm24 0c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z" fill="#F8FAFC"/>
    <path d="M47 77c5 7 11 10 17 10s12-3 17-10" fill="none" stroke="#F8FAFC" stroke-width="5" stroke-linecap="round"/>
    <circle cx="94" cy="94" r="25" fill="#07111F" stroke="#F8FAFC" stroke-width="4"/>
    <g fill="none" stroke="#F8FAFC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${mark}</g>
    <title>Echo ${name} custom emoji</title>
  </svg>`;
}

const outputDirectory = path.resolve('assets', 'emojis');
await mkdir(outputDirectory, { recursive: true });
for (const design of emojiDesigns) {
  const svg = createSvg(design.name, design.colors, design.mark);
  await sharp(Buffer.from(svg)).resize(128, 128).png({ compressionLevel: 9 }).toFile(path.join(outputDirectory, `echo_${design.name}.png`));
}
console.log(`Generated ${emojiDesigns.length} Echo custom emojis in ${outputDirectory}`);
