# De-FIR

Decentralized FIR system with blockchain, OCR + Speech-to-Text verification, IPFS storage, and role-based dashboards.

## Upgrades Overview

This version adds:
- OCR + STT similarity verification pipeline (Node backend using Tesseract + Google STT or fallback + ML similarity)
- IPFS storage (local IPFS or Pinata) with only CID on-chain
- Solidity smart contract with OpenZeppelin AccessControl (`VICTIM_ROLE`, `GOV_ROLE`, `DEFAULT_ADMIN_ROLE`)
- Backend endpoints: `/api/submitFIR`, `/api/firs`, `/api/firs/:id/verify`, `/api/roles/:address`, `/api/contract`
- Frontend role-based dashboards: `/victim` and `/gov`

## Monorepo Structure

```
contracts/FIRRegistry.sol                  # Upgraded smart contract
backend/                                   # Node.js backend
  server.js                                # API server
  package.json
  services/
    blockchain.js                          # ethers.js interaction
    ipfs.js                                # IPFS/Pinata client
    ocr.js                                 # Tesseract OCR
    stt.js                                 # Google STT or fallback
    ml.js                                  # Similarity + law section helper
  middleware/validation.js                  # Joi validators
  contracts/FIRRegistry.json                # ABI
  ml/similarity_calculator.py               # Python similarity helper
src/                                       # React frontend
  Pages/VictimDashboard.jsx                 # Victim role UI
  Pages/GovDashboard.jsx                    # Government role UI
```

## Environment Variables

Backend (`backend/.env`):

```
RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0xYourDeployedContract
PRIVATE_KEY=0xVictimPrivateKey
GOV_PRIVATE_KEY=0xGovPrivateKey
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
SIMILARITY_THRESHOLD=75
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Frontend (`.env` at repo root):

```
VITE_API_BASE_URL=http://localhost:5000
```

## Smart Contract

- Implements `createFIR(string cid, uint256 similarityScore)` (auto-verifies at ≥75)
- `setVerification(uint256 id, bool verified)` restricted to `GOV_ROLE`
- Events: `FIRCreated`, `FIRVerified`

Deploy the contract and set `CONTRACT_ADDRESS` in backend `.env`.

## Backend API

- POST `/api/submitFIR` (multipart: `image`, `audio`, `victimAddress`)
  - Runs OCR → STT → similarity
  - Uploads JSON to IPFS
  - Calls `createFIR` and optionally `setVerification`
  - Returns `{firId, cid, ipfsUrl, txHash, ocrText, sttText, similarityScore, verified}`

- GET `/api/firs?verified=true|false&limit&offset`
- GET `/api/firs/:id`
- POST `/api/firs/:id/verify` `{ verified }`
- GET `/api/roles/:address`
- GET `/api/contract`

## Frontend

- Victim Dashboard (`/victim`): upload image + audio, shows OCR text, STT text, similarity, CID, tx hash.
- Government Dashboard (`/gov`): lists unverified FIRs, verify/reject actions.
- Logs (`/fir-logs`): shows on-chain FIR list with IPFS links.

## Running

1) Frontend
```
npm install
npm run dev
```

2) Backend
```
cd backend
npm install
cp env.example .env
# fill in values
npm run dev
```

## Notes

- Only CIDs are stored on-chain; no PII on-chain.
- Prefer HTTPS for backend in production.
- If IPFS is public, consider encrypting raw files or using private pinning.
