import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  timeout: 90000
});

const MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const TRANSLATION_MODEL =
  process.env.GROQ_TRANSLATION_MODEL ||
  "qwen/qwen3.8-27b";

const FALLBACK_MODEL =
  process.env.GROQ_FALLBACK_MODEL ||
  "qwen/qwen3.8-27b";

const MAX_CHARS_PER_CHUNK = 5000;
const CHAT_CONTEXT_CHARS = 7000;

const ANALYSIS_CONCURRENCY = 1;

const TRANSLATION_BATCH_SIZE = 3;
const TRANSLATION_BATCH_DELAY = 500;

let PRIMARY_MODEL_LIMIT_REACHED = false;

const sleep = ms =>
  new Promise(resolve =>
    setTimeout(resolve, ms)
  );

async function groqRequest(
  createRequest,
  label = "Groq request"
) {
  const maxRetries = 4;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      return await createRequest();
    } catch (error) {
      const status =
        error?.status ||
        error?.response?.status;

      const message =
        String(
          error?.message || ""
        ).toLowerCase();

      const isDailyTokenLimit =
        message.includes("tokens per day") ||
        message.includes("token per day") ||
        message.includes("daily token") ||
        message.includes("tpd") ||
        message.includes("limit 200000");

      if (isDailyTokenLimit) {
        const dailyLimitError =
          new Error(
            `Groq daily token limit reached: ${
              error?.message ||
              "tokens per day limit"
            }`
          );

        dailyLimitError.code =
          "GROQ_DAILY_TOKEN_LIMIT";

        dailyLimitError.originalError =
          error;

        throw dailyLimitError;
      }

      const isRateLimit =
        status === 429 ||
        message.includes("rate limit") ||
        message.includes("tokens per minute") ||
        message.includes("too many requests");

      const isTimeout =
        message.includes("timed out") ||
        message.includes("timeout") ||
        message.includes("etimedout") ||
        message.includes("request timed out");

      if (
        !isRateLimit &&
        !isTimeout
      ) {
        throw error;
      }

      if (
        attempt === maxRetries
      ) {
        throw error;
      }

      const waitMs =
        isTimeout
          ? 4000 * attempt
          : 2500 * attempt;

      console.log(
        `${label} retry ${attempt}/${maxRetries} after ${waitMs}ms...`
      );

      await sleep(waitMs);
    }
  }

  throw new Error(
    `${label} failed.`
  );
}

function splitPage(page) {
  if (
    !page?.text ||
    typeof page.text !== "string" ||
    !page.text.trim()
  ) {
    return [];
  }

  const chunks = [];

  for (
    let i = 0;
    i < page.text.length;
    i += MAX_CHARS_PER_CHUNK
  ) {
    chunks.push({
      pageNumber: page.pageNumber,
      text: page.text.slice(
        i,
        i + MAX_CHARS_PER_CHUNK
      )
    });
  }

  return chunks;
}

function normalizeRiskScore(score) {
  const value = Number(score);

  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(value)
    )
  );
}

function normalizeRiskLevel(value) {
  const level =
    String(value || "Medium")
      .trim()
      .toLowerCase();

  if (level === "low") {
    return "Low";
  }

  if (level === "high") {
    return "High";
  }

  return "Medium";
}

function calculateFallbackRiskScore(
  clauses = [],
  risks = []
) {
  let score = 0;

  for (const risk of risks) {
    const severity =
      normalizeRiskLevel(
        risk?.severity
      );

    if (severity === "High") {
      score += 30;
    } else if (
      severity === "Medium"
    ) {
      score += 15;
    } else {
      score += 5;
    }
  }

  for (const clause of clauses) {
    const severity =
      normalizeRiskLevel(
        clause?.risk
      );

    if (severity === "High") {
      score += 20;
    } else if (
      severity === "Medium"
    ) {
      score += 10;
    }
  }

  return Math.min(
    100,
    score
  );
}

