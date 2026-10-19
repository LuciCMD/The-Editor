const v2 = require('../utils/componentsV2');
const polls = require('../utils/polls');

const POLL_COLOR = 0x3498DB;
const ERROR_COLOR = 0xFF0000;
const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const BAR_SEGMENTS = 12;
const MAX_LABEL = 30;

function bar(fraction) {
    const filled = Math.round(fraction * BAR_SEGMENTS);
    return '▰'.repeat(filled) + '▱'.repeat(BAR_SEGMENTS - filled);
}

function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Shared by the command (initial render) and the vote handler (live updates).
function buildPollPanel(pollId, question, options, counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    const lines = [`## 📊 ${question}`, ''];
    options.forEach((option, i) => {
        const count = counts[i] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        lines.push(`${NUMBER_EMOJI[i]} **${option}**`);
        lines.push(`${bar(total > 0 ? count / total : 0)} ${count} vote${count === 1 ? '' : 's'} (${pct}%)`);
    });
    lines.push('', `*${total} total vote${total === 1 ? '' : 's'} • click again to remove your vote*`);

    const components = [v2.textDisplay(lines.join('\n')), v2.separator()];
    for (let start = 0; start < options.length; start += 5) {
        const rowButtons = options.slice(start, start + 5).map((option, idx) => v2.button({
            id: `poll:vote:${pollId}:${start + idx}`,
            label: truncate(option, MAX_LABEL),
            emoji: NUMBER_EMOJI[start + idx]
        }));
        components.push(v2.buttonRow(rowButtons));
    }

    return v2.container({ color: POLL_COLOR, components });
}

module.exports = {
    buildPollPanel,
    data: {
        name: 'poll',
        description: 'Create a poll with a question and options',
        options: [
            { name: 'question', type: 3, description: 'The poll question', required: true },
            { name: 'options', type: 3, description: 'Options separated by commas (e.g. red,green,blue)', required: true }
        ]
    },

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = interaction.options.getString('options')
            .split(',')
            .map(o => o.trim())
            .filter(Boolean);

        if (options.length < 2) {
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Poll', body: 'You need at least 2 options for a poll!' }) });
        }
        if (options.length > NUMBER_EMOJI.length) {
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Poll', body: `You can have at most ${NUMBER_EMOJI.length} options.` }) });
        }

        try {
            const pollId = await polls.createPoll(interaction.guild.id, interaction.channelId, question, options, interaction.user.id);
            const counts = new Array(options.length).fill(0);
            const message = await v2.reply(interaction, { components: buildPollPanel(pollId, question, options, counts) });
            if (message && message.id) {
                await polls.setPollMessageId(pollId, message.id).catch(err => console.error('setPollMessageId:', err.message));
            }
        } catch (error) {
            console.error('Error creating poll:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Poll', body: 'An error occurred while creating the poll.' }) });
        }
    }
};
