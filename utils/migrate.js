const dbManager = require('../database/dbManager');

async function addDefaultIgnoredDomains() {
    const db = dbManager.getDatabase('virustotal_settings_db');
    const defaultDomains = ['tenor.com'];

    for (const domain of defaultDomains) {
        try {
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT OR IGNORE INTO vt_ignore_domains (domain, added_by) VALUES (?, ?)",
                    [domain, 'system'],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        if (this.changes > 0) {
                            console.log(`Added default ignored domain: ${domain}`);
                        }
                        resolve();
                    }
                );
            });
        } catch (error) {
            console.error(`Error adding default domain ${domain}:`, error);
        }
    }
}

// Add the reminders.timezone column to databases created before DST support.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we check the table info first.
async function addReminderTimezoneColumn() {
    const db = dbManager.getDatabase('reminders_db');
    const hasColumn = await new Promise((resolve) => {
        db.all("PRAGMA table_info(reminders)", (err, rows) => {
            if (err) {
                console.error('Error reading reminders schema:', err);
                resolve(true); // avoid a failing ALTER on error
                return;
            }
            resolve((rows || []).some(row => row.name === 'timezone'));
        });
    });

    if (hasColumn) {
        return;
    }

    await new Promise((resolve) => {
        db.run("ALTER TABLE reminders ADD COLUMN timezone TEXT DEFAULT 'UTC'", (err) => {
            if (err) {
                console.error('Error adding timezone column:', err);
            } else {
                console.log('Added timezone column to reminders table.');
            }
            resolve();
        });
    });
}

async function runMigrations() {
    console.log('Running migrations...');
    await addDefaultIgnoredDomains();
    await addReminderTimezoneColumn();
    console.log('Migrations complete');
}

module.exports = {
    runMigrations
};