function normalizeClauses(
  clauses,
  pageNumber
) {
  if (!Array.isArray(clauses)) {
    return [];
  }

  return clauses
    .map(item => {
      if (
        typeof item === "string"
      ) {
        return {
          title: item,
          explanation: item,
          risk: "Medium",
          pageNumber
        };
      }

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const actualPage =
        Number(item.pageNumber);

      return {
        title:
          item.title ||
          item.clauseType ||
          item.name ||
          "Key Clause",

        explanation:
          item.explanation ||
          item.simpleExplanation ||
          item.description ||
          item.text ||
          "",

        risk:
          normalizeRiskLevel(
            item.risk ||
            item.riskLevel ||
            item.severity
          ),

        pageNumber:
          Number.isFinite(
            actualPage
          ) &&
          actualPage > 0
            ? actualPage
            : pageNumber
      };
    })
    .filter(Boolean);
}

function normalizeRisks(
  risks,
  pageNumber
) {
  if (!Array.isArray(risks)) {
    return [];
  }

  return risks
    .map(item => {
      if (
        typeof item === "string"
      ) {
        return {
          title: "Potential Risk",
          description: item,
          severity: "Medium",
          pageNumber
        };
      }

      if (
        !item ||
        typeof item !== "object"
      ) {
        return null;
      }

      const actualPage =
        Number(item.pageNumber);

      return {
        title:
          item.title ||
          item.name ||
          "Potential Risk",

        description:
          item.description ||
          item.explanation ||
          "",

        severity:
          normalizeRiskLevel(
            item.severity ||
            item.risk
          ),

        pageNumber:
          Number.isFinite(
            actualPage
          ) &&
          actualPage > 0
            ? actualPage
            : pageNumber
      };
    })
    .filter(Boolean);
}

