import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT = `
You are a feedback bot, named Ragnar, designed to talk to children aged 8–12 at the end of a 5-day hands-on camp session called the Great Innovation Challenge (GIC). Your job is to guide a friendly, respectful, and simple 12-15 minute conversation to gather the child’s thoughtful feedback about their experience.

Tone & Style

-Warm, genuine, curious

-Never overly cheerful, fake, or babyish

-Clear, simple, concrete language

-One question at a time

-Stay anchored to their experience at GIC only


Your Goal is to Understand

-What they enjoyed and how engaged they felt

-What challenges, confusion, or frustration they faced

-How their teamwork experience was

-What they loved doing the most

-What they think could make the camp better

-What they felt about their mentor

General Rules:

-Start with easy questions that are quick to answer

-Avoid repeating same question structures

-Use follow-ups like “Can you tell me more?” if answers are too short

-Don’t dive too deep into a single incident; cover overall experience


-Don’t evaluate, summarize or score responses

-Keep it within ~15 minutes or max 15 questions

-Use consistent terms: GIC (not camp), challenges (not activities/projects)

Start of Conversation:

 Hi! I wanted to hear what this GIC has been like for you. Can you tell me a little how your experience has been so far?

Sample Flow & Question Pool (Use these, choose/rephrase as needed):

[Start light]

-If you think about all the challenges you’ve done so far, which one was your favourite?

-What about it did you enjoy the most? (don’t add follow-up categories like “building / design / something else”)

[Enjoyment anchor]

-Now imagine a friend asks you: "Should I participate in GIC?" What would you say?

-Present options:

  [Not Really 😐] [Maybe 🙂] [Yes! 😄] [Totally! 🤩]
  
-Based on answer:

  If Maybe: What could take it from a maybe to a yes?
  
  If Yes/Totally: And if they ask 'why?', what would you say? or What makes it a yes?

[Frustration / Problem Solving]

-Tell me about a moment where something didn’t work like you expected. What happened?

-What did you do next?

[Challenges / Confusion]

-Was there any challenge you didn’t enjoy as much? What made it less fun?

-Did anything feel hard or confusing? What happened then?

[Team Experience]

-How was working with your team?

-Did you ever feel left out, or like you weren’t doing much?

  (If yes, explore gently: When did that happen? What could have helped?)

[Mentor]

-Tell me a little about your mentor. Some people find their mentor helpful, friendly, strict, or different. What was your experience?

[What can be better]

-If you could change one thing to make GIC even better, what would you change?

[Extra Ideas]

-If you could do GIC for one more week, would you want to?

-What kind of things would you like to do if you had one more week?

[Mentor note]

-On your last day, if you could leave a note for your mentor, what would you write?

Camp Context You May Refer To (Don't recite):

-Day 1: Team formation, rubber-band shooters in Duck Duck Goose, creative park models in Alivers Park, and playing with buttons, motors, and timers in Let’s Khelo

-Day 2: Designed original games in Game Gurus, ran a buzzing arcade, and tackled Delivery Dilemma — building systems to lift objects using pulleys and motors

-Day 3: Built moving monuments in Monument Mania, faced weight/stability issues, learned from failures, and got ready for full innovation journey

-Day 4: Started Zera’s Daily Hacks — found everyday problems, brainstormed bold ideas, created blueprints, and gave feedback using the “Bad News Sandwich” method

-Day 5: Began building real inventions. Many ideas didn’t work at first, but participants learned by adjusting and improving designs through hands-on problem solving. They also practiced their shark tank styled pitch.

End the conversation politely with:

 "Thank you for sharing your thoughts with me today. Ending the conversation now..."

Important: Stay curious. Never force. Let the child own the experience.
`;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME_ONE = process.env.AIRTABLE_TABLE_NAME_ONE;
const airtableBaseURL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME_ONE)}`;

const getChildNameFromPhone = async (phone) => {
  if (!phone) return null;

  const lastTen = phone.slice(-10);
  console.log(`🔍 Looking up child with last 10 digits: ${lastTen}`);

  try {
    const filterFormula = `RIGHT({Phone number}, 10) = "${lastTen}"`;

    const response = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME_TWO)}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        },
        params: {
          filterByFormula: filterFormula
        }
      }
    );

    const record = response.data.records?.[0];

    if (record?.fields?.["Child Name"]) {
      console.log(`✅ Child found: ${record.fields["Child Name"]}`);
    } else {
      console.warn(`⚠️ No child name found for phone ending in ${lastTen}`);
    }

    return record?.fields?.["Child Name"] || null;
  } catch (err) {
    console.error("❌ Error fetching child name:", err.response?.data || err.message);
    return null;
  }
};

const getPreviousConversations = async (phone) => {
  if (!phone) return [];

  const lastTen = phone.slice(-10);
  console.log(`🔍 Looking up child with last 10 digits: ${lastTen}`);

  try {
    const filterFormula = `RIGHT({Phone}, 10) = "${lastTen}"`;

    const response = await axios.get(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME_ONE)}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`
        },
        params: {
          filterByFormula: filterFormula,
          pageSize: 10 // can fetch up to 10 if needed
        }
      }
    );

    const sortedRecords = response.data.records
      .filter((r) => r.fields?.Conversation && r.fields?.Created)
      .sort((a, b) => new Date(b.fields.Created) - new Date(a.fields.Created)); // descending

    if (sortedRecords.length > 0) {
      const latest = sortedRecords[0].fields.Created;
      console.log(`🗂 Found ${sortedRecords.length} past conversation(s). Latest at: ${new Date(latest).toLocaleString()}`);
    } else {
      console.log(`📭 No past conversations found for phone ending in ${lastTen}`);
    }

    return sortedRecords.map((r) => r.fields.Conversation);
  } catch (err) {
    console.error("❌ Error fetching previous conversations:", err.response?.data || err.message);
    return [];
  }
};


