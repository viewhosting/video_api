const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const config = require('./config');
const mysql = require('mysql2/promise');

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Fallo al descargar: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function getTaskFromDB(renderId) {
    const connection = await mysql.createConnection(config.db);
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM video_renders WHERE id = ?',
            [renderId]
        );
        if (rows.length === 0) throw new Error(`No se encontró el render con ID ${renderId}`);
        return rows[0];
    } finally {
        await connection.end();
    }
}

async function process(renderId) {
    const dbRecord = await getTaskFromDB(renderId);
    let dataJson;
    try {
        dataJson = typeof dbRecord.data_json === 'string' ? JSON.parse(dbRecord.data_json) : dbRecord.data_json;
    } catch (e) {
        throw new Error("El campo data_json no es un JSON válido.");
    }

    const renderFolder = path.join(config.tempPath, `render_${renderId}`);
    if (!fs.existsSync(renderFolder)) fs.mkdirSync(renderFolder, { recursive: true });

    console.log(`[Renderer] Gestionando recursos para Render ID: ${renderId}...`);

    if (dataJson.video) {
        const videoFileName = path.basename(dataJson.video);
        const videoLocalPath = path.join(renderFolder, videoFileName);

        if (dataJson.video.startsWith('http')) {
            console.log(`[Renderer] Descargando video desde URL: ${dataJson.video}`);
            await downloadFile(dataJson.video, videoLocalPath);
            console.log(`[Renderer] Descarga completada.`);
        } else if (!fs.existsSync(videoLocalPath)) {
            const videoGlobalPath = path.join(config.videosPath, videoFileName);
            if (fs.existsSync(videoGlobalPath)) {
                fs.copyFileSync(videoGlobalPath, videoLocalPath);
                console.log(`[Renderer] Video copiado desde private_videos.`);
            }
        }

        // El navegador siempre lee la versión local servida por Express
        dataJson.video = `http://127.0.0.1:3001/temp/render_${renderId}/${videoFileName}`;
    }

    let browser;
    try {
        browser = await chromium.launch({
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
        await page.setViewportSize({ width: dataJson.ancho || 1024, height: dataJson.alto || 816 });

        page.on('console', msg => console.log('[Browser]', msg.text()));

        await page.goto(config.renderStaticUrl);

        await page.evaluate(async (json) => {
            await window.loadJsonAndRender(json);
        }, dataJson);

        const fps = 30;
        const startTime = parseFloat(dataJson.inicio) || 0;
        const durationSec = await page.evaluate(() => window.getCalculatedDuration());
        const totalFrames = Math.ceil(durationSec * fps);

        console.log(`[Renderer] Iniciando render: ${totalFrames} frames`);

        for (let i = 0; i < totalFrames; i++) {
            await page.evaluate(async ({ frame, fps, start }) => {
                await window.renderFrame(frame, fps, start);
            }, { frame: i, fps, start: startTime });

            const framePath = path.join(renderFolder, `frame_${String(i).padStart(5, '0')}.jpg`);
            await page.screenshot({ path: framePath, type: 'jpeg', quality: 90 });
            if (i % 30 === 0) console.log(`[Renderer] Frame ${i}/${totalFrames} capturado...`);
        }

        const sanitize = (str) => (str || 'video').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const finalFileName = `render_${renderId}_${sanitize(dbRecord.lote)}_${Date.now()}.mp4`;
        const finalPath = path.join(config.videosPath, finalFileName);

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(config.ffmpegPath, [
                '-y', '-framerate', fps.toString(),
                '-i', path.join(renderFolder, 'frame_%05d.jpg'),
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
                finalPath
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    const stats = fs.statSync(finalPath);
                    resolve({ fileName: finalFileName, fileSizeKb: Math.round(stats.size / 1024) });
                    fs.readdirSync(renderFolder).forEach(file => {
                        if (file.startsWith('frame_')) fs.unlinkSync(path.join(renderFolder, file));
                    });
                } else {
                    reject(new Error(`FFmpeg error: ${code}`));
                }
            });
        });

    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { process };
