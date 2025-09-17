import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgreementVersion {
  id: string;
  type: 'terms' | 'privacy';
  version: string;
  content: string;
  effective_date: string;
  created_at: string;
}

interface UserAgreement {
  id: string;
  user_id: string;
  agreement_type: 'terms' | 'privacy';
  version: string;
  accepted_at: string;
  ip_address?: string;
  user_agent?: string;
}

export const useLegalAgreements = () => {
  const { user } = useAuth();
  const [userAgreements, setUserAgreements] = useState<UserAgreement[]>([]);
  const [currentVersions, setCurrentVersions] = useState<AgreementVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentVersions();
    if (user) {
      fetchUserAgreements();
    } else {
      setUserAgreements([]);
      setLoading(false);
    }
  }, [user]);

  const fetchCurrentVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('agreement_versions')
        .select('*')
        .order('effective_date', { ascending: false });

      if (error) throw error;

      // Get latest version for each type
      const latestVersions: AgreementVersion[] = [];
      const seenTypes = new Set();
      
      data.forEach((version: any) => {
        if (!seenTypes.has(version.type)) {
          latestVersions.push(version as AgreementVersion);
          seenTypes.add(version.type);
        }
      });

      setCurrentVersions(latestVersions);
    } catch (error) {
      console.error('Error fetching agreement versions:', error);
      toast.error('Failed to fetch agreement versions');
    }
  };

  const fetchUserAgreements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_agreements')
        .select('*')
        .eq('user_id', user!.id)
        .order('accepted_at', { ascending: false });

      if (error) throw error;
      setUserAgreements((data as UserAgreement[]) || []);
    } catch (error) {
      console.error('Error fetching user agreements:', error);
      toast.error('Failed to fetch user agreements');
    } finally {
      setLoading(false);
    }
  };

  const acceptAgreement = async (type: 'terms' | 'privacy', version: string) => {
    try {
      // Get user's IP and user agent
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      const { error } = await supabase
        .from('user_agreements')
        .insert({
          user_id: user!.id,
          agreement_type: type,
          version: version,
          ip_address: ipData.ip,
          user_agent: navigator.userAgent,
        });

      if (error) throw error;

      await fetchUserAgreements();
      return true;
    } catch (error) {
      console.error('Error accepting agreement:', error);
      toast.error(`Failed to accept ${type} agreement`);
      return false;
    }
  };

  const hasAcceptedLatest = (type: 'terms' | 'privacy'): boolean => {
    const latestVersion = currentVersions.find(v => v.type === type);
    if (!latestVersion) return false;

    const userAgreement = userAgreements.find(
      a => a.agreement_type === type && a.version === latestVersion.version
    );
    
    return !!userAgreement;
  };

  const getLatestVersion = (type: 'terms' | 'privacy'): AgreementVersion | undefined => {
    return currentVersions.find(v => v.type === type);
  };

  const getUserAgreement = (type: 'terms' | 'privacy'): UserAgreement | undefined => {
    return userAgreements.find(a => a.agreement_type === type);
  };

  return {
    userAgreements,
    currentVersions,
    loading,
    acceptAgreement,
    hasAcceptedLatest,
    getLatestVersion,
    getUserAgreement,
    refetch: () => {
      fetchCurrentVersions();
      if (user) fetchUserAgreements();
    },
  };
};