function stripJsonFences(
  content
) {
  return String(
    content || ""
  )
    .replace(
      /^```json\s*/i,
      ""
    )
    .replace(
      /^```\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
}

async function createAnalysisCompletion(
  prompt,
  pageNumber
) {
  const run = model =>
    groqRequest(
      () =>
        groq.chat.completions.create({
          model,
          temperature: 0.1,
          max_tokens: 700,

          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),

      `Analysis page ${pageNumber}`
    );

  if (
    PRIMARY_MODEL_LIMIT_REACHED
  ) {
    return run(
      FALLBACK_MODEL
    );
  }

  try {
    return await run(
      MODEL
    );
  } catch (error) {
    if (
      error?.code ===
        "GROQ_DAILY_TOKEN_LIMIT" &&
      FALLBACK_MODEL &&
      FALLBACK_MODEL !== MODEL
    ) {
      PRIMARY_MODEL_LIMIT_REACHED =
        true;

      console.warn(
        `Primary model ${MODEL} reached its daily token limit.`
      );

      console.warn(
        `Switching to fallback model ${FALLBACK_MODEL} for this document.`
      );

      return run(
        FALLBACK_MODEL
      );
    }

    throw error;
  }
}

async function analyzeChunk(
  chunk,
  index,
  total,
  type
) {
  console.log(
    `Analyzing page ${chunk.pageNumber} (${index + 1}/${total})...`
  );

  const prompt = `
You are LegalEase, an AI legal-document literacy assistant.

Analyze this section of a ${type} document.

Page:
${chunk.pageNumber}

Rules:
- Use simple language.
- Use only the provided text.
- Do not invent information.
- Do not create clauses that are not present.
- Do not determine guilt or innocence.
- Do not say something is definitely illegal.
- Identify important risks.
- Risk assessment is informational.
- Keep the output short.
- Return only the most important 3 clauses.
- Return only the most important 3 risks.

Return valid JSON:

{
  "summary": "Short simple explanation",
  "riskScore": 50,
  "clauses": [
    {
      "title": "Clause name",
      "explanation": "Short explanation",
      "risk": "Low",
      "pageNumber": ${chunk.pageNumber}
    }
  ],
  "risks": [
    {
      "title": "Risk title",
      "description": "Short explanation",
      "severity": "Low",
      "pageNumber": ${chunk.pageNumber}
    }
  ]
}

Use:
- risk: Low, Medium, or High
- severity: Low, Medium, or High
- pageNumber: ${chunk.pageNumber}
- riskScore must reflect the risks found in this section.
- Use 0 only when there are no meaningful risks.
- Do not return 0 when meaningful risks are present.

If there are no clauses or risks, return [].

TEXT:
${chunk.text}
`;

  try {
    const response =
      await createAnalysisCompletion(
        prompt,
        chunk.pageNumber
      );

    const content =
      response
        ?.choices?.[0]
        ?.message?.content;

    if (!content) {
      console.log(
        `No response for page ${chunk.pageNumber}`
      );

      return null;
    }

    let result;

    try {
      result =
        JSON.parse(
          stripJsonFences(
            content
          )
        );
    } catch (parseError) {
      console.error(
        `Invalid JSON on page ${chunk.pageNumber}:`,
        parseError.message
      );

      return null;
    }

    const clauses =
      normalizeClauses(
        result.clauses,
        chunk.pageNumber
      );

    const risks =
      normalizeRisks(
        result.risks,
        chunk.pageNumber
      );

    let riskScore =
      normalizeRiskScore(
        result.riskScore
      );

    if (
      riskScore === 0 &&
      (
        risks.length > 0 ||
        clauses.some(
          clause =>
            normalizeRiskLevel(
              clause?.risk
            ) !== "Low"
        )
      )
    ) {
      riskScore =
        calculateFallbackRiskScore(
          clauses,
          risks
        );
    }

    return {
      summary:
        typeof result.summary ===
        "string"
          ? result.summary.trim()
          : "",

      riskScore,

      clauses,

      risks
    };
  } catch (error) {
    console.error(
      `Groq error on page ${chunk.pageNumber}:`,
      error.message
    );

    return null;
  }
}

export async function analyzeText(
  pages,
  type
) {
  PRIMARY_MODEL_LIMIT_REACHED =
    false;

  const chunks =
    Array.isArray(pages)
      ? pages.flatMap(
          splitPage
        )
      : [];

  if (!chunks.length) {
    throw new Error(
      "No document text available for analysis."
    );
  }

  const results =
    new Array(
      chunks.length
    );

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index =
        nextIndex++;

      if (
        index >=
        chunks.length
      ) {
        return;
      }

      results[index] =
        await analyzeChunk(
          chunks[index],
          index,
          chunks.length,
          type
        );
    }
  }

  const workerCount =
    Math.min(
      ANALYSIS_CONCURRENCY,
      chunks.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount
      },
      worker
    )
  );

  const validResults =
    results.filter(Boolean);

  if (
    !validResults.length
  ) {
    throw new Error(
      "Unable to analyze the document."
    );
  }

  if (
    validResults.length <
    chunks.length
  ) {
    console.log(
      `Analysis completed with ${
        chunks.length -
        validResults.length
      } failed chunk(s).`
    );
  }

  const summaries =
    validResults
      .map(
        item =>
          item.summary
      )
      .filter(Boolean);

  const clauses =
    validResults.flatMap(
      item =>
        Array.isArray(
          item.clauses
        )
          ? item.clauses
          : []
    );

  const risks =
    validResults.flatMap(
      item =>
        Array.isArray(
          item.risks
        )
          ? item.risks
          : []
    );

  const scores =
    validResults
      .map(item =>
        normalizeRiskScore(
          item.riskScore
        )
      )
      .filter(
        Number.isFinite
      );

  const riskScore =
    scores.length
      ? Math.min(
          100,
          Math.round(
            scores.reduce(
              (a, b) =>
                a + b,
              0
            ) /
              scores.length
          )
        )
      : calculateFallbackRiskScore(
          clauses,
          risks
        );

  return {
    summary:
      summaries
        .join(" ")
        .trim(),

    riskScore,

    clauses,

    risks
  };
}

