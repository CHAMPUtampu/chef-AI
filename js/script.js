const form = document.getElementById('recipeForm');
const submitBtn = form.querySelector('button[type="submit"]');
const placeholder = document.getElementById('placeholder');
const loaderContainer = document.getElementById('loaderContainer');
const recipeOutput = document.getElementById('recipeOutput');
const errorDisplay = document.getElementById('errorDisplay');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyForm = document.getElementById('apiKeyForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const skipApiKeyBtn = document.getElementById('skipApiKeyBtn');
const resetApiKeyBtn = document.getElementById('resetApiKeyBtn');

// Model configuration — ordered by preference; falls back to next on 404 or quota exhaustion
const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 2;
const INITIAL_DELAY = 1000;

let activeController = null;

const demoRecipes = [
    { name: "Quick Pasta", ingredients: "Pasta, Garlic, Olive oil, Chili flakes, Salt", cuisine: "Italian", dietary: "Vegetarian" },
    { name: "Egg Fried Rice", ingredients: "Rice, Eggs, Soy sauce, Green onions, Oil", cuisine: "Asian", dietary: "Vegetarian" },
    { name: "Chicken Stir Fry", ingredients: "Chicken breast, Broccoli, Soy sauce, Garlic, Ginger, Honey", cuisine: "Asian", dietary: "None" },
    { name: "Simple Omelette", ingredients: "Eggs, Cheese, Bell peppers, Onions, Milk", cuisine: "Comfort Food", dietary: "Vegetarian" },
    { name: "Tuna Salad", ingredients: "Canned tuna, Mayonnaise, Onion, Mustard, Crackers", cuisine: "Comfort Food", dietary: "Low-Carb" }
];

// --- Init ---

function init() {
    if (!localStorage.getItem('GEMINI_API_KEY')) {
        showApiKeyModal();
    }
    renderDemoRecipes();
}

// --- API Key Modal ---

function showApiKeyModal() {
    apiKeyModal.classList.remove('hidden');
    apiKeyModal.classList.add('flex');
    apiKeyInput.focus();
}

function hideApiKeyModal() {
    apiKeyModal.classList.remove('flex');
    apiKeyModal.classList.add('hidden');
}

function isValidApiKey(key) {
    return /^AIza[A-Za-z0-9_-]{30,}$/.test(key);
}

apiKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = apiKeyInput.value.trim();
    if (!key) return;

    if (key.startsWith('http')) {
        alert("You pasted a URL instead of an API key. Copy your key (starting with 'AIza...') from Google AI Studio.");
        return;
    }
    if (!isValidApiKey(key)) {
        alert("That doesn't look like a valid Gemini API key. Keys start with 'AIza' and are about 39 characters long. Get one from Google AI Studio.");
        return;
    }
    localStorage.setItem('GEMINI_API_KEY', key);
    hideApiKeyModal();
});

skipApiKeyBtn.addEventListener('click', hideApiKeyModal);

resetApiKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('GEMINI_API_KEY');
    showApiKeyModal();
});

// --- Demo Recipes ---

function renderDemoRecipes() {
    const container = document.getElementById('demoContainer');
    if (!container) return;
    container.innerHTML = '';
    demoRecipes.forEach(recipe => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = "demo-card bg-amber-50 p-4 rounded-xl border border-amber-100 hover:bg-amber-100 text-left w-full";

        const title = document.createElement('h4');
        title.className = "font-bold text-amber-800";
        title.textContent = recipe.name;

        const desc = document.createElement('p');
        desc.className = "text-xs text-amber-600 mt-1 truncate";
        desc.textContent = recipe.ingredients;

        card.appendChild(title);
        card.appendChild(desc);

        card.addEventListener('click', () => {
            document.getElementById('ingredients').value = recipe.ingredients;
            document.getElementById('cuisine').value = recipe.cuisine;
            document.getElementById('dietary').value = recipe.dietary;
            form.requestSubmit();
        });
        container.appendChild(card);
    });
}

// --- Form Submission ---

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKeyRaw = localStorage.getItem('GEMINI_API_KEY');
    const apiKey = apiKeyRaw ? apiKeyRaw.trim() : null;

    if (!apiKey) {
        showApiKeyModal();
        return;
    }
    if (!isValidApiKey(apiKey)) {
        displayError("Your saved API key looks invalid. Please reset it and enter a valid key from Google AI Studio.");
        showApiKeyModal();
        return;
    }

    const ingredients = document.getElementById('ingredients').value.trim();
    const cuisine = document.getElementById('cuisine').value;
    const dietary = document.getElementById('dietary').value;

    if (!ingredients) {
        displayError("Please enter at least one ingredient before generating a recipe.");
        return;
    }

    // Cancel any in-flight request
    if (activeController) {
        activeController.abort();
    }
    activeController = new AbortController();

    setSubmitting(true);

    const prompt = `
        You are a highly creative and experienced chef AI, focusing on feasibility and flavor. Generate ONE unique and feasible recipe based on the user's input.

        **Ingredients Available:** ${ingredients}
        **Desired Cuisine:** ${cuisine}
        **Dietary Needs:** ${dietary}

        The recipe MUST be formatted clearly using Markdown and include:
        1. **A Creative Recipe Title** (as an H2 heading: ## Title)
        2. **Prep Time & Cook Time** (in bold on a single line, clearly separated)
        3. **Ingredients List** with specific, realistic quantities (as a bulleted list under an H3 heading).
        4. **Step-by-Step Instructions** (as a numbered list under an H3 heading).
        5. **A Chef's Tip/Serving Suggestion** (in italics at the very end).
    `;

    try {
        const recipeText = await generateRecipeWithRetry(prompt, apiKey, activeController.signal);
        if (recipeText) {
            displayRecipe(parseMarkdown(recipeText));
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        displayError(error.message);
    } finally {
        activeController = null;
        setSubmitting(false);
    }
});

