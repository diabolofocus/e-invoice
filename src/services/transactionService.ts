// services/transactionService.ts

export interface Transaction {
    id: string;
    amount: number;
    currency: string;
    status: 'APPROVED' | 'PENDING' | 'DECLINED' | 'REFUNDED' | 'CANCELLED';
    paymentMethod: string;
    customerName?: string;
    customerEmail?: string;
    createdDate: string;
    description?: string;
    provider?: string;
    providerTransactionId?: string;
    type?: string;
}

export interface TransactionFilters {
    status?: string;
    dateRange?: number; // days
    searchQuery?: string;
    limit?: number;
    offset?: number;
}

export interface TransactionMetrics {
    totalApproved: number;
    totalPending: number;
    totalDeclined: number;
    totalRefunded: number;
    totalTransactions: number;
    totalRevenue: number;
}



export class TransactionService {

    /**
     * Fetch transactions from backend API (which calls Wix Cashier API)
     */
    async fetchTransactions(filters?: TransactionFilters): Promise<{ data: Transaction[], usingMockData: boolean }> {
        try {
            console.log('Fetching transactions using direct Wix SDK integration...');
            
            // Try direct Wix SDK integration first
            try {
                // Import Wix SDK modules dynamically
                const { orders } = await import('@wix/ecom');
                const { orderTransactions } = await import('@wix/ecom');
                
                console.log('Wix SDK modules loaded successfully');
                
                // First try without date filter to test basic connectivity
                console.log('Fetching all recent orders without date filter...');

                // Get recent orders from Wix eCommerce (simplest query first)
                let ordersResult;
                try {
                    // Try with minimal parameters first
                    ordersResult = await orders.searchOrders({
                        cursorPaging: { "limit": 10 }
                    });
                    console.log('Basic orders query succeeded');
                } catch (basicError) {
                    console.warn('Basic orders query failed:', basicError);
                    // Just throw the error to fall back to mock data
                    throw basicError;
                }

                console.log(`Found ${ordersResult.orders?.length || 0} orders`);

                let transactionData: Transaction[] = [];

                if (ordersResult.orders && ordersResult.orders.length > 0) {
                    // Get order IDs (filter out any null/undefined values)
                    const orderIds = ordersResult.orders
                        .map(order => order._id)
                        .filter((id): id is string => id !== null && id !== undefined);

                    console.log(`Getting transactions for ${orderIds.length} orders`);

                    // Get transactions for all orders
                    const transactionsResult = await orderTransactions.listTransactionsForMultipleOrders(orderIds);

                    console.log('Transactions result:', transactionsResult);

                    // Transform the transactions into our format
                    if (transactionsResult.orderTransactions) {
                        for (const orderTx of transactionsResult.orderTransactions) {
                            const order = ordersResult.orders.find(o => o._id === orderTx.orderId);

                            // Process payments
                            if (orderTx.payments) {
                                for (const payment of orderTx.payments) {
                                    const txData = this.transformPaymentToTransaction(payment, order);
                                    // Apply status filter if provided
                                    if (!filters?.status || filters.status === 'all' || txData.status.toLowerCase() === filters.status.toLowerCase()) {
                                        transactionData.push(txData);
                                    }
                                }
                            }

                            // Process refunds as separate transactions
                            if (orderTx.refunds) {
                                for (const refund of orderTx.refunds) {
                                    const txData = this.transformRefundToTransaction(refund, order);
                                    // Apply status filter if provided
                                    if (!filters?.status || filters.status === 'all' || txData.status.toLowerCase() === filters.status.toLowerCase()) {
                                        transactionData.push(txData);
                                    }
                                }
                            }
                        }
                    }

                    console.log(`Processed ${transactionData.length} transactions from Wix SDK`);

                    return {
                        data: transactionData,
                        usingMockData: false
                    };
                } else {
                    console.log('No orders found from Wix SDK, using mock data');
                    throw new Error('No orders found');
                }

            } catch (sdkError) {
                console.warn('Direct Wix SDK Error:', sdkError);
                throw sdkError; // Let it fall through to mock data
            }

        } catch (error) {
            console.error('Error fetching transactions:', error);
            console.log('Using mock data for development');
            // Return mock data for development
            return {
                data: this.getMockTransactions(),
                usingMockData: true
            };
        }
    }

