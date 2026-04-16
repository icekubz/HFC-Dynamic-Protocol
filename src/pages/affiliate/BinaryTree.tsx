import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import Layout from '../../components/Layout';
import { GitBranch, Users } from 'lucide-react';
import './PackageSelection.css';

interface TreeNode {
  id: string;
  level: number;
  position: string;
  email: string;
  status: string;
}

export default function BinaryTree() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDownline: 0,
    activeMembers: 0,
    leftLeg: 0,
    rightLeg: 0,
  });

  useEffect(() => {
    fetchTreeData();
  }, []);

  const fetchTreeData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('binary_tree')
        .select('*')
        .eq('sponsor_id', user.id);

      if (data) {
        setTreeData(data);
        setStats({
          totalDownline: data.length,
          activeMembers: data.filter((n: any) => n.status === 'active').length,
          leftLeg: data.filter((n: any) => n.position === 'left').length,
          rightLeg: data.filter((n: any) => n.position === 'right').length,
        });
      }
    } catch (err) {
      console.error('Error fetching tree data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Binary Tree">
      <div className="management-container">
        <div className="management-header">
          <h2><GitBranch /> Binary Tree Structure</h2>
          <p>View your downline organization</p>
        </div>

        {loading ? (
          <p>Loading tree...</p>
        ) : (
          <>
            <div className="tree-stats">
              <div className="stat-box">
                <h4><Users size={16} /> Total Downline</h4>
                <p>{stats.totalDownline}</p>
              </div>
              <div className="stat-box">
                <h4>Active Members</h4>
                <p>{stats.activeMembers}</p>
              </div>
              <div className="stat-box">
                <h4>Left Leg</h4>
                <p>{stats.leftLeg}</p>
              </div>
              <div className="stat-box">
                <h4>Right Leg</h4>
                <p>{stats.rightLeg}</p>
              </div>
            </div>

            {treeData.length === 0 ? (
              <p>No downline members yet</p>
            ) : (
              <div className="tree-visualization">
                <h3>Your Network</h3>
                <div className="tree-list">
                  {treeData.map((node) => (
                    <div key={node.id} className={`tree-node level-${node.level} ${node.position}`}>
                      <div className="node-content">
                        <p className="node-email">{node.email}</p>
                        <p className="node-status">{node.status}</p>
                        <p className="node-position">{node.position} - Level {node.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
