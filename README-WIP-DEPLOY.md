# WIP Intelligence Center deployment

Upload these files to the repository root:

- `index.html` (updated navigation and module card)
- `wip-intelligence.html`
- `wip-data.json`

The page uses the same GitHub Pages root structure as the existing platform.

## Business rules in V1

- PO Tracker is the scope master.
- Excluded product classes: BAGS, HEADWEAR, MISC AXS.
- Fabric requirement: `Main Material Supplier Ref # (DCC)` equals Fabric Records `Article #`.
- eFiling requirement: `Loc #` contains `US` after normalization.
- Non-US locations display `N/A`, not Missing.
