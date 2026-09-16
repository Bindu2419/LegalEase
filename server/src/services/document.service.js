import fs from "fs/promises";
import pdf from "pdf-parse";

import Document from "../models/Document.js";

import {
  analyzeText
} from "./ai.service.js";

// Classify the document
function classify(text) {
  const t = String(text || "").toLowerCase();

  const categories = {
    "Rental / Lease Agreement": [
      "rent",
      "landlord",
      "tenant",
      "lease",
      "security deposit"
    ],

    "Employment Contract": [
      "employee",
      "employer",
      "salary",
      "employment",
      "probation"
    ],

    "Loan Agreement": [
      "loan",
      "borrower",
      "lender",
      "interest rate",
      "repayment"
    ],

    "Insurance Policy": [
      "insurance",
      "premium",
      "policyholder",
      "coverage",
      "claim"
    ],

    "NDA": [
      "confidential information",
      "non-disclosure",
      "confidentiality",
      "disclosing party"
    ],

    "Legal Notice": [
      "legal notice",
      "notice",
      "hereby",
      "demand",
      "legal proceedings"
    ],

    "Court Document": [
      "court",
      "case number",
      "petitioner",
      "respondent",
      "order"
    ]
  };

  let bestCategory = "Unknown";
  let bestScore = 0;

  for (const [category, words] of Object.entries(categories)) {
    const score = words.filter((word) =>
      t.includes(word)
    ).length;

    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return {
    documentType: bestCategory,
    confidence: Math.min(0.99, bestScore / 5)
  };
}

// Extract text page by page
async function extractPages(buffer) {
  const pages = [];

  const options = {
    pagerender: async function renderPage(pageData) {
      const content =
        await pageData.getTextContent();

      let text = "";

      for (const item of content.items) {
        if (
          item &&
          typeof item.str === "string"
        ) {
          text += item.str + " ";
        }
      }

      const cleanText = text
        .replace(/\s+/g, " ")
        .trim();

      const pageNumber =
        pageData.pageIndex + 1;

      pages.push({
        pageNumber,
        text: cleanText
      });

      return cleanText;
    }
  };

  await pdf(buffer, options);

  pages.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber
  );

  return pages;
}

// Clean text for searching
function normalizeSearchText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Check for keywords
function containsAny(
  text,
  keywords = []
) {
  const normalized =
    normalizeSearchText(text);

  return keywords.some(
    (keyword) =>
      normalized.includes(
        normalizeSearchText(keyword)
      )
  );
}

