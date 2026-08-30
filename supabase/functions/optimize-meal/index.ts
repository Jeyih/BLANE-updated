// ============================================================
// BLANE — Portion Optimizer Edge Function (Gemini-powered)
// Receives: { meal, profile, totalMealsToday }
// Returns: exact ingredient amounts and macro-adjusted meal plan
// ============================================================

import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIVITY_MULT: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const GOAL_ADJUST: Record<string, number> = {
  lose_weight: 0.85,
  gain_muscle: 1.1,
  maintain: 1.0,
  improve_health: 1.0,
  boost_energy: 1.0,
  manage_condition: 0.9,
};

const MACRO_TARGETS = { protein: 0.3, carbs: 0.45, fats: 0.25 };
const GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function computeDailyTargets(profile: any) {
  const h = Number(profile?.height_cm) || 170;
  const w = Number(profile?.weight_kg) || 70;
  const age = Number(profile?.age) || 25;
  const sex = profile?.sex || "male";
  const bmr = sex === "male" ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const actKey = String(profile?.activity_level || "").toLowerCase();
  const goalKey = String(profile?.goal || "").toLowerCase();
  const tdee = bmr * (ACTIVITY_MULT[actKey] || 1.55);
  const calTarget = Math.round(tdee * (GOAL_ADJUST[goalKey] || 1.0));

  return {
    calories: calTarget,
    protein: Math.round((calTarget * MACRO_TARGETS.protein) / 4),
    carbs: Math.round((calTarget * MACRO_TARGETS.carbs) / 4),
    fats: Math.round((calTarget * MACRO_TARGETS.fats) / 9),
  };
}

function parseFraction(str: string) {
  const fracts: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 0.333, "⅔": 0.667 };
  if (fracts[str]) return fracts[str];
  if (str.includes("/")) {
    const parts = str.split("/");
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }
  return Number(str) || 0;
}

