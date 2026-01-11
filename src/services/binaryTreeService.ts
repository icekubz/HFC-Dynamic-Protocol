import { supabase } from '../utils/supabase';

export interface BinaryTreePosition {
  id: string;
  user_id: string;
  sponsor_id: string | null;
  parent_id: string | null;
  position: 'left' | 'right' | 'root';
  level: number;
  left_sales_volume: number;
  right_sales_volume: number;
  total_sales_volume: number;
}

export interface AffiliatePackage {
  id: string;
  name: string;
  price: number;
  max_tree_depth: number;
  direct_commission_rate: number;
  level_2_commission_rate: number;
  level_3_commission_rate: number;
  matching_bonus_rate: number;
  max_width: number;
}

export async function getUserTreePosition(userId: string): Promise<BinaryTreePosition | null> {
  const { data, error } = await supabase
    .from('binary_tree_positions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getUserPackage(userId: string): Promise<AffiliatePackage | null> {
  const { data, error } = await supabase
    .from('affiliate_subscriptions')
    .select('package:affiliate_packages(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data?.package as AffiliatePackage || null;
}

export async function findNextAvailablePosition(sponsorId: string): Promise<{ parentId: string, position: 'left' | 'right', level: number }> {
  const sponsorPosition = await getUserTreePosition(sponsorId);

  if (!sponsorPosition) {
    return { parentId: sponsorId, position: 'root', level: 0 };
  }

  const queue: Array<{ id: string, level: number }> = [{ id: sponsorPosition.id, level: sponsorPosition.level }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const { data: children } = await supabase
      .from('binary_tree_positions')
      .select('id, position, level')
      .eq('parent_id', current.id);

    const hasLeft = children?.some(c => c.position === 'left');
    const hasRight = children?.some(c => c.position === 'right');

    if (!hasLeft) {
      return { parentId: current.id, position: 'left', level: current.level + 1 };
    }

    if (!hasRight) {
      return { parentId: current.id, position: 'right', level: current.level + 1 };
    }

    if (children) {
      queue.push(...children.map(c => ({ id: c.id, level: c.level })));
    }
  }

  return { parentId: sponsorPosition.id, position: 'left', level: sponsorPosition.level + 1 };
}

export async function addUserToBinaryTree(userId: string, sponsorId: string | null = null): Promise<void> {
  const existingPosition = await getUserTreePosition(userId);
  if (existingPosition) {
    return;
  }

  if (!sponsorId) {
    await supabase.from('binary_tree_positions').insert({
      user_id: userId,
      sponsor_id: null,
      parent_id: null,
      position: 'root',
      level: 0,
    });
    return;
  }

  const { parentId, position, level } = await findNextAvailablePosition(sponsorId);

  await supabase.from('binary_tree_positions').insert({
    user_id: userId,
    sponsor_id: sponsorId,
    parent_id: parentId,
    position,
    level,
  });
}

export async function getUplineChain(userId: string, maxLevels: number = 10): Promise<BinaryTreePosition[]> {
  const upline: BinaryTreePosition[] = [];
  let currentPosition = await getUserTreePosition(userId);

  while (currentPosition && upline.length < maxLevels && currentPosition.parent_id) {
    const { data } = await supabase
      .from('binary_tree_positions')
      .select('*')
      .eq('id', currentPosition.parent_id)
      .maybeSingle();

    if (data) {
      upline.push(data);
      currentPosition = data;
    } else {
      break;
    }
  }

  return upline;
}

export async function updateSalesVolume(userId: string, amount: number): Promise<void> {
  const position = await getUserTreePosition(userId);
  if (!position) return;

  await supabase
    .from('binary_tree_positions')
    .update({
      total_sales_volume: position.total_sales_volume + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  const upline = await getUplineChain(userId);

  for (const ancestor of upline) {
    const childPosition = await getUserTreePosition(userId);
    if (!childPosition) continue;

    const isLeftLeg = await isInLeftLeg(ancestor.user_id, userId);

    if (isLeftLeg) {
      await supabase
        .from('binary_tree_positions')
        .update({
          left_sales_volume: ancestor.left_sales_volume + amount,
          total_sales_volume: ancestor.total_sales_volume + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ancestor.id);
    } else {
      await supabase
        .from('binary_tree_positions')
        .update({
          right_sales_volume: ancestor.right_sales_volume + amount,
          total_sales_volume: ancestor.total_sales_volume + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ancestor.id);
    }
  }
}

async function isInLeftLeg(ancestorUserId: string, descendantUserId: string): Promise<boolean> {
  const ancestorPosition = await getUserTreePosition(ancestorUserId);
  if (!ancestorPosition) return false;

  const { data: leftChild } = await supabase
    .from('binary_tree_positions')
    .select('id, user_id')
    .eq('parent_id', ancestorPosition.id)
    .eq('position', 'left')
    .maybeSingle();

  if (!leftChild) return false;
  if (leftChild.user_id === descendantUserId) return true;

  const queue = [leftChild.id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const { data: children } = await supabase
      .from('binary_tree_positions')
      .select('id, user_id')
      .eq('parent_id', currentId);

    if (children) {
      for (const child of children) {
        if (child.user_id === descendantUserId) return true;
        queue.push(child.id);
      }
    }
  }

  return false;
}

export async function calculateMatchingBonus(userId: string): Promise<number> {
  const position = await getUserTreePosition(userId);
  if (!position) return 0;

  const pkg = await getUserPackage(userId);
  if (!pkg) return 0;

  const weakerLeg = Math.min(position.left_sales_volume, position.right_sales_volume);
  const matchingBonus = weakerLeg * (pkg.matching_bonus_rate / 100);

  return matchingBonus;
}

export async function getDownlineCount(userId: string): Promise<{ total: number; left: number; right: number }> {
  const position = await getUserTreePosition(userId);
  if (!position) return { total: 0, left: 0, right: 0 };

  const countDescendants = async (parentId: string): Promise<number> => {
    const { data: children } = await supabase
      .from('binary_tree_positions')
      .select('id')
      .eq('parent_id', parentId);

    if (!children || children.length === 0) return 0;

    let count = children.length;
    for (const child of children) {
      count += await countDescendants(child.id);
    }

    return count;
  };

  const { data: leftChild } = await supabase
    .from('binary_tree_positions')
    .select('id')
    .eq('parent_id', position.id)
    .eq('position', 'left')
    .maybeSingle();

  const { data: rightChild } = await supabase
    .from('binary_tree_positions')
    .select('id')
    .eq('parent_id', position.id)
    .eq('position', 'right')
    .maybeSingle();

  const leftCount = leftChild ? await countDescendants(leftChild.id) + 1 : 0;
  const rightCount = rightChild ? await countDescendants(rightChild.id) + 1 : 0;

  return {
    total: leftCount + rightCount,
    left: leftCount,
    right: rightCount,
  };
}

export async function getAllPackages(): Promise<AffiliatePackage[]> {
  const { data, error } = await supabase
    .from('affiliate_packages')
    .select('*')
    .eq('status', 'active')
    .order('price', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function subscribeToPackage(userId: string, packageId: string): Promise<void> {
  await supabase.from('affiliate_subscriptions').upsert({
    user_id: userId,
    package_id: packageId,
    status: 'active',
    subscribed_at: new Date().toISOString(),
  });
}
