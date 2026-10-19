const dbManager = require('../database/dbManager');
const { AUTHORIZED_USERS } = require('../utils/config');

module.exports = {
    data: {
        name: 'ungag',
        description: 'Ungag a user',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'User to ungag',
                required: true
            }
        ]
    },

    async execute(interaction) {
        const user = interaction.options.getUser('user');

        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        if (interaction.user.id === user.id) {
            await interaction.reply("You cannot ungag yourself.");
            return;
        }

        const db = dbManager.getDatabase('gags_db');

        db.get("SELECT user_id FROM gags WHERE user_id=?", [user.id], (err, row) => {
            if (err) {
                console.error(err);
                return interaction.reply("There was an error processing the ungag request.");
            }

            if (row) {
                db.run("DELETE FROM gags WHERE user_id=?", [user.id], (err) => {
                    if (err) {
                        console.error(err);
                        return interaction.reply("There was an error ungagging the user.");
                    }
                    interaction.reply(`${user.toString()} has been ungagged.`);
                });
            } else {
                interaction.reply(`${user.toString()} is not gagged.`);
            }
        });
    }
};