export async function summarizeText(
  text
) {
  if (
    !text ||
    typeof text !== "string"
  ) {
    return "";
  }

  const limitedText =
    text.slice(
      0,
      CHAT_CONTEXT_CHARS
    );

  const prompt = `
Create a concise plain-language summary of this legal document text.

Rules:
- Use only the provided text.
- Do not invent information.
- Do not provide legal advice.
- Do not determine guilt or innocence.
- Explain the document in simple language.
- Mention important obligations, payments, dates, penalties, rights, and risks if present.
- Keep it concise.

TEXT:
${limitedText}
`;

  const response =
    await groqRequest(
      () =>
        groq.chat.completions.create({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 450,

          messages: [
            {
              role: "system",
              content:
                "You are LegalEase, an AI legal-document literacy assistant."
            },

            {
              role: "user",
              content: prompt
            }
          ]
        }),

      "Document summary"
    );

  return (
    response
      ?.choices?.[0]
      ?.message?.content
      ?.trim() || ""
  );
}

export async function answerQuestion(
  question,
  context,
  language = "English"
) {
  if (
    !question ||
    typeof question !== "string"
  ) {
    return "";
  }

  const safeContext =
    typeof context === "string"
      ? context.slice(
          0,
          CHAT_CONTEXT_CHARS
        )
      : "";

  const prompt = `
Answer the user's question using ONLY the provided document context.

Rules:
- Use simple language.
- Do not invent facts.
- Do not assume missing information.
- Do not provide definitive legal advice.
- Do not determine guilt or innocence.
- Clearly say when the answer is not present in the document.
- Refer to page numbers when the context provides them.
- Answer in ${language}.
- Keep the answer concise and useful.

QUESTION:
${question}

DOCUMENT CONTEXT:
${safeContext}
`;

  const response =
    await groqRequest(
      () =>
        groq.chat.completions.create({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 500,

          messages: [
            {
              role: "system",
              content:
                "You are LegalEase, an AI legal literacy assistant."
            },

            {
              role: "user",
              content: prompt
            }
          ]
        }),

      "Document question"
    );

  return (
    response
      ?.choices?.[0]
      ?.message?.content
      ?.trim() || ""
  );
}

async function translateText(
  text,
  language
) {
  if (
    !text ||
    typeof text !== "string"
  ) {
    return "";
  }

  const prompt = `
Translate the following legal-document text into ${language}.

Rules:
- Preserve the original meaning.
- Do not add information.
- Do not remove information.
- Keep names, numbers, dates, amounts, section numbers and legal terms accurate.
- Use natural and simple ${language}.
- Return only the translation.

TEXT:
${text}
`;

  const response =
    await groqRequest(
      () =>
        groq.chat.completions.create({
          model:
            TRANSLATION_MODEL,

          temperature:
            0.1,

          reasoning_effort:
            "none",

          max_tokens:
            900,

          messages: [
            {
              role: "system",

              content:
                "You are a precise legal translation assistant. Translate only the text provided by the user."
            },

            {
              role: "user",

              content:
                prompt
            }
          ]
        }),

      `Translation to ${language}`
    );

  return (
    response
      ?.choices?.[0]
      ?.message?.content
      ?.trim() || ""
  );
}

