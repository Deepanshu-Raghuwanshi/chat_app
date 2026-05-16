"use client";

import React from "react";
import { Sparkles, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface UserRecommendation {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string | null;
}

interface RecommendationListProps {
  recommendations?: UserRecommendation[];
  onSendRequest: (userId: string) => void;
}

export const RecommendationList = ({
  recommendations,
  onSendRequest,
}: RecommendationListProps) => {
  const t = useTranslations("features.friends");

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold text-foreground">
          {t("sections.recommended")}
        </h2>
      </div>

      {recommendations && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all"
            >
              <Link
                href={`/profile/${user.id}`}
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {user.fullName || user.username}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => onSendRequest(user.id)}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
              >
                {t("buttons.add_friend")}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 bg-muted/40 rounded-xl border border-border">
          <p className="text-muted-foreground text-sm italic">
            {t("placeholders.no_recommendations")}
          </p>
        </div>
      )}
    </section>
  );
};
