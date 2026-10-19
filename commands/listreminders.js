const v2 = require('../utils/componentsV2');
const reminders = require('../utils/reminders');

const INFO_COLOR = 0x00FF00;
const ERROR_COLOR = 0xFF0000;
const MAX_SHOWN = 10;

function reminderText(reminder) {
    const lines = [
        `**${reminder.title}** \`#${reminder.id}\``,
        reminder.description || '',
        `🕒 <t:${reminder.next_trigger}:F> (<t:${reminder.next_trigger}:R>)`
    ];
    if (reminder.interval_value && reminder.interval_unit !== 'once') {
        const left = reminder.remaining_repeats === null ? '∞' : reminder.remaining_repeats;
        lines.push(`🔁 every ${reminder.interval_value} ${reminder.interval_unit} • ${left} left`);
    } else {
        lines.push('🔁 one-time');
    }
    return lines.filter(Boolean).join('\n');
}

module.exports = {
    data: {
        name: 'listreminders',
        description: 'List the reminders you have created'
    },

    async execute(interaction) {
        let rows;
        try {
            rows = await reminders.listReminders(interaction.user.id, interaction.guild.id);
        } catch (error) {
            console.error('Error listing reminders:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Reminders', body: 'An error occurred while fetching your reminders.' }) });
        }

        if (rows.length === 0) {
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: INFO_COLOR, heading: 'Your Reminders', body: "You don't have any reminders set in this server." }) });
        }

        const components = [v2.textDisplay('## Your Reminders')];
        const shown = rows.slice(0, MAX_SHOWN);
        for (const reminder of shown) {
            components.push(v2.separator());
            components.push(v2.section({
                texts: [reminderText(reminder)],
                accessoryButton: v2.button({
                    id: `reminder:cancel:${reminder.id}`,
                    label: 'Cancel',
                    style: v2.ButtonStyle.Danger,
                    emoji: '🗑️'
                })
            }));
        }
        if (rows.length > MAX_SHOWN) {
            components.push(v2.separator());
            components.push(v2.textDisplay(`…and ${rows.length - MAX_SHOWN} more. Cancel some to see the rest.`));
        }

        return v2.reply(interaction, {
            ephemeral: true,
            components: v2.container({ color: INFO_COLOR, components })
        });
    }
};
