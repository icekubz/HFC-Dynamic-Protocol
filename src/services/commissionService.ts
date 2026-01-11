import { supabase } from '../utils/supabase';
import { getUplineChain, getUserPackage, updateSalesVolume, calculateMatchingBonus } from './binaryTreeService';

export interface CommissionConfig {
  platformCommissionPercentage: number;
  vendorCommissionPercentage: number;
}

const DEFAULT_CONFIG: CommissionConfig = {
  platformCommissionPercentage: 10,
  vendorCommissionPercentage: 90,
};

export async function calculateAndCreateCommissions(
  orderId: string,
  items: any[],
  buyerId: string,
  referrerId?: string
): Promise<void> {
  try {
    for (const item of items) {
      const totalSale = item.subtotal;
      const platformCommission = (totalSale * DEFAULT_CONFIG.platformCommissionPercentage) / 100;
      const vendorEarnings = totalSale - platformCommission;

      await supabase.from('commission_transactions').insert({
        affiliate_id: item.vendor_id,
        order_id: orderId,
        commission_type: 'vendor',
        amount: vendorEarnings,
        level: 0,
        from_user_id: null,
        status: 'pending',
      });

      const { data: buyerPosition } = await supabase
        .from('binary_tree_positions')
        .select('sponsor_id')
        .eq('user_id', buyerId)
        .maybeSingle();

      const actualReferrerId = referrerId || buyerPosition?.sponsor_id;

      if (actualReferrerId) {
        await updateSalesVolume(actualReferrerId, totalSale);

        const { data: referrerPackage } = await supabase
          .from('affiliate_subscriptions')
          .select(`
            user_id,
            affiliate_packages (
              direct_commission_rate,
              level_2_commission_rate,
              level_3_commission_rate,
              max_tree_depth
            )
          `)
          .eq('user_id', actualReferrerId)
          .eq('status', 'active')
          .maybeSingle();

        if (referrerPackage) {
          const directRate = referrerPackage.affiliate_packages.direct_commission_rate;
          const directCommission = (totalSale * directRate) / 100;

          await supabase.from('commission_transactions').insert({
            affiliate_id: actualReferrerId,
            order_id: orderId,
            commission_type: 'direct',
            amount: directCommission,
            level: 1,
            from_user_id: buyerId,
            status: 'pending',
          });

          const uplineChain = await getUplineChain(actualReferrerId, 10);
          const maxDepth = referrerPackage.affiliate_packages.max_tree_depth;

          for (let i = 0; i < Math.min(uplineChain.length, maxDepth - 1); i++) {
            const uplineMember = uplineChain[i];
            const uplinePkg = await getUserPackage(uplineMember.user_id);

            if (!uplinePkg) continue;

            let commissionRate = 0;
            let commissionType: 'direct' | 'level_2' | 'level_3' = 'level_2';

            if (i === 0) {
              commissionRate = uplinePkg.level_2_commission_rate;
              commissionType = 'level_2';
            } else {
              commissionRate = uplinePkg.level_3_commission_rate;
              commissionType = 'level_3';
            }

            const commissionAmount = (totalSale * commissionRate) / 100;

            if (commissionAmount > 0) {
              await supabase.from('commission_transactions').insert({
                affiliate_id: uplineMember.user_id,
                order_id: orderId,
                commission_type: commissionType,
                amount: commissionAmount,
                level: i + 2,
                from_user_id: buyerId,
                status: 'pending',
              });
            }
          }
        }

        const matchingBonus = await calculateMatchingBonus(actualReferrerId);
        if (matchingBonus > 0) {
          await supabase.from('commission_transactions').insert({
            affiliate_id: actualReferrerId,
            order_id: orderId,
            commission_type: 'matching_bonus',
            amount: matchingBonus,
            level: 0,
            from_user_id: null,
            status: 'pending',
          });
        }
      }

      console.log('Commission Breakdown:', {
        totalSale,
        vendorEarnings,
        platformCommission,
        directCommission: 'Calculated for direct referrer',
        levelCommissions: 'Calculated for upline chain',
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
