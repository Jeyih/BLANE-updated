// ============================================================
// BLANE — Portion Optimizer Edge Function (Gemini-powered)
// Receives: { meal, profile, totalMealsToday }
// Returns: exact ingredient amounts and macro-adjusted meal plan
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const GOAL_ADJUST = {
  lose_weight: 0.85,
  gain_muscle: 1.1,
  maintain: 1.0,
  improve_health: 1.0,
  boost_energy: 1.0,
  manage_condition: 0.9,
};

const MACRO_TARGETS = { protein: 0.3, carbs: 0.45, fats: 0.25 };

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
  const tdee = bmr * (ACTIVITY_MULT[profile?.activity_level] || 1.55);
  const calTarget = Math.round(tdee * (GOAL_ADJUST[profile?.goal] || 1.0));

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

function formatCup(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (rounded % 1 === 0) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function scaleQtyString(qtyStr: string | undefined, factor: number) {
  if (!qtyStr || qtyStr === "to taste") return qtyStr;

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
  const original = ing?.qty || "";
  const optimized = scaleQtyString(original, factor);

  return {
    name: ing?.name || "Ingredient",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Missing authorization header", 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonError("Invalid session", 401);
    }

    const body = await req.json();
    const { meal, profile, totalMealsToday = 3 } = body;

    if (!meal || !meal.name) {
      return jsonError("Missing meal data", 400);
    }

    const daily = computeDailyTargets(profile || {});
    const perMealKcal = Math.round(daily.calories / totalMealsToday);
    const originalKcal = Number(meal.kcal) || 0;
    const fallbackScale = Math.max(0.5, Math.min(2.0, perMealKcal / Math.max(originalKcal, 1)));

    const prompt = buildPrompt(meal, profile || {}, totalMealsToday);

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
          responseMimeType: "application/json",
          responseSchema: {
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

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      throw new Error("AI service unavailable");
    }

    const geminiJson = await geminiRes.json();
    const text = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("AI returned no content");
    }

    const data = JSON.parse(text);
    const scaleFactor = Math.max(0.5, Math.min(2.0, Number(data.scaleFactor) || fallbackScale));

    const normalized = {
      scaleFactor,
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
        ? data.ingredients.map((ing: any) => scaleIngredient({ name: ing.name, qty: ing.original }, Number(ing.factor) || scaleFactor))
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
