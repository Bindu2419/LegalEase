import mongoose from "mongoose";

// ======================================================
// CLAUSE SCHEMA
// ======================================================

const clauseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Key Clause"
    },

    explanation: {
      type: String,
      default: ""
    },

    risk: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },

    pageNumber: {
      type: Number,
      default: null
    }
  },
  {
    _id: false
  }
);


// ======================================================
// RISK SCHEMA
// ======================================================

const riskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Potential Risk"
    },

    description: {
      type: String,
      default: ""
    },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },

    pageNumber: {
      type: Number,
      default: null
    }
  },
  {
    _id: false
  }
);


// ======================================================
// MISSING CLAUSE SCHEMA
// ======================================================

const missingClauseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: "Missing Clause"
    },

    description: {
      type: String,
      default: ""
    },

    importance: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },

    status: {
      type: String,
      enum: ["Found", "Not Found"],
      default: "Not Found"
    }
  },
  {
    _id: false
  }
);


// ======================================================
// HEALTH REPORT TOP CONCERN SCHEMA
// ======================================================

const healthConcernSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: ""
    },

    pageNumber: {
      type: Number,
      default: null
    },

    severity: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: null
    },

    importance: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: null
    },

    type: {
      type: String,
      enum: [
        "risk",
        "missingClause"
      ],
      default: "risk"
    }
  },
  {
    _id: false
  }
);


// ======================================================
// HEALTH REPORT SCHEMA
// ======================================================

const healthReportSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // Project-defined overall health indicator.
    // This is NOT a legal conclusion.
    // --------------------------------------------------

    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    healthLevel: {
      type: String,
      enum: [
        "Good",
        "Moderate",
        "Needs Attention"
      ],
      default: "Good"
    },


    // --------------------------------------------------
    // Existing document risk information
    // --------------------------------------------------

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    riskLevel: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High"
      ],
      default: "Low"
    },


    // --------------------------------------------------
    // Completeness
    // --------------------------------------------------

    completenessScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },


    // --------------------------------------------------
    // Document statistics
    // --------------------------------------------------

    pageCount: {
      type: Number,
      default: 0
    },

    clauseCount: {
      type: Number,
      default: 0
    },

    riskCount: {
      type: Number,
      default: 0
    },

    missingClauseCount: {
      type: Number,
      default: 0
    },

    expectedClauseCount: {
      type: Number,
      default: 0
    },


    // --------------------------------------------------
    // Risk breakdown
    // --------------------------------------------------

    highRiskCount: {
      type: Number,
      default: 0
    },

    mediumRiskCount: {
      type: Number,
      default: 0
    },

    lowRiskCount: {
      type: Number,
      default: 0
    },


    // --------------------------------------------------
    // Most important problems
    // --------------------------------------------------

    topConcerns: {
      type: [
        healthConcernSchema
      ],
      default: []
    }
  },
  {
    _id: false
  }
);


// ======================================================
// TRANSLATION SCHEMA
// ======================================================

const translationSchema = new mongoose.Schema(
  {
    summary: {
      type: String,
      default: ""
    },

    clauses: {
      type: [
        clauseSchema
      ],
      default: []
    },

    risks: {
      type: [
        riskSchema
      ],
      default: []
    },

    // IMPORTANT:
    // Missing clauses must also be stored inside
    // each language translation.
    missingClauses: {
      type: [
        missingClauseSchema
      ],
      default: []
    }
  },
  {
    _id: false
  }
);


// ======================================================
// DOCUMENT SCHEMA
// ======================================================

const documentSchema = new mongoose.Schema(
  {
    // ==================================================
    // OWNER
    // ==================================================

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },


    // ==================================================
    // FILE
    // ==================================================

    filename: {
      type: String,
      required: true
    },

    filePath: {
      type: String,
      required: true
    },


    // ==================================================
    // CLASSIFICATION
    // ==================================================

    documentType: {
      type: String,
      default: "Unknown"
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0
    },


    // ==================================================
    // PROCESSING STATUS
    // ==================================================

    status: {
      type: String,

      enum: [
        "uploaded",
        "processing",
        "extracting",
        "analyzing",
        "completed",
        "failed"
      ],

      default: "uploaded"
    },


    // ==================================================
    // DOCUMENT INFORMATION
    // ==================================================

    pageCount: {
      type: Number,
      default: 0
    },

    extractedText: {
      type: String,
      default: ""
    },


    // ==================================================
    // AI ANALYSIS
    // ==================================================

    summary: {
      type: String,
      default: ""
    },

    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    riskLevel: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High"
      ],
      default: "Low"
    },


    // ==================================================
    // RISKS
    // ==================================================

    risks: {
      type: [
        riskSchema
      ],
      default: []
    },


    // ==================================================
    // CLAUSES
    // ==================================================

    clauses: {
      type: [
        clauseSchema
      ],
      default: []
    },


    // ==================================================
    // MISSING CLAUSE DETECTION
    // ==================================================

    missingClauses: {
      type: [
        missingClauseSchema
      ],
      default: []
    },


    // ==================================================
    // DOCUMENT HEALTH REPORT
    // ==================================================

    healthReport: {
      type: healthReportSchema,
      default: () => ({})
    },


    // ==================================================
    // SAVED TRANSLATIONS
    // ==================================================

    translations: {
      type: Map,

      of: translationSchema,

      default: {}
    }
  },

  {
    timestamps: true
  }
);


// ======================================================
// MODEL
// ======================================================

export default mongoose.model(
  "Document",
  documentSchema
);