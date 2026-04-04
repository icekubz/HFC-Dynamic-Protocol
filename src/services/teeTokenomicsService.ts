import { supabase } from '../utils/supabase';

export interface TokenomicsSettings {
  mint_rate: number;
  withdrawal_burn_rate: number;
  total_minted: number;
  total_burned: number;
  circulating_supply: number;
  burn_fund_fiat: number;
}

export interface WithdrawalResult {
  success: boolean;
  withdrawal_id?: string;
  amount_paid?: number;
  burn_fee?: number;
  tokens_burned?: number;
  error?: string;
}

export class TEETokenomicsService {
  /**
   * Get current tokenomics settings
   */
  async getSettings(): Promise<TokenomicsSettings | null> {
    const { data, error } = await supabase
      .from('tee_tokenomics')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching tokenomics settings:', error);
      return null;
    }

    return data ? {
      mint_rate: parseFloat(data.mint_rate),
      withdrawal_burn_rate: parseFloat(data.withdrawal_burn_rate),
      total_minted: parseFloat(data.total_minted),
      total_burned: parseFloat(data.total_burned),
      circulating_supply: parseFloat(data.circulating_supply),
      burn_fund_fiat: parseFloat(data.burn_fund_fiat)
    } : null;
  }

  /**
   * Update mint rate (admin only)
   */
  async updateMintRate(newRate: number, adminId: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings) return false;

    const { error } = await supabase
      .from('tee_tokenomics')
      .update({
        mint_rate: newRate,
        updated_at: new Date().toISOString(),
        updated_by: adminId
      })
      .eq('id', (await supabase.from('tee_tokenomics').select('id').limit(1).single()).data?.id);

    return !error;
  }

  /**
   * Update withdrawal burn rate (admin only)
   */
  async updateWithdrawalBurnRate(newRate: number, adminId: string): Promise<boolean> {
    const settings = await this.getSettings();
    if (!settings) return false;

    const { error } = await supabase
      .from('tee_tokenomics')
      .update({
        withdrawal_burn_rate: newRate,
        updated_at: new Date().toISOString(),
        updated_by: adminId
      })
      .eq('id', (await supabase.from('tee_tokenomics').select('id').limit(1).single()).data?.id);

    return !error;
  }

  /**
   * Mint tokens for an affiliate based on their personal CV
   * Formula: tokens = CV * mint_rate
   */
  async mintTokensForCV(affiliateId: string, cvAmount: number): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      if (!settings) return false;

      const tokenAmount = cvAmount * settings.mint_rate;

      const { data: wallet } = await supabase
        .from('tee_wallets')
        .select('hfc_token_balance')
        .eq('affiliate_id', affiliateId)
        .maybeSingle();

      const currentBalance = wallet ? parseFloat(wallet.hfc_token_balance) : 0;

      await supabase
        .from('tee_wallets')
        .upsert({
          affiliate_id: affiliateId,
          hfc_token_balance: currentBalance + tokenAmount,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'affiliate_id'
        });

      await supabase.from('tee_token_transactions').insert({
        affiliate_id: affiliateId,
        transaction_type: 'mint',
        amount: tokenAmount,
        cv_amount: cvAmount,
        fiat_amount: 0
      });

      const newTotalMinted = settings.total_minted + tokenAmount;
      const newCirculatingSupply = settings.circulating_supply + tokenAmount;

      await supabase
        .from('tee_tokenomics')
        .update({
          total_minted: newTotalMinted,
          circulating_supply: newCirculatingSupply,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('tee_tokenomics').select('id').limit(1).single()).data?.id);

      return true;
    } catch (error) {
      console.error('Error minting tokens:', error);
      return false;
    }
  }

  /**
   * Process fiat withdrawal with dynamic burn fee
   *
   * Rules:
   * 1. Deduct withdrawal_burn_rate % from requested amount
   * 2. Add burn fee to burn fund
   * 3. Calculate equivalent tokens to burn (based on current mint rate)
   * 4. Burn tokens from circulating supply
   * 5. Pay out net amount to affiliate
   */
  async processWithdrawal(affiliateId: string, amountRequested: number): Promise<WithdrawalResult> {
    try {
      const settings = await this.getSettings();
      if (!settings) {
        return { success: false, error: 'Tokenomics settings not found' };
      }

      const { data: wallet } = await supabase
        .from('tee_wallets')
        .select('balance_self, balance_direct, balance_passive, hfc_token_balance')
        .eq('affiliate_id', affiliateId)
        .maybeSingle();

      if (!wallet) {
        return { success: false, error: 'Wallet not found' };
      }

      const totalBalance =
        parseFloat(wallet.balance_self) +
        parseFloat(wallet.balance_direct) +
        parseFloat(wallet.balance_passive);

      if (totalBalance < amountRequested) {
        return { success: false, error: 'Insufficient balance' };
      }

      const burnFee = amountRequested * (settings.withdrawal_burn_rate / 100);
      const amountPaid = amountRequested - burnFee;

      const tokensToBurn = burnFee * settings.mint_rate;

      const currentTokenBalance = parseFloat(wallet.hfc_token_balance);
      if (currentTokenBalance < tokensToBurn) {
        return { success: false, error: 'Insufficient token balance for burn' };
      }

      const { data: withdrawal, error: withdrawalError } = await supabase
        .from('tee_withdrawals')
        .insert({
          affiliate_id: affiliateId,
          amount_requested: amountRequested,
          burn_fee: burnFee,
          amount_paid: amountPaid,
          tokens_burned: tokensToBurn,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (withdrawalError) throw withdrawalError;

      let remainingToDeduct = amountRequested;
      const newBalanceSelf = Math.max(0, parseFloat(wallet.balance_self) - remainingToDeduct);
      remainingToDeduct -= parseFloat(wallet.balance_self);

      const newBalanceDirect = remainingToDeduct > 0
        ? Math.max(0, parseFloat(wallet.balance_direct) - remainingToDeduct)
        : parseFloat(wallet.balance_direct);
      remainingToDeduct -= parseFloat(wallet.balance_direct);

      const newBalancePassive = remainingToDeduct > 0
        ? Math.max(0, parseFloat(wallet.balance_passive) - remainingToDeduct)
        : parseFloat(wallet.balance_passive);

      const { data: currentWalletData } = await supabase
        .from('tee_wallets')
        .select('total_withdrawn')
        .eq('affiliate_id', affiliateId)
        .maybeSingle();

      await supabase
        .from('tee_wallets')
        .update({
          balance_self: newBalanceSelf,
          balance_direct: newBalanceDirect,
          balance_passive: newBalancePassive,
          hfc_token_balance: currentTokenBalance - tokensToBurn,
          total_withdrawn: (parseFloat(currentWalletData?.total_withdrawn) || 0) + amountPaid,
          updated_at: new Date().toISOString()
        })
        .eq('affiliate_id', affiliateId);

      await supabase.from('tee_token_transactions').insert({
        affiliate_id: affiliateId,
        transaction_type: 'withdrawal_burn',
        amount: tokensToBurn,
        cv_amount: 0,
        fiat_amount: burnFee
      });

      const newTotalBurned = settings.total_burned + tokensToBurn;
      const newCirculatingSupply = settings.circulating_supply - tokensToBurn;
      const newBurnFundFiat = settings.burn_fund_fiat + burnFee;

      await supabase
        .from('tee_tokenomics')
        .update({
          total_burned: newTotalBurned,
          circulating_supply: newCirculatingSupply,
          burn_fund_fiat: newBurnFundFiat,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('tee_tokenomics').select('id').limit(1).single()).data?.id);

      return {
        success: true,
        withdrawal_id: withdrawal.id,
        amount_paid: amountPaid,
        burn_fee: burnFee,
        tokens_burned: tokensToBurn
      };
    } catch (error) {
      console.error('Withdrawal processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add fiat to burn fund (from platform earnings)
   */
  async addToBurnFund(amount: number): Promise<boolean> {
    try {
      const settings = await this.getSettings();
      if (!settings) return false;

      const newBurnFundFiat = settings.burn_fund_fiat + amount;

      await supabase
        .from('tee_tokenomics')
        .update({
          burn_fund_fiat: newBurnFundFiat,
          updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('tee_tokenomics').select('id').limit(1).single()).data?.id);

      return true;
    } catch (error) {
      console.error('Error adding to burn fund:', error);
      return false;
    }
  }
}

export const teeTokenomicsService = new TEETokenomicsService();