    /**
     * Refresh transactions data
     */
    async refreshTransactions(): Promise<{ data: Transaction[], usingMockData: boolean }> {
        try {
            // Use the same method as fetchTransactions but with recent data filter
            return await this.fetchTransactions({ dateRange: 7 });

        } catch (error) {
            console.error('Error refreshing transactions:', error);
            return {
                data: this.getMockTransactions(),
                usingMockData: true
            };
        }
    }

    /**
     * Calculate transaction metrics
     */
    calculateMetrics(transactions: Transaction[]): TransactionMetrics {
        const metrics = {
            totalApproved: 0,
            totalPending: 0,
            totalDeclined: 0,
            totalRefunded: 0,
            totalTransactions: transactions.length,
            totalRevenue: 0
        };

        transactions.forEach(transaction => {
            const amount = transaction.amount;

            switch (transaction.status) {
                case 'APPROVED':
                    metrics.totalApproved += amount;
                    metrics.totalRevenue += amount;
                    break;
                case 'PENDING':
                    metrics.totalPending += amount;
                    break;
                case 'DECLINED':
                    metrics.totalDeclined += amount;
                    break;
                case 'REFUNDED':
                    metrics.totalRefunded += amount;
                    metrics.totalRevenue -= amount; // Subtract refunds from revenue
                    break;
            }
        });

        return metrics;
    }

    /**
     * Apply local filters to transaction data
     */
    applyFilters(transactions: Transaction[], filters?: TransactionFilters): Transaction[] {
        if (!filters) return transactions;

        let filtered = [...transactions];

        // Filter by status
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(transaction =>
                transaction.status.toLowerCase() === filters.status?.toLowerCase()
            );
        }

