const fetch = require('node-fetch');

async function testContributors() {
  try {
    // Test with a known repository
    const owner = 'isaacbansal'; // Replace with actual owner
    const repo = 'p5'; // Replace with actual repo
    
    console.log(`Testing contributor data for ${owner}/${repo}...`);
    
    // Test the debug endpoint
    const debugResponse = await fetch(`http://localhost:3000/api/debug-contributors?owner=${owner}&repo=${repo}`);
    const debugData = await debugResponse.json();
    
    console.log('\n=== DEBUG DATA ===');
    console.log('Total commits:', debugData.totalCommits);
    console.log('Total contributors:', debugData.totalContributors);
    console.log('\nSample commits:');
    debugData.sampleCommits.forEach((commit, i) => {
      console.log(`${i + 1}. ${commit.author} - +${commit.additions} -${commit.deletions} (${commit.files} files)`);
    });
    
    console.log('\nContributor stats:');
    debugData.contributorStats.forEach(contributor => {
      console.log(`${contributor.name}: ${contributor.commits} commits, +${contributor.additions} -${contributor.deletions} (${contributor.files} files)`);
    });
    
    console.log('\nGitHub contributors:');
    debugData.githubContributors.forEach(contributor => {
      console.log(`${contributor.login}: ${contributor.contributions} contributions`);
    });
    
    // Test the main stats endpoint
    const statsResponse = await fetch(`http://localhost:3000/api/stats?owner=${owner}&repo=${repo}`);
    const statsData = await statsResponse.json();
    
    console.log('\n=== MAIN STATS DATA ===');
    console.log('Recent commits:');
    statsData.recentCommitHistory.slice(0, 5).forEach((commit, i) => {
      console.log(`${i + 1}. ${commit.author} - +${commit.additions} -${commit.deletions}`);
    });
    
    console.log('\nContributor stats:');
    statsData.contributorStats.forEach(contributor => {
      console.log(`${contributor.name}: ${contributor.commits} commits, +${contributor.additions} -${contributor.deletions}`);
    });
    
  } catch (error) {
    console.error('Error testing contributors:', error);
  }
}

testContributors();
