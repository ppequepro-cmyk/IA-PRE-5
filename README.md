# IA-PRE-5

Asistente de IA para WhatsApp. Esta primera etapa crea una base ejecutable para conexión, chat de texto y control anti-spam.

## Estado de funciones

- [x] Base Node.js con módulos ES.
- [x] Privado: responde a mensajes de texto sin comando.
- [x] Grupo: responde solo si detecta “IA”, “bot” como palabra independiente o una mención al bot.
- [x] Comando público `!creador`.
- [x] Historial temporal por chat y límites básicos de frecuencia.
- [x] Configuración por variables de entorno y secretos excluidos de Git.
- [ ] Visión y edición de imágenes, stickers y portadas.
- [ ] Edición de video y creación de notas de audio/video.
- [ ] Lectura y resumen de PDF.
- [ ] Tareas, recordatorios y horarios persistentes.
- [ ] Estadísticas, anuncios y moderación real con permisos.
- [ ] Mensajes de una sola vista: requiere comprobar soporte y pruebas reales.

## Instalación

Requiere Node.js 20 o superior y un proveedor compatible con `POST /chat/completions`.

```bash
npm install
cp .env.example .env
npm run check
npm start
```

Configura en `.env`:
- `OWNER_NUMBER`: número del propietario con código de país, solo dígitos.
- `AI_BASE_URL`: URL base del proveedor, sin `/chat/completions`.
- `AI_API_KEY`: clave privada del proveedor.
- `AI_MODEL`: identificador de modelo disponible en tu cuenta.

Vincula WhatsApp escaneando el QR. La sesión se guarda en `auth_info/`, excluida de Git.

## Limitaciones

El historial está en memoria y se pierde al reiniciar. Esta etapa procesa texto, no imágenes ni archivos. Las funciones pendientes no se consideran terminadas hasta integrar sus dependencias y probarlas. Baileys es una biblioteca no oficial de WhatsApp y su compatibilidad puede cambiar.