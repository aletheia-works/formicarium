# Automated releases

Release automation follows vivarium and terrarium: release-please updates a
release PR from Conventional Commits. A merged release PR creates a tag and
GitHub Release. The tag triggers the existing verified npm OIDC publication.
Release-please owns the changelog and release notes; publish.yml attaches the
verified tarball to an existing release, retaining manual RC release support.

The node release strategy uses package.json as the version source, matching
vivarium. The initial manifest baseline is the published 0.1.0. Release-please
updates package.json and creates the matching v<version> tag and GitHub Release.
No version.txt is used. The root package remains private.

## Enablement

Automation is disabled by default. Apply the infra/github plan only after
reviewing the new labels and variables. Supply the existing organisation
aletheia-works-bot credentials BOT_CLIENT_ID (variable) and BOT_PRIVATE_KEY
(secret); do not put credentials in source control. The App needs Contents,
Issues and Pull requests write on this repository. Its token lets generated
PRs and tag pushes trigger other Actions workflows.

RELEASE_AUTOMATION_ENABLED enables release PR generation and tag creation.
WEEKLY_RELEASE_MERGE_ENABLED separately enables Monday 00:23 UTC / 09:23 JST
auto-merge. The job selects exactly one non-draft, same-repository release PR
from app/aletheia-works-bot and matches its current head. Required checks and
branch protection remain authoritative. Keep weekly merging disabled until
candidate preparation and terrarium acceptance are ready for the next version.

## Candidate preparation and acceptance

The existing release gate remains mandatory: candidate-bound human approval,
native/Node/browser regression, fixed-inventory coverage >=80%, published RC
terrarium acceptance and stable/RC diff checks. Release-please cannot produce
these external acceptance results or authorize publication.

The release input URL/SHA variables still refer to the 0.1.0 input. Before a
future release, regenerate candidate evidence for the exact tagged source and
version and update the reviewed inputs. A stale input fails closed. Automatic
candidate input generation is not implemented by these release workflows.
Do not enable weekly merging while this preparation is manual: GitHub Release
creation precedes npm verification, so an unprepared release can have a tag and
GitHub Release while npm publication is blocked.

The current npm command does not retry publication of an existing version.
Inspect the registry before recovering a failed run. No existing tag or release
asset is overwritten. Stable publishes latest; RC publishes next.
