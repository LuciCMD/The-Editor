const { EmbedBuilder } = require('@discordjs/builders');
const axios = require('axios');
const config = require('../config.json'); // Adjust the path as necessary

module.exports = {
  name: 'messageCreate',
  execute: async (message, client) => {
    if (message.author.bot) return; // Ignore bot messages

    const urlRegex = /(https?:\/\/[^\s]+)/g; // Simple regex for URLs
    const urls = message.content.match(urlRegex);

    // If no URLs, do nothing
    if (!urls) { 
      console.log('No URLs found in message content');
      return;
    } 

    // Filter out tenor.com URLs
    const filteredUrls = urls.filter(url => !url.startsWith('https://tenor.com/'));

    // If no URLs left after filtering, do nothing
    if (filteredUrls.length === 0) {
      console.log('No URLs left after filtering');
      return;
    } 

    const apiKey = config.virusTotalApiKey;
    const reportEmbed = new EmbedBuilder()
      .setTitle('VirusTotal Scan Results')
      .setColor(0x3498db);

    for (const url of filteredUrls) {
      try {
        // Step 1: Submit the URL for scanning
        console.log('Submitting URL for scanning:', url);
        const submitResponse = await axios.post('https://www.virustotal.com/api/v3/urls',
          `url=${encodeURIComponent(url)}`,
          {
            headers: {
              'x-apikey': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        const analysisId = submitResponse.data.data.id;

        // Step 2: Wait for analysis to complete (with timeout)
        let analysisComplete = false;
        let attempts = 0;
        let analysisResponse;

        while (!analysisComplete && attempts < 5) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds

          analysisResponse = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
            headers: {
              'x-apikey': apiKey
            }
          });

          if (analysisResponse.data.data.attributes.status === 'completed') {
            console.log(`URL ${url} analysis completed after ${attempts} attempts`);
            analysisComplete = true;
          }

          attempts++;
        }

        if (!analysisComplete) {
          console.log(`URL ${url} analysis timed out after ${attempts} attempts`);
          reportEmbed.addFields({ name: `URL: ${url}`, value: 'Analysis timed out. Please try again later.' });
          continue;
        }

        const stats = analysisResponse.data.data.attributes.stats;
        const reportUrl = `https://www.virustotal.com/gui/url/${analysisResponse.data.meta.url_info.id}/detection`;

        reportEmbed.addFields({ 
          name: `URL: ${url}`, 
          value: `Malicious: ${stats.malicious}, Suspicious: ${stats.suspicious}, Clean: ${stats.harmless}\n[View Full Report](${reportUrl})`
        });

      } catch (error) {
        console.error(`Failed to scan URL ${url}:`, error.response ? error.response.data : error.message);
        reportEmbed.addFields({ name: `URL: ${url}`, value: `Error scanning URL: ${error.message}` });
      }
    }

    if (reportEmbed.data.fields && reportEmbed.data.fields.length > 0) {
      await message.channel.send({ embeds: [reportEmbed] }).catch(error => {
        console.error('Failed to send embed:', error);
      });
    }
  }
};