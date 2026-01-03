// src/services/AiTableService.ts

const SYSTEM_PROMPT = `
You are an expert OCR system. Extract the table from the image into a JSON object.
Structure: { "rows": [ ["Header1", "Header2"], ["Val1", "Val2"] ] }
Rules:
1. Output ONLY JSON object. Do not write any introduction or conclusion.
2. Use empty strings "" for empty cells.
3. Preserve all text exactly as shown (Russian language is possible).
`;

// 👇 ОБНОВЛЕННЫЙ СПИСОК (Только модели из вашего списка)
const MODELS = [
    // 1. Qwen 2.5 VL - Лучшая для таблиц и OCR (часто лучше Gemini)
    "qwen/qwen-2.5-vl-7b-instruct:free",

    // 2. Google Gemma 3 - Новая мощная мультимодальная модель (27B)
    "google/gemma-3-27b-it:free",

    // 3. Google Gemini 2.0 Flash Exp - Старая добрая (если не перегружена)
    "google/gemini-2.0-flash-exp:free",

    // 4. Nvidia Nemotron - Запасной вариант
    "nvidia/nemotron-nano-12b-v2-vl:free",

    // 5. Google Gemma 3 (версия поменьше, если 27B занята)
    "google/gemma-3-12b-it:free",
];

// Функция задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const recognizeTableWithAi = async (apiKey: string, base64Image: string): Promise<string[][]> => {
    let lastError = null;

    // Проходим по списку моделей
    for (const model of MODELS) {
        // Делаем до 2 попыток на модель (чтобы не ждать слишком долго)
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                console.log(`🔄 Пробую модель: ${model} (Попытка ${attempt})...`);

                const response = await fetch("/openrouter-api/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${apiKey}`,
                        "HTTP-Referer": "http://localhost:5173",
                        "X-Title": "Table Editor Local"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: SYSTEM_PROMPT },
                                    {
                                        type: "image_url",
                                        image_url: { url: base64Image }
                                    }
                                ]
                            },
                        ],
                        temperature: 0,
                        // Важно: Gemma и Qwen могут не поддерживать strict 'json_object', 
                        // поэтому пробуем без него или обрабатываем ответ мягче
                        // response_format: { type: "json_object" } 
                    })
                });

                const data = await response.json();

                // --- ОБРАБОТКА ОШИБОК API ---
                if (data.error) {
                    const errMsg = data.error.message || JSON.stringify(data.error);
                    console.warn(`⚠️ Ошибка (${model}):`, errMsg);

                    // Если модели нет (404) или плохой запрос (400) — сразу к следующей
                    if (response.status === 404 || response.status === 400 || errMsg.includes("valid model")) {
                        lastError = errMsg;
                        break; // Break inner loop (attempts), go to next model
                    }

                    // Если перегрузка (429) — ждем и пробуем еще раз
                    if (response.status === 429 || errMsg.includes("rate limit")) {
                        console.log("⏳ Перегрузка, жду 2 сек...");
                        await delay(2000);
                        continue;
                    }

                    lastError = errMsg;
                    break; // Иначе к следующей модели
                }

                // --- ПАРСИНГ ОТВЕТА ---
                const content = data.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error("Пустой ответ от AI");
                }

                // Чистим Markdown (```json ... ```)
                const cleanJson = content.replace(/```json|```/g, "").trim();

                let parsed;
                try {
                    parsed = JSON.parse(cleanJson);
                } catch (e) {
                    // Иногда Qwen пишет текст перед JSON. Попробуем найти { ... }
                    const match = cleanJson.match(/\{[\s\S]*\}/);
                    if (match) {
                        try { parsed = JSON.parse(match[0]); } catch (err) { }
                    }
                }

                if (!parsed || !parsed.rows || !Array.isArray(parsed.rows)) {
                    console.warn(`⚠️ ${model} вернула невалидную структуру.`, content.substring(0, 50) + "...");
                    break; // К следующей модели
                }

                console.log(`✅ УСПЕХ! Сработала: ${model}`);
                console.log("📊 Данные:", parsed.rows);
                return parsed.rows;

            } catch (error) {
                console.warn(`❌ Ошибка сети/кода (${model}):`, error);
                lastError = error;
                break; // К следующей модели
            }
        }
    }

    alert("Все бесплатные модели сейчас недоступны или перегружены.");
    throw new Error(`Не удалось распознать. Последняя ошибка: ${lastError}`);
};