import "dotenv/config";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const models = await groq.models.list();

console.log("\nAVAILABLE MODELS:\n");

for (const model of models.data) {
  console.log(model.id);
}