const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { useTempEnv, removeDir } = require('./helpers');

const dir = useTempEnv();
const { parseList } = require('../utils/config');

const CONFIG = path.join(__dirname, '..', 'utils', 'config.js');
const KEYS = ['DISCORD_TOKEN', 'GENIUS_TOKEN', 'VIRUSTOTAL_API_KEY', 'AUTHORIZED_USERS', 'TEST_GUILD_ID'];

test.after(() => removeDir(dir));

// Env with none of the bot keys, so only the temp env file can set them
function cleanEnv() {
    const env = { ...process.env };
    for (const key of KEYS) delete env[key];
    return env;
}

function writeEnvFile(content) {
    const file = path.join(dir, `env-${Math.random().toString(36).slice(2)}`);
    fs.writeFileSync(file, content);
    return file;
}

// Loads utils/config the way npm start and npm run dev do
function configFrom(flag, file) {
    const out = execFileSync(process.execPath,
        [`${flag}=${file}`, '-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(CONFIG)})))`],
        { env: cleanEnv(), encoding: 'utf8' });
    return JSON.parse(out);
}

test('parseList keeps IDs as strings so includes(interaction.user.id) matches', () => {
    assert.deepStrictEqual(parseList('123456789012345678'), ['123456789012345678']);
    assert.ok(parseList('1, 2').includes('2'));
});

test('parseList drops trailing commas and surrounding whitespace', () => {
    assert.deepStrictEqual(parseList('1,2,'), ['1', '2']);
    assert.deepStrictEqual(parseList('\t1 ,\n2 '), ['1', '2']);
});

// The old config.json held a JSON array, pasting it into .env is the obvious migration
test('AUTHORIZED_USERS pasted as the old JSON array still authorizes those IDs', () => {
    assert.deepStrictEqual(parseList('["111","222"]'), ['111', '222']);
});

test('AUTHORIZED_USERS with quoted entries still authorizes those IDs', () => {
    assert.deepStrictEqual(parseList('"111", "222"'), ['111', '222']);
});

test('--env-file reads a CRLF file without trailing carriage returns', () => {
    const file = writeEnvFile('DISCORD_TOKEN=abc.def\r\nAUTHORIZED_USERS=1, 2\r\nTEST_GUILD_ID=9\r\n');
    const config = configFrom('--env-file', file);
    assert.strictEqual(config.token, 'abc.def');
    assert.strictEqual(config.testGuildId, '9');
    assert.deepStrictEqual(config.AUTHORIZED_USERS, ['1', '2']);
});

test('--env-file handles quotes and an inline comment', () => {
    const file = writeEnvFile('DISCORD_TOKEN="abc"\nAUTHORIZED_USERS=1,2 # owners\n');
    const config = configFrom('--env-file', file);
    assert.strictEqual(config.token, 'abc');
    assert.deepStrictEqual(config.AUTHORIZED_USERS, ['1', '2']);
});

// Notepad and PowerShell 5 Out-File -Encoding utf8 write a BOM
test('--env-file saved with a UTF-8 BOM still sets the first key', () => {
    const file = writeEnvFile('﻿DISCORD_TOKEN=abc\nAUTHORIZED_USERS=1\n');
    assert.strictEqual(configFrom('--env-file', file).token, 'abc');
});

// Otherwise the test bot falls back to database/sqlite with no warning
test('DATABASE_DIR first in a BOM-saved env file still picks the database folder', () => {
    const target = path.join(dir, 'bom-db');
    const file = writeEnvFile(`﻿DATABASE_DIR=${target}\nDISCORD_TOKEN=abc\n`);
    const dbManager = path.join(__dirname, '..', 'database', 'dbManager.js');
    const env = cleanEnv();
    delete env.DATABASE_DIR;
    const out = execFileSync(process.execPath,
        [`--env-file=${file}`, '-e', `process.stdout.write(require(${JSON.stringify(dbManager)}).SQLITE_DIR)`],
        { env, encoding: 'utf8' });
    assert.strictEqual(out, path.resolve(target));
});

test('--env-file-if-exists with no file starts with empty settings', () => {
    const config = configFrom('--env-file-if-exists', path.join(dir, 'missing.env'));
    assert.strictEqual(config.token, '');
    assert.deepStrictEqual(config.AUTHORIZED_USERS, []);
});

test('a real environment variable wins over the env file', () => {
    const file = writeEnvFile('DISCORD_TOKEN=from-file\n');
    const out = execFileSync(process.execPath,
        [`--env-file=${file}`, '-e', `process.stdout.write(require(${JSON.stringify(CONFIG)}).token)`],
        { env: { ...cleanEnv(), DISCORD_TOKEN: 'from-env' }, encoding: 'utf8' });
    assert.strictEqual(out, 'from-env');
});

// /restart respawns with process.argv only, --env-file is in execArgv and is dropped
test('a process respawned like /restart still sees the env file values', () => {
    const file = writeEnvFile('DISCORD_TOKEN=restart-token\nDATABASE_DIR=x\n');
    const script = path.join(dir, 'respawn.js');
    fs.writeFileSync(script, `
        const { spawnSync } = require('child_process');
        if (process.argv[2] === 'child') {
            process.stdout.write(require(${JSON.stringify(CONFIG)}).token + '|' + process.execArgv.join(' '));
        } else {
            const r = spawnSync(process.argv[0], [...process.argv.slice(1), 'child'], { encoding: 'utf8' });
            process.stdout.write(r.stdout);
        }
    `);
    const out = execFileSync(process.execPath, [`--env-file=${file}`, script], { env: cleanEnv(), encoding: 'utf8' });
    const [token, execArgv] = out.split('|');
    assert.strictEqual(token, 'restart-token');
    assert.strictEqual(execArgv, '', 'execArgv unexpectedly carried over');
});
