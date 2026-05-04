import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Users, Database, FileText, Settings, Search, UserPlus, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  profile?: {
    display_name?: string;
    base_currency?: string;
    risk_profile?: string;
  };
  role?: {
    role: string;
  };
}

interface SystemStats {
  total_users: number;
  active_subscriptions: number;
  total_conversations: number;
  storage_usage: string;
}

const Admin = () => {
  const { user, signOut } = useAuth();
  const { isAdmin, loading: roleLoading } = useRoles();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    total_users: 0,
    active_subscriptions: 0,
    total_conversations: 0,
    storage_usage: '0 MB'
  });
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isAdmin()) {
      fetchUsers();
      fetchStats();
    }
  }, [user, isAdmin]);

  // Redirect non-admin users
  if (!roleLoading && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users with profiles and roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          display_name,
          base_currency,
          risk_profile,
          created_at
        `);

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get user emails from auth (this requires service role key)
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Cannot fetch auth users (requires service role):', authError);
        // Fallback: just show profile data without emails
        const usersData = profiles.map(profile => ({
          id: profile.user_id,
          email: 'Not accessible',
          created_at: profile.created_at,
          profile,
          role: roles.find(r => r.user_id === profile.user_id)
        }));
        setUsers(usersData);
        return;
      }

      // Combine data
      const usersData = authUsers.users.map(authUser => {
        const profile = profiles.find(p => p.user_id === authUser.id);
        const role = roles.find(r => r.user_id === authUser.id);
        
        return {
          id: authUser.id,
          email: authUser.email || 'No email',
          created_at: authUser.created_at,
          profile,
          role
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Run all four stat queries in parallel
      const [
        { count: userCount },
        { count: conversationCount },
        { count: subCount },
        { data: storageData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('ai_interactions').select('*', { count: 'exact', head: true }),
        // Active subscriptions: paid and not yet expired
        (supabase as any)
          .from('subscriptions_moyasar')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'paid')
          .gt('expires_at', new Date().toISOString()),
        // Approximate DB size from pg_total_relation_size via RPC
        supabase.rpc('get_db_size_mb' as any).maybeSingle(),
      ]);

      // Format storage: use RPC result if available, else show '—'
      const storageMb: number | null = storageData as any;
      const storageLabel = storageMb != null
        ? storageMb >= 1024
          ? `${(storageMb / 1024).toFixed(1)} GB`
          : `${Math.round(storageMb)} MB`
        : '—';

      setStats({
        total_users: userCount || 0,
        active_subscriptions: subCount || 0,
        total_conversations: conversationCount || 0,
        storage_usage: storageLabel,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const assignRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: newRole as any
        });

      if (error) throw error;

      toast.success(`Role assigned successfully`);
      await fetchUsers();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    user.profile?.display_name?.toLowerCase().includes(searchEmail.toLowerCase())
  );

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="animate-pulse text-white text-xl">Loading Admin Panel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-white/80">Manage users, monitor system, and configure settings</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary" className="bg-red-500/20 text-red-300 border-red-400">
              <Shield className="w-4 h-4 mr-1" />
              Admin Access
            </Badge>
            <Button 
              variant="outline" 
              onClick={signOut}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Sign Out
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/10 border-white/20">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/20">
              <Database className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-white/20">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="agreements" className="data-[state=active]:bg-white/20">
              <FileText className="w-4 h-4 mr-2" />
              Legal Agreements
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white/20">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm font-medium">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.total_users}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm font-medium">Active Subscriptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.active_subscriptions}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm font-medium">AI Conversations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.total_conversations}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm font-medium">Storage Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats.storage_usage}</div>
                </CardContent>
              </Card>
            </div>
            
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white">System Health</CardTitle>
              </CardHeader>
              <CardContent className="text-white/80">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Database Connection:</span>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">Healthy</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Services:</span>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">Operational</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Processing:</span>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  User Management
                </CardTitle>
                <div className="flex space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                    <Input
                      placeholder="Search users by email or name..."
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder-white/50"
                    />
                  </div>
                  <Button className="bg-primary hover:bg-primary/90">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center text-white/80 py-8">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center text-white/80 py-8">No users found</div>
                  ) : (
                    filteredUsers.map((userData) => (
                      <div key={userData.id} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div>
                                <h3 className="text-white font-medium">
                                  {userData.profile?.display_name || 'No name set'}
                                </h3>
                                <p className="text-white/60 text-sm">{userData.email}</p>
                                <p className="text-white/40 text-xs">
                                  Joined: {new Date(userData.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                              {userData.role?.role || 'user'}
                            </Badge>
                            <Select
                              value={selectedRole}
                              onValueChange={(role) => {
                                setSelectedRole(role);
                                assignRole(userData.id, role);
                              }}
                            >
                              <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                                <SelectValue placeholder="Change Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="moderator">Moderator</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agreements" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Legal Agreement Management</CardTitle>
                <p className="text-white/80">Manage Terms of Service and Privacy Policy versions</p>
              </CardHeader>
              <CardContent className="text-white/80">
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 mx-auto text-white/50 mb-4" />
                  <p className="text-lg mb-2">Agreement Management Dashboard</p>
                  <p className="text-sm text-white/60 mb-4">
                    View user agreement acceptance rates, manage document versions, and track compliance.
                  </p>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <CardHeader>
                <CardTitle className="text-white">System Settings</CardTitle>
                <p className="text-white/80">Configure system-wide settings and preferences</p>
              </CardHeader>
              <CardContent className="text-white/80">
                <div className="text-center py-8">
                  <Settings className="w-16 h-16 mx-auto text-white/50 mb-4" />
                  <p className="text-lg mb-2">System Configuration</p>
                  <p className="text-sm text-white/60 mb-4">
                    Manage AI model settings, payment configurations, and security policies.
                  </p>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;