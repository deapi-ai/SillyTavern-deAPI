// deAPI Images for SillyTavern.
// Generates images through deAPI's OpenAI-compatible endpoint and posts them to the chat
// the same way the built-in Image Generation extension does.

import { saveBase64AsFile } from '../../../utils.js';
import { MEDIA_DISPLAY, MEDIA_SOURCE, MEDIA_TYPE } from '../../../constants.js';

const MODULE = 'deapi_images';
const VERSION = '0.1.0';
const ENDPOINT = 'https://oai.deapi.ai/v1/images/generations';
const MODELS_ENDPOINT = 'https://oai.deapi.ai/v1/models';
// Tells deAPI which integration a request came from. No user data.
const SOURCE_HEADER = { 'X-Deapi-Source': `sillytavern/${VERSION}` };

const defaults = Object.freeze({
    apiKey: '',
    model: 'ZImageTurbo_INT8',
    size: '512x512',
    prefix: '',
});

function ctx() {
    return SillyTavern.getContext();
}

function settings() {
    const all = ctx().extensionSettings;
    all[MODULE] = Object.assign({}, defaults, all[MODULE] || {});
    return all[MODULE];
}

function errorText(status, body) {
    const message = body?.error?.message || body?.message || '';
    if (status === 401) return 'The deAPI key is missing or wrong. Check it in Extensions → deAPI Images.';
    if (status === 402) return 'Your deAPI balance is too low for this image.';
    if (message) return `deAPI: ${message}`;
    return `deAPI request failed (HTTP ${status}).`;
}

/**
 * Asks deAPI for one image and returns its base64 PNG data.
 * @param {string} prompt
 * @param {AbortSignal} [signal]
 */
async function requestImage(prompt, signal) {
    const s = settings();
    if (!s.apiKey) {
        throw new Error('Add your deAPI key in Extensions → deAPI Images first.');
    }
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.apiKey}`,
            ...SOURCE_HEADER,
        },
        body: JSON.stringify({
            model: s.model || defaults.model,
            prompt,
            size: s.size || defaults.size,
            n: 1,
            response_format: 'b64_json',
        }),
        signal,
    });
    let body = null;
    try {
        body = await response.json();
    } catch {
        // Non-JSON error bodies are reported by status alone.
    }
    if (!response.ok) {
        throw new Error(errorText(response.status, body));
    }
    const data = body?.data?.[0]?.b64_json;
    if (!data) {
        throw new Error('deAPI returned no image.');
    }
    return data;
}

/**
 * Generates an image and posts it to the current chat. Returns the saved image URL.
 * @param {string} rawPrompt
 */
async function generateToChat(rawPrompt) {
    const context = ctx();
    const prompt = [settings().prefix, String(rawPrompt || '').trim()].filter(Boolean).join(', ');
    if (!prompt) {
        toastr.warning('Describe the image first, e.g. /deapi-image a castle at dusk.', 'deAPI Images');
        return '';
    }
    const chatId = context.getCurrentChatId();
    const toast = toastr.info('Generating…', 'deAPI Images', { timeOut: 0, extendedTimeOut: 0 });
    try {
        const b64 = await requestImage(prompt);
        if (chatId !== context.getCurrentChatId()) {
            toastr.warning('Chat changed, the image was discarded.', 'deAPI Images');
            return '';
        }
        const character = context.characterId !== undefined ? context.characters[context.characterId]?.name : undefined;
        const fileName = `deapi_${Date.now()}`;
        const url = await saveBase64AsFile(b64, character || 'deapi', fileName, 'png');
        const message = {
            name: context.groupId ? 'System' : (context.name2 || 'deAPI'),
            is_user: false,
            is_system: false,
            send_date: new Date().toLocaleString(),
            mes: prompt,
            extra: {
                media: [{ url, type: MEDIA_TYPE.IMAGE, title: prompt, source: MEDIA_SOURCE.GENERATED }],
                media_display: MEDIA_DISPLAY.GALLERY,
                media_index: 0,
                inline_image: false,
            },
        };
        context.chat.push(message);
        const id = context.chat.length - 1;
        await context.eventSource.emit(context.eventTypes.MESSAGE_RECEIVED, id, 'extension');
        context.addOneMessage(message);
        await context.eventSource.emit(context.eventTypes.CHARACTER_MESSAGE_RENDERED, id, 'extension');
        await context.saveChat();
        return url;
    } catch (error) {
        console.error('[deAPI Images]', error);
        toastr.error(error.message || String(error), 'deAPI Images');
        return '';
    } finally {
        toastr.clear(toast);
    }
}

async function testKey() {
    const status = $('#deapi_images_status');
    status.text('Checking…');
    try {
        const response = await fetch(MODELS_ENDPOINT, {
            headers: { Authorization: `Bearer ${settings().apiKey}`, ...SOURCE_HEADER },
        });
        status.text(response.ok ? '✓ Key works' : errorText(response.status, await response.json().catch(() => null)));
    } catch (error) {
        status.text(`Could not reach deAPI: ${error.message}`);
    }
}

async function loadSettingsUi() {
    const html = await (await fetch(new URL('./settings.html', import.meta.url))).text();
    $('#extensions_settings2').append(html);
    const s = settings();
    const bind = (id, key) => {
        $(id).val(s[key]).on('input change', function () {
            settings()[key] = String($(this).val()).trim();
            ctx().saveSettingsDebounced();
        });
    };
    bind('#deapi_images_key', 'apiKey');
    bind('#deapi_images_model', 'model');
    bind('#deapi_images_size', 'size');
    bind('#deapi_images_prefix', 'prefix');
    $('#deapi_images_test').on('click', testKey);
}

function addWandButton() {
    const button = $(`
        <div id="deapi_images_wand" class="list-group-item flex-container flexGap5" title="Generate an image with deAPI">
            <div class="fa-solid fa-image extensionsMenuExtensionButton"></div>
            <span>deAPI image</span>
        </div>`);
    button.on('click', async () => {
        const { Popup, POPUP_TYPE } = ctx();
        const last = ctx().chat.findLast(m => !m.is_system)?.mes || '';
        const prompt = await Popup.show.input('deAPI image', 'Describe the image:', last.slice(0, 400));
        if (prompt) {
            await generateToChat(String(prompt));
        }
    });
    $('#extensionsMenu').append(button);
}

function registerCommand() {
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = ctx();
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'deapi-image',
        returns: 'URL of the generated image, or an empty string if generation failed',
        callback: async (_args, prompt) => generateToChat(String(prompt ?? '')),
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'what the image should show',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Generates an image with deAPI and posts it to the chat, e.g. <code>/deapi-image a castle at dusk</code>.',
    }));
}

jQuery(async () => {
    settings();
    await loadSettingsUi();
    addWandButton();
    registerCommand();
});
