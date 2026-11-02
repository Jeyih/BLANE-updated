# Meal and profile updates — local preparation, 1 November 2026

These changes have not been applied to the hosted Supabase database or deployed to Netlify.

## Database updates required

Apply these migrations in order when deployment is authorized:

1. `migrations/202610310001_profile_health_goals.sql`: adds up to three saved health goals while preserving the primary goal.
2. `migrations/202611010001_profile_sex_privacy_choice.sql`: permits `prefer_not_to_say` without changing existing profile values. Calorie personalization remains disabled for that choice.
3. `migrations/202611010002_private_meal_state_sync.sql`: creates private, account-owned meal-state storage and a revision-checked save function.

The sync table stores weekly plans, completion marks, applied portions and grocery sources. Authenticated clients can select their own rows. Writes go through `save_private_meal_state`, which verifies both authenticated identity and the expected revision. Direct client inserts, updates and deletes are not granted. Account deletion removes the associated state.

No new privileged credential belongs in the frontend. The sync client uses the existing authenticated Supabase session.

## Browser behavior

- The initial account read happens before protected pages mount, with an eight-second request timeout and a device-cache fallback.
- Local changes are saved on the device and queued for account saving. Retry runs on reconnection, focus and every 30 seconds while the page is open.
- A conflicting account version is never silently overwritten. Users choose the account version or this device's version for the conflicting records. Weekly plans are one record containing the saved weeks; the choice covers that record, not an automatic merge of individual slots.
- Portions and grocery records now also persist in account-scoped local storage. Existing session records remain available during migration.
- Reset-password and other public routes do not wait for meal sync.
- Browser storage access is still required for offline edits. This is not complete offline authentication or an offline database.

## Planner and pricing behavior

Budgets divide by the actual selected day's slot count. Cheapest Planned Day sums one eligible, completely priced candidate for every actual slot, including repeated types. Custom categories use their assigned recipe if no matching category exists. Missing categories and incomplete price evidence remain explicit; no guessed quote is substituted.

Generation improves daily calorie/budget totals using eligible recipes and preserves existing slot schedules during regeneration. Day and week checks report unassigned slots, missing calorie data, incomplete prices, calorie deviation beyond 10%, and estimates above the daily budget. The 10% band is a planning guide, not a clinical threshold or a guarantee that all constraints can be satisfied. Review failed checks and adjust meals or portions.

Plain-language entries exactly matching supported dietary rules are recognized. Unsupported entries remain saved and block automatic selection; users may explicitly replace them with a matching supported option. AI does not approve unknown allergy safety.

For price persistence, the Netlify owner still needs the server-only writer configuration described in `PRICE_REFERENCE_SETUP.md`. A successful supplier fetch now remains available even if its database save fails, with a persistence warning and retry. This does not manufacture missing prices, raw/cooked yields or measurements. Those require valid product/quantity evidence before a complete estimate can be shown.

## Verification

The temporary local database-check scripts are maintained separately from the application source. Verify hosted configuration and policies after deployment; local checks alone do not establish hosted behavior.
