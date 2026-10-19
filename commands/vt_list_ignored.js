const dbManager = require('../database/dbManager');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'vt_list_ignored',
        description: 'List all domains in the VirusTotal ignore list'
    },

    async execute(interaction, client) {
        const db = dbManager.getDatabase('virustotal_settings_db');

        try {
            const domains = await new Promise((resolve, reject) => {
                db.all(
                    "SELECT * FROM vt_ignore_domains ORDER BY domain",
                    [],
                    (err, rows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(rows || []);
                    }
                );
            });

            if (domains.length === 0) {
                return interaction.reply({
                    content: 'No domains in the ignore list.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00AE86)
                .setTitle('VirusTotal Ignored Domains')
                .setDescription(`Total domains: ${domains.length}`)
                .setTimestamp();

            const domainList = domains.map(d => `• ${d.domain}`).join('\n');
            const maxLength = 1024;

            if (domainList.length > maxLength) {
                const chunks = [];
                let currentChunk = '';

                for (const d of domains) {
                    const line = `• ${d.domain}\n`;
                    if ((currentChunk + line).length > maxLength) {
                        chunks.push(currentChunk);
                        currentChunk = line;
                    } else {
                        currentChunk += line;
                    }
                }
                if (currentChunk) {
                    chunks.push(currentChunk);
                }

                for (let i = 0; i < chunks.length; i++) {
                    embed.addFields({
                        name: i === 0 ? 'Domains' : '\u200b',
                        value: chunks[i],
                        inline: false
                    });
                }
            } else {
                embed.addFields({
                    name: 'Domains',
                    value: domainList,
                    inline: false
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error listing ignored domains:', error);
            await interaction.reply({
                content: 'An error occurred while listing ignored domains.',
                ephemeral: true
            });
        }
    }
};
