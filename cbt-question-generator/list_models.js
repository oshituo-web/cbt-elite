require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    console.log("🚀 Fetching available models...");
    const result = await genAI.listModels();
    console.log(result);
}

listModels().catch(console.error);
