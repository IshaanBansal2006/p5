'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Contributor {
  login: string;
  id: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface ContributorDisplayProps {
  assignee: string;
  owner: string;
  repo: string;
  className?: string;
  showContributions?: boolean;
}

export function ContributorDisplay({
  assignee,
  owner,
  repo,
  className = "",
  showContributions = false
}: ContributorDisplayProps) {
  const [contributor, setContributor] = useState<Contributor | null>(null);
  const [loading, setLoading] = useState(false);

  // Normalize assignee - use "unassigned" if empty or undefined
  const normalizedAssignee = assignee && assignee.trim() !== '' ? assignee : 'unassigned';

  // Fetch contributor info if assignee looks like a GitHub username
  useEffect(() => {
    const fetchContributor = async () => {
      if (!normalizedAssignee || normalizedAssignee === 'unassigned' || !owner || !repo) return;
      
      // Only fetch if assignee looks like a GitHub username (no spaces, special chars)
      if (!/^[a-zA-Z0-9_-]+$/.test(normalizedAssignee)) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/contributors?owner=${owner}&repo=${repo}`);
        
        if (response.ok) {
          const data = await response.json();
          const foundContributor = data.contributors?.find((c: Contributor) => c.login === normalizedAssignee);
          if (foundContributor) {
            setContributor(foundContributor);
          }
        }
      } catch (err) {
        console.error('Error fetching contributor:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContributor();
  }, [normalizedAssignee, owner, repo]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (contributor) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Avatar className="w-6 h-6">
          <AvatarImage src={contributor.avatarUrl} alt={contributor.login} />
          <AvatarFallback>{contributor.login.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {contributor.login}
          </span>
          {showContributions && (
            <span className="text-xs text-muted-foreground">
              {contributor.contributions} contributions
            </span>
          )}
        </div>
      </div>
    );
  }

  // Fallback for non-contributor assignees
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
        <span className="text-xs font-medium text-muted-foreground">
          {normalizedAssignee.charAt(0).toUpperCase()}
        </span>
      </div>
      <span className="text-sm font-medium text-foreground">{normalizedAssignee}</span>
    </div>
  );
}


