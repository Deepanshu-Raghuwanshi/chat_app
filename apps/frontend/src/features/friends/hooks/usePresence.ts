import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfile } from "../services/friends.service";
import { io, Socket } from "socket.io-client";

interface PresenceUpdate {
  userId: string;
  status: "ONLINE" | "OFFLINE";
}

let socket: Socket | null = null;

export const usePresence = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) {
      const CHAT_SERVICE_URL =
        process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || "http://localhost:3003";
      socket = io(`${CHAT_SERVICE_URL}/presence`, {
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("connect", () => {
        console.log("Connected to presence gateway");
      });

      socket.on("presence.updated", (data: PresenceUpdate) => {
        console.log("Presence update received:", data);
        queryClient.setQueryData<UserProfile[]>(["friends"], (oldFriends) => {
          if (!oldFriends) return oldFriends;

          return oldFriends.map((friend) => {
            if (friend.id === data.userId) {
              return {
                ...friend,
                isOnline: data.status === "ONLINE",
              };
            }
            return friend;
          });
        });
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from presence gateway");
      });

      socket.on("connect_error", (error) => {
        console.error("Presence connection error:", error);
      });
    }

    return () => {
      // We keep the socket alive across components using FriendList
      // If we want to disconnect when no one is using it, we'd need a ref counter
    };
  }, [queryClient]);
};
