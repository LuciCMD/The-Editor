const path = require('path');
const { EmbedBuilder } = require('@discordjs/builders');
const fs = require('fs');
const dbManager = require('../database/dbManager');
const { addCalendarInZone } = require('../utils/timezone');

// Check for due reminders every minute.
const CHECK_INTERVAL = 60 * 1000; // 1 minute in milliseconds

// How late a recurring reminder may be and still be sent. Within this window a
// reminder counts as "on time" (e.g. caught on the next 60s tick, or after a
// quick restart). Beyond it, the occurrence is treated as missed-during-downtime
// and skipped (the user chose: skip to the next future occurrence).
const SEND_GRACE_SECONDS = 5 * 60;

// Safety cap for the next-trigger advance loop (Power of Ten rule 2). One tick of
// the smallest practical interval (1 minute) for ~2 years of downtime.
const MAX_ADVANCE_ITERATIONS = 1100000;

module.exports = {
    name: 'ready',
    execute: async (client) => {
        console.log('Starting reminder checker...');
        setInterval(() => {
            checkReminders(client).catch(err => console.error('Reminder check failed:', err));
        }, CHECK_INTERVAL);
    }
};

function isRecurring(reminder) {
    return reminder.interval_value > 0 && reminder.interval_unit !== 'once';
}

async function checkReminders(client) {
    if (!client) {
        return;
    }
    const now = Math.floor(Date.now() / 1000);
    const db = dbManager.getDatabase('reminders_db');

    const reminders = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM reminders WHERE next_trigger <= ?", [now], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });

    for (const reminder of reminders) {
        try {
            await processReminder(client, db, reminder, now);
        } catch (error) {
            console.error(`Error processing reminder ${reminder.id}:`, error);
        }
    }
}

async function processReminder(client, db, reminder, now) {
    const recurring = isRecurring(reminder);
    const lateness = now - reminder.next_trigger;

    // One-time reminders always fire once (even if late) then are deleted.
    // Recurring reminders only fire if within the grace window; occurrences
    // missed during downtime are skipped.
    const shouldSend = !recurring || lateness <= SEND_GRACE_SECONDS;

    if (shouldSend) {
        const channelRow = await getReminderChannel(db, reminder.guild_id);
        if (channelRow) {
            const userIds = await getReminderUsers(db, reminder.id);
            await sendReminder(client, channelRow.channel_id, userIds, reminder)
                .catch(err => console.error(`Error sending reminder ${reminder.id}:`, err));
        } else {
            console.error(`No channel found for reminder ${reminder.id}`);
        }
    } else {
        console.log(`Skipping missed occurrence of reminder ${reminder.id} (${lateness}s late).`);
    }

    await advanceOrDeleteReminder(db, reminder, recurring, shouldSend);
}

function getReminderUsers(db, reminderId) {
    return new Promise((resolve, reject) => {
        db.all("SELECT user_id FROM reminder_users WHERE reminder_id = ?", [reminderId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve((rows || []).map(row => row.user_id));
            }
        });
    });
}

function getReminderChannel(db, guildId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT channel_id FROM reminder_settings WHERE guild_id = ?", [guildId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

async function sendReminder(client, channelId, userIds, reminder) {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
    }

    const mentions = userIds.map(userId => `<@${userId}>`).join(' ');

    const embed = new EmbedBuilder()
        .setTitle(`Reminder: ${reminder.title}`)
        .setDescription(reminder.description || '​')
        .setColor(0xFF9900)
        .setThumbnail('attachment://reminder.png')
        .setTimestamp();

    const reminderImagePath = path.join(__dirname, '..', 'assets', 'reminder.png');
    const files = fs.existsSync(reminderImagePath)
        ? [{ attachment: reminderImagePath, name: 'reminder.png' }]
        : [];

    await channel.send({ content: mentions, embeds: [embed], files });
    return true;
}

// Update or delete a reminder after it has been processed. A repeat is only
// consumed when the reminder was actually sent, so downtime never burns the
// user's remaining notifications.
async function advanceOrDeleteReminder(db, reminder, recurring, wasSent) {
    if (!recurring) {
        return deleteReminder(db, reminder.id);
    }

    const nextTrigger = calculateNextTrigger(reminder);
    let remaining = reminder.remaining_repeats;
    if (remaining !== null && wasSent) {
        remaining = remaining - 1;
    }

    if (remaining !== null && remaining <= 0) {
        return deleteReminder(db, reminder.id);
    }

    console.log(`Reminder ${reminder.id}: next trigger ${new Date(nextTrigger * 1000).toISOString()}, ` +
        `repeats left: ${remaining === null ? 'infinite' : remaining}`);

    return new Promise((resolve, reject) => {
        db.run(
            "UPDATE reminders SET next_trigger = ?, remaining_repeats = ? WHERE id = ?",
            [nextTrigger, remaining, reminder.id],
            (err) => {
                if (err) {
                    console.error(`Error updating reminder ${reminder.id}:`, err);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

function deleteReminder(db, reminderId) {
    console.log(`Deleting reminder ${reminderId} - no more occurrences.`);
    return new Promise((resolve, reject) => {
        db.run("DELETE FROM reminders WHERE id = ?", [reminderId], (err) => {
            if (err) {
                console.error(`Error deleting reminder ${reminderId}:`, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Advance the trigger from its scheduled anchor (NOT from "now") until it lands
// in the future. Anchoring to next_trigger eliminates drift; stepping past now
// skips occurrences missed during downtime.
//
// minutes/hours are fixed durations (DST-irrelevant) and computed directly.
// days/months advance in the reminder's timezone so a "daily 8pm" reminder stays
// at 8pm local across daylight-saving transitions.
function calculateNextTrigger(reminder) {
    const now = Math.floor(Date.now() / 1000);
    const value = reminder.interval_value;
    const unit = reminder.interval_unit;
    const zone = reminder.timezone || 'UTC';

    if (unit === 'minutes' || unit === 'hours') {
        const step = (unit === 'minutes' ? 60 : 3600) * value;
        let trigger = reminder.next_trigger + step;
        if (trigger <= now) {
            const missed = Math.ceil((now - reminder.next_trigger) / step);
            trigger = reminder.next_trigger + missed * step;
            if (trigger <= now) {
                trigger += step;
            }
        }
        return trigger;
    }

    // Calendar units: iterate (bounded). Even years of downtime is only hundreds
    // of day-steps.
    let trigger = reminder.next_trigger;
    let iterations = 0;
    do {
        trigger = addCalendarInZone(trigger, unit, value, zone);
        iterations++;
        if (iterations >= MAX_ADVANCE_ITERATIONS) {
            return addCalendarInZone(now, unit, value, zone);
        }
    } while (trigger <= now);

    return trigger;
}
