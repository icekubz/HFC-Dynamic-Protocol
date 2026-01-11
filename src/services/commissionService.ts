import { supabase } from '../utils/supabase';

export interface CommissionConfig {
  platformCommissionPercentage: number;
  referrerCommissionPercentage: number;
  hfcPoolPercentage: number;
}

const DEFAULT_CONFIG: CommissionConfig = {
  platformCommissionPercentage: 10,
  referrerCommissionPercentage: 5,
  hfcPoolPercentage: 5,
};

export async function calculateAndCreateCommissions(
  orderId: string,
  items: any[],
  referrerId?: string
): Promise<void> {
  try {
    for (const item of items) {
      const totalSale = item.subtotal;
      const platformCommission = (totalSale * DEFAULT_CONFIG.platformCommissionPercentage) / 100;
      const vendorEarnings = totalSale - platformCommission;

      let referrerCommission = 0;
      let hfcPoolAmount = 0;

      if (referrerId) {
        referrerCommission = (totalSale * DEFAULT_CONFIG.referrerCommissionPercentage) / 100;
        hfcPoolAmount = (totalSale * DEFAULT_CONFIG.hfcPoolPercentage) / 100;

        await supabase.from('commissions').insert({
          user_id: referrerId,
          order_item_id: item.id,
          commission_type: 'affiliate_referral',
          amount: referrerCommission,
          percentage: DEFAULT_CONFIG.referrerCommissionPercentage,
          status: 'earned',
        });

        const { data: activeAffiliates } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'affiliate')
          .eq('status', 'active')
          .neq('user_id', referrerId);

        if (activeAffiliates && activeAffiliates.length > 0) {
          const perAffiliateShare = hfcPoolAmount / activeAffiliates.length;

          for (const affiliate of activeAffiliates) {
            await supabase.from('commissions').insert({
              user_id: affiliate.user_id,
              order_item_id: item.id,
              commission_type: 'passive_pool',
              amount: perAffiliateShare,
              percentage: (perAffiliateShare / totalSale) * 100,
              status: 'earned',
            });
          }
        }
      }

      const companyProfit = platformCommission - referrerCommission - hfcPoolAmount;

      console.log('Commission Breakdown:', {
        totalSale,
        vendorEarnings,
        platformCommission,
        referrerCommission,
        hfcPoolAmount,
        companyProfit,
      });
    }
  } catch (err) {
    console.error('Error calculating commissions:', err);
    throw err;
  }
}

export async function createPayout(userId: string, amount: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('payouts')
      .insert({
        user_id: userId,
        amount,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    await supabase
      .from('commissions')
      .update({ status: 'pending_payout' })
      .eq('user_id', userId)
      .eq('status', 'earned');

    return data?.id || null;
  } catch (err) {
    console.error('Error creating payout:', err);
    throw err;
  }
}

export async function getTotalEarnings(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('commissions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'earned');

    if (error) throw error;

    return (data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
  } catch (err) {
    console.error('Error fetching earnings:', err);
    return 0;
  }
}

export async function calculateCompanyProfit(startDate?: Date, endDate?: Date): Promise<{
  totalSales: number;
  totalCommissionsPaid: number;
  companyProfit: number;
}> {
  try {
    let query = supabase
      .from('orders')
      .select('total_amount')
      .eq('payment_status', 'paid');

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data: orders } = await query;
    const totalSales = (orders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

    let commQuery = supabase
      .from('commissions')
      .select('amount')
      .in('status', ['earned', 'pending_payout', 'paid']);

    if (startDate) {
      commQuery = commQuery.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      commQuery = commQuery.lte('created_at', endDate.toISOString());
    }

    const { data: commissions } = await commQuery;
    const totalCommissionsPaid = (commissions || []).reduce((sum, c) => sum + (c.amount || 0), 0);

    const companyProfit = (totalSales * DEFAULT_CONFIG.platformCommissionPercentage / 100) - totalCommissionsPaid;

    return {
      totalSales,
      totalCommissionsPaid,
      companyProfit,
    };
  } catch (err) {
    console.error('Error calculating company profit:', err);
    return {
      totalSales: 0,
      totalCommissionsPaid: 0,
      companyProfit: 0,
    };
  }
}
