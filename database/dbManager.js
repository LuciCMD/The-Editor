const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// DATABASE_DIR keeps the test bot and tests away from live data, relative paths resolve from the working directory
const { databaseDir } = require('../utils/config');
const SQLITE_DIR = databaseDir
    ? path.resolve(databaseDir)
    : path.join(__dirname, 'sqlite');

const connectionPool = new Map();
const IDLE_TIMEOUT = 300000;
const MAX_CONNECTIONS = 10;

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

    watched_channels_db: `
        CREATE TABLE IF NOT EXISTS watched_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            channel_name TEXT,
            guild_name TEXT,
            ignore_bots INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            UNIQUE(user_id, channel_id)
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
                timezone TEXT DEFAULT 'UTC',
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
    },

    permissions_db: {
        authorized_users: `
            CREATE TABLE IF NOT EXISTS authorized_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                username TEXT,
                added_by TEXT NOT NULL,
                added_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, guild_id)
            )
        `,
        user_permissions: `
            CREATE TABLE IF NOT EXISTS user_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                permission TEXT NOT NULL,
                granted_by TEXT NOT NULL,
                granted_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, guild_id, permission)
            )
        `
    },

    polls_db: {
        polls: `
            CREATE TABLE IF NOT EXISTS polls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                channel_id TEXT,
                message_id TEXT,
                question TEXT NOT NULL,
                options TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `,
        poll_votes: `
            CREATE TABLE IF NOT EXISTS poll_votes (
                poll_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                option_index INTEGER NOT NULL,
                PRIMARY KEY (poll_id, user_id),
                FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
            )
        `
    },

    virustotal_settings_db: `
        CREATE TABLE IF NOT EXISTS vt_ignore_domains (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            domain TEXT NOT NULL UNIQUE,
            added_by TEXT NOT NULL,
            added_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `
};

async function initializeDatabases() {
    console.log('Initializing all databases...');

    if (!fs.existsSync(SQLITE_DIR)) {
        fs.mkdirSync(SQLITE_DIR, { recursive: true });
    }

    for (const [dbName, schema] of Object.entries(schemas)) {
        await initializeDatabase(dbName, schema);
    }

    console.log('All databases initialized successfully.');
}

async function initializeDatabase(dbName, schema) {
    return new Promise((resolve, reject) => {
        const dbPath = path.join(SQLITE_DIR, `${dbName}.sqlite`);

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(`Error opening ${dbName} database:`, err);
                reject(err);
                return;
            }

            console.log(`Connected to ${dbName} database for initialization.`);
            db.run('PRAGMA foreign_keys = ON');

            db.serialize(() => {
                let taskCount = typeof schema === 'string' ? 1 : Object.keys(schema).length;
                let completedTasks = 0;

                const checkCompletion = () => {
                    completedTasks++;
                    if (completedTasks >= taskCount) {
                        db.close((err) => {
                            if (err) {
                                console.error(`Error closing ${dbName} database:`, err);
                                reject(err);
                                return;
                            }
                            console.log(`${dbName} database initialization completed.`);
                            resolve();
                        });
                    }
                };

                if (typeof schema === 'string') {
                    db.run(schema, (err) => {
                        if (err) {
                            console.error(`Error creating table in ${dbName}:`, err);
                            reject(err);
                            return;
                        }
                        console.log(`Table in ${dbName} checked/created.`);
                        checkCompletion();
                    });
                } else {
                    for (const [tableName, tableSchema] of Object.entries(schema)) {
                        db.run(tableSchema, (err) => {
                            if (err) {
                                console.error(`Error creating ${tableName} table in ${dbName}:`, err);
                                reject(err);
                                return;
                            }
                            console.log(`Table ${tableName} in ${dbName} checked/created.`);
                            checkCompletion();
                        });
                    }
                }
            });
        });
    });
}

// Removes the entry from the pool and closes its handle, sqlite3 queues the close behind an open in progress
function closeEntry(dbName, entry) {
    clearTimeout(entry.idleTimer);
    if (connectionPool.get(dbName) === entry) {
        connectionPool.delete(dbName);
    }
    if (entry.closed) {
        return Promise.resolve();
    }
    entry.closed = true;
    return new Promise((resolve) => {
        entry.db.close((err) => {
            if (err) console.error(`Error closing ${dbName}:`, err);
            else console.log(`Closed connection for ${dbName}`);
            resolve();
        });
    });
}

function scheduleIdleClose(dbName, entry) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => closeEntry(dbName, entry), IDLE_TIMEOUT);
}

function logPragmaError(dbName) {
    return (err) => {
        if (err) console.error(`Error setting pragma on ${dbName}:`, err);
    };
}

function getDatabase(dbName) {
    const existing = connectionPool.get(dbName);
    // A handle still opening has db.open false, so tracking closed ourselves avoids opening duplicates
    if (existing && !existing.closed) {
        scheduleIdleClose(dbName, existing);
        return existing.db;
    }

    if (connectionPool.size >= MAX_CONNECTIONS) {
        const oldestKey = connectionPool.keys().next().value;
        console.log(`Closing oldest connection for ${oldestKey} to make room`);
        closeEntry(oldestKey, connectionPool.get(oldestKey));
    }

    const dbPath = path.join(SQLITE_DIR, `${dbName}.sqlite`);
    const entry = { db: null, idleTimer: null, closed: false };

    entry.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error(`Error opening ${dbName}:`, err);
            // Next call opens a fresh handle instead of reusing the failed one
            entry.closed = true;
            clearTimeout(entry.idleTimer);
            if (connectionPool.get(dbName) === entry) {
                connectionPool.delete(dbName);
            }
        } else {
            console.log(`Opened new connection for ${dbName}`);
        }
    });

    entry.db.run('PRAGMA foreign_keys = ON', logPragmaError(dbName));
    entry.db.run('PRAGMA busy_timeout = 5000', logPragmaError(dbName));
    entry.db.run('PRAGMA journal_mode = WAL', logPragmaError(dbName));

    connectionPool.set(dbName, entry);
    scheduleIdleClose(dbName, entry);
    return entry.db;
}

// Resolves once every handle is closed, so callers that delete the files can wait
function closeAllConnections() {
    console.log('Closing all database connections...');
    const closing = [...connectionPool.entries()].map(([name, entry]) => closeEntry(name, entry));
    return Promise.all(closing).then(() => console.log('All database connections closed.'));
}

// Graceful shutdown handlers
process.on('SIGINT', () => {
    closeAllConnections();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeAllConnections();
    process.exit(0);
});

module.exports = {
    SQLITE_DIR,
    initializeDatabases,
    initializeDatabase,
    getDatabase,
    closeAllConnections
};