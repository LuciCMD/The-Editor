const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const v2 = require('../utils/componentsV2');
const reminders = require('../utils/reminders');

const OK_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;

function buildReminderModal() {
    const input = (id, label, style, required, placeholder) => new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(style)
            .setRequired(required)
            .setPlaceholder(placeholder)
    );

    return new ModalBuilder()
        .setCustomId('reminder:create')
        .setTitle('Create a Reminder')
        .addComponents(
            input('title', 'Title', TextInputStyle.Short, true, 'Dentist appointment'),
            input('description', 'Description', TextInputStyle.Paragraph, true, 'What is this reminder for?'),
            input('date', 'Date (MM-DD-YY)', TextInputStyle.Short, true, '06-15-26'),
            input('time', 'Time (22:30 or 6pm)', TextInputStyle.Short, true, '8pm'),
            input('timezone', 'Timezone (EST, PST, -5, ...) — optional', TextInputStyle.Short, false, 'EST')
        );
}

function confirmationPanel(title, description, result) {
    const lines = [
        `**${title}**`,
        description,
        '',
        `🕒 **When:** <t:${result.triggerTime}:F> (<t:${result.triggerTime}:R>)`
    ];
    if (result.interval) {
        lines.push(`🔁 **Repeats:** every ${result.interval.value} ${result.interval.unit}` +
            ` (${result.repeatCount === 0 ? '∞' : result.repeatCount} times)`);
    } else {
        lines.push('🔁 **Type:** one-time');
    }
    if (result.taggedUserIds.length > 1) {
        lines.push(`👥 **Tags:** ${result.taggedUserIds.map(id => `<@${id}>`).join(', ')}`);
    }
    return v2.infoPanel({
        color: OK_COLOR,
        heading: 'Reminder Created',
        body: lines.join('\n')
    });
}

module.exports = {
    confirmationPanel,
    data: {
        name: 'reminder',
        description: 'Set a reminder (run with no options to open a form)',
        options: [
            { name: 'title', type: 3, description: 'Title of the reminder', required: false },
            { name: 'description', type: 3, description: 'Description of the reminder', required: false },
            { name: 'date', type: 3, description: 'Date (MM-DD-YY)', required: false },
            { name: 'time', type: 3, description: 'Time (24h: 22:30 or 12h: 6pm)', required: false },
            { name: 'timezone', type: 3, description: 'Timezone (EST, PST, UTC, or offset like -5). Default UTC', required: false },
            { name: 'interval', type: 3, description: 'Repeat interval (e.g. "1d", "2h", "30m")', required: false },
            { name: 'repeats', type: 4, description: 'Times to repeat (0 = infinite)', required: false },
            { name: 'users', type: 3, description: 'Extra users to tag (comma-separated IDs, authorized only)', required: false }
        ]
    },

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const dateStr = interaction.options.getString('date');
        const timeStr = interaction.options.getString('time');

        // No core args supplied -> open the guided form instead of erroring.
        if (!title && !description && !dateStr && !timeStr) {
            return interaction.showModal(buildReminderModal());
        }

        try {
            const result = await reminders.createReminder({
                client: interaction.client,
                guildId: interaction.guild.id,
                creatorId: interaction.user.id,
                title,
                description,
                dateStr,
                timeStr,
                timezoneStr: interaction.options.getString('timezone'),
                intervalStr: interaction.options.getString('interval'),
                repeats: interaction.options.getInteger('repeats'),
                usersStr: interaction.options.getString('users')
            });
            return v2.reply(interaction, { components: confirmationPanel(title, description, result) });
        } catch (error) {
            const body = error.userMessage || 'An error occurred while creating the reminder.';
            if (!error.userMessage) {
                console.error('Error creating reminder:', error);
            }
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminder', body }) });
        }
    }
};
