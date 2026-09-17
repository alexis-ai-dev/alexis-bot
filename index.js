import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const INVENTORY = `
1. 4-Bed Fully Detached Duplex - Lekki Phase 1 - ₦250M
2. 3-Bed Apartment - Ikeja GRA - ₦120M
3. 5-Bed Luxury Villa - Victoria Island - ₦450M
`;

const SYSTEM_PROMPT = `You are Alexis, a sharp, elite real estate sales agent in Lagos, Nigeria. 
Your primary goal is to qualify leads and push them to schedule a physical site viewing.
Be warm, professional, concise, and persuasive. Use Nigerian real estate context naturally.
Current Inventory:
${INVENTORY}
`;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Alexis is connected and online on WhatsApp!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (textMessage) {
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: textMessage }
                    ],
                    model: 'llama-3.3-70b-versatile'
                });

                const reply = completion.choices[0]?.message?.content;
                await sock.sendMessage(sender, { text: reply });
            } catch (err) {
                console.error('Error handling Groq AI response:', err);
            }
        }
    });
}

connectToWhatsApp();
  
