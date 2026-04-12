#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ✅ FORCE .env LOADING
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

// -----------------------------
// CHECK API KEY
// -----------------------------
if (!process.env.GOOGLE_API_KEY) {
  console.log("\n❌ GOOGLE_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// -----------------------------
// INPUT
// -----------------------------
const instruction = process.argv.slice(2).join(" ");

if (!instruction) {
  console.log('\nUsage: node safe-agent.js "your instruction"\n');
  process.exit(1);
}

// -----------------------------
// ✅ COMPATIBLE MODEL FOR YOUR API
// -----------------------------
const MODEL_NAME = "models/gemini-1.0-pro";

// -----------------------------
// GEMINI CALL
// -----------------------------
async function generate(prompt) {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

// -----------------------------
// FILE SCANNER
// -----------------------------
const ROOT_FOLDERS = ["cbt-client/src", "question-generator"];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (
      fullPath.endsWith(".js") ||
      fullPath.endsWith(".jsx") ||
      fullPath.endsWith(".ts") ||
      fullPath.endsWith(".tsx")
    ) {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

let allFiles = [];
ROOT_FOLDERS.forEach(folder => {
  allFiles = allFiles.concat(getAllFiles(folder));
});

// -----------------------------
// STEP 1: PICK BEST FILE
// -----------------------------
async function pickBestFile() {
  const prompt = `
You are a senior software engineer.

TASK:
${instruction}

PROJECT FILES:
${allFiles.join("\n")}

RULES:
- Choose ONLY ONE best file to modify
- Return ONLY the file path
`;

  return await generate(prompt);
}

// -----------------------------
// STEP 2: EDIT FILE
// -----------------------------
async function editFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error("File not found: " + filePath);
  }

  const fileContent = fs.readFileSync(filePath, "utf-8");

  const prompt = `
You are a senior software engineer working on a CBT exam system.

TASK:
${instruction}

FILE PATH:
${filePath}

FILE CONTENT:
${fileContent}

RULES:
- Return ONLY the full updated file code
- Do NOT explain anything
- Improve UI, structure, readability, and logic where needed
`;

  const newCode = await generate(prompt);

  return { filePath, fileContent, newCode };
}

// -----------------------------
// MAIN EXECUTION
// -----------------------------
(async () => {
  try {
    console.log("\n🧠 AI is choosing best file...\n");

    const filePath = (await pickBestFile()).trim();

    console.log("🎯 Selected file:", filePath);

    console.log("\n🚀 AI is editing file...\n");

    const { fileContent, newCode } = await editFile(filePath);

    console.log("\n========= SUGGESTED UPDATE =========\n");
    console.log(newCode);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("\nApply this change? (yes/no): ", (answer) => {
      if (answer.toLowerCase() === "yes") {
        const backupPath = filePath + ".bak";

        fs.writeFileSync(backupPath, fileContent);
        fs.writeFileSync(filePath, newCode);

        console.log("\n✅ File updated successfully!");
        console.log("📁 Backup created:", backupPath);
      } else {
        console.log("\n❌ Cancelled.");
      }

      rl.close();
    });

  } catch (err) {
    console.log("\n❌ Error:", err.message);
  }
})();