# MP-02 roster reconciliation 2026/27

Preseason roster authority: EliteProspects. HockeyLive/NIF remains authoritative for person IDs and game data once available.

Reviewed identity aliases are explicit EP-name -> NIF external-id mappings, never fuzzy matches. Exact duplicate names across historical rows prefer a single active/current row carrying a real `nif:` identity over inactive legacy duplicates. Position disagreements remain visible for explicit correction.

The remaining unresolved EP players after reviewed aliases are expected to be genuinely absent from `fantasy_players` and must not be assigned a guessed NIF ID. They require a safe provisional identity strategy or later NIF enrichment before final production reconciliation.

Production correction is blocked until the reconciliation preview has zero ambiguous identities and every unresolved EP player is explicitly handled as either an existing reviewed identity or a genuinely new player.
