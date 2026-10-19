const { EmbedBuilder } = require('@discordjs/builders');

module.exports = {
    data: {
        name: 'rolldice',
        description: 'Roll a dice with a specific number of sides',
        options: [
            {
                name: 'sides',
                type: 4,  // INTEGER
                description: 'Number of sides on the dice (default is 6)',
                required: false
            }
        ]
    },

    async execute(interaction) {
        let sides = interaction.options.getInteger('sides') || 6;
        const roll = Math.floor(Math.random() * sides) + 1;

        const embed = new EmbedBuilder()
            .setTitle('Dice Roll')
            .setDescription(`:game_die: **${roll}**`);

        interaction.reply({ embeds: [embed] });
    }
};