const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { useTempEnv, removeDir } = require('./helpers');

const dir = useTempEnv();

const dbManager = require('../database/dbManager');

const ROOT = path.join(__dirname, '..');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

test.before(() => dbManager.initializeDatabases());
test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

test('SQLITE_DIR follows DATABASE_DIR', () => {
    assert.strictEqual(dbManager.SQLITE_DIR, path.resolve(dir));
    assert.ok(fs.existsSync(path.join(dir, 'gags_db.sqlite')));
});

test('closeAllConnections twice and with nothing open resolves', async () => {
    await dbManager.closeAllConnections();
    await dbManager.closeAllConnections();
});

test('getDatabase works again after closeAllConnections', async () => {
    const first = dbManager.getDatabase('currency_db');
    await get(first, 'SELECT 1 AS one');
    await dbManager.closeAllConnections();
    assert.strictEqual(first.open, false);

    const second = dbManager.getDatabase('currency_db');
    assert.notStrictEqual(second, first);
    const row = await get(second, 'SELECT 1 AS one');
    assert.strictEqual(row.one, 1);
    await dbManager.closeAllConnections();
});

test('a write queued just before closeAllConnections still lands', async () => {
    const db = dbManager.getDatabase('currency_db');
    await get(db, 'SELECT 1');
    const write = run(db, 'INSERT OR REPLACE INTO currency (user_id, balance) VALUES (?, ?)', ['late', 7]);
    await dbManager.closeAllConnections();
    await write;
    const row = await get(dbManager.getDatabase('currency_db'), 'SELECT balance FROM currency WHERE user_id = ?', ['late']);
    assert.strictEqual(row.balance, 7);
    await dbManager.closeAllConnections();
});

// Two callers in the same tick, like two messages hitting a cold pool, the first handle isn't open yet
// Runs in a child so an uncaught SQLITE_BUSY can be seen instead of killing this file
test('getDatabase twice before the first open finishes reuses one handle', () => {
    const childDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-dup-'));
    const script = `
        const m = require(${JSON.stringify(path.join(ROOT, 'database', 'dbManager.js'))});
        const report = { uncaught: [] };
        process.on('uncaughtException', (e) => report.uncaught.push(e.code || e.message));
        m.initializeDatabases().then(() => {
            const a = m.getDatabase('badwords_db');
            const b = m.getDatabase('badwords_db');
            report.same = a === b;
            setTimeout(() => m.closeAllConnections().then(() => setTimeout(() => {
                report.leftOpen = [a, b].filter((d) => d.open).length;
                process.stdout.write('REPORT' + JSON.stringify(report));
                process.exit(0);
            }, 100)), 300);
        });
    `;
    try {
        const out = execFileSync(process.execPath, ['-e', script],
            { env: { ...process.env, DATABASE_DIR: childDir }, encoding: 'utf8' });
        const report = JSON.parse(out.slice(out.indexOf('REPORT') + 6));
        assert.deepStrictEqual(report, { uncaught: [], same: true, leftOpen: 0 });
    } finally {
        removeDir(childDir);
    }
});

test('closeAllConnections right after getDatabase closes that handle', async () => {
    const db = dbManager.getDatabase('polls_db');
    await dbManager.closeAllConnections();
    await wait(100);
    const leaked = db.open;
    if (leaked) await new Promise((resolve) => db.close(resolve));
    assert.strictEqual(leaked, false, 'handle that was still opening was skipped and left open');
});

test('relative DATABASE_DIR resolves from the working directory', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-cwd-'));
    try {
        const out = execFileSync(process.execPath, ['-e',
            `process.stdout.write(require(${JSON.stringify(path.join(ROOT, 'database', 'dbManager.js'))}).SQLITE_DIR)`],
            { cwd, env: { ...process.env, DATABASE_DIR: 'rel/sub' }, encoding: 'utf8' });
        assert.strictEqual(out, path.join(fs.realpathSync(cwd), 'rel', 'sub'));
    } finally {
        removeDir(cwd);
    }
});

test('DATABASE_DIR with spaces and non-ASCII works end to end', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor space é-'));
    const target = path.join(parent, 'db dir ü');
    try {
        const script = `
            const m = require(${JSON.stringify(path.join(ROOT, 'database', 'dbManager.js'))});
            m.initializeDatabases().then(() => new Promise((res, rej) => {
                const db = m.getDatabase('gags_db');
                db.run("INSERT INTO gags (user_id, type, end_time) VALUES ('u', 'cat', 1)", (e) => e ? rej(e) : res());
            })).then(() => m.closeAllConnections()).then(() => process.stdout.write('ok'), (e) => { console.error(e); process.exit(1); });
        `;
        const out = execFileSync(process.execPath, ['-e', script],
            { env: { ...process.env, DATABASE_DIR: target }, encoding: 'utf8' });
        assert.match(out, /ok$/);
        assert.ok(fs.existsSync(path.join(target, 'gags_db.sqlite')));
    } finally {
        removeDir(parent);
    }
});

// dbManager is required before app.js adds its own handler, so its process.exit(0) runs first
test('SIGTERM lets the app shutdown handler run and waits for closeAllConnections', { todo: 'known bug, dbManager exits before app.js shutdown' }, () => {
    const childDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-sig-'));
    const script = `
        const m = require(${JSON.stringify(path.join(ROOT, 'database', 'dbManager.js'))});
        console.log = () => {};
        m.initializeDatabases().then(() => {
            const db = m.getDatabase('gags_db');
            db.get('SELECT 1', () => {
                db.on('close', () => process.stdout.write('db-closed '));
                process.on('SIGTERM', () => process.stdout.write('app-shutdown-ran '));
                process.emit('SIGTERM');
            });
        });
    `;
    try {
        const out = execFileSync(process.execPath, ['-e', script],
            { env: { ...process.env, DATABASE_DIR: childDir }, encoding: 'utf8' });
        assert.match(out, /app-shutdown-ran/, 'app.js shutdown (voice, countdown, client.destroy) never runs');
        assert.match(out, /db-closed/, 'process exited before the close finished');
    } finally {
        removeDir(childDir);
    }
});

// Fresh DATABASE_DIR like a new .env.test, and a volume change before initializeDatabases made the folder
test('volumeStore.set persists when DATABASE_DIR does not exist yet', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-vol-'));
    const target = path.join(parent, 'sqlite-test');
    try {
        execFileSync(process.execPath, ['-e',
            `require(${JSON.stringify(path.join(ROOT, 'utils', 'volumeStore.js'))}).set('g', 80)`],
            { env: { ...process.env, DATABASE_DIR: target }, encoding: 'utf8', stdio: 'pipe' });
        assert.ok(fs.existsSync(path.join(target, 'volume_state.json')), 'volume silently not saved');
    } finally {
        removeDir(parent);
    }
});
