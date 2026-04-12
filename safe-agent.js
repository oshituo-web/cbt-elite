#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const args = process.argv.slice(2);
const instruction = args[0];

// Root folders to scan
const ROOT_FOLDERS = ["cbt-client/src", "question-generator"];

// Readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Recursively get files
function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const files = fs.readdirSync(dir);

  files.forEach(file => {
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
  });

  return fileList;
}

// Collect files
let allFiles = [];
ROOT_FOLDERS.forEach(folder => {
  allFiles = allFiles.concat(getAllFiles(folder));
});

if (!instruction) {
  console.log("\nUsage:");
  console.log('node safe-agent.js "your instruction"\n');
  process.exit(1);
}

if (allFiles.length === 0) {
  console.log("❌ No files found.");
  process.exit(1);
}

// Show file list
console.log("\n📂 Select a file:\n");

allFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file}`);
});

// Ask user to pick file
rl.question("\nEnter file number: ", async (num) => {
  const fileIndex = parseInt(num) - 1;

  if (!allFiles[fileIndex]) {
    console.log("❌ Invalid selection.");
    rl.close();
    return;
  }

  const filePath = allFiles[fileIndex];
  const fileContent = fs.readFileSync(filePath, "utf-8");

  try {
    console.log("\n🚀 Analyzing with AI...\n");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
    });

    const prompt = `
You are a senior software engineer.

TASK:
${instruction}

FILE:
${filePath}

CONTENT:
${fileContent}

RULES:
- Return ONLY the full updated file code
- Do NOT explain anything
- Improve UI, structure, and performance where applicable
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const newCode = response.text();

    console.log("\n========= SUGGESTED UPDATE =========\n");
    console.log(newCode);

    rl.question("\nApply this change? (yes/no): ", (answer) => {
      if (answer.toLowerCase() === "yes") {
        const backupPath = filePath + ".bak";
        fs.writeFileSync(backupPath, fileContent);
        fs.writeFileSync(filePath, newCode);

        console.log("\n✅ File updated!");
        console.log(`📁 Backup saved: ${backupPath}`);
      } else {
        console.log("\n❌ Cancelled.");
      }

      rl.close();
    });

  } catch (err) {
    console.log("❌ Error:", err.message);
    rl.close();
  }
});