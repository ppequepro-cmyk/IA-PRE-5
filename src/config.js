import 'dotenv/config';

function numberFromEnv(name, fallback, min = 0) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

export const config = {
  ownerNumber: (process.env.OWNER_NUMBER ?? '').replace(/\D/g, ''),
  botName: process.env.BOT_NAME?.trim() || 'IA-PRE-5',
  aiBaseUrl: (process.env.AI_BASE_URL ?? '').trim().replace(/\/$/, ''),
  aiApiKey: (process.env.AI_API_KEY ?? '').trim(),
  aiModel: (process.env.AI_MODEL ?? '').trim(),
  maxHistoryMessages: numberFromEnv('MAX_HISTORY_MESSAGES', 12, 2),
  maxOutputTokens: numberFromEnv('MAX_OUTPUT_TOKENS', 700, 64),
  privateCooldownMs: numberFromEnv('PRIVATE_COOLDOWN_MS', 1200, 0),
  groupCooldownMs: numberFromEnv('GROUP_COOLDOWN_MS', 2500, 0)
};

export function validateConfig() {
  const missing = [];
  if (!config.ownerNumber) missing.push('OWNER_NUMBER');
  if (!config.aiBaseUrl) missing.push('AI_BASE_URL');
  if (!config.aiApiKey) missing.push('AI_API_KEY');
  if (!config.aiModel) missing.push('AI_MODEL');
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}. Revisa .env.example.`);
  }
}
