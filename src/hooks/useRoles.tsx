import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'moderator' | 'user';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export const useRoles = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserRole();
    } else {
      setUserRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user!.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No role found, default to 'user'
          setUserRole('user');
        } else {
          throw error;
        }
      } else {
        setUserRole(data.role);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      toast.error('Failed to fetch user role');
      setUserRole('user'); // Default fallback
    } finally {
      setLoading(false);
    }
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    if (!userRole) return false;

    // Admin has access to everything
    if (userRole === 'admin') return true;

    // Moderator has access to moderator and user features
    if (userRole === 'moderator' && (role === 'moderator' || role === 'user')) return true;

    // User only has access to user features
    if (userRole === 'user' && role === 'user') return true;

    return false;
  }, [userRole]);

  const isAdmin = useCallback((): boolean => userRole === 'admin', [userRole]);
  const isModerator = useCallback((): boolean => userRole === 'moderator', [userRole]);

  const assignRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role,
        });

      if (error) throw error;

      toast.success(`Role ${role} assigned successfully`);
      
      // Refresh current user's role if updating own role
      if (userId === user?.id) {
        await fetchUserRole();
      }
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role');
      throw error;
    }
  };

  return {
    userRole,
    loading,
    hasRole,
    isAdmin,
    isModerator,
    assignRole,
    refetch: fetchUserRole,
  };
};