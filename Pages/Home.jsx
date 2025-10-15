import React, { useState } from "react";
import styled, { createGlobalStyle } from "styled-components";
import { Link, useNavigate } from "react-router-dom"; // ⬅️ import useNavigate
import WELCOME from "./WELCOME.png";
import Connect from "../Components/Connect";

const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    background: white;
    font-family: Arial, sans-serif;
  }
`;

const HOME = () => {
  const [account, setAccount] = useState(null);
  const navigate = useNavigate();

  const goToServices = () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }
    // Navigate to FIRForm with account passed in state
    navigate("/services", { state: { account } });
  };

  const goToFIRLogs = () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }
    navigate("/fir-logs", { state: { account } });
  };

  return (
    <>
      <GlobalStyle />
      <StyledWrapper>
        {/* Navbar */}
        <nav className="nav">
          <div className="container">
            <div className="btn">HOME</div>
            {/* ⬇️ navigate to FIRForm with victim address */}
            <div className="btn" onClick={goToServices}>
               SERVICES
            </div>
            <div className="btn" onClick={goToFIRLogs}>
               LOGS
            </div>
            <Connect className="btn" setAccount={setAccount} />
          </div>
        </nav>

        {/* Two-Column Grid Section */}
        <div className="content-grid">
          {/* Left Grid: Centered Image */}
          <div className="image-section">
            <img src={WELCOME} alt="Welcome" />
          </div>

          {/* Right Grid: Text Description */}
          <div className="text-section">
            <div className="text-container">
              <h2>Blockchain-Powered  System</h2>
              <p>
                This product is a blockchain-powered complaint management system
                designed to make the complaint filing process secure,
                transparent, and tamper-proof. When a victim reports an incident,
                the police officer logs in with a government-verified wallet ID,
                records the victim’s statement as an audio file, and the system
                automatically transcribes it into text. The victim then validates
                the statement using a digital signature or fingerprint, after
                which the complaint copy is forwarded to higher officials for digital
                approval. Once verified, the document is hashed, revalidated by
                the backend, uploaded to IPFS, and its CID is securely stored on
                the blockchain, ensuring authenticity, transparency, and
                long-term trust in the  filing process.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="footer">
          <p>© 2025 D-Comp. All rights reserved.</p>
        </footer>
      </StyledWrapper>
    </>
  );
};

const StyledWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: flex-start;
  align-items: center;

  .nav {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 40px;
    z-index: 1000;
  }

  .container {
    background: #111;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1em;
    padding: 0.5em 2em;
    border-radius: 40px;
    min-width: 600px;
  }

  .btn {
    position: relative;
    padding: 0.5em 1em;
    color: #fff;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
    white-space: nowrap;
  }

  .btn:hover {
    background: #e4ae0b;
    color: #000;
    border-radius: 10px;
  }

  .btn::after {
    content: "";
    position: absolute;
    bottom: -5px;
    left: 0;
    height: 3px;
    width: 0;
    background: #e4ae0b;
    transition: width 0.3s ease;
    border-radius: 2px;
  }

  .btn:hover::after {
    width: 100%;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 40px;
    margin-top: 120px;
    padding: 20px;
    width: 70%;
    max-width: 1200px;
    margin-left: auto;
    margin-right: auto;
  }

  .image-section {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .image-section img {
    width: 100%;
    max-width: 400px;
    border-radius: 30px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    object-fit: cover;
  }

  .text-section {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .text-container {
    background: #f1f1f1;
    padding: 30px;
    border-radius: 20px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }

  .text-container h2 {
    color: #111;
    text-align: center;
    margin-top: 0;
  }

  .text-container p {
    color: #444;
    line-height: 1.6;
    text-align: justify;
  }

  .footer {
    text-align: center;
    padding: 2em 0;
    margin-top: auto;
    background: #111;
    color: white;
    font-weight: bold;
    width: 100%;
  }

  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
      width: 95%;
      gap: 20px;
    }

    .image-section img,
    .text-container {
      width: 100%;
      max-width: none;
    }
  }
`;

export default HOME;