// Expected clauses for each document type
const EXPECTED_CLAUSES = {
  "Rental / Lease Agreement": [
    {
      title: "Parties",
      keywords: [
        "landlord",
        "tenant",
        "lessor",
        "lessee"
      ],
      importance: "High"
    },
    {
      title: "Rent Amount",
      keywords: [
        "rent",
        "monthly rent",
        "lease rent"
      ],
      importance: "High"
    },
    {
      title: "Security Deposit",
      keywords: [
        "security deposit",
        "deposit"
      ],
      importance: "High"
    },
    {
      title: "Lease Duration",
      keywords: [
        "lease period",
        "term of lease",
        "lease term",
        "tenure",
        "duration"
      ],
      importance: "Medium"
    },
    {
      title: "Termination",
      keywords: [
        "termination",
        "terminate",
        "early termination"
      ],
      importance: "High"
    },
    {
      title: "Notice Period",
      keywords: [
        "notice period",
        "days notice",
        "notice of termination"
      ],
      importance: "Medium"
    },
    {
      title: "Maintenance and Repairs",
      keywords: [
        "maintenance",
        "repairs",
        "repair",
        "maintenance responsibility"
      ],
      importance: "Medium"
    },
    {
      title: "Dispute Resolution",
      keywords: [
        "dispute resolution",
        "arbitration",
        "jurisdiction",
        "disputes"
      ],
      importance: "Medium"
    }
  ],

  "Employment Contract": [
    {
      title: "Job Role / Position",
      keywords: [
        "job title",
        "position",
        "designation",
        "role",
        "duties"
      ],
      importance: "Medium"
    },
    {
      title: "Salary / Compensation",
      keywords: [
        "salary",
        "compensation",
        "remuneration",
        "wages"
      ],
      importance: "High"
    },
    {
      title: "Working Hours",
      keywords: [
        "working hours",
        "work hours",
        "hours of work"
      ],
      importance: "Medium"
    },
    {
      title: "Probation",
      keywords: [
        "probation",
        "probationary period"
      ],
      importance: "Medium"
    },
    {
      title: "Leave",
      keywords: [
        "leave",
        "annual leave",
        "paid leave",
        "vacation"
      ],
      importance: "Medium"
    },
    {
      title: "Termination",
      keywords: [
        "termination",
        "terminate",
        "dismissal"
      ],
      importance: "High"
    },
    {
      title: "Notice Period",
      keywords: [
        "notice period",
        "notice",
        "days notice"
      ],
      importance: "High"
    },
    {
      title: "Confidentiality",
      keywords: [
        "confidentiality",
        "confidential information",
        "non-disclosure"
      ],
      importance: "Medium"
    }
  ],

  "Loan Agreement": [
    {
      title: "Loan Amount",
      keywords: [
        "loan amount",
        "principal amount",
        "principal"
      ],
      importance: "High"
    },
    {
      title: "Interest Rate",
      keywords: [
        "interest rate",
        "rate of interest",
        "interest"
      ],
      importance: "High"
    },
    {
      title: "Repayment Terms",
      keywords: [
        "repayment",
        "repayment schedule",
        "installment",
        "instalment",
        "emi"
      ],
      importance: "High"
    },
    {
      title: "Loan Duration",
      keywords: [
        "loan term",
        "tenure",
        "loan period",
        "duration"
      ],
      importance: "Medium"
    },
    {
      title: "Late Payment / Default",
      keywords: [
        "late payment",
        "default",
        "penalty",
        "late fee"
      ],
      importance: "High"
    },
    {
      title: "Prepayment",
      keywords: [
        "prepayment",
        "early repayment",
        "foreclosure"
      ],
      importance: "Medium"
    },
    {
      title: "Collateral / Security",
      keywords: [
        "collateral",
        "security",
        "secured loan",
        "security interest"
      ],
      importance: "Medium"
    },
    {
      title: "Dispute Resolution",
      keywords: [
        "dispute resolution",
        "arbitration",
        "jurisdiction"
      ],
      importance: "Medium"
    }
  ],

  "Insurance Policy": [
    {
      title: "Policyholder",
      keywords: [
        "policyholder",
        "insured"
      ],
      importance: "High"
    },
    {
      title: "Premium",
      keywords: [
        "premium",
        "premium amount"
      ],
      importance: "High"
    },
    {
      title: "Coverage",
      keywords: [
        "coverage",
        "covered",
        "benefits"
      ],
      importance: "High"
    },
    {
      title: "Exclusions",
      keywords: [
        "exclusions",
        "excluded",
        "not covered"
      ],
      importance: "High"
    },
    {
      title: "Claim Process",
      keywords: [
        "claim",
        "claim process",
        "claim procedure"
      ],
      importance: "High"
    },
    {
      title: "Policy Period",
      keywords: [
        "policy period",
        "period of insurance",
        "policy term"
      ],
      importance: "Medium"
    },
    {
      title: "Termination / Cancellation",
      keywords: [
        "cancellation",
        "cancel",
        "termination"
      ],
      importance: "Medium"
    }
  ],

  "NDA": [
    {
      title: "Definition of Confidential Information",
      keywords: [
        "confidential information",
        "confidential"
      ],
      importance: "High"
    },
    {
      title: "Obligations of Recipient",
      keywords: [
        "recipient",
        "receiving party",
        "obligations",
        "shall not disclose"
      ],
      importance: "High"
    },
    {
      title: "Permitted Disclosure",
      keywords: [
        "permitted disclosure",
        "required by law",
        "disclose by law"
      ],
      importance: "Medium"
    },
    {
      title: "Confidentiality Period",
      keywords: [
        "confidentiality period",
        "duration",
        "survive",
        "years"
      ],
      importance: "High"
    },
    {
      title: "Return / Destruction of Information",
      keywords: [
        "return of information",
        "destroy",
        "destruction",
        "return all materials"
      ],
      importance: "Medium"
    },
    {
      title: "Remedies",
      keywords: [
        "remedy",
        "injunction",
        "damages"
      ],
      importance: "Medium"
    },
    {
      title: "Governing Law",
      keywords: [
        "governing law",
        "jurisdiction"
      ],
      importance: "Medium"
    }
  ],

  "Legal Notice": [
    {
      title: "Parties",
      keywords: [
        "sender",
        "recipient",
        "to:",
        "from:"
      ],
      importance: "High"
    },
    {
      title: "Facts / Background",
      keywords: [
        "facts",
        "background",
        "whereas"
      ],
      importance: "High"
    },
    {
      title: "Demand / Required Action",
      keywords: [
        "demand",
        "required to",
        "called upon",
        "hereby demand"
      ],
      importance: "High"
    },
    {
      title: "Time Limit / Notice Period",
      keywords: [
        "within",
        "days",
        "notice period",
        "time limit"
      ],
      importance: "Medium"
    },
    {
      title: "Consequences of Non-Compliance",
      keywords: [
        "legal proceedings",
        "legal action",
        "proceedings",
        "failure to comply"
      ],
      importance: "High"
    }
  ],

  "Court Document": [
    {
      title: "Case Number",
      keywords: [
        "case number",
        "case no",
        "case no."
      ],
      importance: "High"
    },
    {
      title: "Parties",
      keywords: [
        "petitioner",
        "respondent",
        "plaintiff",
        "defendant",
        "appellant"
      ],
      importance: "High"
    },
    {
      title: "Court / Jurisdiction",
      keywords: [
        "court",
        "jurisdiction",
        "before the"
      ],
      importance: "High"
    },
    {
      title: "Facts / Allegations",
      keywords: [
        "facts",
        "allegation",
        "allegations",
        "background"
      ],
      importance: "High"
    },
    {
      title: "Order / Relief",
      keywords: [
        "order",
        "relief",
        "prayer",
        "directions"
      ],
      importance: "High"
    },
    {
      title: "Date",
      keywords: [
        "date",
        "dated"
      ],
      importance: "Medium"
    }
  ]
};

