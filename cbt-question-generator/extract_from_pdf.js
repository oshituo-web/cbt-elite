require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });
const supabase = createClient((process.env.SUPABASE_URL || "").trim(), (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());

const generationSchema = {
    type: Type.ARRAY,
    description: "List of extracted questions from the PDF.",
    items: {
        type: Type.OBJECT,
        properties: {
            is_group: { type: Type.BOOLEAN },
            group_content: { type: Type.STRING, nullable: true },
            group_type: { type: Type.STRING, enum: ['passage', 'map', 'graph', 'data_set', 'instruction'], nullable: true },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        exam_type: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        subtopic: { type: Type.STRING },
                        difficulty: { type: Type.STRING, enum: ['Easy', 'Medium', 'Hard'] },
                        question: { type: Type.STRING },
                        option_a: { type: Type.STRING },
                        option_b: { type: Type.STRING },
                        option_c: { type: Type.STRING },
                        option_d: { type: Type.STRING },
                        correct_option: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
                        explanation: { type: Type.STRING },
                        diagram_url: { type: Type.STRING, nullable: true },
                        diagram_type: { type: Type.STRING, enum: ['none', 'graph', 'diagram', 'map', 'svg'], nullable: true },
                        diagram_svg: { type: Type.STRING, nullable: true }
                    },
                    required: ["exam_type", "subject", "topic", "subtopic", "difficulty", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"]
                }
            }
        },
        required: ["is_group", "questions"]
    }
};

async function withDBRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await operation();
            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
                return { data: null, error: err };
            }
            console.error(`[DB Retry Error] Attempt ${attempt}:`, err.message);
            if (attempt === maxRetries) return { data: null, error: err };
            await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 500));
        }
    }
}

