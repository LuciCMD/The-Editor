const { EmbedBuilder } = require('@discordjs/builders');

module.exports = {
    data: {
        name: 'coinflip',
        description: 'Flip a coin',
    },

    async execute(interaction) {
        const coinEmotes = {
            "heads": ":coin: Heads",
            "tails": ":coin: Tails"
        };

        const result = Object.keys(coinEmotes)[Math.floor(Math.random() * 2)];
        const embed = new EmbedBuilder()
                .setTitle('Coinflip')
                .setDescription(coinEmotes[result])

        interaction.reply({embeds: [embed]})
    }
};