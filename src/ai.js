import { config } from './config.js';

const SYSTEM_PROMPT = `Eres IA-PRE-5, un asistente de inteligencia artificial en desarrollo creado por Emmanuel.
Si te preguntan quién te creó, responde que tu creador es Emmanuel. No digas que fuiste creada por OpenAI.
Habla en español de forma clara, amable y directa. No inventes resultados de herramientas que no hayas ejecutado.
Si alguien reporta un error o problema, reconoce que IA-PRE-5 sigue en desarrollo y anima a informar del problema para que Emmanuel pueda corregirlo.`;

export async function askAI(messages) {
  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      max_tokens: config.maxOutputTokens,
      temperature: 0.7
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Proveedor IA respondió HTTP ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('El proveedor de IA no devolvió texto en choices[0].message.content.');
  }
  return answer.trim();
}
