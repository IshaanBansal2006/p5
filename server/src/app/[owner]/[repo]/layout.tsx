import { redirect } from 'next/navigation';
import { isRepoRegistered } from '@/lib/repo-check';

interface RepoLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

export default async function RepoLayout({ children, params }: RepoLayoutProps) {
  const { owner, repo } = await params;
  
  // Check if the repository has been registered with P5
  const isRegistered = await isRepoRegistered(owner, repo);
  
  if (!isRegistered) {
    redirect('/repo-not-found');
  }
  
  return <>{children}</>;
}
