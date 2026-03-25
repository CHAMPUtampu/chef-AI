# Pantry Chef AI - Smart Recipe Generator

Pantry Chef AI is a web application that generates delicious, custom meals from ingredients you already have. Powered by Google's Gemini AI, it acts as your personal chef — creating unique recipes based on your pantry items, cuisine preferences, and dietary needs.

## Features

- **AI-Powered Recipes**: Uses Google Gemini 2.5 Flash with automatic fallback across multiple models (2.5 Flash Lite, 2.5 Pro) for reliable generation.
- **Quick Start Ideas**: 5 pre-configured demo recipes that generate with a single click.
- **Copy Recipe**: One-click copy button on every generated recipe.
- **Secure API Key Management**: Key stored locally in your browser — never sent anywhere except directly to the Gemini API.
- **API Key Validation**: Format validation on save and submit, with clear error messages for invalid keys.
- **Smart Retry Logic**: Automatic retries on transient errors, model fallback on quota exhaustion or 404s.
- **Responsive Design**: Mobile-friendly UI built with Tailwind CSS.
- **Customizable**: Specify cuisine (Italian, Mexican, Asian, Indian, French, Comfort Food) and dietary needs (Vegetarian, Vegan, Gluten-Free, Low-Carb).

## Getting Started

### Prerequisites

You need a **Google Gemini API Key** (free tier available):

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create a free API key (starts with `AIza...`).

### Run Locally

```bash
git clone https://github.com/CHAMPUtampu/chef-AI.git
cd chef-AI
```

Open `index.html` in your browser and enter your API key when prompted.

## Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **AI Model**: Google Gemini 2.5 Flash (with 2.5 Flash Lite and 2.5 Pro fallbacks)
- **Fonts**: Google Fonts (Inter)

## Deployment

This is a static site — deploy anywhere:

**Vercel**:
1. Push to GitHub.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Deploy.

**GitHub Pages**: Enable Pages in repo settings, set source to `main` branch.

**Any static host**: Just serve the project directory — no build step required.

## License

This project is open-source and available under the [MIT License](LICENSE).
