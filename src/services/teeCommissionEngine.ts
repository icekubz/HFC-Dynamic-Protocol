import { supabase } from '../utils/supabase';
import { teeBinaryTreeService } from './teeBinaryTreeService';
import { teeTokenomicsService } from './teeTokenomicsService';

export interface CommissionRates {
  selfRate: number;
  directRate: number;
  passiveRate: number;
  platformRate: number;
  passiveDivisor: number;
}

export interface CommissionCalculation {
  affiliateId: string;
  selfCommission: number;
  directCommission: number;
  passiveCommission: number;
  totalCommission: number;
  ratesApplied: CommissionRates;
  calculationBreakdown: {
    personalCV: number;
    directReferralCV: number;
    downlineCV: number;
    maxDepth: number;
    divisorUsed: number;
  };
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
  ratesUsed: CommissionRates;
  verificationHash: string;
  error?: string;
}

export class TEECommissionEngine {
  /**
   * Fetch active commission rates from database
   */
  private async getActiveCommissionRates(): Promise<CommissionRates> {
    const { data, error } = await supabase
      .from('tee_commission_rates')
      .select('*')
      .eq('is_active', true)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('No active commission rates found, using defaults');
      return {
        selfRate: 10.0,
        directRate: 15.0,
        passiveRate: 50.0,
        platformRate: 25.0,
        passiveDivisor: 5,
      };
    }

