const { EmbedBuilder } = require('@discordjs/builders');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');

// Helper function to parse interval string
function parseInterval(intervalStr) {
    const match = intervalStr.match(/^(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|month|months|mo|mos)$/i);
    if (!match) {
        return null;
    }

    const value = parseInt(match[1]);
    let unit = match[2].toLowerCase();

    // Normalize unit
    if (unit === 'min' || unit === 'mins' || unit === 'minute') unit = 'minutes';
    if (unit === 'hr' || unit === 'hrs' || unit === 'hour') unit = 'hours';
    if (unit === 'mo' || unit === 'mos' || unit === 'month') unit = 'months';

    return { value, unit };
}

// Helper function to calculate next trigger time
function calculateNextTrigger(interval) {
    const now = Date.now();
    let nextTrigger = new Date(now);

    if (interval.unit === 'minutes') {
        nextTrigger.setMinutes(nextTrigger.getMinutes() + interval.value);
    } else if (interval.unit === 'hours') {
        nextTrigger.setHours(nextTrigger.getHours() + interval.value);
    } else if (interval.unit === 'months') {
        nextTrigger.setMonth(nextTrigger.getMonth() + interval.value);
    }

    return Math.floor(nextTrigger.getTime() / 1000); // Convert to Unix timestamp
}

module.exports = {
    data: {
        name: 'reminder',
        description: 'Set a reminder with optional repeats',
        options: [
            {
                name: 'title',
                type: 3,  // STRING
                description: 'Title of the reminder',
                required: true
            },
            {
                name: 'description',
                type: 3,  // STRING
                description: 'Description of the reminder',
                required: true
            },
            {
                name: 'interval',
                type: 3,  // STRING
                description: 'Time interval (e.g., "5 minutes", "2 hours", "1 month")',
                required: true
            },
            {
                name: 'repeats',
                type: 4,  // INTEGER
                description: 'Number of times to repeat (0 for infinite)',
                required: true
            },
            {
                name: 'users',
                type: 3,  // STRING
                description: 'Additional users to tag (comma-separated IDs, authorized users only)',
                required: false
            }
        ]
    },

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const intervalStr = interaction.options.getString('interval');
        const repeats = interaction.options.getInteger('repeats');
        const usersStr = interaction.options.getString('users');

        // Parse interval
        const interval = parseInterval(intervalStr);
        if (!interval) {
            return interaction.reply({ 
                content: "Invalid interval format. Please use formats like '5 minutes', '2 hours', or '1 month'.", 
                ephemeral: true 
            });
        }

        // Check if repeats is valid
        if (repeats < 0) {
            return interaction.reply({ 
                content: "Repeats must be 0 (for infinite) or a positive number.", 
                ephemeral: true 
            });
        }

        // Process additional users (only for authorized users)
        const additionalUsers = [];
        if (usersStr && AUTHORIZED_USERS.includes(interaction.user.id)) {
            const userIds = usersStr.split(',').map(id => id.trim());
            for (const userId of userIds) {
                try {
                    const user = await interaction.client.users.fetch(userId);
                    additionalUsers.push(userId);
                } catch (error) {
                    console.error(`Invalid user ID: ${userId}`, error);
                }
            }
        } else if (usersStr && !AUTHORIZED_USERS.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: "Only authorized users can set reminders for multiple users.", 
                ephemeral: true 
            });
        }

        // Calculate next trigger time
        const nextTrigger = calculateNextTrigger(interval);

        // Connect to the database
        const dbPath = path.join(__dirname, '..', 'database', 'reminders_db.sqlite');
        const db = new sqlite3.Database(dbPath);

        // Check if reminder_settings exists for this guild
        db.get("SELECT channel_id FROM reminder_settings WHERE guild_id = ?", [interaction.guild.id], (err, row) => {
            if (err) {
                console.error(err);
                db.close();
                return interaction.reply({ 
                    content: "An error occurred while checking reminder settings.", 
                    ephemeral: true 
                });
            }

            if (!row) {
                db.close();
                return interaction.reply({ 
                    content: "No reminder channel set for this server. An authorized user must use /sendreminder to set one.", 
                    ephemeral: true 
                });
            }

            // Insert the reminder
            db.run(
                "INSERT INTO reminders (title, description, interval_value, interval_unit, repeat_count, remaining_repeats, creator_id, guild_id, next_trigger) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [title, description, interval.value, interval.unit, repeats, repeats === 0 ? null : repeats, interaction.user.id, interaction.guild.id, nextTrigger],
                function(err) {
                    if (err) {
                        console.error(err);
                        db.close();
                        return interaction.reply({ 
                            content: "An error occurred while creating the reminder.", 
                            ephemeral: true 
                        });
                    }

                    const reminderId = this.lastID;

                    // Add the creator to the users list
                    db.run("INSERT INTO reminder_users (reminder_id, user_id) VALUES (?, ?)", [reminderId, interaction.user.id], (err) => {
                        if (err) {
                            console.error(err);
                        }
                    });

                    // Add additional users if any
                    for (const userId of additionalUsers) {
                        db.run("INSERT INTO reminder_users (reminder_id, user_id) VALUES (?, ?)", [reminderId, userId], (err) => {
                            if (err) {
                                console.error(err);
                            }
                        });
                    }

                    // Format the response
                    const nextDate = new Date(nextTrigger * 1000);
                    const reminderPath = 'attachment://reminder.png';

                    const embed = new EmbedBuilder()
                        .setTitle("Reminder Created")
                        .setDescription(`**${title}**\n${description}`)
                        .addFields(
                            { name: "Interval", value: `${interval.value} ${interval.unit}`, inline: true },
                            { name: "Repeats", value: repeats === 0 ? "∞" : repeats.toString(), inline: true },
                            { name: "Next Trigger", value: nextDate.toLocaleString(), inline: true }
                        )
                        .setColor(0x00FF00)
                        .setThumbnail(reminderPath)
                        .setFooter({ text: `Reminder ID: ${reminderId}` });

                    interaction.reply({ 
                        embeds: [embed], 
                        files: [path.join(__dirname, '..', 'assets', 'reminder.png')] 
                    });
                    
                    db.close();
                }
            );
        });
    }
};