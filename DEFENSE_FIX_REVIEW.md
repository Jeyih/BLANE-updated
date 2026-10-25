# Defense preparation review

Initial review before editing on 25 October 2026, against commit ede5fcc. Status updated on 25 October 2026 after the `defense fix` and `market fix` commits were pushed to GitHub.

## Current status

The original code findings below have been addressed in source. Export Week is restored, and market results are limited to records identified as Tarlac City. The latest recorded automated test run passed 78 tests, and the production build passed. These results do not establish that the deployed website, Supabase function or all 22 Appendix A cases have passed retesting.

| GitHub commit | Included changes | Status |
| --- | --- | --- |
| `26c6f52` — defense fix | Shared nutrition calculations, dietary checks, portion displays, account-specific browser storage, validation, AI request handling, seasonal labels and restored Export Week. | Pushed to `origin/master`. |
| `a451776` — market fix | Tarlac City market filtering, removal of unused outside-city presets, updated tour text and market-scope regression coverage. | Pushed to `origin/master`. |

## Original findings and corrections

The following table records the issues found before editing. The corrections are implemented in source; deployment and verification tasks remain listed separately below.

| Priority | Original code issue | Implemented correction |
| --- | --- | --- |
| Critical | Dashboard, recommendations and meal plan assume moderate activity; other routes use the selected activity. Goal adjustments also differ. | Share one calculation policy across routes. |
| Critical | Generation and manual plan changes do not consistently enforce dietary rules. Substring checks miss prepared-food components and confuse unrelated names. | Centralize eligibility checks, use word-aware matching, and expose composition uncertainty. |
| Critical | Applied portion state changes ingredients but not all displayed meal nutrients and daily totals. | Derive displayed nutrients and totals from the same saved scale. |
| Critical | Meal plans and portion/grocery state use browser keys shared by different accounts. | Scope browser state by authenticated account and remount account-dependent UI on switching. |
| High | Unknown season records are treated as year-round and fuzzy names can match unrelated foods. | Show unknown/incomplete classifications explicitly. |
| High | AI requests include full profile objects; optimizer trusts AI-provided targets and macro values. | Allowlist request fields, limit request duration, and recompute nutrition from recorded inputs. |
| High | Profile/onboarding validation accepts some negative or malformed measurements. | Validate finite, positive measurements and integer ages before saving. |

Additional findings during browser verification: the mood buttons claimed to change targets or log activity although they only set a temporary message; some recommendation reasons asserted medical suitability or nutrient properties absent from the stored records. Those messages were corrected without removing the controls. Health-log inputs also needed validation before they could update profile weight.

## Implemented and pushed

- Shared daily calorie and macro estimates now use the selected activity and the same goal policy across profile, dashboard, recommendations, feedback, meal plan and optimizer source. `manage_condition` has no automatic calorie deficit.
- Dietary eligibility checks cover automatic generation, recommendations, manual selection/swapping and affordable suggestions. Unknown restrictions and incomplete ingredient lists block selection when relevant. Polvoron and 3-in-1 milk-composition uncertainty is flagged for dairy restrictions. Singular/plural food names are checked without substring matches. Generated slots remain empty when no eligible recipe of that meal type exists. Existing saved plans are retained with conflict warnings. These are ingredient rules, not a clinical suitability certification.
- Applied portions drive meal-card nutrients, daily totals, estimated costs and newly added grocery quantities. Restoring the original portion removes the scale. Existing grocery entries are snapshots; add the meal again to refresh their quantities.
- Meal plans, completion state, portions and groceries use account-specific browser keys. Legacy unscoped records are preserved but are not assigned to a user automatically. This does not establish database authorization or cross-device synchronization.
- Unknown seasons are explicit and cannot receive a numeric completeness score. Food names must match the recorded seasonal name.
- AI profile requests omit account identity/contact fields; required nutrition and restriction fields are still transmitted. Portion values are derived from the stored base and validated scale rather than AI-reported totals. Requests have time limits and the portion route retains a local estimate on AI failure.
- Positive profile measurements and valid health-log values are checked before saving. Zero sleep/activity remains representable. Failed profile-weight updates no longer report full success.
- Latest recipe rotation/filtering and mobile layout are retained. Export Week was subsequently restored with current applied portions and estimate labels.
- Market lists, map markers, search/filter results and ingredient scanning use the same Tarlac City market list. Coverage is determined from an explicit city/municipality field or a city-specific address; province-only, missing and other-municipality locations are excluded. This is record-based filtering, not verification against an official city-boundary polygon. GPS and manual pins change distances without expanding the market list.

