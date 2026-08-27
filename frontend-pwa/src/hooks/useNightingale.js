import { useState, useEffect } from 'react';

export function useNightingale() {
  const [token, setToken] = useState(null);
  // Default role maps directly to the backend username
  const [role, setRole] = useState('dr_smith');
  const [timelineTick, setTimelineTick] = useState(0);

  // 1. Handle automatic login and token retrieval
  useEffect(() => {
    const authenticate = async () => {
      // The frontend dropdown passes the username directly
      const username = role;
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', 'password');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });

        if (response.ok) {
          const data = await response.json();
          setToken(data.access_token);
        } else {
          console.error("Authentication failed with status:", response.status);
        }
      } catch (error) {
        console.error("Network error during authentication:", error);
      }
    };

    authenticate();
  }, [role]); // Re-authenticate automatically when the role changes

  // 2. Mount SSE (Server-Sent Events) listener for real-time updates
  useEffect(() => {
    if (!token) return;

    // Establish a streaming connection with the backend
    const eventSource = new EventSource(`/api/events?token=${token}`);

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "timeline_updated") {
        // Global refresh signal received; increment tick to trigger data refetch
        setTimelineTick(prev => prev + 1);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error. Reconnecting...", err);
      eventSource.close();
    };

    // Clean up the connection on component unmount or token change to prevent memory leaks
    return () => eventSource.close();
  }, [token]);

  return { token, role, setRole, timelineTick };
}