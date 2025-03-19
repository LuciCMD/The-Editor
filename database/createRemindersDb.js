const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Define the database file path
const dbPath = path.join(__dirname, 'reminders_db.sqlite');

// Create the database file if it doesn't exist
fs.closeSync(fs.openSync(dbPath, 'a'));

// Connect to the SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite reminders database.');
        
        // Create reminders table
        db.run(`CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            interval_value INTEGER NOT NULL,
            interval_unit TEXT NOT NULL,
            repeat_count INTEGER NOT NULL,
            remaining_repeats INTEGER,
            creator_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            next_trigger INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`, (err) => {
            if (err) {
                console.error('Error creating reminders table:', err.message);
            } else {
                console.log("Table 'reminders' created or already exists.");
            }
        });

        // Create reminder_users table
        db.run(`CREATE TABLE IF NOT EXISTS reminder_users (
            reminder_id INTEGER,
            user_id TEXT NOT NULL,
            FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) {
                console.error('Error creating reminder_users table:', err.message);
            } else {
                console.log("Table 'reminder_users' created or already exists.");
            }
        });

        // Create reminder_settings table
        db.run(`CREATE TABLE IF NOT EXISTS reminder_settings (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error('Error creating reminder_settings table:', err.message);
            } else {
                console.log("Table 'reminder_settings' created or already exists.");
            }
        });
    }
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Reminders database connection closed.');
});