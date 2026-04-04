import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WithdrawPayload {
  affiliateId: string;
  amountRequested: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: WithdrawPayload = await req.json();
    const { affiliateId, amountRequested } = payload;

    if (!affiliateId || !amountRequested || amountRequested <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid request: affiliateId and positive amountRequested required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: settings, error: settingsError } = await supabase
      .from('tee_tokenomics')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Tokenomics settings not found'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: wallet, error: walletError } = await supabase
      .from('tee_wallets')
      .select('balance_self, balance_direct, balance_passive, hfc_token_balance, total_withdrawn')
      .eq('affiliate_id', affiliateId)
      .maybeSingle();

    if (walletError || !wallet) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Wallet not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const totalBalance =
      parseFloat(wallet.balance_self) +
      parseFloat(wallet.balance_direct) +
      parseFloat(wallet.balance_passive);

    if (totalBalance < amountRequested) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient balance. Available: $${totalBalance.toFixed(2)}, Requested: $${amountRequested.toFixed(2)}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const withdrawalBurnRate = parseFloat(settings.withdrawal_burn_rate);
    const burnFee = amountRequested * (withdrawalBurnRate / 100);
    const amountPaid = amountRequested - burnFee;

    const mintRate = parseFloat(settings.mint_rate);
    const tokensToBurn = burnFee * mintRate;

    const currentTokenBalance = parseFloat(wallet.hfc_token_balance);
    if (currentTokenBalance < tokensToBurn) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient token balance for burn. Required: ${tokensToBurn.toFixed(2)} HFC, Available: ${currentTokenBalance.toFixed(2)} HFC`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
    const balanceSelf = parseFloat(wallet.balance_self);
    const balanceDirect = parseFloat(wallet.balance_direct);
    const balancePassive = parseFloat(wallet.balance_passive);

    const newBalanceSelf = Math.max(0, balanceSelf - remainingToDeduct);
    remainingToDeduct = Math.max(0, remainingToDeduct - balanceSelf);

    const newBalanceDirect = remainingToDeduct > 0
      ? Math.max(0, balanceDirect - remainingToDeduct)
      : balanceDirect;
    remainingToDeduct = Math.max(0, remainingToDeduct - balanceDirect);

    const newBalancePassive = remainingToDeduct > 0
      ? Math.max(0, balancePassive - remainingToDeduct)
      : balancePassive;

    await supabase
      .from('tee_wallets')
      .update({
        balance_self: newBalanceSelf,
        balance_direct: newBalanceDirect,
        balance_passive: newBalancePassive,
        hfc_token_balance: currentTokenBalance - tokensToBurn,
        total_withdrawn: (parseFloat(wallet.total_withdrawn) || 0) + amountPaid,
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

    const newTotalBurned = parseFloat(settings.total_burned) + tokensToBurn;
    const newCirculatingSupply = parseFloat(settings.circulating_supply) - tokensToBurn;
    const newBurnFundFiat = parseFloat(settings.burn_fund_fiat) + burnFee;

    await supabase
      .from('tee_tokenomics')
      .update({
        total_burned: newTotalBurned,
        circulating_supply: newCirculatingSupply,
        burn_fund_fiat: newBurnFundFiat,
        updated_at: new Date().toISOString()
      })
      .eq('id', settings.id);

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawal.id,
        amount_requested: amountRequested,
        burn_fee: burnFee,
        amount_paid: amountPaid,
        tokens_burned: tokensToBurn,
        remaining_balance: {
          self: newBalanceSelf,
          direct: newBalanceDirect,
          passive: newBalancePassive,
          total: newBalanceSelf + newBalanceDirect + newBalancePassive
        },
        message: 'Withdrawal processed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Withdrawal processing error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
