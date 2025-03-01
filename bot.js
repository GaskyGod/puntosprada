const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

const TOKEN = '7965986756:AAEvmDIZCvPqIqJ9TsfpozInKHcnSGyiZl8'; // Reemplázalo con tu nuevo token seguro
const DATA_FILE = 'points.json';
const bot = new TelegramBot(TOKEN, { polling: true });

// Cargar datos
let points = {};
if (fs.existsSync(DATA_FILE)) {
    points = JSON.parse(fs.readFileSync(DATA_FILE));
}

// Guardar datos
function savePoints() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(points, null, 2));
}

// Verificar si el usuario de Habbo existe y obtener imagen actualizada
async function checkHabboUser(username) {
    const timestamp = Date.now(); // Evita el caché agregando un timestamp único
    const imageUrl = `https://www.habbo.es/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=3&head_direction=3&gesture=sml&action=&size=l&nocache=${timestamp}`;
    try {
        const response = await axios.head(imageUrl);
        if (response.status === 200) {
            return imageUrl;
        }
    } catch (error) {
        return null;
    }
}

// Comando para añadir puntos
bot.onText(/\/puntos ([\S]+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1].toLowerCase(); // Convertir a minúsculas
    const amount = parseInt(match[2]);

    const imageUrl = await checkHabboUser(username);
    if (!imageUrl) {
        bot.sendMessage(chatId, `❌ Nombre de usuario no existe: ${username}`);
        return;
    }

    if (!points[username]) {
        points[username] = 0;
    }
    points[username] += amount;
    savePoints();

    bot.sendPhoto(chatId, imageUrl, { caption: `✅ Se añadieron ${amount} puntos a ${username}. Total: ${points[username]} puntos.` });
});

// Comando para restar puntos
bot.onText(/\/restar ([\S]+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1].toLowerCase(); // Convertir a minúsculas
    const amount = parseInt(match[2]);

    const imageUrl = await checkHabboUser(username);
    if (!imageUrl) {
        bot.sendMessage(chatId, `❌ Nombre de usuario no existe: ${username}`);
        return;
    }

    if (!points[username]) {
        points[username] = 0;
    }
    points[username] = Math.max(0, points[username] - amount);
    savePoints();

    bot.sendPhoto(chatId, imageUrl, { caption: `❌ Se restaron ${amount} puntos a ${username}. Total: ${points[username]} puntos.` });
});

// Comando para ver puntos
bot.onText(/\/verpuntos ([\S]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1].toLowerCase(); // Convertir a minúsculas

    const imageUrl = await checkHabboUser(username);
    if (!imageUrl) {
        bot.sendMessage(chatId, `❌ Nombre de usuario no existe: ${username}`);
        return;
    }

    const userPoints = points[username] || 0;
    bot.sendPhoto(chatId, imageUrl, { caption: `📊 ${username} tiene ${userPoints} puntos.` });
});

// Comando para ver el ranking
bot.onText(/\/top/, (msg) => {
    const chatId = msg.chat.id;
    const { pageContent, totalPages } = getRankingPage(1);

    bot.sendMessage(chatId, `🏆 Ranking de puntos (Página 1/${totalPages}):\n${pageContent}`, {
        reply_markup: {
            inline_keyboard: totalPages > 1 ? [[{ text: 'Siguiente ➡', callback_data: 'top_2' }]] : []
        }
    });
});

function getRankingPage(page = 1, pageSize = 100) {
    const ranking = Object.entries(points)
        .sort((a, b) => b[1] - a[1])
        .map(([user, pts], index) => `${index + 1}. ${user} - ${pts} puntos`);

    const totalPages = Math.ceil(ranking.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageContent = ranking.slice(start, end).join('\n') || 'No hay jugadores con puntos.';

    return { pageContent, totalPages };
}

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (data.startsWith('top_')) {
        const page = parseInt(data.split('_')[1]);
        const { pageContent, totalPages } = getRankingPage(page);

        const buttons = [];
        if (page > 1) buttons.push({ text: '⬅ Anterior', callback_data: `top_${page - 1}` });
        if (page < totalPages) buttons.push({ text: 'Siguiente ➡', callback_data: `top_${page + 1}` });

        bot.editMessageText(`🏆 Ranking de puntos (Página ${page}/${totalPages}):\n${pageContent}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [buttons] }
        });
    }
});


// Comando para limpiar toda la lista
bot.onText(/\/limpiar/, (msg) => {
    const chatId = msg.chat.id;
    points = {};
    savePoints();
    bot.sendMessage(chatId, `🗑️ Se han eliminado todos los puntos.`);
});
