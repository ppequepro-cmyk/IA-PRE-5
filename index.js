import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { config, validateConfig } from './src/config.js';
import {
  addHistory,
  allowResponse,
  getHistory,
  getMessageText,
  isGroupJid,
  normalizeJid
} from './src/behavior.js';
import { askAI } from './src/ai.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const seenMessages = new Set();

function phoneFromJid(jid = '') {
  return normalizeJid(jid).split('@')[0].split('.')[0];
}

function isOwner(senderJid) {
  return Boolean(config.ownerNumber) && phoneFromJid(senderJid) === config.ownerNumber;
}

async function start() {
  validateConfig();
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (error) {
    logger.warn({ err: error }, 'No se pudo consultar la versión más reciente; Baileys usará su valor predeterminado.');
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') logger.info('WhatsApp conectado.');
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      logger.warn({ code }, 'Conexión cerrada.');
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => start().catch((error) => logger.error({ err: error }, 'No se pudo reconectar.')), 3000);
      } else {
        logger.error('Sesión cerrada desde WhatsApp. Borra la sesión local solo si quieres vincular de nuevo.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        if (!message.message || message.key.fromMe) continue;
        const chatJid = message.key.remoteJid;
        const senderJid = message.key.participant ?? chatJid;
        if (!chatJid || chatJid === 'status@broadcast') continue;

        const messageId = message.key.id;
        if (messageId && seenMessages.has(messageId)) continue;
        if (messageId) {
          seenMessages.add(messageId);
          if (seenMessages.size > 2000) seenMessages.delete(seenMessages.values().next().value);
        }

        const text = getMessageText(message);
        const group = isGroupJid(chatJid);
        const decision = allowResponse({
          chatJid,
          senderJid,
          isGroup: group,
          text,
          message,
          botJid: sock.user?.id ?? '',
          cooldownMs: group ? config.groupCooldownMs : config.privateCooldownMs
        });

        if (!decision.allowed) continue;

        if (decision.command === 'creator') {
          await sock.sendMessage(chatJid, {
            text: '🤖 Creador: Emmanuel\nProyecto: IA-PRE-5'
          }, { quoted: message });
          continue;
        }

        // Los comandos administrativos nunca se ejecutan por usuarios no autorizados.
        if (/^!(stats|anuncio|ban)\b/i.test(text) && !isOwner(senderJid)) {
          await sock.sendMessage(chatJid, { text: '⛔ Ese comando está reservado al propietario.' }, { quoted: message });
          continue;
        }

        const prompt = group
          ? text.replace(/(^|[^\p{L}\p{N}])(ia|bot)(?=$|[^\p{L}\p{N}])/iu, ' ').trim()
          : text;
        if (!prompt) continue;

        const history = getHistory(chatJid, config.maxHistoryMessages);
        await sock.sendPresenceUpdate('composing', chatJid);
        const answer = await askAI([...history, { role: 'user', content: prompt }]);
        addHistory(chatJid, 'user', prompt, config.maxHistoryMessages);
        addHistory(chatJid, 'assistant', answer, config.maxHistoryMessages);
        await sock.sendMessage(chatJid, { text: answer }, { quoted: message });
        await sock.sendPresenceUpdate('paused', chatJid);
      } catch (error) {
        logger.error({ err: error }, 'Error procesando mensaje.');
        try {
          await sock.sendMessage(message.key.remoteJid, {
            text: 'No pude procesar ese mensaje. Revisa la conexión del proveedor de IA y los registros del bot.'
          }, { quoted: message });
        } catch {}
      }
    }
  });
}

start().catch((error) => {
  logger.fatal({ err: error }, 'No se pudo iniciar IA-PRE-5.');
  process.exitCode = 1;
});
