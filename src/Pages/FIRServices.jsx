import { Link, Outlet, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { useState } from "react";
import Connect from "../Components/Connect";

const FIRServices = () => {
  const [account, setAccount] = useState(null);
  const navigate = useNavigate();

  const goToServices = () => {
    if (!account) {
      alert("Please connect your wallet first!");
      return;
    }
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
    <Wrapper>
      {/* ✅ Navbar copied from HOME.jsx */}
      <nav className="nav">
        <div className="container">
          <div className="btn">HOME</div>
          <div className="btn" onClick={goToServices}> SERVICES</div>
          <div className="btn" onClick={goToFIRLogs}> LOGS</div>
          <Connect className="btn" setAccount={setAccount} />
        </div>
      </nav>

      <h2>Select Complaint Option</h2>
      <div className="buttons">
        <Link to="form" className="btn form-btn">
           Form
        </Link>
        <Link to="audio" className="btn audio-btn">
           Audio Record
        </Link>
      </div>

      <div className="outlet">
        <Outlet />
      </div>
    </Wrapper>
  );
};

export default FIRServices;

const Wrapper = styled.div`
  min-height: 100vh;
  width: 100vw;
  background-color: white;
  color: black;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  /* ✅ Navbar styles from HOME.jsx */
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

  h2 {
    margin-top: 120px; /* push below navbar */
    margin-bottom: 20px;
  }

  .buttons {
    display: flex;
    gap: 20px;
    margin-bottom: 30px;
  }

  .form-btn {
    background-color: #f4a261;
  }

  .audio-btn {
    background-color: #e76f51;
  }

  .outlet {
    width: 80%;
    max-width: 800px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 10px;
    box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
    background: #fff;
  }
`;
