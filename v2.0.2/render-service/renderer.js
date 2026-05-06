const { chromium } = require('playwright');
const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');

async function process(renderId) {
    let connection;
    let browser;
    const tempDir = path.join(config.tempPath, `render_${renderId}`);

    try {
        await fs.ensureDir(tempDir);
        connection = await mysql.createConnection(config.db);

        const [rows] = await connection.execute('SELECT * FROM video_renders WHERE id = ?', [renderId]);
        if (rows.length === 0) throw new Error('Tarea no encontrada en BD');
        const task = rows[0];
        const dataJson = JSON.parse(task.data_json);

        console.log(`[Renderer] Localizando recursos para Render ID: ${renderId}...`);
        //  console.log('Data JSON:', dataJson);
        await localizeAssets(dataJson, tempDir);

        await connection.execute('UPDATE video_renders SET estado = "procesando" WHERE id = ?', [renderId]);

        // DEBUG: ¿El archivo existe físicamente?
        if (dataJson.video && dataJson.video.includes('127.0.0.1')) {
            const vName = path.basename(dataJson.video);
            const vPath = path.join(tempDir, vName);
            console.log(`[Debug] Verificando archivo: ${vPath}`);
            console.log(`[Debug] ¿Existe en disco?: ${await fs.pathExists(vPath)}`);
        }

        browser = await chromium.launch({
            // Forzamos la ruta del Chrome real de tu Windows para tener los códecs
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: [
                '--disable-gpu',
                '--no-sandbox',
                '--disable-web-security',
                '--allow-file-access-from-files',
                '--autoplay-policy=no-user-gesture-required',
                '--mute-audio'
            ]
        });
        const page = await browser.newPage();

        // Ajustamos la ventana al tamaño real del video/canvas (usando tus variables ancho/alto)
        await page.setViewportSize({
            width: dataJson.ancho || 1280,
            height: dataJson.alto || 720
        });

        // Logs del navegador para ver si algo falla internamente
        page.on('console', msg => console.log('[Browser]', msg.text()));

        // Rastreo de Red Total para encontrar el 404
        page.on('request', request => {
            // Opcional: console.log(`[Request] ${request.url()}`);
        });
        page.on('requestfailed', request => {
            console.log(`[Network Error] ${request.url()} - ${request.failure()?.errorText}`);
        });
        page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`[Network ${response.status()}] ${response.url()}`);
            }
        });

        await page.goto(config.renderStaticUrl);

        await page.evaluate(async (json) => {
            await window.loadJsonAndRender(json);
        }, dataJson);

        const fps = 30;
        const startTime = parseFloat(dataJson.inicio) || 0;

        // Le preguntamos al motor la duración real basada en la física de las marquesinas
        const durationSec = await page.evaluate(() => window.getCalculatedDuration());

        const totalFrames = Math.ceil(durationSec * fps);
        console.log(`[Renderer] Duración calculada por física: ${durationSec}s (${totalFrames} frames)`);
        console.log(`[Renderer] Iniciando render: ${totalFrames} frames (${durationSec}s a ${fps}fps)`);

        for (let i = 0; i < totalFrames; i++) {
            await page.evaluate(async ({ i, fps, startTime }) => {
                await window.renderFrame(i, fps, startTime);
            }, { i, fps, startTime });

            const framePath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}.jpg`);
            await page.screenshot({ path: framePath, type: 'jpeg', quality: 90 });

            if (i % 30 === 0) console.log(`[Renderer] Frame ${i}/${totalFrames} capturado...`);
        }

        await browser.close();

        const outputFilename = `${task.nombre_usuario}_${task.remate}_${task.lote}_${Date.now()}.mp4`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const outputPath = path.join(config.videosPath, outputFilename);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(config.ffmpegPath, [
                '-framerate', String(fps),
                '-i', path.join(tempDir, 'frame_%04d.jpg'),
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-y',
                outputPath
            ]);
            ffmpeg.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg falló con código ${code}`));
            });
        });

        const stats = await fs.stat(outputPath);
        const tamanoKb = Math.round(stats.size / 1024);
        console.log(`[Renderer] Video generado: ${outputFilename} (${tamanoKb} KB)`);
        await connection.execute(
            'UPDATE video_renders SET estado = "completado", nombre_archivo = ?, tamano_kb = ?, fecha_creacion = NOW() WHERE id = ?',
            [outputFilename, tamanoKb, renderId]
        );

    } catch (err) {
        console.error(`[Renderer] Error en pipeline:`, err);
        throw err;
    } finally {
        if (connection) await connection.end();
        if (browser) await browser.close();
        // await fs.remove(tempDir).catch(e => {});
    }
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Fallo descarga: Código ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function localizeAssets(obj, tempDir) {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'string' && val.startsWith('http')) {
            if (val.match(/\.(png|jpg|jpeg|gif|svg|mp4|webm|mp3|wav|mov)/i) || key === 'video' || key === 'src') {
                try {
                    const ext = path.extname(val.split('?')[0]) || '.dat';
                    const filename = `asset_${Math.random().toString(36).substr(2, 9)}${ext}`;
                    const localPath = path.join(tempDir, filename);
                    await downloadFile(val, localPath);

                    // IMPORTANTE: Ruta HTTP relativa a nuestro servidor Express (usamos 127.0.0.1)
                    const taskFolderName = path.basename(tempDir);
                    obj[key] = `http://127.0.0.1:3001/temp/${taskFolderName}/${filename}`;
                } catch (e) {
                    console.warn(`[Localize] Error: ${val}`, e.message);
                }
            }
        } else if (typeof val === 'object') {
            await localizeAssets(val, tempDir);
        }
    }
}

module.exports = { process };
