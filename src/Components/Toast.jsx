import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import styled from "styled-components";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, type = "info", timeout = 3000) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (timeout > 0) {
      setTimeout(() => remove(id), timeout);
    }
  }, [remove]);

  const api = useMemo(() => ({ show, remove }), [show, remove]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Container>
        {toasts.map((t) => (
          <ToastItem key={t.id} data-type={t.type}>
            {t.message}
          </ToastItem>
        ))}
      </Container>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};

const Container = styled.div`
  position: fixed;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
`;

const ToastItem = styled.div`
  background: #111;
  color: #fff;
  padding: 10px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  min-width: 220px;
  &[data-type="success"] { background: #137333; }
  &[data-type="error"] { background: #b00020; }
  &[data-type="warning"] { background: #b08200; }
`;


