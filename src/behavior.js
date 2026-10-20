const histories = new Map();
const lastResponseAt = new Map();

export function normalizeJid(jid = '') {
  return jid.split(':')[0];
}

export function getMessageText(message = {}) {
  const content = message.message ?? {};
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    content.buttonsResponseMessage?.selectedDisplayText ??
    content.listResponseMessage?.title ??
    ''
  ).trim();
}

export function isGroupJid(jid = '') {
  return jid.endsWith('@g.us');
}

export function wasBotMentioned(message, botJid, text) {
  const normalized = text.toLocaleLowerCase('es-MX');
  const explicitWord = /(^|[^\p{L}\p{N}])(ia|bot)([^\p{L}\p{N}]|$)/iu.test(normalized);
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
  const botMention = mentioned.some((jid) => normalizeJid(jid) === normalizeJid(botJid));
  return explicitWord || botMention;
}

export function isCreatorCommand(text = '') {
  return /^!creador(?:\s|$)/i.test(text.trim());
}

export function isCreatorRequest(text = '') {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(creador|creada por|creado por|quien te creo|quien te hizo|quien te desarrollo|quien te programo|quien te diseno|quien te construyo|quien te invento)\b/i.test(normalized);
}

export function isComplaintMessage(text = '') {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(queja|quejas|reclamo|reclamos|problema|problemas|error|errores|falla|fallas|fallando|bug|bugs|no funciona|no sirve|se rompio|esta roto)\b/i.test(normalized);
}

export function allowResponse({ chatJid, senderJid, isGroup, text, message, botJid, cooldownMs }) {
  if (!text) return { allowed: false, reason: 'empty' };
  if (isCreatorCommand(text)) return { allowed: true, command: 'creator' };

  // En privado se conversa sin prefijo. En grupos solo se responde con activador.
  if (isGroup && !wasBotMentioned(message, botJid, text)) {
    return { allowed: false, reason: 'group-not-addressed' };
  }

  const key = `${chatJid}:${senderJid}`;
  const now = Date.now();
  const previous = lastResponseAt.get(key) ?? 0;
  if (now - previous < cooldownMs) return { allowed: false, reason: 'cooldown' };
  lastResponseAt.set(key, now);
  return { allowed: true };
}

export function getHistory(chatJid, maxMessages) {
  const history = histories.get(chatJid) ?? [];
  return history.slice(-maxMessages);
}

export function addHistory(chatJid, role, content, maxMessages) {
  const history = histories.get(chatJid) ?? [];
  history.push({ role, content });
  histories.set(chatJid, history.slice(-maxMessages));
}

export function clearHistory(chatJid) {
  histories.delete(chatJid);
}
