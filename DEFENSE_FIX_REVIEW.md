# Defense preparation review

Reviewed before editing on 25 October 2026, against commit ede5fcc.

| Priority | Confirmed code issue | Planned correction |
| --- | --- | --- |
| Critical | Dashboard, recommendations and meal plan assume moderate activity; other routes use the selected activity. Goal adjustments also differ. | Share one calculation policy across routes. |
| Critical | Generation and manual plan changes do not consistently enforce dietary rules. Substring checks miss prepared-food components and confuse unrelated names. | Centralize eligibility checks, use word-aware matching, and expose composition uncertainty. |
| Critical | Applied portion state changes ingredients but not all displayed meal nutrients and daily totals. | Derive displayed nutrients and totals from the same saved scale. |
| Critical | Meal plans and portion/grocery state use browser keys shared by different accounts. | Scope browser state by authenticated account and remount account-dependent UI on switching. |
| High | Unknown season records are treated as year-round and fuzzy names can match unrelated foods. | Show unknown/incomplete classifications explicitly. |
| High | AI requests include full profile objects; optimizer trusts AI-provided targets and macro values. | Allowlist request fields, limit request duration, and recompute nutrition from recorded inputs. |
| High | Profile/onboarding validation accepts some negative or malformed measurements. | Validate finite, positive measurements and integer ages before saving. |

Additional findings during browser verification: the mood buttons claimed to change targets or log activity although they only set a temporary message; some recommendation reasons asserted medical suitability or nutrient properties absent from the stored records. Those messages were corrected without removing the controls. Health-log inputs also needed validation before they could update profile weight.

## Implemented locally

- Shared daily calorie and macro estimates now use the selected activity and the same goal policy across profile, dashboard, recommendations, feedback, meal plan and optimizer source. `manage_condition` has no automatic calorie deficit.
- Dietary eligibility checks cover automatic generation, recommendations, manual selection/swapping and affordable suggestions. Unknown restrictions and incomplete ingredient lists block selection when relevant. Polvoron and 3-in-1 milk-composition uncertainty is flagged for dairy restrictions. Singular/plural food names are checked without substring matches. Generated slots remain empty when no eligible recipe of that meal type exists. Existing saved plans are retained with conflict warnings. These are ingredient rules, not a clinical suitability certification.
- Applied portions drive meal-card nutrients, daily totals, estimated costs and newly added grocery quantities. Restoring the original portion removes the scale. Existing grocery entries are snapshots; add the meal again to refresh their quantities.
- Meal plans, completion state, portions and groceries use account-specific browser keys. Legacy unscoped records are preserved but are not assigned to a user automatically. This does not establish database authorization or cross-device synchronization.
- Unknown seasons are explicit and cannot receive a numeric completeness score. Food names must match the recorded seasonal name.
- AI profile requests omit account identity/contact fields; required nutrition and restriction fields are still transmitted. Portion values are derived from the stored base and validated scale rather than AI-reported totals. Requests have time limits and the portion route retains a local estimate on AI failure.
- Positive profile measurements and valid health-log values are checked before saving. Zero sleep/activity remains representable. Failed profile-weight updates no longer report full success.
- Latest recipe rotation/filtering and mobile layout are retained. Export Week was subsequently restored with current applied portions and estimate labels.

## Release and defense limits

These are local source changes. The `optimize-meal` Supabase function must be deployed separately with its shared module; a frontend build alone does not deploy it. No database migration was added. The generator still selects recipes by meal type; it does not jointly optimize a whole week against every calorie, budget and medical constraint. Nutrition calculations, ingredient composition and portions still require qualified review. AI explanations remain generated text and require fidelity evaluation.

Password-reset delivery, two-account database isolation and the remaining partial/not-run appendix cases require separate recorded tests. This review does not turn historical failures into passes or attribute automated checks to IT-01.

## Verification on 25 October 2026

- 77 automated tests passed, including 23 added regression tests. This count is separate from the 22 Appendix A black-box cases.
- Vite production build passed. The existing large JavaScript bundle warning remains; no performance timing claim follows from a successful build.
- Signed-in Sample account: profile, dashboard and meal plan displayed the same 2,147 kcal daily target; optimizer displayed 537 kcal per meal for four meals.
- Applied optimization changed the selected 413 kcal meal to 537 kcal and the day total from 1,672 to 1,796 kcal. Original Meal restored 413 and 1,672. No profile, health-log or recipe database records were changed during this check.
- Polvoron showed vegan/composition warnings in its recipe details and disabled both Use today and meal-plan selection. Saved sardines were also flagged for the vegan profile, with portion optimization disabled.
- A negative weight entry was rejected with a clear validation message before saving; the field was cleared afterward and the account remained at 65 kg with no health logs.
- Browser evidence: `BLANE-polvoron-warning-2026-10-25.png` and `BLANE-portion-fix-2026-10-25.png` in the task's visualization output directory.
- Latest source UI changes remain present. No Git commit, push, remote deployment or SQL migration was performed.

## Evidence that code cannot manufacture

Expert qualifications, questionnaire validation/piloting, respondent eligibility, clinical effectiveness, actual human tester attribution, two-account database authorization, password reset delivery and deployment results require genuine records or execution. Historical Appendix A results must remain dated observations; they must not be changed to Passed solely because source code changes.

No deployment, database mutation, migration, commit or push is authorized by this review. Latest daily recipe rotation and mobile layouts are to be retained. Export Week was subsequently restored at the user's request.
