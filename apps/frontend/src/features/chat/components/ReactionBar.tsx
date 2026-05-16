"use client";

import React, { useEffect, useRef, useState } from "react";
import { Reaction } from "@shared-types";
import { cn } from "../../../shared/utils/cn";

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

const MAX_VISIBLE = 3;

export const ReactionBar = ({
  reactions,
  currentUserId,
  onToggle,
}: ReactionBarProps) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const grouped = reactions.reduce<
    Record<string, { count: number; mine: boolean }>
  >((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count += 1;
    if (r.userId === currentUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  if (entries.length === 0) return null;

  const isCollapsed = entries.length > MAX_VISIBLE && !expanded;

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-1 mt-1 px-1">
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-secondary text-foreground/70 hover:bg-primary/10 hover:text-primary transition-all duration-150"
        >
          <span>{entries[0][0]}</span>
          <span>+{entries.length - 1}</span>
        </button>
      ) : (
        entries.map(([emoji, { count, mine }]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all duration-150",
              mine
                ? "bg-primary/15 ring-1 ring-primary/40 text-primary font-medium"
                : "bg-secondary text-foreground/70 hover:bg-primary/10 hover:text-primary",
            )}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        ))
      )}
    </div>
  );
};
