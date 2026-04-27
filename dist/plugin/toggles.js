const RINDAMAN_ON_COMMANDS = new Set([
    "/rindaman on",
    "rindaman on",
    "/quality on",
    "quality on",
    "/strict on",
    "strict mode",
    "be strict",
]);
const RINDAMAN_OFF_COMMANDS = new Set([
    "/rindaman off",
    "rindaman off",
    "/quality off",
    "quality off",
    "/strict off",
    "normal mode",
    "stop strict",
]);
export const normalizeCommandText = (text) => text
    .trim()
    .toLowerCase()
    .replace(/^[\s"'`([{]+|[\s"'`)\]}!,.?:;]+$/g, "");
export const getRindamanToggle = (text) => {
    const normalizedFullText = normalizeCommandText(text);
    if (RINDAMAN_ON_COMMANDS.has(normalizedFullText)) {
        return true;
    }
    if (RINDAMAN_OFF_COMMANDS.has(normalizedFullText)) {
        return false;
    }
    const lines = text
        .split(/\r?\n/)
        .map((line) => normalizeCommandText(line))
        .filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
        const line = lines[index];
        if (RINDAMAN_ON_COMMANDS.has(line)) {
            return true;
        }
        if (RINDAMAN_OFF_COMMANDS.has(line)) {
            return false;
        }
    }
    return undefined;
};
export const getRindamanEnabled = (messages, getMessageRole, getMessageText) => {
    let enabled = true;
    for (const message of messages) {
        if (getMessageRole(message) !== "user") {
            continue;
        }
        const text = getMessageText(message);
        if (!text) {
            continue;
        }
        const toggle = getRindamanToggle(text);
        if (typeof toggle === "boolean") {
            enabled = toggle;
        }
    }
    return enabled;
};