    return {
      selfRate: parseFloat(data.self_commission_rate),
      directRate: parseFloat(data.direct_commission_rate),
      passiveRate: parseFloat(data.passive_commission_rate),
      platformRate: parseFloat(data.platform_commission_rate),
      passiveDivisor: data.passive_divisor,
    };
  }

  /**
   * Calculate Self Commission: X% of personal CV
   */
  calculateSelfCommission(personalCV: number, selfRate: number): number {
    return personalCV * (selfRate / 100);
  }

  /**
   * Calculate Direct Commission: X% of CV from direct referrals
   */
  async calculateDirectCommission(
    affiliateId: string,
    unprocessedOrders: any[],
    directRate: number
  ): Promise<{ commission: number; cv: number }> {
    const directReferrals = await teeBinaryTreeService.getDirectReferrals(affiliateId);

    if (directReferrals.length === 0) return { commission: 0, cv: 0 };

    const directReferralCV = unprocessedOrders
      .filter(order => directReferrals.includes(order.affiliate_id))
      .reduce((sum, order) => sum + parseFloat(order.cv), 0);

    const commission = directReferralCV * (directRate / 100);
    return { commission, cv: directReferralCV };
  }

  /**
   * Calculate Passive Commission: X% of downline CV, divided by max(Divisor, Actual_Depth)
   */
  async calculatePassiveCommission(
    affiliateId: string,
    unprocessedOrders: any[],
    passiveRate: number,
    passiveDivisor: number
  ): Promise<{ commission: number; cv: number; depth: number; divisorUsed: number }> {
    const downlineNodes = await teeBinaryTreeService.getDownlineNodes(affiliateId);

    if (downlineNodes.length === 0) {
      return { commission: 0, cv: 0, depth: 0, divisorUsed: passiveDivisor };
    }

    const downlineAffiliateIds = downlineNodes.map(node => node.affiliate_id);

    const downlineCV = unprocessedOrders
      .filter(order => downlineAffiliateIds.includes(order.affiliate_id))
      .reduce((sum, order) => sum + parseFloat(order.cv), 0);

    if (downlineCV === 0) {
      return { commission: 0, cv: 0, depth: 0, divisorUsed: passiveDivisor };
    }

    const actualDepth = await teeBinaryTreeService.getMaxDepth(affiliateId);
    const divisorUsed = Math.max(passiveDivisor, actualDepth);
    const commission = (downlineCV * (passiveRate / 100)) / divisorUsed;

    return { commission, cv: downlineCV, depth: actualDepth, divisorUsed };
  }

  /**
   * Process monthly batch commission calculations with dynamic rates
   *
   * Total Allocation (dynamic):
   * - Affiliate share: self + direct + passive rates
   * - Platform share: platform rate (burn fund + net profit)
   */
  async runBatchCalculation(): Promise<BatchResult> {
    const batchId = `batch_${Date.now()}`;

    try {
      const rates = await this.getActiveCommissionRates();

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
          ratesUsed: rates,
          verificationHash: '',
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

        const selfCommission = this.calculateSelfCommission(personalCV, rates.selfRate);

        const directResult = await this.calculateDirectCommission(
          affiliateId,
          unprocessedOrders,
          rates.directRate
        );

        const passiveResult = await this.calculatePassiveCommission(
          affiliateId,
          unprocessedOrders,
          rates.passiveRate,
          rates.passiveDivisor
        );

        const totalCommission = selfCommission + directResult.commission + passiveResult.commission;

        if (totalCommission > 0) {
          const calculationBreakdown = {
            personalCV,
            directReferralCV: directResult.cv,
            downlineCV: passiveResult.cv,
            maxDepth: passiveResult.depth,
            divisorUsed: passiveResult.divisorUsed,
          };

          commissionsCalculated.push({
            affiliateId,
            selfCommission,
            directCommission: directResult.commission,
            passiveCommission: passiveResult.commission,
            totalCommission,
            ratesApplied: rates,
            calculationBreakdown
          });

          if (selfCommission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'self',
              amount: selfCommission,
              cv_used: personalCV,
              batch_id: batchId,
              status: 'paid',
              self_rate_applied: rates.selfRate,
              direct_rate_applied: rates.directRate,
              passive_rate_applied: rates.passiveRate,
              platform_rate_applied: rates.platformRate,
              calculation_details: calculationBreakdown
            });
          }

          if (directResult.commission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'direct',
              amount: directResult.commission,
              cv_used: directResult.cv,
              batch_id: batchId,
              status: 'paid',
              self_rate_applied: rates.selfRate,
              direct_rate_applied: rates.directRate,
              passive_rate_applied: rates.passiveRate,
              platform_rate_applied: rates.platformRate,
              calculation_details: calculationBreakdown
            });
          }

          if (passiveResult.commission > 0) {
            commissionRecords.push({
              affiliate_id: affiliateId,
              commission_type: 'passive',
              amount: passiveResult.commission,
              cv_used: passiveResult.cv,
              batch_id: batchId,
              status: 'paid',
              self_rate_applied: rates.selfRate,
              direct_rate_applied: rates.directRate,
              passive_rate_applied: rates.passiveRate,
              platform_rate_applied: rates.platformRate,
              calculation_details: calculationBreakdown
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

      const platformEarning = totalCV * (rates.platformRate / 100);
      const burnFundAllocated = platformEarning * 0.50;
      const platformNetProfit = platformEarning * 0.50;

      const verificationHash = this.generateVerificationHash({
        batchId,
        totalCV,
        totalCommissionsPaid,
        platformEarning,
        rates,
        commissionsCount: commissionsCalculated.length
      });

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
        commissionsCalculated,
        ratesUsed: rates,
        verificationHash
      };
    } catch (error) {
      console.error('Batch calculation error:', error);
      const rates = await this.getActiveCommissionRates();
      return {
        success: false,
        batchId,
        totalCV: 0,
        totalCommissionsPaid: 0,
        platformEarning: 0,
        burnFundAllocated: 0,
        platformNetProfit: 0,
        commissionsCalculated: [],
        ratesUsed: rates,
        verificationHash: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate verification hash for audit trail
   */
  private generateVerificationHash(data: {
    batchId: string;
    totalCV: number;
    totalCommissionsPaid: number;
    platformEarning: number;
    rates: CommissionRates;
    commissionsCount: number;
  }): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export const teeCommissionEngine = new TEECommissionEngine();
