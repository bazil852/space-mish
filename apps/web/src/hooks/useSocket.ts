'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/lib/websocket';

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    const offConnected = socket.on('connected', () => setConnected(true));
    const offDisconnected = socket.on('disconnected', () => setConnected(false));
    socket.connect();

    return () => {
      offConnected();
      offDisconnected();
    };
  }, []);

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    return socketRef.current.on(event, handler);
  }, []);

  const send = useCallback((event: string, data: unknown) => {
    socketRef.current.send(event, data);
  }, []);

  return { connected, on, send, socket: socketRef.current };
}
