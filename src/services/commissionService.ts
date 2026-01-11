import { supabase } from '../utils/supabase';

export interface CommissionConfig {
  vendorCommissionPercentage: number;
  affiliateCommissionPercentage: number;
  passivePoolPercentage: number;
}

const DEFAULT_CONFIG: CommissionConfig = {
  vendorCommissionPercentage: 10,
  affiliateCommissionPercentage: 5,
  passivePoolPercentage: 2,
};

export async function calculateAndCreateCommissions(
  orderId: string,
  items: any[],
  referrerId?: string
): Promise<void> {
  try {
    for (const item of items) {
      const vendorCommissionAmount = (item.subtotal * DEFAULT_CONFIG.vendorCommissionPercentage) / 100;

      await supabase.from('commissions').insert({
        user_id: item.vendor_id,
        order_item_id: item.id,
        commission_type: 'vendor_sale',
        amount: vendorCommissionAmount,
        percentage: DEFAULT_CONFIG.vendorCommissionPercentage,
        status: 'earned',
      });

      if (referrerId) {
        const affiliateCommissionAmount = (item.subtotal * DEFAULT_CONFIG.affiliateCommissionPercentage) / 100;

        await supabase.from('commissions').insert({
          user_id: referrerId,
          order_item_id: item.id,
          commission_type: 'affiliate_referral',
          amount: affiliateCommissionAmount,
          percentage: DEFAULT_CONFIG.affiliateCommissionPercentage,
          status: 'earned',
        });
      }

      const passivePoolAmount = (item.subtotal * DEFAULT_CONFIG.passivePoolPercentage) / 100;
      const { data: affiliates } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'affiliate')
        .eq('status', 'active');

      if (affiliates && affiliates.length > 0) {
        const perAffiliateCut = passivePoolAmount / affiliates.length;

        for (const affiliate of affiliates) {
          await supabase.from('commissions').insert({
            user_id: affiliate.user_id,
            order_item_id: item.id,
            commission_type: 'passive_pool',
            amount: perAffiliateCut,
            percentage: DEFAULT_CONFIG.passivePoolPercentage / affiliates.length,
            status: 'earned',
          });
        }
      }
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
