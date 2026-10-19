// DST-aware timezone handling using the built-in Intl API (no dependencies).
//
// Fixed abbreviations like "EST = -5" are wrong half the year (EDT = -4 in
// summer). We map common abbreviations to IANA zones (e.g. America/New_York),
// which the Intl engine resolves with the correct DST offset for the *specific*
// date. Plain numeric offsets (-5, +5:30) are still supported as fixed offsets.

const ABBREV_TO_IANA = {
    ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
    CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
    MT: 'America/Denver', MST: 'America/Denver', MDT: 'America/Denver',
    PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
    AKST: 'America/Anchorage', AKDT: 'America/Anchorage',
    HST: 'Pacific/Honolulu',
    BST: 'Europe/London', WET: 'Europe/Lisbon', WEST: 'Europe/Lisbon',
    CET: 'Europe/Paris', CEST: 'Europe/Paris',
    EET: 'Europe/Athens', EEST: 'Europe/Athens',
    JST: 'Asia/Tokyo',
    AEST: 'Australia/Sydney', AEDT: 'Australia/Sydney',
    ACST: 'Australia/Adelaide', ACDT: 'Australia/Adelaide',
    AWST: 'Australia/Perth',
    NZST: 'Pacific/Auckland', NZDT: 'Pacific/Auckland'
};

function isValidIana(zone) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch (error) {
        return false;
    }
}

// Resolve a user/stored timezone string into { kind, ...canonical }.
// kind 'utc' | 'iana' (zone) | 'offset' (minutes). `canonical` is the stable
// string we persist and can re-resolve later.
function resolveZone(input) {
    if (!input || input.trim() === '') {
        return { kind: 'utc', canonical: 'UTC' };
    }
    const trimmed = input.trim();
    const upper = trimmed.toUpperCase();

    if (upper === 'UTC' || upper === 'GMT' || upper === 'Z') {
        return { kind: 'utc', canonical: 'UTC' };
    }
    if (ABBREV_TO_IANA[upper]) {
        return { kind: 'iana', zone: ABBREV_TO_IANA[upper], canonical: ABBREV_TO_IANA[upper] };
    }

    const numericMatch = trimmed.match(/^([+-]?)(\d{1,2})(?::?(\d{2}))?$/);
    if (numericMatch) {
        const sign = numericMatch[1] === '-' ? -1 : 1;
        const hours = parseInt(numericMatch[2], 10);
        const minutes = numericMatch[3] ? parseInt(numericMatch[3], 10) : 0;
        const total = sign * (hours * 60 + minutes);
        const hh = String(Math.floor(Math.abs(total) / 60)).padStart(2, '0');
        const mm = String(Math.abs(total) % 60).padStart(2, '0');
        return { kind: 'offset', minutes: total, canonical: `${total < 0 ? '-' : '+'}${hh}:${mm}` };
    }

    if (isValidIana(trimmed)) {
        return { kind: 'iana', zone: trimmed, canonical: trimmed };
    }
    throw new Error('Invalid timezone format');
}

// Offset (ms) between UTC and the IANA zone at a given instant.
function ianaOffsetMs(zone, date) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = {};
    for (const part of dtf.formatToParts(date)) {
        parts[part.type] = part.value;
    }
    const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUTC - (Math.floor(date.getTime() / 1000) * 1000);
}

// Convert a wall-clock time in a zone to a UTC Date (DST-aware).
function wallTimeToDate(year, month, day, hour, minute, zoneStr) {
    const info = resolveZone(zoneStr);
    const guess = Date.UTC(year, month - 1, day, hour, minute, 0);

    if (info.kind === 'utc') {
        return new Date(guess);
    }
    if (info.kind === 'offset') {
        return new Date(guess - info.minutes * 60000);
    }
    // IANA: two passes so we settle on the right side of a DST transition.
    let offset = ianaOffsetMs(info.zone, new Date(guess));
    let ts = guess - offset;
    offset = ianaOffsetMs(info.zone, new Date(ts));
    ts = guess - offset;
    return new Date(ts);
}

// Convert a UTC epoch (seconds) to the wall-clock fields in a zone.
function dateToWall(epochSeconds, zoneStr) {
    const info = resolveZone(zoneStr);
    const date = new Date(epochSeconds * 1000);

    if (info.kind === 'utc' || info.kind === 'offset') {
        const shifted = new Date(date.getTime() + (info.kind === 'offset' ? info.minutes * 60000 : 0));
        return {
            year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
            hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes()
        };
    }
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: info.zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    const parts = {};
    for (const part of dtf.formatToParts(date)) {
        parts[part.type] = part.value;
    }
    return {
        year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
        hour: Number(parts.hour), minute: Number(parts.minute)
    };
}

// Advance an epoch by a calendar interval, keeping the same local wall-clock time
// in the zone (so a daily 8pm reminder stays 8pm across DST changes). For days
// and months only — fixed durations (minutes/hours) don't need this.
function addCalendarInZone(epochSeconds, unit, value, zoneStr) {
    const wall = dateToWall(epochSeconds, zoneStr);
    if (unit === 'days') {
        wall.day += value;
    } else if (unit === 'months') {
        wall.month += value;
    }
    return Math.floor(wallTimeToDate(wall.year, wall.month, wall.day, wall.hour, wall.minute, zoneStr).getTime() / 1000);
}

module.exports = { resolveZone, wallTimeToDate, dateToWall, addCalendarInZone };
