const VARIATION_SELECTOR_START = 0xfe00;
const VARIATION_SELECTOR_END = 0xfe0f;

const VARIATION_SELECTOR_SUPPLEMENT_START = 0xe0100;
const VARIATION_SELECTOR_SUPPLEMENT_END = 0xe01ef;

function toVariationSelector(byte) {
    if (byte >= 0 && byte < 16) {
        return String.fromCodePoint(VARIATION_SELECTOR_START + byte);
    } else if (byte >= 16 && byte < 256) {
        return String.fromCodePoint(VARIATION_SELECTOR_SUPPLEMENT_START + byte - 16);
    } else {
        return null;
    }
}

function fromVariationSelector(codePoint) {
    if (codePoint >= VARIATION_SELECTOR_START && codePoint <= VARIATION_SELECTOR_END) {
        return codePoint - VARIATION_SELECTOR_START;
    } else if (codePoint >= VARIATION_SELECTOR_SUPPLEMENT_START && codePoint <= VARIATION_SELECTOR_SUPPLEMENT_END) {
        return codePoint - VARIATION_SELECTOR_SUPPLEMENT_START + 16;
    } else {
        return null;
    }
}

function encodeEmoji(emoji, text) {
    const bytes = new TextEncoder().encode(text);
    let encoded = emoji;

    for (const byte of bytes) {
        encoded += toVariationSelector(byte);
    }

    return encoded;
}

function decodeEmoji(text) {
    let decoded = [];
    const chars = Array.from(text);

    for (const char of chars) {
        const byte = fromVariationSelector(char.codePointAt(0));

        if (byte === null && decoded.length > 0) {
            break;
        } else if (byte === null) {
            continue;
        }

        decoded.push(byte);
    }

    let decodedArray = new Uint8Array(decoded);
    return new TextDecoder().decode(decodedArray);
}

export { encodeEmoji, decodeEmoji };
