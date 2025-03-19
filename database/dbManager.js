const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database schemas
const schemas = {
    gags_db: `
        CREATE TABLE IF NOT EXISTS gags (
            user_id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            end_time INTEGER NOT NULL,
            reason TEXT
        )
    `,
    
    badwords_db: `
        CREATE TABLE IF NOT EXISTS banned_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            word TEXT NOT NULL
        )
    `,
    
    currency_db: `
        CREATE TABLE IF NOT EXISTS currency (
            user_id TEXT PRIMARY KEY,
            balance INTEGER NOT NULL DEFAULT 0
        )
    `,
    
    reminders_db: {
        reminders: `
            CREATE TABLE IF NOT EXISTS reminders (
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
            )
        `,
        reminder_users: `
            CREATE TABLE IF NOT EXISTS reminder_users (
                reminder_id INTEGER,
                user_id TEXT NOT NULL,
                FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
            )
        `,
        reminder_settings: `
            CREATE TABLE IF NOT EXISTS reminder_settings (
                guild_id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL
            )
        `
    }
};

// Initialize all databases
async function initializeDatabases() {
    console.log('Initializing all databases...');
    
    // Ensure database directory exists
    const dbDir = path.join(__dirname);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Initialize each database
    for (const [dbName, schema] of Object.entries(schemas)) {
        await initializeDatabase(dbName, schema);
    }
    
    console.log('All databases initialized successfully.');
}

// Initialize a specific database
async function initializeDatabase(dbName, schema) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(__dirname, `${dbName}.sqlite`);
        
        // Create or open database
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(`Error opening ${dbName} database:`, err);
                reject(err);
                return;
            }
            
            console.log(`Connected to ${dbName} database for initialization.`);
            
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) console.error('Error enabling foreign keys:', err);
            });
            
            // Create tables
            db.serialize(() => {
                if (typeof schema === 'string') {
                    // Single table schema
                    db.run(schema, (err) => {
                        if (err) {
                            console.error(`Error creating table in ${dbName}:`, err);
                            reject(err);
                            return;
                        }
                        console.log(`Table in ${dbName} checked/created.`);
                    });
                } else {
                    // Multiple table schema
                    for (const [tableName, tableSchema] of Object.entries(schema)) {
                        db.run(tableSchema, (err) => {
                            if (err) {
                                console.error(`Error creating ${tableName} table in ${dbName}:`, err);
                                reject(err);
                                return;
                            }
                            console.log(`Table ${tableName} in ${dbName} checked/created.`);
                        });
                    }
                }
                
                // Close the database
                db.close((err) => {
                    if (err) {
                        console.error(`Error closing ${dbName} database:`, err);
                        reject(err);
                        return;
                    }
                    console.log(`${dbName} database initialization completed.`);
                    resolve();
                });
            });
        });
    });
}

// Get connection to a database
function getDatabase(dbName) {
    const dbPath = path.join(__dirname, `${dbName}.sqlite`);
    
    // Create database directory if it doesn't exist
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Create or open database
    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error(`Error opening ${dbName} database:`, err);
        }
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
    });
    
    return db;
}

module.exports = {
    initializeDatabases,
    initializeDatabase,
    getDatabase
};