        // Filter by search query
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter(transaction =>
                transaction.customerName?.toLowerCase().includes(query) ||
                transaction.customerEmail?.toLowerCase().includes(query) ||
                transaction.id.toLowerCase().includes(query) ||
                transaction.description?.toLowerCase().includes(query)
            );
        }

        // Filter by date range
        if (filters.dateRange) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - filters.dateRange);

            filtered = filtered.filter(transaction => {
                const transactionDate = new Date(transaction.createdDate);
                return transactionDate >= cutoffDate;
            });
        }

        return filtered;
    }


    /**
     * Mock transactions for development/testing
     */
    private getMockTransactions(): Transaction[] {
        return [
            {
                id: 'TXN-001',
                amount: 250.00,
                currency: 'EUR',
                status: 'APPROVED',
                paymentMethod: 'Credit Card',
                customerName: 'John Doe',
                customerEmail: 'john.doe@example.com',
                createdDate: '2025-01-15T10:30:00Z',
                description: 'Invoice #INV-001 payment'
            },
            {
                id: 'TXN-002',
                amount: 180.50,
                currency: 'EUR',
                status: 'APPROVED',
                paymentMethod: 'PayPal',
                customerName: 'Jane Smith',
                customerEmail: 'jane.smith@example.com',
                createdDate: '2025-01-14T14:22:00Z',
                description: 'Invoice #INV-002 payment'
            },
            {
                id: 'TXN-003',
                amount: 320.75,
                currency: 'EUR',
                status: 'PENDING',
                paymentMethod: 'Bank Transfer',
                customerName: 'Mike Johnson',
                customerEmail: 'mike.johnson@example.com',
                createdDate: '2025-01-13T09:45:00Z',
                description: 'Invoice #INV-003 payment'
            },
            {
                id: 'TXN-004',
                amount: 95.00,
                currency: 'EUR',
                status: 'DECLINED',
                paymentMethod: 'Credit Card',
                customerName: 'Sarah Wilson',
                customerEmail: 'sarah.wilson@example.com',
                createdDate: '2025-01-12T16:10:00Z',
                description: 'Invoice #INV-004 payment'
            },
            {
                id: 'TXN-005',
                amount: 450.25,
                currency: 'EUR',
                status: 'REFUNDED',
                paymentMethod: 'Credit Card',
                customerName: 'David Brown',
                customerEmail: 'david.brown@example.com',
                createdDate: '2025-01-11T11:30:00Z',
                description: 'Invoice #INV-005 payment refund'
            }
        ];
    }

    /**
     * Format amount for display
     */
    formatAmount(amount: number, currency: string = 'EUR'): string {
        return new Intl.NumberFormat('en-EU', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-EU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    /**
     * Transform Wix payment to transaction format
     */
    private transformPaymentToTransaction(payment: any, order: any): Transaction {
        const amount = parseFloat(payment.amount?.amount || '0');
        const currency = payment.amount?.currency || order?.currency || 'EUR';

        // Determine payment status
        let status: Transaction['status'] = 'PENDING';
        if (payment.regularPaymentDetails?.status) {
            const paymentStatus = payment.regularPaymentDetails.status;
            if (paymentStatus === 'APPROVED' || paymentStatus === 'AUTHORIZED') {
                status = 'APPROVED';
            } else if (paymentStatus === 'DECLINED' || paymentStatus === 'CANCELED') {
                status = 'DECLINED';
            } else if (paymentStatus === 'REFUNDED' || paymentStatus === 'PARTIALLY_REFUNDED') {
                status = 'REFUNDED';
            } else if (paymentStatus === 'PENDING' || paymentStatus === 'PENDING_MERCHANT') {
                status = 'PENDING';
            }
        }

        return {
            id: payment._id || `TXN-${Date.now()}`,
            amount: amount,
            currency: currency,
            status: status,
            paymentMethod: payment.regularPaymentDetails?.paymentMethod || 'Unknown',
            customerName: this.getCustomerNameFromOrder(order),
            customerEmail: order?.buyerInfo?.email || 'customer@example.com',
            createdDate: payment._createdDate || new Date().toISOString(),
            description: `Order #${order?.number || order?._id} payment`,
            provider: payment.regularPaymentDetails?.paymentMethod,
            providerTransactionId: payment.regularPaymentDetails?.providerTransactionId,
            type: 'PAYMENT'
        };
    }

    /**
     * Transform Wix refund to transaction format
     */
    private transformRefundToTransaction(refund: any, order: any): Transaction {
        const amount = parseFloat(refund.summary?.refunded?.amount || '0');
        const currency = refund.summary?.refunded?.currency || order?.currency || 'EUR';

        return {
            id: refund._id || `REF-${Date.now()}`,
            amount: amount,
            currency: currency,
            status: 'REFUNDED',
            paymentMethod: 'Refund',
            customerName: this.getCustomerNameFromOrder(order),
            customerEmail: order?.buyerInfo?.email || 'customer@example.com',
            createdDate: refund._createdDate || new Date().toISOString(),
            description: `Order #${order?.number || order?._id} refund`,
            provider: 'Refund',
            providerTransactionId: refund.transactions?.[0]?.providerRefundId,
            type: 'REFUND'
        };
    }

    /**
     * Get customer name from Wix order
     */
    private getCustomerNameFromOrder(order: any): string {
        if (order?.billingInfo?.contactDetails) {
            const contact = order.billingInfo.contactDetails;
            if (contact.firstName && contact.lastName) {
                return `${contact.firstName} ${contact.lastName}`;
            }
        }

        if (order?.buyerInfo?.firstName && order?.buyerInfo?.lastName) {
            return `${order.buyerInfo.firstName} ${order.buyerInfo.lastName}`;
        }

        return 'Customer';
    }
}

// Export singleton instance
export const transactionService = new TransactionService();