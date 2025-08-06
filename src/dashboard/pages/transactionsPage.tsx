import React, { type FC, useState, useEffect } from 'react';
import { dashboard } from '@wix/dashboard';
import {
  Button,
  Page,
  WixDesignSystemProvider,
  Card,
  Text,
  Dropdown,
  Search,
  Table,
  TableToolbar,
  Badge,
  Box,
  Cell,
  Layout,
  IconButton,
  Loader,
} from '@wix/design-system';
import '@wix/design-system/styles.global.css';
import * as Icons from '@wix/wix-ui-icons-common';

import { transactionService, Transaction, TransactionFilters, TransactionMetrics } from '../../services/transactionService';

const TRANSACTION_STATUS_OPTIONS = [
  { id: 'all', value: 'All Transactions' },
  { id: 'approved', value: 'Approved' },
  { id: 'pending', value: 'Pending' },
  { id: 'declined', value: 'Declined' },
  { id: 'refunded', value: 'Refunded' },
  { id: 'cancelled', value: 'Cancelled' }
];

const TIME_PERIOD_OPTIONS = [
  { id: '7', value: 'Last 7 days' },
  { id: '30', value: 'Last 30 days' },
  { id: '90', value: 'Last 90 days' },
  { id: '365', value: 'Last year' }
];