## Release and defense limits

The source changes are on GitHub. A GitHub push does not by itself verify a live release. No remote deployment has been performed or verified as part of this review. The `optimize-meal` Supabase function must be deployed separately with its shared module; a frontend build alone does not deploy it. No database migration was added. The generator still selects recipes by meal type; it does not jointly optimize a whole week against every calorie, budget and medical constraint. Nutrition calculations, ingredient composition and portions still require qualified review. AI explanations remain generated text and require fidelity evaluation. The Gemini provider quota remains an external limit; the portion interface retains a local estimate when AI is unavailable.

Password-reset delivery, two-account database isolation and the remaining partial/not-run appendix cases require separate recorded tests. This review does not turn historical failures into passes or attribute automated checks to IT-01.

## Remaining work

| Item | Required next action |
| --- | --- |
| Supabase release | Deploy the updated `optimize-meal` function with `_shared/nutrition.js`, then verify authenticated requests against the deployed version. |
| Live frontend | Confirm Netlify is serving the latest commit; retest export, portions, dietary blocking and Tarlac City market coverage. |
| Database authorization | Use two dedicated accounts to verify that each cannot read or modify the other's protected records. Browser-storage isolation is a separate check. |
| Password recovery | Record reset-email delivery, expired/invalid link handling and successful recovery through authorized test accounts. |
| Appendix evidence | Execute remaining partial/not-run cases and record actual outputs, dates, evidence and tester attribution. Update manuscript results only from those records. |
| Nutrition and AI review | Obtain qualified review of calculation assumptions, recipe serving bases, ingredient composition, dietary checks and explanation fidelity. |

Known limitations to describe accurately: existing grocery entries are snapshots and require re-adding the meal after a portion change; browser-local plans do not provide cross-device synchronization; weekly generation does not guarantee all nutrition, budget and medical constraints simultaneously. Expanding these behaviors is separate feature work, not evidence that the completed code fixes failed.

## Verification on 25 October 2026

- The initial defense-fix run passed 77 automated tests, including 23 added regression tests. The subsequent market-fix run passed 78 tests, adding coverage for city-specific records, outside municipalities and unclear addresses. These counts are separate from the 22 Appendix A black-box cases.
- Vite production build passed. The existing large JavaScript bundle warning remains; no performance timing claim follows from a successful build.
- Signed-in Sample account: profile, dashboard and meal plan displayed the same 2,147 kcal daily target; optimizer displayed 537 kcal per meal for four meals.
- Applied optimization changed the selected 413 kcal meal to 537 kcal and the day total from 1,672 to 1,796 kcal. Original Meal restored 413 and 1,672. No profile, health-log or recipe database records were changed during this check.
- Polvoron showed vegan/composition warnings in its recipe details and disabled both Use today and meal-plan selection. Saved sardines were also flagged for the vegan profile, with portion optimization disabled.
- A negative weight entry was rejected with a clear validation message before saving; the field was cleared afterward and the account remained at 65 kg with no health logs.
- Browser evidence: `BLANE-polvoron-warning-2026-10-25.png` and `BLANE-portion-fix-2026-10-25.png` in the task's visualization output directory.
- Export Week was restored and a browser download was verified as `BLANE_MealPlan_2026-10-19.txt`, containing the selected week's meal details and estimated price labels. The production build passed afterward. Screenshot evidence: `BLANE-export-restored.png` in the same visualization output directory.
- Market filtering passed automated regression coverage and the production build. A signed-in browser check of the latest market filtering and a deployed-site check remain pending.
- Both implementation commits listed above were pushed successfully. No remote deployment or SQL migration was performed as part of this review.

## Evidence that code cannot manufacture

Expert qualifications, questionnaire validation/piloting, respondent eligibility, clinical effectiveness, actual human tester attribution, two-account database authorization, password reset delivery and deployment results require genuine records or execution. Historical Appendix A results must remain dated observations; they must not be changed to Passed solely because source code changes.

This review is a status record, not authorization for deployment, database changes or future pushes. The two recorded GitHub pushes were separately requested by the user. Latest daily recipe rotation and mobile layouts are retained, and Export Week was restored at the user's request.
