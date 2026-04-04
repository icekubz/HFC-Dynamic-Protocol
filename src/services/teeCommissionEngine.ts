import { supabase } from '../utils/supabase';
import { teeBinaryTreeService } from './teeBinaryTreeService';
import { teeTokenomicsService } from './teeTokenomicsService';

export interface CommissionCalculation {
  affiliateId: string;
  selfCommission: number;
  directCommission: number;
  passiveCommission: number;
  totalCommission: number;
}

export interface BatchResult {
  success: boolean;
  batchId: string;
  totalCV: number;
  totalCommissionsPaid: number;
  platformEarning: number;
  burnFundAllocated: number;
  platformNetProfit: number;
  commissionsCalculated: CommissionCalculation[];
  error?: string;
}

const CUSTOM_DIVISOR = 5;

export class TEECommissionEngine {
  /**
   * Calculate Self Commission: 10% of personal CV
   */
  calculateSelfCommission(personalCV: number): number {
    return personalCV * 0.10;
  }

  /**
   * Calculate Direct Commission: 15% of CV from direct referrals
   */
  async calculateDirectCommission(affiliateId: string, unprocessedOrders: any[]): Promise<number> {
    const directReferrals = await teeBinaryTreeService.getDirectReferrals(affiliateId);

    if (directReferrals.length === 0) return 0;

    const directReferralCV = unprocessedOrders
      .filter(order => directReferrals.includes(order.affiliate_id))
      .reduce((sum, order) => sum + parseFloat(order.cv), 0);

    return directReferralCV * 0.15;
  }

  /**
   * Calculate Passive Commission: 50% of downline CV, divided by max(Custom_Divisor, Actual_Depth)
   *
   * Rules:
   * 1. Scan downline using BFS up to node_cap limit
   * 2. Sum total CV from scanned nodes
   * 3. Find maximum depth of active downline
   * 4. Divisor = max(CUSTOM_DIVISOR, Actual_Depth)
   * 5. Payout = (Scanned_Volume * 50%) / Divisor
   */
  async calculatePassiveCommission(
    affiliateId: string,
    unprocessedOrders: any[]
  ): Promise<number> {
    const downlineNodes = await teeBinaryTreeService.getDownlineNodes(affiliateId);

    if (downlineNodes.length === 0) return 0;

    const downlineAffiliateIds = downlineNodes.map(node => node.affiliate_id);

    const downlineCV = unprocessedOrders
      .filter(order => downlineAffiliateIds.includes(order.affiliate_id))
      .reduce((sum, order) => sum + parseFloat(order.cv), 0);

    if (downlineCV === 0) return 0;

    const actualDepth = await teeBinaryTreeService.getMaxDepth(affiliateId);

    const divisor = Math.max(CUSTOM_DIVISOR, actualDepth);

    const passiveCommission = (downlineCV * 0.50) / divisor;

    return passiveCommission;
  }

