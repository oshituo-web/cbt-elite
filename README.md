# 🎓 CBT Elite: The Ultimate Practice Platform

CBT Elite is a professional-grade Computer-Based Testing (CBT) platform designed specifically for Nigerian examinations like **JAMB**, **WAEC**, and **NECO**. It features a modern, premium **Glassmorphic UI**, an intelligent question engine, and integrated AI-powered feedback.

---

## ✨ Key Features

### 🚀 Advanced Exam Engine
- **JAMB Mock Simulation**: Full 180-question, 120-minute simulation with Subject-based results analysis.
- **WAEC/NECO Mode**: Subject-specific objective and theory assessments.
- **Practice Mode**: Flexible, topic-based drills for targeted study.
- **Onscreen Calculator**: Integrated floating, glassmorphic calculator accessible during sessions.

### 🎨 Premium UI / UX
- **Glassmorphism Design**: Minimalist, high-transparency interface with sharp focus on content.
- **Dynamic Subject Tabs**: Isolated sidebar maps and progression tracking per subject (JAMB mode).
- **Instant Visual Feedback**: Question map turns vibrant blue for answered questions and Green/Red in Review mode.

### 🤖 Intelligent Question Management
- **Topic-Based Analysis**: Detailed performance insights by subject and sub-topic.
- **AI-Powered Generation**: Integration for generating thousands of validated questions via Gemini API.
- **Comprehensive Admin Panel**: Full control over syllabus management, question editing, and topic-based filtering.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Vanilla CSS (Custom Design System).
- **Backend**: Supabase (PostgreSQL, Auth, RLS).
- **AI**: Google Gemini API (via Supabase Edge Functions).
- **Security**: Strict Row-Level Security (RLS) and Client-Side Anti-Cheat protection.

---

## 🚀 Getting Started

### 1. Database Setup
1. Create a [Supabase](https://supabase.com/) project.
2. Execute the SQL scripts in order:
   - `schema_v3_diagrams.sql`
   - `schema_v4_monetization.sql`
   - `schema_v6_security.sql`

### 2. Environment Variables
Create a `.env` file in the `cbt-client` directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 3. Installation
```powershell
# Install client dependencies
cd cbt-client
npm install

# Run development server
npm run dev
```

---

## 🔒 Security
- **Anti-Cheat**: Blocks right-clicks, copy/paste, and dev-tools keyboard shortcuts during active exams.
- **RLS Enforced**: All data is protected by Supabase Row-Level Security policies.

---

## 📝 License
This project is for educational and practice purposes only.
