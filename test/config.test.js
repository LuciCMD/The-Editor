const test = require('node:test');
const assert = require('node:assert');
const { useTempEnv, removeDir } = require('./helpers');

const dir = useTempEnv({
    DISCORD_TOKEN: 'test-token',
    AUTHORIZED_USERS: ' 111, 222 ,,333 ',
    TEST_GUILD_ID: '999'
});
delete process.env.GENIUS_TOKEN;

const config = require('../utils/config');

test.after(() => removeDir(dir));

test('reads settings from the environment', () => {
    assert.strictEqual(config.token, 'test-token');
    assert.strictEqual(config.testGuildId, '999');
    assert.strictEqual(config.geniusToken, '');
});

test('AUTHORIZED_USERS splits on commas and drops blanks', () => {
    assert.deepStrictEqual(config.AUTHORIZED_USERS, ['111', '222', '333']);
});

test('parseList handles empty and missing values', () => {
    assert.deepStrictEqual(config.parseList(''), []);
    assert.deepStrictEqual(config.parseList(undefined), []);
    assert.deepStrictEqual(config.parseList(' , '), []);
    assert.deepStrictEqual(config.parseList('42'), ['42']);
});
