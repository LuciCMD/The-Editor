const { EmbedBuilder } = require('@discordjs/builders');
const axios = require('axios');
const config = require('../utils/config');
const dbManager = require('../database/dbManager');

async function getIgnoredDomains() {
  const db = dbManager.getDatabase('virustotal_settings_db');
  return new Promise((resolve) => {
    db.all("SELECT domain FROM vt_ignore_domains", [], (err, rows) => {
      if (err) {
        console.error('Error fetching ignored domains:', err);
        resolve(['tenor.com']);
        return;
      }
      const domains = rows ? rows.map(row => row.domain) : [];
      if (domains.length === 0) {
        domains.push('tenor.com');
      }
      resolve(domains);
    });
  });
}

function isUrlIgnored(url, ignoredDomains) {
  if (!url || !ignoredDomains) {
    return false;
  }
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    for (const domain of ignoredDomains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

module.exports = {
  name: 'messageCreate',
  execute: async (message, client) => {
    if (message.author.bot) return;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex);

    if (!urls) {
      console.log('No URLs found in message content');
      return;
    }

    const ignoredDomains = await getIgnoredDomains();
    const filteredUrls = urls.filter(url => !isUrlIgnored(url, ignoredDomains));

    if (filteredUrls.length === 0) {
      console.log('No URLs left after filtering');
      return;
    }

    const apiKey = config.virusTotalApiKey;
    const reportEmbed = new EmbedBuilder()
      .setTitle('VirusTotal Scan Results')
      .setColor(0x3498db);

    let hasUnsafeUrls = false;

    for (const url of filteredUrls) {
      try {
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

        let analysisComplete = false;
        let attempts = 0;
        let analysisResponse;

        while (!analysisComplete && attempts < 5) {
          await new Promise(resolve => setTimeout(resolve, 5000));

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
          hasUnsafeUrls = true;
          continue;
        }

        const stats = analysisResponse.data.data.attributes.stats;

        if (stats.malicious > 0 || stats.suspicious > 0) {
          hasUnsafeUrls = true;
          const reportUrl = `https://www.virustotal.com/gui/url/${analysisResponse.data.meta.url_info.id}/detection`;
          reportEmbed.addFields({ 
            name: `URL: ${url}`, 
            value: `Malicious: ${stats.malicious}, Suspicious: ${stats.suspicious}, Clean: ${stats.harmless}\n[View Full Report](${reportUrl})`
          });
        } else {
          // If the URL is clean, react with a checkmark
          await message.react('✅');
        }

      } catch (error) {
        console.error(`Failed to scan URL ${url}:`, error.response ? error.response.data : error.message);
        reportEmbed.addFields({ name: `URL: ${url}`, value: `Error scanning URL: ${error.message}` });
        hasUnsafeUrls = true;
      }
    }

    if (hasUnsafeUrls && reportEmbed.data.fields && reportEmbed.data.fields.length > 0) {
      await message.channel.send({ embeds: [reportEmbed] }).catch(error => {
        console.error('Failed to send embed:', error);
      });
    }
  }
};