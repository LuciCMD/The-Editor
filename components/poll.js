// Handles poll vote button clicks (customId "poll:vote:<pollId>:<optionIndex>").

const v2 = require('../utils/componentsV2');
const polls = require('../utils/polls');
const pollCommand = require('../commands/poll');

const ERROR_COLOR = 0xFF0000;

module.exports = {
    id: 'poll',
    async execute(interaction) {
        const parts = (interaction.customId || '').split(':');
        if (parts[1] !== 'vote') {
            return;
        }
        const pollId = parseInt(parts[2], 10);
        const optionIndex = parseInt(parts[3], 10);
        if (Number.isNaN(pollId) || Number.isNaN(optionIndex)) {
            return;
        }

        try {
            const poll = await polls.getPoll(pollId);
            if (!poll || poll.options.length === 0) {
                return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Poll', body: 'This poll is no longer available.' }) });
            }

            await polls.toggleVote(pollId, interaction.user.id, optionIndex);
            const counts = await polls.getCounts(pollId, poll.options.length);
            return v2.update(interaction, { components: pollCommand.buildPollPanel(pollId, poll.question, poll.options, counts) });
        } catch (error) {
            console.error('Error handling poll vote:', error);
            return v2.reply(interaction, { ephemeral: true, components: v2.infoPanel({ color: ERROR_COLOR, heading: 'Poll', body: 'An error occurred while recording your vote.' }) });
        }
    }
};
