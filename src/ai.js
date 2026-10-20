import { config } from './config.js';

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
        {
          role: 'system',
          content: 'Eres un asistente útil en español. Explica temas escolares con claridad y adapta el nivel al usuario. No inventes resultados de herramientas que no hayas ejecutado.'
        },
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
