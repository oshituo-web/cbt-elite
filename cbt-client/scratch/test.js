const parseMath = (str) => {
    try {
        let lastAns = '0';
        let cleanStr = str.trim()
            .replace(/ans/g, lastAns)
            .replace(/EXP/g, 'e')
            .replace(/π|PI/g, 'Math.PI')
            .replace(/\^/g, '**')
            .replace(/abs\(/g, 'Math.abs(');
        const sinDeg = (deg) => Math.sin(deg * Math.PI / 180);
        const cosDeg = (deg) => Math.cos(deg * Math.PI / 180);
        const tanDeg = (deg) => Math.tan(deg * Math.PI / 180);
        cleanStr = cleanStr.replace(/sin\(/g, 'sinDeg(')
                          .replace(/cos\(/g, 'cosDeg(')
                          .replace(/tan\(/g, 'tanDeg(')
                          .replace(/log\(/g, 'Math.log10(')
                          .replace(/sqrt\(/g, 'Math.sqrt(');
        let openCount = (cleanStr.match(/\(/g) || []).length;
        let closeCount = (cleanStr.match(/\)/g) || []).length;
        while (openCount > closeCount) {
            cleanStr += ')';
            closeCount++;
        }
        cleanStr = cleanStr.replace(/[\+\-\*\/\*\*\(]$/, '');
        const evalFunc = new Function('sinDeg', 'cosDeg', 'tanDeg', 'Math', '\"use strict\"; return (' + cleanStr + ');');
        return evalFunc(sinDeg, cosDeg, tanDeg, Math);
    } catch (err) {
        console.error('Calculator Error Evaluation:', err, 'Expression:', str);
        return 'Error';
    }
};
console.log('Test 2+2:', parseMath('2+2'));
