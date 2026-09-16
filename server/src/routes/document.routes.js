import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import auth from "../middleware/auth.js";
import Document from "../models/Document.js";

import {
  processDocument
} from "../services/document.service.js";

import {
  translateAnalysis,
  answerQuestion
} from "../services/ai.service.js";

const r = Router();

const dir = path.resolve("uploads");

fs.mkdirSync(dir, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, dir);
  },

  filename: (_, file, cb) => {
    const safeName =
      file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    cb(
      null,
      `${Date.now()}-${safeName}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (_, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF files are allowed."
        )
      );
    }
  }
});

const translationLocks = new Map();

function getTranslationKey(
  documentId,
  language
) {
  return `${documentId}:${language}`;
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function keywordScore(
  text,
  keywords = []
) {
  const normalized =
    normalizeText(text);

  let score = 0;

  for (const keyword of keywords) {
    if (
      normalized.includes(
        normalizeText(keyword)
      )
    ) {
      score++;
    }
  }

  return score;
}

function findRelevantSources(
  question,
  document
) {
  const normalizedQuestion =
    normalizeText(question);

  const questionWords =
    normalizedQuestion
      .split(" ")
      .filter(
        word =>
          word.length >= 3
      );

  const sources = [];

  const clauses =
    Array.isArray(document.clauses)
      ? document.clauses
      : [];

  clauses.forEach(
    (clause, index) => {
      const searchable =
        normalizeText(
          `${clause?.title || ""} ${
            clause?.explanation || ""
          }`
        );

      let score = 0;

      for (const word of questionWords) {
        if (
          searchable.includes(word)
        ) {
          score++;
        }
      }

      if (score > 0) {
        sources.push({
          type: "clause",

          title:
            clause?.title ||
            "Key Clause",

          pageNumber:
            clause?.pageNumber ??
            null,

          score,

          index
        });
      }
    }
  );

  const risks =
    Array.isArray(document.risks)
      ? document.risks
      : [];

  risks.forEach(
    (risk, index) => {
      const searchable =
        normalizeText(
          `${risk?.title || ""} ${
            risk?.description || ""
          }`
        );

      let score = 0;

      for (const word of questionWords) {
        if (
          searchable.includes(word)
        ) {
          score++;
        }
      }

      if (score > 0) {
        sources.push({
          type: "risk",

          title:
            risk?.title ||
            "Potential Risk",

          pageNumber:
            risk?.pageNumber ??
            null,

          severity:
            risk?.severity ||
            "Medium",

          score,

          index
        });
      }
    }
  );

  sources.sort(
    (a, b) =>
      b.score - a.score
  );

  const unique = [];
  const seen = new Set();

  for (const source of sources) {
    const key =
      `${source.type}-${source.index}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(source);
    }

    if (unique.length >= 5) {
      break;
    }
  }

  return unique;
}

function buildPageContext(
  extractedText,
  relevantSources
) {
  if (
    !extractedText ||
    typeof extractedText !==
      "string"
  ) {
    return "";
  }

  const pageBlocks =
    extractedText
      .split(
        /\n\n(?=Page\s+\d+)/i
      )
      .map(
        block =>
          block.trim()
      )
      .filter(Boolean);

  if (!relevantSources.length) {
    return pageBlocks
      .slice(0, 3)
      .join("\n\n")
      .slice(0, 6000);
  }

  const pageNumbers =
    new Set(
      relevantSources
        .map(source =>
          Number(
            source.pageNumber
          )
        )
        .filter(
          page =>
            !Number.isNaN(page)
        )
    );

  const selectedPages =
    pageBlocks.filter(
      block => {
        const match =
          block.match(
            /^Page\s+(\d+)/i
          );

        if (!match) {
          return false;
        }

        const pageNumber =
          Number(match[1]);

        return pageNumbers.has(
          pageNumber
        );
      }
    );

  if (!selectedPages.length) {
    return pageBlocks
      .slice(0, 3)
      .join("\n\n")
      .slice(0, 6000);
  }

  return selectedPages
    .join("\n\n")
    .slice(0, 7000);
}

