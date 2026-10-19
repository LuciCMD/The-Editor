// Handles the reminder modal submit and the per-reminder cancel buttons
// (customId prefix "reminder").

const v2 = require('../utils/componentsV2');
const reminders = require('../utils/reminders');
const reminderCommand = require('../commands/reminder');

const OK_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;

async function handleCreateModal(interaction) {
    const title = interaction.fields.getTextInputValue('title');
    const description = interaction.fields.getTextInputValue('description');
    const dateStr = interaction.fields.getTextInputValue('date');
    const timeStr = interaction.fields.getTextInputValue('time');
    const timezoneStr = interaction.fields.getTextInputValue('timezone');

    try {
        const result = await reminders.createReminder({
            client: interaction.client,
            guildId: interaction.guild.id,
            creatorId: interaction.user.id,
            title,
            description,
            dateStr,
            timeStr,
            timezoneStr
        });
        return v2.reply(interaction, { components: reminderCommand.confirmationPanel(title, description, result) });
    } catch (error) {
        const body = error.userMessage || 'An error occurred while creating the reminder.';
        if (!error.userMessage) {
            console.error('Error creating reminder from modal:', error);
        }
        return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body }) });
    }
}

async function handleCancel(interaction, reminderId) {
    if (Number.isNaN(reminderId)) {
        return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body: 'Invalid reminder id.' }) });
    }
    try {
        const result = await reminders.cancelReminder(reminderId, interaction.user.id);
        if (!result.ok) {
            const body = result.reason === 'forbidden'
                ? "You don't have permission to cancel this reminder."
                : 'Reminder not found (it may have already fired or been cancelled).';
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body }) });
        }
        return v2.reply(interaction, {
            ephemeral: true,
            components: v2.infoPanel({ color: OK_COLOR, heading: 'Reminder Cancelled', body: `Cancelled **${result.title}**.` })
        });
    } catch (error) {
        console.error('Error cancelling reminder:', error);
        return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body: 'An error occurred while cancelling the reminder.' }) });
    }
}

module.exports = {
    id: 'reminder',
    async execute(interaction) {
        const parts = (interaction.customId || '').split(':');
        const action = parts[1];

        if (interaction.isModalSubmit() && action === 'create') {
            return handleCreateModal(interaction);
        }
        if (interaction.isButton() && action === 'cancel') {
            return handleCancel(interaction, parseInt(parts[2], 10));
        }
    }
};
