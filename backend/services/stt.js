const speech = require('@google-cloud/speech');
const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

class STTService {
  constructor() {
    this.client = null;
    this.googleCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  async initialize() {
    try {
      if (this.googleCredentials && await this.fileExists(this.googleCredentials)) {
        // Initialize Google Cloud Speech client
        this.client = new speech.SpeechClient({
          keyFilename: this.googleCredentials
        });
        console.log('✅ Google Cloud Speech-to-Text service initialized');
      } else {
        console.log('⚠️ Google Cloud credentials not found, using fallback STT');
        console.log('💡 Set GOOGLE_APPLICATION_CREDENTIALS for better accuracy');
      }
    } catch (error) {
      console.error('❌ Failed to initialize STT service:', error);
      console.log('🔄 Falling back to basic STT implementation');
    }
  }

  /**
   * Transcribe audio file to text
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<{text: string, confidence: number, audioHash: string}>}
   */
  async transcribeAudio(audioPath) {
    try {
      console.log(`🎤 Starting speech-to-text for audio: ${audioPath}`);
      
      if (this.client) {
        return await this.transcribeWithGoogleCloud(audioPath);
      } else {
        return await this.transcribeWithFallback(audioPath);
      }
      
    } catch (error) {
      console.error('❌ Speech-to-text failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<{text: string, confidence: number, audioHash: string}>}
   */
  async transcribeWithGoogleCloud(audioPath) {
    try {
      // Read audio file
      const audioBytes = await fs.readFile(audioPath);
      const audioHash = await this.calculateAudioHash(audioPath);
      
      // Detect audio format
      const audioFormat = this.detectAudioFormat(audioPath);
      
      // Configure recognition request
      const request = {
        audio: {
          content: audioBytes.toString('base64'),
        },
        config: {
          encoding: audioFormat.encoding,
          sampleRateHertz: audioFormat.sampleRate || 16000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          model: 'latest_long', // Use the latest long audio model
          useEnhanced: true, // Use enhanced model for better accuracy
          alternativeLanguageCodes: ['hi-IN', 'ta-IN', 'te-IN'], // Support Indian languages
        },
      };

      console.log(`🔍 Transcribing with Google Cloud (${audioFormat.encoding}, ${audioFormat.sampleRate}Hz)`);
      
      // Perform the transcription
      const [response] = await this.client.recognize(request);
      
      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results received');
      }

      // Combine all results
      let fullText = '';
      let totalConfidence = 0;
      let resultCount = 0;

      for (const result of response.results) {
        if (result.alternatives && result.alternatives.length > 0) {
          const alternative = result.alternatives[0];
          fullText += alternative.transcript + ' ';
          totalConfidence += alternative.confidence || 0;
          resultCount++;
        }
      }

      const averageConfidence = resultCount > 0 ? (totalConfidence / resultCount) * 100 : 0;
      const cleanedText = this.cleanTranscription(fullText.trim());

      console.log(`✅ Google Cloud transcription completed - Confidence: ${averageConfidence.toFixed(2)}%`);
      console.log(`📝 Transcribed text length: ${cleanedText.length} characters`);

      return {
        text: cleanedText,
        confidence: Math.round(averageConfidence),
        audioHash,
        provider: 'google-cloud',
        alternatives: response.results.map(r => r.alternatives?.map(a => a.transcript)).flat()
      };

    } catch (error) {
      console.error('❌ Google Cloud transcription failed:', error);
      throw error;
    }
  }

  /**
   * Fallback transcription method
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<{text: string, confidence: number, audioHash: string}>}
   */
  async transcribeWithFallback(audioPath) {
    try {
      console.log('🔄 Using fallback transcription method');
      
      const audioHash = await this.calculateAudioHash(audioPath);
      
      // This is a placeholder implementation
      // In a real scenario, you might use:
      // - Web Speech API (browser-based)
      // - Azure Cognitive Services
      // - AWS Transcribe
      // - Local speech recognition libraries
      
      // For now, return a mock transcription
      const mockText = "This is a mock transcription. Please configure Google Cloud Speech-to-Text for actual transcription. Audio file processed successfully.";
      
      console.log('⚠️ Using mock transcription - configure Google Cloud for real transcription');
      
      return {
        text: mockText,
        confidence: 50, // Low confidence for mock
        audioHash,
        provider: 'fallback',
        note: 'Mock transcription - configure Google Cloud Speech-to-Text for actual transcription'
      };

    } catch (error) {
      console.error('❌ Fallback transcription failed:', error);
      throw error;
    }
  }

  /**
   * Detect audio format from file extension and metadata
   * @param {string} audioPath - Path to the audio file
   * @returns {Object}
   */
  detectAudioFormat(audioPath) {
    const ext = path.extname(audioPath).toLowerCase();
    
    const formatMap = {
      '.wav': { encoding: 'LINEAR16', sampleRate: 16000 },
      '.mp3': { encoding: 'MP3', sampleRate: 16000 },
      '.flac': { encoding: 'FLAC', sampleRate: 16000 },
      '.ogg': { encoding: 'OGG_OPUS', sampleRate: 16000 },
      '.webm': { encoding: 'WEBM_OPUS', sampleRate: 16000 },
      '.m4a': { encoding: 'MP4', sampleRate: 16000 }
    };

    return formatMap[ext] || { encoding: 'LINEAR16', sampleRate: 16000 };
  }

  /**
   * Calculate SHA-256 hash of the audio file
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<string>}
   */
  async calculateAudioHash(audioPath) {
    try {
      const audioBuffer = await fs.readFile(audioPath);
      const hash = crypto.createHash('sha256');
      hash.update(audioBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.error('❌ Failed to calculate audio hash:', error);
      return '';
    }
  }

  /**
   * Clean and normalize transcribed text
   * @param {string} text - Raw transcribed text
   * @returns {string}
   */
  cleanTranscription(text) {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/([.!?])\s*([a-z])/g, '$1 $2') // Fix capitalization after punctuation
      .replace(/\s+([.!?,:;])/g, '$1') // Remove spaces before punctuation
      .replace(/([.!?,:;])\s+/g, '$1 ') // Ensure single space after punctuation
      .trim();
  }

  /**
   * Transcribe with custom configuration
   * @param {string} audioPath - Path to the audio file
   * @param {Object} options - Transcription options
   * @returns {Promise<Object>}
   */
  async transcribeWithOptions(audioPath, options = {}) {
    try {
      const {
        languageCode = 'en-US',
        sampleRate = 16000,
        encoding = null,
        enablePunctuation = true,
        enableWordTimeOffsets = true,
        model = 'latest_long'
      } = options;

      if (!this.client) {
        throw new Error('Google Cloud client not initialized');
      }

      const audioBytes = await fs.readFile(audioPath);
      const audioHash = await this.calculateAudioHash(audioPath);
      
      const audioFormat = encoding ? { encoding, sampleRate } : this.detectAudioFormat(audioPath);

      const request = {
        audio: {
          content: audioBytes.toString('base64'),
        },
        config: {
          encoding: audioFormat.encoding,
          sampleRateHertz: audioFormat.sampleRate,
          languageCode: languageCode,
          enableAutomaticPunctuation: enablePunctuation,
          enableWordTimeOffsets: enableWordTimeOffsets,
          model: model,
          useEnhanced: true,
        },
      };

      console.log(`🔍 Custom transcription with language: ${languageCode}`);

      const [response] = await this.client.recognize(request);

      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results received');
      }

      let fullText = '';
      let totalConfidence = 0;
      let resultCount = 0;

      for (const result of response.results) {
        if (result.alternatives && result.alternatives.length > 0) {
          const alternative = result.alternatives[0];
          fullText += alternative.transcript + ' ';
          totalConfidence += alternative.confidence || 0;
          resultCount++;
        }
      }

      const averageConfidence = resultCount > 0 ? (totalConfidence / resultCount) * 100 : 0;
      const cleanedText = this.cleanTranscription(fullText.trim());

      return {
        text: cleanedText,
        confidence: Math.round(averageConfidence),
        audioHash,
        provider: 'google-cloud',
        options: options,
        alternatives: response.results.map(r => r.alternatives?.map(a => a.transcript)).flat()
      };

    } catch (error) {
      console.error('❌ Custom transcription failed:', error);
      throw error;
    }
  }

  /**
   * Validate audio file for transcription
   * @param {string} audioPath - Path to the audio file
   * @returns {Promise<boolean>}
   */
  async validateAudio(audioPath) {
    try {
      const stats = await fs.stat(audioPath);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      
      if (stats.size > 100 * 1024 * 1024) { // 100MB limit
        throw new Error('Audio file too large (max 100MB)');
      }

      const ext = path.extname(audioPath).toLowerCase();
      const supportedFormats = ['.wav', '.mp3', '.flac', '.ogg', '.webm', '.m4a'];
      
      if (!supportedFormats.includes(ext)) {
        throw new Error(`Unsupported audio format: ${ext}`);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Audio validation failed:', error);
      return false;
    }
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
   * Get supported languages for transcription
   * @returns {Array}
   */
  getSupportedLanguages() {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'hi-IN', name: 'Hindi (India)' },
      { code: 'ta-IN', name: 'Tamil (India)' },
      { code: 'te-IN', name: 'Telugu (India)' },
      { code: 'bn-IN', name: 'Bengali (India)' },
      { code: 'mr-IN', name: 'Marathi (India)' },
      { code: 'gu-IN', name: 'Gujarati (India)' },
      { code: 'kn-IN', name: 'Kannada (India)' },
      { code: 'ml-IN', name: 'Malayalam (India)' },
      { code: 'pa-IN', name: 'Punjabi (India)' }
    ];
  }

  /**
   * Cleanup STT service
   */
  async cleanup() {
    try {
      if (this.client) {
        // Google Cloud client doesn't need explicit cleanup
        this.client = null;
      }
      console.log('✅ STT service cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up STT service:', error);
    }
  }
}

module.exports = new STTService();

