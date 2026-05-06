require('dotenv').config();
const path = require('path');

module.exports = {
    port: process.env.PORT || 3001,
    ffmpegPath: 'C:\\ffmpeg\\bin\\ffmpeg.exe',
    videosPath: 'C:\\inetpub\\Unik_MS\\video_\\private_videos',

    db: {
        host: 'localhost',
        user: 'root',
        password: '96Qm7fn_',
        database: '_api_'
    },

    concurrency: 1,
    tempPath: path.join(__dirname, 'temp'),
    // Usamos HTTP (127.0.0.1) para evitar bloqueos del protocolo file://
    renderStaticUrl: `http://127.0.0.1:3001/static/index.html`
};
