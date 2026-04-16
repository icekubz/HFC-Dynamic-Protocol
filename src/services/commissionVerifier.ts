import { CommissionRates, CommissionCalculation } from './teeCommissionEngine';

export interface VerificationReport {
  totalCV: number;
  rates: CommissionRates;
  calculations: CommissionCalculation[];
  verification: {
    totalAffiliateCommissions: number;
    platformEarning: number;
    burnFundAllocation: number;
    platformNetProfit: number;
    totalPayout: number;
    percentageBreakdown: {
      affiliateShare: number;
      platformShare: number;
    };
    allocation: {
      selfCommissionTotal: number;
      directCommissionTotal: number;
      passiveCommissionTotal: number;
      platformTotal: number;
    };
    allocationPercentages: {
      selfPercent: number;
      directPercent: number;
      passivePercent: number;
      platformPercent: number;
    };
  };
  details: string[];
  isValid: boolean;
}

export class CommissionVerifier {
  /**
   * Verify commission calculations match expected rates
   */
  static verify(
    totalCV: number,
    rates: CommissionRates,
    calculations: CommissionCalculation[]
  ): VerificationReport {
    const details: string[] = [];
    const report: VerificationReport = {
      totalCV,
      rates,
      calculations,
      verification: {
        totalAffiliateCommissions: 0,
        platformEarning: 0,
        burnFundAllocation: 0,
        platformNetProfit: 0,
        totalPayout: 0,
        percentageBreakdown: {
          affiliateShare: 0,
          platformShare: 0,
        },
        allocation: {
          selfCommissionTotal: 0,
          directCommissionTotal: 0,
          passiveCommissionTotal: 0,
          platformTotal: 0,
        },
        allocationPercentages: {
          selfPercent: 0,
          directPercent: 0,
          passivePercent: 0,
          platformPercent: 0,
        },
      },
      details,
      isValid: true,
    };

    // Calculate totals
    const selfTotal = calculations.reduce((sum, c) => sum + c.selfCommission, 0);
    const directTotal = calculations.reduce((sum, c) => sum + c.directCommission, 0);
    const passiveTotal = calculations.reduce((sum, c) => sum + c.passiveCommission, 0);
    const totalAffiliateCommissions = selfTotal + directTotal + passiveTotal;

    const platformEarning = totalCV * (rates.platformRate / 100);
    const burnFundAllocation = platformEarning * 0.50;
    const platformNetProfit = platformEarning * 0.50;

    report.verification.allocation.selfCommissionTotal = selfTotal;
    report.verification.allocation.directCommissionTotal = directTotal;
    report.verification.allocation.passiveCommissionTotal = passiveTotal;
    report.verification.allocation.platformTotal = platformEarning;

    report.verification.totalAffiliateCommissions = totalAffiliateCommissions;
    report.verification.platformEarning = platformEarning;
    report.verification.burnFundAllocation = burnFundAllocation;
    report.verification.platformNetProfit = platformNetProfit;
    report.verification.totalPayout = totalAffiliateCommissions + platformEarning;

    // Percentage breakdown
    const totalDistribution = totalAffiliateCommissions + platformEarning;
    if (totalDistribution > 0) {
      report.verification.percentageBreakdown.affiliateShare = (totalAffiliateCommissions / totalDistribution) * 100;
      report.verification.percentageBreakdown.platformShare = (platformEarning / totalDistribution) * 100;

      report.verification.allocationPercentages.selfPercent = (selfTotal / totalDistribution) * 100;
      report.verification.allocationPercentages.directPercent = (directTotal / totalDistribution) * 100;
      report.verification.allocationPercentages.passivePercent = (passiveTotal / totalDistribution) * 100;
      report.verification.allocationPercentages.platformPercent = (platformEarning / totalDistribution) * 100;
    }

    // Verification checks
    details.push(`Total CV Ingested: $${totalCV.toFixed(2)}`);
    details.push(`Commission Rates - Self: ${rates.selfRate}% | Direct: ${rates.directRate}% | Passive: ${rates.passiveRate}% | Platform: ${rates.platformRate}%`);
    details.push(`Passive Divisor: ${rates.passiveDivisor}`);
    details.push('');

    details.push('=== AFFILIATE COMMISSIONS ===');
    details.push(`Self Commission: $${selfTotal.toFixed(2)} (${(selfTotal / totalCV * 100).toFixed(2)}% of total CV)`);
    details.push(`Direct Commission: $${directTotal.toFixed(2)} (${(directTotal / totalCV * 100).toFixed(2)}% of total CV)`);
    details.push(`Passive Commission: $${passiveTotal.toFixed(2)} (${(passiveTotal / totalCV * 100).toFixed(2)}% of total CV)`);
    details.push(`Total Affiliate Commissions: $${totalAffiliateCommissions.toFixed(2)} (${(totalAffiliateCommissions / totalCV * 100).toFixed(2)}% of total CV)`);
    details.push('');

    details.push('=== PLATFORM EARNINGS ===');
    details.push(`Platform Rate: ${rates.platformRate}%`);
    details.push(`Total Platform Earning: $${platformEarning.toFixed(2)}`);
    details.push(`Burn Fund (50%): $${burnFundAllocation.toFixed(2)}`);
    details.push(`Net Profit (50%): $${platformNetProfit.toFixed(2)}`);
    details.push('');

    details.push('=== VERIFICATION ===');
    details.push(`Total Distributions: $${totalDistribution.toFixed(2)}`);
    details.push(`Affiliate Share: ${report.verification.percentageBreakdown.affiliateShare.toFixed(2)}%`);
    details.push(`Platform Share: ${report.verification.percentageBreakdown.platformShare.toFixed(2)}%`);
    details.push('');

    // Validate rates
    const expectedAffiliateRate = rates.selfRate + rates.directRate + rates.passiveRate;
    const totalAllocationRate = expectedAffiliateRate + rates.platformRate;

    if (Math.abs(totalAllocationRate - 100) > 0.01) {
      details.push(`⚠ WARNING: Total allocation rate is ${totalAllocationRate.toFixed(2)}%, should equal 100%`);
      report.isValid = false;
    } else {
      details.push(`✓ Total allocation rate = 100%`);
    }

    if (calculations.length > 0) {
      details.push('');
      details.push('=== AFFILIATE CALCULATIONS ===');
      calculations.slice(0, 5).forEach((calc, idx) => {
        details.push(`Affiliate ${idx + 1}: Self $${calc.selfCommission.toFixed(2)} | Direct $${calc.directCommission.toFixed(2)} | Passive $${calc.passiveCommission.toFixed(2)} | Total $${calc.totalCommission.toFixed(2)}`);
        if (calc.calculationBreakdown) {
          const bd = calc.calculationBreakdown;
          details.push(`  → Personal CV: $${bd.personalCV.toFixed(2)}, Direct Ref CV: $${bd.directReferralCV.toFixed(2)}, Downline CV: $${bd.downlineCV.toFixed(2)}, Max Depth: ${bd.maxDepth}, Divisor Used: ${bd.divisorUsed}`);
        }
      });
      if (calculations.length > 5) {
        details.push(`... and ${calculations.length - 5} more affiliates`);
      }
    }

    return report;
  }
}
