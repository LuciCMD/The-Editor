const { EmbedBuilder } = require('@discordjs/builders');

module.exports = {
    data: {
        name: 'poll',
        description: 'Create a poll with a question and options',
        options: [
            {
                name: 'question',
                type: 3,  // STRING type
                description: 'The poll question',
                required: true
            },
            {
                name: 'options',
                type: 3,  // STRING type
                description: 'Options for the poll separated by commas (e.g. option1,option2,option3)',
                required: true
            }
        ]
    },

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = interaction.options.getString('options').split(',').map(opt => opt.trim());

        if (options.length < 2) {
            await interaction.reply({ content: "You need at least 2 options for a poll!", ephemeral: true });
            return;
        }

        if (options.length > 10) {
            await interaction.reply({ content: "You can only have up to 10 options for a poll!", ephemeral: true });
            return;
        }

        const emotes = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

        const description = options.map((option, idx) => `${emotes[idx]} ${option}`).join('\n');

        const embed = new EmbedBuilder()
            .setTitle(question)
            .setDescription(description)
            .setColor(0x3498db);

        const pollMessage = await interaction.reply({ embeds: [embed], fetchReply: true });

        for (let idx = 0; idx < options.length; idx++) {
            await pollMessage.react(emotes[idx]);
        }
    }
};