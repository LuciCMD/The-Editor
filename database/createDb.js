const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the database file path
const dbPath = path.join(__dirname, 'badwords_db.sqlite');

// Create the database file if it doesn't exist
fs.closeSync(fs.openSync(dbPath, 'a'));

// Connect to the SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE banned_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            word TEXT NOT NULL
        )`, (err) => {
            if (err) {
                // Table already created
                console.error(err.message);
            } else {
                // Table just created
                console.log("Table 'banned_words' created.");
            }
        });
    }
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Database connection closed.');
});
