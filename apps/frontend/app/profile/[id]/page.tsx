'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ProfileFeature } from '../../../src/features/profile/components/ProfileFeature';

const UserProfilePage = () => {
  const { id } = useParams();

  return <ProfileFeature userId={id as string} backUrl="/friends" />;
};

export default UserProfilePage;
