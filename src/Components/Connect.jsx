import React from "react";
import { ethers } from "ethers";
import Web3Modal from "web3modal";

const Connect = ({ className, setAccount }) => {
  const connectWallet = async () => {
    try {
      const web3Modal = new Web3Modal();
      const connection = await web3Modal.connect();
      const provider = new ethers.BrowserProvider(connection);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      console.log("Connected:", address);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  };

  return (
    <div className={className} onClick={connectWallet}>
      Connect Wallet
    </div>
  );
};

export default Connect;
