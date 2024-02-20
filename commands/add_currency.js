const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { AUTHORIZED_USERS } = require('../config.json');

module.exports = {
    data: {
        name: 'add_currency',
        description: 'Add currency to a user',
        options: [
            {
                name: 'user',
                type: 6,  // USER type
                description: 'User to add currency to',
                required: true
            },
            {
                name: 'amount',
                type: 10,  // NUMBER type
                description: 'Amount of currency to add',
                required: true
            }
        ]
    },

    async execute(interaction) {
        console.log('AUTHORIZED_USERS:', AUTHORIZED_USERS); // Debugging line
        console.log('Type of AUTHORIZED_USERS:', typeof AUTHORIZED_USERS); // Debugging line
        console.log('Interaction User ID:', interaction.user.id); // Debugging line

        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const user_id = interaction.options.getUser('user').id;
        const amount = interaction.options.getNumber('amount');

        // Fetch the member using the provided user ID
        const member = interaction.guild.members.cache.get(user_id);
        if (!member) {
            await interaction.reply(`Couldn't find a member with ID ${user_id}.`);
            return;
        }

        const dbPath = path.join(__dirname, '..', 'database', 'currency_db.sqlite');
        const db = new sqlite3.Database(dbPath);

        db.get("SELECT balance FROM currency WHERE user_id=?", [user_id], (err, row) => {
            if (err) {
                console.error(err);
                interaction.reply({ content: "An error occurred while accessing the database.", ephemeral: true });
                return;
            }

            if (!row) {
                // If user doesn't exist, create a new entry with the given amount
                db.run("INSERT INTO currency (user_id, balance) VALUES (?, ?)", [user_id, amount], (err) => {
                    if (err) {
                        console.error(err);
                        interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                        return;
                    }

                    db.close();
                    interaction.reply(`Added ${amount} currency to ${member.toString()}.`);
                });
            } else {
                // If user exists, update their balance
                const new_balance = row.balance + amount;
                db.run("UPDATE currency SET balance=? WHERE user_id=?", [new_balance, user_id], (err) => {
                    if (err) {
                        console.error(err);
                        interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                        return;
                    }

                    db.close();
                    interaction.reply(`Added ${amount} currency to ${member.toString()}.`);
                });
            }
        });
    }
};