// Find missing expected clauses
function detectMissingClauses(
  documentType,
  fullText,
  clauses = []
) {
  const expected =
    EXPECTED_CLAUSES[documentType] || [];

  if (!expected.length) {
    return [];
  }

  const text =
    normalizeSearchText(fullText);

  const clauseText =
    Array.isArray(clauses)
      ? clauses
          .map(
            (clause) =>
              `${clause?.title || ""} ${
                clause?.explanation || ""
              }`
          )
          .join(" ")
      : "";

  const searchableContent =
    `${text} ${normalizeSearchText(
      clauseText
    )}`;

  return expected.map((item) => {
    const found =
      containsAny(
        searchableContent,
        item.keywords
      );

    return {
      title: item.title,

      description: found
        ? `A clause or related content for "${item.title}" was found in the document.`
        : `No clear clause or related content for "${item.title}" was found in the document.`,

      importance:
        item.importance,

      status:
        found
          ? "Found"
          : "Not Found"
    };
  });
}

// Calculate completeness
function calculateCompleteness(
  missingClauses = []
) {
  if (!missingClauses.length) {
    return 100;
  }

  const found =
    missingClauses.filter(
      (item) =>
        item.status === "Found"
    ).length;

  return Math.round(
    (found /
      missingClauses.length) *
      100
  );
}

