// Display copy only. Keep option keys and constraint-definition labels unchanged.
// Terminology references:
// https://www.niddk.nih.gov/health-information/digestive-diseases
// https://www.nhs.uk/symptoms/swallowing-problems-dysphagia/
// https://medlineplus.gov/phenylketonuria.html
// https://medlineplus.gov/genetics/condition/galactosemia/
const COPY = {
  diabetes_diabetic_diet: ['Diabetes', 'Includes a prescribed diabetic diet.'],
  gout_low_purine_diet: ['Gout', 'Includes a prescribed low-purine diet.'],
  chronic_kidney_disease_ckd_renal_diet: ['Long-term kidney disease (CKD)', 'Includes a prescribed kidney (renal) diet.'],
  ibs_low_fodmap_sensitivity: ['Irritable bowel syndrome (IBS)', 'Includes a prescribed low-FODMAP diet.'],
  hypertension_low_sodium: ['High blood pressure', 'Hypertension / a prescribed low-salt diet.'],
  high_cholesterol_low_fat: ['High cholesterol', 'Includes a prescribed low-fat diet.'],
  lactose_intolerance: ['Lactose intolerance', 'Difficulty digesting the sugar in milk.'],
  celiac_disease: ['Celiac disease', 'Gluten causes damage to the small intestine.'],
  gerd_acid_reflux: ['Acid reflux (GERD)', 'Stomach contents flow back into the food pipe.'],
  kidney_stones_calcium_oxalate: ['Kidney stones (calcium oxalate)', 'Choose if this type of kidney stone was diagnosed.'],
  phenylketonuria_pku: ['Phenylketonuria (PKU)', 'An inherited condition requiring a special diet.'],
  histamine_intolerance: ['Histamine intolerance', 'Choose if identified by your healthcare professional.'],
  cardiac_diet_low_sodium_low_fat: ['Heart-health diet', 'A prescribed low-salt, low-fat diet.'],
  bland_diet: ['Bland diet', 'Choose if your healthcare professional recommended this diet.'],
  low_fiber_low_residue_diet: ['Low-fiber diet', 'Includes a prescribed low-residue diet.'],
  dysphagia_diet_pureed_thickened_liquids: ['Swallowing difficulties (dysphagia)', 'Includes prescribed puréed foods or thickened drinks.'],
  low_tyramine_diet_maoi_antidepressants: ['Special diet for MAOI medicines', 'A prescribed low-tyramine diet for certain antidepressants.'],
  galactosemia_diet: ['Galactosemia', 'An inherited condition affecting how the body processes galactose, a sugar.'],
};

export const MEDICAL_CONDITION_GUIDANCE = 'Select conditions diagnosed by a healthcare professional or diets they recommended. Skip if none apply.';

export function medicalConditionCopy(option) {
  const copy = COPY[option.key];
  return {
    label: copy?.[0] || option.label || option.key,
    description: copy?.[1] || '',
  };
}
