import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderPayload {
  merchantId: string;
  affiliateId: string;
  orderTotal: number;
  commissionPercent: number;
  externalOrderId?: string;
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

    const payload: OrderPayload = await req.json();

    const { merchantId, affiliateId, orderTotal, commissionPercent, externalOrderId } = payload;

    if (!merchantId || !affiliateId || !orderTotal || commissionPercent === undefined) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: merchantId, affiliateId, orderTotal, commissionPercent'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('tee_merchants')
      .select('id, status')
      .eq('id', merchantId)
      .eq('status', 'active')
      .maybeSingle();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or inactive merchant'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: affiliate, error: affiliateError } = await supabase
      .from('tee_affiliates')
      .select('id, status')
      .eq('id', affiliateId)
      .eq('status', 'active')
      .maybeSingle();

    if (affiliateError || !affiliate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or inactive affiliate'
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cv = orderTotal * (commissionPercent / 100);

    const { data: order, error: orderError } = await supabase
      .from('tee_orders')
      .insert({
        merchant_id: merchantId,
        affiliate_id: affiliateId,
        external_order_id: externalOrderId || null,
        order_total: orderTotal,
        commission_percent: commissionPercent,
        cv: cv,
        processed: false
      })
      .select()
      .single();

    if (orderError) {
      throw orderError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        cv: cv,
        message: 'Order received and CV calculated successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Webhook error:', error);
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
