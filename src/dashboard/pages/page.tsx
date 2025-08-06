import React, { type FC } from 'react';
import {
  Page,
  WixDesignSystemProvider,
  Button,
  Box,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import * as Icons from '@wix/wix-ui-icons-common';
import { dashboard } from '@wix/dashboard';

import TransactionsDashboard from './transactionsPage';

const MainDashboard: FC = () => {
  const handleRefresh = () => {
    dashboard.showToast({
      message: 'Refreshing transactions...'
    });
    // The refresh will be handled by the TransactionsDashboard component
    window.location.reload();
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title="Transactions"
          subtitle="View and manage payment transactions from your customers."
          actionsBar={
            <Box gap="12px">
              <Button
                onClick={handleRefresh}
                prefixIcon={<Icons.Refresh />}
              >
                Refresh
              </Button>
            </Box>
          }
        />

        <Page.Content>
          <TransactionsDashboard />
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default MainDashboard;