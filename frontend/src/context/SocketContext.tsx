import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface SocketContextType {
  connected: boolean;
  kpiTrigger: number;
  notifTrigger: number;
  showToast: (message: string) => void;
  toastMessage: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [kpiTrigger, setKpiTrigger] = useState(0);
  const [notifTrigger, setNotifTrigger] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!token || !user) {
      setConnected(false);
      return;
    }

    let ws: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket('ws://localhost:5001/ws');

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'KPI_UPDATE') {
            setKpiTrigger((prev) => prev + 1);
          }

          if (data.type === 'NOTIFICATIONS_UPDATE') {
            if (data.payload.userId === user.id) {
              setNotifTrigger((prev) => prev + 1);
              showToast('You have a new unread notification alert.');
            }
          }
        } catch (err) {
          console.error('[WebSocket message parsing error]', err);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        // onclose handles reconnect; browser error events are often empty
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [token, user?.id]);

  return (
    <SocketContext.Provider value={{ connected, kpiTrigger, notifTrigger, showToast, toastMessage }}>
      {children}
      {toastMessage && (
        <div className="toast">
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
