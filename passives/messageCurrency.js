const dbManager = require('../database/dbManager');

module.exports = {
    name: 'messageCreate',
    execute(message) {
        if (message.author.bot || !message.guild) return;

        const userId = message.author.id;
        const db = dbManager.getDatabase('currency_db');

        db.get("SELECT balance FROM currency WHERE user_id=?", [userId], (err, row) => {
            if (err) {
                console.error("Error querying currency:", err);
                return;
            }

            if (row) {
                db.run("UPDATE currency SET balance=? WHERE user_id=?", [row.balance + 1, userId], (err) => {
                    if (err) console.error("Error updating currency:", err);
                });
            } else {
                db.run("INSERT INTO currency (user_id, balance) VALUES (?, ?)", [userId, 1], (err) => {
                    if (err) console.error("Error inserting currency:", err);
                });
            }
        });
    }
};