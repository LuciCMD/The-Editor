const { EmbedBuilder } = require('@discordjs/builders');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database', 'currency_db.sqlite');
const sandDollarImagePath = 'attachment://sand_dollar.png';  // Attachment URL for the image

module.exports = {
    data: {
        name: 'balance',
        description: 'Check your sand dollars balance',
    },

    async execute(interaction) {
        const userId = interaction.user.id;

        const db = new sqlite3.Database(dbPath);
        db.get("SELECT balance FROM currency WHERE user_id=?", [userId], (err, row) => {
            if (err) {
                console.error(err);
                interaction.reply({ content: "An error occurred while fetching your balance.", ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`${interaction.member.nickname}'s Balance`)
                .setDescription(`You have ${row ? row.balance : 0} sand dollars!`)
                .setThumbnail(sandDollarImagePath);

            if (row) {
                interaction.reply({ embeds: [embed], files: [path.join(__dirname, '..', 'assets', 'sand_dollar.png')] });
            } else {
                interaction.reply("You haven't earned any sand dollars yet!");
            }

            db.close();
        });
    }
};
