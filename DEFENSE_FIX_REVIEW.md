# Defense preparation review

Initial review before editing on 25 October 2026, against commit ede5fcc. Status updated on 26 October 2026 after the Supabase deployment and authenticated live optimizer retest. The `defense fix` and `market fix` commits were pushed to GitHub on 25 October 2026.

## Current status

The original code findings below have been addressed in source. Export Week is restored, and market results are limited to records identified as Tarlac City. The latest recorded automated test run passed 80 tests, and the production build passed. Subsequent upstream changes removed the city-only guard; its restoration and reset-page feedback improvements are included in the `recovery fix` commit; live deployment remains to be verified. On 26 October 2026, `optimize-meal` and its shared module were deployed to Supabase, and the successful authenticated Gemini portion flow was retested through `https://blane.netlify.app/`. This does not establish that all 22 Appendix A cases or every AI failure scenario have passed retesting.

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

The source changes are on GitHub. A GitHub push does not by itself verify a live release. On 26 October 2026, the user authorized deployment of `optimize-meal` with `../_shared/nutrition.js` to Supabase project `jszolfwdnqxhppphzvhj`. Supabase reported a successful update, and both deployed files matched the committed source after a page reload. The signed-in live portion flow subsequently returned a Gemini result and passed the application/restoration checks below. No database migration was added. The generator still selects recipes by meal type; it does not jointly optimize a whole week against every calorie, budget and medical constraint. Nutrition calculations, ingredient composition and portions still require qualified review. AI explanations remain generated text and require fidelity evaluation. The Gemini provider quota remains an external limit; quota exhaustion was not forced during this successful-path retest.

Password recovery now has user-confirmed successful sign-in after resetting. Live database-role isolation checks passed as described below; full HTTP/account-switching checks and remaining partial/not-run appendix cases still require separate records. This review does not turn historical failures into passes or attribute automated checks to IT-01.

## Remaining work

| Item | Required next action |
| --- | --- |
| Supabase failure scenarios | Deployment and one successful authenticated portion request are verified. Separately record malformed-input, quota and connection-failure behavior against the deployed release. |
| Live frontend | Live portion application, daily totals and restoration were verified on 26 October. Confirm the deployed commit and finish live export, dietary-blocking and Tarlac City market checks. |
| Database authorization | Use two dedicated accounts to verify that each cannot read or modify the other's protected records. Browser-storage isolation is a separate check. |
| Password recovery | On 26 October the user confirmed reset-email receipt, submission of both password fields and successful fresh sign-in with the new password after retrying. The earlier failed attempt remains an observation; the full BB02 case still needs invalid/expired-link checks. Local confirmation/error-message improvements are not yet deployed. |
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

## Deployment and live retest on 26 October 2026

- Supabase dashboard reported `Successfully updated edge function` for `optimize-meal`. After reloading, `index.ts` and `../_shared/nutrition.js` matched the committed files. The previous function source was backed up before deployment.
- The function endpoint answered a CORS preflight with HTTP 204 and allowed `POST, OPTIONS`. This alone is not proof of a successful authenticated optimization; the live application test below provides that additional evidence.
- Test environment: production website `https://blane.netlify.app/`, signed-in Sample test account, in-app desktop browser. Recorded as an assisted retest, not automatically attributed to IT-01.
- Baseline: Bibingka, 351 kcal, 5.4 g protein, 79.3 g carbohydrates, 1.4 g fat, 150 g recorded ingredient weight, estimated cost PHP 24.68. It was the only assigned meal on the selected day; the schedule contained four meal slots.
- The live request completed in `GEMINI AI` mode, rather than falling back to the local estimate. Daily target remained 2,147 kcal; per-meal target was 537 kcal for the four scheduled slots. The returned scale was approximately 1.53.
- Applying the portion changed the meal card and day total to 537 kcal, with 8 g protein, 121 g carbohydrates and 2 g fat. Ingredient weight displayed 230 g and estimated meal cost PHP 37.76; the rounded day estimate was PHP 38. These are calculations from the recorded base, not a clinical validation of the recipe.
- `Original Meal` restored 351 kcal, 5.4 g protein, 150 g and PHP 24.68. Returning to the dashboard showed the original day total of 351 / 2,147 kcal and unchanged 65 kg profile weight. Meal assignments were left unchanged; no profile, health-log or recipe database records were modified during the retest.
- No defect was observed in this successful portion path. The test did not exhaust the AI quota, simulate an outage, validate nutrition suitability or complete the other Appendix A cases.
- Evidence in the task visualization directory: `supabase-deployment-2026-10-26.json`, `supabase-optimize-meal-deployed-2026-10-26.png`, `supabase-optimize-meal-before-2026-10-26.ts`, `BLANE-live-optimizer-applied-2026-10-26.png`, `BLANE-live-optimizer-proof-2026-10-26.png` and `BLANE-live-optimizer-retest-2026-10-26.json`.