function formatCup(val: number) {
  const rounded = Math.round(val * 100) / 100;
  if (rounded >= 0.875) return String(Math.round(rounded));
  if (rounded >= 0.625) return "¾";
  if (rounded >= 0.375) return "½";
  if (rounded >= 0.175) return "¼";
  if (rounded % 1 === 0) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function scaleQtyString(qtyStr: string | undefined, factor: number) {
  if (!qtyStr || qtyStr === "to taste") return qtyStr || "";

  const match = qtyStr.match(/^([\d./½¼¾⅓⅔]+)\s*(.*)/);
  if (!match) return qtyStr;

  let num = parseFraction(match[1]);
  const unit = match[2].trim();
  if (Number.isNaN(num) || num === 0) return qtyStr;

  const scaled = num * factor;
  let formatted: string;

  if (["pcs", "pc", "cloves", "slices", "stalks"].includes(unit)) {
    const rounded = Math.round(scaled * 2) / 2;
    formatted = rounded % 1 === 0.5 ? rounded.toFixed(1) : String(Math.round(rounded));
  } else if (unit === "cup" || unit === "cups") {
    formatted = formatCup(scaled);
  } else if (unit === "tbsp" || unit === "tsp") {
    const rounded = Math.round(scaled * 4) / 4;
    formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  } else {
    const rounded = Math.round(scaled / 5) * 5 || Math.round(scaled);
    formatted = String(rounded);
  }

  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

function scaleIngredient(ing: any, factor: number) {
  const isStr = typeof ing === "string";
  const name = isStr ? ing : ing?.name || "Ingredient";
  const original = isStr ? ing : ing?.original || ing?.qty || "";
  const optimized = ing?.optimized || scaleQtyString(original, factor);

  return {
    name,
    original,
    optimized,
    factor,
    changed: Math.abs(factor - 1) > 0.05,
    increased: factor > 1.05,
    decreased: factor < 0.95,
  };
}

function buildPrompt(meal: any, profile: any, totalMealsToday: number) {
  const daily = computeDailyTargets(profile);
  const perMealKcal = Math.round(daily.calories / totalMealsToday);
  const originalKcal = Number(meal?.kcal) || 0;
  const scaleHint = Math.max(0.5, Math.min(2.0, perMealKcal / Math.max(originalKcal, 1)));

  return `
You are BLANE AI, a nutrition optimizer for a Filipino meal-planning app.

User profile:
- sex: ${profile?.sex || 'male'}
- age: ${profile?.age || 25}
- height_cm: ${profile?.height_cm || 170}
- weight_kg: ${profile?.weight_kg || 70}
- activity_level: ${profile?.activity_level || 'moderate'}
- goal: ${profile?.goal || 'maintain'}

Meal:
- name: ${meal?.name || 'Meal'}
- type: ${meal?.type || 'meal'}
- kcal: ${meal?.kcal || 0}
- protein: ${meal?.protein || 0}
- carbs: ${meal?.carbs || 0}
- fats: ${meal?.fats || 0}
- ingredients: ${JSON.stringify(meal?.ingredients || [])}

Nutrition target:
- daily calories: ${daily.calories} kcal
- daily protein: ${daily.protein} g
- daily carbs: ${daily.carbs} g
- daily fats: ${daily.fats} g
- meals_today: ${totalMealsToday}
- per_meal_target: ${perMealKcal} kcal

Return ONLY valid JSON matching this exact schema:
{
  "scaleFactor": number,
  "reason": "brief human explanation",
  "daily": { "calories": number, "protein": number, "carbs": number, "fats": number },
  "original": { "protein": number, "carbs": number, "fats": number },
  "optimized": { "protein": number, "carbs": number, "fats": number },
  "targets": { "protein": number, "carbs": number, "fats": number, "calories": number },
  "ingredients": [
    { "name": string, "original": string, "optimized": string, "factor": number, "changed": boolean, "increased": boolean, "decreased": boolean }
  ]
}

Important rules:
1. Use the user's calorie and macro targets to decide a realistic scaleFactor.
2. Keep the scaleFactor between 0.5 and 2.0.
3. The final scaleFactor should be close to: ${scaleHint.toFixed(3)}
4. Apply the same factor to every ingredient quantity.
5. Preserve the unit (cup, tbsp, tsp, pcs, etc.) in the optimized ingredient amounts.
6. Ensure the optimized macros stay realistic and align with the target per-meal calories.
7. If the meal is already close to the target, keep the scaleFactor near 1.0.
8. Explain in plain language why the adjustment is needed for this user's goals.
9. Keep all numeric values as integers where possible and return a clean JSON object without markdown.
10. DO NOT invent ingredients not in the meal.
`;
}

function buildSuggestionPrompt(profile: any, budget: number, mealType: string, fnriFoods: any[], constraints: any[]) {
  const daily = computeDailyTargets(profile);
  const conditionList = [
    ...(profile?.dietary_restrictions || []),
    ...(profile?.medical_conditions || []),
    ...(profile?.allergies || []),
  ];

  return `
You are BLANE AI, a Filipino nutrition assistant. Suggest one affordable ${mealType || 'meal'} using ONLY foods from the FNRI food reference below.

User profile:
- goal: ${profile?.goal || 'maintain'}
- dietary restrictions: ${JSON.stringify(conditionList)}
- medical conditions: ${JSON.stringify(profile?.medical_conditions || [])}
- daily calorie target: ${daily.calories} kcal
- budget for this meal: PHP ${Math.max(0, Number(budget) || 0)}

Constraint guidance from BLANE:
${JSON.stringify(constraints)}

FNRI foods (nutrition values are per 100g; use these names and values as the source of truth):
${JSON.stringify(fnriFoods)}

Return ONLY valid JSON:
{
  "name": string,
  "reason": string,
  "estimatedCost": number,
  "kcal": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "ingredients": [{ "name": string, "quantity": string, "fct_id": string }],
  "fnriBasis": [{ "name": string, "fct_id": string, "energy_kcal": number, "protein_g": number, "available_carbohydrate_g": number, "total_fat_g": number }]
}

Rules:
1. Prefer foods that fit the budget and the user's conditions; explain tradeoffs briefly.
2. Use the constraint guidance as health guidance, but do not claim to diagnose or treat disease.
3. Do not invent FNRI food names or fct_id values. Every ingredient must appear in the FNRI list.
4. Keep estimatedCost at or below the budget when possible and use realistic Filipino portions.
5. Return a practical meal, not a list of raw foods.
`;
}

async function callGemini(apiKey: string, prompt: string, responseSchema?: any) {
  let lastErrText = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
            responseSchema: responseSchema || {
              type: "OBJECT",
              properties: {
                scaleFactor: { type: "NUMBER" },
                reason: { type: "STRING" },
                daily: {
                  type: "OBJECT",
                  properties: {
                    calories: { type: "INTEGER" },
                    protein: { type: "INTEGER" },
                    carbs: { type: "INTEGER" },
                    fats: { type: "INTEGER" },
                  },
                  required: ["calories", "protein", "carbs", "fats"],
                },
                original: {
                  type: "OBJECT",
                  properties: {
                    protein: { type: "INTEGER" },
                    carbs: { type: "INTEGER" },
                    fats: { type: "INTEGER" },
                  },
                  required: ["protein", "carbs", "fats"],
                },
                optimized: {
                  type: "OBJECT",
                  properties: {
                    protein: { type: "INTEGER" },
                    carbs: { type: "INTEGER" },
                    fats: { type: "INTEGER" },
                  },
                  required: ["protein", "carbs", "fats"],
                },
                targets: {
                  type: "OBJECT",
                  properties: {
                    protein: { type: "INTEGER" },
                    carbs: { type: "INTEGER" },
                    fats: { type: "INTEGER" },
                    calories: { type: "INTEGER" },
                  },
                  required: ["protein", "carbs", "fats", "calories"],
                },
                ingredients: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      name: { type: "STRING" },
                      original: { type: "STRING" },
                      optimized: { type: "STRING" },
                      factor: { type: "NUMBER" },
                      changed: { type: "BOOLEAN" },
                      increased: { type: "BOOLEAN" },
                      decreased: { type: "BOOLEAN" },
                    },
                    required: ["name", "original", "optimized", "factor", "changed", "increased", "decreased"],
                  },
                },
              },
              required: ["scaleFactor", "reason", "daily", "original", "optimized", "targets", "ingredients"],
            },
          },
        }),
      });

      if (res.ok) {
        return await res.json();
      }
      lastErrText = await res.text();
      console.warn(`Gemini model ${model} returned non-200:`, lastErrText);
    } catch (e: any) {
      console.warn(`Gemini model ${model} fetch failed:`, e?.message);
    }
  }
  throw new Error(`AI service unavailable: ${lastErrText || "All models failed"}`);
}

const SUGGESTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    reason: { type: "STRING" },
    estimatedCost: { type: "NUMBER" },
    kcal: { type: "INTEGER" },
    protein: { type: "INTEGER" },
    carbs: { type: "INTEGER" },
    fats: { type: "INTEGER" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "STRING" },
          fct_id: { type: "STRING" },
        },
        required: ["name", "quantity", "fct_id"],
      },
    },
    fnriBasis: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          fct_id: { type: "STRING" },
          energy_kcal: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
          available_carbohydrate_g: { type: "NUMBER" },
          total_fat_g: { type: "NUMBER" },
        },
        required: ["name", "fct_id"],
      },
    },
  },
  required: ["name", "reason", "estimatedCost", "kcal", "protein", "carbs", "fats", "ingredients", "fnriBasis"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonError("Supabase environment configuration missing", 500);
    }
    if (!geminiApiKey) {
      return jsonError("GEMINI_API_KEY secret is not set", 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing authorization header", 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonError("Invalid session", 401);
    }

    const body = await req.json();
    const { mode = "optimize", meal, profile, totalMealsToday = 3, budget = 200, mealType = "Lunch" } = body;

    const { data: storedProfile } = await supabase
      .from("profiles")
      .select("goal, dietary_restrictions, medical_conditions, allergies, height_cm, weight_kg, age, sex, activity_level")
      .eq("id", userData.user.id)
      .maybeSingle();
    const userProfile = storedProfile || profile || {};

    if (mode === "suggest") {
      const [{ data: fnriFoods, error: fnriError }, { data: constraints, error: constraintsError }] = await Promise.all([
        supabase
          .from("fnri_food_composition")
          .select("fct_id, food_name, alternate_name, base_weight_g, energy_kcal, protein_g, total_fat_g, available_carbohydrate_g, dietary_fiber_g")
          .order("food_name")
          .limit(200),
        supabase
          .from("constraint_definitions")
          .select("key, label, reason, blocked")
          .eq("active", true),
      ]);

      if (fnriError) return jsonError("FNRI food data is unavailable", 503);
      if (constraintsError) return jsonError("Health constraint data is unavailable", 503);

      const prompt = buildSuggestionPrompt(userProfile, budget, mealType, fnriFoods || [], constraints || []);
      const geminiJson = await callGemini(geminiApiKey, prompt, SUGGESTION_SCHEMA);
      const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("AI returned no meal suggestion");

      return new Response(JSON.stringify({
        ...JSON.parse(text),
        source: "DOST-FNRI",
        budget: Number(budget) || 0,
        mealType,
      }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
    }

    if (!meal || !meal.name) {
      return jsonError("Missing meal data", 400);
    }

    const daily = computeDailyTargets(userProfile);
    const perMealKcal = Math.round(daily.calories / totalMealsToday);
    const originalKcal = Number(meal.kcal) || 0;
    const fallbackScale = Math.max(0.5, Math.min(2.0, perMealKcal / Math.max(originalKcal, 1)));

    const prompt = buildPrompt(meal, userProfile, totalMealsToday);
    const geminiJson = await callGemini(geminiApiKey, prompt);
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("AI returned no content");
    }

    const data = JSON.parse(text);
    const scaleFactor = Math.max(0.5, Math.min(2.0, Number(data.scaleFactor) || fallbackScale));
    const optimizedKcal = Math.round(originalKcal * scaleFactor);

    const normalized = {
      scaleFactor,
      perMealKcal,
      originalKcal,
      optimizedKcal,
      reason: data.reason || "Adjusted to match your meal and macro target.",
      daily: {
        calories: Number(data.daily?.calories) || daily.calories,
        protein: Number(data.daily?.protein) || daily.protein,
        carbs: Number(data.daily?.carbs) || daily.carbs,
        fats: Number(data.daily?.fats) || daily.fats,
      },
      original: {
        protein: Number(data.original?.protein) || Number(meal.protein) || 0,
        carbs: Number(data.original?.carbs) || Number(meal.carbs) || 0,
        fats: Number(data.original?.fats) || Number(meal.fats) || 0,
      },
      optimized: {
        protein: Number(data.optimized?.protein) || Math.round((Number(meal.protein) || 0) * scaleFactor),
        carbs: Number(data.optimized?.carbs) || Math.round((Number(meal.carbs) || 0) * scaleFactor),
        fats: Number(data.optimized?.fats) || Math.round((Number(meal.fats) || 0) * scaleFactor),
      },
      targets: {
        protein: Number(data.targets?.protein) || Math.round(daily.protein / totalMealsToday),
        carbs: Number(data.targets?.carbs) || Math.round(daily.carbs / totalMealsToday),
        fats: Number(data.targets?.fats) || Math.round(daily.fats / totalMealsToday),
        calories: Number(data.targets?.calories) || perMealKcal,
      },
      ingredients: Array.isArray(data.ingredients) && data.ingredients.length
        ? data.ingredients.map((ing: any) => scaleIngredient({ name: ing.name, original: ing.original, optimized: ing.optimized }, Number(ing.factor) || scaleFactor))
        : (meal.ingredients || []).map((ing: any) => scaleIngredient(ing, scaleFactor)),
    };

    return new Response(JSON.stringify(normalized), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("optimize-meal edge error:", error);
    return jsonError(error?.message || "AI optimization failed", 500);
  }
});

