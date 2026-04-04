import { supabase } from '../utils/supabase';

export interface BinaryTreeNode {
  id: string;
  affiliate_id: string;
  parent_id: string | null;
  sponsor_id: string | null;
  position: 'left' | 'right' | 'root';
  level: number;
  node_cap: number;
  left_child_id: string | null;
  right_child_id: string | null;
  created_at: string;
}

export interface PlacementResult {
  success: boolean;
  node?: BinaryTreeNode;
  error?: string;
}

export class TEEBinaryTreeService {
  /**
   * BFS Algorithm: Find the next available empty position in the binary tree
   * Rules:
   * 1. Search top-to-bottom, left-to-right
   * 2. No gaps allowed - fill completely before moving to next level
   * 3. Each parent can have max 2 children (left and right)
   */
  async findNextAvailablePosition(sponsorId: string): Promise<{ parentId: string; position: 'left' | 'right' } | null> {
    const { data: sponsorNode, error: sponsorError } = await supabase
      .from('tee_binary_tree')
      .select('*')
      .eq('affiliate_id', sponsorId)
      .maybeSingle();

    if (sponsorError || !sponsorNode) {
      console.error('Sponsor not found in binary tree:', sponsorError);
      return null;
    }

    // BFS Queue: Start with sponsor as root of their downline
    const queue: BinaryTreeNode[] = [sponsorNode];

    while (queue.length > 0) {
      const currentNode = queue.shift()!;

      // Check if left position is available
      if (!currentNode.left_child_id) {
        return {
          parentId: currentNode.affiliate_id,
          position: 'left'
        };
      }

      // Check if right position is available
      if (!currentNode.right_child_id) {
        return {
          parentId: currentNode.affiliate_id,
          position: 'right'
        };
      }

      // Both positions filled, add children to queue for next level
      const { data: children } = await supabase
        .from('tee_binary_tree')
        .select('*')
        .in('affiliate_id', [currentNode.left_child_id, currentNode.right_child_id].filter(Boolean));

      if (children && children.length > 0) {
        queue.push(...children);
      }
    }

    return null;
  }

  /**
   * Place a new affiliate in the binary tree using BFS
   */
  async placeAffiliate(affiliateId: string, sponsorId: string | null): Promise<PlacementResult> {
    try {
      // If no sponsor, this is a root node
      if (!sponsorId) {
        const { data: newNode, error } = await supabase
          .from('tee_binary_tree')
          .insert({
            affiliate_id: affiliateId,
            parent_id: null,
            sponsor_id: null,
            position: 'root',
            level: 0,
            node_cap: 1023
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, node: newNode };
      }

      // Find next available position using BFS
      const placement = await this.findNextAvailablePosition(sponsorId);

      if (!placement) {
        return {
          success: false,
          error: 'No available position found in sponsor tree'
        };
      }

      // Get parent node to determine level
      const { data: parentNode } = await supabase
        .from('tee_binary_tree')
        .select('level')
        .eq('affiliate_id', placement.parentId)
        .single();

      const newLevel = (parentNode?.level || 0) + 1;

      // Insert new node
      const { data: newNode, error: insertError } = await supabase
        .from('tee_binary_tree')
        .insert({
          affiliate_id: affiliateId,
          parent_id: placement.parentId,
          sponsor_id: sponsorId,
          position: placement.position,
          level: newLevel,
          node_cap: 1023
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update parent's child reference
      const updateField = placement.position === 'left' ? 'left_child_id' : 'right_child_id';
      await supabase
        .from('tee_binary_tree')
        .update({ [updateField]: affiliateId })
        .eq('affiliate_id', placement.parentId);

      return { success: true, node: newNode };
    } catch (error) {
      console.error('Error placing affiliate in binary tree:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all downline nodes up to node_cap limit using BFS
   */
  async getDownlineNodes(affiliateId: string): Promise<BinaryTreeNode[]> {
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

      // Don't count the root user themselves
      if (currentNode.affiliate_id !== affiliateId) {
        downline.push(currentNode);
        nodesScanned++;
      }

      if (nodesScanned >= nodeCap) break;

      // Get children
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

  /**
   * Get all upline nodes (ancestors) up to root
   */
  async getUplineNodes(affiliateId: string): Promise<BinaryTreeNode[]> {
    const upline: BinaryTreeNode[] = [];
    let currentAffiliateId: string | null = affiliateId;

    while (currentAffiliateId) {
      const { data: node } = await supabase
        .from('tee_binary_tree')
        .select('*')
        .eq('affiliate_id', currentAffiliateId)
        .maybeSingle();

      if (!node || !node.parent_id) break;

      const { data: parentNode } = await supabase
        .from('tee_binary_tree')
        .select('*')
        .eq('affiliate_id', node.parent_id)
        .maybeSingle();

      if (parentNode) {
        upline.push(parentNode);
        currentAffiliateId = parentNode.affiliate_id;
      } else {
        break;
      }
    }

    return upline;
  }

  /**
   * Calculate maximum depth of downline tree
   */
  async getMaxDepth(affiliateId: string): Promise<number> {
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
          children.forEach(child => {
            queue.push({ node: child, depth: depth + 1 });
          });
        }
      }
    }

    return maxDepth;
  }

  /**
   * Get direct referrals (sponsored by this affiliate)
   */
  async getDirectReferrals(affiliateId: string): Promise<string[]> {
    const { data: referrals } = await supabase
      .from('tee_binary_tree')
      .select('affiliate_id')
      .eq('sponsor_id', affiliateId);

    return referrals?.map(r => r.affiliate_id) || [];
  }
}

export const teeBinaryTreeService = new TEEBinaryTreeService();
