const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const config = require('./config.json');
const messageLogger = require('./passives/messageLogger');
const checkAndReplaceBannedWords = require('./passives/checkGag');
const currencyHandler = require('./passives/messageCurrency');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildVoiceStates] });

// Collection to store the commands
client.commands = new Collection();

// Load commands from main directory and subdirectories
const commandDirectories = ['.', ...fs.readdirSync('./commands', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)];

for (const dir of commandDirectories) {
    const commandFiles = fs.readdirSync(path.join('./commands', dir))
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(path.join(__dirname, './commands', dir, file));
        if (command.data && command.data.name) {
            client.commands.set(command.data.name, command);
            console.log(`Loading command: ${command.data.name}`);
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

    // Save message to file
    try {
        await messageLogger(message);
    } catch (error) {
        console.error('Error logging message:', error);
    }

    // Check for banned words and gags
    await checkAndReplaceBannedWords(message.author, message.channel, message);

    // If the message isn't from a gagged or banned word user, handle the currency addition
    currencyHandler.execute(message);
});

const Distube = require("distube");
const YtDlpPlugin = require("@distube/yt-dlp").YtDlpPlugin;
const SpotifyPlugin = require("@distube/spotify").SpotifyPlugin;
const proxies = require('./proxies.json');

// Function to get a random proxy from the list
function getRandomProxy() {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
}

const randomProxyUrl = getRandomProxy(); // Get a random proxy URL
console.log(`Using proxy: ${randomProxyUrl}`);

client.distube = new Distube.default(client, {
    leaveOnEmpty: true,
    emptyCooldown: 30,
    leaveOnFinish: false,
    emitNewSongOnly: true,
    nsfw: true,
    youtubeCookie: process.env.ytcookie,
    plugins: [new SpotifyPlugin(), new YtDlpPlugin({
        requestOptions: {
            proxy: randomProxyUrl,
        },
    })]
});

console.log('Ruin Jellyfish start sequence completed.');
client.login(config.token);