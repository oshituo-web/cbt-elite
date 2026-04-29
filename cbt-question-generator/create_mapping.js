const fs = require('fs');

async function createMapping() {
    const mismatches = JSON.parse(fs.readFileSync('mismatches.json', 'utf8'));
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    
    // Create a reverse mapping for easier searching: "exam|subject|approx_topic" -> "official_topic"
    const mapping = {};
    
    mismatches.forEach(m => {
        const [exam, subject, topic] = m.split('|');
        if (syllabus[exam] && syllabus[exam][subject]) {
            // Simple normalization attempt: find closest match in syllabus for this exam/subject
            const officialTopics = syllabus[exam][subject];
            const match = officialTopics.find(t => 
                t.toLowerCase().includes(topic.toLowerCase()) || 
                topic.toLowerCase().includes(t.toLowerCase())
            );
            
            if (match) {
                mapping[m] = `${exam}|${subject}|${match}`;
            }
        }
    });
    
    console.log("Proposed mappings (Total found:", Object.keys(mapping).length, "):");
    console.log(JSON.stringify(mapping, null, 2));
    fs.writeFileSync('proposed_mapping.json', JSON.stringify(mapping, null, 2));
}

createMapping();
