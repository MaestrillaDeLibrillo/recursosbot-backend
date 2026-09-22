import { google } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
  // Si existe la variable en Render la parsea; si no, usa el archivo local
  credentials: process.env.GOOGLE_CREDENTIALS_JSON 
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON) 
    : undefined,
  keyFile: process.env.GOOGLE_CREDENTIALS_JSON ? undefined : 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

let keywordsCache = [];

export async function fetchKeywordsFromSheet() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A2:C', // Asegúrate de que tu pestaña se llame Sheet1 u Hoja 1
    });

    const rows = response.data.values || [];
    
    // Row[0] = activo, Row[1] = keyword, Row[2] = respuesta
    keywordsCache = rows
      .filter(row => row[0] && row[0].trim().toUpperCase() === 'TRUE')
      .map(row => ({
        trigger: row[1] ? row[1].toLowerCase().trim() : '',
        message: row[2] ? row[2].replace(/\\n/g, '\n') : '',
      }))
      .filter(rule => rule.trigger !== '');

    console.log(`[Google Sheets] Caché actualizada: ${keywordsCache.length} reglas activas.`);
  } catch (error) {
    console.error('[Google Sheets] Error al leer la hoja:', error.message);
  }
}

fetchKeywordsFromSheet();
setInterval(fetchKeywordsFromSheet, 5 * 60 * 1000);

export function getResponseForMessage(userMessageText) {
  if (!userMessageText) return null;
  const cleanText = userMessageText.toLowerCase().trim();
  
  const matchedRule = keywordsCache.find(rule => rule.trigger && cleanText.includes(rule.trigger));
  return matchedRule ? matchedRule.message : null;
}