function buildChatContext(
  document,
  question,
  sources
) {
  const relevantClauses =
    sources
      .filter(
        source =>
          source.type ===
          "clause"
      )
      .map(
        source =>
          document.clauses?.[
            source.index
          ]
      )
      .filter(Boolean);

  const relevantRisks =
    sources
      .filter(
        source =>
          source.type ===
          "risk"
      )
      .map(
        source =>
          document.risks?.[
            source.index
          ]
      )
      .filter(Boolean);

  const clauseContext =
    relevantClauses.length
      ? relevantClauses
          .map(
            clause =>
              `CLAUSE
Title: ${clause.title || ""}
Explanation: ${
                clause.explanation || ""
              }
Risk: ${
                clause.risk || ""
              }
Page: ${
                clause.pageNumber ??
                "Unknown"
              }`
          )
          .join("\n\n")
      : "";

  const riskContext =
    relevantRisks.length
      ? relevantRisks
          .map(
            risk =>
              `RISK
Title: ${risk.title || ""}
Description: ${
                risk.description || ""
              }
Severity: ${
                risk.severity || ""
              }
Page: ${
                risk.pageNumber ??
                "Unknown"
              }`
          )
          .join("\n\n")
      : "";

  const pageContext =
    buildPageContext(
      document.extractedText,
      sources
    );

  const summaryContext =
    document.summary
      ? `DOCUMENT SUMMARY:\n${document.summary}`
      : "";

  return `
QUESTION:
${question}

RELEVANT DOCUMENT PAGES:
${pageContext}

${clauseContext}

${riskContext}

${summaryContext}
`.trim();
}

function buildHealthReport(
  document,
  topConcerns
) {
  if (!document.healthReport) {
    return null;
  }

  return {
    ...document.healthReport,

    topConcerns:
      Array.isArray(topConcerns)
        ? topConcerns
        : document.healthReport.topConcerns ||
          []
  };
}

function documentResponse(
  document,
  data = {}
) {
  return {
    _id: document._id,

    filename:
      document.filename,

    documentType:
      document.documentType,

    confidence:
      document.confidence,

    status:
      document.status,

    pageCount:
      document.pageCount,

    riskScore:
      document.riskScore,

    riskLevel:
      document.riskLevel,

    summary:
      data.summary ??
      document.summary,

    clauses:
      data.clauses ??
      document.clauses,

    risks:
      data.risks ??
      document.risks,

    missingClauses:
      data.missingClauses ??
      document.missingClauses ??
      [],

    healthReport:
      data.healthReport ??
      document.healthReport ??
      null,

    language:
      data.language ||
      "English"
  };
}

// Upload PDF
r.post(
  "/upload",
  auth,
  upload.single("document"),

  async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            message:
              "PDF file required"
          });
      }

      const d =
        await Document.create({
          userId:
            req.userId,

          filename:
            req.file.originalname,

          filePath:
            req.file.path,

          status:
            "processing"
        });

      processDocument(
        d._id
      ).catch(
        async error => {
          console.error(
            "Document processing failed:",
            error.message
          );

          try {
            await Document.findByIdAndUpdate(
              d._id,
              {
                status: "failed"
              }
            );
          } catch (updateError) {
            console.error(
              "Failed to update document status:",
              updateError.message
            );
          }
        }
      );

      return res
        .status(201)
        .json({
          id: d._id,
          status:
            "processing"
        });
    } catch (error) {
      console.error(
        "Upload error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Upload failed."
        });
    }
  }
);

