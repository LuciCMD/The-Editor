const { EmbedBuilder } = require('@discordjs/builders');
const { AUTHORIZED_USERS } = require('../config.json');
const dbManager = require('../database/dbManager');

module.exports = {
    data: {
        name: 'banword',
        description: 'Ban a specific word for a specific user',
        options: [
            {
                name: 'user',
                type: 6,  // USER
                description: 'User to ban the word for',
                required: true
            },
            {
                name: 'word',
                type: 3,  // STRING
                description: 'Word to ban',
                required: true
            }
        ]
    },

    async execute(interaction) {
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const user = interaction.options.getUser('user');
        const word = interaction.options.getString('word');

        // Connect to the database
        const db = dbManager.getDatabase('badwords_db');

        // Save to the database
        db.run("INSERT INTO banned_words (user_id, word) VALUES (?, ?)", [user.id, word], (err) => {
            if (err) {
                console.error('Error updating the database:', err);
                db.close();
                interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle("Word Ban Information")
                .setDescription(`The word "${word}" has been banned for ${user.username}.`)
                .setColor(0xFF5733);

            interaction.reply({ embeds: [embed] });
            db.close();
        });
    }
};