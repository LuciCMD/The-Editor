const sqlite3 = require('sqlite3').verbose();
const path = require('path');

module.exports = {
    name: 'messageCreate',
    execute(message) {
        const userId = message.author.id;

        // Adjust the path if this file is in a subdirectory
        const dbPath = path.join(__dirname, '..', 'database', 'currency_db.sqlite');
        const db = new sqlite3.Database(dbPath);

        db.get("SELECT balance FROM currency WHERE user_id=?", [userId], (err, row) => {
            if (err) {
                console.error("Error querying the database:", err);
                return;
            }

            if (row) {
                const newBalance = row.balance + 1;
                db.run("UPDATE currency SET balance=? WHERE user_id=?", [newBalance, userId], err => {
                    if (err) {
                        console.error("Error updating the database:", err);
                    }
                    db.close();
                });
            } else {
                db.run("INSERT INTO currency (user_id, balance) VALUES (?, ?)", [userId, 1], err => {
                    if (err) {
                        console.error("Error inserting into the database:", err);
                    }
                    db.close();
                });
            }
        });
    }
};