import React from 'react';

// 此处数据在实际应用中应由后端提供，受限于 Clinic-scoped 权限[cite: 1]
const MOCK_CLINIC_USERS = [
  { id: 'u1', name: 'Nurse_Sarah', role: 'Staff' },
  { id: 'u2', name: 'Dr_Chen', role: 'Clinician' }
];

export default function MentionsDropdown({ onSelect }) {
  return (
    <div className="absolute bottom-full mb-1 left-2 w-48 bg-white border border-gray-200 shadow-xl rounded-md overflow-hidden z-20">
      <ul className="py-1">
        {MOCK_CLINIC_USERS.map(user => (
          <li
            key={user.id}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer flex justify-between"
            onClick={() => onSelect(user)}
          >
            <span>{user.name}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">{user.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}