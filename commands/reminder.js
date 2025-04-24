const { EmbedBuilder } = require('@discordjs/builders');
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');
const dbManager = require('../database/dbManager');

// Helper function to parse date and time
function parseDateTime(dateStr, timeStr) {
    // Parse MM-DD-YY format
    const [month, day, year] = dateStr.split('-').map(num => parseInt(num.trim()));
    // Parse HH:MM (24h) format
    const [hour, minute] = timeStr.split(':').map(num => parseInt(num.trim()));

    // Create Date object with 20xx year format
    const fullYear = year < 100 ? 2000 + year : year;
    const date = new Date(fullYear, month - 1, day, hour, minute, 0);

    return date;
}

// Helper function to calculate next trigger time based on last trigger and interval
function calculateNextTrigger(lastTrigger, interval) {
    // Convert lastTrigger from Unix timestamp to Date
    const lastDate = new Date(lastTrigger * 1000);
    let nextDate = new Date(lastDate);

    if (interval.unit === 'minutes') {
        nextDate.setMinutes(nextDate.getMinutes() + interval.value);
    } else if (interval.unit === 'hours') {
        nextDate.setHours(nextDate.getHours() + interval.value);
    } else if (interval.unit === 'days') {
        nextDate.setDate(nextDate.getDate() + interval.value);
    } else if (interval.unit === 'months') {
        nextDate.setMonth(nextDate.getMonth() + interval.value);
    }

    return Math.floor(nextDate.getTime() / 1000); // Convert to Unix timestamp
}

// Helper function to parse interval string
function parseInterval(intervalStr) {
    const match = intervalStr.match(/^(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs|day|days|month|months|mo|mos)$/i);
    if (!match) {
        return null;
    }

    const value = parseInt(match[1]);
    let unit = match[2].toLowerCase();

    // Normalize unit
    if (unit === 'min' || unit === 'mins' || unit === 'minute') unit = 'minutes';
    if (unit === 'hr' || unit === 'hrs' || unit === 'hour') unit = 'hours';
    if (unit === 'day' || unit === 'days') unit = 'days';
    if (unit === 'mo' || unit === 'mos' || unit === 'month') unit = 'months';

    return { value, unit };
}

module.exports = {
    data: {
        name: 'reminder',
        description: 'Set a reminder for a specific date and time',
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
                name: 'date',
                type: 3,  // STRING
                description: 'Date of the reminder (MM-DD-YY format)',
                required: true
            },
            {
                name: 'time',
                type: 3,  // STRING
                description: 'Time of the reminder (24h format, e.g., 22:30)',
                required: true
            },
            {
                name: 'interval',
                type: 3,  // STRING
                description: 'Repeat interval (e.g., "1 day", "2 hours", "30 minutes")',
                required: false
            },
            {
                name: 'repeats',
                type: 4,  // INTEGER
                description: 'Number of times to repeat (0 for infinite, omit for one-time)',
                required: false
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
        const dateStr = interaction.options.getString('date');
        const timeStr = interaction.options.getString('time');
        const intervalStr = interaction.options.getString('interval');
        const repeats = interaction.options.getInteger('repeats');
        const usersStr = interaction.options.getString('users');

        // Parse the date and time
        try {
            const reminderDate = parseDateTime(dateStr, timeStr);
            const now = new Date();

            // Ensure the date is in the future
            if (reminderDate <= now) {
                return interaction.reply({
                    content: "The reminder date and time must be in the future.",
                    ephemeral: true
                });
            }

            // Convert to Unix timestamp
            const triggerTime = Math.floor(reminderDate.getTime() / 1000);

            // Handle interval and repeats
            let interval = null;
            let repeatCount = repeats !== undefined ? repeats : 1; // Default to 1 if not specified

            if (intervalStr) {
                interval = parseInterval(intervalStr);
                if (!interval) {
                    return interaction.reply({
                        content: "Invalid interval format. Please use formats like '5 minutes', '2 hours', '1 day', or '1 month'.",
                        ephemeral: true
                    });
                }

                // If interval is provided but repeats is not, default to 1 (one-time reminder)
                if (repeats === undefined) {
                    repeatCount = 1;
                }
            } else if (repeats !== undefined) {
                // If repeats is provided but interval is not, reject with error
                return interaction.reply({
                    content: "When specifying repeats, you must also provide an interval.",
                    ephemeral: true
                });
            }

            // Check if repeats is valid
            if (repeatCount < 0) {
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

            // Connect to the database
            const db = dbManager.getDatabase('reminders_db');

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
                    [
                        title,
                        description,
                        interval ? interval.value : null,
                        interval ? interval.unit : null,
                        repeatCount,
                        repeatCount === 0 ? null : repeatCount,
                        interaction.user.id,
                        interaction.guild.id,
                        triggerTime
                    ],
                    function (err) {
                        if (err) {
                            console.error(`Error creating reminder:`, err);
                            db.close();
                            return interaction.reply({
                                content: "An error occurred while creating the reminder.",
                                ephemeral: true
                            });
                        }

                        const reminderId = this.lastID;
                        console.log(`Created new reminder ID ${reminderId} for user ${interaction.user.id}, next trigger at ${new Date(triggerTime * 1000).toISOString()}`);

                        // Add the creator to the users list
                        db.run("INSERT INTO reminder_users (reminder_id, user_id) VALUES (?, ?)", [reminderId, interaction.user.id], (err) => {
                            if (err) {
                                console.error(`Error adding creator to reminder_users:`, err);
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
                        const reminderDate = new Date(triggerTime * 1000);
                        const reminderPath = 'attachment://reminder.png';

                        const embed = new EmbedBuilder()
                            .setTitle("Reminder Created")
                            .setDescription(`**${title}**\n${description}`)
                            .addFields(
                                { name: "Date & Time", value: reminderDate.toLocaleString(), inline: true }
                            );

                        // Add interval and repeats fields if applicable
                        if (interval) {
                            embed.addFields({
                                name: "Repeats Every",
                                value: `${interval.value} ${interval.unit}`,
                                inline: true
                            });

                            embed.addFields({
                                name: "Repeat Count",
                                value: repeatCount === 0 ? "∞" : repeatCount.toString(),
                                inline: true
                            });
                        }

                        embed.setColor(0x00FF00)
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

        } catch (error) {
            console.error('Error parsing date/time:', error);
            return interaction.reply({
                content: "Invalid date or time format. Please use MM-DD-YY for date and HH:MM (24h) for time.",
                ephemeral: true
            });
        }
    }
}