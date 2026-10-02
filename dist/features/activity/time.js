const cairoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
export function egyptDayKey(timestamp) {
    const parts = Object.fromEntries(cairoDate.formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
}
const nextMidnightByDay = new Map();
export function nextEgyptMidnight(timestamp) {
    const key = egyptDayKey(timestamp);
    const cached = nextMidnightByDay.get(key);
    if (cached !== undefined)
        return cached;
    let low = timestamp;
    let high = timestamp + 30 * 60 * 60 * 1_000;
    if (egyptDayKey(high) === key)
        throw new Error('Could not find the next Cairo day boundary.');
    while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (egyptDayKey(middle) === key)
            low = middle;
        else
            high = middle;
    }
    nextMidnightByDay.set(key, high);
    if (nextMidnightByDay.size > 10)
        nextMidnightByDay.delete(nextMidnightByDay.keys().next().value);
    return high;
}
export function egyptPeriodWindow(period, timestamp) {
    const end = egyptDayKey(timestamp);
    if (period === 'day')
        return { start: end, end };
    const [year, month, date] = end.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const monday = new Date(Date.UTC(year, month - 1, date - mondayOffset));
    const start = `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}`;
    return { start, end };
}
