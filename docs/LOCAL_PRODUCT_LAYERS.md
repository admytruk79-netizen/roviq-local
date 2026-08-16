# ROVIQ Local product layers

ROVIQ Local stays simple for the traveler while the backend is designed to support additional controlled layers.

## Launch surface

- Map and List discovery
- Device geolocation and dynamic market/city
- All approved places by default
- Picks, Food, Coffee, Nature, Culture, Breweries
- Place detail and editorial `Why stop here?`
- Save
- Directions handoff
- Suggest a Spot
- Pending moderation and human approval

## Moderation foundation

Public submissions never imply automatic publication.

Flow:

`submission -> validation / duplicate assessment -> market routing -> pending queue -> authorized curator -> approve / edit / reject / request changes -> audit event -> public place`

Roles are geographically scoped. A city curator should only moderate assigned markets. Regional and super-admin roles can cover broader scopes.

## Trust states

Trust and commercial states are deliberately separate:

- **ROVIQ PICK**: editorial distinction. Not purchasable.
- **DRIVER'S PICK**: trusted contributor/driver-informed distinction. Not purchasable.
- **ROVIQ PARTNER**: commercial relationship. Does not buy editorial status.
- **VERIFIED LOCAL**: future evidence-based verification. The UI must state what was actually verified.
- **ROVIQ NETWORK**: future Station, charging, service or other ROVIQ infrastructure relationship.

## Commercial layer

A curated business may remain listed without paying. A business may separately claim its listing and apply to become a ROVIQ Partner.

Partner capabilities can later include:

- enhanced business profile controls;
- member / professional-driver / trusted-contributor offers;
- aggregated interest, directions and redemption analytics;
- ROVIQ Partner designation;
- future cross-domain ROVIQ network participation.

Payment never automatically grants ROVIQ Pick or Driver's Pick status.

## Contributor / driver layer

Contributors are not charged for contributing. Approved useful contributions can build reputation. Reputation initially affects moderation priority and eligibility for benefits rather than automatic publication.

Potential benefit audiences are represented in the offer model as `professional_driver` and `trusted_contributor`; integrations must not be hard-coded to one rideshare company.

## Consumer subscription layer

Core discovery remains useful for free.

A future `ROVIQ_LOCAL_PLUS` entitlement may unlock utility rather than ordinary map access, for example:

- advanced curated collections;
- multi-city guides;
- optional cross-device saved-place sync;
- offline collections;
- route / detour discovery;
- premium trip tools;
- selected member offers.

Entitlements are account-linked only when needed and must not require permanent travel-history storage.

## Journey advisory / safety layer

ROVIQ Local does not implement an unverified public blacklist.

Future Journey Advisories are narrow, evidence-based facts such as access restrictions, road closures, parking constraints, seasonal conditions, pedestrian-access issues or official advisories. Advisories have provenance, review state and expiry where appropriate.

## Verified Local layer

Verification must have a defined meaning. The system stores a verification statement and evidence reference so the UI can say what was checked (for example, address or license verification) rather than implying a general guarantee of safety or quality.

## Activation rule

Database/API boundaries can be prepared before a feature is exposed. Do not add dormant user-facing controls or large amounts of unused application code. Features become visible only when their workflow, moderation policy, security and operational owner are ready.
