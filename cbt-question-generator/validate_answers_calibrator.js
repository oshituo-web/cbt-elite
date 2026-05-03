require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Using Flash for calibration

async function validateQuestion(question, options, providedCorrect) {
    const prompt = `
        Solve the following exam question independently and compare your result with the provided answer.
        Question: "${question}"
        Options:
        A: ${options.A}
        B: ${options.B}
        C: ${options.C}
        D: ${options.D}
        
        Provided Correct Answer: ${providedCorrect}

        Steps:
        1. Solve the question.
        2. Identify the correct letter based on your solution.
        3. Compare your letter with the Provided Correct Answer.
        4. State if the Provided Correct Answer is "CORRECT" or "INCORRECT".
        5. Briefly explain your reasoning.
        
        Output format: JSON { "status": "CORRECT" | "INCORRECT", "reasoning": "..." }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text().replace(/```json|```/g, ''));
}

// Calibration Test Suite
const testQuestions = [
    { 
        q: "What is 2 + 2?", 
        opts: { A: "3", B: "4", C: "5", D: "6" }, 
        ans: "B", 
        expected: "CORRECT" 
    },
    { 
        q: "What is the capital of France?", 
        opts: { A: "London", B: "Berlin", C: "Paris", D: "Madrid" }, 
        ans: "A", 
        expected: "INCORRECT" 
    }
];

async function runCalibration() {
    console.log("🚀 Starting Calibration Phase...");
    for (const test of testQuestions) {
        console.log(`\nTesting: ${test.q}`);
        const result = await validateQuestion(test.q, test.opts, test.ans);
        console.log(`Result: ${result.status}`);
        console.log(`Reasoning: ${result.reasoning}`);
        const pass = result.status === test.expected;
        console.log(`Calibration Status: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
    }
}

runCalibration().catch(console.error);
