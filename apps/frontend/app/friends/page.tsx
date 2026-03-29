'use client';

import React, { useState } from 'react';
import { FriendList } from '../../src/features/friends/components/FriendList';
import { SubNavbar } from '../../src/features/friends/components/SubNavbar';
import { useIncomingRequests } from '../../src/features/friends/hooks/useFriends';

export default function FriendsPage() {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const { data: requests } = useIncomingRequests();

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNavbar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        requestCount={requests?.length}
      />
      <div className="pt-6">
        <FriendList activeTab={activeTab} />
      </div>
    </div>
  );
}
