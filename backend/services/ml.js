const { spawn } = require('child_process');
const path = require('path');
const natural = require('natural');
const fs = require('fs').promises;

class MLService {
  constructor() {
    this.modelPath = process.env.ML_MODEL_PATH || './ml/fir_law_section_classifier.py';
    this.similarityThreshold = parseInt(process.env.SIMILARITY_THRESHOLD) || 75;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('🧠 Initializing ML service...');
      
      // Check if model file exists
      const modelExists = await this.fileExists(this.modelPath);
      if (!modelExists) {
        console.warn(`⚠️ ML model not found at ${this.modelPath}, using fallback similarity calculation`);
      }
      
      // Initialize natural language processing
      this.tokenizer = new natural.WordTokenizer();
      this.tfidf = new natural.TfIdf();
      
      this.isInitialized = true;
      console.log('✅ ML service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize ML service:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between OCR text and STT text
   * @param {string} ocrText - Text extracted from OCR
   * @param {string} sttText - Text transcribed from speech
   * @returns {Promise<{score: number, details: Object}>}
   */
  async calculateSimilarity(ocrText, sttText) {
    try {
      console.log('🔍 Calculating similarity between OCR and STT text...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Clean and normalize texts
      const cleanOcrText = this.cleanText(ocrText);
      const cleanSttText = this.cleanText(sttText);

      console.log(`📝 OCR text length: ${cleanOcrText.length} characters`);
      console.log(`🎤 STT text length: ${cleanSttText.length} characters`);

      // Try Python ML model first
      let similarityResult;
      try {
        similarityResult = await this.calculateSimilarityWithPython(cleanOcrText, cleanSttText);
      } catch (pythonError) {
        console.warn('⚠️ Python ML model failed, using fallback:', pythonError.message);
        similarityResult = await this.calculateSimilarityFallback(cleanOcrText, cleanSttText);
      }

      console.log(`✅ Similarity calculation completed - Score: ${similarityResult.score}%`);
      
      return {
        score: similarityResult.score,
        details: {
          method: similarityResult.method,
          ocrLength: cleanOcrText.length,
          sttLength: cleanSttText.length,
          commonWords: similarityResult.commonWords,
          jaccardSimilarity: similarityResult.jaccardSimilarity,
          cosineSimilarity: similarityResult.cosineSimilarity,
          levenshteinDistance: similarityResult.levenshteinDistance
        }
      };

    } catch (error) {
      console.error('❌ Similarity calculation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate similarity using Python ML model
   * @param {string} ocrText - OCR text
   * @param {string} sttText - STT text
   * @returns {Promise<Object>}
   */
  async calculateSimilarityWithPython(ocrText, sttText) {
    return new Promise((resolve, reject) => {
      const pythonScript = path.join(__dirname, '../ml/similarity_calculator.py');
      
      const python = spawn('python3', [pythonScript, ocrText, sttText]);
      
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve({
              score: Math.round(result.similarity_score * 100),
              method: 'python-ml',
              ...result
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${error}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Fallback similarity calculation using natural language processing
   * @param {string} ocrText - OCR text
   * @param {string} sttText - STT text
   * @returns {Promise<Object>}
   */
  async calculateSimilarityFallback(ocrText, sttText) {
    try {
      // Tokenize texts
      const ocrTokens = this.tokenizer.tokenize(ocrText.toLowerCase());
      const sttTokens = this.tokenizer.tokenize(sttText.toLowerCase());

      // Remove stop words
      const ocrWords = this.removeStopWords(ocrTokens);
      const sttWords = this.removeStopWords(sttTokens);

      // Calculate Jaccard similarity
      const jaccardSimilarity = this.calculateJaccardSimilarity(ocrWords, sttWords);

      // Calculate cosine similarity
      const cosineSimilarity = this.calculateCosineSimilarity(ocrWords, sttWords);

      // Calculate Levenshtein distance
      const levenshteinDistance = this.calculateLevenshteinDistance(ocrText, sttText);

      // Calculate common words
      const commonWords = this.findCommonWords(ocrWords, sttWords);

      // Combine metrics for final score
      const finalScore = Math.round(
        (jaccardSimilarity * 40) + 
        (cosineSimilarity * 40) + 
        (Math.max(0, 100 - levenshteinDistance) / 100 * 20)
      );

      return {
        score: Math.min(100, Math.max(0, finalScore)),
        method: 'nlp-fallback',
        jaccardSimilarity: Math.round(jaccardSimilarity * 100),
        cosineSimilarity: Math.round(cosineSimilarity * 100),
        levenshteinDistance: Math.round(levenshteinDistance),
        commonWords: commonWords.length
      };

    } catch (error) {
      console.error('❌ Fallback similarity calculation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate Jaccard similarity between two sets of words
   * @param {Array} words1 - First set of words
   * @param {Array} words2 - Second set of words
   * @returns {number}
   */
  calculateJaccardSimilarity(words1, words2) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate cosine similarity between two sets of words
   * @param {Array} words1 - First set of words
   * @param {Array} words2 - Second set of words
   * @returns {number}
   */
  calculateCosineSimilarity(words1, words2) {
    const allWords = [...new Set([...words1, ...words2])];
    const vector1 = allWords.map(word => words1.filter(w => w === word).length);
    const vector2 = allWords.map(word => words2.filter(w => w === word).length);

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number}
   */
  calculateLevenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Find common words between two sets
   * @param {Array} words1 - First set of words
   * @param {Array} words2 - Second set of words
   * @returns {Array}
   */
  findCommonWords(words1, words2) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    return [...set1].filter(word => set2.has(word));
  }

  /**
   * Remove stop words from token array
   * @param {Array} tokens - Array of tokens
   * @returns {Array}
   */
  removeStopWords(tokens) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
    ]);
    
    return tokens.filter(token => !stopWords.has(token) && token.length > 2);
  }

  /**
   * Clean and normalize text for processing
   * @param {string} text - Input text
   * @returns {string}
   */
  cleanText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Predict law sections for FIR text
   * @param {string} text - FIR complaint text
   * @returns {Promise<Array>}
   */
  async predictLawSections(text) {
    try {
      console.log('⚖️ Predicting law sections for FIR text...');
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Try Python model first
      try {
        return await this.predictWithPython(text);
      } catch (pythonError) {
        console.warn('⚠️ Python law section prediction failed, using fallback:', pythonError.message);
        return this.predictWithFallback(text);
      }

    } catch (error) {
      console.error('❌ Law section prediction failed:', error);
      throw error;
    }
  }

  /**
   * Predict law sections using Python model
   * @param {string} text - FIR text
   * @returns {Promise<Array>}
   */
  async predictWithPython(text) {
    return new Promise((resolve, reject) => {
      const pythonScript = this.modelPath;
      
      const python = spawn('python3', [pythonScript, '--predict', text]);
      
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result.predicted_sections || []);
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}: ${error}`));
        }
      });
    });
  }

  /**
   * Fallback law section prediction
   * @param {string} text - FIR text
   * @returns {Array}
   */
  predictWithFallback(text) {
    const keywords = {
      'theft': ['380', '381', '382'],
      'robbery': ['392', '393', '394'],
      'burglary': ['449', '450', '451', '452', '453', '454', '455', '456', '457', '458'],
      'assault': ['320', '321', '322', '323', '324', '325', '326', '327'],
      'murder': ['300', '301', '302', '303', '304', '304A', '304B', '305', '306', '307', '308', '309'],
      'rape': ['375', '376', '376A', '376B', '376C', '376D', '376E'],
      'fraud': ['415', '416', '417', '418', '419', '420', '421', '422', '423', '424'],
      'cheating': ['415', '417', '420'],
      'criminal breach of trust': ['405', '406', '407', '408', '409', '410', '411', '412', '413', '414'],
      'extortion': ['383', '384', '385', '386', '387', '388', '389'],
      'kidnapping': ['359', '360', '361', '362', '363', '364', '364A', '365', '366', '366A', '366B', '367', '368', '369'],
      'stalking': ['354D'],
      'harassment': ['354A', '354B', '354C', '354D', '509'],
      'domestic violence': ['498A'],
      'dowry': ['304B', '498A'],
      'cyber crime': ['66A', '66B', '66C', '66D', '66E', '66F', '67', '67A', '67B']
    };

    const lowerText = text.toLowerCase();
    const predictedSections = [];

    for (const [keyword, sections] of Object.entries(keywords)) {
      if (lowerText.includes(keyword)) {
        predictedSections.push(...sections);
      }
    }

    // Remove duplicates
    return [...new Set(predictedSections)];
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to the file
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get similarity threshold
   * @returns {number}
   */
  getSimilarityThreshold() {
    return this.similarityThreshold;
  }

  /**
   * Cleanup ML service
   */
  async cleanup() {
    try {
      this.isInitialized = false;
      console.log('✅ ML service cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up ML service:', error);
    }
  }
}

module.exports = new MLService();

