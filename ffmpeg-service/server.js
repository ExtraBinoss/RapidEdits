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

    console.log(`[${sessionId}] Session initialized`);
    res.json({ sessionId });
});

// 2. Upload Frame
app.post('/render/frame/:sessionId/:frameIndex', upload.single('frame'), (req, res) => {
    const { sessionId, frameIndex } = req.params;
    
    if (!sessions[sessionId]) {
        return res.status(404).json({ error: 'Session not found' });
    }

    // Just acknowledge
    sessions[sessionId].frameCount++;
    res.json({ success: true });
});

// 3. Finish Upload & Start Render
app.post('/render/finish/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];

    if (!session) return res.status(404).json({ error: 'Session not found' });

    session.status = 'processing';
    console.log(`[${sessionId}] Starting render...`);

    const inputPattern = path.join(UPLOAD_DIR, sessionId, 'frame_%05d.png');
    const outputFilename = `render_${sessionId}.${session.config.format}`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // Run FFmpeg
    ffmpeg()
        .input(inputPattern)
        .inputFPS(session.config.fps || 30)
        .size(`${session.config.width}x${session.config.height}`)
        .output(outputPath)
        .outputFPS(session.config.fps || 30)
        .videoCodec(session.config.format === 'webm' ? 'libvpx-vp9' : 'libx264')
        .outputOptions(
            session.config.format === 'webm' 
                ? ['-deadline realtime', '-cpu-used 4'] 
                : ['-preset ultrafast', '-tune fastdecode']
        )
        .format(session.config.format)
        .on('progress', (progress) => {
            // Note: fluent-ffmpeg progress object is tricky with image sequences
            // We might just fake it or use 'percent' if available
            if (progress.percent) {
                session.progress = Math.min(99, progress.percent);
            }
        })
        .on('end', () => {
             console.log(`[${sessionId}] Render complete`);
             session.status = 'done';
             session.progress = 100;
             session.outputFile = outputFilename;
             
             // Cleanup temp frames? Maybe later
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
