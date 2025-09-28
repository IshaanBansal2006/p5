'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, ChevronDown } from 'lucide-react';

interface Contributor {
  login: string;
  id: number;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

interface ContributorSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  owner: string;
  repo: string;
  className?: string;
}

export function ContributorSelect({
  value,
  onChange,
  placeholder = "Select or type assignee",
  label = "Assignee",
  owner,
  repo,
  className = ""
}: ContributorSelectProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch contributors when component mounts or owner/repo changes
  useEffect(() => {
    const fetchContributors = async () => {
      if (!owner || !repo) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/contributors?owner=${owner}&repo=${repo}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch contributors');
        }
        
        const data = await response.json();
        setContributors(data.contributors || []);
      } catch (err) {
        console.error('Error fetching contributors:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch contributors');
      } finally {
        setLoading(false);
      }
    };

    fetchContributors();
  }, [owner, repo]);

  // Filter contributors based on input value
  const filteredContributors = contributors.filter(contributor =>
    contributor.login.toLowerCase().includes(value.toLowerCase())
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(newValue.length > 0);
  };

  // Handle contributor selection
  const handleContributorSelect = (contributor: Contributor) => {
    onChange(contributor.login);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (value.length > 0) {
      setIsOpen(true);
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if current value is a valid contributor
  const isValidContributor = contributors.some(c => c.login === value);
  const selectedContributor = contributors.find(c => c.login === value);

  return (
    <div className={`relative ${className}`}>
      <Label htmlFor="assignee">{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          id="assignee"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {error ? (
            <div className="p-3 text-sm text-red-600">
              {error}
            </div>
          ) : filteredContributors.length > 0 ? (
            filteredContributors.map((contributor) => (
              <div
                key={contributor.id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleContributorSelect(contributor)}
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={contributor.avatarUrl} alt={contributor.login} />
                  <AvatarFallback>{contributor.login.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {contributor.login}
                  </div>
                  <div className="text-xs text-gray-500">
                    {contributor.contributions} contributions
                  </div>
                </div>
                {value === contributor.login && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </div>
            ))
          ) : (
            <div className="p-3 text-sm text-gray-500">
              {value.length > 0 ? 'No contributors found' : 'Type to search contributors'}
            </div>
          )}
        </div>
      )}

      {/* Show selected contributor info */}
      {selectedContributor && (
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage src={selectedContributor.avatarUrl} alt={selectedContributor.login} />
            <AvatarFallback>{selectedContributor.login.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-600">
            {selectedContributor.login} ({selectedContributor.contributions} contributions)
          </span>
        </div>
      )}

      {/* Show warning if not a valid contributor but not empty */}
      {value && !isValidContributor && (
        <div className="mt-1 text-xs text-amber-600">
          Custom assignee (not a GitHub contributor)
        </div>
      )}
    </div>
  );
}


