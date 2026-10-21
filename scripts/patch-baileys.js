import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('node_modules/@whiskeysockets/baileys/lib/Utils/decode-wa-message.js');

if (!fs.existsSync(file)) {
  console.error('No se encontró Baileys en node_modules. Ejecuta npm install desde la raíz del proyecto.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');

if (source.includes('retrying with stanza-provided PN/LID pairing')) {
  console.log('Baileys: el arreglo LID/PN ya está aplicado.');
  process.exit(0);
}

const importPattern = /import\s*\{([^}]+)\}\s*from\s*(['"][^'"]*WABinary[^'"]*['"])/s;
const importMatch = source.match(importPattern);
if (!importMatch) {
  throw new Error('No se encontró el import de WABinary; no se modificó Baileys.');
}
if (!/\bisLidUser\b/.test(importMatch[1])) {
  source = source.replace(importPattern, (whole, names, modulePath) => {
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

if (!casePattern.test(source)) {
  throw new Error('No se reconoció el bloque de descifrado de Baileys 6.7.x; no se modificó el archivo.');
}

source = source.replace(casePattern, replacement);
fs.writeFileSync(file, source);
console.log('Baileys: arreglo LID/PN aplicado correctamente.');
