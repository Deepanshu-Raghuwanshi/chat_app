import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendsService, FriendRequest, UserProfile } from '../services/friends.service';

export const useFriends = () => {
  return useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsService.getFriends(),
  });
};

export const useIncomingRequests = () => {
  return useQuery({
    queryKey: ['friend-requests', 'incoming'],
    queryFn: () => friendsService.getIncomingRequests(),
  });
};

export const useRecommendations = () => {
  return useQuery({
    queryKey: ['friend-recommendations'],
    queryFn: () => friendsService.getRecommendations(),
  });
};

export const useSendFriendRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (receiverId: string) => friendsService.sendFriendRequest(receiverId),
    
    // Optimistic Update
    onMutate: async (receiverId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['friend-requests', 'outgoing'] });
      await queryClient.cancelQueries({ queryKey: ['friend-recommendations'] });

      // Snapshot the previous values
      const previousOutgoing = queryClient.getQueryData<FriendRequest[]>(['friend-requests', 'outgoing']);
      const previousRecommendations = queryClient.getQueryData<UserProfile[]>(['friend-recommendations']);

      // Optimistically remove from recommendations
      if (previousRecommendations) {
        queryClient.setQueryData(
          ['friend-recommendations'],
          previousRecommendations.filter(u => u.id !== receiverId)
        );
      }

      return { previousOutgoing, previousRecommendations };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _variables, context) => {
      if (context?.previousOutgoing) {
        queryClient.setQueryData(['friend-requests', 'outgoing'], context.previousOutgoing);
      }
      if (context?.previousRecommendations) {
        queryClient.setQueryData(['friend-recommendations'], context.previousRecommendations);
      }
    },

    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests', 'outgoing'] });
      queryClient.invalidateQueries({ queryKey: ['friend-recommendations'] });
    },
  });
};

export const useRespondToRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, action }: { requestId: string; action: 'ACCEPT' | 'REJECT' }) =>
      friendsService.respondToRequest(requestId, action),
    
    // Optimistic Update
    onMutate: async ({ requestId, action }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['friend-requests', 'incoming'] });
      await queryClient.cancelQueries({ queryKey: ['friends'] });

      // Snapshot the previous value
      const previousRequests = queryClient.getQueryData<FriendRequest[]>(['friend-requests', 'incoming']);
      const previousFriends = queryClient.getQueryData<UserProfile[]>(['friends']);

      // Optimistically update to the new value
      if (previousRequests) {
        const respondingRequest = previousRequests.find(r => r.id === requestId);
        queryClient.setQueryData(
          ['friend-requests', 'incoming'],
          previousRequests.filter(r => r.id !== requestId)
        );

        if (action === 'ACCEPT' && respondingRequest && respondingRequest.sender) {
          queryClient.setQueryData(
            ['friends'],
            [...(previousFriends || []), respondingRequest.sender]
          );
        }
      }

      return { previousRequests, previousFriends };
    },

    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _variables, context) => {
      if (context?.previousRequests) {
        queryClient.setQueryData(['friend-requests', 'incoming'], context.previousRequests);
      }
      if (context?.previousFriends) {
        queryClient.setQueryData(['friends'], context.previousFriends);
      }
    },

    // Always refetch after error or success:
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests', 'incoming'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-recommendations'] });
    },
  });
};
