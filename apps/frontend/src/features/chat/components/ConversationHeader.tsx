"use client";

import React from "react";
import { Conversation } from "@shared-types";
import { Avatar } from "../../../shared/components/ui/Avatar";
import { ArrowLeft } from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { useAuthStore } from "../../auth/store/useAuthStore";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

interface ConversationHeaderProps {
  conversation: Conversation;
}

export const ConversationHeader = ({
  conversation,
}: ConversationHeaderProps) => {
  const t = useTranslations("features.chat.conversation");
  const currentUserId = useAuthStore((state) => state.user?.id);
  const router = useRouter();
  const other = conversation.participants.find(
    (p) => p.userId !== currentUserId,
  );
  const displayName = other?.fullName || other?.username || "Unknown";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-border shadow-sm shrink-0">
      <button
        onClick={() => router.push("/chat")}
        className="p-1 rounded-lg hover:bg-secondary transition-colors md:hidden"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5 text-foreground/60" />
      </button>

      <div className="relative shrink-0">
        <Avatar
          avatarUrl={other?.avatarUrl}
          fullName={other?.fullName}
          username={other?.username}
          size="md"
        />
        {other?.isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{displayName}</p>
        <p
          className={cn(
            "text-xs",
            other?.isOnline ? "text-green-500" : "text-foreground/40",
          )}
        >
          {other?.isOnline ? t("online") : t("offline")}
        </p>
      </div>
    </div>
  );
};
