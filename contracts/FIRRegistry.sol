// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title FIRRegistry
 * @dev Decentralized FIR management system with role-based access control
 * @author De-FIR Team
 */
contract FIRRegistry is AccessControl {
    using Counters for Counters.Counter;
    
    // Role definitions
    bytes32 public constant VICTIM_ROLE = keccak256("VICTIM_ROLE");
    bytes32 public constant GOV_ROLE = keccak256("GOV_ROLE");
    
    // FIR structure
    struct FIR {
        uint256 id;
        address victim;
        string ipfsCid;
        uint256 timestamp;
        bool verified;
        bool exists;
        uint256 similarityScore; // 0-100 (multiplied by 100 for integer storage)
    }
    
    // State variables
    Counters.Counter private _firCounter;
    mapping(uint256 => FIR) public firs;
    mapping(address => uint256[]) public victimFIRs;
    
    // Events
    event FIRCreated(
        uint256 indexed id,
        address indexed victim,
        string ipfsCid,
        uint256 timestamp,
        uint256 similarityScore
    );
    
    event FIRVerified(
        uint256 indexed id,
        bool verified,
        address indexed verifiedBy
    );
    
    // Modifiers
    modifier onlyValidFIR(uint256 _id) {
        require(firs[_id].exists, "FIR does not exist");
        _;
    }
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOV_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new FIR with IPFS CID
     * @param _ipfsCid IPFS content identifier for the FIR data
     * @param _similarityScore OCR-STT similarity score (0-100)
     */
    function createFIR(string memory _ipfsCid, uint256 _similarityScore) 
        external 
        onlyRole(VICTIM_ROLE) 
        returns (uint256) 
    {
        require(bytes(_ipfsCid).length > 0, "IPFS CID cannot be empty");
        require(_similarityScore <= 100, "Similarity score cannot exceed 100");
        
        _firCounter.increment();
        uint256 newId = _firCounter.current();
        
        firs[newId] = FIR({
            id: newId,
            victim: msg.sender,
            ipfsCid: _ipfsCid,
            timestamp: block.timestamp,
            verified: _similarityScore >= 75, // Auto-verify if similarity >= 75%
            exists: true,
            similarityScore: _similarityScore
        });
        
        victimFIRs[msg.sender].push(newId);
        
        emit FIRCreated(newId, msg.sender, _ipfsCid, block.timestamp, _similarityScore);
        
        // Auto-verify if similarity score is high enough
        if (_similarityScore >= 75) {
            emit FIRVerified(newId, true, msg.sender);
        }
        
        return newId;
    }
    
    /**
     * @dev Set verification status of a FIR (only government staff)
     * @param _id FIR ID
     * @param _verified Verification status
     */
    function setVerification(uint256 _id, bool _verified) 
        external 
        onlyRole(GOV_ROLE) 
        onlyValidFIR(_id) 
    {
        FIR storage fir = firs[_id];
        fir.verified = _verified;
        
        emit FIRVerified(_id, _verified, msg.sender);
    }
    
    /**
     * @dev Get FIR details
     * @param _id FIR ID
     * @return FIR struct
     */
    function getFIR(uint256 _id) 
        external 
        view 
        onlyValidFIR(_id) 
        returns (FIR memory) 
    {
        return firs[_id];
    }
    
    /**
     * @dev Get all FIRs for a victim
     * @param _victim Victim address
     * @return Array of FIR IDs
     */
    function getVictimFIRs(address _victim) external view returns (uint256[] memory) {
        return victimFIRs[_victim];
    }
    
    /**
     * @dev Get total number of FIRs
     * @return Total FIR count
     */
    function getTotalFIRs() external view returns (uint256) {
        return _firCounter.current();
    }
    
    /**
     * @dev Get FIRs by status (verified/unverified)
     * @param _verified Status to filter by
     * @param _limit Maximum number of FIRs to return
     * @param _offset Starting index
     * @return Array of FIR structs
     */
    function getFIRsByStatus(bool _verified, uint256 _limit, uint256 _offset) 
        external 
        view 
        returns (FIR[] memory) 
    {
        require(_limit > 0 && _limit <= 100, "Invalid limit");
        
        uint256 total = _firCounter.current();
        uint256 resultCount = 0;
        uint256 currentOffset = _offset;
        
        // Count matching FIRs
        for (uint256 i = 1; i <= total && resultCount < _limit; i++) {
            if (firs[i].verified == _verified) {
                if (currentOffset > 0) {
                    currentOffset--;
                } else {
                    resultCount++;
                }
            }
        }
        
        // Create result array
        FIR[] memory result = new FIR[](resultCount);
        currentOffset = _offset;
        resultCount = 0;
        
        for (uint256 i = 1; i <= total && resultCount < result.length; i++) {
            if (firs[i].verified == _verified) {
                if (currentOffset > 0) {
                    currentOffset--;
                } else {
                    result[resultCount] = firs[i];
                    resultCount++;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Grant victim role to an address (only admin)
     * @param _victim Address to grant victim role
     */
    function grantVictimRole(address _victim) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VICTIM_ROLE, _victim);
    }
    
    /**
     * @dev Grant government role to an address (only admin)
     * @param _govStaff Address to grant government role
     */
    function grantGovRole(address _govStaff) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(GOV_ROLE, _govStaff);
    }
}