// Page-aware chatbot
r.post(
  "/chat",
  auth,

  async (req, res) => {
    try {
      const {
        documentId,
        question,
        language = "English"
      } = req.body;

      if (
        !documentId ||
        typeof documentId !==
          "string"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Document ID is required."
          });
      }

      if (
        !question ||
        typeof question !==
          "string" ||
        !question.trim()
      ) {
        return res
          .status(400)
          .json({
            message:
              "Question is required."
          });
      }

      if (
        typeof language !==
        "string"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Language must be a string."
          });
      }

      const document =
        await Document.findOne({
          _id: documentId,
          userId: req.userId
        });

      if (!document) {
        return res
          .status(404)
          .json({
            message:
              "Document not found."
          });
      }

      if (
        document.status !==
        "completed"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Document analysis is not complete yet. Please wait."
          });
      }

      const sources =
        findRelevantSources(
          question,
          document
        );

      const context =
        buildChatContext(
          document,
          question,
          sources
        );

      console.log(
        `Chat question for document ${document._id}`
      );

      console.log(
        `Relevant sources: ${sources.length}`
      );

      const result =
        await answerQuestion(
          question,
          context,
          language
        );

      const cleanSources =
        sources.map(
          source => {
            const resultSource = {
              type:
                source.type,

              title:
                source.title,

              pageNumber:
                source.pageNumber
            };

            if (
              source.type ===
              "risk"
            ) {
              resultSource.severity =
                source.severity;
            }

            return resultSource;
          }
        );

      return res.json({
        answer:
          result.answer,

        language:
          result.language,

        sources:
          cleanSources
      });
    } catch (error) {
      console.error(
        "Chat route error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Unable to answer the question right now."
        });
    }
  }
);

// Translate document
r.post(
  "/:id/translate",
  auth,

  async (req, res) => {
    const {
      language
    } = req.body;

    try {
      if (
        !language ||
        typeof language !==
          "string"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Language is required."
          });
      }

      const d =
        await Document.findOne({
          _id: req.params.id,
          userId: req.userId
        });

      if (!d) {
        return res
          .status(404)
          .json({
            message:
              "Document not found."
          });
      }

      if (
        d.status !==
        "completed"
      ) {
        return res
          .status(400)
          .json({
            message:
              "Document is still being processed. Please wait until analysis is complete."
          });
      }

      if (
        language ===
        "English"
      ) {
        return res.json(
          documentResponse(
            d,
            {
              summary:
                d.summary,

              clauses:
                d.clauses,

              risks:
                d.risks,

              missingClauses:
                d.missingClauses ||
                [],

              healthReport:
                d.healthReport ||
                null,

              language:
                "English"
            }
          )
        );
      }

      const saved =
        d.translations?.get(
          language
        );

      const validSavedTranslation =
        saved &&
        typeof saved ===
          "object" &&
        typeof saved.summary ===
          "string" &&
        Array.isArray(
          saved.clauses
        ) &&
        Array.isArray(
          saved.risks
        ) &&
        Array.isArray(
          saved.missingClauses
        ) &&
        Array.isArray(
          saved.topConcerns
        );

      if (
        validSavedTranslation
      ) {
        console.log(
          `Using saved ${language} translation`
        );

        return res.json(
          documentResponse(
            d,
            {
              summary:
                saved.summary,

              clauses:
                saved.clauses,

              risks:
                saved.risks,

              missingClauses:
                saved.missingClauses,

              healthReport:
                buildHealthReport(
                  d,
                  saved.topConcerns
                ),

              language
            }
          )
        );
      }

      const key =
        getTranslationKey(
          d._id.toString(),
          language
        );

      if (
        translationLocks.has(
          key
        )
      ) {
        console.log(
          `Translation already running for ${language}. Waiting for it.`
        );

        try {
          const translated =
            await translationLocks.get(
              key
            );

          const updated =
            await Document.findOne({
              _id:
                d._id,
              userId:
                req.userId
            });

          if (updated) {
            const savedTranslation =
              updated.translations?.get(
                language
              );

            if (
              savedTranslation
            ) {
              return res.json(
                documentResponse(
                  updated,
                  {
                    summary:
                      savedTranslation.summary,

                    clauses:
                      savedTranslation.clauses,

                    risks:
                      savedTranslation.risks,

                    missingClauses:
                      savedTranslation.missingClauses,

                    healthReport:
                      buildHealthReport(
                        updated,
                        savedTranslation.topConcerns
                      ),

                    language
                  }
                )
              );
            }
          }

          return res.json(
            documentResponse(
              d,
              {
                summary:
                  translated.summary ||
                  d.summary,

                clauses:
                  translated.clauses ||
                  d.clauses,

                risks:
                  translated.risks ||
                  d.risks,

                missingClauses:
                  translated.missingClauses ||
                  d.missingClauses ||
                  [],

                healthReport:
                  buildHealthReport(
                    d,
                    translated.topConcerns
                  ),

                language
              }
            )
          );
        } catch (error) {
          return res
            .status(500)
            .json({
              message:
                error.message ||
                "Translation failed."
            });
        }
      }

      console.log(
        `Creating new ${language} translation...`
      );

      const translationPromise =
        translateAnalysis(
          d.summary,
          d.clauses,
          d.risks,
          d.missingClauses ||
          [],
          d.healthReport?.topConcerns ||
          [],
          language
        );

      translationLocks.set(
        key,
        translationPromise
      );

      let translated;

      try {
        translated =
          await translationPromise;
      } finally {
        translationLocks.delete(
          key
        );
      }

      if (!translated) {
        throw new Error(
          "Translation returned no result."
        );
      }

      if (!d.translations) {
        d.translations =
          new Map();
      }

      d.translations.set(
        language,
        {
          summary:
            translated.summary ||
            d.summary,

          clauses:
            Array.isArray(
              translated.clauses
            )
              ? translated.clauses
              : d.clauses,

          risks:
            Array.isArray(
              translated.risks
            )
              ? translated.risks
              : d.risks,

          missingClauses:
            Array.isArray(
              translated.missingClauses
            )
              ? translated.missingClauses
              : d.missingClauses ||
                [],

          topConcerns:
            Array.isArray(
              translated.topConcerns
            )
              ? translated.topConcerns
              : d.healthReport?.topConcerns ||
                []
        }
      );

      await d.save();

      console.log(
        `${language} translation saved successfully`
      );

      return res.json(
        documentResponse(
          d,
          {
            summary:
              translated.summary ||
              d.summary,

            clauses:
              translated.clauses ||
              d.clauses,

            risks:
              translated.risks ||
              d.risks,

            missingClauses:
              translated.missingClauses ||
              d.missingClauses ||
              [],

            healthReport:
              buildHealthReport(
                d,
                translated.topConcerns
              ),

            language
          }
        )
      );
    } catch (error) {
      const key =
        language
          ? getTranslationKey(
              req.params.id,
              language
            )
          : null;

      if (key) {
        translationLocks.delete(
          key
        );
      }

      console.error(
        "Translation error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Translation failed."
        });
    }
  }
);

