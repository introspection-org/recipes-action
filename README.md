<div align="center">
  <a href="https://pi.recipes">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset=".github/images/logo-light.svg">
      <img alt="Recipes" src=".github/images/logo-light.svg" width="165">
    </picture>
  </a>
</div>

<h4 align="center">Validate Recipes in CI</h4>

<div align="center">
  <a href="https://pi.recipes"><img src="https://img.shields.io/badge/website-pi.recipes-blue" alt="Website"></a>
  <a href="https://github.com/introspection-org/recipes-action/actions/workflows/test.yml"><img src="https://github.com/introspection-org/recipes-action/actions/workflows/test.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@introspection-ai/cli"><img src="https://img.shields.io/badge/checker-introspection--cli-blue" alt="introspection CLI"></a>
  <a href="https://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/license-Apache%202.0-green" alt="License"></a>
</div>

<br>

A drop-in GitHub Action that validates a [Recipe](https://pi.recipes) in CI
with the official `introspection check` validator, wrapping
[`@introspection-ai/cli`](https://www.npmjs.com/package/@introspection-ai/cli).

By default it validates against the **latest published** CLI on every run, so
new validation rules are caught the moment they ship — no version bump to your
recipe required. Pin the CLI version when you want reproducible CI instead.

```yaml
name: recipe validation
on: [push, pull_request]
permissions:
  contents: read
jobs:
  recipe-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: introspection-org/recipes-action@v0
```

That's the whole workflow. The action runs `introspection check` and fails the
job on any validation error.

## What it checks

`introspection check` is the same validator that backs local development,
`introspection dev`, and `runtimes create`. It checks the portable Recipe
format plus the Introspection manifest and deployment readiness: the
`.introspection/<name>.yaml` manifest, agent YAML (required fields, `from`
inheritance, name conflicts, model specs), MCP tool policy, and skills. See
the [Recipes docs](https://pi.recipes/docs) for the full rule set.

## Usage

### Minimal

```yaml
- uses: actions/checkout@v4
- uses: introspection-org/recipes-action@v0
```

### Pin the CLI for reproducible CI

By default the action floats to the newest published CLI (`version: latest`).
Pin it if you'd rather opt out of automatic rule updates:

```yaml
- uses: introspection-org/recipes-action@v0
  with:
    version: 0.23.0
```

### A recipe in a subdirectory / monorepo

```yaml
- uses: introspection-org/recipes-action@v0
  with:
    recipe-dir: recipes/my-recipe
```

### Validate several recipes in one repo

```yaml
jobs:
  recipe-check:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        recipe: [recipes/a, recipes/b, recipes/c]
    steps:
      - uses: actions/checkout@v4
      - uses: introspection-org/recipes-action@v0
        with:
          recipe-dir: ${{ matrix.recipe }}
```

## Inputs

| Input           | Default                 | Description                                                                 |
| --------------- | ----------------------- | --------------------------------------------------------------------------- |
| `recipe-dir`    | `.`                     | Path to the recipe workspace to validate.                                   |
| `version`       | `latest`                | Version of `@introspection-ai/cli` to run. `latest` always uses the newest published CLI; pin an exact version for reproducible CI. |
| `node-version`  | `24`                    | Node.js version used to run the CLI (requires Node 24+).                    |
| `upload-report` | `true`                  | Upload the JSON diagnostics report as a build artifact (`recipe-check-report`), even on failure. |
| `comment`       | `true`                  | On a pull request, post the result as one comment, updated in place on each run. |
| `github-token`  | `${{ github.token }}`   | Token used to post that comment. |

## Output

Every diagnostic is surfaced five ways:

- **Pull request comment** — a table of every error and warning, with its
  location and fix, posted on the pull request and updated in place on each
  run. A passing run posts nothing unless an earlier run left a comment, which
  it then marks passed. It needs `pull-requests: write`:

  ```yaml
  permissions:
    contents: read
    pull-requests: write
  ```

  Without it (and on pull requests from forks, whose token is read-only) the
  comment is skipped with a notice.
- **Inline annotations** — the CLI emits each error/warning as a GitHub
  annotation, so it shows up on the offending file in the PR "Files changed"
  tab and the checks summary (with line/column when the diagnostic carries one).
- **Job summary** — the CLI writes a Markdown table of findings on the run's
  Summary page.
- **Step log** — a readable per-diagnostic listing in the action's log.
- **JSON artifact** — when `upload-report` is `true`, the full machine-readable
  report (`introspection check --output json`) is written to
  `recipe-check-report.json` and uploaded as the `recipe-check-report`
  artifact, on both passing and failing runs. When validating several recipes
  in a matrix, the artifact name is suffixed with the recipe path so runs
  don't collide.

The job fails (non-zero exit) whenever the recipe has any validation error.

## Versioning

> [!NOTE]
> This is a pre-1.0 (`v0.x`) line. Inputs may change between minor versions;
> pin an exact tag if you need stability.

Pin to the moving major tag to track the latest pre-1.0 build:

```yaml
uses: introspection-org/recipes-action@v0        # recommended: latest v0.x
uses: introspection-org/recipes-action@v0.2.0    # exact release
uses: introspection-org/recipes-action@<sha>     # fully locked
```

The `v0` tag is a moving pointer maintained at the newest `v0.x` release.
Pinning the **action** (`@v0`) is independent of pinning the **CLI**
(`version:` input): `@v0` tracks the action while `version` controls how fresh
the validation rules are.

## Run the same check locally

CI and local validation share one command. In a recipe repo:

```bash
npx -y -p @introspection-ai/cli introspection check
```

Recipe repos wire `introspection check` into a `.githooks/pre-commit` hook so
the same validation runs before every commit. This action is the CI backstop
that makes the check non-optional for every contributor.

## License

Apache-2.0 © Introspection AI Inc. See [LICENSE](LICENSE).
