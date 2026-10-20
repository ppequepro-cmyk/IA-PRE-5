import makeWASocket,{DisconnectReason,useMultiFileAuthState,fetchLatestBaileysVersion} from '@whiskeysockets/baileys';
import pino from 'pino';
import {config,validateConfig} from './src/config.js';
import {addHistory,allowResponse,getHistory,getMessageText,isGroupJid,normalizeJid,isCreatorRequest,isComplaintMessage} from './src/behavior.js';
import {askAI} from './src/ai.js';
const log=pino({level:process.env.LOG_LEVEL||'info'}), seen=new Set();
function phone(jid=''){return normalizeJid(jid).split('@')[0].split('.')[0];}
function owner(jid){return !!config.ownerNumber&&phone(jid)===config.ownerNumber;}
async function start(){
  validateConfig();
  const {state,saveCreds}=await useMultiFileAuthState('auth_info');
  let version;
  try{({version}=await fetchLatestBaileysVersion());}catch(e){log.warn({err:e},'No se pudo consultar la versión de Baileys');}
  const sock=makeWASocket({...(version?{version}:{}),auth:state,logger:pino({level:'silent'}),printQRInTerminal:true,markOnlineOnConnect:false,generateHighQualityLinkPreview:false,syncFullHistory:false});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',({connection,lastDisconnect})=>{
    if(connection==='open') log.info('WhatsApp conectado');
    if(connection==='close'){
      const code=lastDisconnect?.error?.output?.statusCode;
      log.warn({code},'Conexión cerrada');
      if(code!==DisconnectReason.loggedOut) setTimeout(()=>start().catch(e=>log.error({err:e},'Error al reconectar')),3000);
      else log.error('Sesión cerrada desde WhatsApp. Revisa la sesión local antes de volver a vincular.');
    }
  });
  sock.ev.on('messages.upsert',async({messages,type})=>{
    if(type!=='notify') return;
    for(const msg of messages){
      try{
        if(!msg.message||msg.key.fromMe) continue;
        const chat=msg.key.remoteJid, sender=msg.key.participant??chat, id=msg.key.id;
        if(!chat||chat==='status@broadcast') continue;
        if(id&&seen.has(id)) continue;
        if(id){seen.add(id);if(seen.size>2000) seen.delete(seen.values().next().value);}
        const text=getMessageText(msg), group=isGroupJid(chat);
        const decision=allowResponse({chatJid:chat,senderJid:sender,isGroup:group,text,message:msg,botJid:sock.user?.id??'',cooldownMs:group?config.groupCooldownMs:config.privateCooldownMs});
        if(!decision.allowed) continue;
        if(decision.command==='creator'){
          await sock.sendMessage(chat,{text:'🤖 Creador: Emmanuel\\nProyecto: '+config.botName},{quoted:msg}); continue;
        }
        if(/^!(stats|anuncio|ban)\\b/i.test(text)){
          if(!owner(sender)){await sock.sendMessage(chat,{text:'⛔ Comando reservado al propietario.'},{quoted:msg});continue;}
          await sock.sendMessage(chat,{text:'Ese comando aún no está habilitado en esta etapa.'},{quoted:msg});continue;
        }
        const prompt=group?text.replace(/(^|[^\\p{L}\\p{N}])(ia|bot)(?=$|[^\\p{L}\\p{N}])/iu,' ').trim():text;
        if(!prompt) continue;
        const history=getHistory(chat,config.maxHistoryMessages);
        await sock.sendPresenceUpdate('composing',chat);
        const answer=await askAI([...history,{role:'user',content:prompt}]);
        addHistory(chat,'user',prompt,config.maxHistoryMessages);
        addHistory(chat,'assistant',answer,config.maxHistoryMessages);
        await sock.sendMessage(chat,{text:answer},{quoted:msg});
        await sock.sendPresenceUpdate('paused',chat);
      }catch(error){
        log.error({err:error},'Error procesando mensaje');
        try{await sock.sendMessage(msg.key.remoteJid,{text:'No pude procesar ese mensaje. Revisa el proveedor de IA y los registros.'},{quoted:msg});}catch{}
      }
    }
  });
}
start().catch(e=>{log.fatal({err:e},'No se pudo iniciar IA-PRE-5');process.exitCode=1;});