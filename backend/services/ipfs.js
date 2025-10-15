const { create } = require('ipfs-http-client');
const axios = require('axios');

class IPFSService {
  constructor() {
    this.client = null;
    this.gatewayUrl = process.env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/';
    this.pinataApiKey = process.env.PINATA_API_KEY;
    this.pinataSecretKey = process.env.PINATA_SECRET_KEY;
  }

  async initialize() {
    try {
      // Initialize IPFS client
      const ipfsApiUrl = process.env.IPFS_API_URL || 'http://localhost:5001';
      this.client = create({ url: ipfsApiUrl });
      
      // Test connection
      const version = await this.client.version();
      console.log('✅ IPFS service initialized');
      console.log(`📦 IPFS version: ${version.version}`);
      console.log(`🌐 Gateway URL: ${this.gatewayUrl}`);
      
      if (this.pinataApiKey && this.pinataSecretKey) {
        console.log('📌 Pinata integration enabled');
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize IPFS service:', error);
      console.log('💡 Make sure IPFS daemon is running or use Pinata for remote storage');
      
      // Fallback to Pinata if local IPFS fails
      if (this.pinataApiKey && this.pinataSecretKey) {
        console.log('🔄 Falling back to Pinata...');
        this.client = null; // Will use Pinata API instead
      } else {
        throw error;
      }
    }
  }

  /**
   * Upload data to IPFS
   * @param {Object} data - Data to upload
   * @returns {Promise<{cid: string, url: string}>}
   */
  async uploadToIPFS(data) {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const jsonBuffer = Buffer.from(jsonString, 'utf8');
      
      let cid, url;
      
      if (this.client) {
        // Use local IPFS
        const result = await this.client.add(jsonBuffer, {
          pin: true
        });
        
        cid = result.cid.toString();
        url = `${this.gatewayUrl}${cid}`;
        
        console.log(`📤 Uploaded to local IPFS: ${cid}`);
        
      } else if (this.pinataApiKey && this.pinataSecretKey) {
        // Use Pinata
        const result = await this.uploadToPinata(jsonString, 'fir-data.json');
        cid = result.IpfsHash;
        url = `${this.gatewayUrl}${cid}`;
        
        console.log(`📤 Uploaded to Pinata: ${cid}`);
        
      } else {
        throw new Error('No IPFS client available and Pinata not configured');
      }
      
      return { cid, url };
      
    } catch (error) {
      console.error('❌ Failed to upload to IPFS:', error);
      throw error;
    }
  }

  /**
   * Upload to Pinata
   * @param {string} content - Content to upload
   * @param {string} filename - Filename for the upload
   * @returns {Promise<Object>}
   */
  async uploadToPinata(content, filename) {
    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: 'application/json' });
      
      formData.append('file', blob, filename);
      formData.append('pinataMetadata', JSON.stringify({
        name: filename,
        keyvalues: {
          type: 'fir-data',
          timestamp: new Date().toISOString()
        }
      }));
      formData.append('pinataOptions', JSON.stringify({
        cidVersion: 0
      }));

      const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      return response.data;
      
    } catch (error) {
      console.error('❌ Failed to upload to Pinata:', error);
      throw error;
    }
  }

  /**
   * Fetch data from IPFS
   * @param {string} cid - IPFS content identifier
   * @returns {Promise<Object>}
   */
  async fetchFromIPFS(cid) {
    try {
      let content;
      
      if (this.client) {
        // Use local IPFS
        const chunks = [];
        for await (const chunk of this.client.cat(cid)) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf8');
        
      } else {
        // Use gateway
        const response = await axios.get(`${this.gatewayUrl}${cid}`, {
          timeout: 10000
        });
        content = response.data;
      }
      
      return JSON.parse(content);
      
    } catch (error) {
      console.error(`❌ Failed to fetch from IPFS (${cid}):`, error);
      throw error;
    }
  }

  /**
   * Pin content to IPFS
   * @param {string} cid - IPFS content identifier
   * @returns {Promise<boolean>}
   */
  async pinToIPFS(cid) {
    try {
      if (this.client) {
        await this.client.pin.add(cid);
        console.log(`📌 Pinned ${cid} to local IPFS`);
        return true;
      } else if (this.pinataApiKey && this.pinataSecretKey) {
        await this.pinToPinata(cid);
        console.log(`📌 Pinned ${cid} to Pinata`);
        return true;
      } else {
        throw new Error('No pinning service available');
      }
      
    } catch (error) {
      console.error(`❌ Failed to pin ${cid}:`, error);
      throw error;
    }
  }

  /**
   * Pin to Pinata
   * @param {string} cid - IPFS content identifier
   * @returns {Promise<Object>}
   */
  async pinToPinata(cid) {
    try {
      const response = await axios.post('https://api.pinata.cloud/pinning/pinByHash', {
        hashToPin: cid,
        pinataMetadata: {
          name: `fir-data-${cid}`,
          keyvalues: {
            type: 'fir-data',
            cid: cid,
            timestamp: new Date().toISOString()
          }
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        }
      });

      return response.data;
      
    } catch (error) {
      console.error(`❌ Failed to pin ${cid} to Pinata:`, error);
      throw error;
    }
  }

  /**
   * Get IPFS gateway URL for a CID
   * @param {string} cid - IPFS content identifier
   * @returns {string}
   */
  getGatewayUrl(cid) {
    return `${this.gatewayUrl}${cid}`;
  }

  /**
   * Check if content exists in IPFS
   * @param {string} cid - IPFS content identifier
   * @returns {Promise<boolean>}
   */
  async existsInIPFS(cid) {
    try {
      await this.fetchFromIPFS(cid);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get IPFS node information
   * @returns {Promise<Object>}
   */
  async getNodeInfo() {
    try {
      if (this.client) {
        const id = await this.client.id();
        const version = await this.client.version();
        
        return {
          id: id.id,
          addresses: id.addresses,
          version: version.version,
          type: 'local'
        };
      } else {
        return {
          type: 'pinata',
          gatewayUrl: this.gatewayUrl
        };
      }
      
    } catch (error) {
      console.error('❌ Failed to get IPFS node info:', error);
      throw error;
    }
  }

  /**
   * Cleanup and close IPFS connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.stop();
        console.log('✅ IPFS client closed');
      }
    } catch (error) {
      console.error('❌ Error closing IPFS client:', error);
    }
  }
}

module.exports = new IPFSService();

