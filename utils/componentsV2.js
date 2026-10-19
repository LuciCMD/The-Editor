// Helpers for Discord "Components V2" messages.
//
// Messages flagged IsComponentsV2 CANNOT carry `content` or `embeds` — every
// visible element must be a component, and images are referenced via
// attachment:// URLs inside Thumbnail / MediaGallery components. These helpers
// centralize the flag and the builder boilerplate so command/handler code stays
// short and consistent.

const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const V2_FLAG = MessageFlags.IsComponentsV2;

function textDisplay(content) {
    if (typeof content !== 'string' || content.length === 0) {
        throw new Error('textDisplay requires a non-empty string');
    }
    return new TextDisplayBuilder().setContent(content);
}

function separator(large = false) {
    return new SeparatorBuilder()
        .setDivider(true)
        .setSpacing(large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
}

// Create a button. Pass `url` for a link button, otherwise `id` (customId) is
// required. `emoji` and `label` are optional but at least one must be present.
function button({ id, label, style = ButtonStyle.Secondary, emoji, disabled = false, url } = {}) {
    if (!url && !id) {
        throw new Error('button requires either id or url');
    }
    const b = new ButtonBuilder();
    if (url) {
        b.setStyle(ButtonStyle.Link).setURL(url);
    } else {
        b.setCustomId(id).setStyle(style);
    }
    if (label) {
        b.setLabel(label);
    }
    if (emoji) {
        b.setEmoji(emoji);
    }
    if (disabled) {
        b.setDisabled(true);
    }
    return b;
}

function buttonRow(...buttons) {
    const flat = buttons.flat().filter(Boolean);
    if (flat.length === 0 || flat.length > 5) {
        throw new Error('a button row needs between 1 and 5 buttons');
    }
    return new ActionRowBuilder().addComponents(...flat);
}

// Wrap a single select menu (string/channel/etc.) in an action row.
function selectRow(menu) {
    if (!menu) {
        throw new Error('selectRow requires a menu component');
    }
    return new ActionRowBuilder().addComponents(menu);
}

// A section with text plus a required accessory (thumbnail image or a button).
function section({ texts = [], thumbnail, accessoryButton } = {}) {
    if (!thumbnail && !accessoryButton) {
        throw new Error('section requires a thumbnail or accessoryButton');
    }
    const s = new SectionBuilder();
    for (const t of texts) {
        s.addTextDisplayComponents(textDisplay(t));
    }
    if (thumbnail) {
        s.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
    } else {
        s.setButtonAccessory(accessoryButton);
    }
    return s;
}

function mediaGallery(urls = []) {
    if (!Array.isArray(urls) || urls.length === 0) {
        throw new Error('mediaGallery requires at least one url');
    }
    const gallery = new MediaGalleryBuilder();
    for (const url of urls) {
        gallery.addItems(new MediaGalleryItemBuilder().setURL(url));
    }
    return gallery;
}

// Assemble a container from an ordered list of component builders. Each entry is
// dispatched to the matching add* method by its builder type.
function container({ color, components = [] } = {}) {
    const c = new ContainerBuilder();
    if (typeof color === 'number') {
        c.setAccentColor(color);
    }
    for (const comp of components) {
        if (comp instanceof TextDisplayBuilder) {
            c.addTextDisplayComponents(comp);
        } else if (comp instanceof SectionBuilder) {
            c.addSectionComponents(comp);
        } else if (comp instanceof SeparatorBuilder) {
            c.addSeparatorComponents(comp);
        } else if (comp instanceof ActionRowBuilder) {
            c.addActionRowComponents(comp);
        } else if (comp instanceof MediaGalleryBuilder) {
            c.addMediaGalleryComponents(comp);
        } else {
            throw new Error('unsupported container component');
        }
    }
    return c;
}

// Common "title + body (+ optional thumbnail image)" panel used by most replies.
function infoPanel({ color, heading, body, thumbnail } = {}) {
    const lines = [];
    if (heading) {
        lines.push(`## ${heading}`);
    }
    if (body) {
        lines.push(body);
    }
    const content = lines.join('\n') || '​';

    if (thumbnail) {
        return container({ color, components: [section({ texts: [content], thumbnail })] });
    }
    return container({ color, components: [textDisplay(content)] });
}

function buildPayload(opts = {}) {
    const comps = Array.isArray(opts.components) ? opts.components : [opts.components];
    let flags = V2_FLAG;
    if (opts.ephemeral) {
        flags |= MessageFlags.Ephemeral;
    }
    const payload = { components: comps, flags };
    if (opts.files && opts.files.length) {
        payload.files = opts.files;
    }
    if (opts.allowedMentions) {
        payload.allowedMentions = opts.allowedMentions;
    }
    return payload;
}

// Reply to an interaction with a V2 message, transparently using editReply when
// the interaction was already deferred/replied. Note: editReply does not accept
// flags, so a deferred reply must have been deferred with the V2 flag already.
async function reply(interaction, opts = {}) {
    if (!interaction) {
        throw new Error('reply requires an interaction');
    }
    if (interaction.deferred || interaction.replied) {
        const payload = buildPayload(opts);
        delete payload.flags;
        return interaction.editReply(payload);
    }
    return interaction.reply(buildPayload(opts));
}

// Edit the source message of a component interaction (button/select click).
async function update(interaction, opts = {}) {
    const payload = buildPayload(opts);
    delete payload.flags; // update() cannot change message flags
    return interaction.update(payload);
}

async function send(channel, opts = {}) {
    if (!channel) {
        throw new Error('send requires a channel');
    }
    return channel.send(buildPayload(opts));
}

module.exports = {
    V2_FLAG,
    textDisplay,
    separator,
    button,
    buttonRow,
    selectRow,
    section,
    mediaGallery,
    container,
    infoPanel,
    buildPayload,
    reply,
    update,
    send,
    ButtonStyle
};
