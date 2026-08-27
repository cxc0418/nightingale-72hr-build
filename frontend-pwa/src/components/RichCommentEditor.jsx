import React, { useState } from 'react';
import MentionsDropdown from './MentionsDropdown';

export default function RichCommentEditor({ onCommentAdd }) {
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [assignTask, setAssignTask] = useState(false); // Controls optional task assignment[cite: 18]
  const [selectedMention, setSelectedMention] = useState(null);

  const handleInput = (e) => {
    const val = e.target.value;
    setContent(val);
    // Regex listener for the @ symbol to trigger the dropdown menu[cite: 18]
    const match = val.match(/@(\w*)$/);
    setShowMentions(!!match);
  };

  const handleMentionSelect = (user) => {
    const newVal = content.replace(/@(\w*)$/, `@${user.name} `);
    setContent(newVal);
    setSelectedMention(user);
    setShowMentions(false);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onCommentAdd({
      id: crypto.randomUUID(),
      content,
      status: 'open',
      assignee_name: assignTask && selectedMention ? selectedMention.name : null,
      author_name: 'Current Staff' // Ideally fetched from Auth Context in a full implementation[cite: 18]
    });
    setContent('');
    setAssignTask(false);
    setSelectedMention(null);
  };

  return (
    <div className="relative mt-3 border border-gray-300 rounded p-2 bg-white">
      <textarea
        className="w-full text-sm outline-none resize-none"
        rows="2"
        placeholder="Type a comment... Use @ to mention staff/clinicians"
        value={content}
        onChange={handleInput}
      />
      {showMentions && <MentionsDropdown onSelect={handleMentionSelect} />}

      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
        <label className="text-xs flex items-center space-x-1 cursor-pointer">
          <input
            type="checkbox"
            checked={assignTask}
            onChange={(e) => setAssignTask(e.target.checked)}
            disabled={!selectedMention}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span className={!selectedMention ? 'text-gray-400' : 'text-gray-700 font-medium'}>
            Assign as Task
          </span>
        </label>
        <button
          onClick={handleSubmit}
          className="bg-indigo-600 text-white text-xs px-4 py-1.5 rounded shadow hover:bg-indigo-700 transition-colors"
        >
          Post
        </button>
      </div>
    </div>
  );
}