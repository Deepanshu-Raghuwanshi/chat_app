"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Search, Users, UserCheck, Clock } from "lucide-react";
import { useSearchUsers } from "../hooks/useFriends";
import { Spinner } from "../../../shared/components/ui/spinner";
import { UserSearchResult } from "../services/friends.service";

interface RelationshipButtonProps {
  user: UserSearchResult;
  onSendRequest: (userId: string) => void;
  t: ReturnType<typeof useTranslations>;
}

const RelationshipButton = ({
  user,
  onSendRequest,
  t,
}: RelationshipButtonProps) => {
  if (user.relationshipStatus === "friend") {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-semibold rounded-lg">
        <UserCheck className="w-4 h-4" />
        {t("buttons.already_friends")}
      </span>
    );
  }
  if (
    user.relationshipStatus === "pending_outgoing" ||
    user.relationshipStatus === "pending_incoming"
  ) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 bg-muted text-muted-foreground text-sm font-semibold rounded-lg">
        <Clock className="w-4 h-4" />
        {t("buttons.request_pending")}
      </span>
    );
  }
  return (
    <button
      onClick={() => onSendRequest(user.id)}
      className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
    >
      {t("buttons.add_friend")}
    </button>
  );
};

interface UserSearchPanelProps {
  onSendRequest: (userId: string) => void;
}

export const UserSearchPanel = ({ onSendRequest }: UserSearchPanelProps) => {
  const t = useTranslations("features.friends");
  const tSub = useTranslations("features.sub_navbar.friends");
  const [query, setQuery] = useState("");
  const { data: results, isLoading } = useSearchUsers(query);

  const showSpinner = isLoading && query.trim().length >= 2;
  const showIdle = query.trim().length < 2;
  const showEmpty = !showSpinner && !showIdle && results?.length === 0;
  const showResults =
    !showSpinner && !showIdle && results && results.length > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Search className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">{tSub("search")}</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {showSpinner && (
        <div className="flex justify-center p-12">
          <Spinner className="w-8 h-8 text-primary" />
        </div>
      )}

      {showIdle && (
        <div className="text-center p-12 bg-muted/40 rounded-2xl border-2 border-dashed border-border">
          <Search className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            {t("search.idle")}
          </p>
        </div>
      )}

      {showEmpty && (
        <div className="text-center p-12 bg-muted/40 rounded-2xl border-2 border-dashed border-border">
          <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            {t("search.no_results")}
          </p>
        </div>
      )}

      {showResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((user) => (
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
              <RelationshipButton
                user={user}
                onSendRequest={onSendRequest}
                t={t}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