function parseItemBlocks(
  content,
  input,
  fieldType
) {
  const results = [];

  for (
    let i = 0;
    i < input.length;
    i++
  ) {
    const current =
      input[i];

    const nextIndex =
      i + 1 < input.length
        ? input[
            i + 1
          ].index
        : null;

    const pattern =
      nextIndex === null
        ? new RegExp(
            `ITEM\\s+${current.index}\\s*\\n([\\s\\S]*)$`,
            "i"
          )
        : new RegExp(
            `ITEM\\s+${current.index}\\s*\\n([\\s\\S]*?)(?=\\nITEM\\s+${nextIndex}\\s*\\n|$)`,
            "i"
          );

    const match =
      String(
        content || ""
      ).match(
        pattern
      );

    if (!match) {
      continue;
    }

    const block =
      match[1];

    const secondLabel =
      fieldType ===
      "clause"
        ? "EXPLANATION"
        : "DESCRIPTION";

    const firstMatch =
      block.match(
        /TITLE:\s*\n([\s\S]*?)(?=\n(?:EXPLANATION|DESCRIPTION):|$)/i
      );

    const secondMatch =
      block.match(
        new RegExp(
          `${secondLabel}:\\s*\\n([\\s\\S]*)$`,
          "i"
        )
      );

    results.push({
      index:
        current.index,

      title:
        firstMatch?.[1]
          ?.trim() ||
        current.title,

      [fieldType ===
      "clause"
        ? "explanation"
        : "description"]:
        secondMatch?.[1]
          ?.trim() ||
        (
          fieldType ===
          "clause"
            ? current.explanation
            : current.description
        )
    });
  }

  return results;
}

async function translateClauseBatch(
  clauses,
  language
) {
  const input =
    clauses.map(
      (
        item,
        index
      ) => ({
        index,

        title:
          item?.title ||
          "",

        explanation:
          item?.explanation ||
          ""
      })
    );

  const source =
    input
      .map(
        item =>
          `ITEM ${item.index}
TITLE:
${item.title}
EXPLANATION:
${item.explanation}`
      )
      .join(
        "\n\n"
      );

  const response =
    await groqRequest(
      () =>
        groq.chat.completions.create({
          model:
            TRANSLATION_MODEL,

          temperature:
            0.1,

          reasoning_effort:
            "none",

          max_tokens:
            900,

          messages: [
            {
              role: "system",

              content: `
Translate legal clauses into ${language}.

Rules:
- Translate title and explanation only.
- Keep the legal meaning.
- Do not add information.
- Do not remove information.
- Keep item numbers.
- Do not use JSON.
- Do not use markdown.

Format:

ITEM 0
TITLE:
translated title
EXPLANATION:
translated explanation
`
            },

            {
              role: "user",

              content:
                source
            }
          ]
        }),

      `Clause translation to ${language}`
    );

  const content =
    response
      ?.choices?.[0]
      ?.message?.content
      ?.trim();

  if (!content) {
    throw new Error(
      "No clause translation response."
    );
  }

  const results =
    parseItemBlocks(
      content,
      input,
      "clause"
    );

  if (
    !results.length
  ) {
    throw new Error(
      "Could not parse clause translation."
    );
  }

  return results;
}

async function translateSingleClause(
  clause,
  language
) {
  return {
    title:
      await translateText(
        clause?.title ||
          "",
        language
      ),

    explanation:
      await translateText(
        clause?.explanation ||
          "",
        language
      )
  };
}

async function translateRiskBatch(
  risks,
  language
) {
  const input =
    risks.map(
      (
        item,
        index
      ) => ({
        index,

        title:
          item?.title ||
          "",

        description:
          item?.description ||
          ""
      })
    );

  const source =
    input
      .map(
        item =>
          `ITEM ${item.index}
TITLE:
${item.title}
DESCRIPTION:
${item.description}`
      )
      .join(
        "\n\n"
      );

  const response =
    await groqRequest(
      () =>
        groq.chat.completions.create({
          model:
            TRANSLATION_MODEL,

          temperature:
            0.1,

          reasoning_effort:
            "none",

          max_tokens:
            900,

          messages: [
            {
              role: "system",

              content: `
Translate legal risks into ${language}.

Rules:
- Translate title and description only.
- Keep the legal meaning.
- Do not add information.
- Do not remove information.
- Keep item numbers.
- Do not use JSON.
- Do not use markdown.

Format:

ITEM 0
TITLE:
translated title
DESCRIPTION:
translated description
`
            },

            {
              role: "user",

              content:
                source
            }
          ]
        }),

      `Risk translation to ${language}`
    );

  const content =
    response
      ?.choices?.[0]
      ?.message?.content
      ?.trim();

  if (!content) {
    throw new Error(
      "No risk translation response."
    );
  }

  const results =
    parseItemBlocks(
      content,
      input,
      "risk"
    );

  if (
    !results.length
  ) {
    throw new Error(
      "Could not parse risk translation."
    );
  }

  return results;
}

