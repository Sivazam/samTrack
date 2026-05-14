// Simulate the OCR text extraction from the provided image
const mockOCRText = `
GOVERNMENT OF ANDHRA PRADESH
DRUGS CONTROL ADMINISTRATION
FORM 20
[See Rule 61 (1)]

Damaraju Sarath Chandrika , Proprietary
Registered Pharmacist
Vagirala Vasantha(BPH) and Reg No...

Retail Drugs other than those specified in [SCHEDULES C,C(1)AND X] of the drugs and cosmetic rules 1945, on the premises situated at...
DOOR NO: 5-86/1, BESIDE INDIAN OIL BUNK...

2. The licenses unless sooner suspended or cancelled, shall remain valid perpetually. However, the compliance with conditions of license and the provisions of the Drugs and Cosmetics Act, 1940 (23 of 1940) and the Drugs and Cosmetics Rules, 1945 shall be assessed not less than once in three years or as needed as per risk based approach.

3. The sale shall be made under the personal supervision of a Registered Pharmacist VAGIRALA VASANTHA(BPH) and RegNo.138576, DOJ:26-04-2023.

4. Categories of drugs : DRUGS OTHER THAN THOSE SPECIFIED IN [SCHEDULES C,C(1) AND X] License No AP/05/05/2021-24085
This is a system generated license in Sales Licensing System of Andhra Pradesh Drug Control Administration
Date:11/05/2023
...
Note: The License shall remain valid if the licensee deposits a license retention fee equivalent to the fee required for the grant of license before the expiry of a period of every succeeding five years from the date of its issue.
Last date for payment of Retention fee: 12-10-2026 Please visit http://apdca.ap.gov.in/ for depositing retention fee...
`;

function testOCRLogic(text) {
    console.log("Analyzing Text length:", text.length);

    // --- DATE LOGIC ---
    const dateRegex = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g;
    const matches = [...text.matchAll(dateRegex)];

    const strategies = matches.map(match => {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        const date = new Date(year, month - 1, day);

        // Get context around the date (prev 25 chars)
        const startIndex = Math.max(0, match.index - 25);
        const context = text.substring(startIndex, match.index).toLowerCase();

        let score = 0;

        // Boost for explicit expiry keywords like "valid to", "expires", "upto", "retention fee"
        if (context.includes('valid') || context.includes('expires') || context.includes('upto') || context.includes('retention') || context.includes('to ')) {
            score += 20;
        }

        // Penalize "Date:" (usually Issue Date) or "Generated"
        if (context.includes('date:') || context.includes('date :') || context.includes('generated') || context.includes('issue')) {
            score -= 10;
        }

        if (date.getFullYear() > new Date().getFullYear()) {
            score += 5;
        }

        console.log(`Found Date: ${date.toDateString()}, Context: "${context.replace(/\n/g, ' ')}", Score: ${score}`);

        return { date, score };
    });

    const validStrategies = strategies
        .filter(s => s.date.getFullYear() > 2000 && s.date.getFullYear() < 2050)
        .sort((a, b) => b.date.getTime() - a.date.getTime());

    const expiryDate = validStrategies.length > 0 ? validStrategies[0].date : undefined;
    console.log("\nSELECTED EXPIRY DATE:", expiryDate ? expiryDate.toDateString() : "None");


    // --- LICENSE NUMBER LOGIC ---
    const cleanText = text.replace(/\n/g, ' ');
    let licenseNumber = '';

    // 1. Strict AP Pattern
    const apPattern = /\b[A-Z]{2}\/\d{2}\/\d{2}\/\d{4}-\d+\b/g;
    const apMatch = cleanText.match(apPattern);

    if (apMatch) {
        licenseNumber = apMatch[0];
        console.log("Matched AP Pattern:", licenseNumber);
    } else {
        console.log("Did not match AP Pattern");

        // 2. Keyword Search
        const keywordMatch = cleanText.match(/(?:Lic(?:ense)?\.?\s*No\.?|D\.?\s*L\.?\s*No\.?)\s*[:.\-]?\s*([A-Z0-9/\-]{5,30})/i);
        if (keywordMatch) {
            licenseNumber = keywordMatch[1].trim();
            console.log("Matched Keyword Pattern:", licenseNumber);
        }
    }

    if (licenseNumber && (licenseNumber.match(/sale|stock|exhibit|offer|distribute/i))) {
        console.log("Discarded garbage license number:", licenseNumber);
        licenseNumber = '';
    }

    console.log("\nSELECTED LICENSE NUMBER:", licenseNumber);
}

testOCRLogic(mockOCRText);
