// passives/reminderChecker.js
const path = require('path');
const { EmbedBuilder } = require('@discordjs/builders');
const fs = require('fs');
const dbManager = require('../database/dbManager');

// Check for due reminders every minute
const CHECK_INTERVAL = 60 * 1000; // 1 minute in milliseconds

module.exports = {
    name: 'ready', // This will run when the bot is ready
    execute: async (client) => {
        console.log('Starting reminder checker...');
        
        // Set up interval to check for reminders
        setInterval(() => {
            checkReminders(client);
        }, CHECK_INTERVAL);
    }
};

function checkReminders(client) {
    const now = Math.floor(Date.now() / 1000); // Current time as Unix timestamp
    
    // Connect to the database
    const db = dbManager.getDatabase('reminders_db');
    
    // Get all reminders that should be triggered
    db.all("SELECT * FROM reminders WHERE next_trigger <= ?", [now], (err, reminders) => {
        if (err) {
            console.error('Error checking reminders:', err);
            db.close();
            return;
        }
        
        if (!reminders || reminders.length === 0) {
            db.close();
            return;
        }
        
        // Process each reminder
        let processed = 0;
        for (const reminder of reminders) {
            // Get users to tag
            db.all("SELECT user_id FROM reminder_users WHERE reminder_id = ?", [reminder.id], (err, userRows) => {
                if (err) {
                    console.error(`Error getting users for reminder ${reminder.id}:`, err);
                    checkIfDone();
                    return;
                }
                
                const userIds = userRows.map(row => row.user_id);
                
                // Get channel to send to
                db.get("SELECT channel_id FROM reminder_settings WHERE guild_id = ?", [reminder.guild_id], (err, channelRow) => {
                    if (err || !channelRow) {
                        console.error(`Error getting channel for reminder ${reminder.id}:`, err || "No channel found");
                        // Still need to update/delete the reminder even if we can't send it
                        updateReminder(db, reminder, checkIfDone);
                        return;
                    }
                    
                    // Send the reminder
                    sendReminder(client, channelRow.channel_id, userIds, reminder)
                        .then(() => {
                            // Update or delete the reminder
                            updateReminder(db, reminder, checkIfDone);
                        })
                        .catch(error => {
                            console.error(`Error sending reminder ${reminder.id}:`, error);
                            updateReminder(db, reminder, checkIfDone);
                        });
                });
            });
        }
        
        function checkIfDone() {
            processed++;
            if (processed === reminders.length) {
                db.close();
            }
        }
    });
}

async function sendReminder(client, channelId, userIds, reminder) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            throw new Error(`Channel ${channelId} not found`);
        }
        
        // Create mentions string
        const mentions = userIds.map(userId => `<@${userId}>`).join(' ');
        
        const reminderPath = 'attachment://reminder.png';
        
        // Create the embed
        const embed = new EmbedBuilder()
            .setTitle(`Reminder: ${reminder.title}`)
            .setDescription(reminder.description)
            .setColor(0xFF9900)
            .setThumbnail(reminderPath)
            .setTimestamp();
        
        // Check if reminder.png exists and create a fallback if it doesn't
        const reminderImagePath = path.join(__dirname, '..', 'assets', 'reminder.png');
        let files = [];
        
        try {
            if (fs.existsSync(reminderImagePath)) {
                files = [reminderImagePath];
            }
        } catch (err) {
            console.error('Error checking for reminder.png:', err);
        }
        
        await channel.send({ 
            content: mentions, 
            embeds: [embed],
            files: files.length > 0 ? [{ attachment: files[0], name: 'reminder.png' }] : []
        });
        
        return true;
    } catch (error) {
        console.error(`Error sending reminder to channel ${channelId}:`, error);
        return false;
    }
}

function updateReminder(db, reminder, callback) {
    // Determine if we should update or delete the reminder
    if (reminder.repeat_count === 0 || (reminder.remaining_repeats !== null && reminder.remaining_repeats > 1)) {
        // Calculate the next trigger time
        const nextTrigger = calculateNextTrigger(reminder);
        const remaining = reminder.remaining_repeats === null ? null : reminder.remaining_repeats - 1;
        
        db.run(
            "UPDATE reminders SET next_trigger = ?, remaining_repeats = ? WHERE id = ?",
            [nextTrigger, remaining, reminder.id],
            (err) => {
                if (err) {
                    console.error(`Error updating reminder ${reminder.id}:`, err);
                }
                if (callback) callback();
            }
        );
    } else {
        // Delete the reminder if it's the last repeat
        db.run("DELETE FROM reminders WHERE id = ?", [reminder.id], (err) => {
            if (err) {
                console.error(`Error deleting reminder ${reminder.id}:`, err);
            }
            if (callback) callback();
        });
    }
}

function calculateNextTrigger(reminder) {
    const now = Math.floor(Date.now() / 1000);
    let nextDate = new Date(now * 1000);
    
    if (reminder.interval_unit === 'minutes') {
        nextDate.setMinutes(nextDate.getMinutes() + reminder.interval_value);
    } else if (reminder.interval_unit === 'hours') {
        nextDate.setHours(nextDate.getHours() + reminder.interval_value);
    } else if (reminder.interval_unit === 'months') {
        nextDate.setMonth(nextDate.getMonth() + reminder.interval_value);
    }
    
    return Math.floor(nextDate.getTime() / 1000);
}