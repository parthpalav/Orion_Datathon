const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function mumbaiTime(date = new Date()) {
    const iso = new Date(date.getTime() + IST_OFFSET_MS).toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 16), hour: Number(iso.slice(11, 13)) };
}

export function mumbaiDate(date: string, time = '00:00') {
    return new Date(`${date}T${time}:00+05:30`);
}
