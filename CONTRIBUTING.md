# Contributing

Issues and pull requests are welcome.

1. Fork the repository and create a focused branch.
2. Keep the analyzer deterministic and dependency-free unless a dependency has a clear benefit.
3. Add or update tests for rule changes.
4. Run `npm test` with a current Node.js release.
5. Describe user-visible behavior and potential false positives in the pull request.

Semantic groups should remain conservative. A term should only be added when using it with another term in the same group is commonly redundant; creative concepts should not be automatically removed.
