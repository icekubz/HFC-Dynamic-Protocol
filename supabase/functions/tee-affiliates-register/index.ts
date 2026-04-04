import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RegisterPayload {
  merchantId: string;
  email: string;
  fullName: string;
  sponsorId?: string;
}

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
  created_at: string;
}

async function findNextAvailablePosition(
  supabase: any,
  sponsorId: string
): Promise<{ parentId: string; position: 'left' | 'right' } | null> {
  const { data: sponsorNode, error: sponsorError } = await supabase
    .from('tee_binary_tree')
    .select('*')
    .eq('affiliate_id', sponsorId)
    .maybeSingle();

  if (sponsorError || !sponsorNode) {
    console.error('Sponsor not found in binary tree:', sponsorError);
    return null;
  }

  const queue: BinaryTreeNode[] = [sponsorNode];

  while (queue.length > 0) {
    const currentNode = queue.shift()!;

    if (!currentNode.left_child_id) {
      return {
        parentId: currentNode.affiliate_id,
        position: 'left'
      };
    }

    if (!currentNode.right_child_id) {
      return {
        parentId: currentNode.affiliate_id,
        position: 'right'
      };
    }

    const childIds = [currentNode.left_child_id, currentNode.right_child_id].filter(Boolean);
    const { data: children } = await supabase
      .from('tee_binary_tree')
      .select('*')
      .in('affiliate_id', childIds);

    if (children && children.length > 0) {
      queue.push(...children);
    }
  }

  return null;
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

    const payload: RegisterPayload = await req.json();
    const { merchantId, email, fullName, sponsorId } = payload;

    if (!merchantId || !email || !fullName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: merchantId, email, fullName'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingAffiliate } = await supabase
      .from('tee_affiliates')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingAffiliate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Email already registered'
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: newAffiliate, error: affiliateError } = await supabase
      .from('tee_affiliates')
      .insert({
        merchant_id: merchantId,
        email: email,
        full_name: fullName,
        sponsor_id: sponsorId || null,
        status: 'active'
      })
      .select()
      .single();

    if (affiliateError) {
      throw affiliateError;
    }

    let treeNode;
    if (!sponsorId) {
      const { data: rootNode, error: treeError } = await supabase
        .from('tee_binary_tree')
        .insert({
          affiliate_id: newAffiliate.id,
          parent_id: null,
          sponsor_id: null,
          position: 'root',
          level: 0,
          node_cap: 1023
        })
        .select()
        .single();

      if (treeError) throw treeError;
      treeNode = rootNode;
    } else {
      const placement = await findNextAvailablePosition(supabase, sponsorId);

      if (!placement) {
        await supabase.from('tee_affiliates').delete().eq('id', newAffiliate.id);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No available position found in sponsor tree'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: parentNode } = await supabase
        .from('tee_binary_tree')
        .select('level')
        .eq('affiliate_id', placement.parentId)
        .single();

      const newLevel = (parentNode?.level || 0) + 1;

      const { data: newTreeNode, error: treeError } = await supabase
        .from('tee_binary_tree')
        .insert({
          affiliate_id: newAffiliate.id,
          parent_id: placement.parentId,
          sponsor_id: sponsorId,
          position: placement.position,
          level: newLevel,
          node_cap: 1023
        })
        .select()
        .single();

      if (treeError) throw treeError;

      const updateField = placement.position === 'left' ? 'left_child_id' : 'right_child_id';
      await supabase
        .from('tee_binary_tree')
        .update({ [updateField]: newAffiliate.id })
        .eq('affiliate_id', placement.parentId);

      treeNode = newTreeNode;
    }

    await supabase
      .from('tee_wallets')
      .insert({
        affiliate_id: newAffiliate.id,
        balance_self: 0,
        balance_direct: 0,
        balance_passive: 0,
        total_earned: 0,
        total_withdrawn: 0,
        hfc_token_balance: 0
      });

    return new Response(
      JSON.stringify({
        success: true,
        affiliate: {
          id: newAffiliate.id,
          email: newAffiliate.email,
          full_name: newAffiliate.full_name,
          referral_code: newAffiliate.referral_code
        },
        tree_position: {
          position: treeNode.position,
          level: treeNode.level,
          parent_id: treeNode.parent_id
        },
        message: 'Affiliate registered and placed in binary tree successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Registration error:', error);
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
