const form = document.getElementById('recipeForm');
const placeholder = document.getElementById('placeholder');
const loaderContainer = document.getElementById('loaderContainer');
const recipeOutput = document.getElementById('recipeOutput');
const errorDisplay = document.getElementById('errorDisplay');
const apiKeyModal = document.getElementById('apiKeyModal');
const apiKeyForm = document.getElementById('apiKeyForm');
const apiKeyInput = document.getElementById('apiKeyInput');
const resetApiKeyBtn = document.getElementById('resetApiKeyBtn');

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

// Demo recipes data
const demoRecipes = [
    {
        name: "Quick Pasta",
        ingredients: "Pasta, Garlic, Olive oil, Chili flakes, Salt",
        cuisine: "Italian",
        dietary: "Vegetarian"
    },
    {
        name: "Egg Fried Rice",
        ingredients: "Rice, Eggs, Soy sauce, Green onions, Oil",
        cuisine: "Asian",
        dietary: "Vegetarian"
    },
    {
        name: "Chicken Stir Fry",
        ingredients: "Chicken breast, Broccoli, Soy sauce, Garlic, Ginger, Honey",
        cuisine: "Asian",
        dietary: "None"
    },
    {
        name: "Simple Omelette",
        ingredients: "Eggs, Cheese, Bell peppers, Onions, Milk",
        cuisine: "Comfort Food",
        dietary: "Vegetarian"
    },
    {
        name: "Tuna Salad",
        ingredients: "Canned tuna, Mayonnaise, Onion, Mustard, Crackers",
        cuisine: "Comfort Food",
        dietary: "Low-Carb"
    }
];

// Initialize the app
function init() {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    if (!savedKey) {
        showApiKeyModal();
    }

    renderDemoRecipes();
}

function showApiKeyModal() {
    apiKeyModal.classList.remove('hidden');
    apiKeyModal.classList.add('flex');
}

function hideApiKeyModal() {
    apiKeyModal.classList.remove('flex');
    apiKeyModal.classList.add('hidden');
}

apiKeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('GEMINI_API_KEY', key);
        hideApiKeyModal();
    }
});

resetApiKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('GEMINI_API_KEY');
    showApiKeyModal();
});

function renderDemoRecipes() {
    const container = document.getElementById('demoContainer');
    container.innerHTML = '';
    demoRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = "demo-card bg-amber-50 p-4 rounded-xl border border-amber-100 hover:bg-amber-100";
        card.innerHTML = `
            <h4 class="font-bold text-amber-800">${recipe.name}</h4>
            <p class="text-xs text-amber-600 mt-1 truncate">${recipe.ingredients}</p>
        `;
        card.onclick = () => {
            document.getElementById('ingredients').value = recipe.ingredients;
            document.getElementById('cuisine').value = recipe.cuisine;
            document.getElementById('dietary').value = recipe.dietary;
        };
        container.appendChild(card);
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey) {
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
    
    showLoadingState();

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
        const recipeText = await generateRecipeWithRetry(prompt, apiKey);
        if (recipeText) {
            const formattedHtml = parseMarkdown(recipeText);
            displayRecipe(formattedHtml);
        }
    } catch (error) {
        displayError(error.message);
    }
});

async function generateRecipeWithRetry(prompt, apiKey) {
    let delay = INITIAL_DELAY;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(`${API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                if (response.status === 503 || response.status === 429) {
                    throw new Error(`Server overloaded (status ${response.status}). Retrying...`);
                }
                const errorData = await response.json();
                throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            if (i === MAX_RETRIES - 1) {
                 throw new Error(`Failed to generate recipe. Please ensure your API key is correct.`);
            }
            console.warn(`Attempt ${i+1} failed. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

function parseMarkdown(text) {
    return text
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\s*[-*] (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/^\s*\d+\. (.*$)/gim, '<ol><li>$1</li></ol>')
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/<\/ol>\s*<ol>/g, '');
}

function showLoadingState() {
    placeholder.classList.add('hidden');
    errorDisplay.classList.add('hidden');
    recipeOutput.innerHTML = '';
    recipeOutput.classList.add('hidden');
    loaderContainer.classList.remove('hidden');
    recipeOutput.scrollIntoView({ behavior: 'smooth' });
}

function displayRecipe(htmlContent) {
    loaderContainer.classList.add('hidden');
    recipeOutput.innerHTML = htmlContent;
    recipeOutput.classList.remove('hidden');
    recipeOutput.scrollIntoView({ behavior: 'smooth' });
}

function displayError(message) {
    loaderContainer.classList.add('hidden');
    placeholder.classList.add('hidden');
    recipeOutput.classList.add('hidden');
    errorDisplay.textContent = `❌ Error: ${message}`;
    errorDisplay.classList.remove('hidden');
}

// Call init on load
window.onload = init;
