const { EmbedBuilder } = require('@discordjs/builders');
const axios = require('axios');
const config = require('../config.json'); // Adjust the path as necessary

module.exports = {
  name: 'messageCreate',
  execute: async (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const urlRegex = /(https?:\/\/[^\s]+)/g; // Simple regex for URLs
    const urls = message.content.match(urlRegex);
    if (!urls) return; // If no URLs, do nothing

    const apiKey = config.virusTotalApiKey;
    const reportEmbed = new EmbedBuilder()
      .setTitle('VirusTotal Scan Results')
      .setColor(0x3498db);

    for (const url of urls) {
      try {
        const response = await axios.post(`https://www.virustotal.com/api/v3/urls`, 
          `url=${encodeURIComponent(url)}`,
          {
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        // Assuming the response has a data object with a report URL or some summary
        reportEmbed.addFields({ name: `URL: ${url}`, value: `Scan report: [View Report](${response.data.data.attributes.reportUrl})` });
      } catch (error) {
        console.error(`Failed to scan URL ${url}:`, error);
        reportEmbed.addFields({ name: `URL: ${url}`, value: `Error scanning URL` });
      }
    }

    message.channel.send({ embeds: [reportEmbed] });
  }
};