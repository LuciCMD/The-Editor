const { EmbedBuilder } = require('@discordjs/builders');
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');
const dbManager = require('../database/dbManager');

module.exports = {
    data: {
        name: 'sendreminder',
        description: 'Set the channel for sending reminders (authorized users only)',
        options: [
            {
                name: 'channel',
                type: 7,  // CHANNEL
                description: 'The channel to send reminders to',
                required: true
            }
        ]
    },

    async execute(interaction) {
        // Check if user is authorized
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            return interaction.reply({ 
                content: "You are not authorized to use this command.", 
                ephemeral: true 
            });
        }

        const channel = interaction.options.getChannel('channel');

        // Check if the channel is a text channel
        if (channel.type !== 0) { // 0 is GUILD_TEXT
            return interaction.reply({ 
                content: "Please select a text channel for reminders.", 
                ephemeral: true 
            });
        }

        // Connect to the database
        const db = dbManager.getDatabase('reminders_db');

        // Update or insert the reminder settings
        db.run(
            "INSERT OR REPLACE INTO reminder_settings (guild_id, channel_id) VALUES (?, ?)",
            [interaction.guild.id, channel.id],
            function(err) {
                if (err) {
                    console.error(err);
                    db.close();
                    return interaction.reply({ 
                        content: "An error occurred while setting the reminder channel.", 
                        ephemeral: true 
                    });
                }

                const reminderPath = 'attachment://reminder.png';
                const embed = new EmbedBuilder()
                    .setTitle("Reminder Channel Set")
                    .setDescription(`Reminders will now be sent to ${channel.toString()}.`)
                    .setColor(0x00FF00)
                    .setThumbnail(reminderPath);

                interaction.reply({ 
                    embeds: [embed], 
                    files: [path.join(__dirname, '..', 'assets', 'reminder.png')] 
                });
                
                db.close();
            }
        );
    }
};