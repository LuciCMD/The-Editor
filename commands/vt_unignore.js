const dbManager = require('../database/dbManager');
const { checkPermission } = require('../utils/permissions');

module.exports = {
    data: {
        name: 'vt_unignore',
        description: 'Remove a domain from the VirusTotal ignore list (requires special permission)',
        options: [
            {
                name: 'domain',
                type: 3,
                description: 'The domain to remove from ignore list',
                required: true
            }
        ]
    },

    async execute(interaction, client) {
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
            const removed = await new Promise((resolve, reject) => {
                db.run(
                    "DELETE FROM vt_ignore_domains WHERE domain = ?",
                    [cleanDomain],
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        resolve(this.changes > 0);
                    }
                );
            });

            if (removed) {
                await interaction.reply({
                    content: `Successfully removed "${cleanDomain}" from the VirusTotal ignore list.`
                });
            } else {
                await interaction.reply({
                    content: `"${cleanDomain}" is not in the ignore list.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error removing domain from ignore list:', error);
            await interaction.reply({
                content: 'An error occurred while removing the domain.',
                ephemeral: true
            });
        }
    }
};
