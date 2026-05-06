const express = require('express');
const async = require('async');
const config = require('./config');
const renderer = require('./renderer');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));

// Cabeceras CORS para evitar cualquier bloqueo del navegador
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

// Servimos las carpetas para que Chromium las vea vía HTTP (evita bloqueos file://)
app.use('/static', express.static(path.join(__dirname, 'render-static')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/assets', express.static(path.join(__dirname, 'render-static/assets')));

const queue = async.queue(async (task) => {
    console.log(`[Queue] Iniciando tarea para Render ID: ${task.renderId}`);
    try {
        await renderer.process(task.renderId);
        console.log(`[Queue] Tarea finalizada con éxito: ${task.renderId}`);
    } catch (err) {
        console.error(`[Queue] Error procesando tarea ${task.renderId}:`, err);
        try {
            const connection = await mysql.createConnection(config.db);
            await connection.execute(
                'UPDATE video_renders SET estado = "error", error_msg = ? WHERE id = ?',
                [err.message, task.renderId]
            );
            await connection.end();
        } catch (dbErr) {
            console.error('[Queue] No se pudo actualizar estado de error en BD:', dbErr);
        }
    }
}, config.concurrency);

app.post('/render', (req, res) => {
    const { renderId } = req.body;
    if (!renderId) return res.status(400).json({ error: 'renderId es requerido' });
    queue.push({ renderId });
    res.json({ success: true, message: 'Tarea encolada' });
});

app.get('/status', (req, res) => {
    res.json({ online: true, queueSize: queue.length(), running: queue.running() });
});

app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`Video Render Service (V2.0.2) en puerto ${config.port}`);
    console.log(`=========================================`);
});
