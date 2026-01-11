import { supabase } from '../utils/supabase';

export async function addUserToBinaryTree(
  userId: string,
  sponsorId: string | null = null
): Promise<void> {
  const { data: existing } = await supabase
    .from('binary_tree')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return;
  }

  if (!sponsorId) {
    await supabase.from('binary_tree').insert({
      user_id: userId,
      upline_id: null,
      position: 'root',
    });
    return;
  }

  const position = await findNextAvailablePosition(sponsorId);

  await supabase.from('binary_tree').insert({
    user_id: userId,
    upline_id: position.uplineId,
    position: position.side,
  });
}

async function findNextAvailablePosition(sponsorId: string): Promise<{
  uplineId: string;
  side: 'left' | 'right';
}> {
  const queue: string[] = [sponsorId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    const { data: children } = await supabase
      .from('binary_tree')
      .select('user_id, position')
      .eq('upline_id', currentId);

    const hasLeft = children?.some((c) => c.position === 'left');
    const hasRight = children?.some((c) => c.position === 'right');

    if (!hasLeft) {
      return { uplineId: currentId, side: 'left' };
    }

    if (!hasRight) {
      return { uplineId: currentId, side: 'right' };
    }

    if (children) {
      queue.push(...children.map((c) => c.user_id));
    }
  }

  return { uplineId: sponsorId, side: 'left' };
}

export async function getBinaryTreeStats(userId: string) {
  const { data: node } = await supabase
    .from('binary_tree')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!node) {
    return {
      leftCount: 0,
      rightCount: 0,
      totalDownline: 0,
    };
  }

  const leftCount = await countDownline(userId, 'left');
  const rightCount = await countDownline(userId, 'right');

  return {
    leftCount,
    rightCount,
    totalDownline: leftCount + rightCount,
  };
}

async function countDownline(userId: string, side: 'left' | 'right'): Promise<number> {
  const { data: directChild } = await supabase
    .from('binary_tree')
    .select('user_id')
    .eq('upline_id', userId)
    .eq('position', side)
    .maybeSingle();

  if (!directChild) {
    return 0;
  }

  return await countAllDescendants(directChild.user_id);
}

async function countAllDescendants(userId: string): Promise<number> {
  const { data: children } = await supabase
    .from('binary_tree')
    .select('user_id')
    .eq('upline_id', userId);

  if (!children || children.length === 0) {
    return 1;
  }

  let count = 1;
  for (const child of children) {
    count += await countAllDescendants(child.user_id);
  }

  return count;
}
