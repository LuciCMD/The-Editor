// Shared reminder logic: date/time/interval parsing plus create/cancel helpers.
// Used by the /reminder command, the reminder modal handler, the cancel button,
// and /cancelreminder so the rules live in exactly one place.

const dbManager = require('../database/dbManager');
const { AUTHORIZED_USERS } = require('./config');
const { resolveZone, wallTimeToDate } = require('./timezone');

// Parse a date/time in a given timezone into an absolute UTC Date plus the
// canonical timezone string to persist. Timezone handling is DST-aware (EST in
// summer resolves to EDT, etc.) — see utils/timezone.js.
function parseDateTime(dateStr, timeStr, timezoneStr = 'UTC') {
    if (!dateStr || !timeStr) {
        throw new Error('Date and time are required');
    }
    const [month, day, year] = dateStr.split('-').map(num => parseInt(num.trim(), 10));
    if ([month, day, year].some(Number.isNaN)) {
        throw new Error('Invalid date format (use MM-DD-YY)');
    }
    const fullYear = year < 100 ? 2000 + year : year;

    let hour;
    let minute;
    const time12hMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (time12hMatch) {
        hour = parseInt(time12hMatch[1], 10);
        minute = time12hMatch[2] ? parseInt(time12hMatch[2], 10) : 0;
        const period = time12hMatch[3].toLowerCase();
        if (hour < 1 || hour > 12) {
            throw new Error('Hour must be between 1 and 12 for 12-hour format');
        }
        if (period === 'pm' && hour !== 12) {
            hour += 12;
        } else if (period === 'am' && hour === 12) {
            hour = 0;
        }
    } else {
        const timeParts = timeStr.split(':');
        if (timeParts.length !== 2) {
            throw new Error('Invalid time format');
        }
        hour = parseInt(timeParts[0], 10);
        minute = parseInt(timeParts[1], 10);
    }

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error('Invalid time values');
    }

    const zone = resolveZone(timezoneStr); // throws on invalid timezone
    const date = wallTimeToDate(fullYear, month, day, hour, minute, zone.canonical);

    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date/time');
    }
    return { date, timezone: zone.canonical };
}

function parseInterval(intervalStr) {
    if (!intervalStr) {
        return null;
    }
    const shorthandMatch = intervalStr.match(/^(\d+)\s*([dhm])$/i);
    if (shorthandMatch) {
        const value = parseInt(shorthandMatch[1], 10);
        const unit = shorthandMatch[2].toLowerCase();
        if (unit === 'd') return { value, unit: 'days' };
        if (unit === 'h') return { value, unit: 'hours' };
        if (unit === 'm') return { value, unit: 'minutes' };
    }
    const match = intervalStr.match(/^(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|day|days|month|months|mo|mos)$/i);
    if (!match) {
        return null;
    }
    const value = parseInt(match[1], 10);
    let unit = match[2].toLowerCase();
    if (unit === 'min' || unit === 'mins' || unit === 'minute') unit = 'minutes';
    if (unit === 'hr' || unit === 'hrs' || unit === 'hour') unit = 'hours';
    if (unit === 'day' || unit === 'days') unit = 'days';
    if (unit === 'mo' || unit === 'mos' || unit === 'month') unit = 'months';
    return { value, unit };
}

