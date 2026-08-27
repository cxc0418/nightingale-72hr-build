import React, { useState } from 'react';
import RichCommentEditor from './RichCommentEditor';

export default function CommentThread({ comments, currentUserRole }) {
  // RBAC 拦截：患者角色严格禁止查看内部医护评论[cite: 1]
  if (currentUserRole === 'patient') return null;

  const [thread, setThread] = useState(comments || []);

  const toggleStatus = (id) => {
    // 切换评论的 resolve/unresolve 状态[cite: 1]
    setThread(thread.map(c =>
      c.id === id ? { ...c, status: c.status === 'open' ? 'resolved' : 'open' } : c
    ));
    // TODO: 触发后端 API 更新状态并联动 Glance View[cite: 1]
  };

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {thread.map((comment) => (
        <div key={comment.id} className={`p-3 border rounded shadow-sm ${comment.status === 'resolved' ? 'opacity-60 bg-gray-100' : 'bg-white'}`}>
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-sm text-gray-800">{comment.author_name}</span>
            <button
              onClick={() => toggleStatus(comment.id)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {comment.status === 'open' ? '✓ Mark as Resolved' : '↺ Unresolve'}
            </button>
          </div>
          <p className="text-sm text-gray-700">{comment.content}</p>

          {/* 任务分配标签[cite: 1] */}
          {comment.assignee_name && (
            <div className="mt-2 inline-block px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
              Assigned to: {comment.assignee_name}
            </div>
          )}
        </div>
      ))}
      <RichCommentEditor onCommentAdd={(newComment) => setThread([...thread, newComment])} />
    </div>
  );
}