async function extractFromPdf() {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        console.log("Usage: node extract_from_pdf.js <pdf_path> <exam_type> <subject> <year> [topic]");
        console.log("Example: node extract_from_pdf.js ./math_2023.pdf WAEC Mathematics 2023 'Algebra'");
        process.exit(1);
    }

    const [pdfPath, examType, subjectName, yearStr, providedTopic] = args;
    const year = parseInt(yearStr);
    const absolutePath = path.resolve(pdfPath);

    if (!fs.existsSync(absolutePath)) {
        console.error(`[ERROR] File not found: ${absolutePath}`);
        process.exit(1);
    }

    console.log(`[EXTRACTION] Uploading PDF: ${absolutePath}`);
    let fileUpload;
    try {
        fileUpload = await ai.files.upload({
            file: absolutePath,
            mimeType: 'application/pdf',
        });
        console.log(`[EXTRACTION] Uploaded file successfully. URI: ${fileUpload.uri}`);
    } catch (e) {
        console.error(`[ERROR] Failed to upload PDF:`, e.message);
        process.exit(1);
    }

    console.log(`[EXTRACTION] Fetching subjects and exams from DB...`);
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    const { data: exams } = await supabase.from('exams').select('id, exam_name');

    const subjectObj = subjects.find(s => s.subject_name.toLowerCase() === subjectName.toLowerCase());
    const examObj = exams.find(e => e.exam_name.toLowerCase() === examType.toLowerCase());

    if (!subjectObj) console.warn(`[WARN] Subject '${subjectName}' not found in DB. Will insert anyway, but might cause issues.`);
    if (!examObj) console.warn(`[WARN] Exam '${examType}' not found in DB. Will insert anyway, but might cause issues.`);

    const subjectId = subjectObj ? subjectObj.id : null;
    const examId = examObj ? examObj.id : null;

    console.log(`[EXTRACTION] Requesting AI to parse PDF for ${examType} ${subjectName}...`);
    
    const topicInstruction = providedTopic ? `The topic for these questions is mainly: ${providedTopic}.` : `Determine the most appropriate syllabus topic for each question.`;
    
    const prompt = `You are an expert Examination Setter for ${examType} ${subjectName}. 
I have uploaded a PDF document containing past questions.
Please extract ALL the multiple-choice questions from this document.

Requirements:
1. Extract the question text, the 4 options (A, B, C, D), and identify the correct option.
2. If the correct answer is not explicitly stated in the document, you MUST use your expert knowledge to provide the correct answer.
3. You MUST provide a clear, pedagogically sound explanation for why the correct option is the right answer.
4. ${topicInstruction}
5. Set an appropriate difficulty (Easy, Medium, Hard).
6. Output the result strictly matching the provided JSON schema. Group questions if they share a common passage or instruction.

If there are more than 50 questions, just extract the first 50 for now.`;

    let generatedResponse;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [
                {
                    role: "user",
                    parts: [
                        { fileData: { fileUri: fileUpload.uri, mimeType: fileUpload.mimeType } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: generationSchema,
                temperature: 0.1
            }
        });
        
        generatedResponse = JSON.parse(response.text);
    } catch (e) {
        console.error(`[ERROR] AI Generation failed:`, e.message);
        process.exit(1);
    }

    if (!generatedResponse || generatedResponse.length === 0) {
        console.log(`[EXTRACTION] No questions extracted.`);
        process.exit(0);
    }

    let totalSaved = 0;

    console.log(`[EXTRACTION] Parsing successful. Saving ${generatedResponse.length} groups to staging area (Drafts)...`);

    for (const group of generatedResponse) {
        let groupId = null;
        if (group.is_group) {
            const { data: gData, error: gErr } = await withDBRetry(() => supabase.from('question_groups').insert({
                exam_type: examType,
                subject: subjectName,
                group_type: group.group_type || 'passage',
                content: group.group_content || '',
                is_active: false // Keep group inactive too
            }).select());

            if (!gErr && gData && gData.length > 0) {
                groupId = gData[0].id;
            }
        }

        const qsToInsert = [];
        const originals = [];
        
        for (const q of group.questions) {
            qsToInsert.push({
                exam_id: examId,
                subject_id: subjectId,
                subject: subjectName,
                topic: q.topic || providedTopic || 'General',
                subtopic: q.subtopic || 'General',
                exam_type: examType,
                exam_year: year,
                question_text: q.question,
                diagram_url: q.diagram_url || null,
                diagram_type: q.diagram_type || 'none',
                diagram_svg: q.diagram_svg || null,
                difficulty: (q.difficulty || 'Medium').charAt(0).toUpperCase() + (q.difficulty || 'Medium').slice(1).toLowerCase(),
                group_id: groupId,
                explanation: null,
                is_active: false, // STAGING AREA FLAG
                is_past_question: true
            });
            originals.push(q);
        }

        if (qsToInsert.length === 0) continue;

        let insertedQs = [];
        let validOriginals = [];
        
        for (let i = 0; i < qsToInsert.length; i++) {
            const { data: qData, error: qErr } = await withDBRetry(() => supabase.from('questions').insert(qsToInsert[i]).select());
            if (!qErr && qData && qData.length > 0) {
                insertedQs.push(qData[0]);
                validOriginals.push(originals[i]);
            } else {
                console.log(`[EXTRACTION] Skipping duplicate or invalid question: ${qsToInsert[i].question_text.substring(0, 30)}...`);
            }
        }

        if (insertedQs.length === 0) continue;

        const ansInserts = [];
        insertedQs.forEach((insQ, idx) => {
            const orig = validOriginals[idx];
            ['A', 'B', 'C', 'D'].forEach(letter => {
                ansInserts.push({
                    question_id: insQ.id,
                    option_letter: letter,
                    option_text: orig[`option_${letter.toLowerCase()}`],
                    is_correct: orig.correct_option === letter
                });
            });

            if (orig.explanation) {
                supabase.from('question_explanations')
                    .upsert({ question_id: insQ.id, explanation: orig.explanation })
                    .then();
            }
        });

        await withDBRetry(() => supabase.from('answers').insert(ansInserts));
        totalSaved += insertedQs.length;
    }

    console.log(`[EXTRACTION] Complete! Saved ${totalSaved} questions to the Staging Area (is_active = false).`);
    
    try {
        await ai.files.delete({ name: fileUpload.name });
        console.log(`[EXTRACTION] Cleaned up uploaded PDF from Gemini.`);
    } catch(e) {
        console.warn(`[WARN] Failed to delete file from Gemini:`, e.message);
    }
}

extractFromPdf().catch(console.error);
