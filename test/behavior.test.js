import test from 'node:test';
import assert from 'node:assert/strict';
import {allowResponse,getMessageText,isGroupJid,isCreatorCommand} from '../src/behavior.js';

test('privado permite mensajes sin comando',()=>{
  const r=allowResponse({chatJid:'123@s.whatsapp.net',senderJid:'123@s.whatsapp.net',isGroup:false,text:'Hola',message:{message:{conversation:'Hola'}},botJid:'999@s.whatsapp.net',cooldownMs:0});
  assert.equal(r.allowed,true);
});
test('grupo ignora mensajes sin activador',()=>{
  const r=allowResponse({chatJid:'abc@g.us',senderJid:'123@s.whatsapp.net',isGroup:true,text:'hola a todos',message:{message:{conversation:'hola a todos'}},botJid:'999@s.whatsapp.net',cooldownMs:0});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,'group-not-addressed');
});
test('grupo permite la palabra IA',()=>{
  const r=allowResponse({chatJid:'abc@g.us',senderJid:'123@s.whatsapp.net',isGroup:true,text:'IA explícame esto',message:{message:{conversation:'IA explícame esto'}},botJid:'999@s.whatsapp.net',cooldownMs:0});
  assert.equal(r.allowed,true);
});
test('extrae texto y reconoce comandos públicos',()=>{
  assert.equal(getMessageText({message:{conversation:'prueba'}}),'prueba');
  assert.equal(isCreatorCommand('!creador'),true);
  assert.equal(isGroupJid('abc@g.us'),true);
});