import { supabase } from '../utils/supabase';

interface HFCPackage {
  cap_limit: number;
  min_depth: number;
  cv_value: number;
}

interface BinaryTreeNode {
  user_id: string;
  upline_id: string | null;
  position: string;
}

export async function calculateHFCCommissions(
  orderId: string,
  buyerId: string,
  cvAmount: number
): Promise<void> {
  const selfCommission = cvAmount * 0.10;
  const directCommission = cvAmount * 0.15;
  const passivePool = cvAmount * 0.50;

  await supabase
    .from('wallets')
    .upsert({
      user_id: buyerId,
      balance_self: supabase.raw(`COALESCE(balance_self, 0) + ${selfCommission}`),
      total_earnings: supabase.raw(`COALESCE(total_earnings, 0) + ${selfCommission}`),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  const { data: buyerNode } = await supabase
    .from('binary_tree')
    .select('upline_id')
    .eq('user_id', buyerId)
    .maybeSingle();

  if (!buyerNode?.upline_id) {
    return;
  }

  const sponsorId = buyerNode.upline_id;

  await supabase
    .from('wallets')
    .upsert({
      user_id: sponsorId,
      balance_direct: supabase.raw(`COALESCE(balance_direct, 0) + ${directCommission}`),
      total_earnings: supabase.raw(`COALESCE(total_earnings, 0) + ${directCommission}`),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  const { data: sponsorProfile } = await supabase
    .from('profiles')
    .select('current_package_id, packages(cap_limit, min_depth)')
    .eq('id', sponsorId)
    .maybeSingle();

  if (!sponsorProfile?.current_package_id || !sponsorProfile.packages) {
    return;
  }

  const pkg = sponsorProfile.packages as unknown as HFCPackage;
  const uplineChain = await getUplineChain(sponsorId, pkg.cap_limit);

  if (uplineChain.length < pkg.min_depth) {
    return;
  }

  const eligibleUpline = uplineChain.slice(0, pkg.cap_limit);
  const totalWeight = eligibleUpline.reduce((sum, _, idx) => sum + (1 / (idx + 1)), 0);

  for (let i = 0; i < eligibleUpline.length; i++) {
    const weight = (1 / (i + 1)) / totalWeight;
    const passiveAmount = passivePool * weight;

    await supabase
      .from('wallets')
      .upsert({
        user_id: eligibleUpline[i].user_id,
        balance_passive: supabase.raw(`COALESCE(balance_passive, 0) + ${passiveAmount}`),
        total_earnings: supabase.raw(`COALESCE(total_earnings, 0) + ${passiveAmount}`),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  }
}

async function getUplineChain(userId: string, maxDepth: number): Promise<BinaryTreeNode[]> {
  const chain: BinaryTreeNode[] = [];
  let currentId: string | null = userId;

  while (currentId && chain.length < maxDepth) {
    const { data } = await supabase
      .from('binary_tree')
      .select('user_id, upline_id, position')
      .eq('user_id', currentId)
      .maybeSingle();

    if (!data?.upline_id) break;

    const { data: uplineNode } = await supabase
      .from('binary_tree')
      .select('user_id, upline_id, position')
      .eq('user_id', data.upline_id)
      .maybeSingle();

    if (!uplineNode) break;

    chain.push(uplineNode);
    currentId = uplineNode.upline_id;
  }

  return chain;
}

export async function getWalletBalance(userId: string) {
  const { data } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data || {
    balance_self: 0,
    balance_direct: 0,
    balance_passive: 0,
    total_earnings: 0,
  };
}

export async function getUserPackage(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('current_package_id, packages(name, price, cv_value, cap_limit, min_depth)')
    .eq('id', userId)
    .maybeSingle();

  return data?.packages || null;
}

export async function getAllPackages() {
  const { data } = await supabase
    .from('packages')
    .select('*')
    .order('price', { ascending: true });

  return data || [];
}

export async function subscribeToPackage(userId: string, packageId: string) {
  await supabase
    .from('profiles')
    .update({
      current_package_id: packageId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  await supabase
    .from('wallets')
    .upsert({
      user_id: userId,
      balance_self: 0,
      balance_direct: 0,
      balance_passive: 0,
      total_earnings: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}
