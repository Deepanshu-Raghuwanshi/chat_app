"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "../../../shared/utils/cn";

export const EmptyConversationState = () => {
  const t = useTranslations("features.chat.empty");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full bg-secondary/50",
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center p-8 max-w-sm">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-primary/60" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-foreground/50 leading-relaxed">
          {t("subtitle")}
        </p>
      </div>
    </div>
  );
};
