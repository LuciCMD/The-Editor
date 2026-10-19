const { EmbedBuilder } = require('@discordjs/builders');
const path = require('path');
const dbManager = require('../database/dbManager');

const sandDollarImagePath = 'attachment://sand_dollar.png';

module.exports = {
    data: {
        name: 'balance',
        description: 'Check your sand dollars balance',
    },

    async execute(interaction) {
        const userId = interaction.user.id;
        const db = dbManager.getDatabase('currency_db');

        db.get("SELECT balance FROM currency WHERE user_id=?", [userId], (err, row) => {
            if (err) {
                console.error(err);
                interaction.reply({ content: "An error occurred while fetching your balance.", ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.member.nickname || interaction.user.username}'s Balance`)
                .setDescription(`You have ${row ? row.balance : 0} sand dollars!`)
                .setThumbnail(sandDollarImagePath);

            interaction.reply({
                embeds: [embed],
                files: [path.join(__dirname, '..', 'assets', 'sand_dollar.png')]
            });
        });
    }
};