## Additional verification on 26 October 2026

- Password recovery: the authorized inbox owner completed the reset privately and confirmed, “i already did this, and tried the new password, it works now.” Record the successful recovery as user-confirmed; the agent did not enter or inspect the password. The first attempt did not produce a working new password, and the cause was not established. Do not infer a server defect from the absence of a visible update request in the inspected logs. Invalid-login rejection was also observed. Invalid/expired-link behavior remains to be checked separately before closing all of BB02.
- Local reset-page changes keep success confirmation visible, show link-check errors, focus validation errors and report a long wait for confirmation. The auth helper checks the returned account before showing success. These changes are included in `recovery fix`, with live deployment unverified, and are not the basis for the user's successful live retry.
- Latest upstream changes through `03fc2c1` were retained, including database-backed price references. Those changes removed the city-only guard; the local patch restores it while preserving the new pricing work. Production city-only filtering still needs verification after deployment.
- The latest automated run passed 80 tests with zero failures, and the production build passed after the reset-page changes. The existing large-bundle warning remains. These are not the 22 Appendix A execution records.
- Live weekly export contained seven days for 26 October–1 November, current meal details and estimate labels. Market search found the selected market, an unmatched search showed zero results and markers, and clearing/filtering restored the expected list. Manual map pin placement changed the displayed origin and distances. GPS denial and delayed GPS handling remain separate scenarios.
- Live database checks used explicitly selected authenticated/anonymous database roles with test identity claims. Both test identities saw their own fixture records and were prevented from reading or changing the other's protected fixtures. Anonymous reads returned none. Fixtures and test writes were rolled back. This checks RLS execution, not HTTP token validation or the complete account-switching workflow.
- With the user's explicit approval, the verified Sample account was added to the catalogue administrator registry; the existing administrator remained. The registry now contains two administrators. Subsequent rollback-only checks allowed Sample catalogue updates and denied the ordinary account's catalogue updates while preserving private-record isolation. Actual administrator browser create/edit/delete checks remain pending. The administrator grant was retained intentionally; it was not a disposable fixture.
- Evidence: `BLANE-rls-retest-2026-10-26.json`, `BLANE-admin-grant-2026-10-26.json`, `BLANE-rls-admin-retest-2026-10-26.json` and `BLANE-admin-isolation-proof-2026-10-26.png` in the task visualization directory. These checks do not certify all 22 cases or nutrition suitability.

## Evidence that code cannot manufacture

Expert qualifications, questionnaire validation/piloting, respondent eligibility, clinical effectiveness, actual human tester attribution, two-account database authorization, password reset delivery and deployment results require genuine records or execution. Historical Appendix A results must remain dated observations; they must not be changed to Passed solely because source code changes.

This review is a status record, not authorization for deployment, database changes or future pushes. The earlier GitHub pushes and the `recovery fix` push were separately requested by the user. Latest daily recipe rotation and mobile layouts are retained, and Export Week was restored at the user's request.
