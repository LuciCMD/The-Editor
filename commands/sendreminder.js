const { AUTHORIZED_USERS } = require('../utils/config');
const dbManager = require('../database/dbManager');
const v2 = require('../utils/componentsV2');

const OK_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;

function panel(interaction, color, heading, body) {
    return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color, heading, body }) });
}

module.exports = {
    data: {
        name: 'sendreminder',
        description: 'Set the channel for sending reminders (authorized users only)',
        options: [
            { name: 'channel', type: 7, description: 'The channel to send reminders to', required: true }
        ]
    },

    async execute(interaction) {
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            return panel(interaction, ERROR_COLOR, 'Reminders', 'You are not authorized to use this command.');
        }

        const channel = interaction.options.getChannel('channel');
        if (channel.type !== 0) { // 0 = GUILD_TEXT
            return panel(interaction, ERROR_COLOR, 'Reminders', 'Please select a text channel for reminders.');
        }

        const db = dbManager.getDatabase('reminders_db');
        db.run(
            "INSERT OR REPLACE INTO reminder_settings (guild_id, channel_id) VALUES (?, ?)",
            [interaction.guild.id, channel.id],
            (err) => {
                if (err) {
                    console.error('Error setting reminder channel:', err);
                    return panel(interaction, ERROR_COLOR, 'Reminders', 'An error occurred while setting the reminder channel.');
                }
                return panel(interaction, OK_COLOR, 'Reminder Channel Set', `Reminders will now be sent to ${channel.toString()}.`);
            }
        );
    }
};
