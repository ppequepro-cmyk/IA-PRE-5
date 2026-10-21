import fs from 'node:fs';
import path from 'node:path';

const baileysFile = path.resolve('node_modules/@whiskeysockets/baileys/lib/Utils/decode-wa-message.js');
const signalFile = path.resolve('node_modules/libsignal/src/session_cipher.js');

if (!fs.existsSync(baileysFile)) {
  throw new Error('No se encontró Baileys en node_modules. Ejecuta npm install desde la raíz del proyecto.');
}

let baileys = fs.readFileSync(baileysFile, 'utf8');

if (!baileys.includes('retrying with stanza-provided PN/LID pairing')) {
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*(['"][^'"]*WABinary[^'"]*['"])/s;
  const importMatch = baileys.match(importPattern);
  if (!importMatch) {
    throw new Error('No se encontró el import de WABinary; no se modificó Baileys.');
  }

  if (!/\bisLidUser\b/.test(importMatch[1])) {
    baileys = baileys.replace(importPattern, (whole, names, modulePath) => {
      const updatedNames = names.trimEnd().endsWith(',')
        ? names + '\n    isLidUser,'
        : names + ',\n    isLidUser';
      return `import {${updatedNames}\n} from ${modulePath}`;
    });
  }

  const casePattern = /case 'pkmsg':\s*case 'msg':[\s\S]*?\n\s*break;/;
  const replacement = `case 'pkmsg':
                            case 'msg': {
                                const user = isJidUser(sender) ? sender : author;
                                try {
                                    msgBuffer = await repository.decryptMessage({
                                        jid: user,
                                        type: e2eType,
                                        ciphertext: content
                                    });
                                } catch (err) {
                                    const altUser = isLidUser(user)
                                        ? (stanza.attrs.participant_pn || stanza.attrs.sender_pn)
                                        : (stanza.attrs.participant_lid || stanza.attrs.sender_lid);
                                    if (!altUser || altUser === user) throw err;
                                    logger.debug(
                                        { key: fullMessage.key, primary: user, retryWith: altUser },
                                        'primary identity failed to decrypt, retrying with stanza-provided PN/LID pairing'
                                    );
                                    try {
                                        msgBuffer = await repository.decryptMessage({
                                            jid: altUser,
                                            type: e2eType,
                                            ciphertext: content
                                        });
                                    } catch {
                                        throw err;
                                    }
                                }
                                break;
                            }`;

  if (!casePattern.test(baileys)) {
    throw new Error('No se reconoció el bloque de descifrado de Baileys 6.7.x; no se modificó ese archivo.');
  }

  baileys = baileys.replace(casePattern, replacement);
  fs.writeFileSync(baileysFile, baileys);
  console.log('Baileys: arreglo LID/PN aplicado.');
} else {
  console.log('Baileys: el arreglo LID/PN ya estaba aplicado.');
}

if (!fs.existsSync(signalFile)) {
  throw new Error('No se encontró node_modules/libsignal/src/session_cipher.js.');
}

let signal = fs.readFileSync(signalFile, 'utf8');
const noisyHeader = 'console.error("Failed to decrypt message with any known session...");';
const noisyDetail = 'console.error("Session error:" + e, e.stack);';
const quietHeader = 'if (process.env.LIBSIGNAL_DEBUG === \'1\') console.error("Failed to decrypt message with any known session...");';
const quietDetail = 'if (process.env.LIBSIGNAL_DEBUG === \'1\') console.error("Session error:" + e, e.stack);';

if (signal.includes(noisyHeader)) {
  signal = signal.replace(noisyHeader, quietHeader);
}
if (signal.includes(noisyDetail)) {
  signal = signal.replace(noisyDetail, quietDetail);
}

if (signal.includes(noisyHeader) || signal.includes(noisyDetail)) {
  throw new Error('No se pudo silenciar de forma segura el registro repetitivo de libsignal.');
}

fs.writeFileSync(signalFile, signal);
console.log('libsignal: errores de descifrado repetitivos silenciados. Para diagnóstico detallado, usa LIBSIGNAL_DEBUG=1.');
