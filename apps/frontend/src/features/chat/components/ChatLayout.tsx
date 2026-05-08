"use client";

import React from "react";
import { ConversationSidebar } from "./ConversationSidebar";
import { cn } from "../../../shared/utils/cn";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export const ChatLayout = ({ children }: ChatLayoutProps) => {
  return (
    <div
      className={cn(
        "flex h-[calc(100vh-4rem)] overflow-hidden bg-secondary/30",
      )}
    >
      <ConversationSidebar />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
};
