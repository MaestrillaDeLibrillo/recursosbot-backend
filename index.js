import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { getResponseForMessage } from './sheets.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

// 1. Verificación del Webhook por Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Webhook] Verificado correctamente por Meta.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. Recepción de mensajes DMs
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'instagram' || body.object === 'page') {
    // Responder inmediatamente a Meta con 200 OK para evitar reintentos
    res.status(200).send('EVENT_RECEIVED');

    body.entry?.forEach(entry => {
      entry.messaging?.forEach(async (messagingEvent) => {
        const senderId = messagingEvent.sender?.id;
        const rawText = messagingEvent.message?.text;

        // Filtrar y procesar SOLAMENTE si el evento contiene un mensaje con texto
        if (rawText) {
          const cleanText = rawText.toLowerCase().trim();
          console.log(`📩 [DM Recibido] De ID: ${senderId} | Texto: "${cleanText}"`);

          // Buscar coincidencia en las reglas de Google Sheets
          const regla = reglas.find(r => r.keyword.toLowerCase().trim() === cleanText);

          if (regla) {
            console.log(`🚀 [Coincidencia] Palabra: "${cleanText}" -> Enviando respuesta: "${regla.response}"`);
            
            // Llamada a tu función existente para responder vía Graph API
            await sendInstagramMessage(senderId, regla.response);
          } else {
            console.log(`⚠️ [Sin Coincidencia] Ninguna regla en Google Sheets para: "${cleanText}"`);
          }
        }
      });
    });
  } else {
    res.sendStatus(404);
  }
});

// 3. Envío de respuesta vía Meta Graph API
async function sendInstagramMessage(recipientId, messageText) {
  try {
    const instagramAccountId = '17841443031535524';
    const url = `https://graph.facebook.com/v26.0/${instagramAccountId}/messages`;
    
    const response = await axios({
      method: 'POST',
      url: url,
      params: {
        access_token: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
      },
      data: {
        messaging_product: 'instagram',
        recipient: { id: recipientId },
        message: { text: messageText }
      },
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`[BOT] ¡Mensaje enviado exitosamente!`, response.data);
  } catch (error) {
    console.error(
      '[BOT ERROR] Fallo al enviar respuesta en Instagram:',
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
  }
}

app.listen(PORT, () => {
  console.log(`Servidor de Instagram escuchando en el puerto ${PORT}`);
});