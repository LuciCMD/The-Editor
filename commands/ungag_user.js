const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');

const dbPath = path.join(__dirname, '..', 'database', 'gags_db.sqlite');
const db = new sqlite3.Database(dbPath);

module.exports = {
    data: {
        name: 'ungag',
        description: 'Ungag a user',
        options: [
            {
                name: 'user',
                type: 6,  // USER type
                description: 'User to ungag',
                required: true
            }
        ]
    },


    async execute(interaction) {
        const user = interaction.options.getUser('user');
        console.log('AUTHORIZED_USERS:', AUTHORIZED_USERS); // Debugging line
        console.log('Type of AUTHORIZED_USERS:', typeof AUTHORIZED_USERS); // Debugging line
        console.log('Interaction User ID:', interaction.user.id); // Debugging line

        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        // Prevent users from ungagging themselves
        if (interaction.user.id === user.id) {
            await interaction.reply("You cannot ungag yourself.");
            return;
        }

        // Check if the user is gagged in the database
        db.get("SELECT user_id FROM gags WHERE user_id=?", [user.id], (err, row) => {
            if (err) {
                console.error(err);
                return interaction.reply("There was an error processing the ungag request.");
            }

            if (row) {
                // User is gagged, now remove them from the database
                db.run("DELETE FROM gags WHERE user_id=?", [user.id], function (err) {
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