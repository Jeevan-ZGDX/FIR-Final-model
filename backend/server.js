const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Import our modules
const blockchainService = require('./services/blockchain');
const ipfsService = require('./services/ipfs');
const ocrService = require('./services/ocr');
const sttService = require('./services/stt');
const mlService = require('./services/ml');
const { validateFIRSubmission } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdir(uploadDir, { recursive: true }).then(() => {
      cb(null, uploadDir);
    }).catch(err => {
      cb(err, null);
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 2 // Max 2 files (image + audio)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'audio/wav': '.wav',
      'audio/mp3': '.mp3',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/webm': '.webm'
    };
    
    if (allowedTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Roles for an address
app.get('/api/roles/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const roles = {
      victim: await blockchainService.hasRole(address, 'VICTIM_ROLE'),
      gov: await blockchainService.hasRole(address, 'GOV_ROLE'),
      admin: await blockchainService.hasRole(address, 'DEFAULT_ADMIN_ROLE')
    };
    res.json({ success: true, address, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Contract info
app.get('/api/contract', async (req, res) => {
  try {
    const info = await blockchainService.getContractInfo();
    res.json({ success: true, ...info });
  } catch (error) {
    console.error('Error fetching contract info:', error);
    res.status(500).json({ error: 'Failed to fetch contract info' });
  }
});

/**
 * Submit FIR with OCR + STT + ML verification
 * POST /api/submitFIR
 * Body: FormData with 'image' and 'audio' files, plus 'victimAddress'
 */
app.post('/api/submitFIR', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), validateFIRSubmission, async (req, res) => {
  try {
    const { victimAddress } = req.body;
    const imageFile = req.files?.image?.[0];
    const audioFile = req.files?.audio?.[0];

    if (!imageFile || !audioFile) {
      return res.status(400).json({
        error: 'Both image and audio files are required'
      });
    }

    console.log(`Processing FIR submission for victim: ${victimAddress}`);

    // Step 1: OCR - Extract text from image
    console.log('Step 1: Running OCR on image...');
    const ocrResult = await ocrService.extractText(imageFile.path);
    
    // Step 2: STT - Transcribe audio to text
    console.log('Step 2: Transcribing audio to text...');
    const sttResult = await sttService.transcribeAudio(audioFile.path);
    
    // Step 3: ML - Calculate similarity score
    console.log('Step 3: Calculating similarity score...');
    const similarityResult = await mlService.calculateSimilarity(
      ocrResult.text, 
      sttResult.text
    );
    
    // Step 4: Prepare data for IPFS
    const firData = {
      victimAddress,
      ocrText: ocrResult.text,
      sttText: sttResult.text,
      similarityScore: similarityResult.score,
      verified: similarityResult.score >= (parseInt(process.env.SIMILARITY_THRESHOLD) || 75),
      timestamp: new Date().toISOString(),
      imageHash: ocrResult.imageHash,
      audioHash: sttResult.audioHash
    };

    // Step 5: Upload to IPFS
    console.log('Step 5: Uploading to IPFS...');
    const ipfsResult = await ipfsService.uploadToIPFS(firData);
    
    // Step 6: Create FIR on blockchain
    console.log('Step 6: Creating FIR on blockchain...');
    const blockchainResult = await blockchainService.createFIR(
      ipfsResult.cid,
      similarityResult.score,
      victimAddress
    );

    // Step 7: Auto-verify if similarity score is high enough
    if (firData.verified) {
      await blockchainService.setVerification(blockchainResult.firId, true);
    }

    // Cleanup uploaded files
    await fs.unlink(imageFile.path);
    await fs.unlink(audioFile.path);

    // Return comprehensive result
    res.json({
      success: true,
      firId: blockchainResult.firId,
      cid: ipfsResult.cid,
      ipfsUrl: ipfsResult.url,
      txHash: blockchainResult.txHash,
      ocrText: ocrResult.text,
      sttText: sttResult.text,
      similarityScore: similarityResult.score,
      verified: firData.verified,
      timestamp: firData.timestamp,
      gatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/'}${ipfsResult.cid}`
    });

  } catch (error) {
    console.error('Error processing FIR submission:', error);
    
    // Cleanup files on error
    try {
      if (req.files?.image?.[0]) await fs.unlink(req.files.image[0].path);
      if (req.files?.audio?.[0]) await fs.unlink(req.files.audio[0].path);
    } catch (cleanupError) {
      console.error('Error cleaning up files:', cleanupError);
    }

    res.status(500).json({
      error: 'Failed to process FIR submission',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get all FIRs from blockchain
 * GET /api/firs
 * Query params: ?verified=true/false&limit=10&offset=0
 */
app.get('/api/firs', async (req, res) => {
  try {
    const { verified, limit = 10, offset = 0 } = req.query;
    
    let firs;
    if (verified !== undefined) {
      const isVerified = verified === 'true';
      firs = await blockchainService.getFIRsByStatus(isVerified, parseInt(limit), parseInt(offset));
    } else {
      firs = await blockchainService.getAllFIRs(parseInt(limit), parseInt(offset));
    }

    // Enhance FIR data with IPFS URLs
    const enhancedFIRs = firs.map(fir => ({
      ...fir,
      gatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/'}${fir.ipfsCid}`,
      ipfsUrl: `ipfs://${fir.ipfsCid}`
    }));

    res.json({
      success: true,
      firs: enhancedFIRs,
      total: firs.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error fetching FIRs:', error);
    res.status(500).json({
      error: 'Failed to fetch FIRs',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get specific FIR details
 * GET /api/firs/:id
 */
app.get('/api/firs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fir = await blockchainService.getFIR(parseInt(id));
    
    if (!fir.exists) {
      return res.status(404).json({
        error: 'FIR not found'
      });
    }

    // Fetch IPFS data
    const ipfsData = await ipfsService.fetchFromIPFS(fir.ipfsCid);

    res.json({
      success: true,
      fir: {
        ...fir,
        ...ipfsData,
        gatewayUrl: `${process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/'}${fir.ipfsCid}`
      }
    });

  } catch (error) {
    console.error('Error fetching FIR:', error);
    res.status(500).json({
      error: 'Failed to fetch FIR',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Verify or reject a FIR (Government staff only)
 * POST /api/firs/:id/verify
 * Body: { verified: boolean, signature: string }
 */
app.post('/api/firs/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { verified, signature } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({
        error: 'verified field must be a boolean'
      });
    }

    // Verify government signature (implement signature verification)
    // const isValidSignature = await verifyGovernmentSignature(signature, id, verified);
    // if (!isValidSignature) {
    //   return res.status(403).json({
    //     error: 'Invalid government signature'
    //   });
    // }

    const result = await blockchainService.setVerification(parseInt(id), verified);

    res.json({
      success: true,
      firId: parseInt(id),
      verified,
      txHash: result.txHash
    });

  } catch (error) {
    console.error('Error verifying FIR:', error);
    res.status(500).json({
      error: 'Failed to verify FIR',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get victim's FIRs
 * GET /api/victim/:address/firs
 */
app.get('/api/victim/:address/firs', async (req, res) => {
  try {
    const { address } = req.params;
    const firs = await blockchainService.getVictimFIRs(address);

    res.json({
      success: true,
      victim: address,
      firs
    });

  } catch (error) {
    console.error('Error fetching victim FIRs:', error);
    res.status(500).json({
      error: 'Failed to fetch victim FIRs',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum is 2 files (image + audio).'
      });
    }
  }

  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found'
  });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('Initializing De-FIR backend services...');
    
    // Initialize blockchain connection
    await blockchainService.initialize();
    
    // Initialize IPFS connection
    await ipfsService.initialize();
    
    // Initialize services
    await ocrService.initialize();
    await sttService.initialize();
    await mlService.initialize();

    app.listen(PORT, () => {
      console.log(`🚀 De-FIR Backend Server running on port ${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();

