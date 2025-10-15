const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const crypto = require('crypto');
const fs = require('fs').promises;

class OCRService {
  constructor() {
    this.worker = null;
  }

  async initialize() {
    try {
      // Initialize Tesseract worker
      this.worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      console.log('✅ OCR service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize OCR service:', error);
      throw error;
    }
  }

  /**
   * Extract text from image using OCR
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<{text: string, confidence: number, imageHash: string}>}
   */
  async extractText(imagePath) {
    try {
      console.log(`🔍 Starting OCR for image: ${imagePath}`);
      
      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(imagePath);
      
      // Perform OCR
      const { data: { text, confidence } } = await this.worker.recognize(processedImagePath);
      
      // Clean up processed image
      if (processedImagePath !== imagePath) {
        await fs.unlink(processedImagePath);
      }
      
      // Calculate image hash for integrity
      const imageHash = await this.calculateImageHash(imagePath);
      
      // Clean and normalize text
      const cleanedText = this.cleanText(text);
      
      console.log(`✅ OCR completed - Confidence: ${confidence.toFixed(2)}%`);
      console.log(`📝 Extracted text length: ${cleanedText.length} characters`);
      
      return {
        text: cleanedText,
        confidence: Math.round(confidence),
        imageHash,
        originalText: text
      };
      
    } catch (error) {
      console.error('❌ OCR failed:', error);
      throw error;
    }
  }

  /**
   * Preprocess image for better OCR results
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Path to processed image
   */
  async preprocessImage(imagePath) {
    try {
      const processedPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
      
      await sharp(imagePath)
        .greyscale() // Convert to grayscale
        .normalize() // Enhance contrast
        .sharpen() // Sharpen edges
        .resize(2000, null, { // Resize to improve OCR
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3
        })
        .png({ quality: 100 })
        .toFile(processedPath);
      
      return processedPath;
      
    } catch (error) {
      console.warn('⚠️ Image preprocessing failed, using original:', error.message);
      return imagePath;
    }
  }

  /**
   * Calculate SHA-256 hash of the image
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>}
   */
  async calculateImageHash(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      const hash = crypto.createHash('sha256');
      hash.update(imageBuffer);
      return hash.digest('hex');
      
    } catch (error) {
      console.error('❌ Failed to calculate image hash:', error);
      return '';
    }
  }

  /**
   * Clean and normalize extracted text
   * @param {string} text - Raw OCR text
   * @returns {string}
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .trim() // Remove leading/trailing whitespace
      .replace(/[^\w\s\.\,\!\?\;\:\-\(\)]/g, '') // Remove special characters except common punctuation
      .replace(/\s+([\.\,\!\?\;\:])/g, '$1') // Remove spaces before punctuation
      .replace(/([\.\,\!\?\;\:])\s+/g, '$1 ') // Ensure single space after punctuation
      .replace(/\s+/g, ' ') // Final whitespace cleanup
      .trim();
  }

  /**
   * Extract text with custom configuration
   * @param {string} imagePath - Path to the image file
   * @param {Object} options - OCR options
   * @returns {Promise<Object>}
   */
  async extractTextWithOptions(imagePath, options = {}) {
    try {
      const {
        language = 'eng',
        psm = 3, // Page segmentation mode
        oem = 1, // OCR Engine mode
        preprocess = true
      } = options;

      console.log(`🔍 Starting OCR with custom options for: ${imagePath}`);
      
      let processedImagePath = imagePath;
      if (preprocess) {
        processedImagePath = await this.preprocessImage(imagePath);
      }

      // Create a new worker with custom settings
      const customWorker = await Tesseract.createWorker(language, oem);
      
      try {
        await customWorker.setParameters({
          tessedit_pageseg_mode: psm,
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()-\'" '
        });

        const { data: { text, confidence, words, lines } } = await customWorker.recognize(processedImagePath);
        
        // Clean up processed image if different from original
        if (processedImagePath !== imagePath) {
          await fs.unlink(processedImagePath);
        }
        
        const imageHash = await this.calculateImageHash(imagePath);
        const cleanedText = this.cleanText(text);
        
        console.log(`✅ Custom OCR completed - Confidence: ${confidence.toFixed(2)}%`);
        
        return {
          text: cleanedText,
          confidence: Math.round(confidence),
          imageHash,
          originalText: text,
          words: words,
          lines: lines,
          options: options
        };
        
      } finally {
        await customWorker.terminate();
      }
      
    } catch (error) {
      console.error('❌ Custom OCR failed:', error);
      throw error;
    }
  }

  /**
   * Detect text regions in image
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<Array>}
   */
  async detectTextRegions(imagePath) {
    try {
      console.log(`🔍 Detecting text regions in: ${imagePath}`);
      
      const { data: { words, lines } } = await this.worker.recognize(imagePath);
      
      const regions = words.map(word => ({
        text: word.text,
        confidence: Math.round(word.confidence),
        bbox: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1
        }
      }));

      const lineRegions = lines.map(line => ({
        text: line.text,
        confidence: Math.round(line.confidence),
        bbox: {
          x0: line.bbox.x0,
          y0: line.bbox.y0,
          x1: line.bbox.x1,
          y1: line.bbox.y1
        }
      }));

      console.log(`✅ Detected ${regions.length} words and ${lineRegions.length} lines`);
      
      return {
        words: regions,
        lines: lineRegions
      };
      
    } catch (error) {
      console.error('❌ Text region detection failed:', error);
      throw error;
    }
  }

  /**
   * Get supported languages
   * @returns {Promise<Array>}
   */
  async getSupportedLanguages() {
    try {
      const languages = await Tesseract.getLanguages();
      return languages;
      
    } catch (error) {
      console.error('❌ Failed to get supported languages:', error);
      return ['eng']; // Default to English
    }
  }

  /**
   * Validate image file for OCR
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<boolean>}
   */
  async validateImage(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      
      if (stats.size === 0) {
        throw new Error('Image file is empty');
      }
      
      if (stats.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('Image file too large (max 50MB)');
      }
      
      // Check if it's a valid image by trying to get metadata
      await sharp(imagePath).metadata();
      
      return true;
      
    } catch (error) {
      console.error('❌ Image validation failed:', error);
      return false;
    }
  }

  /**
   * Cleanup OCR service
   */
  async cleanup() {
    try {
      if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
        console.log('✅ OCR service cleaned up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up OCR service:', error);
    }
  }
}

module.exports = new OCRService();

