const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, Collection, REST, Routes } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { DisTube } = require('distube');
const { download: downloadYtDlp } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { YtDlpPlugin } = require('./utils/ytdlpPlugin');

const config = require('./utils/config');
const dbManager = require('./database/dbManager');
const { runMigrations } = require('./utils/migrate');
const messageLogger = require('./passives/messageLogger');
const checkAndReplaceBannedWords = require('./passives/checkGag');

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT, 10) || 3000;
const YTDLP_UPDATE_TIMEOUT_MS = 60 * 1000;

const client = new Client(require('./utils/clientOptions'));

// Collections populated at startup.
client.commands = new Collection();
client.components = new Collection();

// Load slash commands from ./commands and its immediate subdirectories.
function loadCommands() {
    const root = path.join(__dirname, 'commands');
    const dirs = ['.', ...fs.readdirSync(root, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)];

    for (const dir of dirs) {
        const files = fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const command = require(path.join(root, dir, file));
            if (command.data && command.data.name) {
                client.commands.set(command.data.name, command);
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.error(`Command file ${file} is missing a 'data.name' property.`);
            }
        }
    }
    return client.commands.size;
}

// Load component handlers from ./components. Each module exports { id, execute }
// where `id` is the customId prefix (the segment before the first ':').
function loadComponents() {
    const root = path.join(__dirname, 'components');
    if (!fs.existsSync(root)) {
        return 0;
    }
    const files = fs.readdirSync(root).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const handler = require(path.join(root, file));
        if (handler.id && typeof handler.execute === 'function') {
            client.components.set(handler.id, handler);
            console.log(`Loaded component handler: ${handler.id}`);
        } else {
            console.error(`Component file ${file} is missing 'id' or 'execute'.`);
        }
    }
    return client.components.size;
}

// Register auto-loaded passives ({ name, execute }). Function-only exports
// (messageLogger, checkGag) are wired explicitly below and skipped here.
function loadPassives() {
    const root = path.join(__dirname, 'passives');
    const files = fs.readdirSync(root).filter(f => f.endsWith('.js'));
    for (const file of files) {
        const passive = require(path.join(root, file));
        if (!passive || !passive.name || typeof passive.execute !== 'function') {
            continue;
        }
        if (passive.name === 'messageCreate') {
            client.on('messageCreate', async (message) => {
                try {
                    await passive.execute(message, client);
                } catch (error) {
                    console.error(`Error in passive ${file}:`, error);
                }
            });
        } else {
            client.on(passive.name, (...args) => passive.execute(...args, client));
        }
    }
}

async function registerCommands() {
    if (!client.user) {
        throw new Error('registerCommands called before client login');
    }
    const rest = new REST({ version: '10' }).setToken(config.token);
    // Guild commands update instantly, global ones can take up to an hour
    const route = config.testGuildId
        ? Routes.applicationGuildCommands(client.user.id, config.testGuildId)
        : Routes.applicationCommands(client.user.id);
    await rest.put(route, {
        body: client.commands.map(cmd => cmd.data)
    });
    const scope = config.testGuildId ? `guild ${config.testGuildId}` : 'global';
    console.log(`Registered ${client.commands.size} application commands (${scope}).`);
}

// Fails before anything else starts so a missing .env is obvious in the log
function checkConfig() {
    if (!config.token) {
        throw new Error('DISCORD_TOKEN is not set, copy env.example to .env (or env.test.example to .env.test for npm run dev) and fill it in');
    }
    if (!config.geniusToken) {
        console.warn('GENIUS_TOKEN is not set, /lyrics may fail.');
    }
    if (!config.virusTotalApiKey) {
        console.warn('VIRUSTOTAL_API_KEY is not set, link scans will fail.');
    }
    if (config.AUTHORIZED_USERS.length === 0) {
        console.warn('AUTHORIZED_USERS is empty, owner-only commands like /gag and /restart will refuse everyone.');
    }
}

// Fetch the latest yt-dlp binary before DisTube uses it. YouTube changes break
// stale binaries, so this runs on every boot. Failure is non-fatal (the existing
// binary, if any, is kept) but always logged.
async function updateYtDlp() {
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('yt-dlp update timed out')), YTDLP_UPDATE_TIMEOUT_MS));
    try {
        const version = await Promise.race([downloadYtDlp(), timeout]);
        console.log(`yt-dlp updated to ${version}.`);
        return true;
    } catch (error) {
        console.error('yt-dlp update failed (keeping existing binary):', error.message);
        return false;
    }
}

function startHealthServer() {
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
    });
    server.on('error', (error) => console.error('Health server error:', error.message));
    server.listen(HEALTH_PORT, () => console.log(`Health server listening on ${HEALTH_PORT}.`));
    return server;
}

// Build DisTube. Construct YtDlpPlugin with update disabled because updateYtDlp()
// already fetched the latest binary in a controlled, logged, awaited step.
function setupDisTube() {
    client.distube = new DisTube(client, {
        emitNewSongOnly: true,
        emitAddSongWhenCreatingQueue: false,
        emitAddListWhenCreatingQueue: false,
        plugins: [new SpotifyPlugin(), new YtDlpPlugin()]
    });
}

// --- Event wiring -----------------------------------------------------------

client.once('ready', async () => {
    console.log('Bot is online!');
    try {
        await registerCommands();
    } catch (error) {
        console.error('Command registration error:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                return;
            }
            await command.execute(interaction, client);
            return;
        }

        if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
            const prefix = (interaction.customId || '').split(':')[0];
            const handler = client.components.get(prefix);
            if (!handler) {
                return;
            }
            await handler.execute(interaction, client);
        }
    } catch (error) {
        console.error('Interaction error:', error);
        if (interaction.isRepliable && interaction.isRepliable()) {
            const payload = { content: 'There was an error processing that interaction.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    }
});

// Explicit messageCreate wiring for the function-only passives. The {name}-based
// passives (currency, channel watcher, link scanner) are auto-registered in
// loadPassives(), so they are intentionally NOT called here (avoids double-firing).
client.on('messageCreate', async (message) => {
    if (message.author.bot) {
        return;
    }
    try {
        await messageLogger(message);
    } catch (error) {
        console.error('Error logging message:', error);
    }
    try {
        await checkAndReplaceBannedWords(message.author, message.channel, message);
    } catch (error) {
        console.error('Error checking banned words:', error);
    }
});

// --- Graceful shutdown ------------------------------------------------------

async function shutdown(signal) {
    console.log(`Received ${signal}, shutting down gracefully...`);

    const countdown = client.commands.get('countdown');
    if (countdown && typeof countdown.cleanup === 'function') {
        countdown.cleanup();
    }

    for (const guild of client.guilds.cache.values()) {
        const connection = getVoiceConnection(guild.id);
        if (connection) {
            connection.destroy();
        }
    }

    await client.destroy();
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// --- Startup sequence -------------------------------------------------------

async function start() {
    checkConfig();
    loadCommands();
    loadComponents();
    loadPassives();

    await dbManager.initializeDatabases();
    console.log('Databases initialized, running migrations...');
    await runMigrations();
    console.log('Migrations complete.');

    startHealthServer();
    await updateYtDlp();
    setupDisTube();
    require('./passives/musicEvents').register(client);

    console.log('The Editor start sequence completed. Logging in...');
    await client.login(config.token);
}

start().catch((error) => {
    console.error('Fatal startup error:', error);
    process.exit(1);
});
