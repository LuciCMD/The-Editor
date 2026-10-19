const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { useTempEnv, removeDir, fakeInteraction, replyText } = require('./helpers');

const dir = useTempEnv({ AUTHORIZED_USERS: 'owner' });

const dbManager = require('../database/dbManager');
const gag = require('../commands/gag_user');
const ungag = require('../commands/ungag_user');
const checkGag = require('../passives/checkGag');

const ROOT = path.join(__dirname, '..');
// Known /gag and checkGag bugs, kept running as todo until they're fixed
const KNOWN = { todo: 'known bug, listed under Bugs in the roadmap' };

function query(dbName, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbManager.getDatabase(dbName).get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function exec(dbName, sql, params = []) {
    return new Promise((resolve, reject) => {
        dbManager.getDatabase(dbName).run(sql, params, (err) => (err ? reject(err) : resolve()));
    });
}

async function runGag(targetId, strings) {
    const target = { id: targetId, username: targetId, toString: () => `<@${targetId}>` };
    const { interaction, done } = fakeInteraction({ userId: 'owner', target, strings });
    await gag.execute(interaction);
    return done;
}

// Message as checkGag sees it, returns what was sent in place of the original
async function speak(authorId, content) {
    const sent = [];
    let deleted = false;
    const message = { content, delete: async () => { deleted = true; } };
    const channel = { send: async (text) => { sent.push(text); } };
    await checkGag({ id: authorId }, channel, message);
    return { sent, deleted };
}

test.before(() => dbManager.initializeDatabases());
test.after(async () => {
    await dbManager.closeAllConnections();
    removeDir(dir);
});

test('gag then a message from that user is replaced', async () => {
    await runGag('e2e', { type: 'dog', duration: '1h', reason: null });
    const { sent, deleted } = await speak('e2e', 'hello there');
    assert.strictEqual(deleted, true);
    assert.strictEqual(sent.length, 1);
    assert.match(sent[0], /Woof|Bark/);
});

test('an ungagged user speaks normally', async () => {
    const { sent, deleted } = await speak('nobody', 'hello');
    assert.deepStrictEqual(sent, []);
    assert.strictEqual(deleted, false);
});

test('/ungag on a user who is not gagged says so', async () => {
    const target = { id: 'free', username: 'Free', toString: () => '<@free>' };
    const { interaction, done } = fakeInteraction({ userId: 'owner', target });
    await ungag.execute(interaction);
    assert.match(replyText(await done), /is not gagged/);
});

test('/gag twice on the same user replaces the first gag', async () => {
    await runGag('twice', { type: 'dog', duration: '1h' });
    await runGag('twice', { type: 'cat', duration: '2h' });
    const row = await query('gags_db', 'SELECT type FROM gags WHERE user_id = ?', ['twice']);
    assert.strictEqual(row.type, 'cat');
});

test('duration 1h30m is 90 minutes', async () => {
    const before = Date.now();
    await runGag('d90', { type: 'cat', duration: '1h30m' });
    const row = await query('gags_db', 'SELECT end_time FROM gags WHERE user_id = ?', ['d90']);
    const minutes = (row.end_time - before) / 60000;
    assert.ok(Math.abs(minutes - 90) < 1, `got ${minutes} min`);
});

test('duration 1.5h is not read as 5 hours', KNOWN, async () => {
    const before = Date.now();
    await runGag('d15', { type: 'cat', duration: '1.5h' });
    const row = await query('gags_db', 'SELECT end_time FROM gags WHERE user_id = ?', ['d15']);
    const hours = (row.end_time - before) / 3600000;
    assert.ok(hours < 2, `1.5h stored as ${hours.toFixed(2)} hours`);
});

for (const duration of ['30', '1d', 'abc', '0m']) {
    test(`duration "${duration}" is refused instead of a gag that ends at once`, KNOWN, async () => {
        const payload = await runGag(`bad-${duration}`, { type: 'cat', duration });
        const said = payload.embeds ? 'has been gagged embed' : replyText(payload);
        const { sent } = await speak(`bad-${duration}`, 'hi');
        assert.ok(!payload.embeds || sent.length > 0,
            `replied "${said}" but the gag never applies to messages`);
    });
}

test('gag type is matched without regard to case', KNOWN, async () => {
    await runGag('caps', { type: 'Cricket', duration: '1h' });
    const { sent } = await speak('caps', 'hello');
    assert.strictEqual(sent.length, 1, '"Cricket" was stored and acknowledged but has no effect');
});

test('an unknown gag type is refused rather than silently doing nothing', KNOWN, async () => {
    const payload = await runGag('giraffe', { type: 'giraffe', duration: '1h' });
    const { sent } = await speak('giraffe', 'hello');
    assert.ok(!payload.embeds || sent.length > 0, '/gag said gagged but the type has no replacements');
});

// A banned word with regex characters throws inside checkGag, the try swallows the gag too
test('a banned word with regex characters does not cancel the gag', KNOWN, async () => {
    await exec('badwords_db', 'INSERT INTO banned_words (user_id, word) VALUES (?, ?)', ['regex', 'c++']);
    await runGag('regex', { type: 'dog', duration: '1h' });
    const { sent } = await speak('regex', 'I like c++');
    assert.strictEqual(sent.length, 1, 'gagged user posted unaltered');
});

// Discord allows 6000 characters in a string option, embed field values allow 1024
test('a reason over 1024 characters does not crash the process', KNOWN, () => {
    const script = `
        const { fakeInteraction } = require(${JSON.stringify(path.join(__dirname, 'helpers.js'))});
        const m = require(${JSON.stringify(path.join(ROOT, 'database', 'dbManager.js'))});
        const gag = require(${JSON.stringify(path.join(ROOT, 'commands', 'gag_user.js'))});
        console.log = () => {};
        process.on('uncaughtException', (e) => { process.stdout.write('UNCAUGHT ' + e.message.split('\\n')[0]); process.exit(0); });
        m.initializeDatabases().then(async () => {
            const target = { id: 'long', username: 'Long' };
            const { interaction, done } = fakeInteraction({ userId: 'owner', target,
                strings: { type: 'cat', duration: '1h', reason: 'x'.repeat(1100) } });
            await gag.execute(interaction);
            const p = await Promise.race([done, new Promise((r) => setTimeout(() => r('NO REPLY'), 2000))]);
            process.stdout.write(typeof p === 'string' ? p : 'REPLIED');
            process.exit(0);
        });
    `;
    const childDir = fs.mkdtempSync(path.join(os.tmpdir(), 'the-editor-long-'));
    try {
        const out = execFileSync(process.execPath, ['-e', script],
            { env: { ...process.env, DATABASE_DIR: childDir, AUTHORIZED_USERS: 'owner' }, encoding: 'utf8' });
        assert.strictEqual(out, 'REPLIED');
    } finally {
        removeDir(childDir);
    }
});
