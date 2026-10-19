const dbManager = require('../database/dbManager');
const { checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'vt_ignore',
        description: 'Add a domain to the VirusTotal ignore list (requires special permission)',
        options: [
            {
                name: 'domain',
                type: 3,
                description: 'The domain to ignore (e.g., example.com)',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const domain = interaction.options.getString('domain');

        if (!domain) {
            return interaction.reply({
                content: 'Invalid domain specified.',
                ephemeral: true
            });
        }

        const hasPerms = await checkPermission(interaction, 'virustotal_ignore');

        if (!hasPerms) {
            return interaction.reply({
                content: 'You do not have permission to manage VirusTotal ignore list. You must be a server Administrator, an authorized user, or have the virustotal_ignore permission.',
                ephemeral: true
            });
        }

        const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const db = dbManager.getDatabase('virustotal_settings_db');

        try {
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT INTO vt_ignore_domains (domain, added_by) VALUES (?, ?)",
                    [cleanDomain, userId],
                    function(err) {
                        if (err) {
                            if (err.message.includes('UNIQUE')) {
                                reject(new Error('This domain is already in the ignore list.'));
                                return;
                            }
                            reject(err);
                            return;
                        }
                        resolve(this.lastID);
                    }
                );
            });

            await interaction.reply({
                content: `Successfully added "${cleanDomain}" to the VirusTotal ignore list.`
            });
        } catch (error) {
            console.error('Error adding domain to ignore list:', error);
            await interaction.reply({
                content: error.message || 'An error occurred while adding the domain.',
                ephemeral: true
            });
        }
    }
};