function getReminderChannel(guildId) {
    const db = dbManager.getDatabase('reminders_db');
    return new Promise((resolve, reject) => {
        db.get("SELECT channel_id FROM reminder_settings WHERE guild_id = ?", [guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

// Create a reminder and its tagged-users rows. Returns { reminderId, triggerTime,
// interval, repeatCount, taggedUserIds }. Throws Error with a `.userMessage` for
// problems that should be shown to the user.
async function createReminder(opts) {
    const {
        client, guildId, creatorId,
        title, description, dateStr, timeStr,
        timezoneStr, intervalStr, repeats, usersStr
    } = opts;

    if (!title || !description || !dateStr || !timeStr) {
        throw withMessage(new Error('missing fields'), 'Title, description, date and time are all required.');
    }

    let reminderDate;
    let timezone;
    try {
        ({ date: reminderDate, timezone } = parseDateTime(dateStr, timeStr, timezoneStr));
    } catch (error) {
        throw withMessage(error, `Invalid format. Use MM-DD-YY for date, 24h (22:30) or 12h (6pm) for time. ${error.message}`);
    }

    if (reminderDate <= new Date()) {
        throw withMessage(new Error('past'), 'The reminder date and time must be in the future.');
    }
    const triggerTime = Math.floor(reminderDate.getTime() / 1000);

    let interval = null;
    let repeatCount = 1;
    if (intervalStr) {
        interval = parseInterval(intervalStr);
        if (!interval) {
            throw withMessage(new Error('interval'), "Invalid interval. Use shorthand (5d, 3h, 30m) or full ('1 day', '2 hours').");
        }
        repeatCount = (repeats === undefined || repeats === null) ? 1 : repeats;
        if (repeatCount < 0) {
            throw withMessage(new Error('repeats'), 'Repeats must be 0 (infinite) or a positive number.');
        }
    }

    const channelRow = await getReminderChannel(guildId);
    if (!channelRow) {
        throw withMessage(new Error('no channel'), 'No reminder channel set for this server. An authorized user must run /sendreminder first.');
    }

    const taggedUserIds = [creatorId];
    if (usersStr) {
        if (!AUTHORIZED_USERS.includes(creatorId)) {
            throw withMessage(new Error('auth'), 'Only authorized users can set reminders for multiple users.');
        }
        for (const id of usersStr.split(',').map(s => s.trim()).filter(Boolean)) {
            try {
                if (client) {
                    await client.users.fetch(id);
                }
                taggedUserIds.push(id);
            } catch (error) {
                console.error(`Invalid user ID for reminder: ${id}`, error.message);
            }
        }
    }

    const reminderId = await insertReminder({
        guildId, creatorId, title, description, interval, repeatCount, triggerTime, timezone
    });
    await insertReminderUsers(reminderId, taggedUserIds);

    return { reminderId, triggerTime, interval, repeatCount, taggedUserIds, timezone };
}

function insertReminder({ guildId, creatorId, title, description, interval, repeatCount, triggerTime, timezone }) {
    const db = dbManager.getDatabase('reminders_db');
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT INTO reminders (title, description, interval_value, interval_unit, repeat_count, remaining_repeats, creator_id, guild_id, next_trigger, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                title,
                description,
                interval ? interval.value : 0,
                interval ? interval.unit : 'once',
                interval ? repeatCount : 1,
                interval ? (repeatCount === 0 ? null : repeatCount) : 1,
                creatorId,
                guildId,
                triggerTime,
                timezone || 'UTC'
            ],
            function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

function insertReminderUsers(reminderId, userIds) {
    const db = dbManager.getDatabase('reminders_db');
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO reminder_users (reminder_id, user_id) VALUES (?, ?)");
        for (const userId of userIds) {
            stmt.run(reminderId, userId);
        }
        stmt.finalize(err => (err ? reject(err) : resolve()));
    });
}

// Cancel a reminder if the requester is the creator or an authorized user.
// Returns { ok, reason, title }.
function cancelReminder(reminderId, requesterId) {
    const db = dbManager.getDatabase('reminders_db');
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM reminders WHERE id = ?", [reminderId], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (!row) {
                return resolve({ ok: false, reason: 'not_found' });
            }
            if (row.creator_id !== requesterId && !AUTHORIZED_USERS.includes(requesterId)) {
                return resolve({ ok: false, reason: 'forbidden', title: row.title });
            }
            db.run("DELETE FROM reminders WHERE id = ?", [reminderId], (delErr) => {
                if (delErr) {
                    reject(delErr);
                } else {
                    resolve({ ok: true, title: row.title });
                }
            });
        });
    });
}

function listReminders(creatorId, guildId) {
    const db = dbManager.getDatabase('reminders_db');
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT * FROM reminders WHERE creator_id = ? AND guild_id = ? ORDER BY next_trigger ASC",
            [creatorId, guildId],
            (err, rows) => (err ? reject(err) : resolve(rows || []))
        );
    });
}

function withMessage(error, userMessage) {
    error.userMessage = userMessage;
    return error;
}

module.exports = {
    parseDateTime,
    parseInterval,
    getReminderChannel,
    createReminder,
    cancelReminder,
    listReminders
};
