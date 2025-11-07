import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
    env: "LOCAL",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    modelName: "gpt-4o",
    modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY!
    }
});

await stagehand.init();
const page = stagehand.context.pages()[0];

const agent = stagehand.agent({ systemPrompt: "you are a helpful agent" });

await page.goto("https://funhtml5games.com/2048/index.html");

// First run: uses LLM inference and caches
// Subsequent runs: reuses cached actions
const result = await agent.execute({
    instruction: "play a game of 2048",
    page: page
});

// console.log(JSON.stringify(result, null, 2));