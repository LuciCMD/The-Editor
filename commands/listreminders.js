const { EmbedBuilder } = require('@discordjs/builders');
const path = require('path');
const dbManager = require('../database/dbManager');

module.exports = {
    data: {
        name: 'listreminders',
        description: 'List all reminders you have created',
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Connect to the database
        const db = dbManager.getDatabase('reminders_db');

        // Get all reminders created by the user in this guild
        db.all(
            "SELECT * FROM reminders WHERE creator_id = ? AND guild_id = ? ORDER BY next_trigger ASC",
            [userId, guildId],
            (err, rows) => {
                if (err) {
                    console.error(err);
                    db.close();
                    return interaction.reply({
                        content: "An error occurred while fetching your reminders.",
                        ephemeral: true
                    });
                }

                if (rows.length === 0) {
                    db.close();
                    return interaction.reply("You don't have any reminders set in this server.");
                }

                const reminderPath = 'attachment://reminder.png';
                const embed = new EmbedBuilder()
                    .setTitle("Your Reminders")
                    .setColor(0x00FF00)
                    .setThumbnail(reminderPath);

                // Process each reminder to show detailed information
                const processReminders = async () => {
                    for (const reminder of rows) {
                        const nextDate = new Date(reminder.next_trigger * 1000);
                        const repeatsLeft = reminder.remaining_repeats === null ? "∞" : reminder.remaining_repeats;

                        // Get users who will be tagged for this reminder
                        const users = await new Promise((resolve) => {
                            db.all("SELECT user_id FROM reminder_users WHERE reminder_id = ?",
                                [reminder.id], (err, userRows) => {
                                    if (err) {
                                        console.error(err);
                                        resolve([]);
                                    } else {
                                        resolve(userRows.map(row => row.user_id));
                                    }
                                });
                        });

                        // Create user mentions string if there are users to tag
                        let userMentions = "";
                        if (users.length > 0) {
                            userMentions = "\n**Will Tag:** " + users.map(userId => `<@${userId}>`).join(", ");
                        }

                        // Add interval information if this is a repeating reminder
                        let intervalInfo = "";
                        if (reminder.interval_value && reminder.interval_unit) {
                            intervalInfo = `\n**Repeats:** Every ${reminder.interval_value} ${reminder.interval_unit}`;
                            intervalInfo += `\n**Repeats Left:** ${repeatsLeft}`;
                        } else {
                            intervalInfo = "\n**One-time reminder**";
                        }

                        embed.addFields({
                            name: `${reminder.title} (ID: ${reminder.id})`,
                            value: `${reminder.description}` +
                                `\n**Next Trigger:** ${nextDate.toLocaleString()}` +
                                `${intervalInfo}` +
                                `${userMentions}`
                        });
                    }

                    interaction.reply({
                        embeds: [embed],
                        files: [path.join(__dirname, '..', 'assets', 'reminder.png')]
                    });

                    db.close();
                };

                processReminders();
            }
        );
    }
};