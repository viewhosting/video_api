const express = require('express');
const async = require('async');
const config = require('./config');
const renderer = require('./renderer');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

app.use('/static', express.static(path.join(__dirname, 'render-static')));
app.use('/temp', express.static(path.join(__dirname, 'temp')));
app.use('/assets', express.static(path.join(__dirname, 'render-static/assets')));

const queue = async.queue(async (task) => {
    const { renderId } = task;
    console.log(`[Queue] Iniciando tarea para Render ID: ${renderId}`);

    let connection;
    try {
        connection = await mysql.createConnection(config.db);

        // 1. Marcar como PROCESANDO
        await connection.execute(
            'UPDATE video_renders SET estado = "procesando", error_msg = NULL WHERE id = ?',
            [renderId]
        );

        // 2. Ejecutar Renderizado
        const result = await renderer.process(renderId);

        // 3. Marcar como COMPLETADO
        await connection.execute(
            'UPDATE video_renders SET estado = "completado", nombre_archivo = ?, tamano_kb = ?, fecha_creacion = NOW() WHERE id = ?',
            [result.fileName, result.fileSizeKb, renderId]
        );

        console.log(`[Queue] Tarea finalizada con éxito: ${renderId}`);

    } catch (err) {
        console.error(`[Queue] Error procesando tarea ${renderId}:`, err);
        try {
            if (!connection) connection = await mysql.createConnection(config.db);
            await connection.execute(
                'UPDATE video_renders SET estado = "error", error_msg = ? WHERE id = ?',
                [err.message, renderId]
            );
        } catch (dbErr) {
            console.error('[Queue] Error crítico actualizando estado de error en BD:', dbErr);
        }
    } finally {
        if (connection) await connection.end();
    }
}, config.concurrency);

app.post('/render', (req, res) => {
    const { renderId } = req.body;
    if (!renderId) return res.status(400).json({ error: 'renderId es requerido' });

    queue.push({ renderId });
    res.json({ success: true, message: 'Tarea encolada correctamente' });
});

app.get('/status', (req, res) => {
    res.json({ online: true, queueSize: queue.length(), running: queue.running() });
});

app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`Video Render Service (V2.0.2) - Integrated`);
    console.log(`Puerto: ${config.port}`);
    console.log(`Base de Datos: ${config.db.database}`);
    console.log(`=========================================`);
});