  /**
   * Process monthly batch commission calculations
   *
   * Total Allocation:
   * - 75% to affiliates (10% self + 15% direct + 50% passive)
   * - 25% to platform (12.5% burn fund + 12.5% net profit)
   */
  async runBatchCalculation(): Promise<BatchResult> {
    const batchId = `batch_${Date.now()}`;

    try {
      const { data: unprocessedOrders, error: ordersError } = await supabase
        .from('tee_orders')
        .select('*')
        .eq('processed', false);

      if (ordersError) throw ordersError;

      if (!unprocessedOrders || unprocessedOrders.length === 0) {
        return {
          success: false,
          batchId,
          totalCV: 0,
          totalCommissionsPaid: 0,
          platformEarning: 0,
          burnFundAllocated: 0,
          platformNetProfit: 0,
          commissionsCalculated: [],
          error: 'No unprocessed orders found'
        };
      }

      const totalCV = unprocessedOrders.reduce((sum, order) => sum + parseFloat(order.cv), 0);

      const { data: allAffiliates } = await supabase
        .from('tee_affiliates')
        .select('id')
        .eq('status', 'active');

      if (!allAffiliates) {
        throw new Error('No active affiliates found');
      }

      const commissionsCalculated: CommissionCalculation[] = [];
      const commissionRecords: any[] = [];

      for (const affiliate of allAffiliates) {
        const affiliateId = affiliate.id;

        const personalOrders = unprocessedOrders.filter(
          order => order.affiliate_id === affiliateId
        );
        const personalCV = personalOrders.reduce((sum, order) => sum + parseFloat(order.cv), 0);

        const selfCommission = this.calculateSelfCommission(personalCV);

        const directCommission = await this.calculateDirectCommission(affiliateId, unprocessedOrders);

        const passiveCommission = await this.calculatePassiveCommission(affiliateId, unprocessedOrders);

        const totalCommission = selfCommission + directCommission + passiveCommission;

        if (totalCommission > 0) {
          commissionsCalculated.push({
            affiliateId,
            selfCommission,
            directCommission,
            passiveCommission,
            totalCommission
          });

          if (selfCommission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'self',
              amount: selfCommission,
              cv_used: personalCV,
              batch_id: batchId,
              status: 'paid'
            });
          }

          if (directCommission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'direct',
              amount: directCommission,
              cv_used: 0,
              batch_id: batchId,
              status: 'paid'
            });
          }

          if (passiveCommission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'passive',
              amount: passiveCommission,
              cv_used: 0,
              batch_id: batchId,
              status: 'paid'
            });
          }

          await supabase
            .from('tee_wallets')
            .upsert({
              affiliate_id: affiliateId,
              balance_self: selfCommission,
              balance_direct: directCommission,
              balance_passive: passiveCommission,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'affiliate_id',
              ignoreDuplicates: false
            });

          const { data: currentWallet } = await supabase
            .from('tee_wallets')
            .select('balance_self, balance_direct, balance_passive, total_earned')
            .eq('affiliate_id', affiliateId)
            .maybeSingle();

          if (currentWallet) {
            await supabase
              .from('tee_wallets')
              .update({
                balance_self: (parseFloat(currentWallet.balance_self) || 0) + selfCommission,
                balance_direct: (parseFloat(currentWallet.balance_direct) || 0) + directCommission,
                balance_passive: (parseFloat(currentWallet.balance_passive) || 0) + passiveCommission,
                total_earned: (parseFloat(currentWallet.total_earned) || 0) + totalCommission,
                updated_at: new Date().toISOString()
              })
              .eq('affiliate_id', affiliateId);
          }

          await teeTokenomicsService.mintTokensForCV(affiliateId, personalCV);
        }
      }

      if (commissionRecords.length > 0) {
        await supabase.from('tee_commissions').insert(commissionRecords);
      }

      await supabase
        .from('tee_orders')
        .update({ processed: true })
        .eq('processed', false);

      const totalCommissionsPaid = commissionsCalculated.reduce(
        (sum, calc) => sum + calc.totalCommission,
        0
      );

      const platformEarning = totalCV * 0.25;
      const burnFundAllocated = platformEarning * 0.50;
      const platformNetProfit = platformEarning * 0.50;

      const period = new Date().toISOString().slice(0, 7);

      await supabase.from('tee_platform_ledger').insert({
        period,
        total_cv_ingested: totalCV,
        total_commissions_paid: totalCommissionsPaid,
        platform_earning: platformEarning,
        burn_fund_allocated: burnFundAllocated,
        platform_net_profit: platformNetProfit
      });

      await teeTokenomicsService.addToBurnFund(burnFundAllocated);

      return {
        success: true,
        batchId,
        totalCV,
        totalCommissionsPaid,
        platformEarning,
        burnFundAllocated,
        platformNetProfit,
        commissionsCalculated
      };
    } catch (error) {
      console.error('Batch calculation error:', error);
      return {
        success: false,
        batchId,
        totalCV: 0,
        totalCommissionsPaid: 0,
        platformEarning: 0,
        burnFundAllocated: 0,
        platformNetProfit: 0,
        commissionsCalculated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const teeCommissionEngine = new TEECommissionEngine();
