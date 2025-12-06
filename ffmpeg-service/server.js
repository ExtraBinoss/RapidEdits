const express = require('express');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 4001;

// Middleware
app.use(cors());
app.use(express.json());

// Storage for temp frames
const UPLOAD_DIR = path.join(__dirname, 'temp_uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Configure Multer for frame uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const sessionId = req.params.sessionId;
        const sessionDir = path.join(UPLOAD_DIR, sessionId);
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }
        cb(null, sessionDir);
    },
    filename: (req, file, cb) => {
        const frameIndex = req.params.frameIndex;
        // Padding for ffmpeg sequence pattern (e.g., frame_0001.png)
        const paddedIndex = frameIndex.toString().padStart(5, '0');
        cb(null, `frame_${paddedIndex}.png`);
    }
});

const upload = multer({ storage: storage });

// Session Store (InMemory for now)
const sessions = {};

// --- Endpoints ---

// 0. Status / Ping
app.get('/status', (req, res) => {
    // Check ffmpeg availability (simple version)
    ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: 'FFmpeg not responding', error: err.message });
        }
        res.json({ status: 'ok', message: 'FFmpeg Service is ready', ffmpeg: 'available' });
    });
});

// 1. Initialize Session
app.post('/render/init', (req, res) => {
    const { width, height, fps, format } = req.body;
    const sessionId = uuidv4();
    
    sessions[sessionId] = {
        id: sessionId,
        config: { width, height, fps, format: format || 'mp4' },
        status: 'uploading', // uploading, processing, done, error
        progress: 0,
        frameCount: 0,
        startTime: Date.now()
    };

    // Create dir
    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    console.log(`[${sessionId}] Session Initialized`);
    console.log(`[${sessionId}] Config: ${width}x${height} @ ${fps}fps, Format: ${format || 'mp4'}`);
    res.json({ sessionId });
});

// 2. Upload Chunk (Binary Append)
app.post('/render/append/:sessionId', express.raw({ type: 'application/octet-stream', limit: '50mb' }), (req, res) => {
    const { sessionId } = req.params;
    
    if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }

    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    const tempVideoPath = path.join(sessionDir, 'temp_video.raw');
    const chunkSize = req.body.length;

    // Append binary data to file
    fs.appendFile(tempVideoPath, req.body, (err) => {
        if (err) {
            console.error(`[${sessionId}] Append error:`, err);
            return res.status(500).json({ error: 'Failed to append data' });
        }
        
        const session = sessions[sessionId];
        session.progress += 1; // logical tick
        if (!session.totalBytes) session.totalBytes = 0;
        session.totalBytes += chunkSize;

        console.log(`[${sessionId}] Received Chunk: ${(chunkSize / 1024).toFixed(2)} KB | Total: ${(session.totalBytes / 1024 / 1024).toFixed(2)} MB`);
        res.json({ success: true });
    });
});

// 3. Finish Upload & Start Render
app.post('/render/finish/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'processing';
    
    const outputFilename = `render_${sessionId}.${session.config.format}`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    const sessionDir = path.join(UPLOAD_DIR, sessionId);
    const tempVideoPath = path.join(sessionDir, 'temp_video.raw');

    const inputFps = session.config.fps || 30;
    const outputFps = session.config.fps || 30;
    // For WebM we re-encode, for MP4 (if compatible) we might just copy, but here we default to copy for H.264 input.
    // If format is webm, we must transcode.
    const isWebM = session.config.format === 'webm';
    const videoCodec = isWebM ? 'libvpx-vp9' : 'copy';
    
    const outputOptions = isWebM 
        ? ['-deadline realtime', '-cpu-used 4', '-b:v 0', '-crf 30'] 
        : ['-r ' + outputFps]; // Enforce Constant Frame Rate

    console.log(`[${sessionId}] Starting FFmpeg Mux/Transcode`);
    console.log(`[${sessionId}] Input: Raw H.264 Stream (Annex B)`);
    console.log(`[${sessionId}] Output: ${outputFilename} (${session.config.format})`);
    console.log(`[${sessionId}] FPS: ${inputFps} -> ${outputFps}`);
    console.log(`[${sessionId}] Codec: ${videoCodec}`);
    console.log(`[${sessionId}] Options: ${JSON.stringify(outputOptions)}`);

    // Assume input is H.264 raw stream if config says so, generally VideoEncoder produces AVC/H.264 annex B or similar
    const inputOptions = ['-f h264'];

    ffmpeg()
        .input(tempVideoPath)
        .inputOptions(inputOptions)
        .inputFPS(inputFps)
        .output(outputPath)
        .videoCodec(videoCodec)
        .outputOptions(outputOptions)
        .on('end', () => {
             console.log(`[${sessionId}] Render complete`);
             session.status = 'done';
             session.progress = 100;
             session.outputFile = outputFilename;
        })
        .on('error', (err) => {
            console.error(`[${sessionId}] Error:`, err);
            session.status = 'error';
            session.error = err.message;
        })
        .run();

    res.json({ success: true, message: 'Render started' });
});

// 4. Check Status
app.get('/render/status/:sessionId', (req, res) => {
    const session = sessions[req.params.sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
});

// 5. Download
app.get('/render/download/:sessionId', (req, res) => {
    const session = sessions[req.params.sessionId];
    if (!session || session.status !== 'done') {
        return res.status(400).json({ error: 'File not ready' });
    }
    
    const filePath = path.join(OUTPUT_DIR, session.outputFile);
    res.download(filePath);
});

app.listen(PORT, () => {
    console.log(`FFmpeg Service running on port ${PORT}`);
});
