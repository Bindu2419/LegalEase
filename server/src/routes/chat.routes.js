import { Router } from "express";
import auth from "../middleware/auth.js";
import Document from "../models/Document.js";
import { answerQuestion } from "../services/ai.service.js";

const router = Router();


// ======================================================
// ASK QUESTION ABOUT DOCUMENT
// ======================================================

router.post("/", auth, async (req, res) => {

  try {

    const {
      documentId,
      question,
      language
    } = req.body;


    // --------------------------------------------------
    // Validate request
    // --------------------------------------------------

    if (!documentId) {

      return res.status(400).json({
        message: "Document ID is required."
      });

    }


    if (
      !question ||
      !question.trim()
    ) {

      return res.status(400).json({
        message: "Question is required."
      });

    }


    // --------------------------------------------------
    // Find user's document
    // --------------------------------------------------

    const document =
      await Document.findOne({
        _id: documentId,
        userId: req.userId
      });


    if (!document) {

      return res.status(404).json({
        message: "Document not found."
      });

    }


    // --------------------------------------------------
    // Build document context
    // --------------------------------------------------

    let context = "";


    // Original extracted document
    if (
      document.extractedText &&
      document.extractedText.trim()
    ) {

      context += `
==============================
ORIGINAL DOCUMENT
==============================

${document.extractedText}

`;

    }


    // --------------------------------------------------
    // Add analyzed clauses
    // --------------------------------------------------

    if (
      Array.isArray(document.clauses) &&
      document.clauses.length > 0
    ) {

      context += `
==============================
ANALYZED KEY CLAUSES
==============================

`;

      document.clauses.forEach(
        (clause, index) => {

          context += `
Clause ${index + 1}:

Title:
${clause.title || "Key Clause"}

Explanation:
${clause.explanation || ""}

Risk:
${clause.risk || "Medium"}

Page:
${clause.pageNumber || "Not available"}

`;

        }
      );

    }


    // --------------------------------------------------
    // Add analyzed risks
    // --------------------------------------------------

    if (
      Array.isArray(document.risks) &&
      document.risks.length > 0
    ) {

      context += `
==============================
POTENTIAL RISKS
==============================

`;

      document.risks.forEach(
        (risk, index) => {

          context += `
Risk ${index + 1}:

Title:
${risk.title || "Potential Risk"}

Description:
${risk.description || ""}

Severity:
${risk.severity || "Medium"}

Page:
${risk.pageNumber || "Not available"}

`;

        }
      );

    }


    // --------------------------------------------------
    // Make sure context exists
    // --------------------------------------------------

    if (!context.trim()) {

      return res.status(400).json({
        message:
          "Document content is not available yet. Please wait for processing to complete."
      });

    }


    // --------------------------------------------------
    // Ask AI
    // --------------------------------------------------

    const result =
      await answerQuestion(
        question.trim(),
        context,
        language || "English"
      );


    // --------------------------------------------------
    // Return answer
    // --------------------------------------------------

    res.json(result);

  } catch (error) {

    console.error(
      "Chat route error:",
      error
    );


    res.status(500).json({
      message:
        error.message ||
        "Unable to answer the question."
    });

  }

});


export default router;