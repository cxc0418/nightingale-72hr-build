import { useState, useEffect } from 'react';

export function useNightingale() {
  const [token, setToken] = useState(null);
  // 默认角色直接改为对应的 username
  const [role, setRole] = useState('dr_smith');
  const [timelineTick, setTimelineTick] = useState(0);

  // 1. 自动处理登录与 Token 获取
  useEffect(() => {
    const authenticate = async () => {
      // 因为前端下拉菜单现在直接传的是 username，所以不再需要 roleUserMap
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
  }, [role]); // 依赖项包含 role，切换角色时自动重新登录

  // 2. 挂载 SSE (Server-Sent Events) 监听
  useEffect(() => {
    if (!token) return;

    // 建立与后端的流式长连接
    const eventSource = new EventSource(`/api/events?token=${token}`);

    eventSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === "timeline_updated") {
        // 收到全局刷新信号，递增 tick 以触发相关组件重新拉取数据
        setTimelineTick(prev => prev + 1);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error. Reconnecting...", err);
      eventSource.close();
    };

    // React 组件卸载或 Token 变更时，自动清理旧连接防止内存泄漏
    return () => eventSource.close();
  }, [token]);

  return { token, role, setRole, timelineTick };
}