import React from "react";
import styled, { keyframes } from "styled-components";

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Wrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const Ring = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #111;
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
`;

const Spinner = ({ label }) => (
  <Wrapper>
    <Ring />
    {label && <span>{label}</span>}
  </Wrapper>
);

export default Spinner;