// Build the health report
function createHealthReport({
  riskScore = 0,
  riskLevel = "Medium",
  pageCount = 0,
  clauses = [],
  risks = [],
  missingClauses = []
}) {
  const safeRiskScore =
    Math.max(
      0,
      Math.min(
        100,
        Number(riskScore) || 0
      )
    );

  const highRisks =
    risks.filter(
      (risk) =>
        risk?.severity === "High"
    );

  const mediumRisks =
    risks.filter(
      (risk) =>
        risk?.severity === "Medium"
    );

  const lowRisks =
    risks.filter(
      (risk) =>
        risk?.severity === "Low"
    );

  const missing =
    missingClauses.filter(
      (item) =>
        item?.status ===
        "Not Found"
    );

  const completenessScore =
    calculateCompleteness(
      missingClauses
    );

  const overallScore =
    Math.round(
      (
        (100 - safeRiskScore) +
        completenessScore
      ) / 2
    );

  let healthLevel =
    "Good";

  if (overallScore < 40) {
    healthLevel =
      "Needs Attention";
  } else if (overallScore < 70) {
    healthLevel =
      "Moderate";
  }

  const topRiskConcerns =
    highRisks
      .slice(0, 3)
      .map(
        (risk) => ({
          title:
            risk.title ||
            "Potential Risk",

          pageNumber:
            risk.pageNumber ??
            null,

          severity:
            risk.severity ||
            "High",

          type:
            "risk"
        })
      );

  const topMissingConcerns =
    missing
      .filter(
        (item) =>
          item.importance ===
            "High" ||
          item.importance ===
            "Medium"
      )
      .slice(0, 3)
      .map(
        (item) => ({
          title:
            item.title,

          importance:
            item.importance,

          type:
            "missingClause"
        })
      );

  return {
    overallScore,

    healthLevel,

    riskScore:
      safeRiskScore,

    riskLevel,

    completenessScore,

    pageCount,

    clauseCount:
      clauses.length,

    riskCount:
      risks.length,

    missingClauseCount:
      missing.length,

    expectedClauseCount:
      missingClauses.length,

    highRiskCount:
      highRisks.length,

    mediumRiskCount:
      mediumRisks.length,

    lowRiskCount:
      lowRisks.length,

    topConcerns: [
      ...topRiskConcerns,
      ...topMissingConcerns
    ].slice(0, 5)
  };
}

// Process one document
export async function processDocument(id) {
  const document =
    await Document.findById(id);

  if (!document) {
    throw new Error(
      "Document not found"
    );
  }

  try {
    // Extract PDF text

    document.status =
      "extracting";

    await document.save();

    const buffer =
      await fs.readFile(
        document.filePath
      );

    const pages =
      await extractPages(
        buffer
      );

    if (!pages.length) {
      throw new Error(
        "No text could be extracted from the PDF."
      );
    }

    // Combine page text

    const fullText =
      pages
        .map(
          (page) =>
            `Page ${page.pageNumber}\n${page.text}`
        )
        .join("\n\n");

    document.extractedText =
      fullText;

    document.pageCount =
      pages.length;

    // Classify document

    Object.assign(
      document,
      classify(fullText)
    );

    console.log(
      `Document type: ${document.documentType}`
    );

    console.log(
      `Classification confidence: ${document.confidence}`
    );

    // Start AI analysis

    document.status =
      "analyzing";

    await document.save();

    console.log(
      `Starting AI analysis: ${document.filename}`
    );

    const analysis =
      await analyzeText(
        pages,
        document.documentType
      );

    // Save AI analysis

    document.summary =
      analysis.summary ||
      "";

    document.clauses =
      Array.isArray(
        analysis.clauses
      )
        ? analysis.clauses
        : [];

    document.risks =
      Array.isArray(
        analysis.risks
      )
        ? analysis.risks
        : [];

    document.riskScore =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            analysis.riskScore
          ) || 0
        )
      );

    // Set risk level

    if (
      document.riskScore <= 30
    ) {
      document.riskLevel =
        "Low";
    } else if (
      document.riskScore <= 60
    ) {
      document.riskLevel =
        "Medium";
    } else {
      document.riskLevel =
        "High";
    }

    // Find missing clauses

    console.log(
      `Checking document completeness for: ${document.documentType}`
    );

    const missingClauses =
      detectMissingClauses(
        document.documentType,
        fullText,
        document.clauses
      );

    document.missingClauses =
      missingClauses;

    const foundCount =
      missingClauses.filter(
        (item) =>
          item.status ===
          "Found"
      ).length;

    console.log(
      `Clause completeness: ${foundCount}/${missingClauses.length} expected items found`
    );

    // Create health report

    document.healthReport =
      createHealthReport({
        riskScore:
          document.riskScore,

        riskLevel:
          document.riskLevel,

        pageCount:
          document.pageCount,

        clauses:
          document.clauses,

        risks:
          document.risks,

        missingClauses
      });

    // Save completed document

    document.status =
      "completed";

    await document.save();

    console.log(
      `Document analysis completed: ${document.filename}`
    );

    console.log(
      `Document is ready. Translation will happen when the user selects a language.`
    );

    return document;

  } catch (error) {
    document.status =
      "failed";

    await document.save();

    console.error(
      "Document processing failed:",
      error.message
    );

    throw error;
  }
}