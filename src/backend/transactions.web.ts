import { orders, orderTransactions } from '@wix/ecom';

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

export async function GET(req: Request) {
  try {
    console.log('Getting real transactions from Wix Payments API...');

    let transactionData = [];
    let usingMockData = false;

    try {
      // Parse query parameters for filtering
      const url = new URL(req.url);
      const status = url.searchParams.get('status');
      const fromDate = url.searchParams.get('from');
      const toDate = url.searchParams.get('to');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      console.log('Fetching real transactions from Wix Payments API...');

      // Set up date filter
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const filterFromDate = fromDate ? new Date(fromDate) : thirtyDaysAgo;
      const filterToDate = toDate ? new Date(toDate) : new Date();

      // Build filter for orders
      const orderFilter: any = {
        "_createdDate": {
          "$gte": filterFromDate
        }
      };

      if (toDate) {
        orderFilter._createdDate["$lte"] = filterToDate;
      }

      // First, get orders from Wix eCommerce
      const ordersResult = await orders.searchOrders({
        filter: orderFilter,
        sort: [{ "fieldName": "_createdDate", "order": "DESC" }],
        cursorPaging: { "limit": limit || 100 }
      });

      if (ordersResult.orders && ordersResult.orders.length > 0) {
        // Get order IDs (filter out any null/undefined values)
        const orderIds = ordersResult.orders
          .map(order => order._id)
          .filter((id): id is string => id !== null && id !== undefined);

        // Get transactions for all orders
        const transactionsResult = await orderTransactions.listTransactionsForMultipleOrders(orderIds);

        // Transform the transactions into our format
        transactionData = [];
        if (transactionsResult.orderTransactions) {
          for (const orderTx of transactionsResult.orderTransactions) {
            const order = ordersResult.orders.find(o => o._id === orderTx.orderId);

            // Process payments
            if (orderTx.payments) {
              for (const payment of orderTx.payments) {
                const txData = transformPaymentToTransaction(payment, order);
                // Apply status filter if provided
                if (!status || status === 'all' || txData.status.toLowerCase() === status.toLowerCase()) {
                  transactionData.push(txData);
                }
              }
            }

            // Process refunds as separate transactions
            if (orderTx.refunds) {
              for (const refund of orderTx.refunds) {
                const txData = transformRefundToTransaction(refund, order);
                // Apply status filter if provided
                if (!status || status === 'all' || txData.status.toLowerCase() === status.toLowerCase()) {
                  transactionData.push(txData);
                }
              }
            }
          }
        }

        console.log(`Fetched ${transactionData.length} real transactions from Wix eCommerce`);
        usingMockData = false;
      } else {
        console.log('No orders found from Wix eCommerce, using mock data');
        throw new Error('No orders found');
      }

    } catch (wixError) {
      console.warn('Wix Payments API Error:', wixError);
      console.warn('Using mock data for demo.');

      transactionData = getMockTransactions();
      usingMockData = true;
    }

    const metrics = calculateTransactionMetrics(transactionData);

    return new Response(JSON.stringify({
      success: true,
      data: transactionData,
      metrics,
      usingMockData
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('Error in GET transactions:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch transactions'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}

export async function POST(req: Request) {
  try {
    console.log('Refreshing transactions from Wix Payments API...');


    let transactionData = [];
    let usingMockData = false;

    try {
      console.log('Refreshing real transactions from Wix Payments API...');

      // Get recent transactions (last 7 days for refresh)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const queryParams = {
        from: sevenDaysAgo.toISOString(),
        limit: 100,
        includeRefunds: true,
        ignoreTotals: false,
        order: 'date:desc'
      };

      // First, get recent orders from Wix eCommerce
      const ordersResult = await orders.searchOrders({
        filter: {
          "_createdDate": {
            "$gte": sevenDaysAgo
          }
        },
        sort: [{ "fieldName": "_createdDate", "order": "DESC" }],
        cursorPaging: { "limit": 100 }
      });

      if (ordersResult.orders && ordersResult.orders.length > 0) {
        // Get order IDs (filter out any null/undefined values)
        const orderIds = ordersResult.orders
          .map(order => order._id)
          .filter((id): id is string => id !== null && id !== undefined);

        // Get transactions for all orders
        const transactionsResult = await orderTransactions.listTransactionsForMultipleOrders(orderIds);

        // Transform the transactions into our format
        transactionData = [];
        if (transactionsResult.orderTransactions) {
          for (const orderTx of transactionsResult.orderTransactions) {
            const order = ordersResult.orders.find(o => o._id === orderTx.orderId);

            // Process payments
            if (orderTx.payments) {
              for (const payment of orderTx.payments) {
                transactionData.push(transformPaymentToTransaction(payment, order));
              }
            }

            // Process refunds as separate transactions
            if (orderTx.refunds) {
              for (const refund of orderTx.refunds) {
                transactionData.push(transformRefundToTransaction(refund, order));
              }
            }
          }
        }

        console.log(`Refreshed ${transactionData.length} real transactions from Wix eCommerce`);
        usingMockData = false;
      } else {
        console.log('No recent transactions found from Wix eCommerce, using mock data');
        throw new Error('No recent transactions found');
      }

    } catch (wixError) {
      console.warn('Wix Payments API Refresh Error:', wixError);
      console.warn('Using mock data for demo.');

      transactionData = getMockTransactions();
      usingMockData = true;
    }

    const metrics = calculateTransactionMetrics(transactionData);

    return new Response(JSON.stringify({
      success: true,
      data: transactionData,
      metrics,
      usingMockData,
      message: usingMockData ? 'Transactions refreshed (mock data)' : 'Transactions refreshed from Wix Orders'
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error refreshing transactions:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to refresh transactions'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Helper function to transform Wix Payments transaction to our local format
function transformWixTransactionToLocal(wixTransaction: any) {
  const amount = parseFloat(wixTransaction.amount?.amount || '0');
  const currency = wixTransaction.amount?.currency || 'USD';

  return {
    id: wixTransaction.transactionId || wixTransaction.id || `TXN-${Date.now()}`,
    amount: amount,
    currency: currency,
    status: mapWixTransactionStatus(wixTransaction.status),
    paymentMethod: wixTransaction.paymentMethod || 'Unknown',
    customerName: getCustomerNameFromTransaction(wixTransaction),
    customerEmail: getCustomerEmailFromTransaction(wixTransaction),
    createdDate: wixTransaction.createdAt || new Date().toISOString(),
    description: wixTransaction.order?.orderNumber ?
      `Order #${wixTransaction.order.orderNumber} payment` :
      `Transaction ${wixTransaction.transactionId || wixTransaction.id}`,
    provider: wixTransaction.provider || wixTransaction.providerName,
    providerTransactionId: wixTransaction.providerTransactionId,
    type: wixTransaction.type
  };
}

// Helper function to map Wix Payments transaction status to our local status
function mapWixTransactionStatus(status: string) {
  if (!status) return 'PENDING';

  const statusUpper = status.toUpperCase();
  switch (statusUpper) {
    case 'SUCCEEDED':
    case 'APPROVED':
      return 'APPROVED';
    case 'PENDING':
    case 'PROCESSING':
      return 'PENDING';
    case 'FAILED':
    case 'DECLINED':
    case 'CANCELED':
      return 'DECLINED';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'REFUNDED';
    default:
      return 'PENDING';
  }
}

// Helper function to get customer name from transaction
function getCustomerNameFromTransaction(wixTransaction: any) {
  // Try to get from order if available
  if (wixTransaction.order?.billingInfo?.contactDetails) {
    const contact = wixTransaction.order.billingInfo.contactDetails;
    if (contact.firstName && contact.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    }
  }

  // Try to get from buyer info
  if (wixTransaction.order?.buyerInfo?.firstName && wixTransaction.order?.buyerInfo?.lastName) {
    return `${wixTransaction.order.buyerInfo.firstName} ${wixTransaction.order.buyerInfo.lastName}`;
  }

  return 'Customer';
}

// Helper function to get customer email from transaction
function getCustomerEmailFromTransaction(wixTransaction: any) {
  // Try to get from order if available
  if (wixTransaction.order?.buyerInfo?.email) {
    return wixTransaction.order.buyerInfo.email;
  }

  // Try to get from billing info
  if (wixTransaction.order?.billingInfo?.contactDetails?.email) {
    return wixTransaction.order.billingInfo.contactDetails.email;
  }

  return 'customer@example.com';
}

// Helper function to calculate transaction metrics
function calculateTransactionMetrics(transactions: any[]) {
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

// Helper function to transform payment to transaction format
function transformPaymentToTransaction(payment: any, order: any) {
  const amount = parseFloat(payment.amount?.amount || '0');
  const currency = payment.amount?.currency || order?.currency || 'EUR';

  // Determine payment status
  let status = 'PENDING';
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
    customerName: getCustomerNameFromOrder(order),
    customerEmail: order?.buyerInfo?.email || 'customer@example.com',
    createdDate: payment._createdDate || new Date().toISOString(),
    description: `Order #${order?.number || order?._id} payment`,
    provider: payment.regularPaymentDetails?.paymentMethod,
    providerTransactionId: payment.regularPaymentDetails?.providerTransactionId,
    type: 'PAYMENT'
  };
}

// Helper function to transform refund to transaction format
function transformRefundToTransaction(refund: any, order: any) {
  const amount = parseFloat(refund.summary?.refunded?.amount || '0');
  const currency = refund.summary?.refunded?.currency || order?.currency || 'EUR';

  return {
    id: refund._id || `REF-${Date.now()}`,
    amount: amount,
    currency: currency,
    status: 'REFUNDED',
    paymentMethod: 'Refund',
    customerName: getCustomerNameFromOrder(order),
    customerEmail: order?.buyerInfo?.email || 'customer@example.com',
    createdDate: refund._createdDate || new Date().toISOString(),
    description: `Order #${order?.number || order?._id} refund`,
    provider: 'Refund',
    providerTransactionId: refund.transactions?.[0]?.providerRefundId,
    type: 'REFUND'
  };
}

// Helper function to get customer name from order
function getCustomerNameFromOrder(order: any) {
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

// Mock transactions for development/testing
function getMockTransactions() {
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