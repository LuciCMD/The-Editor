// Custom DisTube extractor that shells out to the yt-dlp binary managed by
// @distube/yt-dlp, but fixes two problems with that package's built-in plugin:
//
//   1. It passed the deprecated `--no-call-home` flag, and recent yt-dlp prints
//      "Deprecated Feature: ..." to stderr.
//   2. Its wrapper merged stderr INTO stdout and JSON.parsed the combined text,
//      so ANY stderr line (a deprecation, a warning) crashed playback with
//      "Unexpected token ... is not valid JSON".
//
// Here we parse stdout ONLY (stderr is used solely for error messages) and never
// pass deprecated flags, so warnings can't break extraction again. The binary is
// still downloaded/updated by @distube/yt-dlp's `download()` (called in app.js).

const path = require('path');
const { spawn } = require('child_process');
const { PlayableExtractorPlugin, Playlist, Song, DisTubeError } = require('distube');

const IS_WINDOWS = Boolean(process.env.YTDLP_IS_WINDOWS) || process.platform === 'win32';
const YTDLP_DIR = process.env.YTDLP_DIR
    || path.join(path.dirname(require.resolve('@distube/yt-dlp')), '..', 'bin');
const YTDLP_FILENAME = process.env.YTDLP_FILENAME || `yt-dlp${IS_WINDOWS ? '.exe' : ''}`;
const YTDLP_PATH = path.join(YTDLP_DIR, YTDLP_FILENAME);

const BASE_ARGS = ['--dump-single-json', '--no-warnings', '--prefer-free-formats', '--skip-download', '--simulate'];

const isPlaylist = (info) => Array.isArray(info.entries);

// Run yt-dlp and resolve with parsed stdout JSON. Rejects with an error whose
// `.stderr` holds yt-dlp's diagnostics.
function ytdlpJson(url, extraArgs = []) {
    return new Promise((resolve, reject) => {
        const child = spawn(YTDLP_PATH, [url, ...BASE_ARGS, ...extraArgs]);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk; });
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', (code) => {
            if (code !== 0) {
                const err = new Error(`yt-dlp exited with code ${code}`);
                err.stderr = stderr.trim();
                return reject(err);
            }
            try {
                resolve(JSON.parse(stdout));
            } catch (parseError) {
                const err = new Error('Failed to parse yt-dlp output');
                err.stderr = (stderr || stdout).trim();
                reject(err);
            }
        });
    });
}

function buildSong(plugin, info, options) {
    return new Song({
        plugin,
        source: info.extractor,
        playFromSource: true,
        id: info.id,
        name: info.title || info.fulltitle,
        url: info.webpage_url || info.original_url,
        isLive: info.is_live,
        thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails[0] && info.thumbnails[0].url),
        duration: info.is_live ? 0 : info.duration,
        uploader: { name: info.uploader, url: info.uploader_url },
        views: info.view_count,
        likes: info.like_count,
        dislikes: info.dislike_count,
        reposts: info.repost_count,
        ageRestricted: Boolean(info.age_limit) && info.age_limit >= 18
    }, options);
}

class YtDlpPlugin extends PlayableExtractorPlugin {
    // Catch-all extractor: keep it LAST in the DisTube plugins array.
    validate() {
        return true;
    }

    async resolve(url, options) {
        const info = await ytdlpJson(url).catch((e) => {
            throw new DisTubeError('YTDLP_ERROR', `${e.stderr || e.message || e}`);
        });

        if (isPlaylist(info)) {
            if (info.entries.length === 0) {
                throw new DisTubeError('YTDLP_ERROR', 'The playlist is empty');
            }
            return new Playlist({
                source: info.extractor,
                songs: info.entries.map((entry) => buildSong(this, entry, options)),
                id: String(info.id),
                name: info.title,
                url: info.webpage_url,
                thumbnail: info.thumbnails && info.thumbnails[0] && info.thumbnails[0].url
            }, options);
        }
        return buildSong(this, info, options);
    }

    async getStreamURL(song) {
        if (!song.url) {
            throw new DisTubeError('YTDLP_PLUGIN_INVALID_SONG', 'Cannot get stream url from invalid song.');
        }
        const info = await ytdlpJson(song.url, ['--format', 'ba/ba*']).catch((e) => {
            throw new DisTubeError('YTDLP_ERROR', `${e.stderr || e.message || e}`);
        });
        if (isPlaylist(info)) {
            throw new DisTubeError('YTDLP_ERROR', 'Cannot get stream URL of an entire playlist');
        }
        return info.url;
    }

    getRelatedSongs() {
        return [];
    }
}

module.exports = { YtDlpPlugin, ytdlpJson, YTDLP_PATH };
