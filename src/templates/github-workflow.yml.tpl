name: P5 CI
on:
  pull_request:
  push:
    branches: [ main, master ]
jobs:
  p5:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci || npm i
      - run: npx playwright install --with-deps
      - run: npx p5 test --stage ci
      - name: Sync README (main only)
        if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
        run: npx p5 readme sync
      - name: Post Failure Comment
        if: failure() && github.event_name == 'pull_request'
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: node -e "import('./dist/index.js').then(m=>m.default?.postCiFailure?.()).catch(()=>{})"
