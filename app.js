const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const config = require('./config.json');
const checkGag = require('./passives/checkGag');
const currencyHandler = require('./passives/messageCurrency');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildVoiceStates] });

const volumeFilePath = path.join(__dirname, 'volume_state.json');

// Read the volume states from the file
function loadVolumeStates() {
    if (fs.existsSync(volumeFilePath)) {
        return JSON.parse(fs.readFileSync(volumeFilePath, 'utf8'));
    }
    return {};
}

// Collection to store the commands
client.commands = new Collection();

// Load commands from main directory and subdirectories
const commandDirectories = fs.readdirSync('./commands', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

for (const dir of commandDirectories) {
    const commandFiles = fs.readdirSync(path.join('./commands', dir))
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(__dirname, './commands', dir, file));
        if (command.data && command.data.name) {
            client.commands.set(command.data.name, command);
        } else {
            console.error(`Command file ${file} does not have a valid 'data.name' property.`);
        }
    }
}

const registerCommands = async () => {
    const data = new REST({ version: '10' }).setToken(config.token);

    await data.put(Routes.applicationCommands(client.user.id), {
        body: client.commands.map(cmd => cmd.data)
    });
};

// Passive event handler loading
const passiveFiles = fs.readdirSync('./passives').filter(file => file.endsWith('.js'));
for (const file of passiveFiles) {
    const passive = require(`./passives/${file}`);
    if (passive.name && typeof passive.execute === "function" && passive.name !== 'messageCreate') {
        client.on(passive.name, passive.execute);
    }
}

client.once('ready', async () => {
    console.log('Bot is online!');

    // Load volume states into the client object
    client.volumeStates = loadVolumeStates();

    // Set the volume for each guild based on the loaded volume states
    for (const [guildId, volume] of Object.entries(client.volumeStates)) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const queue = client.distube.getQueue(guild);
            if (queue) {
                client.distube.setVolume(guild, volume);
            }
        }
    }

    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error trying to execute that command!', ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    // Log message details
    if (message.content) {
        console.log(`Message Received: ${message.author.username}#${message.author.discriminator} - ${message.content}`);
    } else if (message.attachments.size > 0) {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} contains attachments.`);
    } else if (message.embeds.length > 0) {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} contains embeds.`);
    } else {
        console.log(`Message from ${message.author.username}#${message.author.discriminator} received without text content.`);
    }

    // Handle the gag check
    const wasGagged = await checkGag(message.author, message.channel, message);
    if (wasGagged) {
        // If the message was from a gagged user, return early
        return;
    }

    // If the message isn't from a gagged user, handle the currency addition
    currencyHandler.execute(message);
});

const Distube = require("distube");
const YtDlpPlugin = require("@distube/yt-dlp").YtDlpPlugin;
const SpotifyPlugin = require("@distube/spotify").SpotifyPlugin;

client.distube = new Distube.default(client, {
    leaveOnEmpty: true,
    emptyCooldown: 30,
    leaveOnFinish: false,
    emitNewSongOnly: true,
    nsfw: true,
    youtubeCookie: process.env.ytcookie,
    plugins: [new SpotifyPlugin(), new YtDlpPlugin()]
});

client.distube.on("playSong", async (queue, song) => {
    await new Promise(r => setTimeout(r, 4000))  // Wait for 2 seconds
    if (!queue || !queue.guild || !queue.guild.id) {
        console.error('Invalid queue object during playSong event.');
        return;
    }
    const guildId = queue.guild.id;
    const savedVolume = client.volumeStates[guildId];
    if (savedVolume) {
        client.distube.setVolume(queue.guild, savedVolume);
    }
});


client.login(config.token);