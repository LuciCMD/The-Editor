const v2 = require('../utils/componentsV2');
const reminders = require('../utils/reminders');

const OK_COLOR = 0xFF0000;
const ERROR_COLOR = 0xFF0000;

module.exports = {
    data: {
        name: 'cancelreminder',
        description: 'Cancel a reminder',
        options: [
            { name: 'id', type: 4, description: 'The ID of the reminder to cancel', required: true }
        ]
    },

    async execute(interaction) {
        const reminderId = interaction.options.getInteger('id');
        try {
            const result = await reminders.cancelReminder(reminderId, interaction.user.id);
            if (!result.ok) {
                const body = result.reason === 'forbidden'
                    ? "You don't have permission to cancel this reminder."
                    : 'Reminder not found.';
                return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body }) });
            }
            return v2.reply(interaction, {
                components: v2.infoPanel({ color: OK_COLOR, heading: 'Reminder Cancelled', body: `The reminder "${result.title}" has been cancelled.` })
            });
        } catch (error) {
            console.error('Error cancelling reminder:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body: 'An error occurred while cancelling the reminder.' }) });
        }
    }
};