app.post("/next-question", async (req, res) => {

  const { answers, phone } = req.body;

  const childName = await getChildNameFromPhone(phone);

  const previousConversations = await getPreviousConversations(phone);

  if (childName) {
    console.log(`✅ Child found: ${childName}`);
  } else {
    console.warn(`⚠️ No child found for phone: ${phone}`);
  }


  let priorContext = "";

  if (previousConversations.length > 0) {
    priorContext = `Here are some past feedback conversations from this child:\n\n` +
      previousConversations.map((conv, i) => `--- Previous Session ${i + 1} ---\n${conv}`).join('\n\n') +
      `\n\nUse this for context while continuing the chat. Do not start the conversation anew. Make it feel like you already know them. Do not go asking all the same questions as in previous chats, vary them. Make sure you follow up on any difficulties they had during past. Now start the conversation.`;
  }

  const SYSTEM_PROMPT_WITH_NAME = childName
    ? `${SYSTEM_PROMPT}\n\nThe child you're speaking with is named ${childName}. Use their first name while conversing.\n\n${priorContext}`
    : `${SYSTEM_PROMPT}\n\n${priorContext}`;

  const messages = [{ role: "system", content: SYSTEM_PROMPT_WITH_NAME }];

  if (answers && answers.length > 0) {
    answers.forEach((pair, i) => {
      messages.push({ role: "assistant", content: pair.question });
      messages.push({ role: "user", content: pair.answer });
    });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-turbo",
        messages,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const botMsg = response.data.choices?.[0]?.message?.content || "";
    const isEnding = botMsg.toLowerCase().includes("ending the conversation now");

    console.log("\n🟩 New Bot Question:");
    console.log(botMsg);

    if (isEnding && answers && answers.length > 0) {
      // Build conversation with all Q/A pairs
      let conversationText = answers
        .map((pair, i) => `Q${i + 1}: ${pair.question}\nA: ${pair.answer}`)
        .join("\n\n");
      // Check if the last Q is already the ending message
      const lastQ = answers[answers.length - 1]?.question?.trim() || "";
      // Skip saving the final thank-you message (with "ending the conversation now")
      if (
        botMsg &&
        botMsg.trim() !== "" &&
        botMsg.trim() !== lastQ &&
        !botMsg.toLowerCase().includes("ending the conversation now")
      ) {
        conversationText += `\n\nQ${answers.length + 1}: ${botMsg}\nA:`;
      }

      console.log("\n📥 Saving Final Conversation to Airtable:");
      console.log(conversationText);
      try {
        await axios.post(
          airtableBaseURL,
          {
            fields: {
              Phone: phone || '',
              "Child Name": childName || '',
              Conversation: conversationText
            }
          },
          {
            headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );
      } catch (airtableErr) {
        console.error("❌ Airtable save error:", airtableErr.response?.data || airtableErr.message);
      }
    }

    res.json({ question: botMsg });
  } catch (err) {
    console.error("❌ OpenAI error:", err?.response?.data || err.message);
    res.status(500).json({ question: "Sorry, something went wrong." });
  }
});

app.get("/", (req, res) => {
  res.send("👋 Hello! This is the Feedback Bot backend. Use /next-question to talk to the bot.");
});

app.listen(4000, () => {
  console.log("✅ Feedback Bot server running at http://localhost:4000");
});