const TransactionsDashboard: FC = () => {
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState<TransactionMetrics>({
    totalApproved: 0,
    totalPending: 0,
    totalDeclined: 0,
    totalRefunded: 0,
    totalTransactions: 0,
    totalRevenue: 0
  });
  const [searchValue, setSearchValue] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [timePeriod, setTimePeriod] = useState('30');
  const [loading, setLoading] = useState(false);
  const [usingMockData, setUsingMockData] = useState(true);

  const loadTransactionData = async () => {
    setLoading(true);
    try {
      const result = await transactionService.fetchTransactions();
      const calculatedMetrics = transactionService.calculateMetrics(result.data);

      setTransactions(result.data);
      setFilteredTransactions(result.data);
      setMetrics(calculatedMetrics);
      setUsingMockData(result.usingMockData);

      dashboard.showToast({
        message: result.usingMockData 
          ? 'Transaction data loaded (demo data)'
          : 'Live transaction data loaded successfully'
      });

    } catch (error) {
      console.error('Error loading transaction data:', error);
      dashboard.showToast({
        message: 'Failed to load transaction data'
      });
    } finally {
      setLoading(false);
    }
  };


  // Apply local filters
  const applyFilters = () => {
    const filters: TransactionFilters = {
      status: filterValue !== 'all' ? filterValue : undefined,
      searchQuery: searchValue || undefined,
      dateRange: parseInt(timePeriod)
    };

    const filtered = transactionService.applyFilters(transactions, filters);
    setFilteredTransactions(filtered);
  };

  // Load data on component mount
  useEffect(() => {
    loadTransactionData();
  }, []);

  // Apply filters when search/filter values change
  useEffect(() => {
    applyFilters();
  }, [searchValue, filterValue, timePeriod, transactions]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge skin="success" size="medium">APPROVED</Badge>;
      case 'PENDING':
        return <Badge skin="warning" size="medium">PENDING</Badge>;
      case 'DECLINED':
        return <Badge skin="danger" size="medium">DECLINED</Badge>;
      case 'REFUNDED':
        return <Badge skin="neutralStandard" size="medium">REFUNDED</Badge>;
      case 'CANCELLED':
        return <Badge skin="neutral" size="medium">CANCELLED</Badge>;
      default:
        return <Badge skin="standard" size="medium">{status}</Badge>;
    }
  };

  const handleRefreshData = async () => {
    setLoading(true);
    try {
      const result = await transactionService.refreshTransactions();
      const calculatedMetrics = transactionService.calculateMetrics(result.data);

      setTransactions(result.data);
      setFilteredTransactions(result.data);
      setMetrics(calculatedMetrics);
      setUsingMockData(result.usingMockData);

      dashboard.showToast({
        message: result.usingMockData
          ? 'Transaction data refreshed (demo data)'
          : 'Live transaction data refreshed successfully'
      });
    } catch (error) {
      console.error('Error refreshing transaction data:', error);
      dashboard.showToast({
        message: 'Failed to refresh transaction data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (option: any) => {
    setFilterValue(option.id.toString());
  };

  const handleTimePeriodChange = (option: any) => {
    setTimePeriod(option.id.toString());
  };

  const handleExportData = () => {
    dashboard.showToast({
      message: 'Export functionality will be implemented soon'
    });
  };

  return (
    <WixDesignSystemProvider features={{ newColorsBranding: true }}>
      <Page>
        <Page.Header
          title={`Transactions ${metrics.totalTransactions.toLocaleString()}`}
          subtitle="View and manage payment transactions from your customers."
          actionsBar={
            <Box gap="12px">
              <Button
                skin="light"
                onClick={handleRefreshData}
                disabled={loading}
                prefixIcon={<Icons.Refresh />}
              >
                Refresh
              </Button>
              <Button
                skin="light"
                onClick={handleExportData}
                prefixIcon={<Icons.Download />}
              >
                Export
              </Button>
            </Box>
          }
        />

        <Page.Content>
          {/* Data Source Indicator */}
          <Box marginBottom="12px">
            <Badge skin={usingMockData ? "neutral" : "success"} size="medium">
              <Icons.Info /> {usingMockData
                ? "Demo Data - Connect your Wix Payments to see real transactions"
                : "Live Data - Connected to Wix Payments"}
            </Badge>
          </Box>

          {/* Overview Section */}
          <Box marginBottom="24px" direction="vertical" gap="16px">
            <Box marginBottom="16px" align="space-between">
              <Text size="medium" weight="bold">Overview</Text>
              <Dropdown
                placeholder="Last 30 days"
                selectedId={timePeriod}
                onSelect={handleTimePeriodChange}
                options={TIME_PERIOD_OPTIONS}
              />
            </Box>

            <Box direction="horizontal" gap="16px">
              <Layout gap="16px">
                <Cell span={3}>
                  <Card>
                    <Card.Content>
                      <Box direction="vertical" align="center" padding="24px">
                        <Text size="medium" weight="bold">
                          {transactionService.formatAmount(metrics.totalRevenue)}
                        </Text>
                        <Text size="small" secondary>Total Revenue</Text>
                      </Box>
                    </Card.Content>
                  </Card>
                </Cell>

                <Cell span={3}>
                  <Card>
                    <Card.Content>
                      <Box direction="vertical" align="center" padding="24px">
                        <Text size="medium" weight="bold">
                          {transactionService.formatAmount(metrics.totalApproved)}
                        </Text>
                        <Text size="small" secondary>Approved</Text>
                      </Box>
                    </Card.Content>
                  </Card>
                </Cell>

                <Cell span={3}>
                  <Card>
                    <Card.Content>
                      <Box direction="vertical" align="center" padding="24px">
                        <Text size="medium" weight="bold">
                          {transactionService.formatAmount(metrics.totalPending)}
                        </Text>
                        <Text size="small" secondary>Pending</Text>
                      </Box>
                    </Card.Content>
                  </Card>
                </Cell>

                <Cell span={3}>
                  <Card>
                    <Card.Content>
                      <Box direction="vertical" align="center" padding="24px">
                        <Text size="medium" weight="bold">
                          {transactionService.formatAmount(metrics.totalRefunded)}
                        </Text>
                        <Text size="small" secondary>Refunded</Text>
                      </Box>
                    </Card.Content>
                  </Card>
                </Cell>
              </Layout>
            </Box>
          </Box>

          {/* Table Section */}
          <Card>
            <TableToolbar>
              <TableToolbar.ItemGroup position="start">
                <TableToolbar.Item>
                  <Text size="small">Filter by:</Text>
                </TableToolbar.Item>
                <TableToolbar.Item>
                  <Dropdown
                    placeholder="All transactions"
                    selectedId={filterValue}
                    onSelect={handleFilterChange}
                    options={TRANSACTION_STATUS_OPTIONS}
                  />
                </TableToolbar.Item>
              </TableToolbar.ItemGroup>
              <TableToolbar.ItemGroup position="end">
                <TableToolbar.Item>
                  <Search
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Search transactions..."
                  />
                </TableToolbar.Item>
              </TableToolbar.ItemGroup>
            </TableToolbar>

            {loading ? (
              <Box align="center" padding="48px">
                <Loader size="large" />
                <Text>Loading transactions...</Text>
              </Box>
            ) : (
              <Table
                data={filteredTransactions}
                columns={[
                  {
                    title: 'Transaction ID',
                    render: (row) => <Text>{row.id}</Text>,
                    width: '150px'
                  },
                  {
                    title: 'Customer',
                    render: (row) => (
                      <Box direction="vertical">
                        <Text size="small" weight="bold">{row.customerName || 'N/A'}</Text>
                        <Text size="tiny" secondary>{row.customerEmail || 'N/A'}</Text>
                      </Box>
                    ),
                    width: '200px'
                  },
                  {
                    title: 'Amount',
                    render: (row) => (
                      <Text weight="bold">
                        {transactionService.formatAmount(row.amount, row.currency)}
                      </Text>
                    ),
                    width: '120px'
                  },
                  {
                    title: 'Payment Method',
                    render: (row) => <Text>{row.paymentMethod}</Text>,
                    width: '130px'
                  },
                  {
                    title: 'Date',
                    render: (row) => <Text>{transactionService.formatDate(row.createdDate)}</Text>,
                    width: '120px'
                  },
                  {
                    title: 'Status',
                    render: (row) => getStatusBadge(row.status),
                    width: '120px'
                  },
                  {
                    title: 'Description',
                    render: (row) => (
                      <Text size="small" secondary>
                        {row.description || 'No description'}
                      </Text>
                    ),
                    width: '200px'
                  },
                  {
                    title: 'Actions',
                    render: (row) => (
                      <IconButton
                        skin="standard"
                        priority="secondary"
                        onClick={() => dashboard.showToast({
                          message: `View transaction ${row.id}`
                        })}
                      >
                        <Icons.More />
                      </IconButton>
                    ),
                    width: '80px'
                  }
                ]}
                showSelection
                virtualized={false}
              />
            )}
          </Card>
        </Page.Content>
      </Page>
    </WixDesignSystemProvider>
  );
};

export default TransactionsDashboard;