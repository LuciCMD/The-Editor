const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function saveMessageToFile(message) {
    if (!message.guild) return; // Ignore direct messages

    const guildFolder = path.join(__dirname, '..', 'logs', message.guild.name.replace(/[^a-z0-9]/gi, '_').toLowerCase());
    if (!fs.existsSync(guildFolder)) {
        fs.mkdirSync(guildFolder, { recursive: true });
    }

    const logFilePath = path.join(guildFolder, 'messages.txt');
    const messageContent = `${new Date().toISOString()} - ${message.author.tag}: ${message.content}\n`;

    fs.appendFileSync(logFilePath, messageContent);

    if (message.attachments.size > 0) {
        const attachmentsFolder = path.join(guildFolder, 'Attachments');
        if (!fs.existsSync(attachmentsFolder)) {
            fs.mkdirSync(attachmentsFolder, { recursive: true });
        }

        for (const [key, attachment] of message.attachments) {
            const attachmentUrl = attachment.url;
            const fileName = path.join(attachmentsFolder, attachment.name);
            const writer = fs.createWriteStream(fileName);

            const response = await axios({
                url: attachmentUrl,
                method: 'GET',
                responseType: 'stream'
            });

            response.data.pipe(writer);

            new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        }
    }
}

module.exports = saveMessageToFile;
