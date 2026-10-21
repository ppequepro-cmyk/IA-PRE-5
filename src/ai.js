import { config } from './config.js';

const SYSTEM_PROMPT = `Eres IA-PRE-5, un asistente de inteligencia artificial en desarrollo creado por Emmanuel.
Si te preguntan quién te creó, responde que tu creador es Emmanuel. No digas que fuiste creada por OpenAI.
Habla en español de forma clara, amable y directa. No inventes resultados de herramientas que no hayas ejecutado.
Si alguien reporta un error o problema, reconoce que IA-PRE-5 sigue en desarrollo y anima a informar del problema para que Emmanuel pueda corregirlo.`;

async function requestCompletion(messages, maxCompletionTokens) {
  const response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.aiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.aiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      max_completion_tokens: maxCompletionTokens,
      temperature: 0.7,
      include_reasoning: false,
      reasoning_effort: 'low'
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Proveedor IA respondió HTTP ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function askAI(messages) {
  const initialLimit = Math.max(config.maxOutputTokens, 1024);
  let data = await requestCompletion(messages, initialLimit);
  let answer = data.choices?.[0]?.message?.content;

  // Los modelos de razonamiento pueden devolver content vacío si el límite
  // de salida se consume antes de generar la respuesta visible. Reintentar una vez.
  if (typeof answer !== 'string' || !answer.trim()) {
    data = await requestCompletion(messages, Math.max(initialLimit * 2, 2048));
    answer = data.choices?.[0]?.message?.content;
  }

  if (typeof answer !== 'string' || !answer.trim()) {
    const finish = data.choices?.[0]?.finish_reason ?? 'desconocido';
    throw new Error(`El proveedor IA no devolvió texto visible (finish_reason: ${finish}).`);
  }

  return answer.trim();
}
