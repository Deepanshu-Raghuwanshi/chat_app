'use client';

import React from 'react';
import { useFriends, useIncomingRequests, useRespondToRequest, useRecommendations, useSendFriendRequest } from '../hooks/useFriends';
import { FriendCard } from './FriendCard';
import { Users, UserPlus, Sparkles } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';

export const FriendList = () => {
  const { data: friends, isLoading: isLoadingFriends } = useFriends();
  const { data: requests, isLoading: isLoadingRequests } = useIncomingRequests();
  const { data: recommendations, isLoading: isLoadingRecs } = useRecommendations();
  const { mutate: respondToRequest } = useRespondToRequest();
  const { mutate: sendRequest } = useSendFriendRequest();

  if (isLoadingFriends || isLoadingRequests || isLoadingRecs) {
    return (
      <div className="flex justify-center p-12">
        <Spinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12 pb-20">
      {/* Incoming Requests Section */}
      {requests && requests.length > 0 && (
        <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">Incoming Requests</h2>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
              {requests.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((request) => (
              <FriendCard
                key={request.id}
                userId={request.senderId}
                username={request.sender?.username}
                fullName={request.sender?.fullName}
                avatarUrl={request.sender?.avatarUrl}
                isIncomingRequest
                onAccept={() => respondToRequest({ requestId: request.id, action: 'ACCEPT' })}
                onReject={() => respondToRequest({ requestId: request.id, action: 'REJECT' })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Friends Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">Friends</h2>
          {friends && friends.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
              {friends.length}
            </span>
          )}
        </div>
        
        {friends && friends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend) => (
              <FriendCard
                key={friend.id}
                userId={friend.id}
                username={friend.username}
                fullName={friend.fullName}
                avatarUrl={friend.avatarUrl}
                onRemove={() => console.log('Remove friend', friend.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No friends yet. Start adding people!</p>
          </div>
        )}
      </section>

      {/* Recommendations Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-gray-900">Recommended for You</h2>
        </div>
        
        {recommendations && recommendations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{user.fullName || user.username}</p>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                </div>
                <button
                  onClick={() => sendRequest(user.id)}
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
                >
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-gray-500 text-sm italic">No new recommendations right now. Check back later!</p>
          </div>
        )}
      </section>
    </div>
  );
};