// Get all documents
r.get(
  "/",
  auth,

  async (req, res) => {
    try {
      const documents =
        await Document
          .find({
            userId:
              req.userId
          })
          .select(
            "-extractedText"
          )
          .sort({
            createdAt: -1
          });

      return res.json(
        documents
      );
    } catch (error) {
      console.error(
        "Get documents error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            "Unable to load documents."
        });
    }
  }
);

// Get one document
r.get(
  "/:id",
  auth,

  async (req, res) => {
    try {
      const d =
        await Document
          .findOne({
            _id:
              req.params.id,

            userId:
              req.userId
          })
          .select(
            "-extractedText"
          );

      if (!d) {
        return res
          .status(404)
          .json({
            message:
              "Document not found"
          });
      }

      return res.json(d);
    } catch (error) {
      console.error(
        "Get document error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            "Unable to load document."
        });
    }
  }
);

// Delete document
r.delete(
  "/:id",
  auth,

  async (req, res) => {
    try {
      const d =
        await Document
          .findOneAndDelete({
            _id:
              req.params.id,

            userId:
              req.userId
          });

      if (!d) {
        return res
          .status(404)
          .json({
            message:
              "Document not found"
          });
      }

      try {
        if (d.filePath) {
          await fs.promises.unlink(
            d.filePath
          );
        }
      } catch (fileError) {
        console.log(
          "Could not delete PDF file:",
          fileError.message
        );
      }

      return res.json({
        message:
          "Deleted"
      });
    } catch (error) {
      console.error(
        "Delete document error:",
        error.message
      );

      return res
        .status(500)
        .json({
          message:
            "Unable to delete document."
        });
    }
  }
);

// Multer errors
r.use(
  (
    error,
    req,
    res,
    next
  ) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res
          .status(400)
          .json({
            message:
              "File is too large. Maximum size is 10 MB."
          });
      }

      return res
        .status(400)
        .json({
          message:
            error.message
        });
    }

    if (
      error &&
      error.message ===
        "Only PDF files are allowed."
    ) {
      return res
        .status(400)
        .json({
          message:
            error.message
        });
    }

    next(error);
  }
);

export default r;