import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface Vote {
  option: string;
  voter: string;
  timestamp: Date;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const votes: Vote[] = [];
const conversationHistory: ConversationMessage[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function getVotingResults(): string {
  if (votes.length === 0) {
    return "No votes have been cast yet.";
  }

  const voteCounts: { [key: string]: number } = {};
  for (const vote of votes) {
    voteCounts[vote.option] = (voteCounts[vote.option] || 0) + 1;
  }

  let results =
    "Current Voting Results:\n" +
    `Total votes: ${votes.length}\n` +
    "Vote breakdown:\n";

  for (const [option, count] of Object.entries(voteCounts)) {
    const percentage = ((count / votes.length) * 100).toFixed(1);
    const bar = "█".repeat(Math.floor(count / 2)) + "░".repeat(25 - Math.floor(count / 2));
    results += `${option}: ${count} votes (${percentage}%) [${bar}]\n`;
  }

  return results;
}

async function chat(userMessage: string): Promise<string> {
  conversationHistory.push({
    role: "user",
    content: userMessage,
  });

  const systemPrompt = `You are a helpful voting system assistant. You help users cast votes and view voting results.

Available commands you should help with:
- "vote <option>" - Cast a vote for an option
- "results" - Show current voting results
- "help" - Show available commands
- "quit" - Exit the voting system

Current voting results:
${getVotingResults()}

When a user wants to vote, acknowledge their vote and update the results.
When a user asks for results, provide the current voting statistics.
Be friendly and helpful in managing the voting process.`;

  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: systemPrompt,
    messages: conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  });

  const contentBlock = response.content[0];
  let assistantMessage = "";

  if (contentBlock.type === "text") {
    assistantMessage = contentBlock.text;
  }

  conversationHistory.push({
    role: "assistant",
    content: assistantMessage,
  });

  // Process voting commands
  const lowerMessage = userMessage.toLowerCase();
  if (lowerMessage.startsWith("vote ")) {
    const option = userMessage.substring(5).trim();
    if (option) {
      const voter = `User${Math.floor(Math.random() * 10000)}`;
      votes.push({
        option: option,
        voter: voter,
        timestamp: new Date(),
      });
    }
  }

  return assistantMessage;
}

async function main(): Promise<void> {
  console.log("=== Simple Voting System ===");
  console.log("Welcome to the voting system!");
  console.log('Type "help" to see available commands.');
  console.log('Type "quit" to exit.\n');

  // Initial greeting
  const greeting = await chat(
    "Hello! I want to use this voting system. What can I do?"
  );
  console.log(`Assistant: ${greeting}\n`);

  while (true) {
    const userInput = await question("You: ");

    if (userInput.toLowerCase() === "quit") {
      console.log(
        "Thank you for using the voting system. Final results:\n" +
          getVotingResults()
      );
      rl.close();
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    try {
      const response = await chat(userInput);
      console.log(`Assistant: ${response}\n`);
    } catch (error) {
      console.error("Error:", error);
      rl.close();
      break;
    }
  }
}

main();