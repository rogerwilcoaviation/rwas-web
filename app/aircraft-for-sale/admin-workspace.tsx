'use client';
import { useState } from 'react';
import {
  AccountSection,
  AccountWorkspace,
} from '@/components/shared/AccountWorkspace';
import SellerAccounts from '../seller-accounts/SellerAccounts';
import SellerReview from '../seller-review/SellerReview';
import SupportDesk from './support-desk';
import AdministratorManagement from './administrator-management';
import AdminListings from './admin-listings';
type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;
export default function AdminWorkspace({
  request,
  canManageAdministrators = false,
}: {
  request: Request;
  canManageAdministrators?: boolean;
}) {
  const [section, setSection] = useState('review');
  return (
    <AccountWorkspace
      label="Administrator index"
      value={section}
      onValueChange={setSection}
      items={[
        { value: 'review', label: 'Approve listings' },
        { value: 'listings', label: 'Edit and delete listings' },
        { value: 'users', label: 'User accounts' },
        { value: 'support', label: 'Customer support' },
        ...(canManageAdministrators
          ? [{ value: 'administrators', label: 'Administrators' }]
          : []),
      ]}
    >
      <AccountSection value="review">
        <SellerReview embedded />
      </AccountSection>
      <AccountSection value="listings">
        <AdminListings request={request} />
      </AccountSection>
      <AccountSection value="users">
        <SellerAccounts
          allowIdentityAdministration={canManageAdministrators}
          embedded
        />
      </AccountSection>
      <AccountSection value="support">
        <SupportDesk request={request} admin />
      </AccountSection>
      {canManageAdministrators && (
        <AccountSection value="administrators">
          <AdministratorManagement request={request} />
        </AccountSection>
      )}
    </AccountWorkspace>
  );
}
