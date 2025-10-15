const { ethers } = require('ethers');
const FIRRegistryABI = require('../contracts/FIRRegistry.json');

class BlockchainService {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.govWallet = null;
    this.contract = null;
    this.contractAddress = process.env.CONTRACT_ADDRESS;
  }

  async initialize() {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      
      // Initialize victim wallet (for FIR creation)
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
      
      // Initialize government wallet (for verification)
      this.govWallet = new ethers.Wallet(process.env.GOV_PRIVATE_KEY, this.provider);
      
      // Initialize contract
      this.contract = new ethers.Contract(
        this.contractAddress,
        FIRRegistryABI.abi,
        this.wallet
      );
      
      console.log('✅ Blockchain service initialized');
      console.log(`📋 Contract address: ${this.contractAddress}`);
      console.log(`👤 Victim wallet: ${this.wallet.address}`);
      console.log(`🏛️ Gov wallet: ${this.govWallet.address}`);
      
      // Verify contract deployment
      const code = await this.provider.getCode(this.contractAddress);
      if (code === '0x') {
        throw new Error(`Contract not deployed at ${this.contractAddress}`);
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  /**
   * Create a new FIR on the blockchain
   * @param {string} ipfsCid - IPFS content identifier
   * @param {number} similarityScore - OCR-STT similarity score (0-100)
   * @param {string} victimAddress - Victim's wallet address
   * @returns {Promise<{firId: number, txHash: string}>}
   */
  async createFIR(ipfsCid, similarityScore, victimAddress) {
    try {
      console.log(`Creating FIR for victim ${victimAddress} with CID ${ipfsCid}`);
      
      // Connect contract with victim wallet for this transaction
      const victimContract = this.contract.connect(this.wallet);
      
      // Estimate gas
      const gasEstimate = await victimContract.createFIR.estimateGas(
        ipfsCid,
        similarityScore
      );
      
      // Create FIR transaction
      const tx = await victimContract.createFIR(
        ipfsCid,
        similarityScore,
        {
          gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        }
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        // Extract FIR ID from events
        const firCreatedEvent = receipt.logs.find(log => {
          try {
            const parsed = victimContract.interface.parseLog(log);
            return parsed.name === 'FIRCreated';
          } catch {
            return false;
          }
        });
        
        let firId = null;
        if (firCreatedEvent) {
          const parsed = victimContract.interface.parseLog(firCreatedEvent);
          firId = parsed.args.id.toString();
        }
        
        console.log(`✅ FIR created successfully: ID ${firId}, TX ${tx.hash}`);
        
        return {
          firId: parseInt(firId),
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        };
      } else {
        throw new Error('Transaction failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to create FIR:', error);
      throw error;
    }
  }

  /**
   * Set verification status of a FIR
   * @param {number} firId - FIR ID
   * @param {boolean} verified - Verification status
   * @returns {Promise<{txHash: string}>}
   */
  async setVerification(firId, verified) {
    try {
      console.log(`Setting verification for FIR ${firId} to ${verified}`);
      
      // Connect contract with government wallet
      const govContract = this.contract.connect(this.govWallet);
      
      // Estimate gas
      const gasEstimate = await govContract.setVerification.estimateGas(firId, verified);
      
      // Set verification transaction
      const tx = await govContract.setVerification(
        firId,
        verified,
        {
          gasLimit: gasEstimate * 120n / 100n, // 20% buffer
        }
      );
      
      console.log(`Verification transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Verification set successfully: TX ${tx.hash}`);
        
        return {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString()
        };
      } else {
        throw new Error('Verification transaction failed');
      }
      
    } catch (error) {
      console.error('❌ Failed to set verification:', error);
      throw error;
    }
  }

  /**
   * Get FIR details by ID
   * @param {number} firId - FIR ID
   * @returns {Promise<Object>}
   */
  async getFIR(firId) {
    try {
      const fir = await this.contract.getFIR(firId);
      
      return {
        id: firId,
        victim: fir.victim,
        ipfsCid: fir.ipfsCid,
        timestamp: fir.timestamp.toString(),
        verified: fir.verified,
        exists: fir.exists,
        similarityScore: fir.similarityScore.toString()
      };
      
    } catch (error) {
      console.error(`❌ Failed to get FIR ${firId}:`, error);
      throw error;
    }
  }

  /**
   * Get all FIRs for a victim
   * @param {string} victimAddress - Victim's wallet address
   * @returns {Promise<number[]>}
   */
  async getVictimFIRs(victimAddress) {
    try {
      const firIds = await this.contract.getVictimFIRs(victimAddress);
      return firIds.map(id => parseInt(id.toString()));
      
    } catch (error) {
      console.error(`❌ Failed to get victim FIRs for ${victimAddress}:`, error);
      throw error;
    }
  }

  /**
   * Get FIRs by verification status
   * @param {boolean} verified - Verification status
   * @param {number} limit - Maximum number of FIRs
   * @param {number} offset - Starting index
   * @returns {Promise<Object[]>}
   */
  async getFIRsByStatus(verified, limit = 10, offset = 0) {
    try {
      const firs = await this.contract.getFIRsByStatus(verified, limit, offset);
      
      return firs.map(fir => ({
        id: parseInt(fir.id.toString()),
        victim: fir.victim,
        ipfsCid: fir.ipfsCid,
        timestamp: fir.timestamp.toString(),
        verified: fir.verified,
        similarityScore: fir.similarityScore.toString()
      }));
      
    } catch (error) {
      console.error(`❌ Failed to get FIRs by status ${verified}:`, error);
      throw error;
    }
  }

  /**
   * Get all FIRs with pagination
   * @param {number} limit - Maximum number of FIRs
   * @param {number} offset - Starting index
   * @returns {Promise<Object[]>}
   */
  async getAllFIRs(limit = 10, offset = 0) {
    try {
      const total = await this.contract.getTotalFIRs();
      const totalCount = parseInt(total.toString());
      
      if (offset >= totalCount) {
        return [];
      }
      
      const actualLimit = Math.min(limit, totalCount - offset);
      const firs = [];
      
      // Get FIRs one by one (contract doesn't have a getAllFIRs method)
      for (let i = offset + 1; i <= offset + actualLimit; i++) {
        try {
          const fir = await this.getFIR(i);
          if (fir.exists) {
            firs.push(fir);
          }
        } catch (error) {
          console.warn(`FIR ${i} not found or error:`, error.message);
        }
      }
      
      return firs;
      
    } catch (error) {
      console.error('❌ Failed to get all FIRs:', error);
      throw error;
    }
  }

  /**
   * Get total number of FIRs
   * @returns {Promise<number>}
   */
  async getTotalFIRs() {
    try {
      const total = await this.contract.getTotalFIRs();
      return parseInt(total.toString());
      
    } catch (error) {
      console.error('❌ Failed to get total FIRs:', error);
      throw error;
    }
  }

  /**
   * Check if an address has a specific role
   * @param {string} address - Wallet address
   * @param {string} role - Role to check (VICTIM_ROLE, GOV_ROLE, DEFAULT_ADMIN_ROLE)
   * @returns {Promise<boolean>}
   */
  async hasRole(address, role) {
    try {
      const roleHash = role === 'VICTIM_ROLE' ? 
        ethers.keccak256(ethers.toUtf8Bytes('VICTIM_ROLE')) :
        role === 'GOV_ROLE' ? 
        ethers.keccak256(ethers.toUtf8Bytes('GOV_ROLE')) :
        role === 'DEFAULT_ADMIN_ROLE' ? 
        ethers.ZeroHash : null;
      
      if (!roleHash) {
        throw new Error(`Invalid role: ${role}`);
      }
      
      return await this.contract.hasRole(roleHash, address);
      
    } catch (error) {
      console.error(`❌ Failed to check role ${role} for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get contract information
   * @returns {Promise<Object>}
   */
  async getContractInfo() {
    try {
      const total = await this.getTotalFIRs();
      const network = await this.provider.getNetwork();
      
      return {
        address: this.contractAddress,
        network: network.name,
        chainId: network.chainId.toString(),
        totalFIRs: total,
        victimWallet: this.wallet.address,
        govWallet: this.govWallet.address
      };
      
    } catch (error) {
      console.error('❌ Failed to get contract info:', error);
      throw error;
    }
  }
}

module.exports = new BlockchainService();