async function translateSingleRisk(
  risk,
  language
) {
  return {
    title:
      await translateText(
        risk?.title ||
          "",
        language
      ),

    description:
      await translateText(
        risk?.description ||
          "",
        language
      )
  };
}

async function translateSingleMissingClause(
  item,
  language
) {
  return {
    title:
      await translateText(
        item?.title ||
          "",
        language
      ),

    description:
      await translateText(
        item?.description ||
          "",
        language
      )
  };
}

export async function translateAnalysis(
  summary,
  clauses = [],
  risks = [],
  missingClauses = [],
  topConcerns = [],
  language = "English"
) {
  const safeSummary =
    typeof summary ===
    "string"
      ? summary
      : "";

  const safeClauses =
    Array.isArray(
      clauses
    )
      ? clauses
      : [];

  const safeRisks =
    Array.isArray(
      risks
    )
      ? risks
      : [];

  const safeMissingClauses =
    Array.isArray(
      missingClauses
    )
      ? missingClauses
      : [];

  const safeTopConcerns =
    Array.isArray(
      topConcerns
    )
      ? topConcerns
      : [];

  if (
    language ===
    "English"
  ) {
    return {
      summary:
        safeSummary,

      clauses:
        safeClauses,

      risks:
        safeRisks,

      missingClauses:
        safeMissingClauses,

      topConcerns:
        safeTopConcerns,

      language
    };
  }

  console.log(
    `Starting translation to ${language}...`
  );

  const translatedSummary =
    await translateText(
      safeSummary,
      language
    );

  const translatedClauses =
    [];

  for (
    let i = 0;
    i <
      safeClauses.length;
    i +=
      TRANSLATION_BATCH_SIZE
  ) {
    const batch =
      safeClauses.slice(
        i,
        i +
          TRANSLATION_BATCH_SIZE
      );

    console.log(
      `Translating clauses ${i + 1}-${i + batch.length} of ${safeClauses.length}...`
    );

    let translatedBatch =
      [];

    try {
      translatedBatch =
        await translateClauseBatch(
          batch,
          language
        );
    } catch (error) {
      console.error(
        "Clause batch failed:",
        error.message
      );

      for (
        let j = 0;
        j <
          batch.length;
        j++
      ) {
        try {
          const translated =
            await translateSingleClause(
              batch[j],
              language
            );

          translatedBatch.push({
            index:
              j,

            ...translated
          });
        } catch (
          singleError
        ) {
          console.error(
            `Clause ${i + j + 1} failed:`,
            singleError.message
          );
        }
      }
    }

    for (
      let j = 0;
      j <
        batch.length;
      j++
    ) {
      const original =
        batch[j];

      const translatedItem =
        translatedBatch.find(
          item =>
            Number(
              item?.index
            ) === j
        );

      translatedClauses.push({
        title:
          translatedItem?.title ||
          original?.title ||
          "Key Clause",

        explanation:
          translatedItem?.explanation ||
          original?.explanation ||
          "",

        risk:
          normalizeRiskLevel(
            original?.risk
          ),

        pageNumber:
          original?.pageNumber ??
          null
      });
    }

    if (
      i +
        TRANSLATION_BATCH_SIZE <
      safeClauses.length
    ) {
      await sleep(
        TRANSLATION_BATCH_DELAY
      );
    }
  }

  const translatedRisks =
    [];

  for (
    let i = 0;
    i <
      safeRisks.length;
    i +=
      TRANSLATION_BATCH_SIZE
  ) {
    const batch =
      safeRisks.slice(
        i,
        i +
          TRANSLATION_BATCH_SIZE
      );

    console.log(
      `Translating risks ${i + 1}-${i + batch.length} of ${safeRisks.length}...`
    );

    let translatedBatch =
      [];

    try {
      translatedBatch =
        await translateRiskBatch(
          batch,
          language
        );
    } catch (error) {
      console.error(
        "Risk batch failed:",
        error.message
      );

      for (
        let j = 0;
        j <
          batch.length;
        j++
      ) {
        try {
          const translated =
            await translateSingleRisk(
              batch[j],
              language
            );

          translatedBatch.push({
            index:
              j,

            ...translated
          });
        } catch (
          singleError
        ) {
          console.error(
            `Risk ${i + j + 1} failed:`,
            singleError.message
          );
        }
      }
    }

    for (
      let j = 0;
      j <
        batch.length;
      j++
    ) {
      const original =
        batch[j];

      const translatedItem =
        translatedBatch.find(
          item =>
            Number(
              item?.index
            ) === j
        );

      translatedRisks.push({
        title:
          translatedItem?.title ||
          original?.title ||
          "Potential Risk",

        description:
          translatedItem?.description ||
          original?.description ||
          "",

        severity:
          normalizeRiskLevel(
            original?.severity
          ),

        pageNumber:
          original?.pageNumber ??
          null
      });
    }

    if (
      i +
        TRANSLATION_BATCH_SIZE <
      safeRisks.length
    ) {
      await sleep(
        TRANSLATION_BATCH_DELAY
      );
    }
  }

  const translatedMissingClauses =
    [];

  for (
    let i = 0;
    i <
      safeMissingClauses.length;
    i++
  ) {
    const original =
      safeMissingClauses[i];

    console.log(
      `Translating missing clause ${i + 1} of ${safeMissingClauses.length}...`
    );

    try {
      const translated =
        await translateSingleMissingClause(
          original,
          language
        );

      translatedMissingClauses.push({
        title:
          translated.title ||
          original?.title ||
          "",

        description:
          translated.description ||
          original?.description ||
          "",

        status:
          original?.status ||
          "Not Found",

        importance:
          original?.importance ||
          "Medium"
      });
    } catch (error) {
      console.error(
        `Missing clause ${i + 1} failed:`,
        error.message
      );

      translatedMissingClauses.push({
        title:
          original?.title ||
          "",

        description:
          original?.description ||
          "",

        status:
          original?.status ||
          "Not Found",

        importance:
          original?.importance ||
          "Medium"
      });
    }

    if (
      i + 1 <
      safeMissingClauses.length
    ) {
      await sleep(
        TRANSLATION_BATCH_DELAY
      );
    }
  }

  const translatedTopConcerns =
    [];

  for (
    let i = 0;
    i <
      safeTopConcerns.length;
    i++
  ) {
    const concern =
      safeTopConcerns[i];

    try {
      const translatedTitle =
        await translateText(
          concern?.title ||
            "",
          language
        );

      translatedTopConcerns.push({
        title:
          translatedTitle ||
          concern?.title ||
          "",

        pageNumber:
          concern?.pageNumber ??
          null,

        severity:
          concern?.severity ||
          null,

        importance:
          concern?.importance ||
          null,

        type:
          concern?.type ||
          ""
      });
    } catch (error) {
      console.error(
        `Top concern ${i + 1} translation failed:`,
        error.message
      );

      translatedTopConcerns.push({
        ...concern
      });
    }

    if (
      i <
      safeTopConcerns.length -
        1
    ) {
      await sleep(
        250
      );
    }
  }

  console.log(
    `Translation to ${language} completed.`
  );

  return {
    summary:
      translatedSummary ||
      safeSummary ||
      "",

    clauses:
      translatedClauses,

    risks:
      translatedRisks,

    missingClauses:
      translatedMissingClauses,

    topConcerns:
      translatedTopConcerns,

    language
  };
}