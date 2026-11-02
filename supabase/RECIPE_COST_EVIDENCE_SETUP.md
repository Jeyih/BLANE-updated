# Recipe costing evidence

The local frontend includes three FAO/INFOODS density conversions: soy sauce (1.12 g/ml), corn oil (0.922 g/ml) and liquid milk (1.03 g/ml). These remain generic reference estimates. Exact metric volumes take priority. No fixed prices or invented cooking yields were added.

Admin → Markets → **Recipe costing evidence** lists the 46 reviewed ingredient names and their remaining evidence tasks. The list reflects the research review; current usage status comes from loaded catalogue records.

To save quantity evidence, apply `migrations/202611010003_recipe_cost_evidence.sql` after the existing administrator registry and price-reference migrations. This migration has not been applied to the hosted database. Without it, the review list and density conversions work, but saves are rejected and the form explains the missing setup.

Only catalogue administrators may save or remove records in the `recipe_cost_basis` category. Prices remain automatically sourced. Evidence and recipe metadata are public catalogue data: do not include personal information or secrets.

Record purchase amounts corresponding to the ingredient's displayed nutrition grams, not an unallocated batch total. For cooking yields, retain the purchase weight, cooked output and allocation calculation in the evidence notes/reference. Exact product URL, ingredient identity, grams and recipe quantity must still match; otherwise the saved basis is ignored. Partial component dishes and substitute species/cuts cannot be cleared through this form.

No existing recipe, hosted price, source parser or live deployment was changed by this setup. The 43 other ingredient names still need their applicable measurement, product match or component recipe evidence; some may already have supported usages through existing FNRI portion references.