function setSubmitting(busy) {
    if (busy) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Generating...';
        showLoadingState();
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = '\uD83D\uDD25 Generate Recipe';
    }
}

// --- Gemini API ---

async function generateRecipeWithRetry(prompt, apiKey, signal) {
    let lastError;
    for (const model of MODELS) {
        try {
            return await callGemini(prompt, apiKey, model, signal);
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError') throw error;
            const isLastModel = model === MODELS[MODELS.length - 1];
            if (!isLastModel && (error.status === 404 || error.status === 429)) {
                console.warn(`Model ${model} failed (${error.status}), trying next fallback...`);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

async function callGemini(prompt, apiKey, model, signal) {
    let delay = INITIAL_DELAY;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            console.log(`Calling Gemini model: ${model} — attempt ${i + 1}`);
            const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                signal
            });

            const data = await response.json().catch(() => ({ error: { message: "Unknown response format" } }));

            if (!response.ok) {
                console.error("Gemini Error:", data);
                const msg = data.error ? data.error.message : "Connection failed";

                if (response.status === 400 && msg.toLowerCase().includes('api key')) {
                    const err = new Error("Invalid API key. Please reset your key and enter a valid one from Google AI Studio.");
                    err.status = 400;
                    throw err;
                }
                if (response.status === 404) {
                    const err = new Error(`Model '${model}' not found.`);
                    err.status = 404;
                    throw err;
                }
                if (response.status === 403) {
                    const err = new Error("Access denied. Ensure the 'Generative Language API' is enabled in your Google Cloud project.");
                    err.status = 403;
                    throw err;
                }
                if (response.status === 429 && msg.includes('limit: 0')) {
                    const err = new Error(`Free tier quota exhausted for ${model}.`);
                    err.status = 429;
                    throw err;
                }
                if (i < MAX_RETRIES - 1 && (response.status === 503 || response.status === 429)) {
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    continue;
                }
                throw new Error(msg);
            }

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
            throw new Error("The AI returned an empty response. Please try different ingredients.");
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 429) throw error;
            if (i === MAX_RETRIES - 1) throw error;
            console.warn(`Retry due to: ${error.message}`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

// --- Markdown Parser ---

function parseMarkdown(text) {
    let html = text
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic: only match *word...* that isn't a list marker (not at line start after whitespace)
        .replace(/(?<!\n\s*)(?<!\*)\*(?!\*)(.+?)\*(?!\*)/g, '<em>$1</em>')
        .replace(/^\s*[-*] (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/<\/ol>\s*<ol>/g, '');

    // Wrap loose lines in <p> tags
    html = html.replace(/^(?!<[hulo])(.*\S.*)$/gim, '<p>$1</p>');

    return html;
}

// --- UI State ---

function showLoadingState() {
    placeholder.classList.add('hidden');
    errorDisplay.classList.add('hidden');
    recipeOutput.innerHTML = '';
    recipeOutput.classList.add('hidden');
    loaderContainer.classList.remove('hidden');
}

function displayRecipe(htmlContent) {
    loaderContainer.classList.add('hidden');
    recipeOutput.innerHTML = `
        <div class="flex justify-end mb-4">
            <button id="copyRecipeBtn" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
            </button>
        </div>
        <div id="recipeContent">${htmlContent}</div>
    `;
    recipeOutput.classList.remove('hidden');

    document.getElementById('copyRecipeBtn').addEventListener('click', copyRecipe);
}

async function copyRecipe() {
    const content = document.getElementById('recipeContent');
    const btn = document.getElementById('copyRecipeBtn');
    if (!content || !btn) return;

    try {
        await navigator.clipboard.writeText(content.innerText);
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        setTimeout(() => {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
        }, 2000);
    } catch {
        btn.textContent = 'Copy failed';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function displayError(message) {
    loaderContainer.classList.add('hidden');
    placeholder.classList.add('hidden');
    recipeOutput.classList.add('hidden');
    errorDisplay.innerHTML = `
        <div class="space-y-2">
            <p>&#10060; <strong>Error:</strong> ${escapeHtml(message)}</p>
            <p class="text-xs text-gray-500 font-normal mt-4">Troubleshooting: Try a NEW API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" class="underline text-amber-600">Google AI Studio</a>. Some old keys have restrictions.</p>
        </div>
    `;
    errorDisplay.classList.remove('hidden');
}

window.onload = init;
