const dbManager = require('../database/dbManager');

// Run cleanup every 24 hours
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

module.exports = {
    name: 'ready',
    execute: async (client) => {
        console.log('Starting watched channel cleanup task...');
        
        // Run immediately on startup, then periodically
        performCleanup(client);
        setInterval(() => performCleanup(client), CLEANUP_INTERVAL);
    }
};

async function performCleanup(client) {
    const db = dbManager.getDatabase('watched_channels_db');
    
    db.all("SELECT DISTINCT channel_id FROM watched_channels", async (err, rows) => {
        if (err) {
            console.error('Error during watched channel cleanup:', err);
            return;
        }
        
        if (!rows || rows.length === 0) {
            return;
        }
        
        let removedCount = 0;
        
        for (const row of rows) {
            try {
                // Try to fetch the channel
                const channel = await client.channels.fetch(row.channel_id);
                if (!channel) {
                    throw new Error('Channel not found');
                }
            } catch (error) {
                // Channel no longer exists or bot lost access
                console.log(`Removing inaccessible watched channel: ${row.channel_id}`);
                
                db.run(
                    "DELETE FROM watched_channels WHERE channel_id = ?",
                    [row.channel_id],
                    (err) => {
                        if (err) {
                            console.error(`Error removing channel ${row.channel_id}:`, err);
                        } else {
                            removedCount++;
                        }
                    }
                );
            }
        }
        
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} inaccessible watched channels`);
        }
        
    });
}