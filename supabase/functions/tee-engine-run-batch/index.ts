import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CUSTOM_DIVISOR = 5;

interface BinaryTreeNode {
  id: string;
  affiliate_id: string;
  parent_id: string | null;
  sponsor_id: string | null;
  position: string;
  level: number;
  node_cap: number;
  left_child_id: string | null;
  right_child_id: string | null;
}

async function getDownlineNodes(supabase: any, affiliateId: string): Promise<BinaryTreeNode[]> {
  const { data: rootNode } = await supabase
    .from('tee_binary_tree')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .maybeSingle();

  if (!rootNode) return [];

  const downline: BinaryTreeNode[] = [];
  const queue: BinaryTreeNode[] = [rootNode];
  const nodeCap = rootNode.node_cap;
  let nodesScanned = 0;

  while (queue.length > 0 && nodesScanned < nodeCap) {
    const currentNode = queue.shift()!;

    if (currentNode.affiliate_id !== affiliateId) {
      downline.push(currentNode);
      nodesScanned++;
    }

    if (nodesScanned >= nodeCap) break;

    const childIds = [currentNode.left_child_id, currentNode.right_child_id].filter(Boolean);
    if (childIds.length > 0) {
      const { data: children } = await supabase
        .from('tee_binary_tree')
        .select('*')
        .in('affiliate_id', childIds);

      if (children) {
        queue.push(...children);
      }
    }
  }

  return downline;
}

async function getMaxDepth(supabase: any, affiliateId: string): Promise<number> {
  const { data: rootNode } = await supabase
    .from('tee_binary_tree')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .maybeSingle();

  if (!rootNode) return 0;

  let maxDepth = 0;
  const queue: { node: BinaryTreeNode; depth: number }[] = [{ node: rootNode, depth: 0 }];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    const childIds = [node.left_child_id, node.right_child_id].filter(Boolean);
    if (childIds.length > 0) {
      const { data: children } = await supabase
        .from('tee_binary_tree')
        .select('*')
        .in('affiliate_id', childIds);

      if (children) {
        children.forEach((child: BinaryTreeNode) => {
          queue.push({ node: child, depth: depth + 1 });
        });
      }
    }
  }

  return maxDepth;
}

async function getDirectReferrals(supabase: any, affiliateId: string): Promise<string[]> {
  const { data: referrals } = await supabase
    .from('tee_binary_tree')
    .select('affiliate_id')
    .eq('sponsor_id', affiliateId);

  return referrals?.map((r: any) => r.affiliate_id) || [];
}

async function mintTokensForCV(supabase: any, affiliateId: string, cvAmount: number): Promise<void> {
  const { data: settings } = await supabase
    .from('tee_tokenomics')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!settings) return;

  const mintRate = parseFloat(settings.mint_rate);
  const tokenAmount = cvAmount * mintRate;

  const { data: wallet } = await supabase
    .from('tee_wallets')
    .select('hfc_token_balance')
    .eq('affiliate_id', affiliateId)
    .maybeSingle();

  const currentBalance = wallet ? parseFloat(wallet.hfc_token_balance) : 0;

  await supabase
    .from('tee_wallets')
    .update({
      hfc_token_balance: currentBalance + tokenAmount,
      updated_at: new Date().toISOString()
    })
    .eq('affiliate_id', affiliateId);

  await supabase.from('tee_token_transactions').insert({
    affiliate_id: affiliateId,
    transaction_type: 'mint',
    amount: tokenAmount,
    cv_amount: cvAmount,
    fiat_amount: 0
  });

  const newTotalMinted = parseFloat(settings.total_minted) + tokenAmount;
  const newCirculatingSupply = parseFloat(settings.circulating_supply) + tokenAmount;

  await supabase
    .from('tee_tokenomics')
    .update({
      total_minted: newTotalMinted,
      circulating_supply: newCirculatingSupply,
      updated_at: new Date().toISOString()
    })
    .eq('id', settings.id);
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

    const batchId = `batch_${Date.now()}`;

    const { data: unprocessedOrders, error: ordersError } = await supabase
      .from('tee_orders')
      .select('*')
      .eq('processed', false);

    if (ordersError) throw ordersError;

    if (!unprocessedOrders || unprocessedOrders.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No unprocessed orders found'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const totalCV = unprocessedOrders.reduce((sum, order) => sum + parseFloat(order.cv), 0);

    const { data: allAffiliates } = await supabase
      .from('tee_affiliates')
      .select('id')
      .eq('status', 'active');

    if (!allAffiliates) {
      throw new Error('No active affiliates found');
    }

    const commissionsCalculated = [];
    const commissionRecords = [];

    for (const affiliate of allAffiliates) {
      const affiliateId = affiliate.id;

      const personalOrders = unprocessedOrders.filter(
        (order: any) => order.affiliate_id === affiliateId
      );
      const personalCV = personalOrders.reduce((sum: number, order: any) => sum + parseFloat(order.cv), 0);

      const selfCommission = personalCV * 0.10;

      const directReferrals = await getDirectReferrals(supabase, affiliateId);
      const directReferralCV = unprocessedOrders
        .filter((order: any) => directReferrals.includes(order.affiliate_id))
        .reduce((sum: number, order: any) => sum + parseFloat(order.cv), 0);
      const directCommission = directReferralCV * 0.15;

      const downlineNodes = await getDownlineNodes(supabase, affiliateId);
      const downlineAffiliateIds = downlineNodes.map(node => node.affiliate_id);
      const downlineCV = unprocessedOrders
        .filter((order: any) => downlineAffiliateIds.includes(order.affiliate_id))
        .reduce((sum: number, order: any) => sum + parseFloat(order.cv), 0);

      let passiveCommission = 0;
      if (downlineCV > 0) {
        const actualDepth = await getMaxDepth(supabase, affiliateId);
        const divisor = Math.max(CUSTOM_DIVISOR, actualDepth);
        passiveCommission = (downlineCV * 0.50) / divisor;
      }

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

        if (personalCV > 0) {
          await mintTokensForCV(supabase, affiliateId, personalCV);
        }
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

    const { data: tokenomics } = await supabase
      .from('tee_tokenomics')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (tokenomics) {
      const newBurnFundFiat = parseFloat(tokenomics.burn_fund_fiat) + burnFundAllocated;
      await supabase
        .from('tee_tokenomics')
        .update({
          burn_fund_fiat: newBurnFundFiat,
          updated_at: new Date().toISOString()
        })
        .eq('id', tokenomics.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batchId,
        total_cv: totalCV,
        total_commissions_paid: totalCommissionsPaid,
        platform_earning: platformEarning,
        burn_fund_allocated: burnFundAllocated,
        platform_net_profit: platformNetProfit,
        commissions_calculated: commissionsCalculated.length,
        message: 'Batch processing completed successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Batch processing error:', error);
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
