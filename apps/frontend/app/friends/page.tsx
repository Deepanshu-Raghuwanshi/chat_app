'use client';

import { FriendList } from '../../src/features/friends/components/FriendList';

export default function FriendsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      <div className="max-w-4xl mx-auto px-6 mb-8">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">Friends</h1>
        <p className="text-gray-500 mt-2">Manage your connections and pending requests</p>
      </div>
      <FriendList />
    </div>
  );
}
