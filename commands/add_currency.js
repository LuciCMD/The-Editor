const dbManager = require('../database/dbManager');
const { AUTHORIZED_USERS } = require('../utils/config');

module.exports = {
    data: {
        name: 'add_currency',
        description: 'Add currency to a user',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'User to add currency to',
                required: true
            },
            {
                name: 'amount',
                type: 10,
                description: 'Amount of currency to add',
                required: true
            }
        ]
    },

    async execute(interaction) {
        if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
            await interaction.reply({ content: "You are not authorized to use this command.", ephemeral: true });
            return;
        }

        const user_id = interaction.options.getUser('user').id;
        const amount = interaction.options.getNumber('amount');

        const member = interaction.guild.members.cache.get(user_id);
        if (!member) {
            await interaction.reply(`Couldn't find a member with ID ${user_id}.`);
            return;
        }

        const db = dbManager.getDatabase('currency_db');

        db.get("SELECT balance FROM currency WHERE user_id=?", [user_id], (err, row) => {
            if (err) {
                console.error(err);
                interaction.reply({ content: "An error occurred while accessing the database.", ephemeral: true });
                return;
            }

            if (!row) {
                db.run("INSERT INTO currency (user_id, balance) VALUES (?, ?)", [user_id, amount], (err) => {
                    if (err) {
                        console.error(err);
                        interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                        return;
                    }
                    interaction.reply(`Added ${amount} currency to ${member.toString()}.`);
                });
            } else {
                const new_balance = row.balance + amount;
                db.run("UPDATE currency SET balance=? WHERE user_id=?", [new_balance, user_id], (err) => {
                    if (err) {
                        console.error(err);
                        interaction.reply({ content: "An error occurred while updating the database.", ephemeral: true });
                        return;
                    }
                    interaction.reply(`Added ${amount} currency to ${member.toString()}.`);
                });
            }
        });
    }
};