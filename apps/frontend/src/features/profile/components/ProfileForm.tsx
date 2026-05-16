import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { useProfile } from "../hooks/useProfile";
import { Spinner } from "../../../shared/components/ui/spinner";

const ProfileForm = ({ userId }: { userId?: string }) => {
  const t = useTranslations("features.profile");
  const tc = useTranslations("common.buttons");
  const { profile, updateProfileAsync, isUpdating, isOwnProfile } =
    useProfile(userId);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    bio: "",
    status: "",
    phoneNumber: "",
    countryCode: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        bio: profile.bio || "",
        status: profile.status || "",
        phoneNumber: profile.phoneNumber || "",
        countryCode: profile.countryCode || "",
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!isOwnProfile || !isEditing) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        bio: profile.bio || "",
        status: profile.status || "",
        phoneNumber: profile.phoneNumber || "",
        countryCode: profile.countryCode || "",
      });
    }
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnProfile || !isEditing) return;

    const trimmedData = {
      fullName: formData.fullName.trim(),
      bio: formData.bio.trim(),
      status: formData.status.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      countryCode: formData.countryCode.trim(),
    };

    try {
      await updateProfileAsync(trimmedData);
      setIsEditing(false);
    } catch {
      // error toast is handled in mutation onError
    }
  };

  const isFormDirty = () => {
    if (!profile || !isOwnProfile) return false;
    return (
      formData.fullName.trim() !== (profile.fullName || "") ||
      formData.bio.trim() !== (profile.bio || "") ||
      formData.status.trim() !== (profile.status || "") ||
      formData.phoneNumber.trim() !== (profile.phoneNumber || "") ||
      formData.countryCode.trim() !== (profile.countryCode || "")
    );
  };

  const isFormValid = () => formData.fullName.trim().length > 0;

  const canUpdate = isEditing && isFormDirty() && isFormValid() && !isUpdating;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 bg-card p-6 rounded-xl shadow-sm border border-border"
    >
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {t("sections.basic_info")}
        </h2>
        {isOwnProfile && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            {t("buttons.edit")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-foreground"
          >
            {t("fields.fullName")}
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder={t("placeholders.fullName")}
            className="block w-full px-4 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none disabled:bg-muted disabled:text-muted-foreground"
            required
            disabled={!isEditing || !isOwnProfile}
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="status"
            className="block text-sm font-medium text-foreground"
          >
            {t("fields.status")}
          </label>
          <input
            type="text"
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            placeholder={t("placeholders.status")}
            className="block w-full px-4 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none disabled:bg-muted disabled:text-muted-foreground"
            disabled={!isEditing || !isOwnProfile}
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label
            htmlFor="bio"
            className="block text-sm font-medium text-foreground"
          >
            {t("fields.bio")}
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            value={formData.bio}
            onChange={handleChange}
            placeholder={t("placeholders.bio")}
            className="block w-full px-4 py-2 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none disabled:bg-muted disabled:text-muted-foreground"
            disabled={!isEditing || !isOwnProfile}
          />
        </div>
      </div>

      {isOwnProfile && isEditing && (
        <div className="pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUpdating}
            className="px-6 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {tc("cancel")}
          </button>
          <button
            type="submit"
            disabled={!canUpdate}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isUpdating && <Spinner className="w-4 h-4 text-white" />}
            {tc("save")}
          </button>
        </div>
      )}
    </form>
  );
};

export { ProfileForm };
